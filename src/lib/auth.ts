/** Autenticação: o acesso ao HomeCash é feito SOMENTE com a conta Google (sem e-mail/senha). */

/** Traduz erros do Supabase Auth / OAuth para mensagens claras em português. */
export function traduzirErroAuth(erro: unknown): string {
  const bruto = String((erro as any)?.message ?? erro ?? "");
  const m = bruto.toLowerCase();
  if (m.includes("missing oauth secret") || m.includes("unsupported provider") || m.includes("provider is not enabled")) return "O login com o Google ainda não está configurado no servidor. Avise o administrador do sistema.";
  if (m.includes("access_denied") || m.includes("access denied")) return "O acesso foi cancelado. Toque em “Continuar com o Google” para tentar de novo.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled") || m.includes("signups are disabled")) return "O cadastro está desativado neste momento.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  if (m.includes("database error")) return "Não foi possível finalizar o cadastro agora (erro no servidor). Tente novamente em instantes.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique sua internet.";
  return bruto || "Ocorreu um erro. Tente novamente.";
}

/** Lê o erro que o Supabase/Google devolve na URL quando o login não termina (ex.: ?error=access_denied). */
export function erroDaUrl(search: string, hash: string): string | null {
  const ler = (texto: string) => {
    const p = new URLSearchParams(texto.replace(/^[?#]/, ""));
    return p.get("error_description") || p.get("error");
  };
  const bruto = ler(search) || ler(hash);
  return bruto ? traduzirErroAuth(bruto.replace(/\+/g, " ")) : null;
}

/** Remove a lista antiga de "contas lembradas" (guardava e-mails no aparelho para o login por senha). */
export function limparContasLembradas() {
  try {
    localStorage.removeItem("hc:contas-lembradas");
  } catch {
    /* sem armazenamento */
  }
}

/** Volta a cor de destaque ao padrão (verde-água) neste aparelho. */
export function restaurarCorPadrao() {
  try {
    localStorage.setItem("homecash-accent", "teal");
    const raiz = document.documentElement;
    raiz.dataset.accent = "teal";
    raiz.style.removeProperty("--accent");
    raiz.style.removeProperty("--on-accent");
  } catch {
    /* ignora */
  }
}

type ClienteAuth = { auth: { signOut: () => Promise<unknown> } };

/** Sai da conta e devolve a aparência ao padrão para a próxima pessoa que usar o aparelho. */
export async function sairDaConta(client: ClienteAuth) {
  await client.auth.signOut();
  restaurarCorPadrao();
}
