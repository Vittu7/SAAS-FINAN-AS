-- =============================================================================
-- Migração 20 — Painel administrativo: base (permissão, MFA, auditoria, negados)
-- Spec: docs/superpowers/specs/2026-11-05-painel-admin-design.md (§5, §7, §8, §12.1)
-- Plano: docs/superpowers/plans/2026-11-05-painel-admin.md (Fase 1, tarefas 1.3 a 1.5)
--
-- NÃO APLICADA. Escrita localmente. Aplicar só com autorização expressa (portão G1.2).
--
-- O que faz:
--   * schema interno `homecash_interno` (fora da API);
--   * tabelas admin_usuarios, admin_auditoria (cadeia de hash), admin_acessos_negados;
--   * triggers de imutabilidade (por linha e por instrução), cadeia, último admin;
--   * funções internas (checar_admin com MFA aal2, registrar_*), RPCs do painel.
-- O que NÃO faz: não altera nenhuma tabela, política ou função existente; não cria
-- trigger em tabela antiga; não usa service_role; não concede nada a `anon`.
-- Esta migração NÃO usa `perfis.cargo` para autorizar nada (a permissão é admin_usuarios).
--
-- Notas de projeto:
--   * `criado_por` da auditoria de admin_usuarios usa session_user (e não current_user):
--     dentro de função SECURITY DEFINER current_user é o dono, não quem executou.
--   * `homecash_interno` NÃO recebe `grant usage` para authenticated aqui; isso só é
--     necessário para as auxiliares de política do Storage (categoria E, migração 23).
--   * checar_admin devolve o código do erro (text) ou null quando liberado.
--   * A regra de frescor do `amr` (8 h) segue o spec §5.8 R5.5, mas só vale se um token
--     aal2 real trouxer `amr` (incerteza #30, portão G1.5). Se não trouxer, a regra é inerte.
--   * Revisão de segurança (relatório de 2026-11-05, itens 1 a 12): o acesso agora exige uma
--     sessão VIVA em auth.sessions (claim session_id) cujo aal seja aal2 e cujo factor_id seja um
--     fator TOTP verificado e aprovado. Logout/revogação valem na hora, e uma sessão aal2 obtida
--     com outro fator deixa de valer. A sessão também precisa estar dentro do prazo (not_after nulo ou futuro).
--     A pré-checagem exige as colunas id, user_id, aal, factor_id e not_after de auth.sessions; se faltarem, a migração aborta (não improvisa uma regra mais fraca).
--   * Limites: página ≤ 100000 e limite ≤ 200 (≤ 5000 na verificação); teto de 200 negados/hora
--     não vale para contas que estão em admin_usuarios; no máximo 2000 chaves de contagem/hora.
--   * Auditoria gravada no FIM de cada RPC (o lock da cadeia não fica preso durante consultas).
--   * service_role não recebe nada: privilégios padrão revogados nas tabelas e funções novas.
-- =============================================================================

begin;
set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. PRÉ-CHECAGEM (somente leitura de catálogo; aborta sem criar nada)
-- -----------------------------------------------------------------------------
do $pre$
declare
  v_falta text[] := '{}';
  r record;
begin
  if to_regclass('auth.users') is null then
    v_falta := v_falta || 'auth.users não existe';
  end if;

  if to_regprocedure('pg_catalog.sha256(bytea)') is null
     and not (
       exists (select 1 from pg_extension where extname = 'pgcrypto')
       and (to_regprocedure('extensions.digest(bytea,text)') is not null
            or to_regprocedure('public.digest(bytea,text)') is not null)
     ) then
    v_falta := v_falta || 'nem sha256(bytea) nem digest(bytea,text) (pgcrypto) estão disponíveis';
  end if;

  -- o dono das funções precisa ler os fatores de MFA
  for r in
    select c.coluna
      from (values ('id'), ('user_id'), ('status'), ('factor_type')) as c(coluna)
     where not exists (
       select 1 from information_schema.columns i
        where i.table_schema = 'auth' and i.table_name = 'mfa_factors' and i.column_name = c.coluna)
  loop
    v_falta := v_falta || format('auth.mfa_factors.%s não existe', r.coluna);
  end loop;
  if to_regclass('auth.mfa_factors') is not null
     and not has_table_privilege(current_user, 'auth.mfa_factors', 'select') then
    v_falta := v_falta || 'o papel que aplica a migração não lê auth.mfa_factors';
  end if;

  -- sessão viva: a decisão de acesso se apoia em auth.sessions (id, user_id, aal, factor_id, not_after)
  for r in
    select c.coluna
      from (values ('id'), ('user_id'), ('aal'), ('factor_id'), ('not_after')) as c(coluna)
     where not exists (
       select 1 from information_schema.columns i
        where i.table_schema = 'auth' and i.table_name = 'sessions' and i.column_name = c.coluna)
  loop
    v_falta := v_falta || format('auth.sessions.%s não existe (a validação da sessão MFA depende dela)', r.coluna);
  end loop;
  if to_regclass('auth.sessions') is not null
     and not has_table_privilege(current_user, 'auth.sessions', 'select') then
    v_falta := v_falta || 'o papel que aplica a migração não lê auth.sessions';
  end if;

  -- tabelas e colunas de domínio que as RPCs de leitura usam
  for r in
    select e.tabela, e.coluna
      from (values
        ('perfis','id'), ('perfis','nome_usuario'), ('perfis','cargo'), ('perfis','cor'),
        ('perfis','grupo_id'), ('perfis','eh_convidado'), ('perfis','resumo_visivel'), ('perfis','criado_em'),
        ('grupos_familiares','id'), ('grupos_familiares','nome'), ('grupos_familiares','criado_em'),
        ('extrato','owner_id'), ('cartao','owner_id'), ('contas_fixas','owner_id')
      ) as e(tabela, coluna)
     where not exists (
       select 1 from information_schema.columns i
        where i.table_schema = 'public' and i.table_name = e.tabela and i.column_name = e.coluna)
  loop
    v_falta := v_falta || format('public.%s.%s não existe', r.tabela, r.coluna);
  end loop;

  -- schema, tabelas e funções com o nosso nome precisam ter a nossa marcação
  if exists (select 1 from pg_namespace where nspname = 'homecash_interno')
     and coalesce((select obj_description(oid, 'pg_namespace') from pg_namespace where nspname = 'homecash_interno'), '')
         <> 'homecash-admin:v1' then
    v_falta := v_falta || 'o schema homecash_interno já existe sem a marcação homecash-admin:v1';
  end if;

  for r in
    select n.nome
      from unnest(array[
        'public.admin_usuarios', 'public.admin_auditoria', 'public.admin_acessos_negados',
        'homecash_interno.acessos_negados_contagem'
      ]) as n(nome)
  loop
    if to_regclass(r.nome) is not null
       and coalesce(obj_description(to_regclass(r.nome)::oid, 'pg_class'), '') <> 'homecash-admin:v1' then
      v_falta := v_falta || format('%s já existe sem a marcação homecash-admin:v1', r.nome);
    end if;
  end loop;

  for r in
    select n.assinatura
      from unnest(array[
        'public.sou_admin()', 'public.registrar_tentativa_admin(text)', 'public.admin_registrar_acesso()',
        'public.admin_resumo()', 'public.admin_listar_usuarios(text,text,integer,integer)',
        'public.admin_usuario_detalhe(uuid)', 'public.admin_listar_auditoria(text,integer,integer)',
        'public.admin_verificar_auditoria(bigint,integer,text)',
        'homecash_interno.checar_admin(text)',
        'homecash_interno.hash_linha_auditoria(public.admin_auditoria)',
        'homecash_interno.hash_linha_negado(public.admin_acessos_negados)',
        'homecash_interno.registrar_auditoria(text,uuid,text,text,jsonb,integer,text,uuid)',
        'homecash_interno.registrar_negado(text,text,text)', 'homecash_interno.hash_texto(text)',
        'homecash_interno.trg_cadeia_auditoria()', 'homecash_interno.trg_cadeia_negados()',
        'homecash_interno.trg_imutavel_linha()', 'homecash_interno.trg_imutavel_truncate()',
        'homecash_interno.trg_ultimo_admin()', 'homecash_interno.trg_auditar_admin_usuarios()'
      ]) as n(assinatura)
  loop
    if to_regprocedure(r.assinatura) is not null
       and coalesce(obj_description(to_regprocedure(r.assinatura)::oid, 'pg_proc'), '') <> 'homecash-admin:v1' then
      v_falta := v_falta || format('a função %s já existe sem a marcação homecash-admin:v1', r.assinatura);
    end if;
  end loop;

  if array_length(v_falta, 1) > 0 then
    raise exception 'Migração 20 abortada, nada foi criado: %', array_to_string(v_falta, '; ');
  end if;
end;
$pre$;

-- -----------------------------------------------------------------------------
-- 2. SCHEMA INTERNO
-- -----------------------------------------------------------------------------
create schema if not exists homecash_interno;
comment on schema homecash_interno is 'homecash-admin:v1';
revoke all on schema homecash_interno from public;

-- -----------------------------------------------------------------------------
-- 3. TABELAS (RLS ligada, sem política, sem acesso pela API)
-- -----------------------------------------------------------------------------
create table if not exists public.admin_usuarios (
  user_id           uuid primary key,
  ativo             boolean not null default true,
  fatores_aprovados uuid[] not null default '{}',
  email_registrado  text,
  criado_em         timestamptz not null default now(),
  criado_por        text not null default session_user,
  observacao        text
);
comment on table public.admin_usuarios is 'homecash-admin:v1';
alter table public.admin_usuarios enable row level security;
revoke all on table public.admin_usuarios from public, anon, authenticated;

create table if not exists public.admin_auditoria (
  id             bigint generated always as identity primary key,
  ordem          bigint not null unique,
  admin_id       uuid,
  admin_email    text,
  acao           text not null,
  alvo_user_id   uuid,
  alvo_email     text,
  recurso        text,
  parametros     jsonb,
  linhas         integer,
  motivo         text,
  sessao_suporte uuid,
  criado_em      timestamptz not null default now(),
  hash_anterior  text not null,
  hash           text not null
);
comment on table public.admin_auditoria is 'homecash-admin:v1';
alter table public.admin_auditoria enable row level security;
revoke all on table public.admin_auditoria from public, anon, authenticated;

create table if not exists public.admin_acessos_negados (
  id            bigint generated always as identity primary key,
  ordem         bigint not null unique,
  user_id       uuid,
  email         text,
  funcao        text not null,
  motivo        text not null,
  rota          text,
  user_agent    text,
  ip            text,
  criado_em     timestamptz not null default now(),
  hash_anterior text not null,
  hash          text not null
);
comment on table public.admin_acessos_negados is 'homecash-admin:v1';
alter table public.admin_acessos_negados enable row level security;
revoke all on table public.admin_acessos_negados from public, anon, authenticated;

create table if not exists homecash_interno.acessos_negados_contagem (
  user_id  uuid not null,
  funcao   text not null,
  motivo   text not null,
  hora     timestamptz not null,
  contagem integer not null default 1,
  primary key (user_id, funcao, motivo, hora)
);
comment on table homecash_interno.acessos_negados_contagem is 'homecash-admin:v1';
alter table homecash_interno.acessos_negados_contagem enable row level security;
revoke all on table homecash_interno.acessos_negados_contagem from public, anon, authenticated;

-- limita o crescimento: a contagem de chaves da hora é consultada a cada negado
create index if not exists acessos_negados_contagem_hora on homecash_interno.acessos_negados_contagem (hora);
comment on index homecash_interno.acessos_negados_contagem_hora is 'homecash-admin:v1';

-- -----------------------------------------------------------------------------
-- 4. HASH (SHA-256 nativo ou pgcrypto; a pré-checagem já garantiu que existe um)
-- -----------------------------------------------------------------------------
do $hash$
begin
  if to_regprocedure('pg_catalog.sha256(bytea)') is not null then
    execute $q$
      create or replace function homecash_interno.hash_texto(p_texto text)
      returns text language sql immutable security definer set search_path = ''
      as $f$ select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_texto, 'UTF8')), 'hex') $f$
    $q$;
  elsif to_regprocedure('extensions.digest(bytea,text)') is not null then
    execute $q$
      create or replace function homecash_interno.hash_texto(p_texto text)
      returns text language sql immutable security definer set search_path = ''
      as $f$ select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_texto, 'UTF8'), 'sha256'), 'hex') $f$
    $q$;
  else
    execute $q$
      create or replace function homecash_interno.hash_texto(p_texto text)
      returns text language sql immutable security definer set search_path = ''
      as $f$ select pg_catalog.encode(public.digest(pg_catalog.convert_to(p_texto, 'UTF8'), 'sha256'), 'hex') $f$
    $q$;
  end if;
