/**
 * Filtro de apresentação para reforçar o princípio de privacidade por padrão.
 *
 * Importante: esta função NÃO substitui políticas RLS no Supabase.
 * O banco deve aplicar a mesma regra para impedir acesso direto à API.
 */
export type RegistroCompartilhavel = {
  owner_id?: string | null;
  grupo_id?: string | null;
  privado?: boolean | null;
  compartilhado_com?: string | null;
};

export function registroVisivelParaUsuario(
  registro: RegistroCompartilhavel,
  usuarioId: string | null | undefined,
  grupoAtualId: string | null | undefined,
): boolean {
  if (!usuarioId) return false;

  // O proprietário sempre pode ver seus próprios registros.
  if (registro.owner_id === usuarioId) return true;

  // Nenhum registro de outra pessoa é mostrado por padrão.
  if (registro.privado !== false) return false;

  // Compartilhamento individual explícito.
  if (registro.compartilhado_com === usuarioId) return true;

  // Compartilhamento explícito com o grupo atual.
  return Boolean(
    grupoAtualId &&
      registro.grupo_id === grupoAtualId &&
      registro.compartilhado_com === grupoAtualId,
  );
}
