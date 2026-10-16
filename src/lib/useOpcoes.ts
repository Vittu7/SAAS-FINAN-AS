"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Opcao {
  id: string;
  nome: string;
  cor: string;
  eh_cartao?: boolean | null;
  limite?: number | null;
}

export const COR_PADRAO = "#64748B";

// Carrega e gere as listas compartilhadas do grupo (para Extrato, Contas Parceladas e Contas Fixas)
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
    // Recarrega quando categorias/formas de pagamento mudam pelo menu lateral
    window.addEventListener("homecash:opcoes", recarregar);
    return () => window.removeEventListener("homecash:opcoes", recarregar);
  }, [recarregar]);

  // ADICIONAR FORMA DE PAGAMENTO OU CARTÃO DE CRÉDITO
  const adicionarPagamento = async (
    nome: string,
    opcoesExtra?: { isCartaoCredito?: boolean; limiteTotal?: number }
  ) => {
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

    const { error } = await supabase.from("opcoes_pagamento").insert([
      {
        nome,
        grupo_id: perfil.grupo_id,
        cor: COR_PADRAO,
        eh_cartao: opcoesExtra?.isCartaoCredito ?? false,
        limite: opcoesExtra?.limiteTotal ?? 0,
      },
    ]);

    if (error) {
      console.error("Erro ao adicionar forma de pagamento:", error);
    } else {
      await recarregar();
      window.dispatchEvent(new Event("homecash:opcoes"));
    }
  };

  // REMOVER FORMA DE PAGAMENTO / CARTÃO
  const removerPagamento = async (idOrNome: string) => {
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

    let query = supabase.from("opcoes_pagamento").delete().eq("grupo_id", perfil.grupo_id);

    // Identifica se é um UUID ou o nome do registo
    if (idOrNome.includes("-") || !isNaN(Number(idOrNome))) {
      query = query.eq("id", idOrNome);
    } else {
      query = query.eq("nome", idOrNome);
    }

    const { error } = await query;
    if (error) {
      console.error("Erro ao remover forma de pagamento:", error);
    } else {
      await recarregar();
      window.dispatchEvent(new Event("homecash:opcoes"));
    }
  };

  // ADICIONAR CATEGORIA
  const adicionarCategoria = async (nome: string) => {
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

    const { error } = await supabase.from("opcoes_categoria").insert([
      {
        nome,
        grupo_id: perfil.grupo_id,
        cor: COR_PADRAO,
      },
    ]);

    if (error) {
      console.error("Erro ao adicionar categoria:", error);
    } else {
      await recarregar();
      window.dispatchEvent(new Event("homecash:opcoes"));
    }
  };

  // REMOVER CATEGORIA
  const removerCategoria = async (idOrNome: string) => {
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

    let query = supabase.from("opcoes_categoria").delete().eq("grupo_id", perfil.grupo_id);

    if (idOrNome.includes("-") || !isNaN(Number(idOrNome))) {
      query = query.eq("id", idOrNome);
    } else {
      query = query.eq("nome", idOrNome);
    }

    const { error } = await query;
    if (error) {
      console.error("Erro ao remover categoria:", error);
    } else {
      await recarregar();
      window.dispatchEvent(new Event("homecash:opcoes"));
    }
  };

  const corPagamento = (nome?: string | null) =>
    pagamento.find((o) => o.nome === nome)?.cor ?? COR_PADRAO;

  const corCategoria = (nome?: string | null) =>
    categoria.find((o) => o.nome === nome)?.cor ?? COR_PADRAO;

  return {
    pagamento,
    categoria,
    recarregar,
    adicionarPagamento,
    removerPagamento,
    adicionarCategoria,
    removerCategoria,
    corPagamento,
    corCategoria,
  };
}