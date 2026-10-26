/** Regras e utilitários de autenticação (sem senhas guardadas em lugar nenhum). */

export const SENHA_MIN = 6;
export const MSG_SENHA_CURTA = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;

/** Retorna a mensagem de erro, ou null quando a senha é válida. */
export function validarSenha(senha: string): string | null {
  return senha.length >= SENHA_MIN ? null : MSG_SENHA_CURTA;
}

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Traduz erros do Supabase Auth para mensagens claras em português. */
export function traduzirErroAuth(erro: unknown): string {
  const bruto = String((erro as any)?.message ?? erro ?? "");
  const m = bruto.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado. Abra o link que enviamos para a sua caixa de entrada (veja também o spam).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já está cadastrado. Entre na sua conta ou redefina a senha.";
  if (m.includes("at least 6") || m.includes("password should be")) return MSG_SENHA_CURTA;
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  if (m.includes("sending confirmation") || m.includes("sending recovery") || m.includes("error sending")) return "Não foi possível enviar o e-mail agora. Tente novamente em instantes.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled") || m.includes("signups are disabled")) return "O cadastro por e-mail está desativado neste momento.";
  if (m.includes("database error")) return "Não foi possível finalizar o cadastro agora (erro no servidor). Tente novamente em instantes.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Digite um e-mail válido.";
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique sua internet.";
  return bruto || "Ocorreu um erro. Tente novamente.";
}

export type ResultadoCadastro = "logado" | "confirmar-email" | "ja-cadastrado";

/** Interpreta a resposta do signUp: logado direto, aguardando confirmação por e-mail, ou e-mail já existente. */
export function interpretarCadastro(data: { user?: { identities?: unknown[] | null } | null; session?: unknown | null } | null | undefined): ResultadoCadastro {
  if (data?.session) return "logado";
  // O Supabase não revela e-mails existentes: devolve um usuário sem identidades.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return "ja-cadastrado";
  return "confirmar-email";
}

/* ---------- Contas lembradas neste aparelho (somente dados de exibição) ---------- */
const CHAVE_CONTAS = "hc:contas-lembradas";
export type ContaLembrada = { email: string; nome: string; avatar: string | null };

export function contasLembradas(): ContaLembrada[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_CONTAS) || "[]");
    return Array.isArray(lista) ? lista.filter((c) => c && typeof c.email === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function lembrarConta(conta: ContaLembrada) {
  try {
    // Guarda apenas e-mail, nome e foto. Nunca a senha nem tokens.
    const limpa: ContaLembrada = { email: conta.email.trim().toLowerCase(), nome: conta.nome, avatar: conta.avatar };
    const lista = [limpa, ...contasLembradas().filter((c) => c.email !== limpa.email)].slice(0, 5);
    localStorage.setItem(CHAVE_CONTAS, JSON.stringify(lista));
  } catch {
    /* sem armazenamento */
  }
}

export function esquecerConta(email: string) {
  try {
    localStorage.setItem(CHAVE_CONTAS, JSON.stringify(contasLembradas().filter((c) => c.email !== email.trim().toLowerCase())));
  } catch {
    /* ignora */
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
