// MFA (TOTP) do administrador no navegador (spec §5.8 R4 e R9).
// A decisão de acesso é do banco (checar_admin exige aal2); aqui só se escolhe a tela e se
// fala com supabase.auth.mfa. O QR, o segredo e o código digitado nunca são gravados
// em armazenamento nem escritos em log, e o código nunca volta em mensagem.

export type Aal = "aal1" | "aal2";
export type TelaMfa = "cadastro" | "verificacao" | "liberado" | "bloqueado";

type Erro = { code?: string; message?: string } | null;

export interface FatorBruto {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at?: string;
}

export interface MfaApi {
  enroll(a: { factorType: "totp"; friendlyName?: string }): Promise<{
    data: { id: string; totp: { qr_code: string; secret: string; uri: string } } | null;
    error: Erro;
  }>;
  challenge(a: { factorId: string }): Promise<{ data: { id: string } | null; error: Erro }>;
  verify(a: { factorId: string; challengeId: string; code: string }): Promise<{ data: unknown; error: Erro }>;
  listFactors(): Promise<{ data: { totp: FatorBruto[]; all: FatorBruto[] } | null; error: Erro }>;
  getAuthenticatorAssuranceLevel(): Promise<{
    data: { currentLevel: string | null; nextLevel: string | null } | null;
    error: Erro;
  }>;
  refreshSession(): Promise<{ error: Erro }>;
}

/** Tabela do §5.8 R9. Qualquer par fora dela bloqueia (falha fechado). */
export function decidirTela(atual: string | null | undefined, proximo: string | null | undefined): TelaMfa {
  if (atual === "aal1" && proximo === "aal1") return "cadastro";
  if (atual === "aal1" && proximo === "aal2") return "verificacao";
  if (atual === "aal2" && proximo === "aal2") return "liberado";
  return "bloqueado";
}

async function apiPadrao(): Promise<MfaApi> {
  const { supabase } = await import("./supabase");
  const mfa = supabase.auth.mfa;
  return {
    enroll: (a) => mfa.enroll(a) as unknown as ReturnType<MfaApi["enroll"]>,
    challenge: (a) => mfa.challenge(a) as unknown as ReturnType<MfaApi["challenge"]>,
    verify: (a) => mfa.verify(a) as unknown as ReturnType<MfaApi["verify"]>,
    listFactors: () => mfa.listFactors() as unknown as ReturnType<MfaApi["listFactors"]>,
    getAuthenticatorAssuranceLevel: () =>
      mfa.getAuthenticatorAssuranceLevel() as unknown as ReturnType<MfaApi["getAuthenticatorAssuranceLevel"]>,
    refreshSession: () => supabase.auth.refreshSession() as unknown as ReturnType<MfaApi["refreshSession"]>,
  };
}

const MENSAGENS_MFA: Record<string, string> = {
  mfa_verification_failed: "Código incorreto. Confira o aplicativo e tente de novo.",
  mfa_challenge_expired: "O desafio expirou. Peça um novo código e tente de novo.",
  mfa_verification_rejected: "Muitas tentativas. Aguarde um pouco antes de tentar de novo.",
  insufficient_aal: "Antes de cadastrar outro autenticador, verifique o código do que já existe (segundo fator).",
  mfa_factor_name_conflict: "Já existe um autenticador com esse nome. Tente de novo.",
  mfa_factor_not_found: "Autenticador não encontrado. Cadastre de novo.",
};

export function mensagemMfa(erro: Erro): string {
  const msg = erro?.code ? MENSAGENS_MFA[erro.code] : undefined;
  return msg ?? "Não foi possível concluir a verificação em duas etapas. Tente de novo.";
}

export function codigoValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo.trim());
}

export async function obterNivel(api?: MfaApi): Promise<{ atual: string | null; proximo: string | null } | null> {
  try {
    const a = api ?? (await apiPadrao());
    const { data, error } = await a.getAuthenticatorAssuranceLevel();
    if (error || !data) return null;
    return { atual: data.currentLevel, proximo: data.nextLevel };
  } catch {
    return null;
  }
}

