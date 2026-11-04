-- =====================================================================================================
-- HomeCash — DIAGNÓSTICO PARA LIMPEZA DO BANCO (Etapa B)
--
-- SOMENTE LEITURA: só há SELECT. Nada é criado, alterado ou apagado.
-- Como usar no Supabase → SQL Editor: selecione UM bloco (de "-- [n]" até o ";") e rode só a seleção
-- (Ctrl+Enter). O editor mostra apenas o resultado da última consulta, então rodar o arquivo inteiro
-- mostraria só o bloco final.
--
-- Para garantia extra, rode cada bloco dentro de uma transação somente leitura:
--   begin read only;  <consulta>;  rollback;
-- =====================================================================================================


-- [1] QUEM DEPENDE DE sou_dono E membro_pertence
--     Fontes: dependências registradas (políticas, views, defaults, checks) + texto de outras funções
--     (corpos plpgsql não registram dependência, por isso a busca no texto) + políticas por texto.
--     Resultado vazio = ninguém usa as duas funções.
with alvo as (
  select p.oid from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('sou_dono', 'membro_pertence')
)
select 'dependência registrada' as fonte,
       d.refobjid::regprocedure::text as funcao,
       pg_describe_object(d.classid, d.objid, d.objsubid) as quem_usa,
       d.deptype::text as tipo
from pg_depend d
where d.refclassid = 'pg_proc'::regclass and d.refobjid in (select oid from alvo)
union all
select 'texto de outra função', m[1], p.oid::regprocedure::text, case when p.prosecdef then 'security definer' else 'invoker' end
from pg_proc p
cross join lateral regexp_matches(p.prosrc, '\m(sou_dono|membro_pertence)\M', 'gi') as m
where p.pronamespace = 'public'::regnamespace and p.oid not in (select oid from alvo)
union all
select 'política (texto)', m[1], format('%s.%s → %s (%s)', pol.schemaname, pol.tablename, pol.policyname, pol.cmd), 'policy'
from pg_policies pol
cross join lateral regexp_matches(coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''), '\m(sou_dono|membro_pertence)\M', 'gi') as m
order by 1, 2, 3;


-- [2] POLÍTICAS RLS COMPLETAS (todas as tabelas do schema public)
select pol.tablename                         as tabela,
       pol.policyname                        as politica,
       pol.permissive                        as tipo,
       array_to_string(pol.roles, ', ')      as papeis,
       pol.cmd                               as acao,
       pol.qual                              as using_expr,
       pol.with_check                        as with_check_expr
from pg_policies pol
where pol.schemaname = 'public'
order by pol.tablename, pol.cmd, pol.policyname;


