"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CreditCard, Wallet } from "lucide-react";
import { Ico } from "@/components/icons";
import CadastrarCartaoModal from "@/components/CadastrarCartaoModal";
import DialogResponsivo from "@/components/DialogResponsivo";
import { SeletorOpcao } from "@/components/SeletorOpcao";
import { useOpcoes } from "@/lib/useOpcoes";
import { parseValor, rotuloMes } from "@/lib/finance";
import type { Membro } from "@/hooks/useFinanceStore";

/** ÚNICO lugar para criar lançamentos: entrada, saída à vista, compra parcelada ou conta fixa. */

type Tipo = "saida" | "entrada";
type Como = "avista" | "parcelado" | "fixa";

const CATEGORIAS_ENTRADA = ["Salário", "Extra", "Reembolso", "Rendimento", "Outros"];

const campo = "h-11 w-full rounded-xl border border-line bg-background px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";
const rotulo = "mb-1 block text-xs font-medium text-muted";

export default function NovaTransacao({
  mes,
  membros,
  userId,
  tipoInicial = "saida",
  comoInicial = "avista",
  onFechar,
  onAdicionarExtrato,
  onAdicionarCartao,
  onAdicionarConta,
}: {
  mes: string;
  membros: Membro[];
  userId: string | null;
  tipoInicial?: Tipo;
  comoInicial?: Como;
  onFechar: () => void;
  onAdicionarExtrato: (item: any) => Promise<void> | void;
  onAdicionarCartao: (item: any, gerarSeguintes: boolean) => Promise<void> | void;
  onAdicionarConta: (item: any) => Promise<void> | void;
}) {
  const { pagamento: formas, categoria: categorias, recarregar } = useOpcoes();
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [como, setComo] = useState<Como>(comoInicial);
  const [cadastrandoCartao, setCadastrandoCartao] = useState(false);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [forma, setForma] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("1");
  const [parcelaTotal, setParcelaTotal] = useState("2");
  const [vencimento, setVencimento] = useState("");
  const [quem, setQuem] = useState<string[]>([]);
  const [visivelPara, setVisivelPara] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const meu = membros.find((m) => m.id === userId);
  const meuNome = meu?.nome || "Usuário";
  const cartoes = useMemo(() => formas.filter((f) => f.eh_cartao), [formas]);
  const listaForma = como === "parcelado" ? (cartoes.length ? cartoes : formas) : formas;

  useEffect(() => {
    if (quem.length === 0) setQuem([meuNome]);
  }, [meuNome, quem.length]);

  useEffect(() => {
    if (!listaForma.some((f) => f.nome === forma)) setForma(listaForma[0]?.nome || "");
  }, [listaForma, forma]);

  const saida = tipo === "saida";
  const cor = saida ? "bg-rose-700 text-white" : "bg-emerald-700 text-white";

  const alternarQuem = (nome: string) =>
    setQuem((q) => (q.includes(nome) ? (q.length > 1 ? q.filter((x) => x !== nome) : q) : [...q, nome]));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseValor(valor);
    if (!total) return setErro("Digite um valor maior que zero.");
    if (!descricao.trim()) return setErro("Escreva uma descrição curta.");
    setErro("");
    setSalvando(true);

    const responsaveis = saida ? (quem.length ? quem : [meuNome]) : [meuNome];
    const individual = total / responsaveis.length;
    const nomeDe = (r: string) => (responsaveis.length > 1 ? `${descricao.trim()} (${responsaveis.indexOf(r) + 1}/${responsaveis.length})` : descricao.trim());
    const privado = visivelPara === "privado";
    const compartilhado_com = visivelPara && visivelPara !== "privado" ? visivelPara : null;

    try {
      if (!saida) {
        await onAdicionarExtrato({ mes, tipo: "entrada", pagamento: "Entrada", categoria: categoria || "Salário", valor: total, descricao: descricao.trim(), responsavel: meuNome, privado, compartilhado_com });
      } else if (como === "avista") {
        for (const r of responsaveis)
          await onAdicionarExtrato({ mes, pagamento: forma || "Geral", categoria: categoria || "Outros", valor: individual, descricao: nomeDe(r), responsavel: r, privado, compartilhado_com });
      } else if (como === "parcelado") {
        const atual = Math.max(1, Number(parcelaAtual) || 1);
        const totalP = Math.max(atual, Number(parcelaTotal) || 1);
        for (const r of responsaveis)
          await onAdicionarCartao({ mes, cartao: forma || "Cartão", categoria: categoria || "Outros", valor: individual, descricao: nomeDe(r), parcelaAtual: atual, parcelaTotal: totalP, responsavel: r, privado, compartilhado_com }, true);
      } else {
        const dia = Number(vencimento);
        if (vencimento && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
          setSalvando(false);
          return setErro("O vencimento deve ser um dia entre 1 e 31.");
        }
        for (const r of responsaveis)
          await onAdicionarConta({ mes, nome: nomeDe(r), valor: individual, vencimento: vencimento || null, categoria: categoria || "Outros", forma_pagamento: forma || null, pago: false, responsavel: r, compartilhado_com });
      }
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  const Chip = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-pressed={ativo} className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition ${ativo ? "bg-accent text-on-accent shadow-sm" : "bg-background text-muted ring-1 ring-line"}`}>
      {children}
    </button>
  );

  return (
    <DialogResponsivo titulo="Nova transação" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-background p-1 ring-1 ring-line" role="group" aria-label="Tipo de transação">
          <button type="button" aria-pressed={saida} onClick={() => setTipo("saida")} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${saida ? "bg-rose-700 text-white shadow" : "text-muted"}`}>
            <Ico icon={ArrowUpRight} size={18} />Saída
          </button>
          <button type="button" aria-pressed={!saida} onClick={() => setTipo("entrada")} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${!saida ? "bg-emerald-700 text-white shadow" : "text-muted"}`}>
            <Ico icon={ArrowDownLeft} size={18} />Entrada
          </button>
        </div>

        <div>
          <label htmlFor="nt-valor" className={rotulo}>{saida && como === "parcelado" ? "Valor de cada parcela" : "Valor"}</label>
          <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-accent">
            <span className="text-2xl font-semibold text-muted">R$</span>
            <input id="nt-valor" autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className={`w-full min-w-0 bg-transparent text-4xl font-semibold tabular-nums outline-none ${saida ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`} />
          </div>
        </div>

        <div>
          <label htmlFor="nt-desc" className={rotulo}>Descrição</label>
          <input id="nt-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={saida ? "Ex.: Mercado, Internet, Celular" : "Ex.: Salário de outubro"} className={campo} />
        </div>

        {saida && (
          <div>
            <span className={rotulo}>Como foi?</span>
            <div className="flex gap-2">
              <Chip ativo={como === "avista"} onClick={() => setComo("avista")}><Ico icon={Wallet} size={16} />À vista</Chip>
              <Chip ativo={como === "parcelado"} onClick={() => setComo("parcelado")}><Ico icon={CreditCard} size={16} />Parcelado</Chip>
              <Chip ativo={como === "fixa"} onClick={() => setComo("fixa")}><Ico icon={CalendarClock} size={16} />Fixa</Chip>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {como === "avista" && "Gasto do dia a dia (Pix, débito, dinheiro, cartão à vista)."}
              {como === "parcelado" && "Compra dividida: as parcelas seguintes são criadas nos próximos meses."}
              {como === "fixa" && "Conta que se repete todo mês (aluguel, internet, assinaturas)."}
            </p>
          </div>
        )}

        {saida && como === "parcelado" && cartoes.length === 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm" role="note">
            <p className="font-semibold">Você ainda não cadastrou um cartão.</p>
            <p className="mt-0.5 text-muted">Cadastre o cartão primeiro; leva menos de um minuto.</p>
            <button type="button" onClick={() => setCadastrandoCartao(true)} className="mt-2 h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent">Cadastrar cartão</button>
          </div>
        )}

        {saida ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={rotulo}>{como === "parcelado" ? "Cartão" : "Forma de pagamento"}</span>
              <SeletorOpcao opcoes={listaForma} valor={forma} onChange={setForma} />
            </div>
            <div>
              <span className={rotulo}>Categoria</span>
              <SeletorOpcao opcoes={categorias} valor={categoria} onChange={setCategoria} />
            </div>
          </div>
        ) : (
          <div>
            <span className={rotulo}>Tipo de entrada</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_ENTRADA.map((c) => (
                <button key={c} type="button" aria-pressed={(categoria || "Salário") === c} onClick={() => setCategoria(c)} className={`h-9 rounded-full px-4 text-sm font-medium transition ${(categoria || "Salário") === c ? "bg-emerald-700 text-white" : "bg-background text-muted ring-1 ring-line"}`}>{c}</button>
              ))}
            </div>
          </div>
        )}

        {saida && como === "parcelado" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="nt-pa" className={rotulo}>Parcela atual</label><input id="nt-pa" type="number" min={1} inputMode="numeric" value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} className={campo} /></div>
            <div><label htmlFor="nt-pt" className={rotulo}>Total de parcelas</label><input id="nt-pt" type="number" min={1} max={60} inputMode="numeric" value={parcelaTotal} onChange={(e) => setParcelaTotal(e.target.value)} className={campo} /></div>
          </div>
        )}

        {saida && como === "fixa" && (
          <div><label htmlFor="nt-venc" className={rotulo}>Dia do vencimento (opcional)</label><input id="nt-venc" type="number" min={1} max={31} inputMode="numeric" placeholder="Ex.: 10" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={campo} /></div>
        )}

        {membros.length > 0 && (
          <details className="rounded-xl ring-1 ring-line">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-muted">Mais opções (quem paga e quem vê)</summary>
            <div className="space-y-3 border-t border-line p-3">
              {saida && membros.length > 1 && (
                <div>
                  <span className={rotulo}>Quem paga (o valor é dividido)</span>
                  <div className="flex flex-wrap gap-2">
                    {membros.map((m) => (
                      <button key={m.id} type="button" aria-pressed={quem.includes(m.nome)} onClick={() => alternarQuem(m.nome)} className={`h-9 rounded-full px-4 text-sm font-medium transition ${quem.includes(m.nome) ? "bg-accent text-on-accent" : "bg-background text-muted ring-1 ring-line"}`}>{m.nome}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="nt-vis" className={rotulo}>Quem pode ver</label>
                <select id="nt-vis" value={visivelPara} onChange={(e) => setVisivelPara(e.target.value)} className={campo}>
                  <option value="">Todo o grupo</option>
                  <option value="privado">Só eu</option>
                  {membros.filter((m) => m.id !== userId).map((m) => (<option key={m.id} value={m.id}>Eu e {m.nome}</option>))}
                </select>
              </div>
            </div>
          </details>
        )}

        <p className="text-xs text-muted">Será lançado em {rotuloMes(mes)}.</p>
        {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}

        <button type="submit" disabled={salvando} className={`h-12 w-full rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-60 ${cor}`}>
          {salvando ? "Salvando..." : saida ? "Salvar saída" : "Salvar entrada"}
        </button>
      </form>
      {cadastrandoCartao && <CadastrarCartaoModal onFechar={() => setCadastrandoCartao(false)} onConcluir={() => recarregar()} />}
    </DialogResponsivo>
  );
}
