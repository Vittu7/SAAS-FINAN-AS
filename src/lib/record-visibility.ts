/**
 * Filtro de apresentação para reforçar o princípio de privacidade por padrão.
 * Não substitui as políticas RLS do Supabase.
 */

export type RegistroCompartilhavel = {
  owner_id?: string | null;
  grupo_id?: string | null;
  privado?: boolean | null;
  compartilhado_com?: string | null;
  legado_privacidade_v1?: boolean | null;
};

export function registroVisivelParaUsuario(
  registro: RegistroCompartilhavel,
  usuarioId: string | null | undefined,
  grupoAtualId: string | null | undefined,
  perfilAtualId?: string | null,
): boolean {
  if (!usuarioId) return false;

  // O proprietário sempre pode ver os próprios registros.
  if (registro.owner_id === usuarioId) return true;

  // Somente o marcador persistido pelo banco preserva o acesso legado.
  if (registro.legado_privacidade_v1 === true) return true;

  if (registro.privado === true) return false;

  if (
    registro.compartilhado_com === usuarioId ||
    (Boolean(perfilAtualId) && registro.compartilhado_com === perfilAtualId)
  ) return true;

  return Boolean(
    grupoAtualId &&
      registro.grupo_id === grupoAtualId &&
      registro.compartilhado_com === grupoAtualId,
  );
}
