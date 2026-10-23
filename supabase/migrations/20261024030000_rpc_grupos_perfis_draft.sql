-- RASCUNHO: RPCs para administrar grupos sem permitir que o cliente escolha
-- livremente o user_id ou altere grupo_id diretamente no perfil.
-- NAO EXECUTAR EM PRODUCAO antes de revisar e testar em ambiente separado.

begin;

create or replace function public.garantir_meu_perfil(p_nome_usuario text default 'Usuário')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_perfil_id uuid;
begin
  if v_user_id is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  select id into v_perfil_id
  from public.perfis
  where user_id = v_user_id
  order by criado_em
  limit 1;

  if v_perfil_id is not null then
    return v_perfil_id;
  end if;

  select id into v_perfil_id
  from public.perfis
  where id = v_user_id and user_id is null
  limit 1;

  if v_perfil_id is not null then
    update public.perfis
       set user_id = v_user_id,
           nome_usuario = coalesce(nullif(trim(p_nome_usuario), ''), nome_usuario, 'Usuário'),
           eh_convidado = false
     where id = v_perfil_id;
    return v_perfil_id;
  end if;

  insert into public.perfis (id, user_id, nome_usuario, cargo, cor, eh_convidado)
  values (
    v_user_id, v_user_id,
    coalesce(nullif(trim(p_nome_usuario), ''), 'Usuário'),
    'membro', '#10B981', false
  )
  returning id into v_perfil_id;

  return v_perfil_id;
end;
$$;

create or replace function public.criar_grupo_familiar(p_nome text, p_nome_usuario text default 'Usuário')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_perfil_id uuid;
begin
  if v_user_id is null then raise exception 'É necessário estar autenticado.'; end if;
  if nullif(trim(p_nome), '') is null then raise exception 'Informe o nome do grupo.'; end if;

  perform public.garantir_meu_perfil(p_nome_usuario);

  select id into v_perfil_id
  from public.perfis
  where user_id = v_user_id
  order by criado_em
  limit 1;

  if exists (
    select 1 from public.perfis
    where user_id = v_user_id and grupo_id is not null
  ) then
    raise exception 'Você já participa de um grupo.';
  end if;

  insert into public.grupos_familiares (nome)
  values (trim(p_nome))
  returning id into v_grupo_id;

  update public.perfis
     set grupo_id = v_grupo_id, cargo = 'gestor'
   where id = v_perfil_id;

  return v_grupo_id;
end;
$$;

create or replace function public.entrar_grupo_por_convite(p_grupo_id uuid, p_nome_usuario text default 'Usuário')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_perfil_id uuid;
begin
  if v_user_id is null then raise exception 'É necessário estar autenticado.'; end if;
  if p_grupo_id is null or not exists (
    select 1 from public.grupos_familiares where id = p_grupo_id
  ) then
    raise exception 'Código do grupo inválido.';
  end if;

  perform public.garantir_meu_perfil(p_nome_usuario);

  select id into v_perfil_id
  from public.perfis
  where user_id = v_user_id
  order by criado_em
  limit 1;

  if exists (
    select 1 from public.perfis
    where user_id = v_user_id and grupo_id is not null and grupo_id <> p_grupo_id
  ) then
    raise exception 'Você já participa de outro grupo. Saia dele antes de entrar neste.';
  end if;

  update public.perfis
     set grupo_id = p_grupo_id, cargo = 'membro'
   where id = v_perfil_id;

  return p_grupo_id;
end;
$$;

