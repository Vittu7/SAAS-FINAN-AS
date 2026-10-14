"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Opcao {
  id: string;
  nome: string;
  cor: string;
}

export default function GerenciarOpcoesModal({
  tipo,
  onClose,
  onAtualizar,
}: {
  tipo: "categoria" | "pagamento" | "cartao"; // <--- ATUALIZADO AQUI
  onClose: () => void;
  onAtualizar: () => void;
}) {
  const [itens, setItens] = useState<Opcao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("#3b82f6");
  const [grupoId, setGrupoId] = useState<string | null>(null);

  // Define a tabela correta no Supabase baseada no tipo
  const nomeTabela =
    tipo === "categoria"
      ? "opcoes_categoria"
      : tipo === "pagamento"
      ? "opcoes_pagamento"
      : "opcoes_cartao";

  const carregarItens = useCallback(async () => {
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
        .from(nomeTabela)
        .select("*")
        .eq("grupo_id", perfil.grupo_id)
        .order("nome");

      if (data) setItens(data);
    }
  }, [nomeTabela]);

  useEffect(() => {
    carregarItens();
  }, [carregarItens]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim() || !grupoId) return;

    const { error } = await supabase.from(nomeTabela).insert([
      {
        nome: novoNome.trim(),
        cor: novaCor,
        grupo_id: grupoId,
      },
    ]);

    if (!error) {
      setNovoNome("");
      carregarItens();
      onAtualizar();
    } else {
      alert("Erro ao adicionar item. Verifique se já existe.");
    }
  };

  const handleRemover = async (id: string) => {
    const { error } = await supabase.from(nomeTabela).delete().eq("id", id);
    if (!error) {
      carregarItens();
      onAtualizar();
    }
  };

  const tituloModal =
    tipo === "categoria"
      ? "Gerenciar Categorias"
      : tipo === "pagamento"
      ? "Gerenciar Meios de Pagamento"
      : "Gerenciar Cartões";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-ink">{tituloModal}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleAdicionar} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Nome</label>
            <input
              type="text"
              placeholder="Ex: Novo Item..."
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-accent text-on-accent h-9 rounded-xl font-medium text-sm hover:opacity-90 transition"
          >
            Adicionar Novo
          </button>
        </form>

        <div className="max-h-48 overflow-y-auto space-y-2 pt-2 border-t border-line">
          {itens.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-background px-3 py-2 rounded-xl border border-line text-sm"
            >
              <span className="font-medium text-ink">{item.nome}</span>
              <button
                type="button"
                onClick={() => handleRemover(item.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remover
              </button>
            </div>
          ))}
          {itens.length === 0 && (
            <p className="text-xs text-muted text-center py-2">Nenhum registo encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}