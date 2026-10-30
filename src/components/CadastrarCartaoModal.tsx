"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";
import { useOpcoes } from "@/lib/useOpcoes";
import { parseValor, brl } from "@/lib/finance";
import { gradienteCartao } from "@/lib/cartao";
import type { TipoCartao } from "@/lib/contas";

const CORES = ["#8A05BE", "#EC7000", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#334155"];
const campo = "h-12 w-full rounded-xl border border-line bg-background px-3 text-base text-ink outline-none focus:ring-2 focus:ring-accent";

/** Assistente em 3 passos para cadastrar um cartão de crédito ou uma conta/cartão de débito. */
export default function CadastrarCartaoModal({
  onFechar, onConcluir, onLancarCompra,
}: {
  onFechar: () => void;
  /** Avisa quem abriu o assistente para recarregar a lista de cartões */
  onConcluir?: (nome: string) => void;
  onLancarCompra?: () => void;
}) {
  const { adicionarPagamento } = useOpcoes();
  const [passo, setPasso] = useState(0);
  const [tipo, setTipo] = useState<TipoCartao>("credito");
  const [nome, setNome] = useState("");
  // No crédito é o limite total; no débito é o saldo atual da conta
  const [valor, setValor] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const credito = tipo === "credito";

  const avancar = () => {
    if (passo === 0 && !nome.trim()) return setErro("Digite o nome do cartão para continuar.");
    setErro("");
    setPasso((p) => p + 1);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro("");
    try {
      const v = parseValor(valor) || 0;
      await adicionarPagamento(nome, {
        tipoCartao: tipo,
        limiteTotal: credito ? v : 0,
        saldoInicial: credito ? 0 : v,
        cor,
      });
      onConcluir?.(nome.trim());
      setPasso(3);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogResponsivo titulo="Cadastrar cartão" onFechar={onFechar}>
      <div className="space-y-5">
        {passo < 3 && (
          <div className="flex items-center gap-1.5" aria-label={`Passo ${passo + 1} de 3`}>
            {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= passo ? "bg-accent" : "bg-line"}`} />)}
          </div>
        )}

        {passo === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-background p-1 ring-1 ring-line" role="group" aria-label="Tipo do cartão">
              {(["credito", "debito"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}
                  className={`h-10 rounded-xl text-sm font-semibold ${tipo === t ? "bg-accent text-on-accent" : "text-muted"}`}>
                  {t === "credito" ? "Crédito" : "Débito"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {credito ? "Crédito: tem limite e fatura mensal." : "Débito: usa o saldo da conta. Entradas aumentam e saídas diminuem esse saldo."}
            </p>
            <h3 className="text-base font-bold">Como você chama esse cartão?</h3>
            <p className="text-sm text-muted">Use o nome do banco ou do cartão, assim você o reconhece rápido. Ex.: Nubank, Itaú.</p>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cartão" aria-label="Nome do cartão" className={campo} />
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-2">
            <h3 className="text-base font-bold">{credito ? "Qual é o limite total?" : "Qual é o saldo atual da conta?"}</h3>
            <p className="text-sm text-muted">
              {credito
                ? "Está no aplicativo do banco. Com ele, mostramos quanto da fatura já foi usado. Pode deixar em branco e informar depois."
                : "É o dinheiro que já está na conta hoje. Entradas e saídas lançadas daqui para frente atualizam esse saldo."}
            </p>
            <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-accent">
              <span className="text-xl font-semibold text-muted">R$</span>
              <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" aria-label={credito ? "Limite total" : "Saldo atual"} className="w-full bg-transparent text-3xl font-semibold tabular-nums outline-none" />
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-3">
            <h3 className="text-base font-bold">Escolha uma cor</h3>
            <div className="overflow-hidden rounded-2xl p-4 text-white shadow-lg" style={{ background: gradienteCartao(cor) }}>
              <p className="text-sm font-semibold">{nome.trim() || "Seu cartão"}</p>
              <p className="text-xs text-white/70">{credito ? "Cartão de crédito" : "Cartão de débito"}</p>
              <p className="mt-4 text-xs text-white/70">{credito ? "Limite total" : "Saldo disponível"}</p>
              <p className="text-lg font-bold">{brl(parseValor(valor) || 0)}</p>
            </div>
            <div className="flex flex-wrap gap-2.5" role="group" aria-label="Cor do cartão">
              {CORES.map((c) => (
                <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`} aria-pressed={cor === c} className="grid size-10 place-items-center rounded-full text-white ring-offset-2 ring-offset-surface transition active:scale-90" style={{ backgroundColor: c, boxShadow: cor === c ? `0 0 0 2px ${c}` : undefined }}>
                  {cor === c && <Ico icon={Check} size={16} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="py-4 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Ico icon={Check} size={28} /></span>
            <h3 className="mt-3 text-lg font-bold">Cartão cadastrado!</h3>
            <p className="mt-1 text-sm text-muted">
              {credito
                ? `${nome.trim()} já aparece em Cartões e Faturas. Que tal lançar uma compra nele agora?`
                : `${nome.trim()} já aparece em Saldos e limites, na tela inicial. Lance uma entrada nele para começar.`}
            </p>
          </div>
        )}

        {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}

        <div className="flex gap-2">
          {passo > 0 && passo < 3 && <button type="button" onClick={() => setPasso((p) => p - 1)} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Voltar</button>}
          {passo < 2 && <button type="button" onClick={avancar} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">Continuar</button>}
          {passo === 2 && <button type="button" onClick={salvar} disabled={salvando} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60">{salvando ? "Salvando..." : "Salvar cartão"}</button>}
          {passo === 3 && (
            <>
              <button type="button" onClick={onFechar} className={`h-12 rounded-xl border border-line text-sm font-medium ${credito && onLancarCompra ? "flex-1" : "flex-[2]"}`}>{credito && onLancarCompra ? "Agora não" : "Concluir"}</button>
              {credito && onLancarCompra && <button type="button" onClick={() => { onFechar(); onLancarCompra(); }} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">Lançar uma compra</button>}
            </>
          )}
        </div>
      </div>
    </DialogResponsivo>
  );
}
