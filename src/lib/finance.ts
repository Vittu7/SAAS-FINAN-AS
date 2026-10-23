import type { Estado } from "./types";
import { MASCARA_VALOR, valoresOcultos } from "./privacidade";

/** Formata valores numéricos para BRL com proteção contra undefined, null e NaN.
 *  Com "ocultar valores" ativo, devolve a máscara em vez do número. */
export const brl = (v?: number | null) =>
  valoresOcultos()
    ? MASCARA_VALOR
    : (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  salario: number;
  totalGasto: number;
  totalGeral: number;
  porResponsavel: Record<string, number>;
  porOrigem: { extrato: number; cartao: number; contas: number };
  /** Gastos do mês em que o usuário logado é o responsável */
  meusGastos: number;
  /** Salário menos os gastos do próprio usuário */
  sobra: number;
};

const soma = (itens: { valor: number }[]) =>
  (itens || []).reduce((s, i) => s + (i?.valor || 0), 0);

/** Soma o que o usuário logado (pelo id do perfil) gastou no mês, em todas as origens. */
export function gastosDoUsuario(e: Estado, mes: string, meuId?: string | null): number {
  if (!meuId) return 0;
  const todos: any[] = [...(e?.extrato || []), ...(e?.cartao || []), ...(e?.contas || [])];
  return soma(todos.filter((i) => i?.mes === mes && i?.responsavel_id === meuId));
}

export function resumoDoMes(e: Estado, mes: string, meuId?: string | null): Resumo {
  const porResponsavel: Record<string, number> = {};

  const extrato = (e?.extrato || []).filter((i) => i.mes === mes);
  const cartao = (e?.cartao || []).filter((i) => i.mes === mes);
  const contas = (e?.contas || []).filter((i) => i.mes === mes);

  for (const i of [...extrato, ...cartao, ...contas]) {
    const resp = i?.responsavel || "Membro";
    porResponsavel[resp] = (porResponsavel[resp] || 0) + (i?.valor || 0);
  }

  const porOrigem = { extrato: soma(extrato), cartao: soma(cartao), contas: soma(contas) };
  const totalGasto = porOrigem.extrato + porOrigem.cartao + porOrigem.contas;

  const salario = e?.config?.salario ?? 0;
  const meusGastos = gastosDoUsuario(e, mes, meuId);

  return {
    salario,
    totalGasto,
    totalGeral: totalGasto,
    porResponsavel,
    porOrigem,
    meusGastos,
    sobra: salario - meusGastos,
  };
}