"use client";

import { useMemo, useState } from "react";
import { parseValor } from "@/lib/finance";
import { type Opcao, useOpcoes } from "@/lib/useOpcoes";

type Aba = "cartoes" | "categorias" | "pagamentos";

const CORES = [
  "#0EA5E9",
  "#10B981",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#EF4444",
  "#64748B",
];

export default function GerenciarOpcoesModal({
  tipo = "pagamento",
  onClose,
  onAtualizar,
}: {
  tipo?: "pagamento" | "categoria" | null;
  onClose: () => void;
  onAtualizar?: () => void;
}) {
  const {
    pagamento,
    categoria,
    adicionarPagamento,
    atualizarPagamento,
    removerPagamento,
    adicionarCategoria,
    atualizarCategoria,
    removerCategoria,
  } = useOpcoes();

  const [aba, setAba] = useState<Aba>(
    tipo === "categoria" ? "categorias" : "cartoes",
  );

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#6366F1");
  const [limiteTexto, setLimiteTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const lista = useMemo(() => {
    if (aba === "categorias") return categoria;

    if (aba === "cartoes") {
      return pagamento.filter((item) => Boolean(item.eh_cartao));
    }

    return pagamento.filter((item) => !item.eh_cartao);
  }, [aba, categoria, pagamento]);

  const titulo =
    aba === "cartoes"
      ? "Novo cartão"
      : aba === "categorias"
        ? "Nova categoria"
        : "Nova forma de pagamento";

  const limparFormulario = () => {
    setNome("");
    setLimiteTexto("");
    setCor(aba === "cartoes" ? "#6366F1" : "#64748B");
  };

  const trocarAba = (novaAba: Aba) => {
    setAba(novaAba);
    setMensagem("");
    setNome("");
    setLimiteTexto("");
    setCor(novaAba === "cartoes" ? "#6366F1" : "#64748B");
  };

  const adicionar = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!nome.trim()) {
      setMensagem("Informe um nome.");
      return;
    }

    const limite = parseValor(limiteTexto);

    if (aba === "cartoes" && limite <= 0) {
      setMensagem("Informe um limite maior que zero para o cartão.");
      return;
    }

    try {
      setSalvando(true);
      setMensagem("");

      if (aba === "cartoes") {
        await adicionarPagamento(nome, {
          isCartaoCredito: true,
          limiteTotal: limite,
          cor,
        });
      }

      if (aba === "pagamentos") {
        await adicionarPagamento(nome, {
          isCartaoCredito: false,
          cor,
        });
      }

      if (aba === "categorias") {
        await adicionarCategoria(nome, cor);
      }

      limparFormulario();
      onAtualizar?.();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o cadastro.",
      );
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (item: Opcao) => {
    const confirmou = window.confirm(
      `Deseja remover “${item.nome}”? Isso não remove lançamentos já existentes.`,
    );

    if (!confirmou) return;

    try {
      setSalvando(true);
      setMensagem("");

      if (aba === "categorias") {
        await removerCategoria(item.id);
      } else {
        await removerPagamento(item.id);
      }

      onAtualizar?.();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o cadastro.",
      );
    } finally {
      setSalvando(false);
    }
  };

  const atualizar = async (
    item: Opcao,
    patch: Partial<Pick<Opcao, "nome" | "cor" | "eh_cartao" | "limite">>,
  ) => {
    try {
      setMensagem("");

      if (aba === "categorias") {
        await atualizarCategoria(item.id, {
          nome: patch.nome,
          cor: patch.cor,
        });
      } else {
        await atualizarPagamento(item.id, patch);
      }

      onAtualizar?.();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o cadastro.",
      );
    }
  };

  const limitePreview = parseValor(limiteTexto);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Cadastros e opções"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Organização financeira
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              Cadastros e opções
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-background hover:text-ink"
            aria-label="Fechar cadastros"
          >
            ✕
          </button>
        </header>

        <div className="grid grid-cols-3 border-b border-line bg-background/50">
          <AbaButton
            ativo={aba === "cartoes"}
            onClick={() => trocarAba("cartoes")}
          >
            Cartões
          </AbaButton>

          <AbaButton
            ativo={aba === "categorias"}
            onClick={() => trocarAba("categorias")}
          >
            Categorias
          </AbaButton>

          <AbaButton
            ativo={aba === "pagamentos"}
            onClick={() => trocarAba("pagamentos")}
          >
            Pagamentos
          </AbaButton>
        </div>

        <div className="space-y-5 p-5">
          {aba === "cartoes" && (
            <div
              className="rounded-2xl p-5 text-white shadow-lg transition-colors"
              style={{
                background: `linear-gradient(135deg, ${cor}, #0f172a)`,
              }}
            >
              <p className="text-xs font-medium text-white/70">
                Prévia do cartão
              </p>

              <p className="mt-7 text-lg font-semibold">
                {nome.trim() || "Nome do cartão"}
              </p>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-white/70">Limite total</p>
                  <p className="mt-1 text-xl font-bold">
                    {limitePreview.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>

                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs">
                  Crédito
                </span>
              </div>
            </div>
          )}

          <form
            onSubmit={adicionar}
            className="rounded-2xl border border-line bg-background p-4"
          >
            <div className="mb-4">
              <h3 className="font-semibold text-ink">{titulo}</h3>
              <p className="mt-1 text-xs text-muted">
                {aba === "cartoes"
                  ? "O limite será usado para calcular a fatura e o valor disponível."
                  : "Use nomes curtos para facilitar os lançamentos."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Nome
                </span>

                <input
                  type="text"
                  required
                  maxLength={80}
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder={
                    aba === "cartoes"
                      ? "Ex.: Nubank"
                      : aba === "categorias"
                        ? "Ex.: Alimentação"
                        : "Ex.: Boleto"
                  }
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
                />
              </label>

              {aba === "cartoes" && (
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Limite total
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={limiteTexto}
                    onChange={(event) => setLimiteTexto(event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
              )}

              <label className={aba === "cartoes" ? "" : "sm:col-span-2"}>
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Cor
                </span>

                <span className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3">
                  <span
                    className="size-5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: cor }}
                  />

                  <input
                    type="color"
                    value={cor}
                    onChange={(event) => setCor(event.target.value)}
                    className="h-7 w-10 cursor-pointer bg-transparent"
                    aria-label="Selecionar cor"
                  />

                  <span className="font-mono text-xs text-muted">
                    {cor.toUpperCase()}
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {CORES.map((corDaPaleta) => (
                <button
                  key={corDaPaleta}
                  type="button"
                  onClick={() => setCor(corDaPaleta)}
                  aria-label={`Usar a cor ${corDaPaleta}`}
                  className={`size-7 rounded-full ring-offset-2 transition ${cor === corDaPaleta
                      ? "scale-110 ring-2 ring-accent"
                      : "hover:scale-105"
                    }`}
                  style={{ backgroundColor: corDaPaleta }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Adicionar"}
            </button>
          </form>

          {mensagem && (
            <p
              role="status"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500"
            >
              {mensagem}
            </p>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">
                {aba === "cartoes"
                  ? "Cartões cadastrados"
                  : aba === "categorias"
                    ? "Categorias cadastradas"
                    : "Formas de pagamento cadastradas"}
              </h3>

              <span className="text-xs text-muted">
                {lista.length} {lista.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {lista.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
                Nenhum cadastro encontrado.
              </div>
            ) : (
              <div className="space-y-2">
                {lista.map((item) => (
                  <LinhaOpcao
                    key={item.id}
                    item={item}
                    mostrarLimite={aba === "cartoes"}
                    bloqueado={salvando}
                    onSalvar={(patch) => atualizar(item, patch)}
                    onRemover={() => remover(item)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function AbaButton({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-2 py-3 text-xs font-semibold transition ${ativo
          ? "border-accent bg-surface text-accent"
          : "border-transparent text-muted hover:bg-background hover:text-ink"
        }`}
    >
      {children}
    </button>
  );
}

function LinhaOpcao({
  item,
  mostrarLimite,
  bloqueado,
  onSalvar,
  onRemover,
}: {
  item: Opcao;
  mostrarLimite: boolean;
  bloqueado: boolean;
  onSalvar: (
    patch: Partial<Pick<Opcao, "nome" | "cor" | "eh_cartao" | "limite">>,
  ) => Promise<void>;
  onRemover: () => Promise<void>;
}) {
  const [nome, setNome] = useState(item.nome);
  const [cor, setCor] = useState(item.cor || "#64748B");
  const [limite, setLimite] = useState(String(item.limite || ""));

  const salvarNome = async () => {
    if (nome.trim() && nome.trim() !== item.nome) {
      await onSalvar({ nome: nome.trim() });
    }
  };

  const salvarCor = async (novaCor: string) => {
    setCor(novaCor);

    if (novaCor !== item.cor) {
      await onSalvar({ cor: novaCor });
    }
  };

  const salvarLimite = async () => {
    const valor = parseValor(limite);

    if (valor !== Number(item.limite || 0)) {
      await onSalvar({ limite: valor });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-background px-3 py-3">
      <input
        type="color"
        value={cor}
        onChange={(event) => void salvarCor(event.target.value)}
        className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
        aria-label={`Alterar cor de ${item.nome}`}
      />

      <div className="min-w-0 flex-1">
        <input
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          onBlur={() => void salvarNome()}
          disabled={bloqueado}
          className="w-full bg-transparent text-sm font-medium text-ink outline-none"
          aria-label={`Nome de ${item.nome}`}
        />

        {mostrarLimite && (
          <label className="mt-1 flex items-center gap-1 text-xs text-muted">
            Limite:
            <input
              value={limite}
              inputMode="decimal"
              onChange={(event) => setLimite(event.target.value)}
              onBlur={() => void salvarLimite()}
              disabled={bloqueado}
              className="w-28 border-b border-line bg-transparent py-0.5 text-xs text-ink outline-none focus:border-accent"
              aria-label={`Limite de ${item.nome}`}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        disabled={bloqueado}
        onClick={() => void onRemover()}
        className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
      >
        Remover
      </button>
    </div>
  );
}