-- RASCUNHO DE MIGRACAO: revisar e testar em ambiente separado antes de executar.
-- Usa marcador persistente para identificar registros existentes no momento da migracao.
-- NAO usa data de corte: timestamps fixos podem deixar registros sem acesso ou mudar de classe com o tempo.
-- Esta migracao altera colunas e politicas SELECT. Nao executar em producao sem revisar todas as politicas.

begin;

-- Ao adicionar a coluna com DEFAULT true, linhas existentes recebem true.
-- Em seguida o DEFAULT passa a false para novos registros. Não reclassifica linhas
-- novas em reexecuções acidentais; revise, ainda assim, antes de executar.
alter table public.cartao
  add column if not exists legado_privacidade_v1 boolean not null default true;
alter table public.contas_fixas
  add column if not exists legado_privacidade_v1 boolean not null default true;
alter table public.extrato
  add column if not exists legado_privacidade_v1 boolean not null default true;

alter table public.cartao alter column legado_privacidade_v1 set default false;
alter table public.contas_fixas alter column legado_privacidade_v1 set default false;
alter table public.extrato alter column legado_privacidade_v1 set default false;

-- Remove as politicas SELECT permissivas conhecidas para evitar OR com regras antigas.
drop policy if exists "cartao_select" on public.cartao;
drop policy if exists "partilha seletiva segura" on public.cartao;
drop policy if exists "contas_fixas_select" on public.contas_fixas;
drop policy if exists "partilha seletiva segura" on public.contas_fixas;
drop policy if exists "extrato_select" on public.extrato;
drop policy if exists "partilha seletiva segura" on public.extrato;

create policy "cartao_select_privacidade_v1"
on public.cartao for select to authenticated
using (
  owner_id = auth.uid()
  or (
    legado_privacidade_v1 is true
    and privado is not true
    and (
      responsavel_id in (select public.meus_membros())
    )
  )
  or (
    legado_privacidade_v1 is false
    and privado is not true
    and grupo_id in (select public.meus_grupos())
    and (
      compartilhado_com = auth.uid()
      or compartilhado_com in (select id from public.perfis where user_id = auth.uid())
      or compartilhado_com = grupo_id
    )
  )
);

create policy "contas_fixas_select_privacidade_v1"
on public.contas_fixas for select to authenticated
using (
  owner_id = auth.uid()
  or (
    legado_privacidade_v1 is true
    and (
      responsavel_id in (select public.meus_membros())
    )
  )
  or (
    legado_privacidade_v1 is false
    and grupo_id in (select public.meus_grupos())
    and (
      compartilhado_com = auth.uid()
      or compartilhado_com in (select id from public.perfis where user_id = auth.uid())
      or compartilhado_com = grupo_id
    )
  )
);

create policy "extrato_select_privacidade_v1"
on public.extrato for select to authenticated
using (
  owner_id = auth.uid()
  or (
    legado_privacidade_v1 is true
    and privado is not true
    and (
      responsavel_id in (select public.meus_membros())
    )
  )
  or (
    legado_privacidade_v1 is false
    and privado is not true
    and grupo_id in (select public.meus_grupos())
    and (
      compartilhado_com = auth.uid()
      or compartilhado_com in (select id from public.perfis where user_id = auth.uid())
      or compartilhado_com = grupo_id
    )
  )
);

commit;

-- CHECKLIST OBRIGATORIO ANTES DE EXECUTAR:
-- 1. Liste TODAS as politicas SELECT das tres tabelas. Politicas permissivas combinam por OR.
--    Remova/revise qualquer politica adicional que possa reabrir acesso.
-- 2. Confirme os retornos de public.meus_membros() e public.meus_grupos().
-- 3. Confirme que o app grava compartilhado_com com o ID correto (perfil ou grupo).
-- 4. Teste com duas contas separadas: dono, privado, pessoa especifica, grupo e registro legado.
-- 5. Revise separadamente INSERT/UPDATE/DELETE e grants.
-- 6. O marcador classifica como legado tudo que existir quando a migracao rodar; confirme se isso e desejado.
