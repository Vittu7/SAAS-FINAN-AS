"use client";

import React, { useState } from "react";
import { useOpcoes } from "@/lib/useOpcoes";

interface GerenciarOpcoesModalProps {
  tipo?: "pagamento" | "categoria" | null;
  onClose: () => void;
  onAtualizar?: () => void;
}

export default function GerenciarOpcoesModal({
  tipo = "pagamento",
  onClose,
  onAtualizar,
}: GerenciarOpcoesModalProps) {
  const {
    pagamento,
    categoria,
    adicionarPagamento,
    removerPagamento,
    adicionarCategoria,
    removerCategoria,
  } = useOpcoes();

  const [abaAtiva, setAbaAtiva] = useState<"cartoes" | "categorias" | "pagamentos">(
    tipo === "categoria" ? "categorias" : "cartoes"
  );
  const [novoNome, setNovoNome] = useState("");
  const [novoIsCartao, setNovoIsCartao] = useState(false);
  const [novoLimite, setNovoLimite] = useState("");

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    if (abaAtiva === "categorias") {
      await adicionarCategoria(novoNome.trim());
    } else if (abaAtiva === "cartoes") {
      await adicionarPagamento(novoNome.trim(), {
        isCartaoCredito: true,
        limiteTotal: parseFloat(novoLimite) || 0,
      });
    } else {
      await adicionarPagamento(novoNome.trim(), {
        isCartaoCredito: novoIsCartao,
        limiteTotal: novoIsCartao ? parseFloat(novoLimite) || 0 : undefined,
      });
    }

    setNovoNome("");
    setNovoLimite("");
    setNovoIsCartao(false);

    if (onAtualizar) onAtualizar();
  };

  const handleRemoverPagamento = async (idOrNome: string) => {
    await removerPagamento(idOrNome);
    if (onAtualizar) onAtualizar();
  };

  const handleRemoverCategoria = async (idOrNome: string) => {
    await removerCategoria(idOrNome);
    if (onAtualizar) onAtualizar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-base font-bold text-ink">
            Cadastros & Opções
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-background hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* ABAS */}
        <div className="flex border-b border-line bg-background/50">
          <button
            type="button"
            onClick={() => setAbaAtiva("cartoes")}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors ${
              abaAtiva === "cartoes"
                ? "border-accent text-accent bg-surface"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Cartões de Crédito
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva("categorias")}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors ${
              abaAtiva === "categorias"
                ? "border-accent text-accent bg-surface"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Categorias
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva("pagamentos")}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors ${
              abaAtiva === "pagamentos"
                ? "border-accent text-accent bg-surface"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Outros Pagamentos
          </button>
        </div>

        {/* CONTEÚDO / FORMULÁRIO */}
        <div className="p-4 space-y-4">
          <form onSubmit={handleAdicionar} className="space-y-3 rounded-xl border border-line bg-background/40 p-3">
            <input
              type="text"
              placeholder={abaAtiva === "cartoes" ? "Nome do Cartão (ex: Nubank)" : "Nome da opção..."}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="w-full rounded-xl border border-line bg-background p-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
            />

            {(abaAtiva === "cartoes" || (abaAtiva === "pagamentos" && novoIsCartao)) && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Limite Total do Cartão (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={novoLimite}
                  onChange={(e) => setNovoLimite(e.target.value)}
                  className="w-full rounded-xl border border-line bg-background p-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            )}

            {abaAtiva === "pagamentos" && (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted">
                <input
                  type="checkbox"
                  checked={novoIsCartao}
                  onChange={(e) => setNovoIsCartao(e.target.checked)}
                  className="rounded border-line text-accent focus:ring-accent"
                />
                Tratar como Cartão de Crédito
              </label>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90"
            >
              ＋ Adicionar {abaAtiva === "cartoes" ? "Cartão" : abaAtiva === "categorias" ? "Categoria" : "Pagamento"}
            </button>
          </form>

          {/* LISTAGEM */}
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {abaAtiva === "categorias" &&
              categoria.map((cat: any) => (
                <div
                  key={cat.id || cat.nome}
                  className="flex items-center justify-between p-3 rounded-xl border border-line bg-background/60"
                >
                  <span className="text-sm font-medium text-ink">{cat.nome}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoverCategoria(cat.id || cat.nome)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ))}

            {abaAtiva === "cartoes" &&
              pagamento
                .filter((p: any) => p.eh_cartao || p.isCartaoCredito)
                .map((cartaoItem: any) => (
                  <div
                    key={cartaoItem.id || cartaoItem.nome}
                    className="flex items-center justify-between p-3 rounded-xl border border-line bg-background/60"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">{cartaoItem.nome}</div>
                      <div className="text-xs text-accent font-medium">
                        Limite: R$ {((cartaoItem.limite ?? cartaoItem.limiteTotal) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoverPagamento(cartaoItem.id || cartaoItem.nome)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}

            {abaAtiva === "pagamentos" &&
              pagamento
                .filter((p: any) => !p.eh_cartao && !p.isCartaoCredito)
                .map((forma: any) => (
                  <div
                    key={forma.id || forma.nome}
                    className="flex items-center justify-between p-3 rounded-xl border border-line bg-background/60"
                  >
                    <span className="text-sm font-medium text-ink">{forma.nome}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoverPagamento(forma.id || forma.nome)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}