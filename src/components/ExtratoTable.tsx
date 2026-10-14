"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";

interface Opcao {
  id: string;
  nome: string;
  cor: string;
}

export default function ExtratoTable({
  mes,
  itens,
  onAdd,
  onRemove,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any) => void;
  onRemove: (id: string) => void;
}) {
  const [pagamento, setPagamento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");

  const [membros, setMembros] = useState<string[]>([]);
  const [meuNome, setMeuNome] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [menuResponsavelAberto, setMenuResponsavelAberto] = useState(false);

  // Opções personalizadas
  const [opcoesPagamento, setOpcoesPagamento] = useState<Opcao[]>([]);
  const [opcoesCategoria, setOpcoesCategoria] = useState<Opcao[]>([]);
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | null>(null);

  const carregarDadosIniciais = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil) {
      const nomeReal = perfil.nome_usuario || "Usuário";
      setMeuNome(nomeReal);
      setResponsaveisSelecionados([nomeReal]);

      if (perfil.grupo_id) {
        const [resMembros, resPag, resCat] = await Promise.all([
          supabase.from("perfis").select("nome_usuario").eq("grupo_id", perfil.grupo_id),
          supabase.from("opcoes_pagamento").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
          supabase.from("opcoes_categoria").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
        ]);

        if (resMembros.data) {
          const nomes = resMembros.data.map((m) => m.nome_usuario).filter(Boolean);
          setMembros(nomes.length > 0 ? nomes : [nomeReal]);
        }

        if (resPag.data) {
          setOpcoesPagamento(resPag.data);
          if (resPag.data.length > 0 && !pagamento) setPagamento(resPag.data[0].nome);
        }
        if (resCat.data) setOpcoesCategoria(resCat.data);
      }
    }
  }, [pagamento]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  const alternarResponsavel = (nome: string) => {
    setResponsaveisSelecionados((prev) =>
      prev.includes(nome)
        ? prev.length > 1 ? prev.filter((item) => item !== nome) : prev
        : [...prev, nome]
    );
  };

  const selecionarTodos = () => {
    setResponsaveisSelecionados(
      responsaveisSelecionados.length === membros.length ? [meuNome || "Usuário"] : [...membros]
    );
  };

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = parseValor(valorTexto);
    if (!valorTotal || !descricao.trim()) return;

    const qtd = responsaveisSelecionados.length;
    const valorIndividual = valorTotal / qtd;

    responsaveisSelecionados.forEach((resp) => {
      onAdd({
        mes,
        pagamento: pagamento || "Geral",
        categoria: categoria || "Outros",
        valor: valorIndividual,
        descricao: qtd > 1 ? `${descricao} (1/${qtd})` : descricao,
        responsavel: resp,
      });
    });

    setValorTexto("");
    setDescricao("");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 shadow-lg space-y-4">
      <form onSubmit={handleAdicionar} className="grid gap-3 sm:grid-cols-2 md:grid-cols-6 items-end">
        {/* Pagamento com seletor e botão de gerenciar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Pagamento</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("pagamento")}
              className="text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <select
            value={pagamento}
            onChange={(e) => setPagamento(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            {opcoesPagamento.map((p) => (
              <option key={p.id} value={p.nome}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Categoria com seletor e botão de gerenciar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Categoria</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("categoria")}
              className="text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Selecione...</option>
            {opcoesCategoria.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Valor Total (R$)</label>
          <input
            type="text"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Descrição</label>
          <input
            type="text"
            placeholder="Descrição..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* SELETOR MÚLTIPLO DE RESPONSÁVEIS */}
        <div className="relative">
          <label className="text-xs font-medium text-muted block mb-1">Responsável(is)</label>
          <button
            type="button"
            onClick={() => setMenuResponsavelAberto(!menuResponsavelAberto)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-xs font-medium text-left truncate flex items-center justify-between outline-none focus:ring-2 focus:ring-accent"
          >
            <span>
              {responsaveisSelecionados.length === 1
                ? responsaveisSelecionados[0]
                : `${responsaveisSelecionados.length} selecionados`}
            </span>
            <span className="text-xs text-muted">▾</span>
          </button>

          {menuResponsavelAberto && (
            <div className="absolute z-30 top-full mt-1 left-0 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl space-y-1">
              {membros.length > 1 && (
                <button
                  type="button"
                  onClick={selecionarTodos}
                  className="w-full text-left text-xs px-2 py-1.5 font-bold text-accent border-b border-line mb-1 hover:bg-background/50 rounded"
                >
                  {responsaveisSelecionados.length === membros.length ? "Desmarcar Todos" : "👥 Marcar Todos"}
                </button>
              )}

              <div className="max-h-36 overflow-y-auto space-y-1">
                {membros.map((nome) => (
                  <label
                    key={nome}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-background cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={responsaveisSelecionados.includes(nome)}
                      onChange={() => alternarResponsavel(nome)}
                      className="rounded border-line text-accent focus:ring-accent"
                    />
                    <span>{nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-accent text-on-accent h-9 rounded-xl font-medium text-sm hover:opacity-90 transition"
        >
          Adicionar
        </button>
      </form>

      {/* TABELA DE EXIBIÇÃO */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2">Pagamento</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Descrição</th>
              <th className="py-2">Responsável</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-line/40 last:border-0 hover:bg-background/30">
                <td className="py-3 font-medium">{item.pagamento}</td>
                <td className="py-3 text-muted">{item.categoria || "-"}</td>
                <td className="py-3">{item.descricao}</td>
                <td className="py-3">
                  <span className="bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded text-xs">
                    {item.responsavel || "Membro"}
                  </span>
                </td>
                <td className="py-3 text-right font-bold">{brl(item.valor)}</td>
                <td className="py-3 text-center">
                  <button onClick={() => onRemove(item.id)} className="text-xs text-red-400 hover:text-red-300">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE GERENCIAMENTO DE OPÇÕES (PAGAMENTO / CATEGORIA) */}
      {modalOpcaoAberto && (
        <GerenciarOpcoesModal
          tipo={modalOpcaoAberto}
          onClose={() => setModalOpcaoAberto(null)}
          onAtualizar={carregarDadosIniciais}
        />
      )}
    </div>
  );
}