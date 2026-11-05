-- P2: remove as caixinhas antigas (caixinhas_investimento, movimentacoes_caixinha). Autorizado em 2026-11-05.
--
-- O app usa caixinhas + caixinha_movimentos (trigger caixinha_movimentos_saldo), que FICAM, assim como
-- aportes_investimento. Verificado no banco antes de rodar:
--   * as duas tabelas com 0 linhas; nenhuma chave estrangeira de fora; nenhuma view.
--   * registrar_movimentacao_caixinha: nenhuma chamada no código de nenhuma branch nem em outra função.
--     Ela devolve o tipo da tabela movimentacoes_caixinha, por isso sai primeiro.
--
-- Segurança: aborta se alguma tabela tiver linhas. Sem CASCADE.
-- Recuperação: supabase/arquivo/definicoes-anteriores.sql (bloco P2).

do $$
begin
  if exists (select 1 from public.caixinhas_investimento) or exists (select 1 from public.movimentacoes_caixinha) then
    raise exception 'P2 abortada: caixinhas antigas têm dados. Nada foi removido.';
  end if;
end $$;

drop function public.registrar_movimentacao_caixinha(uuid, text, numeric, date, text);
drop table public.movimentacoes_caixinha;   -- referencia caixinhas_investimento: sai antes
drop table public.caixinhas_investimento;
