"use client";

import { ChevronDown } from "lucide-react";
import { Ico } from "@/components/icons";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { useMemo, useState } from "react";
import { COR_PADRAO, useOpcoes } from "@/lib/useOpcoes";
import { calcularFatura } from "@/lib/pagamentoFatura";
import { brl, pct as porc, rotuloMes } from "@/lib/finance";
import { gradienteCartao } from "@/lib/cartoes";
import type { Estado } from "@/lib/types";

const ALTURA = 156; // altura de um cartão recolhido (px)
const FAIXA = 76; // parte do cartão que continua visível quando outro cartão o cobre (px)
// Camada escura por cima da cor do cartão: o texto branco continua legível também em cores claras (amarelo, verde-limão)
const ESCURECER = "linear-gradient(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.16))";

/**
 * Cartões empilhados na vertical, no estilo da carteira do Apple Pay:
 * ordenados da maior para a menor fatura do mês. Tocar em qualquer parte do cartão expande os detalhes com uma
 * animação suave; tocar de novo recolhe. Os cartões são do próprio usuário (cadastro privado), mas a fatura e o
 * limite disponível somam as compras de todo o grupo naquele cartão.
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

  const mesCurto = rotuloMes(mes).split(" de ")[0].toLowerCase();
  const todosAbertos = cartoes.every(({ c }) => abertos[c.id]);
  const alternarTodos = () => setAbertos(Object.fromEntries(cartoes.map(({ c }) => [c.id, !todosAbertos])));
  const alternar = (id: string) => setAbertos((a) => ({ ...a, [id]: !a[id] }));

  return (
    <CartaoSecao
      titulo="Meus cartões"
      descricao={`Faturas de ${rotuloMes(mes).toLowerCase()}, da maior para a menor`}
      acao={{ rotulo: "Ver faturas", onClick: onAbrir }}
      lateral={
        cartoes.length > 1 ? (
          <button type="button" onClick={alternarTodos} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted transition hover:bg-background hover:text-ink md:min-h-9">
            {todosAbertos ? "Recolher todos" : "Expandir todos"}
          </button>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-md pb-1">
        {cartoes.map(({ c, limite, fatura, pct }, i) => {
          const aberto = Boolean(abertos[c.id]);
          const anteriorAberto = i > 0 && Boolean(abertos[cartoes[i - 1].c.id]);
          const maiores = [...fatura.itens].sort((a, b) => b.valor - a.valor).slice(0, 6);

          return (
            <article
              key={c.id}
              onClick={() => alternar(c.id)}
              data-aberto={aberto}
              className="hc-glow-card relative cursor-pointer overflow-hidden rounded-3xl p-4 text-white transition-[margin,box-shadow,transform] duration-300 ease-out active:scale-[0.99]"
              style={{
                // O brilho usa a cor cadastrada do cartão; a intensidade vem do tema e sobe quando o cartão está expandido
                ["--glow-c" as string]: c.cor || COR_PADRAO,
                background: `${ESCURECER}, ${gradienteCartao(c.cor)}`,
                zIndex: i + 1,
                marginTop: i === 0 ? 0 : anteriorAberto ? 12 : -(ALTURA - FAIXA),
                minHeight: ALTURA,
              }}
            >
              {/* Faixa que fica sempre visível */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/80">Fatura de {mesCurto}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-tight tabular-nums">{brl(fatura.total)}</p>
                  <p className="text-[11px] text-white/80">{porc(pct)} do limite</p>
                </div>
                {/* O clique sobe até o cartão: o botão existe para o teclado e para leitores de tela */}
                <button
                  type="button"
                  aria-expanded={aberto}
                  aria-label={`${aberto ? "Recolher" : "Expandir"} detalhes de ${c.nome}`}
                  className="grid size-9 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
                >
                  <Ico icon={ChevronDown} size={18} className={`transition-transform duration-300 ${aberto ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Resumo do limite */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/80">Limite total</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(limite)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/80">Disponível</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(fatura.disponivel)}</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="hc-glow-pt h-full rounded-full bg-white transition-[width] duration-500 [--glow-c:#fff]" style={{ width: `${pct}%` }} />
              </div>

              {/* Detalhes: a altura anima de 0 até o conteúdo (grid 0fr → 1fr), sem salto */}
              <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${aberto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden" inert={!aberto}>
                  <div className="mt-4 border-t border-white/20 pt-3">
                    {fatura.excedido > 0 && (
                      <p role="alert" className="mb-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">
                        Limite excedido em {brl(fatura.excedido)}
                      </p>
                    )}
                    {maiores.length === 0 ? (
                      <p className="py-2 text-center text-xs text-white/80">Nenhuma compra neste cartão em {rotuloMes(mes)}.</p>
                    ) : (
                      <ul className="divide-y divide-white/15">
                        {maiores.map((item) => (
                          <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.descricao}</p>
                              <p className="truncate text-[11px] text-white/80">
                                {[item.categoria, item.detalhe].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">{brl(item.valor)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-white/85">
                      <span>
                        {fatura.itens.length > maiores.length
                          ? `+${fatura.itens.length - maiores.length} lançamentos`
                          : `${fatura.itens.length} ${fatura.itens.length === 1 ? "lançamento" : "lançamentos"}`}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAbrir(); }}
                        className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline md:min-h-9"
                      >
                        Ver fatura completa ›
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </CartaoSecao>
  );
}
