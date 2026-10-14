"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Opcao {
  id: string;
  nome: string;
  cor: string;
}

export default function GerenciarOpcoesModal({
  tipo, // "pagamento" | "categoria"
  onClose,
  onAtualizar,
}: {
  tipo: "pagamento" | "categoria";
  onClose: () => void;
  onAtualizar: () => void;
}) {
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(tipo === "pagamento" ? "#10B981" : "#6366F1");
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const tabela = tipo === "pagamento" ? "opcoes_pagamento" : "opcoes_categoria";
  const titulo = tipo === "pagamento" ? "Formas de Pagamento" : "Categorias de Gastos";

  useEffect(() => {
    carregarOpcoes();
  }, []);

  const carregarOpcoes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil?.grupo_id) {
      setGrupoId(perfil.grupo_id);
      const { data } = await supabase
        .from(tabela)
        .select("*")
        .eq("grupo_id", perfil.grupo_id)
        .order("nome", { ascending: true });

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

    if (!error) {
      setNovoNome("");
      await carregarOpcoes();
      onAtualizar();
    }
    setCarregando(false);
  };

  const atualizarOpcao = async (id: string, patch: Partial<Opcao>) => {
    await supabase.from(tabela).update(patch).eq("id", id);
    await carregarOpcoes();
    onAtualizar();
  };

  const removerOpcao = async (id: string) => {
    if (!confirm("Deseja remover esta opção?")) return;
    await supabase.from(tabela).delete().eq("id", id);
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
        <form onSubmit={adicionarOpcao} className="flex gap-2 items-center bg-surface p-3 rounded-xl border border-line">
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
            placeholder={`Nova ${tipo === "pagamento" ? "Forma de Pagamento" : "Categoria"}...`}
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
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {opcoes.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2.5 bg-surface rounded-xl border border-line">
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
                  onChange={(e) => setOpcoes(opcoes.map(o => o.id === item.id ? { ...o, nome: e.target.value } : o))}
                  onBlur={(e) => atualizarOpcao(item.id, { nome: e.target.value })}
                  className="bg-transparent font-medium text-sm text-ink outline-none border-b border-transparent focus:border-accent w-full"
                />
              </div>

              <button
                onClick={() => removerOpcao(item.id)}
                className="text-xs text-red-400 hover:underline ml-2"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}