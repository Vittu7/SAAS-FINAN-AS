"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { Ico } from "@/components/icons";
import { useMemo, useState } from "react";
import { useOpcoes } from "@/lib/useOpcoes";
import { calcularFatura } from "@/lib/faturas";
import { brl, rotuloMes } from "@/lib/finance";
import { gradienteCartao } from "@/lib/cartao";
import type { Estado } from "@/lib/types";

const ALTURA = 156; // altura de um cartão recolhido (px)
const FAIXA = 76; // parte do cartão que continua visível quando outro cartão o cobre (px)

/**
 * Cartões empilhados na vertical, no estilo da carteira do Apple Pay:
 * ordenados da maior para a menor fatura do mês, cada um com botão
 * para expandir/recolher os detalhes. Os cartões são do próprio usuário (cadastro privado),
 * mas a fatura e o limite disponível somam as compras de todo o grupo naquele cartão.
 */
export default function PilhaCartoes({
  estado,
  mes,
  onAbrir,
}: {
  estado: Estado;
  mes: string;
  onAbrir: () => void;
}) {
  const { pagamento } = useOpcoes();
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const cartoes = useMemo(
    () =>
      pagamento
        .filter((c) => c.eh_cartao)
        .map((c) => {
          const limite = Number(c.limite) || 0;
          const fatura = calcularFatura(estado, c.nome, mes, limite);
          return { c, limite, fatura, pct: limite > 0 ? Math.min(100, (fatura.total / limite) * 100) : 0 };
        })
        .sort((a, b) => b.fatura.total - a.fatura.total || a.c.nome.localeCompare(b.c.nome, "pt-BR")),
    [pagamento, estado, mes],
  );

  if (!cartoes.length) return null;

  const todosAbertos = cartoes.every(({ c }) => abertos[c.id]);
  const alternarTodos = () => setAbertos(Object.fromEntries(cartoes.map(({ c }) => [c.id, !todosAbertos])));

  return (
    <section className="card-glass space-y-4 p-5" aria-label="Cartões de crédito">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Meus cartões</h2>
          <p className="text-xs text-muted">Da maior para a menor fatura de {rotuloMes(mes)}.</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium">
          {cartoes.length > 1 && (
            <button type="button" onClick={alternarTodos} className="text-muted transition hover:text-ink">
              {todosAbertos ? "Recolher todos" : "Expandir todos"}
            </button>
          )}
          <button type="button" onClick={onAbrir} className="text-accent">Ver faturas ›</button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md pb-1">
        {cartoes.map(({ c, limite, fatura, pct }, i) => {
          const aberto = Boolean(abertos[c.id]);
          const anteriorAberto = i > 0 && Boolean(abertos[cartoes[i - 1].c.id]);
          const maiores = [...fatura.itens].sort((a, b) => b.valor - a.valor).slice(0, 6);

          return (
            <article
              key={c.id}
              className="relative overflow-hidden rounded-3xl p-4 text-white shadow-lg ring-1 ring-black/10 transition-all duration-300"
              style={{
                background: gradienteCartao(c.cor),
                zIndex: i + 1,
                marginTop: i === 0 ? 0 : anteriorAberto ? 12 : -(ALTURA - FAIXA),
                height: aberto ? undefined : ALTURA,
              }}
            >
              {/* Faixa que fica sempre visível */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/70">Fatura de {rotuloMes(mes)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-tight tabular-nums">{brl(fatura.total)}</p>
                  <p className="text-[11px] text-white/70">{pct.toFixed(0)}% do limite</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbertos((a) => ({ ...a, [c.id]: !a[c.id] }))}
                  aria-expanded={aberto}
                  aria-label={`${aberto ? "Recolher" : "Expandir"} detalhes de ${c.nome}`}
                  className="grid size-8 place-items-center rounded-full bg-white/15 text-sm transition hover:bg-white/25 active:scale-95"
                >
                  <Ico icon={aberto ? ChevronUp : ChevronDown} size={18} />
                </button>
              </div>

              {/* Resumo do limite */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/70">Limite total</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(limite)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/70">Disponível</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(fatura.disponivel)}</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>

              {/* Detalhes (expandido) */}
              {aberto && (
                <div className="mt-4 border-t border-white/20 pt-3">
                  {fatura.excedido > 0 && (
                    <p role="alert" className="mb-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">
                      Limite excedido em {brl(fatura.excedido)}
                    </p>
                  )}
                  {maiores.length === 0 ? (
                    <p className="py-2 text-center text-xs text-white/70">Nenhuma compra neste cartão em {rotuloMes(mes)}.</p>
                  ) : (
                    <ul className="divide-y divide-white/15">
                      {maiores.map((item) => (
                        <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.descricao}</p>
                            <p className="truncate text-[11px] text-white/70">
                              {[item.categoria, item.detalhe].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{brl(item.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-white/80">
                    <span>
                      {fatura.itens.length > maiores.length
                        ? `+${fatura.itens.length - maiores.length} lançamentos`
                        : `${fatura.itens.length} ${fatura.itens.length === 1 ? "lançamento" : "lançamentos"}`}
                    </span>
                    <button type="button" onClick={onAbrir} className="font-semibold underline-offset-2 hover:underline">
                      Ver fatura completa ›
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
