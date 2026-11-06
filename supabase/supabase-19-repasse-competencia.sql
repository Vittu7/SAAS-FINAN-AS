-- Competência do recebimento de repasses (repasse_mes) — MIGRAÇÃO (estrutura e funções; NÃO altera dados existentes).
--
-- Regra: o recebimento de um repasse pertence ao mês financeiro EM ABERTO de quem confirma (o autor), e não ao mês do
-- calendário. Mês em aberto = primeiro mês, desde o mes_inicial da pessoa, que ainda não foi fechado. A data real da
-- confirmação continua em repasse_pago_em. Registros antigos (repasse_mes nulo) usam o mês de repasse_pago_em.
--
-- O que muda:
--   1) coluna repasse_mes (AAAA-MM, nula) em extrato, cartao e contas_fixas;
--   2) função mes_em_aberto(pessoa) — uso interno;
--   3) atualizar_repasse: "concluir" grava a competência e só atua em repasse ainda não confirmado (reconfirmar não
--      muda mais a data); "reabrir" (estorno) limpa a competência. Autorização, permissões e SECURITY DEFINER iguais;
--   4) repasse_trava_mes_fechado: usa a competência (confirmar: a nova; estornar: a gravada) + bloco do reconhecimento
--      da despesa no mês original do responsável;
--   5) trigger repasse_mes_protegido: a competência só é escrita pelo sistema; pela API (anon/authenticated) é preservada.
--
-- Compatível com o app antigo (ele ignora a coluna) e com o novo (usa repasse_mes e cai em repasse_pago_em se vazio).
-- RLS e permissões existentes não são alteradas (create or replace preserva dono e ACL).
-- Pode ser rodado mais de uma vez.
--
-- Para desfazer:
--   update public.extrato set repasse_mes = null; (idem cartao e contas_fixas);
--   drop trigger repasse_mes_protegido on public.extrato; (idem cartao e contas_fixas); drop function public.repasse_mes_protegido();
--   reaplicar as definições anteriores de atualizar_repasse e repasse_trava_mes_fechado (scripts 04/05 e 18);
--   drop function public.mes_em_aberto(uuid); alter table ... drop column repasse_mes;

begin;

-- 1) Competência do recebimento
alter table public.extrato      add column if not exists repasse_mes text check (repasse_mes is null or repasse_mes ~ '^\d{4}-(0[1-9]|1[0-2])$');
alter table public.cartao       add column if not exists repasse_mes text check (repasse_mes is null or repasse_mes ~ '^\d{4}-(0[1-9]|1[0-2])$');
alter table public.contas_fixas add column if not exists repasse_mes text check (repasse_mes is null or repasse_mes ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- 2) Mês em aberto da pessoa (individual: cada pessoa tem o seu mes_inicial e os seus fechamentos).
--    Sem fechamento ativado, vale o mês do calendário em Brasília.
create or replace function public.mes_em_aberto(p_pessoa uuid)
returns text language sql stable security definer set search_path = ''
as $$
  with recursive m(mes, n) as (
    select c.mes_inicial, 0 from public.fechamento_controle c where c.user_id = p_pessoa
    union all
    select to_char((to_date(m.mes || '-01', 'YYYY-MM-DD') + interval '1 month')::date, 'YYYY-MM'), m.n + 1
    from m where m.n < 600 and public.mes_fechado(p_pessoa, m.mes)
  )
  select coalesce((select mes from m order by n desc limit 1), public.mes_em_brasilia(now()))
$$;
revoke execute on function public.mes_em_aberto(uuid) from public, anon, authenticated; -- só uso interno (atualizar_repasse)

-- 3) atualizar_repasse: igual à atual, exceto "concluir" e "reabrir"
create or replace function public.atualizar_repasse(p_tabela text, p_ids text[], p_acao text)
returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tab text;
  v_count integer := 0;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;

  v_tab := case p_tabela
    when 'extrato' then 'extrato'
    when 'cartao' then 'cartao'
    when 'contas_fixas' then 'contas_fixas'
    else null end;
  if v_tab is null then raise exception 'Tabela inválida'; end if;

  if p_acao = 'informar' then
    execute format('update public.%I set repasse_informado = true, repasse_informado_em = now()
      where id::text = any($1) and responsavel_id = $2 and owner_id is distinct from responsavel_id
        and coalesce(repasse_pago, false) = false', v_tab) using p_ids, v_uid;
  elsif p_acao = 'desinformar' then
    execute format('update public.%I set repasse_informado = false, repasse_informado_em = null
      where id::text = any($1) and responsavel_id = $2 and coalesce(repasse_pago, false) = false', v_tab) using p_ids, v_uid;
  elsif p_acao = 'concluir' then
    -- competência = mês em aberto de QUEM CONFIRMA (o autor, v_uid); só confirma o que ainda não foi confirmado
    execute format('update public.%I set repasse_pago = true, repasse_pago_em = now(), repasse_mes = public.mes_em_aberto($2)
      where id::text = any($1) and owner_id = $2 and owner_id is distinct from responsavel_id
        and coalesce(repasse_pago, false) = false', v_tab) using p_ids, v_uid;
  elsif p_acao = 'reabrir' then
    -- estorno: desfaz a confirmação e limpa a competência (a trava lê a competência gravada antes do estorno)
    execute format('update public.%I set repasse_pago = false, repasse_pago_em = null, repasse_mes = null,
      repasse_informado = false, repasse_informado_em = null
      where id::text = any($1) and owner_id = $2', v_tab) using p_ids, v_uid;
  else
    raise exception 'Ação inválida';
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- 4) Trava de mês fechado do repasse (vale para TODOS os papéis, inclusive atualizar_repasse)
create or replace function public.repasse_trava_mes_fechado()
returns trigger language plpgsql set search_path = ''
as $$
declare v_mes text;
begin
  if coalesce(old.repasse_pago, false) is not distinct from coalesce(new.repasse_pago, false) then return new; end if;
  if coalesce(new.repasse_pago, false) then
    v_mes := coalesce(new.repasse_mes, public.mes_em_brasilia(coalesce(new.repasse_pago_em, now())));  -- confirmação: competência nova
  else
    v_mes := coalesce(old.repasse_mes, public.mes_em_brasilia(coalesce(old.repasse_pago_em, now())));  -- estorno: competência gravada
  end if;
  if public.mes_fechado(new.owner_id, v_mes) or public.mes_fechado(new.responsavel_id, v_mes) then
    raise exception 'O repasse é de um mês fechado (%). Reabra o mês para alterar.', v_mes using errcode = '42501';
  end if;
  -- O repasse reconhece/desfaz a despesa do responsável no mês ORIGINAL dela
  if new.owner_id is distinct from new.responsavel_id and public.mes_fechado(new.responsavel_id, new.mes) then
    raise exception 'Este repasse reconhece a despesa em %, que está fechado para o responsável. Reabra o mês para alterar.', new.mes using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 5) A competência só é escrita pelo sistema (atualizar_repasse roda como postgres). Pela API ela é ignorada/preservada.
create or replace function public.repasse_mes_protegido()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then new.repasse_mes := null;
  else new.repasse_mes := old.repasse_mes; end if;
  return new;
end;
$$;
revoke execute on function public.repasse_mes_protegido() from public, anon, authenticated;

create or replace trigger repasse_mes_protegido before insert or update on public.extrato      for each row execute function public.repasse_mes_protegido();
create or replace trigger repasse_mes_protegido before insert or update on public.cartao       for each row execute function public.repasse_mes_protegido();
create or replace trigger repasse_mes_protegido before insert or update on public.contas_fixas for each row execute function public.repasse_mes_protegido();

commit;
