"use client";

import type { LucideIcon } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Ico } from "@/components/icons";

export type PessoaItem = { nome?: string | null; avatar?: string | null; cor?: string | null };

/**
 * Elemento da esquerda das listas (padrão em TODOS os módulos no celular):
 * foto grande de quem é o responsável + selo pequeno com o tipo do lançamento.
 * Sem responsável, mostra só o ícone.
 */
export default function PessoaIcone({ pessoa, icone, cor = "var(--accent)", tamanho = 44 }: { pessoa?: PessoaItem | null; icone: LucideIcon; cor?: string; tamanho?: number }) {
  if (!pessoa?.nome) {
    return (
      <span aria-hidden className="grid shrink-0 place-items-center rounded-full" style={{ width: tamanho, height: tamanho, backgroundColor: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}>
        <Ico icon={icone} />
      </span>
    );
  }
  return (
    <span className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <Avatar src={pessoa.avatar} nome={pessoa.nome} cor={pessoa.cor} tamanho={tamanho} />
      <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full text-white ring-2 ring-[var(--surface)]" style={{ backgroundColor: cor }}>
        <Ico icon={icone} size={11} />
      </span>
    </span>
  );
}
