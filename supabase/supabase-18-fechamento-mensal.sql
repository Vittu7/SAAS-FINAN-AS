-- FECHAMENTO MENSAL (garantia no banco). NÃO APLICADA ainda. Preparada em 2026-11-05; revisada em 2026-11-06.
--
-- O que faz:
--   * Tabelas: fechamento_controle (mês em que a pessoa começou a fechar), fechamento_meses (situação atual de cada
--     mês) e fechamento_eventos (histórico só de inserção: fechamentos e reaberturas, com data, autor, motivo e retrato).
--   * Funções chamadas pelo app: iniciar_fechamento_mensal, fechar_mes, reabrir_mes. Conferem as regras e travam a
--     linha de controle da pessoa (FOR UPDATE) para que dois cliques não fechem/reabram duas vezes.
--   * Travas (triggers) que recusam alterar um mês fechado por QUALQUER tela ou chamada direta à API:
--       - extrato, cartao, contas_fixas: insert/update/delete quando quem lançou ou o responsável fechou o mês do
--         lançamento (o mês antigo e, numa edição, o novo). Continua permitido mexer só nas colunas de repasse e no
--         grupo_id (mover para o grupo não muda valores). A mudança de repasse tem trava própria (abaixo).
--       - repasse: confirmar ou estornar quando o mês da confirmação está fechado para quem pagou ou para quem
--         recebeu. Esta trava vale para TODOS os papéis, inclusive funções SECURITY DEFINER (atualizar_repasse),
--         porque o estorno de hoje apaga a data da confirmação.
--       - pagamentos_fatura e caixinha_movimentos: pela data do movimento.
--       - opcoes_pagamento: saldo_inicial não muda depois do primeiro fechamento (mudaria todos os meses passados).
--   * Exclusão de conta/grupo (funções SECURITY DEFINER) continua funcionando: as travas de lançamento valem só para
--     anon/authenticated, como a migração 14.
--
-- Mês de cada data: horário de Brasília (America/Sao_Paulo). Um mês só pode ser fechado depois de terminar.
-- Aditiva e reexecutável. Não altera nem apaga dados existentes. Nenhum mês é fechado automaticamente.
-- Verificado no banco real em 2026-11-06: `data` é date em caixinha_movimentos e pagamentos_fatura; meus_membros()
-- existe (setof uuid, SECURITY DEFINER); nenhum trigger de nome igual existe (a migração 14 usa outro nome).
--
-- Decisões deliberadas:
--   * O banco NÃO recusa lançar em mês depois do mês em aberto: parcelas e contas fixas criam linhas em meses
--     futuros de uma só vez. Quem controla "mês em espera" é o app (bloqueioParaLancar).
--   * O retrato é informativo (auditoria): nenhum saldo é calculado a partir dele; o app sempre recalcula.
--   * Lançamento pessoal (quem lançou = responsável) só é travado pelo fechamento da própria pessoa. O fechamento de
--     outro membro só trava o que muda o resultado dele (lançamento em que ele é o responsável, ou repasse dele).

begin;

-- 1) Tabelas ---------------------------------------------------------------------------------------------------
create table if not exists public.fechamento_controle (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mes_inicial text not null check (mes_inicial ~ '^\d{4}-\d{2}$'),
  criado_em timestamptz not null default now()
);

create table if not exists public.fechamento_meses (
  user_id uuid not null references auth.users (id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  status text not null check (status in ('fechado', 'aberto')),
  fechado_em timestamptz,
  retrato jsonb,
  assinatura text,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, mes)
);

create table if not exists public.fechamento_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  tipo text not null check (tipo in ('fechamento', 'reabertura')),
  em timestamptz not null default now(),
  por uuid not null,
  motivo text,
  retrato jsonb,
  assinatura text,
  check (tipo <> 'reabertura' or length(btrim(coalesce(motivo, ''))) >= 10)
);
create index if not exists fechamento_eventos_user_mes on public.fechamento_eventos (user_id, mes, em);

alter table public.fechamento_controle enable row level security;
alter table public.fechamento_meses enable row level security;
alter table public.fechamento_eventos enable row level security;

-- Leitura: a própria pessoa; a situação dos meses também para os membros do grupo (o app avisa quando um
-- lançamento compartilhado está travado pelo fechamento da outra pessoa). Escrita só pelas funções abaixo.
drop policy if exists fechamento_controle_select on public.fechamento_controle;
create policy fechamento_controle_select on public.fechamento_controle for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists fechamento_meses_select on public.fechamento_meses;
create policy fechamento_meses_select on public.fechamento_meses for select to authenticated
  using (user_id = (select auth.uid()) or user_id in (select public.meus_membros()));
