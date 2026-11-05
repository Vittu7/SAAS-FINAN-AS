-- P1: remove o sistema de grupo antigo (grupos, membros e suas funções). Autorizado em 2026-11-05.
--
-- O app usa grupos_familiares + perfis.grupo_id. Verificado no banco antes de rodar:
--   * grupos e membros com 0 linhas; nenhuma chave estrangeira de outra tabela aponta para elas; nenhuma view.
--   * criar_grupo, convidar_membro, aceitar_convites: nenhuma chamada no código de nenhuma branch nem em outra função.
--   * sou_dono: usada só por convidar_membro e pelas políticas de grupos/membros (que somem com as tabelas).
-- FICAM: membro_pertence, meus_grupos, meus_membros (usadas pelas políticas de extrato, cartao, contas_fixas, perfis).
--
-- Segurança: aborta se alguma tabela tiver linhas. Sem CASCADE: dependência inesperada faz o DROP falhar e a
-- migração inteira é desfeita.
-- Recuperação: supabase/arquivo/definicoes-anteriores.sql (bloco P1).

do $$
begin
  if exists (select 1 from public.grupos) or exists (select 1 from public.membros) then
    raise exception 'P1 abortada: grupos/membros têm dados. Nada foi removido.';
  end if;
end $$;

drop function public.convidar_membro(uuid, text, text);
drop function public.criar_grupo(text, text);
drop function public.aceitar_convites();
drop table public.membros;   -- leva junto as políticas membros_* e índices da própria tabela
drop table public.grupos;    -- leva junto as políticas grupos_*
drop function public.sou_dono(uuid);
