"use client";

import { useMemo } from "react";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { useOpcoes } from "@/lib/useOpcoes";
import { useMovimentosConta } from "@/hooks/useMovimentosConta";
import { usePagamentosFatura } from "@/hooks/usePagamentosFatura";
import { calcularSaldoConta, tipoDaConta } from "@/lib/contas";
import { brl, rotuloMes } from "@/lib/finance";
import type { Estado } from "@/lib/types";

const MAXIMO = 6; // contas listadas na tela inicial

/**
 * Saldo das contas: o saldo de cada conta de débito, até o mês escolhido. O limite dos cartões de crédito aparece em
 * "Meus cartões" e nunca é somado ao saldo (são controles separados).
 */
export default function SaldosContas({ estado, userId, mes }: { estado: Estado; userId: string | null; mes: string }) {
  const { pagamento } = useOpcoes();
  const caixinhaMovs = useMovimentosConta();
  const { pagamentos: pagamentosFatura } = usePagamentosFatura();

  const contas = useMemo(
    () =>
      pagamento
        .filter((o) => tipoDaConta(o) === "debito")
        .map((o) => ({ o, saldo: calcularSaldoConta(estado, o, { userId, ateMes: mes, caixinhaMovs, pagamentosFatura }).saldo })),
    [pagamento, estado, userId, mes, caixinhaMovs, pagamentosFatura],
  );

  if (!contas.length) return null;

  const total = contas.reduce((s, x) => s + x.saldo, 0);
  const visiveis = contas.slice(0, MAXIMO);

  return (
    <CartaoSecao titulo="Saldo das contas" descricao={`Contas de débito até ${rotuloMes(mes).toLowerCase()}`}>
      <div className="grid gap-0.5">
        <span className="text-xs text-muted">Saldo total</span>
        <span className={`text-3xl font-semibold leading-tight tracking-tight tabular-nums ${total < 0 ? "text-neg" : ""}`}>{brl(total)}</span>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {visiveis.map(({ o, saldo }) => (
          <li key={o.id} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.cor }} aria-hidden />
              <span className="truncate">{o.nome}</span>
            </span>
            <b className={`shrink-0 font-semibold tabular-nums ${saldo < 0 ? "text-neg" : ""}`}>{brl(saldo)}</b>
          </li>
        ))}
      </ul>
      {contas.length > MAXIMO && <p className="-mt-2 text-xs text-muted">e mais {contas.length - MAXIMO} {contas.length - MAXIMO === 1 ? "conta" : "contas"}</p>}
    </CartaoSecao>
  );
}