end;
$hash$;
comment on function homecash_interno.hash_texto(text) is 'homecash-admin:v1';
revoke all on function homecash_interno.hash_texto(text) from public, anon, authenticated;

-- Serialização do hash (spec §5.4). jsonb_build_array preserva nulos e fronteiras;
-- concatenar com || ou | é proibido (admin_id nulo viraria NULL e o insert falharia).
create or replace function homecash_interno.hash_linha_auditoria(p public.admin_auditoria)
returns text language sql immutable security definer set search_path = ''
as $$
  select homecash_interno.hash_texto(jsonb_build_array(
    'v1', p.ordem, p.hash_anterior, p.id, p.admin_id, p.admin_email, p.acao, p.alvo_user_id,
    p.alvo_email, p.recurso, p.linhas, p.motivo, p.sessao_suporte,
    to_char(p.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), p.parametros
  )::text)
$$;
comment on function homecash_interno.hash_linha_auditoria(public.admin_auditoria) is 'homecash-admin:v1';
revoke all on function homecash_interno.hash_linha_auditoria(public.admin_auditoria) from public, anon, authenticated;

create or replace function homecash_interno.hash_linha_negado(p public.admin_acessos_negados)
returns text language sql immutable security definer set search_path = ''
as $$
  select homecash_interno.hash_texto(jsonb_build_array(
    'v1', p.ordem, p.hash_anterior, p.id, p.user_id, p.email, p.funcao, p.motivo, p.rota,
    p.user_agent, p.ip, to_char(p.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  )::text)
$$;
comment on function homecash_interno.hash_linha_negado(public.admin_acessos_negados) is 'homecash-admin:v1';
revoke all on function homecash_interno.hash_linha_negado(public.admin_acessos_negados) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. FUNÇÕES DE TRIGGER (categoria F)
-- Locks consultivos de duas chaves: 7101 = cadeia da auditoria, 7102 = cadeia dos negados.
-- Nenhuma função toma os dois locks na mesma transação (evita deadlock).
-- -----------------------------------------------------------------------------
create or replace function homecash_interno.trg_cadeia_auditoria()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_ordem bigint;
  v_hash  text;
begin
  perform pg_advisory_xact_lock(7101, 1);
  select a.ordem, a.hash into v_ordem, v_hash
    from public.admin_auditoria a order by a.ordem desc limit 1;
  new.ordem := coalesce(v_ordem, 0) + 1;
  new.hash_anterior := coalesce(v_hash, repeat('0', 64));
  new.hash := homecash_interno.hash_linha_auditoria(new);
  return new;
end;
$$;
comment on function homecash_interno.trg_cadeia_auditoria() is 'homecash-admin:v1';
revoke all on function homecash_interno.trg_cadeia_auditoria() from public, anon, authenticated;

create or replace function homecash_interno.trg_cadeia_negados()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_ordem bigint;
  v_hash  text;
begin
  perform pg_advisory_xact_lock(7102, 1);
  select n.ordem, n.hash into v_ordem, v_hash
    from public.admin_acessos_negados n order by n.ordem desc limit 1;
  new.ordem := coalesce(v_ordem, 0) + 1;
  new.hash_anterior := coalesce(v_hash, repeat('0', 64));
  new.hash := homecash_interno.hash_linha_negado(new);
  return new;
end;
$$;
comment on function homecash_interno.trg_cadeia_negados() is 'homecash-admin:v1';
revoke all on function homecash_interno.trg_cadeia_negados() from public, anon, authenticated;

create or replace function homecash_interno.trg_imutavel_linha()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'Registro imutável: % não é permitido em %.', tg_op, tg_table_name
    using errcode = '42501';
end;
$$;
comment on function homecash_interno.trg_imutavel_linha() is 'homecash-admin:v1';
revoke all on function homecash_interno.trg_imutavel_linha() from public, anon, authenticated;

create or replace function homecash_interno.trg_imutavel_truncate()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'Registro imutável: TRUNCATE não é permitido em %.', tg_table_name
    using errcode = '42501';
end;
$$;
comment on function homecash_interno.trg_imutavel_truncate() is 'homecash-admin:v1';
revoke all on function homecash_interno.trg_imutavel_truncate() from public, anon, authenticated;

create or replace function homecash_interno.trg_ultimo_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- serializa as mudanças: duas desativações simultâneas não deixam o painel sem admin (7104 = admins)
  perform pg_advisory_xact_lock(7104, 1);

  if tg_op = 'DELETE' then
    if old.ativo and not exists (
         select 1 from public.admin_usuarios a where a.ativo and a.user_id <> old.user_id) then
      raise exception 'Não é possível remover o último administrador ativo.' using errcode = '23514';
    end if;
    return old;
  end if;

  if old.ativo and not new.ativo and not exists (
       select 1 from public.admin_usuarios a where a.ativo and a.user_id <> old.user_id) then
    raise exception 'Não é possível desativar o último administrador ativo.' using errcode = '23514';
  end if;
  return new;
end;
$$;
comment on function homecash_interno.trg_ultimo_admin() is 'homecash-admin:v1';
revoke all on function homecash_interno.trg_ultimo_admin() from public, anon, authenticated;

create or replace function homecash_interno.trg_auditar_admin_usuarios()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_alvo uuid;
  v_param jsonb;
begin
  if tg_op = 'DELETE' then
    v_alvo := old.user_id;
    v_param := jsonb_build_object('papel_sessao', session_user, 'ativo', old.ativo,
                                  'fatores_aprovados', to_jsonb(old.fatores_aprovados));
  elsif tg_op = 'INSERT' then
    v_alvo := new.user_id;
    v_param := jsonb_build_object('papel_sessao', session_user, 'ativo', new.ativo,
                                  'fatores_aprovados', to_jsonb(new.fatores_aprovados));
  else
    v_alvo := new.user_id;
    v_param := jsonb_build_object('papel_sessao', session_user, 'ativo_antes', old.ativo, 'ativo', new.ativo,
                                  'fatores_antes', to_jsonb(old.fatores_aprovados),
                                  'fatores_aprovados', to_jsonb(new.fatores_aprovados));
  end if;

  insert into public.admin_auditoria (admin_id, admin_email, acao, alvo_user_id, recurso, parametros)
  values (auth.uid(), left(auth.jwt() ->> 'email', 200), 'admin_usuarios_' || lower(tg_op), v_alvo,
          'admin_usuarios', v_param);
  return null;
end;
$$;
comment on function homecash_interno.trg_auditar_admin_usuarios() is 'homecash-admin:v1';
revoke all on function homecash_interno.trg_auditar_admin_usuarios() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5b. TRIGGERS (só em tabelas novas)
-- -----------------------------------------------------------------------------
drop trigger if exists trg_auditoria_cadeia on public.admin_auditoria;
create trigger trg_auditoria_cadeia before insert on public.admin_auditoria
  for each row execute function homecash_interno.trg_cadeia_auditoria();
comment on trigger trg_auditoria_cadeia on public.admin_auditoria is 'homecash-admin:v1';

drop trigger if exists trg_auditoria_imutavel_linha on public.admin_auditoria;
create trigger trg_auditoria_imutavel_linha before update or delete on public.admin_auditoria
  for each row execute function homecash_interno.trg_imutavel_linha();
comment on trigger trg_auditoria_imutavel_linha on public.admin_auditoria is 'homecash-admin:v1';

drop trigger if exists trg_auditoria_imutavel_truncate on public.admin_auditoria;
create trigger trg_auditoria_imutavel_truncate before truncate on public.admin_auditoria
  for each statement execute function homecash_interno.trg_imutavel_truncate();
comment on trigger trg_auditoria_imutavel_truncate on public.admin_auditoria is 'homecash-admin:v1';

drop trigger if exists trg_negados_cadeia on public.admin_acessos_negados;
create trigger trg_negados_cadeia before insert on public.admin_acessos_negados
  for each row execute function homecash_interno.trg_cadeia_negados();
comment on trigger trg_negados_cadeia on public.admin_acessos_negados is 'homecash-admin:v1';

drop trigger if exists trg_negados_imutavel_linha on public.admin_acessos_negados;
create trigger trg_negados_imutavel_linha before update or delete on public.admin_acessos_negados
  for each row execute function homecash_interno.trg_imutavel_linha();
comment on trigger trg_negados_imutavel_linha on public.admin_acessos_negados is 'homecash-admin:v1';

drop trigger if exists trg_negados_imutavel_truncate on public.admin_acessos_negados;
create trigger trg_negados_imutavel_truncate before truncate on public.admin_acessos_negados
  for each statement execute function homecash_interno.trg_imutavel_truncate();
comment on trigger trg_negados_imutavel_truncate on public.admin_acessos_negados is 'homecash-admin:v1';

drop trigger if exists trg_admin_usuarios_ultimo on public.admin_usuarios;
create trigger trg_admin_usuarios_ultimo before update or delete on public.admin_usuarios
  for each row execute function homecash_interno.trg_ultimo_admin();
comment on trigger trg_admin_usuarios_ultimo on public.admin_usuarios is 'homecash-admin:v1';

-- TRUNCATE não dispara triggers de linha: sem este, passaria pela trava do último admin e pela auditoria
drop trigger if exists trg_admin_usuarios_imutavel_truncate on public.admin_usuarios;
create trigger trg_admin_usuarios_imutavel_truncate before truncate on public.admin_usuarios
  for each statement execute function homecash_interno.trg_imutavel_truncate();
comment on trigger trg_admin_usuarios_imutavel_truncate on public.admin_usuarios is 'homecash-admin:v1';

drop trigger if exists trg_admin_usuarios_auditoria on public.admin_usuarios;
create trigger trg_admin_usuarios_auditoria after insert or update or delete on public.admin_usuarios
  for each row execute function homecash_interno.trg_auditar_admin_usuarios();
comment on trigger trg_admin_usuarios_auditoria on public.admin_usuarios is 'homecash-admin:v1';

-- -----------------------------------------------------------------------------
-- 6. FUNÇÕES INTERNAS (categoria D) — sem EXECUTE para a API
-- -----------------------------------------------------------------------------
create or replace function homecash_interno.registrar_auditoria(
  p_acao text, p_alvo_user uuid, p_alvo_email text, p_recurso text,
  p_parametros jsonb, p_linhas integer, p_motivo text, p_sessao uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.admin_auditoria
    (admin_id, admin_email, acao, alvo_user_id, alvo_email, recurso, parametros, linhas, motivo, sessao_suporte)
  values
    (auth.uid(), left(auth.jwt() ->> 'email', 200), left(p_acao, 80), p_alvo_user, left(p_alvo_email, 200),
     left(p_recurso, 80), p_parametros, p_linhas, left(p_motivo, 500), p_sessao);
end;
$$;
comment on function homecash_interno.registrar_auditoria(text, uuid, text, text, jsonb, integer, text, uuid) is 'homecash-admin:v1';
revoke all on function homecash_interno.registrar_auditoria(text, uuid, text, text, jsonb, integer, text, uuid) from public, anon, authenticated;

-- Registro de tentativa negada (§5.7): uma linha imutável por (usuário, função, motivo, hora);
-- as repetições só sobem o contador; teto global de 200 linhas novas por hora.
-- Nunca levanta exceção depois de gravar; o bloco de exceção protege só a leitura dos cabeçalhos.
create or replace function homecash_interno.registrar_negado(p_funcao text, p_motivo text, p_rota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_chave   uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_hora    timestamptz := date_trunc('hour', now());
  v_cont    integer;
  v_admin   boolean;
  v_headers jsonb;
  v_ip      text;
  v_ua      text;
begin
  perform pg_advisory_xact_lock(7102, 1);

  -- Quem já é admin cadastrado nunca perde o rastro por causa dos tetos abaixo
  -- (contas descartáveis esgotariam a cota e esconderiam tentativas contra um admin real).
  v_admin := v_uid is not null
             and exists (select 1 from public.admin_usuarios a where a.user_id = v_uid);

  -- Teto de chaves de contagem por hora (a tabela de contagem não cresce sem limite).
  if not v_admin
     and (select count(*) from homecash_interno.acessos_negados_contagem c where c.hora = v_hora) >= 2000 then
    return;
  end if;

  insert into homecash_interno.acessos_negados_contagem as c (user_id, funcao, motivo, hora)
  values (v_chave, left(p_funcao, 80), left(p_motivo, 80), v_hora)
  on conflict (user_id, funcao, motivo, hora) do update set contagem = c.contagem + 1
  returning c.contagem into v_cont;

  if v_cont > 1 then
    return;
  end if;
  -- Teto global de 200 linhas novas por hora, exceto para admins cadastrados.
  if not v_admin
     and (select count(*) from public.admin_acessos_negados n where n.criado_em >= v_hora) >= 200 then
    return;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_ua := v_headers ->> 'user-agent';

  insert into public.admin_acessos_negados (user_id, email, funcao, motivo, rota, user_agent, ip)
  values (
    v_uid,
    left(auth.jwt() ->> 'email', 200),
    left(p_funcao, 80),
    left(p_motivo, 80),
    nullif(regexp_replace(left(coalesce(p_rota, ''), 120), '[[:cntrl:]]', '', 'g'), ''),
    nullif(regexp_replace(left(coalesce(v_ua, ''), 200), '[[:cntrl:]]', '', 'g'), ''),
    left(v_ip, 64)
  );
end;
$$;
comment on function homecash_interno.registrar_negado(text, text, text) is 'homecash-admin:v1';
revoke all on function homecash_interno.registrar_negado(text, text, text) from public, anon, authenticated;

-- Ponto único de decisão do acesso administrativo (§5.8 R5).
-- Devolve null quando liberado; senão o código do erro, já registrado. Nunca levanta exceção.
create or replace function homecash_interno.checar_admin(p_funcao text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_adm      public.admin_usuarios%rowtype;
  v_aal      text := auth.jwt() ->> 'aal';
  v_amr      jsonb := auth.jwt() -> 'amr';
  v_sid_txt  text := auth.jwt() ->> 'session_id';
  v_sid      uuid;
  v_sess_ok  boolean;
  v_sess_aal text;
  v_sess_fat uuid;
  v_aprovado boolean;
  v_erro     text;
begin
  if v_uid is null then
    perform homecash_interno.registrar_negado(p_funcao, 'nao_admin', null);
    return 'acesso_negado';
  end if;

  select * into v_adm from public.admin_usuarios a where a.user_id = v_uid;
  if not found then
    perform homecash_interno.registrar_negado(p_funcao, 'nao_admin', null);
    return 'acesso_negado';
  end if;
  if not v_adm.ativo then
    perform homecash_interno.registrar_negado(p_funcao, 'admin_inativo', null);
    return 'acesso_negado';
  end if;

  -- Sessão viva (auth.sessions): logout e revogação valem na hora, mesmo com o JWT ainda dentro do prazo.
  if v_sid_txt ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    v_sid := v_sid_txt::uuid;
    select true, s.aal::text, s.factor_id into v_sess_ok, v_sess_aal, v_sess_fat
      from auth.sessions s
     where s.id = v_sid and s.user_id = v_uid
       and (s.not_after is null or s.not_after > now());
  end if;

  select exists (
    select 1 from auth.mfa_factors f
     where f.user_id = v_uid and f.status = 'verified' and f.factor_type = 'totp'
       and f.id = any (v_adm.fatores_aprovados)
  ) into v_aprovado;

  if not coalesce(v_sess_ok, false) then
    v_erro := 'sessao_invalida';
  elsif v_aal is distinct from 'aal2' then
    v_erro := case when v_aprovado then 'mfa_requerida' else 'mfa_nao_configurada' end;
  elsif exists (
    select 1 from auth.mfa_factors f
     where f.user_id = v_uid and f.status = 'verified' and f.id <> all (v_adm.fatores_aprovados)
  ) then
    v_erro := 'fator_nao_aprovado';
  elsif not v_aprovado then
    v_erro := 'mfa_nao_configurada';
  elsif v_sess_aal is distinct from 'aal2'
     or v_sess_fat is null
     or not (v_sess_fat = any (v_adm.fatores_aprovados))
     or not exists (
       select 1 from auth.mfa_factors f
        where f.id = v_sess_fat and f.user_id = v_uid and f.status = 'verified' and f.factor_type = 'totp'
     ) then
    -- o aal2 do token precisa vir de uma sessão elevada por um fator TOTP verificado e aprovado
    v_erro := 'mfa_requerida';
  elsif jsonb_typeof(v_amr) = 'array' and jsonb_array_length(v_amr) > 0 and not exists (
    select 1 from jsonb_array_elements(v_amr) e
     where e ->> 'method' = 'totp'
       and (e ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$'
       and (e ->> 'timestamp')::numeric >= extract(epoch from now() - interval '8 hours')
  ) then
    v_erro := 'mfa_expirada';
  end if;

  if v_erro is not null then
    perform homecash_interno.registrar_negado(p_funcao, v_erro, null);
    return v_erro;
  end if;
  return null;
end;
$$;
comment on function homecash_interno.checar_admin(text) is 'homecash-admin:v1';
revoke all on function homecash_interno.checar_admin(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. RPCs DE USUÁRIO LOGADO (categoria B)
-- -----------------------------------------------------------------------------
create or replace function public.sou_admin()
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.admin_usuarios a where a.user_id = auth.uid() and a.ativo
  );
end;
$$;
comment on function public.sou_admin() is 'homecash-admin:v1';
revoke all on function public.sou_admin() from public, anon, authenticated;
grant execute on function public.sou_admin() to authenticated;

create or replace function public.registrar_tentativa_admin(p_rota text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  end if;
  if not public.sou_admin() then
    -- só rotas do próprio painel entram no log; qualquer outro texto do cliente vira um valor fixo
    perform homecash_interno.registrar_negado(
      'layout_admin', 'nao_admin',
      case when p_rota ~ '^/admin(/[a-z0-9_-]{1,40}){0,4}/?$' then p_rota else 'rota_invalida' end);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
comment on function public.registrar_tentativa_admin(text) is 'homecash-admin:v1';
revoke all on function public.registrar_tentativa_admin(text) from public, anon, authenticated;
grant execute on function public.registrar_tentativa_admin(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. RPCs ADMINISTRATIVAS (categoria A): checar_admin é sempre a primeira instrução
-- -----------------------------------------------------------------------------
create or replace function public.admin_registrar_acesso()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_erro text;
begin
  v_erro := homecash_interno.checar_admin('admin_registrar_acesso');
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  if not exists (
    select 1 from public.admin_auditoria a
     where a.admin_id = auth.uid() and a.acao = 'acesso_painel' and a.criado_em > now() - interval '10 minutes'
  ) then
    perform homecash_interno.registrar_auditoria(
      'acesso_painel', null, null, 'painel',
      jsonb_build_object(
        'aal', auth.jwt() ->> 'aal',
        'metodos', (
          select coalesce(jsonb_agg(e ->> 'method'), '[]'::jsonb)
            from jsonb_array_elements(
              case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
            ) e)),
      null, null, null);
  end if;
  return jsonb_build_object('ok', true, 'dados', jsonb_build_object('registrado', true));
end;
$$;
comment on function public.admin_registrar_acesso() is 'homecash-admin:v1';
revoke all on function public.admin_registrar_acesso() from public, anon, authenticated;
grant execute on function public.admin_registrar_acesso() to authenticated;

create or replace function public.admin_resumo()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_erro  text;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dados jsonb;
begin
  v_erro := homecash_interno.checar_admin('admin_resumo');
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  select jsonb_build_object(
    'usuarios', (select count(*) from auth.users),
    'grupos', (select count(*) from public.grupos_familiares),
    'convidados', (select count(*) from public.perfis p where p.eh_convidado),
    'cadastros_hoje', (select count(*) from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = v_hoje),
    'cadastros_7d', (select count(*) from auth.users u where u.created_at >= now() - interval '7 days'),
    'cadastros_30d', (select count(*) from auth.users u where u.created_at >= now() - interval '30 days'),
    'ativos_7d', (select count(*) from auth.users u where u.last_sign_in_at >= now() - interval '7 days'),
    'ativos_30d', (select count(*) from auth.users u where u.last_sign_in_at >= now() - interval '30 days'),
    'linhas_por_tabela', jsonb_build_object(
      'extrato', (select count(*) from public.extrato),
      'cartao', (select count(*) from public.cartao),
      'contas_fixas', (select count(*) from public.contas_fixas),
      'perfis', (select count(*) from public.perfis)),
    'erros_novos_24h', null,
    'solicitacoes_abertas', null,
    'acessos_negados_24h', (select count(*) from public.admin_acessos_negados n where n.criado_em >= now() - interval '24 hours'),
    'negados_repeticoes_24h', (select coalesce(sum(c.contagem), 0) from homecash_interno.acessos_negados_contagem c where c.hora >= now() - interval '24 hours'),
    'serie_cadastros', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', coalesce(c.n, 0)) order by d.dia), '[]'::jsonb)
        from (select generate_series(v_hoje - 29, v_hoje, interval '1 day')::date as dia) d
        left join (select (u.created_at at time zone 'America/Sao_Paulo')::date as dia, count(*) as n
                     from auth.users u group by 1) c on c.dia = d.dia),
    'serie_ultimo_acesso', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', coalesce(c.n, 0)) order by d.dia), '[]'::jsonb)
        from (select generate_series(v_hoje - 29, v_hoje, interval '1 day')::date as dia) d
        left join (select (u.last_sign_in_at at time zone 'America/Sao_Paulo')::date as dia, count(*) as n
                     from auth.users u where u.last_sign_in_at is not null group by 1) c on c.dia = d.dia),
    'serie_erros', null
  ) into v_dados;

  -- auditoria no fim: o lock da cadeia não fica preso durante as contagens acima
  if not exists (
    select 1 from public.admin_auditoria a
     where a.admin_id = auth.uid() and a.acao = 'ver_dashboard' and a.criado_em > now() - interval '10 minutes'
  ) then
    perform homecash_interno.registrar_auditoria('ver_dashboard', null, null, 'dashboard', null, null, null, null);
  end if;

  return jsonb_build_object('ok', true, 'dados', v_dados);
end;
$$;
comment on function public.admin_resumo() is 'homecash-admin:v1';
revoke all on function public.admin_resumo() from public, anon, authenticated;
grant execute on function public.admin_resumo() to authenticated;

create or replace function public.admin_listar_usuarios(
  p_busca text default null, p_filtro text default null, p_pagina integer default 1, p_limite integer default 25)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_erro  text;
  v_busca text := nullif(btrim(left(coalesce(p_busca, ''), 100)), '');
  v_pad   text;
  v_total bigint;
  v_itens jsonb;
begin
  v_erro := homecash_interno.checar_admin('admin_listar_usuarios');
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  if p_pagina is null or p_pagina < 1 or p_pagina > 100000 or p_limite is null or p_limite < 1 or p_limite > 200
     or (p_filtro is not null
         and p_filtro not in ('com_grupo', 'sem_grupo', 'ativos_7', 'ativos_30', 'nunca_acessou', 'novos_7')) then
    perform homecash_interno.registrar_negado('admin_listar_usuarios', 'parametro_invalido', null);
    return jsonb_build_object('ok', false, 'erro', 'parametro_invalido');
  end if;

  -- coringas do usuário viram texto literal
  v_pad := case when v_busca is null then null
                else '%' || replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_') || '%' end;

  with f as materialized (
    select u.id, u.email::text as email, p.nome_usuario,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provedor,
           u.created_at as cadastro, u.last_sign_in_at as ultimo_acesso,
           (u.email_confirmed_at is not null) as email_confirmado,
           g.nome as grupo, p.cargo as cargo_informado
      from auth.users u
      left join public.perfis p on p.id = u.id
      left join public.grupos_familiares g on g.id = p.grupo_id
     where (v_pad is null or u.email ilike v_pad escape '\' or p.nome_usuario ilike v_pad escape '\')
       and (p_filtro is null
            or (p_filtro = 'com_grupo' and p.grupo_id is not null)
            or (p_filtro = 'sem_grupo' and p.grupo_id is null)
            or (p_filtro = 'ativos_7' and u.last_sign_in_at >= now() - interval '7 days')
            or (p_filtro = 'ativos_30' and u.last_sign_in_at >= now() - interval '30 days')
            or (p_filtro = 'nunca_acessou' and u.last_sign_in_at is null)
            or (p_filtro = 'novos_7' and u.created_at >= now() - interval '7 days'))
  )
  select (select count(*) from f),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'email', x.email, 'nome', x.nome_usuario, 'provedor', x.provedor,
           'cadastro', x.cadastro, 'ultimo_acesso', x.ultimo_acesso, 'email_confirmado', x.email_confirmado,
           'grupo', x.grupo, 'cargo_informado', x.cargo_informado,
           'lancamentos',
             (select count(*) from public.extrato e where e.owner_id = x.id)
           + (select count(*) from public.cartao c where c.owner_id = x.id)
           + (select count(*) from public.contas_fixas cf where cf.owner_id = x.id)
         ) order by x.cadastro desc, x.id), '[]'::jsonb)
    into v_total, v_itens
    from (select * from f order by f.cadastro desc, f.id
           limit p_limite offset (p_pagina - 1) * p_limite) x;

  perform homecash_interno.registrar_auditoria(
    'listar_usuarios', null, null, 'usuarios',
    jsonb_build_object('busca', v_busca, 'filtro', p_filtro, 'pagina', p_pagina, 'limite', p_limite),
    jsonb_array_length(v_itens), null, null);

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'itens', v_itens, 'total', v_total, 'pagina', p_pagina, 'limite', p_limite));
end;
$$;
comment on function public.admin_listar_usuarios(text, text, integer, integer) is 'homecash-admin:v1';
revoke all on function public.admin_listar_usuarios(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_listar_usuarios(text, text, integer, integer) to authenticated;

create or replace function public.admin_usuario_detalhe(p_user uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_erro    text;
  v_email   text;
  v_conta   jsonb;
  v_perfil  jsonb;
  v_grupo_id uuid;
  v_grupo   jsonb;
  v_integr  jsonb;
  v_cont    jsonb;
begin
  v_erro := homecash_interno.checar_admin('admin_usuario_detalhe');
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  if p_user is null then
    perform homecash_interno.registrar_negado('admin_usuario_detalhe', 'parametro_invalido', null);
    return jsonb_build_object('ok', false, 'erro', 'parametro_invalido');
  end if;

  select u.email::text,
         jsonb_build_object(
           'id', u.id, 'email', u.email, 'cadastro', u.created_at, 'ultimo_acesso', u.last_sign_in_at,
           'provedor', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
           'email_confirmado', (u.email_confirmed_at is not null))
    into v_email, v_conta
    from auth.users u where u.id = p_user;
  if v_conta is null then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;

  -- colunas financeiras legadas e avatar_url ficam de fora de propósito
  select jsonb_build_object(
           'id', p.id, 'nome_usuario', p.nome_usuario,
           'cargo_informado_pelo_usuario', p.cargo,
           'cor', p.cor, 'grupo_id', p.grupo_id, 'eh_convidado', p.eh_convidado,
           'resumo_visivel', p.resumo_visivel, 'criado_em', p.criado_em),
         p.grupo_id
    into v_perfil, v_grupo_id
    from public.perfis p where p.id = p_user;

  if v_grupo_id is not null then
    select jsonb_build_object('id', g.id, 'nome', g.nome, 'criado_em', g.criado_em)
      into v_grupo from public.grupos_familiares g where g.id = v_grupo_id;

    select coalesce(jsonb_agg(jsonb_build_object(
             'id', q.id, 'nome_usuario', q.nome_usuario,
             'cargo_informado_pelo_usuario', q.cargo,
             'cor', q.cor, 'eh_convidado', q.eh_convidado, 'resumo_visivel', q.resumo_visivel,
             'tem_conta', exists (select 1 from auth.users x where x.id = q.id)
           ) order by q.nome_usuario), '[]'::jsonb)
      into v_integr from public.perfis q where q.grupo_id = v_grupo_id;
  end if;

  v_cont := jsonb_build_object(
    'extrato', (select count(*) from public.extrato e where e.owner_id = p_user),
    'cartao', (select count(*) from public.cartao c where c.owner_id = p_user),
    'contas_fixas', (select count(*) from public.contas_fixas cf where cf.owner_id = p_user),
    'regra', 'apenas_lancamentos_do_proprio_usuario');

  perform homecash_interno.registrar_auditoria(
    'abrir_ficha', p_user, v_email, 'usuario', null, null, null, null);

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'conta', v_conta, 'perfil', v_perfil, 'grupo', v_grupo,
    'integrantes', coalesce(v_integr, '[]'::jsonb), 'contagens', v_cont,
    'erros', null, 'solicitacoes', null));
end;
$$;
comment on function public.admin_usuario_detalhe(uuid) is 'homecash-admin:v1';
revoke all on function public.admin_usuario_detalhe(uuid) from public, anon, authenticated;
grant execute on function public.admin_usuario_detalhe(uuid) to authenticated;

create or replace function public.admin_listar_auditoria(
  p_aba text default 'acoes', p_pagina integer default 1, p_limite integer default 25)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_erro   text;
  v_itens  jsonb;
  v_total  bigint;
  v_cabeca text;
begin
  v_erro := homecash_interno.checar_admin('admin_listar_auditoria');
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  if p_aba is null or p_aba not in ('acoes', 'negados')
     or p_pagina is null or p_pagina < 1 or p_pagina > 100000 or p_limite is null or p_limite < 1 or p_limite > 200 then
    perform homecash_interno.registrar_negado('admin_listar_auditoria', 'parametro_invalido', null);
    return jsonb_build_object('ok', false, 'erro', 'parametro_invalido');
  end if;

  if p_aba = 'acoes' then
    select count(*) into v_total from public.admin_auditoria;
    select a.hash into v_cabeca from public.admin_auditoria a order by a.ordem desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object(
             'ordem', x.ordem, 'criado_em', x.criado_em, 'admin_email', x.admin_email, 'acao', x.acao,
             'alvo_email', x.alvo_email, 'recurso', x.recurso, 'linhas', x.linhas, 'motivo', x.motivo,
             'parametros', x.parametros) order by x.ordem desc), '[]'::jsonb)
      into v_itens
      from (select * from public.admin_auditoria a order by a.ordem desc
             limit p_limite offset (p_pagina - 1) * p_limite) x;
  else
    select count(*) into v_total from public.admin_acessos_negados;
    select n.hash into v_cabeca from public.admin_acessos_negados n order by n.ordem desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object(
             'ordem', x.ordem, 'criado_em', x.criado_em, 'email', x.email, 'funcao', x.funcao,
             'motivo', x.motivo, 'rota', x.rota, 'user_agent', x.user_agent, 'ip', x.ip,
             'ocorrencias_na_hora', (
               select coalesce(sum(c.contagem), 1)
                 from homecash_interno.acessos_negados_contagem c
                where c.user_id = coalesce(x.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
                  and c.funcao = x.funcao and c.motivo = x.motivo
                  and c.hora = date_trunc('hour', x.criado_em))
           ) order by x.ordem desc), '[]'::jsonb)
      into v_itens
      from (select * from public.admin_acessos_negados n order by n.ordem desc
             limit p_limite offset (p_pagina - 1) * p_limite) x;
  end if;

  perform homecash_interno.registrar_auditoria(
    'listar_auditoria', null, null, 'auditoria',
    jsonb_build_object('aba', p_aba, 'pagina', p_pagina, 'limite', p_limite),
    jsonb_array_length(v_itens), null, null);

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'aba', p_aba, 'itens', v_itens, 'total', v_total, 'cabeca', v_cabeca,
    'pagina', p_pagina, 'limite', p_limite));
