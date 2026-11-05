-- D1: só o gestor do grupo adiciona convidado sem conta.
--
-- Antes: adicionar_convidado aceitava qualquer membro do grupo.
-- A regra fica num lugar só, adicionar_convidado_grupo (já existia: exige perfil próprio com cargo 'gestor',
-- valida a cor #RRGGBB). adicionar_convidado continua existindo, com a mesma assinatura, e passa a chamá-la:
-- versões antigas do app (que ainda chamam adicionar_convidado) também respeitam a regra.
--
-- Não apaga nada. Pode ser rodado mais de uma vez.
-- Para desfazer: recriar adicionar_convidado com a definição anterior (docs/propostas-supabase.md, D1).

create or replace function public.adicionar_convidado(p_nome text, p_cor text default '#10B981')
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.adicionar_convidado_grupo(p_nome, p_cor);
$$;

-- Permissões: só usuário logado (a checagem de gestor é feita dentro da função).
revoke execute on function public.adicionar_convidado(text, text) from public, anon;
grant  execute on function public.adicionar_convidado(text, text) to authenticated;
revoke execute on function public.adicionar_convidado_grupo(text, text) from public, anon;
grant  execute on function public.adicionar_convidado_grupo(text, text) to authenticated;
