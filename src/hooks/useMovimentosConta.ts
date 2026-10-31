"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EVENTO_CAIXINHAS } from "@/hooks/useCaixinhas";
import type { MovCaixinhaConta } from "@/lib/contas";

/**
 * Aportes e resgates de caixinha que usaram uma conta de débito. Alimenta o saldo das contas
 * (calcularSaldoConta) e recarrega sozinho quando algo muda nas caixinhas.
 * Se a coluna `conta` ainda não existe (script supabase-07 não rodado), devolve lista vazia.
 */
export function useMovimentosConta(): MovCaixinhaConta[] {
  const [movs, setMovs] = useState<MovCaixinhaConta[]>([]);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("caixinha_movimentos")
      .select("tipo, valor, conta, data")
      .eq("user_id", user.id)
      .not("conta", "is", null)
      .neq("conta", "");
    if (error) return setMovs([]);
    setMovs((data || []).map((l: any) => ({ tipo: String(l.tipo), valor: Number(l.valor) || 0, conta: String(l.conta), data: String(l.data ?? "").slice(0, 10) })));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(carregar);
    const aoMudar = () => void carregar();
    window.addEventListener(EVENTO_CAIXINHAS, aoMudar);
    return () => window.removeEventListener(EVENTO_CAIXINHAS, aoMudar);
  }, [carregar]);

  return movs;
}
