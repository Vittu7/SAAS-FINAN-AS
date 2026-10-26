"use client";

import Avatar from "@/components/Avatar";

/** Selo "Lançado por X": aparece só quando o lançamento foi feito por outra pessoa. */
export default function AutorTag({ nome, avatar, cor, className = "" }: { nome?: string | null; avatar?: string | null; cor?: string | null; className?: string }) {
  if (!nome) return null;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full bg-accent/10 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-accent ${className}`} title={`Lançado por ${nome}`}>
      <Avatar src={avatar} nome={nome} cor={cor} tamanho={16} />
      <span className="truncate">Lançado por {nome}</span>
    </span>
  );
}
