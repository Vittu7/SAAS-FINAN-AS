"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Opcao {
  id: string;
  nome: string;
  cor: string;
}

export const COR_PADRAO = "#64748B";

// Carrega as listas compartilhadas do grupo (as mesmas para Extrato, Contas Parceladas e Contas Fixas)
export function useOpcoes() {
  const [pagamento, setPagamento] = useState<Opcao[]>([]);
  const [categoria, setCategoria] = useState<Opcao[]>([]);

  const recarregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil?.grupo_id) return;

    const [resPagamento, resCategoria] = await Promise.all([
      supabase.from("opcoes_pagamento").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
      supabase.from("opcoes_categoria").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
    ]);

    if (resPagamento.error) console.error("Erro ao carregar formas de pagamento:", resPagamento.error);
    if (resCategoria.error) console.error("Erro ao carregar categorias:", resCategoria.error);

    if (resPagamento.data) setPagamento(resPagamento.data);
    if (resCategoria.data) setCategoria(resCategoria.data);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const corPagamento = (nome?: string | null) =>
    pagamento.find((o) => o.nome === nome)?.cor ?? COR_PADRAO;

  const corCategoria = (nome?: string | null) =>
    categoria.find((o) => o.nome === nome)?.cor ?? COR_PADRAO;

  return { pagamento, categoria, recarregar, corPagamento, corCategoria };
}