export type ResultadoCadastro =
  | { ok: true; fatorId: string; criadoEm: string; qrDataUri: string; segredo: string }
  | { ok: false; mensagem: string };

let contador = 0;

export async function iniciarCadastroTotp(api?: MfaApi): Promise<ResultadoCadastro> {
  try {
    const a = api ?? (await apiPadrao());
    const agora = new Date();
    contador += 1;
    const nome = `HomeCash Admin ${agora.toISOString()}-${contador}`;
    const { data, error } = await a.enroll({ factorType: "totp", friendlyName: nome });
    if (error || !data) return { ok: false, mensagem: mensagemMfa(error) };
    return {
      ok: true,
      fatorId: data.id,
      criadoEm: agora.toISOString(),
      qrDataUri: data.totp.qr_code,
      segredo: data.totp.secret,
    };
  } catch {
    return { ok: false, mensagem: mensagemMfa(null) };
  }
}

export type ResultadoVerificacao = { ok: true } | { ok: false; mensagem: string };

async function desafiarEVerificar(a: MfaApi, fatorId: string, codigo: string): Promise<ResultadoVerificacao> {
  const desafio = await a.challenge({ factorId: fatorId });
  if (desafio.error || !desafio.data) return { ok: false, mensagem: mensagemMfa(desafio.error) };
  const v = await a.verify({ factorId: fatorId, challengeId: desafio.data.id, code: codigo.trim() });
  if (v.error) return { ok: false, mensagem: mensagemMfa(v.error) };
  return { ok: true };
}

/** Confirma o primeiro código do fator recém-cadastrado. */
export async function confirmarCadastro(fatorId: string, codigo: string, api?: MfaApi): Promise<ResultadoVerificacao> {
  if (!codigoValido(codigo)) return { ok: false, mensagem: "Digite os 6 números do aplicativo." };
  try {
    const a = api ?? (await apiPadrao());
    return await desafiarEVerificar(a, fatorId, codigo);
  } catch {
    return { ok: false, mensagem: mensagemMfa(null) };
  }
}

/** Verificação do código em cada sessão (aal1 → aal2). */
export async function verificarCodigo(codigo: string, api?: MfaApi): Promise<ResultadoVerificacao> {
  if (!codigoValido(codigo)) return { ok: false, mensagem: "Digite os 6 números do aplicativo." };
  try {
    const a = api ?? (await apiPadrao());
    const fatores = await a.listFactors();
    const fator = fatores.data?.totp.find((f) => f.status === "verified");
    if (fatores.error || !fator) {
      return { ok: false, mensagem: "Nenhum autenticador cadastrado. Cadastre um para continuar." };
    }
    const r = await desafiarEVerificar(a, fator.id, codigo);
    if (!r.ok) return r;
    // O verify devolve o token aal2. A renovação é só reserva, se o token ainda vier aal1.
    const nivel = await a.getAuthenticatorAssuranceLevel();
    if (nivel.data?.currentLevel !== "aal2") await a.refreshSession();
    return { ok: true };
  } catch {
    return { ok: false, mensagem: mensagemMfa(null) };
  }
}

export interface FatorTela {
  id: string;
  nome: string | null;
  tipo: string;
  situacao: string;
  criadoEm: string | null;
}

/** Só id, nome, tipo, situação e horário. A tela não sabe se o fator está aprovado e não remove fator. */
export async function listarFatores(api?: MfaApi): Promise<FatorTela[]> {
  try {
    const a = api ?? (await apiPadrao());
    const { data, error } = await a.listFactors();
    if (error || !data) return [];
    return data.totp.map((f) => ({
      id: f.id,
      nome: f.friendly_name ?? null,
      tipo: f.factor_type,
      situacao: f.status,
      criadoEm: f.created_at ?? null,
    }));
  } catch {
    return [];
  }
}
