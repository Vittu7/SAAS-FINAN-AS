-- Contas fixas integradas a débito/crédito: status "Cobrada no cartão", valor variável, encerrar sem apagar,
-- e dia de fechamento do cartão.
--
-- Só ADICIONA colunas opcionais. Não altera, não apaga e não preenche nenhuma linha existente
-- (nenhum update, delete ou backfill): lançamentos, repasses (inclusive os confirmados) e meses fechados ficam como estão.
-- Os valores padrão reproduzem o comportamento de hoje. Pode ser rodado mais de uma vez.
--
-- contas_fixas
--   valor_variavel   a série tem valor que muda a cada mês (padrão: false)
--   valor_confirmado false = valor ainda é a previsão copiada do mês anterior (padrão: true, como hoje)
--   pago_em          data em que foi paga (débito/dinheiro) ou cobrada no cartão (crédito). Vazio = usa o mês da linha
--   encerrada_em     mês AAAA-MM a partir do qual a série não gera mais linhas (as linhas existentes continuam)
-- opcoes_pagamento
--   dia_fechamento   dia de fechamento da fatura do cartão de crédito (1 a 31). Vazio = sem regra de fechamento
--
-- Trava de repasse confirmado (script 14): a única mudança é permitir também a coluna pago_em, que acompanha o pago
-- (já permitido) ao marcar a conta como paga/cobrada. Todo o resto da trava continua igual: nenhum outro campo de um
-- lançamento com repasse confirmado pode ser editado, e ele continua sem poder ser excluído.

begin;

alter table public.contas_fixas add column if not exists valor_variavel boolean not null default false;
alter table public.contas_fixas add column if not exists valor_confirmado boolean not null default true;
alter table public.contas_fixas add column if not exists pago_em date;
alter table public.contas_fixas add column if not exists encerrada_em text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contas_fixas_encerrada_em_formato') then
    alter table public.contas_fixas add constraint contas_fixas_encerrada_em_formato
      check (encerrada_em is null or encerrada_em ~ '^\d{4}-\d{2}$');
  end if;
end
$$;

alter table public.opcoes_pagamento add column if not exists dia_fechamento smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'opcoes_pagamento_dia_fechamento_faixa') then
    alter table public.opcoes_pagamento add constraint opcoes_pagamento_dia_fechamento_faixa
      check (dia_fechamento is null or dia_fechamento between 1 and 31);
  end if;
end
$$;

-- Mesma função do script 14, só com pago_em junto de pago.
create or replace function public.lancamento_trava_repasse_confirmado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if not coalesce(old.repasse_pago, false) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Este lançamento tem repasse confirmado. Estorne o repasse antes de excluir.'
      using errcode = '42501';
  end if;

  v_antes  := to_jsonb(old) - 'pago' - 'pago_em' - 'repasse_conta';
  v_depois := to_jsonb(new) - 'pago' - 'pago_em' - 'repasse_conta';

  if v_antes is distinct from v_depois
     or (old.repasse_conta is not null and new.repasse_conta is distinct from old.repasse_conta) then
    raise exception 'Este lançamento tem repasse confirmado. Estorne o repasse antes de editar.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.lancamento_trava_repasse_confirmado() from public, anon, authenticated;

commit;

-- Para desfazer (sem perder dados): alter table public.contas_fixas drop column valor_variavel, drop column
-- valor_confirmado, drop column pago_em, drop column encerrada_em; alter table public.opcoes_pagamento drop column
-- dia_fechamento; e recriar a função do script 14.
