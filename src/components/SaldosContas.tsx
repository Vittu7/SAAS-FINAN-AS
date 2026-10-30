"use client";

import { useMemo } from "react";
import { useOpcoes } from "@/lib/useOpcoes";
import { calcularSaldoConta, tipoDaConta } from "@/lib/contas";
import { calcularFatura } from "@/lib/faturas";
import { brl, rotuloMes } from "@/lib/finance";
import type { Estado } from "@/lib/types";

type Linha = { id: string; nome: string; cor: string; valor: number; extra?: string };

/** Saldo (débito) e limite (crédito) em blocos separados: nunca são somados. */
export default function SaldosContas({ estado, userId, mes }: { estado: Estado; userId: string | null; mes: string }) {
  const { pagamento } = useOpcoes();

  const { debitos, creditos } = useMemo(
    () => ({
      debitos: pagamento
        .filter((o) => tipoDaConta(o) === "debito")
        .map((o) => ({ o, saldo: calcularSaldoConta(estado, o, { userId, ateMes: mes }).saldo })),
      creditos: pagamento
        .filter((o) => tipoDaConta(o) === "credito")
        .map((o) => {
          const limite = Number(o.limite) || 0;
          return { o, limite, disponivel: calcularFatura(estado, o.nome, mes, limite).disponivel };
        }),
    }),
    [pagamento, estado, userId, mes],
  );

  if (!debitos.length && !creditos.length) return null;

  const totalSaldo = debitos.reduce((s, x) => s + x.saldo, 0);
  const totalLimite = creditos.reduce((s, x) => s + x.disponivel, 0);

  const bloco = (titulo: string, total: number, linhas: Linha[]) => (
    <div className="min-w-0">
      <p className="text-xs text-muted">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${total < 0 ? "text-rose-700 dark:text-rose-400" : ""}`}>{brl(total)}</p>
      <ul className="mt-3 space-y-2">
        {linhas.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor }} />
              <span className="truncate">{l.nome}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <b className={l.valor < 0 ? "text-rose-700 dark:text-rose-400" : ""}>{brl(l.valor)}</b>
              {l.extra && <span className="block text-[11px] text-muted">{l.extra}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="card-glass space-y-4 p-5" aria-label="Saldos e limites">
      <div>
        <h2 className="text-lg font-semibold">Saldos e limites</h2>
        <p className="text-xs text-muted">Até {rotuloMes(mes)}. Saldo de débito e limite de crédito são controles separados.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {debitos.length > 0 &&
          bloco("Saldo disponível (débito)", totalSaldo, debitos.map(({ o, saldo }) => ({ id: o.id, nome: o.nome, cor: o.cor, valor: saldo })))}
        {creditos.length > 0 &&
          bloco(
            "Limite disponível (crédito)",
            totalLimite,
            creditos.map(({ o, limite, disponivel }) => ({ id: o.id, nome: o.nome, cor: o.cor, valor: disponivel, extra: `de ${brl(limite)}` })),
          )}
      </div>
    </section>
  );
}
