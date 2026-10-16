"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Opcao {
  id: string;
  nome: string;
  cor: string;
  eh_cartao?: boolean | null;
  limite?: number | null;
}

export default function GerenciarOpcoesModal({
  tipo,
  onClose,
  onAtualizar,
}: {
  tipo: "pagamento" | "categoria" | "cartao";
  onClose: () => void;
  onAtualizar: () => void;
}) {
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(
    tipo === "pagamento" ? "#10B981" : tipo === "cartao" ? "#3B82F6" : "#6366F1"
  );
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const tabela =
    tipo === "pagamento"
      ? "opcoes_pagamento"
      : tipo === "categoria"
        ? "opcoes_categoria"
        : "opcoes_cartao";

  const titulo =
    tipo === "pagamento"
      ? "Formas de Pagamento"
      : tipo === "categoria"
        ? "Categorias de Gastos"
        : "Cartões";

  useEffect(() => {
    carregarOpcoes();
  }, []);

  const carregarOpcoes = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil?.grupo_id) {
      setGrupoId(perfil.grupo_id);

      const { data, error } = await supabase
        .from(tabela)
        .select("*")
        .eq("grupo_id", perfil.grupo_id)
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar opções:", error);
        return;
      }
      if (data) setOpcoes(data);
    }
  };

  const adicionarOpcao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim() || !grupoId) return;
    setCarregando(true);

    const { error } = await supabase
      .from(tabela)
      .insert([{ nome: novoNome.trim(), cor: novaCor, grupo_id: grupoId }]);

    if (error) {
      console.error("Erro ao adicionar opção:", error);
      alert(`Erro ao adicionar: ${error.message}`);
    } else {
      setNovoNome("");
      await carregarOpcoes();
      onAtualizar();
    }
    setCarregando(false);
  };

  const atualizarOpcao = async (id: string, patch: Partial<Opcao>) => {
    const { error } = await supabase.from(tabela).update(patch).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar opção:", error);
      alert(`Erro ao atualizar: ${error.message}`);
    }
    await carregarOpcoes();
    onAtualizar();
  };

  const removerOpcao = async (id: string) => {
    if (!confirm("Deseja remover esta opção?")) return;
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) {
      console.error("Erro ao remover opção:", error);
      alert(`Erro ao remover: ${error.message}`);
    }
    await carregarOpcoes();
    onAtualizar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl border border-line relative space-y-4">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-ink">
          ✕
        </button>

        <h3 className="text-xl font-bold">Gerenciar {titulo}</h3>

        {/* Formulário para Adicionar */}
        <form
          onSubmit={adicionarOpcao}
          className="flex gap-2 items-center bg-surface p-3 rounded-xl border border-line"
        >
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-line">
            <input
              type="color"
              value={novaCor}
              onChange={(e) => setNovaCor(e.target.value)}
              className="absolute -inset-2 h-10 w-10 cursor-pointer opacity-0"
            />
            <span className="block h-full w-full" style={{ backgroundColor: novaCor }} />
          </div>

          <input
            type="text"
            required
            placeholder={`Novo(a) ${tipo === "pagamento" ? "Forma de Pagamento" : tipo === "categoria" ? "Categoria" : "Cartão"}...`}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            className="flex-1 bg-background border border-line rounded-lg px-3 py-1.5 text-sm outline-none"
          />

          <button
            type="submit"
            disabled={carregando}
            className="bg-accent text-on-accent text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition"
          >
            Adicionar
          </button>
        </form>

        {/* Lista de Opções Existentes */}
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {opcoes.map((item) => (
            <div key={item.id} className="rounded-xl border border-line bg-surface p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Seletor de cor circular interativo */}
                <div
                  className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-line cursor-pointer"
                  style={{ backgroundColor: item.cor }}
                >
                  <input
                    type="color"
                    value={item.cor}
                    onChange={(e) => atualizarOpcao(item.id, { cor: e.target.value })}
                    className="absolute -inset-2 h-10 w-10 cursor-pointer opacity-0"
                  />
                </div>

                <input
                  type="text"
                  value={item.nome}
                  onChange={(e) =>
                    setOpcoes(opcoes.map((o) => (o.id === item.id ? { ...o, nome: e.target.value } : o)))
                  }
                  onBlur={(e) => atualizarOpcao(item.id, { nome: e.target.value })}
                  className="bg-transparent font-medium text-sm text-ink outline-none border-b border-transparent focus:border-accent w-full"
                />
              </div>

              <button
                type="button"
                onClick={() => removerOpcao(item.id)}
                className="text-xs text-red-400 hover:underline ml-2"
              >
                Remover
              </button>
            </div>
            {tipo === "pagamento" && (
              <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line pt-2 pl-9">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(item.eh_cartao)}
                    onChange={(e) => atualizarOpcao(item.id, { eh_cartao: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  Cartão de crédito
                </label>
                {item.eh_cartao && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    Limite total R$
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={item.limite ?? ""}
                      placeholder="0,00"
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== (item.limite ?? null)) atualizarOpcao(item.id, { limite: v });
                      }}
                      className="w-28 rounded-lg border border-line bg-background px-2 py-1 text-xs text-ink outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}