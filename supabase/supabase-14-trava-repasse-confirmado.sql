-- D2 / Regra 3: lançamento com repasse confirmado não pode ser editado nem excluído até o estorno.
--
-- Antes a regra só existia na intenção: pela API o dono ainda editava ou apagava a linha com repasse_pago = true,
-- mudando o saldo de quem repassou (terceiro).
--
-- Fluxo do repasse (não muda):
--   informar / desinformar  -> responsável, pela função atualizar_repasse (+ registrar_repasse_conta)
--   concluir (confirmação)  -> dono, pela função atualizar_repasse; depois o app grava repasse_conta (conta que recebeu)
--   reabrir (estorno)       -> dono, pela função atualizar_repasse; depois o app limpa repasse_conta/repasse_conta_origem
--
-- O trigger só atua em alterações feitas DIRETO pela API (papéis anon/authenticated) em linha com repasse_pago = true:
--   * DELETE: recusado.
--   * UPDATE: recusado, exceto
--       - repasse_conta de vazio para preenchido (último passo do "concluir");
--       - pago (só em contas_fixas: status de pagamento da conta, não altera o lançamento nem o repasse).
-- Funções SECURITY DEFINER (atualizar_repasse, excluir_minha_conta, excluir_grupo_familiar, trigger de exclusão de
-- usuário) rodam como postgres e não passam pela trava. Depois do estorno, repasse_pago = false e tudo volta ao normal.
--
-- Não altera dados. Pode ser rodado mais de uma vez.
-- Para desfazer: drop trigger lancamento_trava_repasse_confirmado on public.extrato; (idem cartao e contas_fixas)

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

  v_antes  := to_jsonb(old) - 'pago' - 'repasse_conta';
  v_depois := to_jsonb(new) - 'pago' - 'repasse_conta';

  if v_antes is distinct from v_depois
     or (old.repasse_conta is not null and new.repasse_conta is distinct from old.repasse_conta) then
    raise exception 'Este lançamento tem repasse confirmado. Estorne o repasse antes de editar.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.lancamento_trava_repasse_confirmado() from public, anon, authenticated;

create or replace trigger lancamento_trava_repasse_confirmado
  before update or delete on public.extrato
  for each row execute function public.lancamento_trava_repasse_confirmado();

create or replace trigger lancamento_trava_repasse_confirmado
  before update or delete on public.cartao
  for each row execute function public.lancamento_trava_repasse_confirmado();

create or replace trigger lancamento_trava_repasse_confirmado
  before update or delete on public.contas_fixas
  for each row execute function public.lancamento_trava_repasse_confirmado();
