"use client";

import Avatar from "@/components/Avatar";
import type { PessoaVisual } from "@/components/Avatar";

/** Token de "somente eu" (não é um nome, para não confundir com um membro de mesmo nome). */
export const TOKEN_EU = "__EU__";

/**
 * Filtro único de responsáveis, usado em todos os módulos (substitui a antiga "Visualização").
 * Nenhuma pessoa marcada = todo o grupo. Pode marcar várias pessoas, inclusive "Somente eu" junto de outras.
 */
export default function FiltroResponsaveis({
  eu,
  outros,
  selecionados,
  onChange,
}: {
  eu: PessoaVisual;
  outros: PessoaVisual[];
  /** TOKEN_EU ou nomes; lista vazia = todo o grupo */
  selecionados: string[];
  onChange: (tokens: string[]) => void;
}) {
  const alternar = (token: string) =>
    onChange(selecionados.includes(token) ? selecionados.filter((t) => t !== token) : [...selecionados, token]);

  const base = "inline-flex h-10 shrink-0 items-center gap-2 rounded-full pl-1 pr-3.5 text-sm font-medium transition active:scale-95";
  const ativo = "bg-accent/15 text-ink ring-2 ring-accent";
  const inativo = "bg-background text-muted ring-1 ring-line";
  const todos = selecionados.length === 0;

  return (
    <div role="group" aria-label="Filtrar por responsável" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
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
      {outros.length > 0 && <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-line" />}
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
  );
}
