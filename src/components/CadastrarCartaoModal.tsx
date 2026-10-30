"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";
import { useOpcoes } from "@/lib/useOpcoes";
import { parseValor, brl } from "@/lib/finance";
import { gradienteCartao } from "@/lib/cartao";

type Tipo = "credito" | "debito" | "ambos";

const CORES = ["#8A05BE", "#EC7000", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#334155"];
const campo = "h-12 w-full rounded-xl border border-line bg-background px-3 text-base text-ink outline-none focus:ring-2 focus:ring-accent";
const ROTULO: Record<Tipo, string> = { credito: "Crédito", debito: "Débito", ambos: "Crédito e débito" };

/**
 * Assistente em 3 passos para cadastrar um cartão de crédito, de débito ou os dois.
 * "Crédito e débito" cria duas contas ligadas ("Nome Crédito" e "Nome Débito"): cada lançamento
 * aponta para uma delas, então saldo, limite e fatura nunca se misturam nem se duplicam.
 */
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
  const [tipo, setTipo] = useState<Tipo>("credito");
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("");
  const [saldo, setSaldo] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const temCredito = tipo !== "debito";
  const temDebito = tipo !== "credito";
  const base = nome.trim();

  const avancar = () => {
    if (passo === 0 && !base) return setErro("Digite o nome do cartão para continuar.");
    setErro("");
    setPasso((p) => p + 1);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro("");
    let criouCredito = false;
    try {
      const nomeCredito = tipo === "ambos" ? `${base} Crédito` : base;
      const nomeDebito = tipo === "ambos" ? `${base} Débito` : base;
      if (temCredito) {
        await adicionarPagamento(nomeCredito, { tipoCartao: "credito", limiteTotal: parseValor(limite) || 0, cor });
        criouCredito = true;
      }
      if (temDebito) {
        await adicionarPagamento(nomeDebito, { tipoCartao: "debito", saldoInicial: parseValor(saldo) || 0, cor });
      }
      onConcluir?.(base);
      setPasso(3);
    } catch (e: any) {
      const msg = e?.message || "Não foi possível salvar. Tente novamente.";
      setErro(criouCredito && temDebito ? `O cartão de crédito foi criado, mas o débito falhou: ${msg} Cadastre o débito em Configurações > Cadastros.` : msg);
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
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-background p-1 ring-1 ring-line" role="group" aria-label="Tipo do cartão">
              {(["credito", "debito", "ambos"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}
                  className={`min-h-10 rounded-xl px-1 text-xs font-semibold sm:text-sm ${tipo === t ? "bg-accent text-on-accent" : "text-muted"}`}>
                  {ROTULO[t]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {tipo === "credito" && "Crédito: tem limite e fatura mensal."}
              {tipo === "debito" && "Débito: usa o saldo da conta. Entradas aumentam e saídas diminuem esse saldo."}
              {tipo === "ambos" && "Crédito e débito: criamos duas contas, “Nome Crédito” (limite e fatura) e “Nome Débito” (saldo). Ao lançar uma saída, você escolhe qual usar."}
            </p>
            <h3 className="text-base font-bold">Como você chama esse cartão?</h3>
            <p className="text-sm text-muted">Use o nome do banco ou do cartão, assim você o reconhece rápido. Ex.: Nubank, Itaú.</p>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cartão" aria-label="Nome do cartão" className={campo} />
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-4">
            {temCredito && (
              <div className="space-y-2">
                <h3 className="text-base font-bold">Qual é o limite total do crédito?</h3>
                <p className="text-sm text-muted">Está no aplicativo do banco. Com ele, mostramos quanto da fatura já foi usado. Pode deixar em branco e informar depois.</p>
                <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-accent">
                  <span className="text-xl font-semibold text-muted">R$</span>
                  <input autoFocus inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="0,00" aria-label="Limite total" className="w-full bg-transparent text-3xl font-semibold tabular-nums outline-none" />
                </div>
              </div>
            )}
            {temDebito && (
              <div className="space-y-2">
                <h3 className="text-base font-bold">Qual é o saldo atual da conta (débito)?</h3>
                <p className="text-sm text-muted">É o dinheiro que já está na conta hoje. Entradas e saídas lançadas daqui para frente atualizam esse saldo.</p>
                <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-accent">
                  <span className="text-xl font-semibold text-muted">R$</span>
                  <input autoFocus={!temCredito} inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" aria-label="Saldo atual" className="w-full bg-transparent text-3xl font-semibold tabular-nums outline-none" />
                </div>
              </div>
            )}
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-3">
            <h3 className="text-base font-bold">Escolha uma cor</h3>
            <div className="overflow-hidden rounded-2xl p-4 text-white shadow-lg" style={{ background: gradienteCartao(cor) }}>
              <p className="text-sm font-semibold">{base || "Seu cartão"}</p>
              <p className="text-xs text-white/70">{tipo === "ambos" ? "Cartão de crédito e débito" : tipo === "credito" ? "Cartão de crédito" : "Cartão de débito"}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {temCredito && <div><p className="text-xs text-white/70">Limite total</p><p className="text-lg font-bold">{brl(parseValor(limite) || 0)}</p></div>}
                {temDebito && <div><p className="text-xs text-white/70">Saldo disponível</p><p className="text-lg font-bold">{brl(parseValor(saldo) || 0)}</p></div>}
              </div>
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
              {tipo === "ambos" && `Criamos “${base} Crédito” e “${base} Débito”. Ao lançar, escolha qual deles usar. `}
              {temCredito ? "Que tal lançar uma compra nele agora?" : `${base} já aparece em Saldos e limites, na tela inicial. Lance uma entrada nele para começar.`}
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
              <button type="button" onClick={onFechar} className={`h-12 rounded-xl border border-line text-sm font-medium ${temCredito && onLancarCompra ? "flex-1" : "flex-[2]"}`}>{temCredito && onLancarCompra ? "Agora não" : "Concluir"}</button>
              {temCredito && onLancarCompra && <button type="button" onClick={() => { onFechar(); onLancarCompra(); }} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">Lançar uma compra</button>}
            </>
          )}
        </div>
      </div>
    </DialogResponsivo>
  );
}
