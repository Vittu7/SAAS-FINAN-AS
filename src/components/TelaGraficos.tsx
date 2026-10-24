"use client";

import { useState } from "react";
import SummaryCards from "@/components/SummaryCards";
import ResponsavelPanel from "@/components/ResponsavelPanel";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import RelatorioFinanceiro from "@/components/RelatorioFinanceiro";
import { MobileSaldo, type TipoResumo } from "@/components/mobile/MobileShell";
import type { Resumo } from "@/lib/finance";

/** Tela própria de Gráficos, com a aba Relatórios (filtros por período e exportação). */
export default function TelaGraficos({
  estadoCompleto, mes, resumo, itens, onAbrirExtrato,
}: {
  estadoCompleto: { extrato: any[]; cartao: any[]; contas: any[]; config: { salario?: number } };
  mes: string;
  resumo: Resumo;
  itens: { extrato: any[]; cartao: any[]; contas: any[] };
  onAbrirExtrato: (tipo: TipoResumo) => void;
}) {
  const [sub, setSub] = useState<"graficos" | "relatorios">("graficos");
  const chip = (ativo: boolean) => `h-10 flex-1 rounded-full text-sm font-semibold transition sm:flex-none sm:px-6 ${ativo ? "bg-accent text-on-accent shadow-sm" : "text-muted"}`;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line sm:w-fit" role="tablist" aria-label="Gráficos ou relatórios">
        <button type="button" role="tab" aria-selected={sub === "graficos"} onClick={() => setSub("graficos")} className={chip(sub === "graficos")}>Gráficos</button>
        <button type="button" role="tab" aria-selected={sub === "relatorios"} onClick={() => setSub("relatorios")} className={chip(sub === "relatorios")}>Relatórios</button>
      </div>

      {sub === "graficos" ? (
        <>
          <MobileSaldo resumo={resumo} onAbrirExtrato={onAbrirExtrato} />
          <div className="hidden md:block"><SummaryCards resumo={resumo} onAbrirExtrato={onAbrirExtrato} /></div>
          <GraficoEvolucao estado={estadoCompleto} mes={mes} />
          <ResponsavelPanel resumo={resumo} itens={itens} />
        </>
      ) : (
        <RelatorioFinanceiro estado={estadoCompleto} mes={mes} />
      )}
    </div>
  );
}
