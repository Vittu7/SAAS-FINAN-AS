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

    const { data: perfil, error: erroPerfil } = await supabase
      .from("perfis")
      .select("grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (erroPerfil) {
      console.error("Erro ao carregar perfil:", erroPerfil);
      return;
    }

    if (!perfil?.grupo_id) {
      setPagamento([]);
      setCategoria([]);
      return;
    }

    /*
     * Esta função foi criada na migration SQL.
     * É idempotente: pode ser chamada quantas vezes quiser sem duplicar
     * Débito, Pix e Dinheiro.
     */
    const { error: erroPadroes } = await supabase.rpc(
      "criar_formas_pagamento_padrao",
      { p_grupo_id: perfil.grupo_id },
    );

    if (erroPadroes) {
      console.error(
        "Erro ao garantir formas de pagamento padrão:",
        erroPadroes,
      );
    }

    const [resPagamento, resCategoria] = await Promise.all([
      supabase
        .from("opcoes_pagamento")
        .select("*")
        .eq("grupo_id", perfil.grupo_id)
        .order("nome"),

      supabase
        .from("opcoes_categoria")
        .select("*")
        .eq("grupo_id", perfil.grupo_id)
        .order("nome"),
    ]);

    if (resPagamento.error) {
      console.error(
        "Erro ao carregar formas de pagamento:",
        resPagamento.error,
      );
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

  const obterGrupoAtual = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Faça login antes de alterar os cadastros.");
    }

    const { data: perfil, error } = await supabase
      .from("perfis")
      .select("grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!perfil?.grupo_id) {
      throw new Error("Crie ou entre em um grupo antes de cadastrar opções.");
    }

    return perfil.grupo_id as string;
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

    const grupoId = await obterGrupoAtual();

    const { error } = await supabase.from("opcoes_pagamento").insert({
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

    const { error } = await supabase
      .from("opcoes_pagamento")
      .update(dados)
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma forma de pagamento com esse nome.");
      }

      throw error;
    }

    await notificarAtualizacao();
  };

  const removerPagamento = async (id: string) => {
    const { error } = await supabase
      .from("opcoes_pagamento")
      .delete()
      .eq("id", id);

    if (error) throw error;

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

    const grupoId = await obterGrupoAtual();

    const { error } = await supabase.from("opcoes_categoria").insert({
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

    const { error } = await supabase
      .from("opcoes_categoria")
      .update(dados)
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe uma categoria com esse nome.");
      }

      throw error;
    }

    await notificarAtualizacao();
  };

  const removerCategoria = async (id: string) => {
    const { error } = await supabase
      .from("opcoes_categoria")
      .delete()
      .eq("id", id);

    if (error) throw error;

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