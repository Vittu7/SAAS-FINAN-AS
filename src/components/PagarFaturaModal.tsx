"use client";

import { useMemo, useState } from "react";
import { avisos } from "@/lib/avisos";
import DialogResponsivo from "@/components/DialogResponsivo";
import { brl, parseValor, rotuloMes } from "@/lib/finance";
import { tipoDaConta } from "@/lib/contas";
import { validarPagamento, type PagamentoFatura } from "@/lib/pagamentoFatura";
import type { Opcao } from "@/lib/useOpcoes";

const campo = "h-12 w-full rounded-xl border border-line bg-background px-3 text-base text-ink outline-none focus:ring-2 focus:ring-accent";
const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Pagar a fatura de um cartão (total ou parcial). O pagamento tira dinheiro da conta escolhida e quita a fatura;
 * ele NÃO é uma nova despesa (a compra já contou). O id é gerado quando o formulário abre: se o envio for repetido,
 * o banco recusa o segundo registro.
 */
export default function PagarFaturaModal({
  cartao, mes, total, pago, restante, contas, saldoDaConta, existentes, onRegistrar, onFechar,
}: {
  cartao: string;
  mes: string;
  total: number;
  pago: number;
  restante: number;
  /** contas de débito do usuário */
  contas: Opcao[];
  saldoDaConta: (conta: Opcao) => number;
  existentes: PagamentoFatura[];
  onRegistrar: (p: PagamentoFatura) => Promise<string | null>;
  onFechar: () => void;
}) {
  const debitos = useMemo(() => contas.filter((o) => tipoDaConta(o) === "debito"), [contas]);
  const [idPagamento] = useState(() => crypto.randomUUID()); // fixo enquanto o formulário está aberto
  const [conta, setConta] = useState(debitos[0]?.nome ?? "");
  const [valor, setValor] = useState(restante.toFixed(2).replace(".", ","));
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valorNum = parseValor(valor);
  const contaSel = debitos.find((o) => o.nome === conta);
  const saldo = contaSel ? saldoDaConta(contaSel) : null;
  const apos = Math.max(0, Math.round((restante - (valorNum > 0 ? valorNum : 0)) * 100) / 100);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const problema = validarPagamento(valorNum, restante, { conta, id: idPagamento, existentes });
    if (problema) return setErro(problema);
    if (!data) return setErro("Escolha a data do pagamento.");
    if (saldo !== null && valorNum > saldo && !window.confirm(`O valor excede o saldo de ${conta} em ${brl(valorNum - saldo)}. Pagar mesmo assim?`)) return;
    setSalvando(true);
    setErro("");
    const falha = await onRegistrar({ id: idPagamento, cartao, mes, conta, valor: Math.round(valorNum * 100) / 100, data });
    setSalvando(false);
    if (falha) return setErro(falha);
    avisos.sucesso("Fatura paga", `${brl(valorNum)} de ${cartao} saiu de ${conta}.`);
    onFechar();
  };

  return (
    <DialogResponsivo titulo="Pagar fatura" onFechar={onFechar}>
      <form onSubmit={confirmar} className="space-y-5">
        <div className="rounded-2xl bg-background p-4 ring-1 ring-line">
          <p className="text-xs text-muted">{cartao} · fatura de {rotuloMes(mes)}</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-[11px] text-muted">Total</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(total)}</p></div>
            <div><p className="text-[11px] text-muted">Já pago</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(pago)}</p></div>
            <div><p className="text-[11px] text-muted">Restante</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(restante)}</p></div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="valor-fatura" className="text-sm font-semibold">Quanto você vai pagar?</label>
          <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-accent">
            <span className="text-xl font-semibold text-muted">R$</span>
            <input id="valor-fatura" autoFocus inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setErro(""); }} placeholder="0,00" className="w-full bg-transparent text-3xl font-semibold tabular-nums outline-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setValor(restante.toFixed(2).replace(".", ","))} className="h-8 rounded-full border border-line px-3 text-xs font-medium">Pagar tudo ({brl(restante)})</button>
            {restante > 1 && <button type="button" onClick={() => setValor((Math.floor(restante * 50) / 100).toFixed(2).replace(".", ","))} className="h-8 rounded-full border border-line px-3 text-xs font-medium">Metade</button>}
          </div>
          <p className="text-xs text-muted">{valorNum > 0 && valorNum <= restante ? (apos === 0 ? "A fatura ficará totalmente paga." : `Depois deste pagamento ainda restam ${brl(apos)}.`) : "Pode ser o valor total ou parcial."}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">De qual conta sai o dinheiro?</p>
          {debitos.length === 0 ? (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Cadastre uma conta de débito para registrar o pagamento.</p>
          ) : (
            <div role="radiogroup" aria-label="Conta de origem" className="space-y-2">
              {debitos.map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${conta === c.nome ? "border-accent bg-accent/10" : "border-line"}`}>
                  <input type="radio" name="conta-fatura" checked={conta === c.nome} onChange={() => setConta(c.nome)} className="accent-[var(--accent)]" />
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
                  <span className="shrink-0 text-xs text-muted">saldo {brl(saldoDaConta(c))}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="data-fatura" className="text-sm font-semibold">Data do pagamento</label>
          <input id="data-fatura" type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
        </div>

        <p className="text-xs text-muted">O pagamento reduz o saldo da conta e quita a fatura. Ele não é uma nova despesa: a compra já foi contada quando você a lançou.</p>
        {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onFechar} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Cancelar</button>
          <button type="submit" disabled={salvando || debitos.length === 0 || restante <= 0} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60">{salvando ? "Registrando..." : "Pagar fatura"}</button>
        </div>
      </form>
    </DialogResponsivo>
  );
}
