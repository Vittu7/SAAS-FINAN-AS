-- AUDITORIA SOMENTE LEITURA: nao altera politicas, dados nem grants.
-- Execute no SQL Editor do Supabase e revise o resultado antes de aplicar migracoes.

-- 1) Todas as politicas RLS das tabelas financeiras, grupos e perfis.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'extrato', 'cartao', 'contas_fixas',
    'grupos', 'grupos_familiares', 'membros', 'perfis',
    'configuracoes'
  )
order by tablename, cmd, policyname;

-- 2) Estado RLS e FORCE RLS.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
    'extrato', 'cartao', 'contas_fixas',
    'grupos', 'grupos_familiares', 'membros', 'perfis',
    'configuracoes'
  )
order by c.relname;

-- 3) Grants diretos para anon e authenticated nessas tabelas.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'extrato', 'cartao', 'contas_fixas',
    'grupos', 'grupos_familiares', 'membros', 'perfis',
    'configuracoes'
  )
order by table_name, grantee, privilege_type;

-- 4) Funcoes de autorizacao e respectivos atributos.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('meus_grupos', 'meus_membros', 'membro_pertence', 'sou_dono')
order by p.proname;

-- 5) Chaves estrangeiras das tabelas de grupo/perfis: confirma os vinculos reais.
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as tabela_referenciada,
  ccu.column_name as coluna_referenciada,
  rc.delete_rule,
  rc.update_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.constraint_schema = kcu.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.constraint_schema = tc.constraint_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.constraint_schema
where tc.constraint_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name in ('grupos', 'grupos_familiares', 'membros', 'perfis')
order by tc.table_name, kcu.column_name;

-- 6) Triggers nas tabelas de grupo/perfis que podem validar ou alterar operacoes.
select
  event_object_table as tabela,
  trigger_name,
  event_manipulation as evento,
  action_timing as momento,
  action_statement as acao
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('grupos', 'grupos_familiares', 'membros', 'perfis')
order by event_object_table, trigger_name, event_manipulation;

-- 7) Colunas e defaults usados na criacao/entrada em grupos e perfis.
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('grupos', 'grupos_familiares', 'membros', 'perfis')
order by table_name, ordinal_position;
