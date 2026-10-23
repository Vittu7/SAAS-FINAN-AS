"use client";

import { ChevronDown } from "lucide-react";
import { Ico } from "@/components/icons";
import { useState } from "react";
import { COR_PADRAO, type Opcao } from "@/lib/useOpcoes";

// Etiqueta colorida (usada nas tabelas para categoria, forma de pagamento e responsável)
export function Selo({ nome, cor }: { nome: string; cor?: string | null }) {
  const c = cor || COR_PADRAO;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: `${c}26`,
        color: `color-mix(in srgb, ${c}, black var(--selo-escurecer, 0%))`,
        boxShadow: `inset 0 0 0 1px ${c}40`,
      }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c }} />
      {nome}
    </span>
  );
}

// Seletor que mostra a cor de cada opção (o <select> nativo não mostra cor de forma confiável)
export function SeletorOpcao({
  opcoes,
  valor,
  onChange,
  placeholder = "Selecione...",
}: {
  opcoes: Opcao[];
  valor: string;
  onChange: (nome: string) => void;
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.nome === valor);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
      >
        <span className="flex items-center gap-2 truncate">
          {valor ? (
            <>
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: atual?.cor || COR_PADRAO }}
              />
              <span className="truncate">{valor}</span>
            </>
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </span>
        <Ico icon={ChevronDown} size={16} className="text-muted" />
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar lista"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setAberto(false)}
          />
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl">
            {opcoes.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted">Nenhuma opção cadastrada</p>
            )}
            {opcoes.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.nome);
                  setAberto(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-background"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: o.cor || COR_PADRAO }}
                />
                <span className="truncate">{o.nome}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}