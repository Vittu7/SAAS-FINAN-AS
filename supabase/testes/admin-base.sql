
-- =============================================================================
-- Roteiro de banco da migração 20 (painel administrativo: base)
-- Spec §12.2 e §15; plano: Fase 1, tarefa 1.5.
--
-- NÃO EXECUTAR sem autorização expressa (portão G1.3).
-- Só roda DEPOIS de a migração 20 estar aplicada.
-- Tudo acontece dentro de UMA transação que termina em ROLLBACK.
-- Nenhum dado de teste será persistido.
-- A consulta final mostra somente as verificações que falharam.
-- =============================================================================

begin;

create table public.zz_resultado_teste (
  n serial,
  nome text,
  ok boolean,
  detalhe text
);

grant all on public.zz_resultado_teste to public;
grant usage, select on sequence public.zz_resultado_teste_n_seq to public;

create function public.zz_t(
  p_nome text,
  p_ok boolean,
  p_det text default null
) returns void
language sql as $$
  insert into public.zz_resultado_teste (nome, ok, detalhe)
  values (p_nome, coalesce(p_ok, false), p_det)
$$;

create function public.zz_eq(
  p_nome text,
  p_atual text,
  p_esperado text
) returns void
language sql as $$
  select public.zz_t(
    p_nome,
    p_atual is not distinct from p_esperado,
    'obtido=' || coalesce(p_atual, 'null') ||
    ' esperado=' || coalesce(p_esperado, 'null')
  )
$$;

create function public.zz_claims(
  p_user uuid,
  p_aal text,
  p_sess uuid,
  p_amr jsonb default null
) returns void
language sql as $$
  select
    set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', p_user,
        'role', 'authenticated',
        'email', p_user::text || '@t.test',
        'aal', p_aal,
        'session_id', p_sess,
        'amr', p_amr
      )::text,
      true
    ),
    set_config('request.jwt.claim.sub', p_user::text, true)
$$;

-- -----------------------------------------------------------------------------
-- 0. Preparação (como dono)
-- -----------------------------------------------------------------------------

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, created_at, updated_at
) values
(
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a001@t.test',
  'authenticated', 'authenticated', '{"provider":"email"}', now(), now()
),
(
  '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000b001@t.test',
  'authenticated', 'authenticated', '{"provider":"email"}', now(), now()
),
(
  '00000000-0000-4000-8000-00000000c001',
  '00000000-0000-4000-8000-00000000c001@t.test',
  'authenticated', 'authenticated', '{"provider":"email"}', now(), now()
),
(
  '00000000-0000-4000-8000-00000000d001',
  'plain@t.test',
  'authenticated', 'authenticated', '{"provider":"email"}', now(), now()
);

update public.perfis
set cargo = 'gestor'
where id = '00000000-0000-4000-8000-00000000b001';

insert into auth.mfa_factors (
  id, user_id, friendly_name, factor_type, status, created_at, updated_at
) values
(
  '00000000-0000-4000-8000-00000000f001',
  '00000000-0000-4000-8000-00000000a001',
  'aprovado', 'totp', 'verified', now(), now()
),
(
  '00000000-0000-4000-8000-00000000f009',
  '00000000-0000-4000-8000-00000000a001',
  'nao-verificado', 'totp', 'unverified', now(), now()
);

insert into auth.sessions (
  id, user_id, created_at, updated_at, aal, factor_id
) values
(
  '00000000-0000-4000-8000-0000000a5a02',
  '00000000-0000-4000-8000-00000000a001',
  now(), now(), 'aal2',
  '00000000-0000-4000-8000-00000000f001'
),
(
  '00000000-0000-4000-8000-0000000a5a01',
  '00000000-0000-4000-8000-00000000a001',
  now(), now(), 'aal1', null
),
(
  '00000000-0000-4000-8000-0000000a5a09',
  '00000000-0000-4000-8000-00000000a001',
  now(), now(), 'aal2',
  '00000000-0000-4000-8000-00000000f009'
),
(
  '00000000-0000-4000-8000-0000000a5a0e',
  '00000000-0000-4000-8000-00000000a001',
  now(), now(), 'aal2', null
),
(
  '00000000-0000-4000-8000-0000000a5b01',
  '00000000-0000-4000-8000-00000000b001',
  now(), now(), 'aal1', null
);