create or replace function public.adicionar_convidado_grupo(p_nome text, p_cor text default '#10B981')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cargo text;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'É necessário estar autenticado.'; end if;
  if nullif(trim(p_nome), '') is null then raise exception 'Informe o nome do convidado.'; end if;

  select grupo_id, cargo into v_grupo_id, v_cargo
  from public.perfis
  where user_id = v_user_id
  order by criado_em
  limit 1;

  if v_grupo_id is null then raise exception 'Você precisa participar de um grupo.'; end if;
  if coalesce(v_cargo, '') <> 'gestor' then raise exception 'Somente o gestor pode adicionar convidados.'; end if;

  insert into public.perfis (nome_usuario, grupo_id, cargo, eh_convidado, cor)
  values (trim(p_nome), v_grupo_id, 'membro', true,
          case when p_cor ~ '^#[0-9A-Fa-f]{6}$' then p_cor else '#10B981' end)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.alterar_cor_perfil_grupo(p_perfil_id uuid, p_cor text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grupo_id uuid;
  v_cargo text;
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  if p_cor is null or p_cor !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Cor inválida.';
  end if;

  select grupo_id, cargo into v_grupo_id, v_cargo
  from public.perfis
  where user_id = auth.uid()
  order by criado_em
  limit 1;

  if coalesce(v_cargo, '') <> 'gestor' then
    raise exception 'Somente o gestor pode alterar cores dos perfis do grupo.';
  end if;

  if v_grupo_id is null or not exists (
    select 1 from public.perfis
    where id = p_perfil_id and grupo_id = v_grupo_id
  ) then
    raise exception 'Perfil não pertence ao seu grupo.';
  end if;

  update public.perfis set cor = p_cor
  where id = p_perfil_id and grupo_id = v_grupo_id;
end;
$$;

create or replace function public.remover_perfil_grupo(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cargo text;
  v_alvo_user_id uuid;
begin
  if v_user_id is null then raise exception 'É necessário estar autenticado.'; end if;

  select grupo_id, cargo into v_grupo_id, v_cargo
  from public.perfis
  where user_id = v_user_id
  order by criado_em
  limit 1;

  if coalesce(v_cargo, '') <> 'gestor' then raise exception 'Somente o gestor pode remover perfis do grupo.'; end if;

  select user_id into v_alvo_user_id
  from public.perfis
  where id = p_perfil_id and grupo_id = v_grupo_id;

  if v_grupo_id is null or not found then
    raise exception 'Perfil não pertence ao seu grupo.';
  end if;
  if v_alvo_user_id = v_user_id then
    raise exception 'Não é possível remover seu próprio perfil por esta opção.';
  end if;

  delete from public.perfis where id = p_perfil_id and grupo_id = v_grupo_id;
end;
$$;

-- RLS continua ativa. Escritas de grupo acontecem por RPCs validadas acima.
drop policy if exists "perfis_inserir_proprio_sem_grupo" on public.perfis;
create policy "perfis_inserir_proprio_sem_grupo"
on public.perfis for insert to authenticated
with check (
  user_id = auth.uid()
  and id = auth.uid()
  and grupo_id is null
  and coalesce(cargo, 'membro') = 'membro'
  and coalesce(eh_convidado, false) = false
);

drop policy if exists "perfis_atualizar_proprio" on public.perfis;
create policy "perfis_atualizar_proprio"
on public.perfis for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Restringe atualizações diretas a campos de perfil; grupo_id/cargo/identidade
-- só podem ser alterados pelas funções SECURITY DEFINER.
revoke update on public.perfis from authenticated;
grant update (nome_usuario, cor, avatar_url, salario, investido, reserva_atual, reserva_meta)
on public.perfis to authenticated;

revoke all on function public.garantir_meu_perfil(text) from public, anon;
revoke all on function public.criar_grupo_familiar(text, text) from public, anon;
revoke all on function public.entrar_grupo_por_convite(uuid, text) from public, anon;
revoke all on function public.adicionar_convidado_grupo(text, text) from public, anon;
revoke all on function public.alterar_cor_perfil_grupo(uuid, text) from public, anon;
revoke all on function public.remover_perfil_grupo(uuid) from public, anon;

grant execute on function public.garantir_meu_perfil(text) to authenticated;
grant execute on function public.criar_grupo_familiar(text, text) to authenticated;
grant execute on function public.entrar_grupo_por_convite(uuid, text) to authenticated;
grant execute on function public.adicionar_convidado_grupo(text, text) to authenticated;
grant execute on function public.alterar_cor_perfil_grupo(uuid, text) to authenticated;
grant execute on function public.remover_perfil_grupo(uuid) to authenticated;

commit;

-- TESTAR EM AMBIENTE SEPARADO COM DUAS CONTAS:
-- 1) Criar grupo e confirmar que perfil vira gestor.
-- 2) Entrar com convite válido e rejeitar UUID inexistente.
-- 3) Rejeitar tentativa de entrar em outro grupo se já vinculado.
-- 4) Criar convidado, alterar cor e remover convidado.
-- 5) Confirmar que usuário não consegue atualizar diretamente grupo_id/cargo.
-- 6) Confirmar que nome/foto próprios continuam editáveis.
-- 7) Revisar se existe política/grant adicional e se funções atendem ao schema real.
 then raise exception 'Cor inválida.'; end if;

  select grupo_id, cargo into v_grupo_id, v_cargo
  from public.perfis
  where user_id = auth.uid()
  order by criado_em
  limit 1;

  if coalesce(v_cargo, '') <> 'gestor' then raise exception 'Somente o gestor pode alterar cores dos perfis do grupo.'; end if;

  if v_grupo_id is null or not exists (
    select 1 from public.perfis
    where id = p_perfil_id and grupo_id = v_grupo_id
  ) then
    raise exception 'Perfil não pertence ao seu grupo.';
  end if;

  update public.perfis set cor = p_cor
  where id = p_perfil_id and grupo_id = v_grupo_id;