end;
$$;
comment on function public.admin_listar_auditoria(text, integer, integer) is 'homecash-admin:v1';
revoke all on function public.admin_listar_auditoria(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_listar_auditoria(text, integer, integer) to authenticated;

-- Verificação paginada da cadeia (§5.4): uma única consulta com lag() dá um instantâneo
-- consistente; a primeira linha da página é encadeada com a linha imediatamente anterior.
-- p_tabela: 'acoes' (admin_auditoria) ou 'negados' (admin_acessos_negados).
-- A auditoria desta chamada é gravada no fim, para o lock da cadeia não ficar preso na verificação.
create or replace function public.admin_verificar_auditoria(
  p_desde bigint default 1, p_limite integer default 5000, p_tabela text default 'acoes')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_erro   text;
  v_verif  bigint;
  v_quebra bigint;
  v_prox   bigint;
  v_cabeca text;
  v_total  bigint;
begin
  v_erro := homecash_interno.checar_admin('admin_verificar_auditoria');
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  if p_desde is null or p_desde < 1 or p_limite is null or p_limite < 1 or p_limite > 5000
     or p_tabela is null or p_tabela not in ('acoes', 'negados') then
    perform homecash_interno.registrar_negado('admin_verificar_auditoria', 'parametro_invalido', null);
    return jsonb_build_object('ok', false, 'erro', 'parametro_invalido');
  end if;

  if p_tabela = 'acoes' then
    with ini as (
      select coalesce(max(a.ordem), p_desde) as o from public.admin_auditoria a where a.ordem < p_desde
    ),
    base as (
      select a.ordem, a.hash_anterior, a.hash,
             homecash_interno.hash_linha_auditoria(a) as hash_calc,
             lag(a.ordem) over w as ord_prev,
             lag(a.hash) over w as hash_prev
        from public.admin_auditoria a cross join ini
       where a.ordem >= ini.o
      window w as (order by a.ordem)
       order by a.ordem
       limit p_limite + 2
    ),
    pagina as (
      select b.* from base b where b.ordem >= p_desde order by b.ordem limit p_limite
    ),
    ruins as (
      select p.ordem from pagina p
       where p.hash is distinct from p.hash_calc
          or p.hash_anterior is distinct from coalesce(p.hash_prev, repeat('0', 64))
          or p.ordem is distinct from coalesce(p.ord_prev, 0) + 1
    )
    select (select count(*) from pagina),
           (select min(r.ordem) from ruins r),
           (select min(b.ordem) from base b where b.ordem > coalesce((select max(p.ordem) from pagina p), p_desde))
      into v_verif, v_quebra, v_prox;

    select a.hash into v_cabeca from public.admin_auditoria a order by a.ordem desc limit 1;
    select count(*) into v_total from public.admin_auditoria;
  else
    with ini as (
      select coalesce(max(n.ordem), p_desde) as o from public.admin_acessos_negados n where n.ordem < p_desde
    ),
    base as (
      select n.ordem, n.hash_anterior, n.hash,
             homecash_interno.hash_linha_negado(n) as hash_calc,
             lag(n.ordem) over w as ord_prev,
             lag(n.hash) over w as hash_prev
        from public.admin_acessos_negados n cross join ini
       where n.ordem >= ini.o
      window w as (order by n.ordem)
       order by n.ordem
       limit p_limite + 2
    ),
    pagina as (
      select b.* from base b where b.ordem >= p_desde order by b.ordem limit p_limite
    ),
    ruins as (
      select p.ordem from pagina p
       where p.hash is distinct from p.hash_calc
          or p.hash_anterior is distinct from coalesce(p.hash_prev, repeat('0', 64))
          or p.ordem is distinct from coalesce(p.ord_prev, 0) + 1
    )
    select (select count(*) from pagina),
           (select min(r.ordem) from ruins r),
           (select min(b.ordem) from base b where b.ordem > coalesce((select max(p.ordem) from pagina p), p_desde))
      into v_verif, v_quebra, v_prox;

    select n.hash into v_cabeca from public.admin_acessos_negados n order by n.ordem desc limit 1;
    select count(*) into v_total from public.admin_acessos_negados;
  end if;

  if p_desde = 1 then
    perform homecash_interno.registrar_auditoria(
      'verificar_auditoria', null, null, 'auditoria', jsonb_build_object('tabela', p_tabela), null, null, null);
  end if;

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'tabela', p_tabela, 'verificadas', v_verif, 'primeira_quebra', v_quebra, 'proxima', v_prox,
    'cabeca', v_cabeca, 'total', v_total));
