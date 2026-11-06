"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstadoFechamento, EventoFechamento, FechadosPorPessoa, Retrato } from "@/lib/fechamento";

/** Disparado após fechar/reabrir, para as telas da mesma página recarregarem. */
export const EVENTO_FECHAMENTO = "homecash:fechamento";

const faltaTabela = (e: { code?: string; message?: string } | null) =>
  Boolean(e) && (e!.code === "42P01" || e!.code === "PGRST205" || e!.code === "PGRST202" || e!.code === "42883" || /fechamento_/.test(e!.message || ""));

/**
 * Interruptor do módulo. Com `false` o fechamento mensal fica oculto para todos: nenhuma consulta às tabelas
 * `fechamento_*` e nenhum RPC é feito, e a interface não mostra faixa, seletor de meses nem conferência.
 * Troque para `true` quando a migração supabase-18 estiver aplicada e o recurso estiver pronto.
 */
export const FECHAMENTO_ATIVO = false;

export type MesFechado = { mes: string; fechadoEm: string | null; retrato: Retrato | null };

/**
 * Fechamento mensal do usuário e dos membros do grupo (só a situação dos meses, para saber o que está travado).
 * Enquanto a migração supabase-18 não for aplicada, `habilitado = false` e o app segue funcionando como antes.
 * As regras ficam em lib/fechamento.ts; a garantia definitiva está nas travas do banco.
 */
export function useFechamentos(userId: string | null) {
  const [habilitado, setHabilitado] = useState<boolean | null>(null);
  const [mesInicial, setMesInicial] = useState<string | null>(null);
  const [meus, setMeus] = useState<MesFechado[]>([]);
  const [porPessoa, setPorPessoa] = useState<FechadosPorPessoa>(new Map());
  const [eventos, setEventos] = useState<EventoFechamento[]>([]);
  /** Já tentou carregar ao menos uma vez (antes disso o app não gera contas fixas nem decide travas) */
  const [pronto, setPronto] = useState(false);

  const carregar = useCallback(async () => {
    if (!FECHAMENTO_ATIVO) {
      setHabilitado(false);
      setPronto(true);
      return;
    }
    if (!userId) return;
    const c = await supabase.from("fechamento_controle").select("mes_inicial").eq("user_id", userId).maybeSingle();
    if (c.error) {
      setHabilitado(faltaTabela(c.error) ? false : null);
      setPronto(true);
      return;
    }
    setHabilitado(true);
    setMesInicial(c.data?.mes_inicial ?? null);
    const [m, ev] = await Promise.all([
      supabase.from("fechamento_meses").select("user_id, mes, status, fechado_em, retrato"),
      supabase.from("fechamento_eventos").select("mes, tipo, em, por, motivo").eq("user_id", userId).order("em", { ascending: true }),
    ]);
    const mapa: FechadosPorPessoa = new Map();
    const minhas: MesFechado[] = [];
    for (const l of (m.data || []) as { user_id: string; mes: string; status: string; fechado_em: string | null; retrato: Retrato | null }[]) {
      if (l.status !== "fechado") continue;
      const pessoa = String(l.user_id);
      if (!mapa.has(pessoa)) mapa.set(pessoa, new Set());
      mapa.get(pessoa)!.add(String(l.mes));
      if (pessoa === userId) minhas.push({ mes: String(l.mes), fechadoEm: l.fechado_em ?? null, retrato: (l.retrato as Retrato) ?? null });
    }
    setPorPessoa(mapa);
    setMeus(minhas);
    setEventos(((ev.data || []) as { mes: string; tipo: EventoFechamento["tipo"]; em: string; por: string | null; motivo: string | null }[]).map((e) => ({ mes: String(e.mes), tipo: e.tipo, em: String(e.em), por: e.por ?? null, motivo: e.motivo ?? null })));
    setPronto(true);
  }, [userId]);

  useEffect(() => {
    void Promise.resolve().then(carregar);
    const aoMudar = () => void carregar();
    window.addEventListener(EVENTO_FECHAMENTO, aoMudar);
    return () => window.removeEventListener(EVENTO_FECHAMENTO, aoMudar);
  }, [carregar]);

  const estado: EstadoFechamento = useMemo(() => ({ mesInicial, fechados: new Set(meus.map((x) => x.mes)) }), [mesInicial, meus]);

  /** Chama uma função do banco e devolve `null` (sucesso) ou a mensagem de erro do banco. */
  const chamar = useCallback(async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
    if (!FECHAMENTO_ATIVO) return "O fechamento mensal está temporariamente indisponível.";
    const { error } = await supabase.rpc(fn, args);
    if (error) return faltaTabela(error) ? "O fechamento mensal ainda não foi habilitado no banco (migração supabase-18)." : error.message;
    window.dispatchEvent(new Event(EVENTO_FECHAMENTO));
    return null;
  }, []);

  const iniciar = useCallback((mes: string) => chamar("iniciar_fechamento_mensal", { p_mes: mes }), [chamar]);
  const fechar = useCallback((mes: string, retrato: Retrato) => chamar("fechar_mes", { p_mes: mes, p_retrato: retrato }), [chamar]);
  const reabrir = useCallback((mes: string, motivo: string) => chamar("reabrir_mes", { p_mes: mes, p_motivo: motivo.trim() }), [chamar]);

  return { pronto, habilitado: habilitado === true, estado, meus, porPessoa, eventos, iniciar, fechar, reabrir, recarregar: carregar };
}
