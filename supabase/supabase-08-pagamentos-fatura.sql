-- Pagamento de fatura do cartão de crédito.
-- Só ADICIONA: uma tabela nova (com RLS própria, só o dono enxerga/altera) e uma coluna opcional.
-- Não altera nem apaga dados, políticas ou funções existentes. Pode ser rodado mais de uma vez.

create table if not exists public.pagamentos_fatura (
  -- gerado no formulário: reenviar o mesmo pagamento não grava duas vezes (chave primária)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao text not null,                                  -- nome do cartão de crédito (forma de pagamento)
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),       -- mês da fatura paga (AAAA-MM)
  conta text not null,                                   -- conta de débito de onde saiu o dinheiro
  valor numeric(12, 2) not null check (valor > 0),
  data date not null default current_date,               -- data do pagamento
  created_at timestamptz not null default now()
);

create index if not exists pagamentos_fatura_user_idx on public.pagamentos_fatura (user_id, cartao, mes);

alter table public.pagamentos_fatura enable row level security;

-- Sem este GRANT a API responde 403 mesmo com a política abaixo; a RLS limita cada usuário às próprias linhas.
grant select, insert, update, delete on table public.pagamentos_fatura to authenticated;

drop policy if exists pagamentos_fatura_dono on public.pagamentos_fatura;
create policy pagamentos_fatura_dono on public.pagamentos_fatura
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Dia do vencimento da fatura (opcional, 1 a 31), mostrado na tela de faturas.
alter table public.opcoes_pagamento add column if not exists dia_vencimento smallint
  check (dia_vencimento is null or dia_vencimento between 1 and 31);
