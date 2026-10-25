/**
 * Preferências locais SEMPRE separadas por usuário: a chave inclui o id da pessoa,
 * então dois perfis no mesmo aparelho nunca veem o histórico um do outro.
 */
const chave = (userId: string, nome: string) => `hc:${userId}:${nome}`;

export function lerDoUsuario<T>(userId: string | null | undefined, nome: string, padrao: T): T {
  if (!userId || typeof window === "undefined") return padrao;
  try {
    const bruto = localStorage.getItem(chave(userId, nome));
    return bruto ? ({ ...(typeof padrao === "object" && !Array.isArray(padrao) ? padrao : {}), ...JSON.parse(bruto) } as T) : padrao;
  } catch {
    return padrao;
  }
}

export function lerListaDoUsuario(userId: string | null | undefined, nome: string): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(chave(userId, nome)) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function salvarDoUsuario(userId: string | null | undefined, nome: string, valor: unknown) {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(chave(userId, nome), JSON.stringify(valor));
  } catch {
    /* sem armazenamento disponível */
  }
}
