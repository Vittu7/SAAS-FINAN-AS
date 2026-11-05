-- P3: remove funções órfãs. Autorizado em 2026-11-05.
--
-- Verificado no banco antes de rodar (nenhuma é chamada pelo código de nenhuma branch, por outra função,
-- por política ou por trigger):
--   * criar_formas_pagamento_padrao(uuid): só repassava para criar_opcoes_padrao() (que FICA).
--   * entrar_grupo_familiar(uuid): sem EXECUTE para o app; substituída por entrar_grupo_por_convite.
--   * cria_perfil_automatico(): função de trigger sem trigger; on_auth_user_created usa handle_new_user.
--
-- Segurança: aborta se cria_perfil_automatico estiver ligada a algum trigger. Sem CASCADE.
-- Recuperação: supabase/arquivo/definicoes-anteriores.sql (bloco P3).

do $$
begin
  if exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
             where p.proname = 'cria_perfil_automatico' and p.pronamespace = 'public'::regnamespace) then
    raise exception 'P3 abortada: cria_perfil_automatico está em uso por um trigger. Nada foi removido.';
  end if;
end $$;

drop function public.criar_formas_pagamento_padrao(uuid);
drop function public.entrar_grupo_familiar(uuid);
drop function public.cria_perfil_automatico();
