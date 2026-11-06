"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EstadoTela from "./EstadoTela";

export interface Coluna<T> {
  chave: string;
  titulo: string;
  /** Texto ou elemento React. Nunca HTML bruto. */
  render: (linha: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  colunas: Coluna<T>[];
  linhas: T[];
  total: number;
  pagina: number;
  limite: number;
  onPagina: (pagina: number) => void;
  chaveLinha: (linha: T) => string | number;
  carregando?: boolean;
  vazio?: string;
  /** Busca e filtros, acima da tabela. */
  topo?: ReactNode;
}

/** Tabela paginada no servidor: tabela no desktop, cartões empilhados no celular. */
export default function TabelaPaginada<T>({
  colunas, linhas, total, pagina, limite, onPagina, chaveLinha, carregando, vazio, topo,
}: Props<T>) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const botao =
    "inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-background disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {topo}
      {carregando && linhas.length === 0 ? (
        <EstadoTela estado="carregando" />
      ) : linhas.length === 0 ? (
        <EstadoTela estado="vazio" vazio={vazio} />
      ) : (
        <>
          <div className="card-flat hidden overflow-x-auto md:block">
            <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  {colunas.map((c) => (
                    <th key={c.chave} scope="col" className={`px-3 py-2.5 font-semibold ${c.className ?? ""}`}>{c.titulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={chaveLinha(l)} className="border-b border-line last:border-0 align-top">
                    {colunas.map((c) => (
                      <td key={c.chave} className={`break-words px-3 py-2.5 text-ink ${c.className ?? ""}`}>{c.render(l)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {linhas.map((l) => (
              <li key={chaveLinha(l)} className="card-flat flex flex-col gap-1.5 p-3">
                {colunas.map((c) => (
                  <div key={c.chave} className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                    <span className="shrink-0 text-xs text-muted">{c.titulo}</span>
                    <span className="min-w-0 break-words text-right text-ink">{c.render(l)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      <nav className="flex items-center justify-between gap-2" aria-label="Paginação">
        <button type="button" className={botao} disabled={pagina <= 1 || carregando} onClick={() => onPagina(pagina - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> <span className="ml-1">Anterior</span>
        </button>
        <p className="text-xs tabular-nums text-muted" aria-live="polite">
          Página {pagina} de {totalPaginas} · {total} {total === 1 ? "registro" : "registros"}
        </p>
        <button type="button" className={botao} disabled={pagina >= totalPaginas || carregando} onClick={() => onPagina(pagina + 1)}>
          <span className="mr-1">Próxima</span> <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </nav>
    </div>
  );
}
