// Cliente das RPCs administrativas (spec §5.2, envelope {ok, dados | erro}).
// A autorização real está no banco; aqui só se monta a chamada e se lê a resposta.
// Nada daqui lança: toda falha vira um Envelope com ok = false.

export const CODIGOS_ERRO_ADMIN = [
  "acesso_negado",
  "mfa_requerida",
  "mfa_nao_configurada",
  "mfa_expirada",
  "fator_nao_aprovado",
  "sessao_invalida",
  "aba_nao_confirmada",
  "recurso_invalido",
  "parametro_invalido",
  "nao_encontrado",
  "limite_excedido",
  "nao_autenticado",
  "funcao_nao_instalada",
  "erro_rede",
  "erro_desconhecido",
] as const;

export type CodigoErroAdmin = (typeof CODIGOS_ERRO_ADMIN)[number];

export type Envelope<T> = { ok: true; dados: T } | { ok: false; erro: CodigoErroAdmin };

export type RpcFn = (
  funcao: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

const MENSAGENS: Record<CodigoErroAdmin, string> = {
  acesso_negado: "Página não encontrada.",
  mfa_requerida: "Confirme sua identidade com o código do aplicativo autenticador.",
  mfa_nao_configurada: "Cadastre o aplicativo autenticador para continuar.",
  mfa_expirada: "A verificação em duas etapas expirou. Confirme o código de novo.",
  fator_nao_aprovado: "Este autenticador ainda não foi aprovado para o painel.",
  sessao_invalida: "Sua sessão não é mais válida. Entre de novo.",
  aba_nao_confirmada: "Confirme a abertura desta aba antes de continuar.",
  recurso_invalido: "Este recurso não existe.",
  parametro_invalido: "Os dados enviados não são válidos.",
  nao_encontrado: "Registro não encontrado.",
  limite_excedido: "Muitas tentativas. Aguarde um pouco e tente de novo.",
  nao_autenticado: "Entre na sua conta para continuar.",
  funcao_nao_instalada: "Esta parte do painel ainda não foi instalada no banco.",
  erro_rede: "Não foi possível falar com o servidor. Tente de novo.",
  erro_desconhecido: "Algo inesperado aconteceu. Tente de novo.",
};

export function mensagemErroAdmin(codigo: CodigoErroAdmin): string {
  return MENSAGENS[codigo];
}

const CODIGOS_MFA: readonly CodigoErroAdmin[] = ["mfa_requerida", "mfa_nao_configurada", "mfa_expirada", "fator_nao_aprovado"];

export function ehErroDeMfa(codigo: CodigoErroAdmin): boolean {
  return CODIGOS_MFA.includes(codigo);
}

/** Padrão: usa o cliente do app. Importado sob demanda para os testes não precisarem de variáveis de ambiente. */
const rpcPadrao: RpcFn = async (funcao, args) => {
  const { supabase } = await import("./supabase");
  return supabase.rpc(funcao, args);
};

function ehFuncaoInexistente(erro: { message: string; code?: string }): boolean {
  return erro.code === "PGRST202" || erro.code === "42883" || /could not find the function/i.test(erro.message);
}

function codigoConhecido(c: unknown): CodigoErroAdmin {
  return typeof c === "string" && (CODIGOS_ERRO_ADMIN as readonly string[]).includes(c)
    ? (c as CodigoErroAdmin)
    : "erro_desconhecido";
}

export async function chamarAdmin<T>(
  funcao: string,
  args: Record<string, unknown> = {},
  rpc: RpcFn = rpcPadrao,
): Promise<Envelope<T>> {
  try {
    const { data, error } = await rpc(funcao, args);
    if (error) {
      return { ok: false, erro: ehFuncaoInexistente(error) ? "funcao_nao_instalada" : "erro_rede" };
    }
    if (typeof data !== "object" || data === null || typeof (data as { ok?: unknown }).ok !== "boolean") {
      return { ok: false, erro: "erro_rede" };
    }
    const env = data as { ok: boolean; dados?: T; erro?: unknown };
    if (env.ok) return { ok: true, dados: env.dados as T };
    return { ok: false, erro: codigoConhecido(env.erro) };
  } catch {
    return { ok: false, erro: "erro_rede" };
  }
}

export const LIMITE_PADRAO = 25;
export const LIMITE_MAXIMO = 200;
export const PAGINA_MAXIMA = 100000;

export function paginar(pagina: number, limite: number): { p_pagina: number; p_limite: number } {
  const p = Number.isFinite(pagina) ? Math.floor(pagina) : 1;
  const l = Number.isFinite(limite) ? Math.floor(limite) : LIMITE_PADRAO;
  return {
    p_pagina: p < 1 ? 1 : Math.min(p, PAGINA_MAXIMA),
    p_limite: l < 1 ? LIMITE_PADRAO : Math.min(l, LIMITE_MAXIMO),
  };
}

/** Só decide qual tela mostrar; não concede acesso a nada (spec §5.1). Falha fechado. */
export async function souAdmin(rpc: RpcFn = rpcPadrao): Promise<boolean> {
  try {
    const { data, error } = await rpc("sou_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Registra que uma conta comum tentou abrir /admin. Nunca lança nem bloqueia a tela. */
export async function registrarTentativaAdmin(rota: string, rpc: RpcFn = rpcPadrao): Promise<void> {
  try {
    await rpc("registrar_tentativa_admin", { p_rota: rota });
  } catch {
    /* silencioso de propósito */
  }
}

// ---- Tipos das respostas da Fase 1 --------------------------------------------

export interface PontoSerie {
  dia: string;
  total: number;
}

export interface ResumoAdmin {
  usuarios: number;
  grupos: number;
  convidados: number;
  cadastros_hoje: number;
  cadastros_7d: number;
  cadastros_30d: number;
  ativos_7d: number;
  ativos_30d: number;
  linhas_por_tabela: Record<string, number>;
  erros_novos_24h: number | null;
  solicitacoes_abertas: number | null;
  acessos_negados_24h: number;
  negados_repeticoes_24h: number;
  serie_cadastros: PontoSerie[];
  serie_ultimo_acesso: PontoSerie[];
  serie_erros: PontoSerie[] | null;
}

export interface ItemAuditoriaAcao {
  ordem: number;
  criado_em: string;
  admin_email: string | null;
  acao: string;
  alvo_email: string | null;
  recurso: string | null;
  linhas: number | null;
  motivo: string | null;
  parametros: unknown;
}

export interface ItemAuditoriaNegado {
  ordem: number;
  criado_em: string;
  email: string | null;
  funcao: string;
  motivo: string;
  rota: string | null;
  user_agent: string | null;
  ip: string | null;
  ocorrencias_na_hora: number;
}

export interface PaginaAuditoria<T> {
  aba: "acoes" | "negados";
  itens: T[];
  total: number;
  cabeca: string | null;
  pagina: number;
  limite: number;
}

export type TabelaAuditoria = "acoes" | "negados";

export interface VerificacaoAuditoria {
  tabela: TabelaAuditoria;
  verificadas: number;
  primeira_quebra: number | null;
  proxima: number | null;
  cabeca: string | null;
  total: number;
}

export const obterResumo = () => chamarAdmin<ResumoAdmin>("admin_resumo");

export const registrarAcessoPainel = () => chamarAdmin<{ registrado: boolean }>("admin_registrar_acesso");

export const listarAuditoria = (aba: "acoes" | "negados", pagina: number, limite = LIMITE_PADRAO) =>
  chamarAdmin<PaginaAuditoria<ItemAuditoriaAcao | ItemAuditoriaNegado>>("admin_listar_auditoria", {
    p_aba: aba,
    ...paginar(pagina, limite),
  });

export const verificarAuditoria = (tabela: TabelaAuditoria = "acoes", desde = 1, limite = 5000) =>
  chamarAdmin<VerificacaoAuditoria>("admin_verificar_auditoria", {
    p_desde: Math.max(1, Math.floor(desde)),
    p_limite: Math.min(5000, Math.max(1, Math.floor(limite))),
    p_tabela: tabela,
  });
