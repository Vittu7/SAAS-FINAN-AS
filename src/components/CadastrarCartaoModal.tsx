"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";
import { useOpcoes } from "@/lib/useOpcoes";
import { parseValor, brl } from "@/lib/finance";
import { gradienteCartao } from "@/lib/cartao";

const CORES = ["#8A05BE", "#EC7000", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#334155"];
const campo = "h-12 w-full rounded-xl border border-line bg-background px-3 text-base text-ink outline-none focus:ring-2 focus:ring-accent";

/** Assistente em 3 passos para cadastrar o primeiro (ou mais um) cartão de crédito. */
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
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const avancar = () => {
    if (passo === 0 && !nome.trim()) return setErro("Digite o nome do cartão para continuar.");
    setErro("");
    setPasso((p) => p + 1);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro("");
    try {
      await adicionarPagamento(nome, { isCartaoCredito: true, limiteTotal: parseValor(limite) || 0, cor });
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
          <div className="space-y-2">
            <h3 className="text-base font-bold">Como você chama esse cartão?</h3>
            <p className="text-sm text-muted">Use o nome do banco ou do cartão, assim você o reconhece rápido. Ex.: Nubank, Itaú.</p>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cartão" aria-label="Nome do cartão" className={campo} />
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-2">
            <h3 className="text-base font-bold">Qual é o limite total?</h3>
            <p className="text-sm text-muted">Está no aplicativo do banco. Com ele, mostramos quanto da fatura já foi usado. Pode deixar em branco e informar depois.</p>
            <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-accent">
              <span className="text-xl font-semibold text-muted">R$</span>
              <input autoFocus inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="0,00" aria-label="Limite total" className="w-full bg-transparent text-3xl font-semibold tabular-nums outline-none" />
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-3">
            <h3 className="text-base font-bold">Escolha uma cor</h3>
            <div className="overflow-hidden rounded-2xl p-4 text-white shadow-lg" style={{ background: gradienteCartao(cor) }}>
              <p className="text-sm font-semibold">{nome.trim() || "Seu cartão"}</p>
              <p className="text-xs text-white/70">Cartão de crédito</p>
              <p className="mt-4 text-xs text-white/70">Limite total</p>
              <p className="text-lg font-bold">{brl(parseValor(limite) || 0)}</p>
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
            <p className="mt-1 text-sm text-muted">{nome.trim()} já aparece em Cartões e Faturas. Que tal lançar uma compra nele agora?</p>
          </div>
        )}

        {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}

        <div className="flex gap-2">
          {passo > 0 && passo < 3 && <button type="button" onClick={() => setPasso((p) => p - 1)} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Voltar</button>}
          {passo < 2 && <button type="button" onClick={avancar} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">Continuar</button>}
          {passo === 2 && <button type="button" onClick={salvar} disabled={salvando} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60">{salvando ? "Salvando..." : "Salvar cartão"}</button>}
          {passo === 3 && (
            <>
              <button type="button" onClick={onFechar} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Agora não</button>
              {onLancarCompra && <button type="button" onClick={() => { onFechar(); onLancarCompra(); }} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">Lançar uma compra</button>}
            </>
          )}
        </div>
      </div>
    </DialogResponsivo>
  );
}
