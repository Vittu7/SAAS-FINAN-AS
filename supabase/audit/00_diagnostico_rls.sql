-- =====================================================================
-- DIAGNÓSTICO DE SEGURANÇA (SOMENTE LEITURA) — SAAS FINANCEIRO
-- Rode no Supabase → SQL Editor, bloco a bloco, e guarde os resultados
-- (cole em docs/SEGURANCA-AUDITORIA.md, seção "Evidências").
-- Nada aqui altera dados ou esquema.
-- =====================================================================

-- 1) RLS ligado? (esperado: rls_ativo = true em TODAS as tabelas de dados)
select c.relname as tabela,
       c.relrowsecurity      as rls_ativo,
       c.relforcerowsecurity as rls_forcado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 2) Políticas existentes (leia `qual` = USING e `with_check` = WITH CHECK)
--    Atenção a: roles = {public}/{anon}, qual = 'true', with_check nulo em INSERT/UPDATE.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3) Tabelas com RLS ligado e ZERO políticas (nega tudo — ok, mas confirme que é intencional)
--    e tabelas SEM políticas para algum comando usado pelo app.
select c.relname as tabela
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);

-- 4) Privilégios de tabela concedidos a `anon` (visitante sem login) e `authenticated`.
--    Defesa em profundidade: `anon` não deveria ter nada em tabelas financeiras.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 5) VIEWS no schema public: por padrão rodam com o dono (ignoram RLS) — vetor clássico de vazamento.
--    Esperado: nenhuma, ou todas com security_invoker=true.
select c.relname as view, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind in ('v','m');

-- 6) Funções SECURITY DEFINER (rodam como dono e ignoram RLS) — revisar uma a uma.
--    Verificar: search_path fixo, usa auth.uid() e NÃO aceita user_id como parâmetro, EXECUTE só p/ authenticated.
select p.proname as funcao,
       pg_get_function_arguments(p.oid) as argumentos,
       p.prosecdef as security_definer,
       p.proconfig as config,
       pg_get_userbyid(p.proowner) as dono,
       (select string_agg(distinct a.grantee::text, ', ')
          from information_schema.routine_privileges a
         where a.routine_schema='public' and a.routine_name=p.proname and a.privilege_type='EXECUTE') as execute_para
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.prosecdef desc, p.proname;

-- 7) Código-fonte das funções SECURITY DEFINER (ex.: criar_opcoes_padrao)
select p.proname, pg_get_functiondef(p.oid) as definicao
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prosecdef;

-- 8) Triggers (ex.: proteção de colunas como cargo/grupo_id, validação de saldo)
select event_object_table as tabela, trigger_name, event_manipulation as evento,
       action_timing as quando, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- 9) Colunas das tabelas de dados (para saber o que o cliente pode forjar: owner_id, grupo_id, cargo...)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 10) Chaves estrangeiras e ações de exclusão (cascade/set null/restrict) — movimentações vinculadas
select tc.table_name, kcu.column_name, ccu.table_name as referencia, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
order by tc.table_name;

-- 11) Storage: buckets (public = qualquer um lê por URL) e políticas de storage.objects
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets;
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- 12) Integridade dos dados legados (README: "cadastros antigos" atribuídos ao gestor)
select 'opcoes_pagamento sem user_id' as checagem, count(*) from opcoes_pagamento where user_id is null
union all
select 'opcoes_categoria sem user_id', count(*) from opcoes_categoria where user_id is null
union all
select 'extrato sem owner_id', count(*) from extrato where owner_id is null
union all
select 'cartao sem owner_id', count(*) from cartao where owner_id is null
union all
select 'contas_fixas sem owner_id', count(*) from contas_fixas where owner_id is null
union all
select 'perfis com cargo gestor (por grupo >1 é suspeito)', count(*) from perfis where cargo = 'gestor';

-- 13) Extensões/configs de Auth devem ser vistas no painel (não há SQL):
--     Authentication → Providers (confirmação de e-mail ligada?), URL Configuration (Site URL e
--     Redirect URLs só com domínios próprios), Rate limits, Leaked password protection.
