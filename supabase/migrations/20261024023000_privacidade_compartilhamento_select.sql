-- RASCUNHO DE MIGRACAO: revisar no Supabase antes de executar.
-- Data de corte alinhada ao filtro de interface: 2026-10-24 02:30:00 UTC.
-- Preserva acesso legado antes do corte; exige compartilhamento explicito para registros novos.
-- Esta migracao altera SOMENTE politicas SELECT. Nao executa grants nem muda INSERT/UPDATE/DELETE.

begin;

-- Remove as politicas SELECT permissivas conhecidas para evitar que OR entre politicas
-- antigas continue liberando acesso por fora da regra nova.
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
    created_at < timestamptz '2026-10-24 02:30:00+00'
    and (
      responsavel_id in (select public.meus_membros())
      or grupo_id in (select public.meus_grupos())
    )
  )
  or (
    created_at >= timestamptz '2026-10-24 02:30:00+00'
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
    created_at < timestamptz '2026-10-24 02:30:00+00'
    and (
      responsavel_id in (select public.meus_membros())
      or grupo_id in (select public.meus_grupos())
    )
  )
  or (
    created_at >= timestamptz '2026-10-24 02:30:00+00'
    and grupo_id in (select public.meus_grupos())
    and (
      compartilhado_com = auth.uid()
      or compartilhado_com = grupo_id
    )
  )
);

create policy "extrato_select_privacidade_v1"
on public.extrato for select to authenticated
using (
  owner_id = auth.uid()
  or (
    created_at < timestamptz '2026-10-24 02:30:00+00'
    and (
      responsavel_id in (select public.meus_membros())
      or grupo_id in (select public.meus_grupos())
    )
  )
  or (
    created_at >= timestamptz '2026-10-24 02:30:00+00'
    and privado is not true
    and grupo_id in (select public.meus_grupos())
    and (
      compartilhado_com = auth.uid()
      or compartilhado_com = grupo_id
    )
  )
);

commit;

-- ANTES DE EXECUTAR:
-- 1. Confirme no SQL Editor os nomes de TODAS as politicas SELECT destas tabelas.
--    Qualquer outra politica permissiva SELECT pode somar permissao por OR.
-- 2. Confirme tipos/retornos de meus_membros() e meus_grupos().
-- 3. Revise se o app cria registros com created_at preenchido pelo banco.
-- 4. Teste com duas contas de usuarios diferentes: privado, pessoa especifica, grupo e registro legado.
-- 5. Audite grants para anon/authenticated e as politicas INSERT/UPDATE/DELETE separadamente.
