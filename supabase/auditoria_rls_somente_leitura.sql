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
