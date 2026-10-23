/**
 * Filtro de apresentação para reforçar o princípio de privacidade por padrão.
 *
 * Importante: esta função NÃO substitui políticas RLS no Supabase.
 * O banco deve aplicar regra equivalente para impedir acesso direto à API.
 */

// Registros anteriores a esta data mantêm o comportamento de visibilidade legado.
// A mesma data deve ser usada na política RLS da migração.
export const CORTE_PRIVACIDADE_ISO = "2026-10-24T02:30:00.000Z";

export type RegistroCompartilhavel = {
  owner_id?: string | null;
  grupo_id?: string | null;
  privado?: boolean | null;
  compartilhado_com?: string | null;
  created_at?: string | null;
};

export function registroVisivelParaUsuario(
  registro: RegistroCompartilhavel,
  usuarioId: string | null | undefined,
  grupoAtualId: string | null | undefined,
): boolean {
  if (!usuarioId) return false;

  // O proprietário sempre pode ver os próprios registros.
  if (registro.owner_id === usuarioId) return true;

  // Preserva a visibilidade anterior dos registros legados.
  // A autorização efetiva desses registros continua dependendo da RLS.
  if (
    registro.created_at &&
    Date.parse(registro.created_at) < Date.parse(CORTE_PRIVACIDADE_ISO)
  ) {
    return true;
  }

  // Uma marcação explícita de privado sempre bloqueia terceiros nos registros novos.
  if (registro.privado === true) return false;

  // Registros novos de terceiros exigem compartilhamento explícito.
  if (registro.compartilhado_com === usuarioId) return true;

  // Compartilhamento explícito com o grupo atual.
  return Boolean(
    grupoAtualId &&
      registro.grupo_id === grupoAtualId &&
      registro.compartilhado_com === grupoAtualId,
  );
}