end;
$$;

create or replace function public.remover_perfil_grupo(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_alvo_user_id uuid;
begin
  if v_user_id is null then raise exception 'É necessário estar autenticado.'; end if;

  select grupo_id into v_grupo_id
  from public.perfis
  where user_id = v_user_id
  order by criado_em
  limit 1;

  select user_id into v_alvo_user_id
  from public.perfis
  where id = p_perfil_id and grupo_id = v_grupo_id;

  if v_grupo_id is null or not found then
    raise exception 'Perfil não pertence ao seu grupo.';
  end if;
  if v_alvo_user_id = v_user_id then
    raise exception 'Não é possível remover seu próprio perfil por esta opção.';
  end if;

  delete from public.perfis where id = p_perfil_id and grupo_id = v_grupo_id;
end;
$$;

-- RLS continua ativa. Escritas de grupo acontecem por RPCs validadas acima.
drop policy if exists "perfis_inserir_proprio_sem_grupo" on public.perfis;
create policy "perfis_inserir_proprio_sem_grupo"
on public.perfis for insert to authenticated
with check (
  user_id = auth.uid()
  and id = auth.uid()
  and grupo_id is null
  and coalesce(cargo, 'membro') = 'membro'
  and coalesce(eh_convidado, false) = false
);

drop policy if exists "perfis_atualizar_proprio" on public.perfis;
create policy "perfis_atualizar_proprio"
on public.perfis for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Restringe atualizações diretas a campos de perfil; grupo_id/cargo/identidade
-- só podem ser alterados pelas funções SECURITY DEFINER.
revoke update on public.perfis from authenticated;
grant update (nome_usuario, cor, avatar_url, salario, investido, reserva_atual, reserva_meta)
on public.perfis to authenticated;

revoke all on function public.garantir_meu_perfil(text) from public, anon;
revoke all on function public.criar_grupo_familiar(text, text) from public, anon;
revoke all on function public.entrar_grupo_por_convite(uuid, text) from public, anon;
revoke all on function public.adicionar_convidado_grupo(text, text) from public, anon;
revoke all on function public.alterar_cor_perfil_grupo(uuid, text) from public, anon;
revoke all on function public.remover_perfil_grupo(uuid) from public, anon;

grant execute on function public.garantir_meu_perfil(text) to authenticated;
grant execute on function public.criar_grupo_familiar(text, text) to authenticated;
grant execute on function public.entrar_grupo_por_convite(uuid, text) to authenticated;
grant execute on function public.adicionar_convidado_grupo(text, text) to authenticated;
grant execute on function public.alterar_cor_perfil_grupo(uuid, text) to authenticated;
grant execute on function public.remover_perfil_grupo(uuid) to authenticated;

commit;

-- TESTAR EM AMBIENTE SEPARADO COM DUAS CONTAS:
-- 1) Criar grupo e confirmar que perfil vira gestor.
-- 2) Entrar com convite válido e rejeitar UUID inexistente.
-- 3) Rejeitar tentativa de entrar em outro grupo se já vinculado.
-- 4) Criar convidado, alterar cor e remover convidado.
-- 5) Confirmar que usuário não consegue atualizar diretamente grupo_id/cargo.
-- 6) Confirmar que nome/foto próprios continuam editáveis.
-- 7) Revisar se existe política/grant adicional e se funções atendem ao schema real.
