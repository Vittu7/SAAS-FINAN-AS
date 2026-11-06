-- Remove objetos antigos sem uso (P1 + P2 + P3 de docs/propostas-supabase.md).
--
-- Dependências reconferidas em 2026-11-05 no banco ao vivo:
--   * nenhuma função, trigger ou política fora deste conjunto usa estes objetos
--     (sou_dono só é usada por convidar_membro e pelas políticas de grupos/membros, que saem junto);
--   * grupos, membros, caixinhas_investimento e movimentacoes_caixinha têm 0 linhas, sem views;
--   * código atual não chama nenhuma das funções.
-- Definições salvas em supabase/arquivo/definicoes-anteriores.sql (recriar = rodar de lá).
--
-- Fora deste script, de propósito: tabelas de backup (P4), políticas sobrepostas (P5) e aportes_investimento.
-- Roda numa transação: qualquer erro desfaz tudo.

begin;
-- P1: grupo antigo
drop function public.convidar_membro(uuid, text, text);
drop function public.criar_grupo(text, text);
drop function public.aceitar_convites();
drop table public.membros;
drop table public.grupos;
drop function public.sou_dono(uuid);
-- P2: caixinhas antigas
drop function public.registrar_movimentacao_caixinha(uuid, text, numeric, date, text);
drop table public.movimentacoes_caixinha;
drop table public.caixinhas_investimento;
-- P3: funções órfãs
drop function public.criar_formas_pagamento_padrao(uuid);
drop function public.entrar_grupo_familiar(uuid);
drop function public.cria_perfil_automatico();
commit;
