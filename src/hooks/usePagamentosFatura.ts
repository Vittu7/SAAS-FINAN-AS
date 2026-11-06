"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PagamentoFatura } from "@/lib/pagamentoFatura";

/** Disparado após registrar um pagamento, para todas as telas na mesma página recarregarem. */
export const EVENTO_PAGAMENTOS_FATURA = "homecash:pagamentos-fatura";

const faltaTabela = (e: { code?: string; message?: string } | null) =>
  Boolean(e) && (e!.code === "42P01" || e!.code === "PGRST205" || /pagamentos_fatura/.test(e!.message || ""));

/**
 * Pagamentos de fatura do usuário (só os dele: a tabela é privada por RLS).
 * Se a tabela ainda não existe (script supabase-08 não rodado), devolve lista vazia e `disponivel = false`.
 */
export function usePagamentosFatura() {
  const [pagamentos, setPagamentos] = useState<PagamentoFatura[]>([]);
  const [disponivel, setDisponivel] = useState(true);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Pagamentos estornados não contam (coluna estornado_em: script supabase-24). Sem a coluna, vale a lista inteira.
    let { data, error } = await supabase
      .from("pagamentos_fatura")
      .select("id, cartao, mes, conta, valor, data")
      .eq("user_id", user.id)
      .is("estornado_em", null)
      .order("data", { ascending: true });
    if (error && (error.code === "42703" || /estornado_em/.test(error.message || ""))) {
      ({ data, error } = await supabase.from("pagamentos_fatura").select("id, cartao, mes, conta, valor, data").eq("user_id", user.id).order("data", { ascending: true }));
    }
    if (error) {
      setPagamentos([]);
      setDisponivel(!faltaTabela(error));
      return;
    }
    setDisponivel(true);
    setPagamentos((data || []).map((l: any) => ({ id: String(l.id), cartao: String(l.cartao), mes: String(l.mes), conta: String(l.conta), valor: Number(l.valor) || 0, data: String(l.data ?? "").slice(0, 10) })));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(carregar);
    const aoMudar = () => void carregar();
    window.addEventListener(EVENTO_PAGAMENTOS_FATURA, aoMudar);
    return () => window.removeEventListener(EVENTO_PAGAMENTOS_FATURA, aoMudar);
  }, [carregar]);

  /** Devolve `null` em caso de sucesso ou a mensagem de erro. O `id` vem do formulário: reenviar não duplica. */
  const registrar = useCallback(async (p: PagamentoFatura): Promise<string | null> => {
    const { error } = await supabase.from("pagamentos_fatura").insert({ id: p.id, cartao: p.cartao, mes: p.mes, conta: p.conta, valor: p.valor, data: p.data });
    if (error) {
      if (error.code === "23505") return "Este pagamento já foi registrado.";
      if (faltaTabela(error)) return "O pagamento de fatura ainda não foi habilitado. Rode o script supabase-08-pagamentos-fatura.sql no Supabase.";
      return error.message;
    }
    window.dispatchEvent(new Event(EVENTO_PAGAMENTOS_FATURA));
    return null;
  }, []);

  /**
   * Estorna um pagamento: ele não é apagado, só deixa de valer. A atualização é condicional (só se ainda não foi estornado),
   * então clicar duas vezes ou estornar em duas telas nunca devolve o valor duas vezes. Devolve null ou a mensagem de erro.
   */
  const estornar = useCallback(async (id: string): Promise<string | null> => {
    const { data, error } = await supabase.from("pagamentos_fatura").update({ estornado_em: new Date().toISOString() }).eq("id", id).is("estornado_em", null).select("id");
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204" || /estornado_em/.test(error.message || "")) return "O estorno ainda não foi habilitado. Rode o script supabase-24-estorno-pagamento-fatura.sql no Supabase.";
      return error.message;
    }
    if (!data || data.length === 0) return "Este pagamento já foi estornado ou não existe.";
    window.dispatchEvent(new Event(EVENTO_PAGAMENTOS_FATURA));
    return null;
  }, []);

  return { pagamentos, disponivel, registrar, estornar };
}