insert into auth.sessions (
  id, user_id, created_at, updated_at, aal, factor_id, not_after
) values (
  '00000000-0000-4000-8000-0000000a5a0f',
  '00000000-0000-4000-8000-00000000a001',
  now(), now(), 'aal2',
  '00000000-0000-4000-8000-00000000f001',
  now() - interval '1 minute'
);

insert into public.admin_usuarios (
  user_id, ativo, fatores_aprovados
) values (
  '00000000-0000-4000-8000-00000000a001',
  true,
  array['00000000-0000-4000-8000-00000000f001'::uuid]
);

select public.zz_t(
  'admin_id nulo: inclusão do admin gerou linha de auditoria com admin_id nulo',
  exists (
    select 1
    from public.admin_auditoria
    where acao = 'admin_usuarios_insert'
      and admin_id is null
  )
);

-- -----------------------------------------------------------------------------
-- 1. Privilégios e postura
-- -----------------------------------------------------------------------------

do $t$
declare
  r record;
  v_sr boolean := exists (
    select 1 from pg_roles where rolname = 'service_role'
  );
  v_ruim text[] := '{}';
begin
  for r in
    select
      p.oid,
      p.oid::regprocedure::text as sig,
      n.nspname as esq
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where obj_description(p.oid, 'pg_proc') = 'homecash-admin:v1'
      and n.nspname in ('public', 'homecash_interno')
  loop
    if has_function_privilege('anon', r.oid, 'execute') then
      v_ruim := v_ruim || ('anon executa ' || r.sig);
    end if;

    if v_sr and has_function_privilege('service_role', r.oid, 'execute') then
      v_ruim := v_ruim || ('service_role executa ' || r.sig);
    end if;

    if r.esq = 'public'
       and not has_function_privilege('authenticated', r.oid, 'execute') then
      v_ruim := v_ruim || ('authenticated não executa ' || r.sig);
    end if;

    if r.esq = 'homecash_interno'
       and has_function_privilege('authenticated', r.oid, 'execute') then
      v_ruim := v_ruim || ('authenticated executa interna ' || r.sig);
    end if;
  end loop;

  perform public.zz_t(
    'ACL das funções: A e B só authenticated; D e F ninguém; anon e service_role nunca',
    array_length(v_ruim, 1) is null,
    array_to_string(v_ruim, '; ')
  );

  v_ruim := '{}';

  for r in
    select t.tabela
    from (
      values
        ('public.admin_usuarios'),
        ('public.admin_auditoria'),
        ('public.admin_acessos_negados'),
        ('homecash_interno.acessos_negados_contagem')
    ) as t(tabela)
  loop
    if has_table_privilege(
      'anon', r.tabela,
      'select,insert,update,delete,truncate,references,trigger'
    ) then
      v_ruim := v_ruim || (r.tabela || ' anon');
    end if;

    if has_table_privilege(
      'authenticated', r.tabela,
      'select,insert,update,delete,truncate,references,trigger'
    ) then
      v_ruim := v_ruim || (r.tabela || ' authenticated');
    end if;

    if v_sr and has_table_privilege(
      'service_role', r.tabela,
      'select,insert,update,delete,truncate,references,trigger'
    ) then
      v_ruim := v_ruim || (r.tabela || ' service_role');
    end if;

    if not (
      select relrowsecurity
      from pg_class
      where oid = r.tabela::regclass
    ) then
      v_ruim := v_ruim || (r.tabela || ' sem RLS');
    end if;

    if exists (
      select 1 from pg_policy
      where polrelid = r.tabela::regclass
    ) then
      v_ruim := v_ruim || (r.tabela || ' com política');
    end if;
  end loop;

  perform public.zz_t(
    'Tabelas novas: sem privilégio para API e service_role, RLS ligada, sem política',
    array_length(v_ruim, 1) is null,
    array_to_string(v_ruim, '; ')
  );

  perform public.zz_t(
    'Schema homecash_interno sem usage para anon e authenticated',
    not has_schema_privilege('anon', 'homecash_interno', 'usage')
    and not has_schema_privilege('authenticated', 'homecash_interno', 'usage')
  );

  perform public.zz_t(
    'Todas as funções são security definer com search_path vazio',
    not exists (
      select 1
      from pg_proc p
      where obj_description(p.oid, 'pg_proc') = 'homecash-admin:v1'
        and (
          not p.prosecdef
          or p.proconfig is null
          or not ('search_path=""' = any (p.proconfig))
        )
    )
  );

  perform public.zz_t(
    'Lock do último admin presente na definição do trigger',
    pg_get_functiondef(
      'homecash_interno.trg_ultimo_admin()'::regprocedure
    ) like '%pg_advisory_xact_lock(7104, 1)%'
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- 2. Hash
-- -----------------------------------------------------------------------------

select public.zz_eq(
  'sha256("abc") conhecido',
  homecash_interno.hash_texto('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
);

select public.zz_eq(
  'texto de jsonb: separadores e null preservado',
  jsonb_build_array('v1', 1, null::text)::text,
  '["v1", 1, null]'
);

select public.zz_eq(
  'texto de jsonb: chaves ordenadas por tamanho',
  jsonb_build_object('bb', 1, 'a', 2, 'ab', 3)::text,
  '{"a": 2, "ab": 3, "bb": 1}'
);

select public.zz_t(
  'hash gravado == hash recalculado em todas as linhas de auditoria',
  not exists (
    select 1
    from public.admin_auditoria a
    where a.hash is distinct from homecash_interno.hash_linha_auditoria(a)
  )
);

-- -----------------------------------------------------------------------------
-- 3. Recusas: anon/comum, MFA e sessão
-- -----------------------------------------------------------------------------

do $t$
declare
  r jsonb;
begin
  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000b001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5b01'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'conta comum (cargo gestor forjado) → acesso_negado',
    r ->> 'erro',
    'acesso_negado'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000b001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5b01'
  );

  set local role authenticated;
  r := public.admin_listar_usuarios();
  reset role;

  perform public.zz_eq(
    'conta comum com aal2 → acesso_negado',
    r ->> 'erro',
    'acesso_negado'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    null
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'sem session_id → sessao_invalida',
    r ->> 'erro',
    'sessao_invalida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5aff'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'sessão inexistente/revogada → sessao_invalida',
    r ->> 'erro',
    'sessao_invalida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5b01'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'sessão de outro usuário → sessao_invalida',
    r ->> 'erro',
    'sessao_invalida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a0f'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'sessão vencida → sessao_invalida',
    r ->> 'erro',
    'sessao_invalida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5a01'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'admin em aal1 → mfa_requerida',
    r ->> 'erro',
    'mfa_requerida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    null,
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'claim aal ausente → mfa_requerida',
    r ->> 'erro',
    'mfa_requerida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a01'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'token diz aal2 mas sessão é aal1 → mfa_requerida',
    r ->> 'erro',
    'mfa_requerida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a0e'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'sessão aal2 sem fator associado → mfa_requerida',
    r ->> 'erro',
    'mfa_requerida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a09'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'fator não verificado/não aprovado → mfa_requerida',
    r ->> 'erro',
    'mfa_requerida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_t(
    'admin aal2, sessão viva e fator aprovado → ok',
    (r ->> 'ok')::boolean,
    r::text
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02',
    jsonb_build_array(
      jsonb_build_object(
        'method', 'totp',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  );

  set local role authenticated;
  r := public.admin_registrar_acesso();
  reset role;

  perform public.zz_t(
    'amr totp recente → ok',
    (r ->> 'ok')::boolean,
    r::text
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02',
    jsonb_build_array(
      jsonb_build_object(
        'method', 'totp',
        'timestamp',
        extract(epoch from now() - interval '9 hours')::bigint
      )
    )
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'amr totp com 9 h → mfa_expirada',
    r ->> 'erro',
    'mfa_expirada'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02',
    jsonb_build_array(
      jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'amr presente sem totp → mfa_expirada',
    r ->> 'erro',
    'mfa_expirada'
  );

  insert into auth.mfa_factors (
    id, user_id, friendly_name, factor_type, status, created_at, updated_at
  ) values (
    '00000000-0000-4000-8000-00000000f002',
    '00000000-0000-4000-8000-00000000a001',
    'intruso', 'totp', 'verified', now(), now()
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    'fator verificado não aprovado → fator_nao_aprovado',
    r ->> 'erro',
    'fator_nao_aprovado'
  );

  delete from auth.mfa_factors
  where id = '00000000-0000-4000-8000-00000000f002';
end;
$t$;

-- -----------------------------------------------------------------------------
-- 4. Parâmetros, busca hostil e ficha
-- -----------------------------------------------------------------------------

do $t$
declare
  r jsonb;
begin
  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;

  r := public.admin_listar_usuarios(null, null, 1, 201);
  perform public.zz_eq('limite 201 → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_usuarios(null, null, 100001, 25);
  perform public.zz_eq('página 100001 → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_usuarios(null, null, 2147483647, 200);
  perform public.zz_eq('página int máximo → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_usuarios(null, null, 0, 25);
  perform public.zz_eq('página 0 → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_usuarios(null, 'xyz', 1, 25);
  perform public.zz_eq('filtro desconhecido → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_auditoria('x', 1, 25);
  perform public.zz_eq('aba desconhecida → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_auditoria('acoes', 100001, 25);
  perform public.zz_eq('auditoria página 100001 → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_verificar_auditoria(1, 5001, 'acoes');
  perform public.zz_eq('verificação limite 5001 → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_verificar_auditoria(0, 10, 'acoes');
  perform public.zz_eq('verificação desde 0 → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_verificar_auditoria(1, 10, 'outra');
  perform public.zz_eq('verificação tabela desconhecida → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  r := public.admin_listar_usuarios('%', null, 1, 25);
  perform public.zz_eq('busca "%" não casa tudo', r #>> '{dados,total}', '0');

  r := public.admin_listar_usuarios('_', null, 1, 25);
  perform public.zz_eq('busca "_" não casa tudo', r #>> '{dados,total}', '0');

  r := public.admin_listar_usuarios('\', null, 1, 25);
  perform public.zz_t('busca "\" sem erro', (r ->> 'ok')::boolean, r::text);

  r := public.admin_listar_usuarios(
    $q$'; drop table x; -- "|%_\ 😀$q$,
    null, 1, 25
  );

  perform public.zz_t(
    'busca hostil sem erro',
    (r ->> 'ok')::boolean,
    r::text
  );

  r := public.admin_listar_usuarios('plain@', null, 1, 25);
  perform public.zz_eq('busca por e-mail encontra alvo', r #>> '{dados,total}', '1');

  perform public.zz_t(
    'resposta da lista não traz colunas financeiras nem avatar',
    r::text !~ 'salario|investido|reserva_atual|reserva_meta|avatar_url'
  );

  r := public.admin_usuario_detalhe(
    '00000000-0000-4000-8000-00000000d001'
  );

  perform public.zz_t('ficha de usuário sem grupo → ok', (r ->> 'ok')::boolean, r::text);

  perform public.zz_t(
    'ficha não traz colunas financeiras nem avatar',
    r::text !~ 'salario|investido|reserva_atual|reserva_meta|avatar_url'
  );

  perform public.zz_t(
    'ficha rotula cargo como informado pelo usuário',
    r::text !~ '"cargo"'
  );

  r := public.admin_usuario_detalhe(
    '00000000-0000-4000-8000-0000000000ff'
  );

  perform public.zz_eq('ficha id inexistente → nao_encontrado', r ->> 'erro', 'nao_encontrado');

  r := public.admin_usuario_detalhe(null);
  perform public.zz_eq('ficha id nulo → parametro_invalido', r ->> 'erro', 'parametro_invalido');

  reset role;

  perform public.zz_t(
    'termo buscado foi para auditoria como texto',
    exists (
      select 1
      from public.admin_auditoria
      where acao = 'listar_usuarios'
        and parametros ->> 'busca' = '%'
    )
  );

  perform public.zz_t(
    'parametro_invalido ficou registrado',
    exists (
      select 1
      from public.admin_acessos_negados
      where motivo = 'parametro_invalido'
        and funcao = 'admin_listar_usuarios'
    )
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- 5. Negados: agrupamento por hora, rota e tetos
-- -----------------------------------------------------------------------------

do $t$
declare
  r jsonb;
  v_hora timestamptz := date_trunc('hour', now());
  v_antes bigint;
begin
  select coalesce(max(contagem), 0)
  into v_antes
  from homecash_interno.acessos_negados_contagem
  where user_id = '00000000-0000-4000-8000-00000000b001'
    and funcao = 'admin_resumo'
    and motivo = 'nao_admin'
    and hora = v_hora;

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000b001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5b01'
  );

  set local role authenticated;
  r := public.admin_resumo();
  r := public.admin_resumo();
  reset role;

  perform public.zz_eq(
    '2 negados iguais → 1 linha imutável',
    (
      select count(*)::text
      from public.admin_acessos_negados
      where user_id = '00000000-0000-4000-8000-00000000b001'
        and funcao = 'admin_resumo'
        and motivo = 'nao_admin'
    ),
    '1'
  );

  perform public.zz_eq(
    'contador subiu em 2',
    (
      select contagem::text
      from homecash_interno.acessos_negados_contagem
      where user_id = '00000000-0000-4000-8000-00000000b001'
        and funcao = 'admin_resumo'
        and motivo = 'nao_admin'
        and hora = v_hora
    ),
    (v_antes + 2)::text
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000d001',
    'aal1',
    null
  );

  set local role authenticated;
  r := public.registrar_tentativa_admin($q$<script>alert(1)</script>$q$);
  reset role;

  perform public.zz_eq(
    'rota hostil vira rota_invalida',
    (
      select rota
      from public.admin_acessos_negados
      where user_id = '00000000-0000-4000-8000-00000000d001'
        and funcao = 'layout_admin'
    ),
    'rota_invalida'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000b001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5b01'
  );

  set local role authenticated;
  r := public.registrar_tentativa_admin('/admin/usuarios');
  reset role;

  perform public.zz_eq(
    'rota do painel é gravada',
    (
      select rota
      from public.admin_acessos_negados
      where user_id = '00000000-0000-4000-8000-00000000b001'
        and funcao = 'layout_admin'
    ),
    '/admin/usuarios'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  r := public.registrar_tentativa_admin('/admin');
  reset role;

  perform public.zz_t(
    'admin chamando registrar_tentativa_admin não registra negado',
    (
      select count(*) = 0
      from public.admin_acessos_negados
      where user_id = '00000000-0000-4000-8000-00000000a001'
        and funcao = 'layout_admin'
    )
  );

  insert into public.admin_acessos_negados (user_id, funcao, motivo)
  select gen_random_uuid(), 'enchimento', 'teste'
  from generate_series(1, 200);

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000b001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5b01'
  );

  set local role authenticated;
  r := public.admin_usuario_detalhe(null);
  reset role;

  perform public.zz_eq(
    'acima do teto: conta comum não ganha linha nova',
    (
      select count(*)::text
      from public.admin_acessos_negados
      where user_id = '00000000-0000-4000-8000-00000000b001'
        and funcao = 'admin_usuario_detalhe'
    ),
    '0'
  );

  perform public.zz_eq(
    'contador sobe acima do teto',
    (
      select contagem::text
      from homecash_interno.acessos_negados_contagem
      where user_id = '00000000-0000-4000-8000-00000000b001'
        and funcao = 'admin_usuario_detalhe'
        and hora = v_hora
    ),
    '1'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5a01'
  );

  set local role authenticated;
  r := public.admin_listar_auditoria();
  reset role;

  perform public.zz_eq(
    'admin cadastrado continua com linha própria',
    (
      select count(*)::text
      from public.admin_acessos_negados
      where user_id = '00000000-0000-4000-8000-00000000a001'
        and funcao = 'admin_listar_auditoria'
        and motivo = 'mfa_requerida'
    ),
    '1'
  );

  insert into homecash_interno.acessos_negados_contagem (
    user_id, funcao, motivo, hora
  )
  select gen_random_uuid(), 'enchimento', 'teste', v_hora
  from generate_series(1, 2000);

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000d001',
    'aal1',
    null
  );

  set local role authenticated;
  r := public.admin_verificar_auditoria();
  reset role;

  perform public.zz_eq(
    'acima de 2000 chaves: conta comum não cria chave nova',
    (
      select count(*)::text
      from homecash_interno.acessos_negados_contagem
      where user_id = '00000000-0000-4000-8000-00000000d001'
        and funcao = 'admin_verificar_auditoria'
    ),
    '0'
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal1',
    '00000000-0000-4000-8000-0000000a5a01'
  );

  set local role authenticated;
  r := public.admin_verificar_auditoria();
  reset role;

  perform public.zz_t(
    'admin cadastrado cria chave acima do teto',
    (
      select count(*) = 1
      from homecash_interno.acessos_negados_contagem
      where user_id = '00000000-0000-4000-8000-00000000a001'
        and funcao = 'admin_verificar_auditoria'
        and motivo = 'mfa_requerida'
    )
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- 6. Imutabilidade: update, delete e truncate
-- -----------------------------------------------------------------------------

do $t$
declare
  v text;
  t text;
begin
  foreach t in array array[
    'public.admin_auditoria',
    'public.admin_acessos_negados'
  ] loop
    begin
      execute format('update %s set hash = hash', t);
      v := 'sem erro';
    exception when others then
      v := sqlstate;
    end;

    perform public.zz_eq('UPDATE em ' || t || ' recusado', v, '42501');

    begin
      execute format('delete from %s', t);
      v := 'sem erro';
    exception when others then
      v := sqlstate;
    end;

    perform public.zz_eq('DELETE em ' || t || ' recusado', v, '42501');

    begin
      execute format('truncate %s', t);
      v := 'sem erro';
    exception when others then
      v := sqlstate;
    end;

    perform public.zz_eq('TRUNCATE em ' || t || ' recusado', v, '42501');
  end loop;

  begin
    truncate public.admin_usuarios;
    v := 'sem erro';
  exception when others then
    v := sqlstate;
  end;

  perform public.zz_eq('TRUNCATE em admin_usuarios recusado', v, '42501');

  set local role authenticated;
  begin
    update public.admin_auditoria set hash = hash;
    v := 'sem erro';
  exception when others then
    v := sqlstate;
  end;
  reset role;

  perform public.zz_eq('authenticated UPDATE recusado', v, '42501');

  set local role authenticated;
  begin
    perform 1 from public.admin_usuarios;
    v := 'sem erro';
  exception when others then
    v := sqlstate;
  end;
  reset role;

  perform public.zz_eq('authenticated SELECT recusado', v, '42501');

  set local role anon;
  begin
    perform public.admin_resumo();
    v := 'sem erro';
  exception when others then
    v := sqlstate;
  end;
  reset role;

  perform public.zz_eq('anon EXECUTE recusado', v, '42501');
end;
$t$;

-- -----------------------------------------------------------------------------
-- 7. Último administrador
-- -----------------------------------------------------------------------------

do $t$
declare
  v text;
begin
  begin
    update public.admin_usuarios
    set ativo = false
    where user_id = '00000000-0000-4000-8000-00000000a001';
    v := 'sem erro';
  exception when others then
    v := sqlstate;
  end;

  perform public.zz_eq('desativar único admin recusado', v, '23514');

  begin
    delete from public.admin_usuarios
    where user_id = '00000000-0000-4000-8000-00000000a001';
    v := 'sem erro';
  exception when others then
    v := sqlstate;
  end;

  perform public.zz_eq('remover único admin recusado', v, '23514');

  insert into public.admin_usuarios (user_id, ativo)
  values ('00000000-0000-4000-8000-00000000c001', true);

  update public.admin_usuarios
  set ativo = false
  where user_id = '00000000-0000-4000-8000-00000000a001';

  perform public.zz_t(
    'com segundo admin, desativar primeiro é permitido',
    not (
      select ativo
      from public.admin_usuarios
      where user_id = '00000000-0000-4000-8000-00000000a001'
    )
  );

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  perform public.zz_eq(
    'admin desativado → acesso_negado',
    (public.admin_resumo()) ->> 'erro',
    'acesso_negado'
  );
  reset role;

  perform public.zz_t(
    'motivo admin_inativo registrado',
    exists (
      select 1
      from public.admin_acessos_negados
      where motivo = 'admin_inativo'
    )
  );

  update public.admin_usuarios
  set ativo = true
  where user_id = '00000000-0000-4000-8000-00000000a001';

  update public.admin_usuarios
  set ativo = false
  where user_id = '00000000-0000-4000-8000-00000000c001';

  perform public.zz_t(
    'mudanças em admin_usuarios geraram auditoria',
    (
      select count(*) >= 4
      from public.admin_auditoria
      where acao like 'admin_usuarios_%'
    )
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- 8. Cadeia de auditoria
-- -----------------------------------------------------------------------------

do $t$
declare
  r jsonb;
  v_desde bigint := 1;
  v_total bigint := 0;
  v_quebra bigint;
  n int := 0;
  v_tab text;
begin
  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  perform public.admin_resumo();
  perform public.admin_listar_usuarios();
  reset role;

  foreach v_tab in array array['acoes', 'negados'] loop
    v_desde := 1;
    v_total := 0;
    v_quebra := null;
    n := 0;

    loop
      set local role authenticated;
      r := public.admin_verificar_auditoria(v_desde, 3, v_tab);
      reset role;

      exit when (r ->> 'ok')::boolean is not true;

      v_total := v_total + (r #>> '{dados,verificadas}')::bigint;
      v_quebra := coalesce(
        v_quebra,
        (r #>> '{dados,primeira_quebra}')::bigint
      );

      exit when r #>> '{dados,proxima}' is null or n > 500;

      v_desde := (r #>> '{dados,proxima}')::bigint;
      n := n + 1;
    end loop;

    perform public.zz_t(
      'cadeia "' || v_tab || '" íntegra em páginas de 3',
      v_quebra is null and v_total > 0,
      r::text
    );
  end loop;

  alter table public.admin_auditoria
  disable trigger trg_auditoria_imutavel_linha;

  update public.admin_auditoria
  set motivo = 'adulterado'
  where ordem = 2;

  alter table public.admin_auditoria
  enable trigger trg_auditoria_imutavel_linha;

  set local role authenticated;
  r := public.admin_verificar_auditoria(1, 5000, 'acoes');
  reset role;

  perform public.zz_eq(
    'adulteração ordem 2 → primeira_quebra = 2',
    r #>> '{dados,primeira_quebra}',
    '2'
  );

  alter table public.admin_acessos_negados
  disable trigger trg_negados_imutavel_linha;

  update public.admin_acessos_negados
  set motivo = 'adulterado'
  where ordem = 1;

  alter table public.admin_acessos_negados
  enable trigger trg_negados_imutavel_linha;

  set local role authenticated;
  r := public.admin_verificar_auditoria(1, 5000, 'negados');
  reset role;

  perform public.zz_eq(
    'adulteração negados ordem 1 → primeira_quebra = 1',
    r #>> '{dados,primeira_quebra}',
    '1'
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- 9. Fator removido com JWT antigo
-- -----------------------------------------------------------------------------

do $t$
declare
  r jsonb;
begin
  delete from auth.mfa_factors
  where id = '00000000-0000-4000-8000-00000000f001';

  perform public.zz_claims(
    '00000000-0000-4000-8000-00000000a001',
    'aal2',
    '00000000-0000-4000-8000-0000000a5a02'
  );

  set local role authenticated;
  r := public.admin_resumo();
  reset role;

  perform public.zz_t(
    'JWT aal2 antigo depois de remover fator → negado',
    (r ->> 'erro') in ('mfa_nao_configurada', 'sessao_invalida'),
    r::text
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- 10. Exclusão de conta
-- -----------------------------------------------------------------------------

do $t$
declare
  v_antes bigint := (select count(*) from public.admin_auditoria);
  v text;
begin
  begin
    delete from auth.users
    where id = '00000000-0000-4000-8000-00000000a001';
    v := 'ok';
  exception when others then
    v := sqlstate || ' ' || sqlerrm;
  end;

  perform public.zz_eq('excluir conta admin não falha', v, 'ok');

  perform public.zz_t(
    'a auditoria não diminuiu',
    (select count(*) from public.admin_auditoria) >= v_antes
  );

  perform public.zz_t(
    'linha de admin_usuarios ficou órfã e inofensiva',
    exists (
      select 1
      from public.admin_usuarios
      where user_id = '00000000-0000-4000-8000-00000000a001'
    )
  );
end;
$t$;

-- -----------------------------------------------------------------------------
-- Resultado: somente falhas
-- -----------------------------------------------------------------------------

select count(*) filter (where not ok) as falhas,
       count(*) as total,
       coalesce(string_agg(n || ': ' || nome, ' | ' order by n) filter (where not ok), 'nenhuma') as quais
  from public.zz_resultado_teste;

rollback;

-- =============================================================================
-- VERIFICAÇÕES MANUAIS (não automatizáveis neste roteiro)
-- =============================================================================
-- A. Concorrência da cadeia: duas conexões e rollback.
-- B. Funções internas fora de /rest/v1/rpc.
-- C. Reexecução da migração 20 (idempotência).
-- D. Token real: conferir claims aal, session_id, amr e factor_id.
-- =============================================================================