end;
$$;
comment on function public.admin_verificar_auditoria(bigint, integer, text) is 'homecash-admin:v1';
revoke all on function public.admin_verificar_auditoria(bigint, integer, text) from public, anon, authenticated;
grant execute on function public.admin_verificar_auditoria(bigint, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8b. service_role: o Supabase concede privilégios padrão a ele em objetos novos do schema public.
-- O app não o usa e o modelo não depende dele; revogar impede, por exemplo, inserir linhas de
-- auditoria forjadas. Só revoga (nunca concede). Sem o papel (fora do Supabase), não faz nada.
-- -----------------------------------------------------------------------------
do $revogar$
declare
  r record;
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    return;
  end if;

  for r in
    select t.tabela from (values
      ('public.admin_usuarios'), ('public.admin_auditoria'), ('public.admin_acessos_negados'),
      ('homecash_interno.acessos_negados_contagem')) as t(tabela)
  loop
    execute format('revoke all on table %s from service_role', r.tabela);
  end loop;

  for r in
    select p.oid::regprocedure::text as assinatura
      from pg_proc p
     where obj_description(p.oid, 'pg_proc') = 'homecash-admin:v1'
       and p.pronamespace in ('public'::regnamespace, 'homecash_interno'::regnamespace)
  loop
    execute format('revoke all on function %s from service_role', r.assinatura);
  end loop;

  -- as sequências de identidade das tabelas de registro também
  for r in
    select s.seq from (values
      (pg_get_serial_sequence('public.admin_auditoria', 'id')),
      (pg_get_serial_sequence('public.admin_acessos_negados', 'id'))) as s(seq)
     where s.seq is not null
  loop
    execute format('revoke all on sequence %s from service_role', r.seq);
  end loop;
end;
$revogar$;

-- -----------------------------------------------------------------------------
-- 9. VALIDAÇÃO DA ESTRUTURA (aborta listando divergências; não corrige nada)
-- -----------------------------------------------------------------------------
do $estrutura$
declare
  v_div text[] := '{}';
  r record;
begin
  for r in
    select e.tabela, e.coluna, e.tipo, e.nn
      from (values
        ('public.admin_usuarios','user_id','uuid',true), ('public.admin_usuarios','ativo','boolean',true),
        ('public.admin_usuarios','fatores_aprovados','uuid[]',true), ('public.admin_usuarios','email_registrado','text',false),
        ('public.admin_usuarios','criado_em','timestamp with time zone',true), ('public.admin_usuarios','criado_por','text',true),
        ('public.admin_usuarios','observacao','text',false),
        ('public.admin_auditoria','id','bigint',true), ('public.admin_auditoria','ordem','bigint',true),
        ('public.admin_auditoria','admin_id','uuid',false), ('public.admin_auditoria','admin_email','text',false),
        ('public.admin_auditoria','acao','text',true), ('public.admin_auditoria','alvo_user_id','uuid',false),
        ('public.admin_auditoria','alvo_email','text',false), ('public.admin_auditoria','recurso','text',false),
        ('public.admin_auditoria','parametros','jsonb',false), ('public.admin_auditoria','linhas','integer',false),
        ('public.admin_auditoria','motivo','text',false), ('public.admin_auditoria','sessao_suporte','uuid',false),
        ('public.admin_auditoria','criado_em','timestamp with time zone',true),
        ('public.admin_auditoria','hash_anterior','text',true), ('public.admin_auditoria','hash','text',true),
        ('public.admin_acessos_negados','id','bigint',true), ('public.admin_acessos_negados','ordem','bigint',true),
        ('public.admin_acessos_negados','user_id','uuid',false), ('public.admin_acessos_negados','email','text',false),
        ('public.admin_acessos_negados','funcao','text',true), ('public.admin_acessos_negados','motivo','text',true),
        ('public.admin_acessos_negados','rota','text',false), ('public.admin_acessos_negados','user_agent','text',false),
        ('public.admin_acessos_negados','ip','text',false),
        ('public.admin_acessos_negados','criado_em','timestamp with time zone',true),
        ('public.admin_acessos_negados','hash_anterior','text',true), ('public.admin_acessos_negados','hash','text',true),
        ('homecash_interno.acessos_negados_contagem','user_id','uuid',true),
        ('homecash_interno.acessos_negados_contagem','funcao','text',true),
        ('homecash_interno.acessos_negados_contagem','motivo','text',true),
        ('homecash_interno.acessos_negados_contagem','hora','timestamp with time zone',true),
        ('homecash_interno.acessos_negados_contagem','contagem','integer',true)
      ) as e(tabela, coluna, tipo, nn)
  loop
    if not exists (
      select 1 from pg_attribute a
       where a.attrelid = r.tabela::regclass and a.attname = r.coluna and not a.attisdropped
         and format_type(a.atttypid, a.atttypmod) = r.tipo and a.attnotnull = r.nn) then
      v_div := v_div || format('coluna %s.%s diferente do esperado (%s%s)', r.tabela, r.coluna, r.tipo,
                               case when r.nn then ' not null' else '' end);
    end if;
  end loop;

  -- RLS ligada, nenhuma política, nenhum privilégio para a API
  for r in
    select t.tabela from (values
      ('public.admin_usuarios'), ('public.admin_auditoria'), ('public.admin_acessos_negados'),
      ('homecash_interno.acessos_negados_contagem')) as t(tabela)
  loop
    if not (select c.relrowsecurity from pg_class c where c.oid = r.tabela::regclass) then
      v_div := v_div || format('RLS desligada em %s', r.tabela);
    end if;
    if exists (select 1 from pg_policy p where p.polrelid = r.tabela::regclass) then
      v_div := v_div || format('%s tem política (não deveria)', r.tabela);
    end if;
    if has_table_privilege('anon', r.tabela, 'select,insert,update,delete,truncate,references,trigger')
       or has_table_privilege('authenticated', r.tabela, 'select,insert,update,delete,truncate,references,trigger') then
      v_div := v_div || format('%s tem privilégio para anon ou authenticated', r.tabela);
    end if;
  end loop;

  -- triggers: exatamente os esperados, nenhum a mais
  for r in
    select t.tabela, t.esperados from (values
      ('public.admin_usuarios', array['trg_admin_usuarios_auditoria', 'trg_admin_usuarios_imutavel_truncate', 'trg_admin_usuarios_ultimo']),
      ('public.admin_auditoria', array['trg_auditoria_cadeia', 'trg_auditoria_imutavel_linha', 'trg_auditoria_imutavel_truncate']),
      ('public.admin_acessos_negados', array['trg_negados_cadeia', 'trg_negados_imutavel_linha', 'trg_negados_imutavel_truncate']),
      ('homecash_interno.acessos_negados_contagem', array[]::text[])
    ) as t(tabela, esperados)
  loop
    if coalesce((select array_agg(g.tgname::text order by g.tgname) from pg_trigger g
                  where g.tgrelid = r.tabela::regclass and not g.tgisinternal), '{}'::text[])
       is distinct from (select coalesce(array_agg(x order by x), '{}'::text[]) from unnest(r.esperados) x) then
      v_div := v_div || format('triggers de %s diferentes dos esperados', r.tabela);
    end if;
  end loop;

  -- funções: security definer, search_path vazio
  for r in
    select p.oid, p.oid::regprocedure::text as assinatura, p.prosecdef, p.proconfig
      from pg_proc p
     where obj_description(p.oid, 'pg_proc') = 'homecash-admin:v1'
       and p.pronamespace in ('public'::regnamespace, 'homecash_interno'::regnamespace)
  loop
    if not r.prosecdef then
      v_div := v_div || format('%s não é security definer', r.assinatura);
    end if;
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then
      v_div := v_div || format('%s sem search_path vazio', r.assinatura);
    end if;
  end loop;

  if array_length(v_div, 1) > 0 then
    raise exception 'Migração 20 abortada: estrutura divergente: %', array_to_string(v_div, '; ');
  end if;
end;
$estrutura$;

-- -----------------------------------------------------------------------------
-- 10. VERIFICAÇÃO FINAL DE POSTURA (qualquer falha desfaz a transação inteira)
-- -----------------------------------------------------------------------------
do $postura$
declare
  v_div text[] := '{}';
  r record;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as assinatura, n.nspname as esquema
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where obj_description(p.oid, 'pg_proc') = 'homecash-admin:v1'
       and n.nspname in ('public', 'homecash_interno')
  loop
    if has_function_privilege('anon', r.oid, 'execute') then
      v_div := v_div || format('anon executa %s', r.assinatura);
    end if;
    if r.esquema = 'public' and not has_function_privilege('authenticated', r.oid, 'execute') then
      v_div := v_div || format('authenticated não executa %s', r.assinatura);
    end if;
    if r.esquema = 'homecash_interno' and has_function_privilege('authenticated', r.oid, 'execute') then
      v_div := v_div || format('authenticated executa a interna %s', r.assinatura);
    end if;
  end loop;

  -- service_role não pode ficar com nada nos objetos novos (quando o papel existe)
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    for r in
      select t.tabela from (values
        ('public.admin_usuarios'), ('public.admin_auditoria'), ('public.admin_acessos_negados'),
        ('homecash_interno.acessos_negados_contagem')) as t(tabela)
    loop
      if has_table_privilege('service_role', r.tabela, 'select,insert,update,delete,truncate,references,trigger') then
        v_div := v_div || format('service_role tem privilégio em %s', r.tabela);
      end if;
    end loop;
    for r in
      select p.oid::regprocedure::text as assinatura, p.oid as oid
        from pg_proc p
       where obj_description(p.oid, 'pg_proc') = 'homecash-admin:v1'
         and p.pronamespace in ('public'::regnamespace, 'homecash_interno'::regnamespace)
    loop
      if has_function_privilege('service_role', r.oid, 'execute') then
        v_div := v_div || format('service_role executa %s', r.assinatura);
      end if;
    end loop;
  end if;

  if has_schema_privilege('anon', 'homecash_interno', 'usage')
     or has_schema_privilege('authenticated', 'homecash_interno', 'usage') then
    v_div := v_div || 'anon ou authenticated têm usage em homecash_interno';
  end if;

  if array_length(v_div, 1) > 0 then
    raise exception 'Migração 20 abortada: postura de segurança inválida: %', array_to_string(v_div, '; ');
  end if;
end;
$postura$;

commit;

-- =============================================================================
-- DESFAZER (comentado; nada é executado sozinho). Remove somente o que esta migração criou.
-- Rodar manualmente, com autorização, numa transação.
-- =============================================================================
-- begin;
-- drop function if exists public.admin_verificar_auditoria(bigint, integer, text);
-- drop function if exists public.admin_listar_auditoria(text, integer, integer);
-- drop function if exists public.admin_usuario_detalhe(uuid);
-- drop function if exists public.admin_listar_usuarios(text, text, integer, integer);
-- drop function if exists public.admin_resumo();
-- drop function if exists public.admin_registrar_acesso();
-- drop function if exists public.registrar_tentativa_admin(text);
-- drop function if exists public.sou_admin();
-- drop table if exists public.admin_usuarios;
-- drop table if exists public.admin_acessos_negados;
-- drop table if exists public.admin_auditoria;
-- drop schema if exists homecash_interno cascade;  -- só se nada mais usar o schema (migrações 21 a 23)
-- commit;
