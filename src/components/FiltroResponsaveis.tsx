"use client";

import { ChevronDown, Users } from "lucide-react";
import Avatar, { AvatarPilha } from "@/components/Avatar";
import type { PessoaVisual } from "@/components/Avatar";
import { Ico } from "@/components/icons";

/** Token de "somente eu" (não é um nome, para não confundir com um membro de mesmo nome). */
export const TOKEN_EU = "__EU__";

/**
 * Filtro único de responsáveis, usado em todos os módulos que têm lançamentos por pessoa.
 * Nenhuma pessoa marcada = todo o grupo. Pode marcar várias pessoas, inclusive "Somente eu" junto de outras.
 *
 * Fica recolhido por padrão (só uma barra com o resumo do que está selecionado) e expande ao toque,
 * para ocupar pouco espaço no topo da tela.
 */
export default function FiltroResponsaveis({
  eu,
  outros,
  selecionados,
  onChange,
  aberto,
  onAlternarAberto,
}: {
  eu: PessoaVisual;
  outros: PessoaVisual[];
  /** TOKEN_EU ou nomes; lista vazia = todo o grupo */
  selecionados: string[];
  onChange: (tokens: string[]) => void;
  aberto: boolean;
  onAlternarAberto: () => void;
}) {
  const alternar = (token: string) =>
    onChange(selecionados.includes(token) ? selecionados.filter((t) => t !== token) : [...selecionados, token]);

  const base = "inline-flex h-10 shrink-0 items-center gap-2 rounded-full pl-1 pr-3.5 text-sm font-medium transition active:scale-95";
  const ativo = "bg-accent/15 text-ink ring-2 ring-accent";
  const inativo = "bg-background text-muted ring-1 ring-line";
  const todos = selecionados.length === 0;

  // Resumo mostrado na barra recolhida
  const pessoasSel: PessoaVisual[] = selecionados
    .map((t) => (t === TOKEN_EU ? eu : outros.find((p) => p.nome === t)))
    .filter((p): p is PessoaVisual => Boolean(p));
  const rotulo = todos
    ? "Todo o grupo"
    : selecionados.length === 1 && selecionados[0] === TOKEN_EU
    ? "Somente eu"
    : pessoasSel.map((p) => p.nome).join(", ");

  return (
    <section aria-label="Filtro por responsável" className="rounded-2xl bg-surface ring-1 ring-line">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="filtro-responsaveis-painel"
        onClick={onAlternarAberto}
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left transition hover:bg-background/60"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Responsável</span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {todos ? <Ico icon={Users} size={18} className="shrink-0 text-muted" /> : <AvatarPilha pessoas={pessoasSel} tamanho="xs" />}
          <span className="truncate text-sm font-medium text-ink">{rotulo}</span>
        </span>
        <Ico icon={ChevronDown} size={18} className={`shrink-0 text-muted transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div
          id="filtro-responsaveis-painel"
          role="group"
          aria-label="Filtrar por responsável"
          className="flex flex-wrap gap-2 border-t border-line px-4 py-3"
        >
          <button
            type="button"
            aria-pressed={todos}
            onClick={() => onChange([])}
            className={`${base} pl-3.5 ${todos ? "bg-accent text-on-accent" : inativo}`}
          >
            Todos
          </button>
          <button
            type="button"
            aria-pressed={selecionados.includes(TOKEN_EU)}
            onClick={() => alternar(TOKEN_EU)}
            className={`${base} ${selecionados.includes(TOKEN_EU) ? ativo : inativo}`}
          >
            <Avatar src={eu.avatar} nome={eu.nome} cor={eu.cor} tamanho="sm" />
            <span className="max-w-28 truncate">Somente eu</span>
          </button>
          {outros.length > 0 && <span aria-hidden className="mx-1 hidden w-px shrink-0 self-stretch bg-line sm:block" />}
          {outros.map((p) => {
            const ativoP = selecionados.includes(p.nome);
            return (
              <button
                key={p.nome}
                type="button"
                aria-pressed={ativoP}
                onClick={() => alternar(p.nome)}
                className={`${base} ${ativoP ? ativo : inativo}`}
              >
                <Avatar src={p.avatar} nome={p.nome} cor={p.cor} tamanho="sm" />
                <span className="max-w-28 truncate">{p.nome}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
