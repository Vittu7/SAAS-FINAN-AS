-- Corrige a exclusão do grupo quando há convidados com lançamentos como responsável.
-- Causa: extrato/cartao/contas_fixas.responsavel_id é NOT NULL, mas a FK para perfis é ON DELETE SET NULL.
-- Ao apagar o convidado, o banco tenta zerar responsavel_id e falha com 23502 (not_null_violation),
-- que a função não capturava (ela só tratava foreign_key_violation).
-- Solução: antes de apagar o convidado, passa a responsabilidade dos lançamentos dele para o dono (owner_id).
-- O resto da função é idêntico ao anterior.

create or replace function public.excluir_grupo_familiar()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user  uuid := auth.uid();
  v_grupo public.perfis.grupo_id%type;
  v_cargo text;
  v_conv  record;
  v_tab   record;
begin
  if v_user is null then
    raise exception 'Você precisa estar logado.';
  end if;

  select grupo_id, cargo::text into v_grupo, v_cargo from public.perfis where id = v_user;
  if v_grupo is null then
    raise exception 'Você não está em nenhum grupo.';
  end if;
  if v_cargo is distinct from 'gestor' then
    raise exception 'Só o gestor do grupo pode excluir o grupo.';
  end if;

  -- Convidados sem conta: os lançamentos em que são responsáveis voltam para o dono, depois o convidado é apagado
  for v_conv in
    select id, nome_usuario from public.perfis where grupo_id = v_grupo and coalesce(eh_convidado, false)
  loop
    update public.extrato      set responsavel_id = owner_id where responsavel_id = v_conv.id;
    update public.cartao       set responsavel_id = owner_id where responsavel_id = v_conv.id;
    update public.contas_fixas set responsavel_id = owner_id where responsavel_id = v_conv.id;
    begin
      delete from public.perfis where id = v_conv.id;
    exception when foreign_key_violation then
      raise exception 'O convidado "%" tem lançamentos vinculados. Edite ou exclua esses lançamentos (ou remova o convidado) antes de excluir o grupo.', v_conv.nome_usuario;
    end;
  end loop;

  -- Lançamentos e demais tabelas: tira a ligação com o grupo, sem apagar nada
  for v_tab in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name = 'grupo_id'
      and c.is_nullable = 'YES'
      and c.table_name not in ('perfis', 'grupos_familiares')
  loop
    execute format('update public.%I set grupo_id = null where grupo_id = $1', v_tab.table_name) using v_grupo;
  end loop;

  -- Todos os membros saem do grupo
  update public.perfis set grupo_id = null, cargo = 'membro' where grupo_id = v_grupo;

  begin
    delete from public.grupos_familiares where id = v_grupo;
  exception when foreign_key_violation then
    raise exception 'Ainda existem dados vinculados a este grupo e ele não pôde ser excluído.';
  end;

  return 'ok';
end;
$function$;
