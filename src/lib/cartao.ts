import { COR_PADRAO } from "@/lib/useOpcoes";

/** Fundo padrão dos cartões de crédito em todos os módulos (mesma cor cadastrada em Configurações). */
export function gradienteCartao(cor?: string | null) {
  return `linear-gradient(135deg, ${cor || COR_PADRAO}, #0f172a)`;
}
