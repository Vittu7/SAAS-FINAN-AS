"use client";

import Avatar from "@/components/Avatar";
import type { PessoaVisual } from "@/components/Avatar";

/** Seleção de uma ou mais pessoas. Nenhuma marcada = todos. Funciona bem no toque (botões grandes). */
export default function FiltroResponsaveis({
  pessoas,
  selecionados,
  onChange,
}: {
  pessoas: PessoaVisual[];
  selecionados: string[];
  onChange: (nomes: string[]) => void;
}) {
  const alternar = (nome: string) =>
    onChange(selecionados.includes(nome) ? selecionados.filter((n) => n !== nome) : [...selecionados, nome]);
  const base = "inline-flex h-10 items-center gap-2 rounded-full pl-1 pr-3.5 text-sm font-medium transition active:scale-95";

  return (
    <div role="group" aria-label="Filtrar por responsável" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selecionados.length === 0}
        onClick={() => onChange([])}
        className={`${base} pl-3.5 ${selecionados.length === 0 ? "bg-accent text-on-accent" : "bg-background text-muted ring-1 ring-line"}`}
      >
        Todos
      </button>
      {pessoas.map((p) => {
        const ativo = selecionados.includes(p.nome);
        return (
          <button
            key={p.nome}
            type="button"
            aria-pressed={ativo}
            onClick={() => alternar(p.nome)}
            className={`${base} ${ativo ? "bg-accent/15 text-ink ring-2 ring-accent" : "bg-background text-muted ring-1 ring-line"}`}
          >
            <Avatar src={p.avatar} nome={p.nome} cor={p.cor} tamanho="sm" />
            <span className="max-w-28 truncate">{p.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
