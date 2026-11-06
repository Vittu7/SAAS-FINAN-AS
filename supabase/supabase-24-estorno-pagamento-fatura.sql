-- Estorno de pagamento de fatura ("Estornar pagamento").
--
-- O pagamento NÃO é apagado: ganha a data do estorno (estornado_em). O app deixa de considerar os pagamentos estornados,
-- então a fatura volta a ficar aberta, o valor volta ao saldo da conta usada e o Disponível é recalculado. As compras e
-- os lançamentos originais não são tocados.
--
-- Só ADICIONA uma coluna opcional e uma trava. Nenhuma linha existente é alterada (estornado_em fica vazio = pagamento
-- válido, como hoje). Pode ser rodado mais de uma vez.
--
-- Trava (só para quem usa a API: anon/authenticated):
--   * o único campo que pode mudar num pagamento é estornado_em, de vazio para uma data;
--   * um pagamento já estornado não muda mais (não existe "estornar duas vezes" nem "reabrir" o estorno);
--   * qualquer outra edição do pagamento é recusada.
-- Mês fechado: a trava movimento_trava_mes_fechado (script 18) continua valendo, pela data do pagamento. Estornar o
-- pagamento de um mês fechado exige reabrir o mês antes.
--
-- Para desfazer: drop trigger pagamento_fatura_so_estorna on public.pagamentos_fatura;
--   alter table public.pagamentos_fatura drop column estornado_em;  (só se nenhum pagamento tiver sido estornado)

begin;

alter table public.pagamentos_fatura add column if not exists estornado_em timestamptz;

create or replace function public.pagamento_fatura_so_estorna()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if old.estornado_em is not null then
    raise exception 'Este pagamento já foi estornado.' using errcode = '42501';
  end if;

  if (to_jsonb(new) - 'estornado_em') is distinct from (to_jsonb(old) - 'estornado_em') then
    raise exception 'Um pagamento de fatura não pode ser editado. Use "Estornar pagamento".' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.pagamento_fatura_so_estorna() from public, anon, authenticated;

create or replace trigger pagamento_fatura_so_estorna
  before update on public.pagamentos_fatura
  for each row execute function public.pagamento_fatura_so_estorna();

commit;
