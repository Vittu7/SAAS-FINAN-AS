/**
 * Lançamentos feitos ANTES de a pessoa ter um grupo ficam com grupo_id vazio (só o dono vê).
 * Ao criar/entrar num grupo, o app pergunta se ela quer incluí-los no grupo. A escolha é dela:
 * se disser "não", os lançamentos continuam só dela.
 */
type Cliente = { from: (tabela: string) => any };

export const TABELAS_LANCAMENTO = ["extrato", "cartao", "contas_fixas"] as const;

/** Quantos lançamentos do usuário ainda estão sem grupo (soma das três tabelas). */
export async function contarLancamentosSemGrupo(client: Cliente, userId: string): Promise<number> {
  let total = 0;
  for (const tabela of TABELAS_LANCAMENTO) {
    const { count, error } = await client
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("grupo_id", null);
    if (!error) total += count || 0;
  }
  return total;
}

/** Coloca no grupo os lançamentos do usuário que estão sem grupo. */
export async function incluirLancamentosNoGrupo(client: Cliente, userId: string, grupoId: string): Promise<{ movidos: number; erro: string | null }> {
  let movidos = 0;
  for (const tabela of TABELAS_LANCAMENTO) {
    const { data, error } = await client
      .from(tabela)
      .update({ grupo_id: grupoId })
      .eq("owner_id", userId)
      .is("grupo_id", null)
      .select("id");
    if (error) return { movidos, erro: `${tabela}: ${error.message}` };
    movidos += (data || []).length;
  }
  return { movidos, erro: null };
}

/**
 * Pergunta à pessoa (se houver lançamentos sem grupo) e, se ela aceitar, inclui no grupo.
 * Devolve uma mensagem para mostrar, ou null quando não havia nada a perguntar.
 */
export async function oferecerInclusaoNoGrupo(
  client: Cliente,
  userId: string,
  grupoId: string,
  perguntar: (mensagem: string) => boolean = (m) => window.confirm(m),
): Promise<string | null> {
  const total = await contarLancamentosSemGrupo(client, userId);
  if (total === 0) return null;

  const quer = perguntar(
    `Você tem ${total} lançamento(s) feitos antes de entrar no grupo.\n\n` +
      `OK = incluir no grupo (os outros membros passam a ver).\n` +
      `Cancelar = manter só para você.`,
  );
  if (!quer) return "Seus lançamentos anteriores continuam só seus.";

  const { movidos, erro } = await incluirLancamentosNoGrupo(client, userId, grupoId);
  if (erro) return `Não foi possível incluir todos os lançamentos (${erro}). Os que já foram incluídos continuam no grupo.`;
  return `${movidos} lançamento(s) incluído(s) no grupo.`;
}
