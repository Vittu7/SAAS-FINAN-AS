import { useEffect, useSyncExternalStore } from "react";
import type { Estado } from "./types";
import { calcularMes } from "./calculos";

/** Formata valores numéricos para BRL com proteção contra undefined, null e NaN */
/* ---------- Ocultar valores (vale para o sistema inteiro) ---------- */
const CHAVE_OCULTAR = "valores-ocultos";
let ocultos = false;
const ouvintes = new Set<() => void>();

export const valoresOcultos = () => ocultos;

export function definirValoresOcultos(v: boolean) {
  ocultos = v;
  try { localStorage.setItem(CHAVE_OCULTAR, v ? "1" : "0"); } catch { /* sem armazenamento */ }
  ouvintes.forEach((f) => f());
}

/** Use em qualquer componente que precise reagir ao botão de ocultar valores. */
export function useValoresOcultos(): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => ocultos,
    () => false,
  );
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_OCULTAR) === "1" && !ocultos) { ocultos = true; ouvintes.forEach((f) => f()); }
    } catch { /* ignora */ }
  }, []);
  return [valor, definirValoresOcultos];
}

export const MASCARA = "R$ ••••";

/** Formata dinheiro; com "ocultar valores" ligado mostra só a máscara. */
export const brl = (v?: number | null) =>
  ocultos ? MASCARA : (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Porcentagem (também some quando os valores estão ocultos). */
export const pct = (v: number, casas = 0) => (ocultos ? "••%" : `${v.toFixed(casas)}%`);

/** Aceita "1.234,56", "1234,56" ou "1234.56". Retorna 0 se inválido. */
export function parseValor(texto: string): number {
  const s = texto.trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const fmtMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const mesAtual = () => fmtMes(new Date());

export function addMeses(mes: string, n: number): string {
  if (!mes) return mesAtual();
  const [a, m] = mes.split("-").map(Number);
  return fmtMes(new Date(a, m - 1 + n, 1));
}

export function rotuloMes(mes: string): string {
  if (!mes) return "";
  const [a, m] = mes.split("-").map(Number);
  const txt = new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export type Resumo = {
  /** Entradas do mês (lançadas; se não houver, o salário configurado) */
  entradas: number;
  /** Saídas do mês: à vista + parcelas + contas fixas */
  totalGasto: number;
  totalGeral: number;
  /** Saldo restante = entradas − saídas */
  sobra: number;
  /** Contas fixas ainda não pagas (informativo) */
  faltaPagar: number;
  usandoSalarioConfigurado: boolean;
  porResponsavel: Record<string, number>;
  porOrigem: { extrato: number; cartao: number; contas: number };
};

export function resumoDoMes(e: Estado, mes: string): Resumo {
  const r = calcularMes(e, { mes, salarioConfig: e?.config?.salario ?? 0 });
  return {
    entradas: r.entradas,
    totalGasto: r.saidas,
    totalGeral: r.saidas,
    sobra: r.saldoRestante,
    faltaPagar: r.faltaPagar,
    usandoSalarioConfigurado: r.fallbackSalario,
    porResponsavel: r.porResponsavel,
    porOrigem: r.porOrigem,
  };
}
