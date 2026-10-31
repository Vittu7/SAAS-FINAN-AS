"use client";

import { Check, ChevronDown, Users } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import Avatar, { AvatarPilha } from "@/components/Avatar";
import type { PessoaVisual } from "@/components/Avatar";
import { Ico } from "@/components/icons";

/** Token de "somente eu" (não é um nome, para não confundir com um membro de mesmo nome). */
export const TOKEN_EU = "__EU__";

/**
 * Filtro de responsáveis em formato de "pílula" compacta, feita para ficar FIXA no topo da tela, junto do
 * seletor de mês (no celular, dentro do cabeçalho fixo; no desktop, na barra superior).
 *
 * A pílula mostra só quem está selecionado. Ao tocar, abre a lista numa janela flutuante logo abaixo dela (a
 * mesma no desktop e no celular). Nenhuma pessoa marcada = todo o grupo; dá para marcar várias pessoas,
 * inclusive "Somente eu" junto de outras.
 */
export default function FiltroResponsaveis({
  eu,
  outros,
  selecionados,
  onChange,
  className = "",
}: {
  eu: PessoaVisual;
  outros: PessoaVisual[];
  /** TOKEN_EU ou nomes; lista vazia = todo o grupo */
  selecionados: string[];
  onChange: (tokens: string[]) => void;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idPainel = useId();

  const todos = selecionados.length === 0;
  const alternar = (token: string) =>
    onChange(selecionados.includes(token) ? selecionados.filter((t) => t !== token) : [...selecionados, token]);

  const pessoasSel: PessoaVisual[] = selecionados
    .map((t) => (t === TOKEN_EU ? eu : outros.find((p) => p.nome === t)))
    .filter((p): p is PessoaVisual => Boolean(p));
  const rotuloCurto = todos
    ? "Todos"
    : pessoasSel.length === 1
    ? selecionados[0] === TOKEN_EU ? "Eu" : pessoasSel[0].nome
    : `${pessoasSel.length} pessoas`;
  const rotuloCompleto = todos
    ? "Todo o grupo"
    : selecionados.length === 1 && selecionados[0] === TOKEN_EU
    ? "Somente eu"
    : pessoasSel.map((p) => p.nome).join(", ");

  // Fecha ao tocar/clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const abrir = () => setAberto((v) => !v);

  const linha = (marcado: boolean) =>
    `flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${marcado ? "bg-accent/12 font-semibold text-ink" : "text-ink hover:bg-background"}`;
  const marca = (marcado: boolean) => (
    <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${marcado ? "border-accent bg-accent text-on-accent" : "border-line"}`}>
      {marcado && <Ico icon={Check} size={13} />}
    </span>
  );

  const lista = (
    <div role="group" aria-label="Filtrar por responsável" className="space-y-1">
      <button type="button" aria-pressed={todos} onClick={() => onChange([])} className={linha(todos)}>
        {marca(todos)}
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-muted ring-1 ring-line"><Ico icon={Users} size={15} /></span>
        <span className="min-w-0 flex-1 truncate">Todo o grupo</span>
      </button>
      <div aria-hidden className="mx-2 h-px bg-line" />
      {[{ token: TOKEN_EU, pessoa: eu, nome: "Somente eu" }, ...outros.map((p) => ({ token: p.nome, pessoa: p, nome: p.nome }))].map(({ token, pessoa, nome }) => {
        const m = selecionados.includes(token);
        return (
          <button key={token} type="button" aria-pressed={m} onClick={() => alternar(token)} className={linha(m)}>
            {marca(m)}
            <Avatar src={pessoa.avatar} nome={pessoa.nome} cor={pessoa.cor} tamanho="sm" />
            <span className="min-w-0 flex-1 truncate">{nome}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={raiz} className={`relative ${className}`}>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={`Filtrar por responsável: ${rotuloCompleto}`}
        title={rotuloCompleto}
        className={`flex h-10 max-w-full items-center gap-2 rounded-full bg-surface pl-1.5 pr-2.5 text-sm font-medium shadow-sm ring-1 transition active:scale-95 md:rounded-xl md:pl-2 ${aberto ? "ring-2 ring-accent" : "ring-line hover:ring-accent/50"} ${todos ? "" : "text-ink"}`}
      >
        {todos ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Ico icon={Users} size={15} /></span>
        ) : (
          <AvatarPilha pessoas={pessoasSel} tamanho="xs" />
        )}
        <span className="min-w-0 max-w-24 truncate md:max-w-40">{rotuloCurto}</span>
        <Ico icon={ChevronDown} size={16} className={`shrink-0 text-muted transition-transform duration-200 ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div
          id={idPainel}
          role="dialog"
          aria-label="Filtrar por responsável"
          className="anim-fade absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-2 shadow-2xl"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Responsável</p>
          {lista}
        </div>
      )}
    </div>
  );
}
