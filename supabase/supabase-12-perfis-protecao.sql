-- Protege as colunas de grupo do perfil.
--
-- Problema: a política perfis_proprio_update deixa o usuário alterar QUALQUER coluna da própria linha.
-- Pela API, qualquer pessoa logada podia:
--   * gravar grupo_id de um grupo alheio (sem convite) e passar a ver os perfis e lançar em nome de membros dele;
--   * gravar cargo = 'gestor' e então remover pessoas ou excluir o grupo.
--
-- Correção: um trigger recusa mudanças em id, user_id, grupo_id, cargo e eh_convidado quando a alteração vem
-- direto da API (papéis anon/authenticated). As funções do grupo (criar_grupo_familiar, entrar_grupo_por_convite,
-- remover_membro_grupo, excluir_grupo_familiar, adicionar_convidado...) são SECURITY DEFINER, rodam como postgres
-- e continuam funcionando. Nome, foto, cor, resumo_visivel e valores continuam editáveis pelo próprio usuário.
--
-- ORDEM: rode SÓ DEPOIS do deploy do código que entra no grupo por código de convite (GrupoModal.tsx).
-- O código antigo grava grupo_id direto e deixaria de funcionar.
-- Não apaga dados nem políticas. Pode ser rodado mais de uma vez.
-- Para desfazer: drop trigger if exists perfis_protege_colunas on public.perfis;

create or replace function public.perfis_protege_colunas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Funções SECURITY DEFINER (donas: postgres) e o painel administrativo não passam por aqui.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.grupo_id is not null
       or coalesce(new.cargo, 'membro') <> 'membro'
       or coalesce(new.eh_convidado, false)
       or new.user_id is distinct from (select auth.uid()) then
      raise exception 'Perfil novo começa sem grupo. Use as opções do grupo para entrar ou criar um.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.grupo_id is distinct from old.grupo_id
     or new.cargo is distinct from old.cargo
     or new.eh_convidado is distinct from old.eh_convidado then
    raise exception 'Grupo e cargo só mudam pelas opções do grupo (convite, criar, remover, excluir).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.perfis_protege_colunas() from public, anon, authenticated;

drop trigger if exists perfis_protege_colunas on public.perfis;
create trigger perfis_protege_colunas
  before insert or update on public.perfis
  for each row execute function public.perfis_protege_colunas();