-- [3] TABELAS: RLS LIGADA/FORÇADA, QUANTIDADE DE POLÍTICAS E LINHAS EXATAS
select c.relname                                                            as tabela,
       c.relrowsecurity                                                     as rls_ligada,
       c.relforcerowsecurity                                                as rls_forcada,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as politicas,
       (xpath('/row/n/text()',
              query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint as linhas,
       s.n_tup_ins as insercoes, s.n_tup_upd as atualizacoes, s.n_tup_del as exclusoes,
       s.seq_scan as leituras_seq, s.idx_scan as leituras_indice,
       greatest(s.last_autoanalyze, s.last_analyze, s.last_autovacuum, s.last_vacuum) as ultima_manutencao
from pg_class c
left join pg_stat_user_tables s on s.relid = c.oid
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
order by c.relname;


-- [4] FUNÇÕES DO SCHEMA public: SITUAÇÃO, PERMISSÕES E IMPLEMENTAÇÃO COMPLETA
--     "usada pelo app" = chamada pelo código atual via supabase.rpc(...).
--     "suspeita legada" = apontada na auditoria como antiga/duplicada (confirmar com [1], [5] e [6]).
select p.oid::regprocedure                                            as funcao,
       case
         when p.proname in ('adicionar_convidado', 'atualizar_repasse', 'criar_grupo_familiar', 'criar_opcoes_padrao',
                            'excluir_grupo_familiar', 'excluir_minha_conta', 'registrar_repasse_conta', 'remover_membro_grupo')
           then '1 usada pelo app'
         when exists (select 1 from pg_trigger t where t.tgfoid = p.oid and not t.tgisinternal)
           then '2 usada por trigger'
         when p.proname in ('sou_dono', 'membro_pertence', 'criar_grupo', 'convidar_membro', 'aceitar_convites', 'meus_grupos',
                            'meus_membros', 'adicionar_convidado_grupo', 'alterar_cor_membro_grupo', 'criar_formas_pagamento_padrao',
                            'registrar_movimentacao_caixinha', 'gerar_convite_grupo_familiar', 'entrar_grupo_por_convite')
           then '3 suspeita legada'
         else '4 outra (verificar)'
       end                                                            as situacao,
       l.lanname                                                      as linguagem,
       p.prosecdef                                                    as security_definer,
       array_to_string(p.proconfig, ', ')                             as config_search_path,
       has_function_privilege('anon', p.oid, 'execute')               as anon_executa,
       has_function_privilege('authenticated', p.oid, 'execute')      as authenticated_executa,
       pg_get_functiondef(p.oid)                                      as definicao
from pg_proc p
join pg_language l on l.oid = p.prolang
where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
order by situacao, p.proname;


-- [5] TRIGGERS (tabelas do public e qualquer trigger que chame função do public, ex.: auth.users)
select c.relnamespace::regnamespace                    as schema,
       c.relname                                       as tabela,
       t.tgname                                        as trigger,
       case t.tgenabled when 'O' then 'ativo' when 'D' then 'desativado' when 'R' then 'replica' when 'A' then 'sempre' end as estado,
       t.tgfoid::regprocedure                          as funcao,
       pg_get_triggerdef(t.oid)                        as definicao
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and (c.relnamespace = 'public'::regnamespace or p.pronamespace = 'public'::regnamespace)
order by 1, 2, 3;


-- [6] DEPENDÊNCIAS DAS TABELAS SUSPEITAS
--     Mostra tudo que aponta para elas: FKs de outras tabelas, views, políticas de outras tabelas,
--     funções que citam o nome no código, índices e triggers próprios.
with legado(nome) as (values
  ('grupos'), ('membros'), ('caixinhas_investimento'), ('movimentacoes_caixinha'), ('caixinhas_migracao_legado'),
  ('opcoes_padrao_aplicadas'), ('opcoes_padrao_criadas'), ('convites_grupo_familiar'),
  ('contas_fixas_backup_duplicatas_20261016'), ('contas_fixas_backup_duplicatas_20261016_02'),
  ('contas_fixas_backup_recorrencia_20261016')
),
rel as (
  select c.oid, c.relname from pg_class c join legado l on l.nome = c.relname
  where c.relnamespace = 'public'::regnamespace
)
-- FKs entrando e saindo
select r.relname as tabela_suspeita, 'FK' as tipo,
       format('%s.%s: %s', con.conrelid::regclass, con.conname, pg_get_constraintdef(con.oid)) as detalhe
from pg_constraint con
join rel r on r.oid in (con.conrelid, con.confrelid)
where con.contype = 'f'
union all
-- objetos de OUTRAS tabelas/views que dependem dela (políticas, views, sequências compartilhadas…)
select r.relname, 'dependente externo',
       pg_describe_object(d.classid, d.objid, d.objsubid) || ' [' || d.deptype || ']'
from pg_depend d
join rel r on r.oid = d.refobjid and d.refclassid = 'pg_class'::regclass
where not (d.classid = 'pg_class'::regclass and d.objid = r.oid)
  and not exists (select 1 from pg_policy pp where d.classid = 'pg_policy'::regclass and pp.oid = d.objid and pp.polrelid = r.oid)
  and not exists (select 1 from pg_constraint cc where d.classid = 'pg_constraint'::regclass and cc.oid = d.objid and cc.conrelid = r.oid)
  and not exists (select 1 from pg_index ix where d.classid = 'pg_class'::regclass and ix.indexrelid = d.objid and ix.indrelid = r.oid)
  and not exists (select 1 from pg_type ty where d.classid = 'pg_type'::regclass and ty.oid = d.objid and ty.typrelid = r.oid)
union all
-- funções que citam o nome da tabela no código
select r.relname, 'citada em função', p.oid::regprocedure::text
from rel r
join pg_proc p on p.pronamespace = 'public'::regnamespace and p.prosrc ~* ('\m' || r.relname || '\M')
union all
-- políticas de outras tabelas que citam o nome no texto
select r.relname, 'citada em política', format('%s → %s (%s)', pol.tablename, pol.policyname, pol.cmd)
from rel r
join pg_policies pol on pol.schemaname = 'public' and pol.tablename <> r.relname
 and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* ('\m' || r.relname || '\M')
union all
-- índices e triggers próprios
select r.relname, 'índice próprio', pg_get_indexdef(ix.indexrelid)
from rel r join pg_index ix on ix.indrelid = r.oid
union all
select r.relname, 'trigger próprio', pg_get_triggerdef(t.oid)
from rel r join pg_trigger t on t.tgrelid = r.oid and not t.tgisinternal
order by 1, 2, 3;


-- [7] ÍNDICES: USO DESDE O ÚLTIMO RESET DE ESTATÍSTICAS E TAMANHO
--     idx_scan = 0 em índice que não é PK/unique = candidato a remoção (confirmar com o tempo de uso do app).
select s.relname                                   as tabela,
       s.indexrelname                              as indice,
       s.idx_scan                                  as usos,
       ix.indisprimary                             as pk,
       ix.indisunique                              as unico,
       pg_size_pretty(pg_relation_size(s.indexrelid)) as tamanho,
       pg_get_indexdef(s.indexrelid)               as definicao
from pg_stat_user_indexes s
join pg_index ix on ix.indexrelid = s.indexrelid
where s.schemaname = 'public'
order by s.idx_scan, s.relname, s.indexrelname;


-- [8] DUPLICAÇÕES
-- [8a] Várias políticas PERMISSIVE para a mesma tabela + ação + papel (a mais aberta vence)
with acoes(acao) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')),
pol as (
  select p.tablename, p.policyname, p.cmd, unnest(p.roles) as papel
  from pg_policies p
  where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
)
select pol.tablename as tabela, a.acao, pol.papel,
       count(*) as qtd, string_agg(pol.policyname || case when pol.cmd = 'ALL' then ' (ALL)' else '' end, ' | ' order by pol.policyname) as politicas
from pol join acoes a on pol.cmd in (a.acao, 'ALL')
group by pol.tablename, a.acao, pol.papel
having count(*) > 1
order by 1, 2, 3;

-- [8b] Políticas com expressões idênticas na mesma tabela/ação (duplicata literal)
select tablename as tabela, cmd as acao, count(*) as qtd, string_agg(policyname, ' | ') as politicas
from pg_policies
where schemaname = 'public'
group by tablename, cmd, qual, with_check, roles
having count(*) > 1;

-- [8c] Funções com o mesmo nome (sobrecargas) e funções com o mesmo código
select 'mesmo nome' as tipo, proname::text as chave, string_agg(oid::regprocedure::text, ' | ') as funcoes
from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f'
group by proname having count(*) > 1
union all
select 'mesmo código', md5(prosrc), string_agg(oid::regprocedure::text, ' | ')
from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f'
group by md5(prosrc) having count(*) > 1;

-- [8d] Índices duplicados (mesma tabela, colunas, expressões e filtro)
select ix.indrelid::regclass as tabela,
       string_agg(ix.indexrelid::regclass::text, ' | ') as indices
from pg_index ix
join pg_class c on c.oid = ix.indrelid and c.relnamespace = 'public'::regnamespace
group by ix.indrelid, ix.indkey::text, coalesce(ix.indexprs::text, ''), coalesce(ix.indpred::text, ''), ix.indclass::text
having count(*) > 1;

-- [8e] Triggers duplicados (mesma tabela, mesma função, mesmo momento/evento)
select t.tgrelid::regclass as tabela, t.tgfoid::regprocedure as funcao, t.tgtype,
       string_agg(t.tgname, ' | ') as triggers
from pg_trigger t
where not t.tgisinternal
group by t.tgrelid, t.tgfoid, t.tgtype
having count(*) > 1;

-- [8f] Tabelas com responsabilidade sobreposta: colunas lado a lado para comparar
select c.table_name as tabela,
       string_agg(c.column_name || ' ' || c.data_type, ', ' order by c.ordinal_position) as colunas
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('grupos', 'grupos_familiares', 'membros', 'perfis',
                       'caixinhas', 'caixinhas_investimento', 'caixinha_movimentos', 'movimentacoes_caixinha',
                       'opcoes_padrao_aplicadas', 'opcoes_padrao_criadas', 'convites_grupo_familiar',
                       'contas_fixas', 'contas_fixas_backup_duplicatas_20261016',
                       'contas_fixas_backup_duplicatas_20261016_02', 'contas_fixas_backup_recorrencia_20261016')
group by c.table_name
order by c.table_name;


-- [9] COMPATIBILIDADE DO APP: o que os avisos "execute o script X" do código esperam encontrar.
--     Se TUDO vier "existe = true", os desvios de compatibilidade do código podem ser removidos com segurança.
with esperado(tipo, tabela, nome, usado_em) as (values
  ('coluna',  'extrato',          'data',                 'useFinanceStore: colunaDataAusente (script 12)'),
  ('coluna',  'cartao',           'data',                 'useFinanceStore: colunaDataAusente (script 12)'),
  ('coluna',  'contas_fixas',     'data',                 'useFinanceStore: colunaDataAusente (script 12)'),
  ('coluna',  'extrato',          'repasse_informado',    'useFinanceStore: repasses (scripts 04/05)'),
  ('coluna',  'extrato',          'repasse_informado_em', 'useFinanceStore: repasses (scripts 04/05)'),
  ('coluna',  'extrato',          'repasse_pago',         'useFinanceStore: repasses (scripts 04/05)'),
  ('coluna',  'extrato',          'repasse_pago_em',      'useFinanceStore: repasses (scripts 04/05)'),
  ('coluna',  'extrato',          'repasse_conta',        'useFinanceStore: repasses (script 06)'),
  ('coluna',  'extrato',          'repasse_conta_origem', 'useFinanceStore: repasses (script 06)'),
  ('coluna',  'cartao',           'repasse_conta',        'useFinanceStore: repasses (script 06)'),
  ('coluna',  'cartao',           'repasse_conta_origem', 'useFinanceStore: repasses (script 06)'),
  ('coluna',  'contas_fixas',     'repasse_conta',        'useFinanceStore: repasses (script 06)'),
  ('coluna',  'contas_fixas',     'repasse_conta_origem', 'useFinanceStore: repasses (script 06)'),
  ('coluna',  'extrato',          'responsavel_id',       'avisos.ts: convidado como responsável (script 09)'),
  ('coluna',  'caixinhas',        'conta',                'useCaixinhas: coluna da conta (script 07)'),
  ('coluna',  'opcoes_pagamento', 'tipo_cartao',          'useOpcoes: crédito/débito (migração 05)'),
  ('coluna',  'opcoes_pagamento', 'user_id',              'useOpcoes: privacidade das opções (script 02)'),
  ('coluna',  'opcoes_categoria', 'user_id',              'useOpcoes: privacidade das opções (script 02)'),
  ('coluna',  'opcoes_pagamento', 'dia_vencimento',       'supabase-08-pagamentos-fatura.sql'),
  ('tabela',  null,               'caixinhas',            'useCaixinhas (migração 03)'),
  ('tabela',  null,               'caixinha_movimentos',  'useCaixinhas (migração 03)'),
  ('tabela',  null,               'pagamentos_fatura',    'supabase-08-pagamentos-fatura.sql'),
  ('funcao',  null,               'atualizar_repasse',    'useFinanceStore: faltaScript (scripts 04/05)'),
  ('funcao',  null,               'registrar_repasse_conta', 'useFinanceStore (script 06)'),
  ('funcao',  null,               'adicionar_convidado',  'GrupoModal: caminho antigo de insert direto (script 08-convidado)')
)
select e.tipo, coalesce(e.tabela || '.', '') || e.nome as objeto, e.usado_em,
       case e.tipo
         when 'coluna' then exists (select 1 from information_schema.columns c
                                    where c.table_schema = 'public' and c.table_name = e.tabela and c.column_name = e.nome)
         when 'tabela' then to_regclass('public.' || e.nome) is not null
         when 'funcao' then exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.nome)
       end as existe
from esperado e
order by existe, e.tipo, objeto;

-- [9b] Colunas com "conta" em caixinhas/movimentos e FKs de responsavel_id (confirma os scripts 07 e 09)
select 'coluna' as tipo, (table_name || '.' || column_name)::text as objeto, data_type::text as detalhe
from information_schema.columns
where table_schema = 'public' and table_name in ('caixinhas', 'caixinha_movimentos') and column_name ilike '%conta%'
union all
select 'FK responsavel_id', con.conrelid::regclass::text, pg_get_constraintdef(con.oid)
from pg_constraint con
where con.contype = 'f' and pg_get_constraintdef(con.oid) ilike '%(responsavel_id)%';


-- [10] RESUMO DOS CANDIDATOS À REMOÇÃO
--      removivel_com_seguranca = sem linhas, sem dependentes externos, sem citação em funções/políticas ativas.
--      Mesmo com "true", a remoção só deve acontecer em migration própria, aprovada e com backup.
with legado(nome) as (values
  ('grupos'), ('membros'), ('caixinhas_investimento'), ('movimentacoes_caixinha'), ('caixinhas_migracao_legado'),
  ('opcoes_padrao_aplicadas'), ('opcoes_padrao_criadas'), ('convites_grupo_familiar'),
  ('contas_fixas_backup_duplicatas_20261016'), ('contas_fixas_backup_duplicatas_20261016_02'),
  ('contas_fixas_backup_recorrencia_20261016')
),
base as (
  select c.oid, c.relname,
         (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint as linhas,
         (select count(*) from pg_constraint con where con.contype = 'f' and con.confrelid = c.oid and con.conrelid <> c.oid) as fks_entrando,
         (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosrc ~* ('\m' || c.relname || '\M')) as funcoes_citando,
         (select count(*) from pg_policies pol where pol.schemaname = 'public' and pol.tablename <> c.relname
            and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* ('\m' || c.relname || '\M')) as politicas_citando,
         (select count(*) from pg_depend d join pg_rewrite rw on d.classid = 'pg_rewrite'::regclass and rw.oid = d.objid
            where d.refobjid = c.oid and rw.ev_class <> c.oid) as views_dependentes
  from pg_class c join legado l on l.nome = c.relname
  where c.relnamespace = 'public'::regnamespace
)
select relname as tabela, linhas, fks_entrando, funcoes_citando, politicas_citando, views_dependentes,
       (linhas = 0 and fks_entrando = 0 and funcoes_citando = 0 and politicas_citando = 0 and views_dependentes = 0) as removivel_com_seguranca,
       case
         when relname like 'contas_fixas_backup%' then 'backup: exportar CSV antes de qualquer decisão'
         when linhas > 0 then 'tem dados: decidir se migra, exporta ou mantém'
         when funcoes_citando > 0 then 'ver [6]: funções que citam a tabela também precisam sair ou mudar'
         else 'sem uso aparente'
       end as observacao
from base
order by removivel_com_seguranca desc, relname;