drop policy if exists fechamento_eventos_select on public.fechamento_eventos;
create policy fechamento_eventos_select on public.fechamento_eventos for select to authenticated
  using (user_id = (select auth.uid()));

-- 2) Funções auxiliares ----------------------------------------------------------------------------------------
create or replace function public.mes_em_brasilia(p_ts timestamptz)
returns text language sql immutable set search_path = ''
as $$ select to_char(p_ts at time zone 'America/Sao_Paulo', 'YYYY-MM') $$;

create or replace function public.mes_fechado(p_pessoa uuid, p_mes text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_pessoa is not null and p_mes is not null and exists (
    select 1 from public.fechamento_meses f where f.user_id = p_pessoa and f.mes = p_mes and f.status = 'fechado')
$$;

create or replace function public.mes_seguinte(p_mes text)
returns text language sql immutable set search_path = ''
as $$ select to_char((p_mes || '-01')::date + interval '1 month', 'YYYY-MM') $$;

-- Assinatura dos lançamentos do mês da pessoa (para conferir depois que nada mudou por fora).
create or replace function public.assinatura_do_mes(p_pessoa uuid, p_mes text)
returns text language sql stable security definer set search_path = ''
as $$
  select md5(coalesce(string_agg(linha, '|' order by linha), '')) from (
    select 'e:' || id::text || ':' || valor::text || ':' || coalesce(responsavel_id::text, '') from public.extrato
      where mes = p_mes and (owner_id = p_pessoa or responsavel_id = p_pessoa)
    union all
    select 'c:' || id::text || ':' || valor::text || ':' || coalesce(responsavel_id::text, '') from public.cartao
      where mes = p_mes and (owner_id = p_pessoa or responsavel_id = p_pessoa)
    union all
    select 'f:' || id::text || ':' || valor::text || ':' || coalesce(pago::text, '') from public.contas_fixas
      where mes = p_mes and (owner_id = p_pessoa or responsavel_id = p_pessoa)
  ) t(linha)
$$;

-- 3) Funções chamadas pelo app ---------------------------------------------------------------------------------
create or replace function public.iniciar_fechamento_mensal(p_mes text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if p_mes !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido.' using errcode = '22023'; end if;
  if p_mes > public.mes_em_brasilia(now()) then raise exception 'O mês inicial não pode ser futuro.' using errcode = '22023'; end if;
  insert into public.fechamento_controle (user_id, mes_inicial) values (v_uid, p_mes) on conflict (user_id) do nothing;
end;
$$;

create or replace function public.fechar_mes(p_mes text, p_retrato jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inicio text;
  v_trabalho text;
  v_assinatura text;
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select mes_inicial into v_inicio from public.fechamento_controle where user_id = v_uid for update; -- serializa por pessoa
  if v_inicio is null then raise exception 'Ative o fechamento mensal primeiro.' using errcode = '22023'; end if;
  if p_retrato is not null and jsonb_typeof(p_retrato) <> 'object' then raise exception 'Retrato inválido.' using errcode = '22023'; end if;
  if public.mes_fechado(v_uid, p_mes) then raise exception 'Este mês já está fechado.' using errcode = '23505'; end if;
  -- mês em aberto = primeiro não fechado desde o inicial
  v_trabalho := v_inicio;
  while public.mes_fechado(v_uid, v_trabalho) loop v_trabalho := public.mes_seguinte(v_trabalho); end loop;
  if p_mes <> v_trabalho then raise exception 'Feche os meses em ordem: o mês em aberto é %.', v_trabalho using errcode = '22023'; end if;
  if p_mes >= public.mes_em_brasilia(now()) then raise exception 'O mês ainda não terminou.' using errcode = '22023'; end if;

  v_assinatura := public.assinatura_do_mes(v_uid, p_mes);
  insert into public.fechamento_meses (user_id, mes, status, fechado_em, retrato, assinatura, atualizado_em)
    values (v_uid, p_mes, 'fechado', now(), p_retrato, v_assinatura, now())
    on conflict (user_id, mes) do update set status = 'fechado', fechado_em = now(), retrato = excluded.retrato,
      assinatura = excluded.assinatura, atualizado_em = now();
  insert into public.fechamento_eventos (user_id, mes, tipo, por, retrato, assinatura)
    values (v_uid, p_mes, 'fechamento', v_uid, p_retrato, v_assinatura);
end;
$$;

create or replace function public.reabrir_mes(p_mes text, p_motivo text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ultimo text;
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'Explique o motivo com pelo menos 10 letras.' using errcode = '22023'; end if;
  perform 1 from public.fechamento_controle where user_id = v_uid for update; -- serializa por pessoa
  select max(mes) into v_ultimo from public.fechamento_meses where user_id = v_uid and status = 'fechado';
  if v_ultimo is null or not public.mes_fechado(v_uid, p_mes) then raise exception 'Este mês não está fechado.' using errcode = '22023'; end if;
  if p_mes <> v_ultimo then raise exception 'Reabra antes %, o último mês fechado.', v_ultimo using errcode = '22023'; end if;

  update public.fechamento_meses set status = 'aberto', atualizado_em = now() where user_id = v_uid and mes = p_mes;
  insert into public.fechamento_eventos (user_id, mes, tipo, por, motivo)
    values (v_uid, p_mes, 'reabertura', v_uid, btrim(p_motivo));
end;
$$;

-- 4) Travas ----------------------------------------------------------------------------------------------------
-- Lançamentos: recusa alterar mês fechado (de quem lançou ou do responsável). Só a API (anon/authenticated).
create or replace function public.lancamento_trava_mes_fechado()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_livres text[] := array['repasse_informado', 'repasse_informado_em', 'repasse_pago', 'repasse_pago_em',
                           'repasse_conta', 'repasse_conta_origem', 'grupo_id'];
  v_antes jsonb; v_depois jsonb; k text;
begin
  if current_user not in ('anon', 'authenticated') then return coalesce(new, old); end if;

  -- IFs aninhados (nunca lê OLD num INSERT nem NEW num DELETE, sem depender de curto-circuito do AND)
  if tg_op in ('UPDATE', 'DELETE') then
    if public.mes_fechado(old.owner_id, old.mes) or public.mes_fechado(old.responsavel_id, old.mes) then
      if tg_op = 'DELETE' then
        raise exception 'Este lançamento é de um mês fechado. Reabra o mês para excluir.' using errcode = '42501';
      end if;
      v_antes := to_jsonb(old); v_depois := to_jsonb(new);
      foreach k in array v_livres loop v_antes := v_antes - k; v_depois := v_depois - k; end loop;
      if v_antes is distinct from v_depois then
        raise exception 'Este lançamento é de um mês fechado. Reabra o mês para editar.' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if public.mes_fechado(new.owner_id, new.mes) or public.mes_fechado(new.responsavel_id, new.mes) then
      raise exception 'Não é possível lançar em um mês fechado. Reabra o mês primeiro.' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.mes is distinct from old.mes or new.responsavel_id is distinct from old.responsavel_id)
       and (public.mes_fechado(new.owner_id, new.mes) or public.mes_fechado(new.responsavel_id, new.mes)) then
      raise exception 'Não é possível lançar em um mês fechado. Reabra o mês primeiro.' using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- Repasse: confirmar/estornar não pode mexer em mês fechado. Vale para TODOS os papéis.
create or replace function public.repasse_trava_mes_fechado()
returns trigger language plpgsql set search_path = ''
as $$
declare v_mes text;
begin
  if coalesce(old.repasse_pago, false) is not distinct from coalesce(new.repasse_pago, false) then return new; end if;
  if coalesce(new.repasse_pago, false) then
    v_mes := public.mes_em_brasilia(coalesce(new.repasse_pago_em, now()));   -- confirmação
  else
    v_mes := public.mes_em_brasilia(coalesce(old.repasse_pago_em, now()));   -- estorno
  end if;
  if public.mes_fechado(new.owner_id, v_mes) or public.mes_fechado(new.responsavel_id, v_mes) then
    raise exception 'O repasse é de um mês fechado (%). Reabra o mês para alterar.', v_mes using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Pagamento de fatura e caixinhas: pela data do movimento.
create or replace function public.movimento_trava_mes_fechado()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then return coalesce(new, old); end if;
  if tg_op in ('UPDATE', 'DELETE') then
    if public.mes_fechado(old.user_id, left(old.data::text, 7)) then
      raise exception 'Este movimento é de um mês fechado. Reabra o mês para alterar.' using errcode = '42501';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if public.mes_fechado(new.user_id, left(new.data::text, 7)) then
      raise exception 'Não é possível registrar em um mês fechado. Reabra o mês primeiro.' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- Saldo inicial: muda todos os meses passados; trava depois do primeiro fechamento.
-- Também recusa criar/apagar conta com saldo inicial e trocar o tipo (débito x crédito) de conta com saldo: qualquer
-- dessas mudanças alteraria o saldo inicial somado nos meses já fechados.
create or replace function public.opcao_trava_saldo_inicial()
returns trigger language plpgsql set search_path = ''
as $$
declare v_dono uuid; v_mexe boolean := false;
begin
  if current_user not in ('anon', 'authenticated') then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    v_dono := new.user_id; v_mexe := coalesce(new.saldo_inicial, 0) <> 0;
  elsif tg_op = 'DELETE' then
    v_dono := old.user_id; v_mexe := coalesce(old.saldo_inicial, 0) <> 0;
  else
    v_dono := old.user_id;
    v_mexe := new.saldo_inicial is distinct from old.saldo_inicial
      or (coalesce(old.saldo_inicial, 0) <> 0 and (new.tipo_cartao is distinct from old.tipo_cartao or new.eh_cartao is distinct from old.eh_cartao));
  end if;
  if v_mexe and v_dono is not null
     and exists (select 1 from public.fechamento_meses f where f.user_id = v_dono and f.status = 'fechado') then
    raise exception 'O saldo inicial das contas não pode mudar depois que um mês foi fechado.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.lancamento_trava_mes_fechado() from public, anon, authenticated;
revoke execute on function public.repasse_trava_mes_fechado() from public, anon, authenticated;
revoke execute on function public.movimento_trava_mes_fechado() from public, anon, authenticated;
revoke execute on function public.opcao_trava_saldo_inicial() from public, anon, authenticated;
revoke execute on function public.mes_fechado(uuid, text) from public, anon;
grant execute on function public.mes_fechado(uuid, text) to authenticated;
revoke execute on function public.assinatura_do_mes(uuid, text) from public, anon, authenticated;
revoke execute on function public.iniciar_fechamento_mensal(text) from public, anon;
revoke execute on function public.fechar_mes(text, jsonb) from public, anon;
revoke execute on function public.reabrir_mes(text, text) from public, anon;
grant execute on function public.iniciar_fechamento_mensal(text) to authenticated;
grant execute on function public.fechar_mes(text, jsonb) to authenticated;
grant execute on function public.reabrir_mes(text, text) to authenticated;

create or replace trigger lancamento_trava_mes_fechado before insert or update or delete on public.extrato
  for each row execute function public.lancamento_trava_mes_fechado();
create or replace trigger lancamento_trava_mes_fechado before insert or update or delete on public.cartao
  for each row execute function public.lancamento_trava_mes_fechado();
create or replace trigger lancamento_trava_mes_fechado before insert or update or delete on public.contas_fixas
  for each row execute function public.lancamento_trava_mes_fechado();

create or replace trigger repasse_trava_mes_fechado before update on public.extrato
  for each row execute function public.repasse_trava_mes_fechado();
create or replace trigger repasse_trava_mes_fechado before update on public.cartao
  for each row execute function public.repasse_trava_mes_fechado();
create or replace trigger repasse_trava_mes_fechado before update on public.contas_fixas
  for each row execute function public.repasse_trava_mes_fechado();

create or replace trigger movimento_trava_mes_fechado before insert or update or delete on public.pagamentos_fatura
  for each row execute function public.movimento_trava_mes_fechado();
create or replace trigger movimento_trava_mes_fechado before insert or update or delete on public.caixinha_movimentos
  for each row execute function public.movimento_trava_mes_fechado();

create or replace trigger opcao_trava_saldo_inicial before insert or update or delete on public.opcoes_pagamento
  for each row execute function public.opcao_trava_saldo_inicial();

commit;

-- Para desfazer (sem perder dados de lançamentos):
--   drop trigger lancamento_trava_mes_fechado on public.extrato; (idem cartao, contas_fixas)
--   drop trigger repasse_trava_mes_fechado on public.extrato;    (idem cartao, contas_fixas)
--   drop trigger movimento_trava_mes_fechado on public.pagamentos_fatura; (idem caixinha_movimentos)
--   drop trigger opcao_trava_saldo_inicial on public.opcoes_pagamento;
-- As tabelas fechamento_* guardam o histórico: não apagar sem exportar antes.
