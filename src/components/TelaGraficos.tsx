"use client";

import type { ModoSaldo, Painel } from "@/lib/painel";
import PainelRelatorios from "@/components/relatorios/PainelRelatorios";
import type { TipoResumo } from "@/components/mobile/MobileShell";
import type { Resumo } from "@/lib/finance";

/** Módulo de Gráficos/Relatórios: análises por aba (sem repetir o resumo da tela inicial). As props de resumo seguem aceitas para não mexer em page.tsx. */
export default function TelaGraficos({
  estadoCompleto, mes, mesCorrente, resumo, painel, serie, modo, onModo, itens, onAbrirExtrato, rotuloResponsaveis,
}: {
  estadoCompleto: { extrato: any[]; cartao: any[]; contas: any[] };
  mes: string;
  /** Mês do calendário (AAAA-MM), para os rótulos de "hoje" x "fim do mês" */
  mesCorrente: string;
  resumo: Resumo;
  painel: Painel;
  /** Entrou x saiu dos últimos meses (saiu da tela inicial, que mostra só o mês) */
  serie: { mes: string; entrou: number; saiu: number }[];
  modo: ModoSaldo;
  onModo: (m: ModoSaldo) => void;
  itens: { extrato: any[]; cartao: any[]; contas: any[] };
  onAbrirExtrato: (tipo: TipoResumo) => void;
  /** Pessoas do filtro global, só para o rótulo dos relatórios exportados */
  rotuloResponsaveis?: string;
}) {
  return <PainelRelatorios estado={estadoCompleto} mes={mes} rotuloResponsaveis={rotuloResponsaveis} />;
}
