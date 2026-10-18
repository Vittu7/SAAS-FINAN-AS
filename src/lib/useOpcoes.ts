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

type DadosPagamento = {
  isCartaoCredito?: boolean;
  limiteTotal?: number;
  cor?: string;
};

export const COR_PADRAO = "#64748B";

function normalizarNome(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

export function useOpcoes() {
  const [pagamento, setPagamento] = useState<Opcao[]>([]);
  const [categoria, setCategoria] = useState<Opcao[]>([]);

  const recarregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    /*
     * Cadastros são privados: cada usuário só enxerga e gerencia os seus
     * (a regra também é imposta pelo RLS no banco — ver migração 02).
     * A função cria Débito, Pix, Dinheiro e categorias genéricas uma única
     * vez por usuário; não recria o que ele apagar nem duplica nada.
     */
    const { error: erroPadroes } = await supabase.rpc("criar_opcoes_padrao");

    if (erroPadroes) {
      console.error("Erro ao garantir cadastros padrão:", erroPadroes);
    }

    const [resPagamento, resCategoria] = await Promise.all([
      supabase
        .from("opcoes_pagamento")
        .select("*")
        .eq("user_id", user.id)
        .order("nome"),

      supabase
        .from("opcoes_categoria")
        .select("*")
        .eq("user_id", user.id)
        .order("nome"),
    ]);

    if (resPagamento.error) {
      console.error("Erro ao carregar formas de pagamento:", resPagamento.error);
    } else {
      setPagamento((resPagamento.data || []) as Opcao[]);
    }

    if (resCategoria.error) {
      console.error("Erro ao carregar categorias:", resCategoria.error);
    } else {
      setCategoria((resCategoria.data || []) as Opcao[]);
    }
  }, []);

  useEffect(() => {
    void recarregar();

    window.addEventListener("homecash:opcoes", recarregar);

    return () => {
      window.removeEventListener("homecash:opcoes", recarregar);
    };
  }, [recarregar]);

  const obterContexto = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Faça login antes de alterar os cadastros.");
    }

    // O grupo é só informativo; o dono do cadastro é sempre o usuário logado.
    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return { userId: user.id, grupoId: (perfil?.grupo_id as string | null) ?? null };
  };

  const notificarAtualizacao = async () => {
    await recarregar();
    window.dispatchEvent(new Event("homecash:opcoes"));
  };

  const adicionarPagamento = async (
    nomeOriginal: string,
    dados: DadosPagamento = {},
  ) => {
    const nome = normalizarNome(nomeOriginal);

    if (!nome) {
      throw new Error("Informe o nome da forma de pagamento.");
    }

    const { userId, grupoId } = await obterContexto();

    const { error } = await supabase.from("opcoes_pagamento").insert({
      user_id: userId,
      grupo_id: grupoId,
      nome,
      cor: dados.cor || COR_PADRAO,
      eh_cartao: Boolean(dados.isCartaoCredito),
      limite: dados.isCartaoCredito
        ? Math.max(0, Number(dados.limiteTotal || 0))
        : 0,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma forma de pagamento com esse nome.");
      }

      throw error;
    }

    await notificarAtualizacao();
  };

  const atualizarPagamento = async (
    id: string,
    patch: Partial<Pick<Opcao, "nome" | "cor" | "eh_cartao" | "limite">>,
  ) => {
    const dados: Record<string, unknown> = { ...patch };

    if (typeof dados.nome === "string") {
      dados.nome = normalizarNome(dados.nome);

      if (!dados.nome) {
        throw new Error("O nome não pode ficar vazio.");
      }
    }

    if (dados.limite !== undefined) {
      dados.limite = Math.max(0, Number(dados.limite || 0));
    }

    const { data, error } = await supabase
      .from("opcoes_pagamento")
      .update(dados)
      .eq("id", id)
      .select("id");

    if (!error && (!data || data.length === 0)) {
      throw new Error("Não foi possível alterar: este cadastro pertence a outro usuário.");
    }

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma forma de pagamento com esse nome.");
      }

      throw error;
    }

    await notificarAtualizacao();
  };

  const removerPagamento = async (id: string) => {
    const { data, error } = await supabase
      .from("opcoes_pagamento")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error("Não foi possível excluir: este cadastro pertence a outro usuário.");
    }

    await notificarAtualizacao();
  };

  const adicionarCategoria = async (
    nomeOriginal: string,
    cor = COR_PADRAO,
  ) => {
    const nome = normalizarNome(nomeOriginal);

    if (!nome) {
      throw new Error("Informe o nome da categoria.");
    }

    const { userId, grupoId } = await obterContexto();

    const { error } = await supabase.from("opcoes_categoria").insert({
      user_id: userId,
      grupo_id: grupoId,
      nome,
      cor,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma categoria com esse nome.");
      }

      throw error;
    }

    await notificarAtualizacao();
  };

  const atualizarCategoria = async (
    id: string,
    patch: Partial<Pick<Opcao, "nome" | "cor">>,
  ) => {
    const dados: Record<string, unknown> = { ...patch };

    if (typeof dados.nome === "string") {
      dados.nome = normalizarNome(dados.nome);

      if (!dados.nome) {
        throw new Error("O nome não pode ficar vazio.");
      }
    }

    const { data, error } = await supabase
      .from("opcoes_categoria")
      .update(dados)
      .eq("id", id)
      .select("id");

    if (!error && (!data || data.length === 0)) {
      throw new Error("Não foi possível alterar: este cadastro pertence a outro usuário.");
    }

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma categoria com esse nome.");
      }

      throw error;
    }

    await notificarAtualizacao();
  };

  const removerCategoria = async (id: string) => {
    const { data, error } = await supabase
      .from("opcoes_categoria")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error("Não foi possível excluir: este cadastro pertence a outro usuário.");
    }

    await notificarAtualizacao();
  };

  const corPagamento = (nome?: string | null) =>
    pagamento.find((item) => item.nome === nome)?.cor ?? COR_PADRAO;

  const corCategoria = (nome?: string | null) =>
    categoria.find((item) => item.nome === nome)?.cor ?? COR_PADRAO;

  return {
    pagamento,
    categoria,
    recarregar,

    adicionarPagamento,
    atualizarPagamento,
    removerPagamento,

    adicionarCategoria,
    atualizarCategoria,
    removerCategoria,

    corPagamento,
    corCategoria,
  };
}