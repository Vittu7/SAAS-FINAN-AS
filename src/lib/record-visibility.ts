/**
 * Filtro de apresentação para reforçar o princípio de privacidade por padrão.
 * Não substitui as políticas RLS do Supabase.
 */
export type RegistroCompartilhavel = {
  owner_id?: string | null;
  grupo_id?: string | null;
  responsavel_id?: string | null;
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
  if (registro.owner_id === usuarioId) return true;

  // Privado sempre significa somente proprietário, inclusive em registros legados.
  if (registro.privado === true) return false;

  // Registros legados mantêm apenas os vínculos anteriores reconhecidos.
  if (registro.legado_privacidade_v1 === true) {
    return Boolean(
      (perfilAtualId && registro.responsavel_id === perfilAtualId) ||
      registro.responsavel_id === usuarioId ||
      (grupoAtualId && registro.grupo_id === grupoAtualId),
    );
  }

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
