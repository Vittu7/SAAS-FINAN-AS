-- Permissões de funções e search_path.
-- Não apaga nada: só retira EXECUTE de quem não deve chamar e fixa o search_path.
-- Pode ser rodado mais de uma vez.
--
-- Por que é seguro:
--   * adicionar_convidado e registrar_repasse_conta já exigem login (auth.uid()); o anon nunca teve uso legítimo.
--     O app chama as duas só com o usuário logado (role authenticated), que continua com EXECUTE.
--   * limpar_dados_ao_excluir_usuario e opcoes_pagamento_normaliza são funções de TRIGGER. O Postgres verifica
--     EXECUTE só ao criar o trigger, não quando ele dispara: os triggers continuam funcionando.
--   * O PUBLIC também é revogado porque anon e authenticated herdam dele.

-- 1) RPCs usadas pelo app: só usuário logado.
revoke execute on function public.adicionar_convidado(text, text) from public, anon;
grant  execute on function public.adicionar_convidado(text, text) to authenticated;

revoke execute on function public.registrar_repasse_conta(text, text[], text) from public, anon;
grant  execute on function public.registrar_repasse_conta(text, text[], text) to authenticated;

-- 2) Funções de trigger: ninguém chama pela API.
revoke execute on function public.limpar_dados_ao_excluir_usuario() from public, anon, authenticated;
revoke execute on function public.opcoes_pagamento_normaliza() from public, anon, authenticated;

-- 3) search_path fixo. O corpo não usa nenhuma tabela, então '' é suficiente.
alter function public.opcoes_pagamento_normaliza() set search_path = '';
