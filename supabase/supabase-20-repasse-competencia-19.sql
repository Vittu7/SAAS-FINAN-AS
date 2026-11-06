-- Corrige a competência dos 19 repasses já confirmados (R$ 1.861,11) para 2026-10 — DADOS (rodar DEPOIS do script 19).
--
-- Só grava repasse_mes. Não altera valores, responsáveis, contas (repasse_conta) nem a data real (repasse_pago_em).
-- Os outros dois repasses confirmados (outros autores, mês 2026-11) NÃO são tocados.
--
-- Identificação exclusiva: autor 6bea3ece-…, repasse concluído, lançamento de 2026-10, conta "MERCADO PAGO Débito",
-- confirmado em 06/11/2026 (Brasília), repasse_mes ainda vazio E o início do id (8 primeiros caracteres) na lista exata abaixo.
-- Antes de gravar, o bloco valida quantidade e soma por tabela e no total; se qualquer número diferir, ABORTA sem gravar.
-- Depois de gravar, valida de novo e, se divergir, também aborta (a transação inteira é desfeita).
--
-- Para desfazer: update public.<tabela> set repasse_mes = null where repasse_mes = '2026-10' and <mesmo filtro>;

do $$
declare
  v_autor constant uuid := '6bea3ece-cb6e-4932-b0b6-3dd2b2c136e2';
  v_ext   constant text[] := array['00fcccc9','6cfb3840','79d7dea1','8fb46a7f','9e69789e','a3f5c448','a5356584','c6385977','daa6d9a7','dba614cf','e7f265f7'];
  v_car   constant text[] := array['19975476','556e0f9f','71d02e8e'];
  v_fix   constant text[] := array['44b55340','65fc980f','a2b452e2','a56c7111','b1fbd0c4'];
  n_ext int; n_car int; n_fix int; s_ext numeric; s_car numeric; s_fix numeric;
begin
  -- 1) Validação ANTES de gravar
  select count(*), coalesce(sum(valor), 0) into n_ext, s_ext from public.extrato where owner_id = v_autor and responsavel_id <> owner_id and repasse_pago and repasse_mes is null
    and mes = '2026-10' and repasse_conta = 'MERCADO PAGO Débito' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' and left(id::text, 8) = any (v_ext);
  select count(*), coalesce(sum(valor), 0) into n_car, s_car from public.cartao where owner_id = v_autor and responsavel_id <> owner_id and repasse_pago and repasse_mes is null
    and mes = '2026-10' and repasse_conta = 'MERCADO PAGO Débito' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' and left(id::text, 8) = any (v_car);
  select count(*), coalesce(sum(valor), 0) into n_fix, s_fix from public.contas_fixas where owner_id = v_autor and responsavel_id <> owner_id and repasse_pago and repasse_mes is null
    and mes = '2026-10' and repasse_conta = 'MERCADO PAGO Débito' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' and left(id::text, 8) = any (v_fix);

  if n_ext <> 11 or s_ext <> 720.36 or n_car <> 3 or s_car <> 776.00 or n_fix <> 5 or s_fix <> 364.75 or (n_ext + n_car + n_fix) <> 19 or (s_ext + s_car + s_fix) <> 1861.11 then
    raise exception 'Abortado: esperado extrato 11 / R$ 720,36, cartao 3 / R$ 776,00, contas_fixas 5 / R$ 364,75 (19 / R$ 1861,11); encontrado % / %, % / %, % / %. Nada foi gravado.', n_ext, s_ext, n_car, s_car, n_fix, s_fix;
  end if;

  -- 2) Gravação (só repasse_mes), com exatamente o mesmo filtro
  update public.extrato set repasse_mes = '2026-10' where owner_id = v_autor and responsavel_id <> owner_id and repasse_pago and repasse_mes is null
    and mes = '2026-10' and repasse_conta = 'MERCADO PAGO Débito' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' and left(id::text, 8) = any (v_ext);
  update public.cartao set repasse_mes = '2026-10' where owner_id = v_autor and responsavel_id <> owner_id and repasse_pago and repasse_mes is null
    and mes = '2026-10' and repasse_conta = 'MERCADO PAGO Débito' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' and left(id::text, 8) = any (v_car);
  update public.contas_fixas set repasse_mes = '2026-10' where owner_id = v_autor and responsavel_id <> owner_id and repasse_pago and repasse_mes is null
    and mes = '2026-10' and repasse_conta = 'MERCADO PAGO Débito' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' and left(id::text, 8) = any (v_fix);

  -- 3) Validação DEPOIS de gravar: as linhas do autor com competência 2026-10 confirmadas nesse dia são exatamente as 19
  select count(*), coalesce(sum(valor), 0) into n_ext, s_ext from (
    select valor from public.extrato where owner_id = v_autor and repasse_mes = '2026-10' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' union all
    select valor from public.cartao where owner_id = v_autor and repasse_mes = '2026-10' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03' union all
    select valor from public.contas_fixas where owner_id = v_autor and repasse_mes = '2026-10' and repasse_pago_em >= '2026-11-06 00:00:00-03' and repasse_pago_em < '2026-11-07 00:00:00-03') x;
  if n_ext <> 19 or s_ext <> 1861.11 then
    raise exception 'Abortado após gravar: % linhas / R$ % com repasse_mes 2026-10 nesse dia (esperado 19 / R$ 1861,11). A transação foi desfeita.', n_ext, s_ext;
  end if;
end $$;
