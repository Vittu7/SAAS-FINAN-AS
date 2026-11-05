import { brl } from "@/lib/finance";

/** Cor do valor pelo sinal: positivo verde, negativo vermelho, zero neutro. */
export const tomDoValor = (v: number) => (v > 0.004 ? "text-pos" : v < -0.004 ? "text-neg" : "text-ink");

/** Saldo com o mesmo sinal de menos em todo lugar ("− R$ 240,00"). */
export const saldo = (v: number) => (v < -0.004 ? `− ${brl(-v)}` : brl(Math.abs(v) < 0.005 ? 0 : v));

/** Variação com sinal explícito ("+ R$ 10,00", "− R$ 10,00", "R$ 0,00"). */
export const comSinal = (v: number) => (Math.abs(v) < 0.005 ? brl(0) : `${v < 0 ? "−" : "+"} ${brl(Math.abs(v))}`);

/** Fundo e borda suaves por sinal (resultado, conferência). */
export const tomDoCartao = (v: number) =>
  v > 0.004 ? "border-pos-borda bg-pos-bg" : v < -0.004 ? "border-neg-borda bg-neg-bg" : "border-line bg-background";
export const tomDoTitulo = (v: number) => (v > 0.004 ? "text-pos-ink" : v < -0.004 ? "text-neg-ink" : "text-muted");
