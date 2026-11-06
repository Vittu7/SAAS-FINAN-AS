"use client";

import { Loader2, ServerOff, SearchX, TriangleAlert, Inbox } from "lucide-react";
import { mensagemErroAdmin, type CodigoErroAdmin } from "@/lib/admin";

export type EstadoTelaTipo = "carregando" | "vazio" | "erro" | "nao_instalado" | "negado";

interface Props {
  estado: EstadoTelaTipo;
  /** Código do envelope, quando houver. */
  erro?: CodigoErroAdmin;
  /** Texto do estado vazio. */
  vazio?: string;
  onTentarDeNovo?: () => void;
}

/** Estados padrão das telas do painel: carregando, vazio, erro, função não instalada e acesso negado. */
export default function EstadoTela({ estado, erro, vazio, onTentarDeNovo }: Props) {
  const base = "flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-6 text-center";

  if (estado === "carregando") {
    return (
      <div className={base} role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    );
  }
  if (estado === "vazio") {
    return (
      <div className={base}>
        <Inbox className="h-6 w-6 text-muted" aria-hidden />
        <p className="text-sm text-muted">{vazio ?? "Nada por aqui ainda."}</p>
      </div>
    );
  }
  if (estado === "nao_instalado") {
    return (
      <div className={base} role="status">
        <ServerOff className="h-6 w-6 text-warn" aria-hidden />
        <p className="text-sm font-semibold text-ink">Ainda não instalado</p>
        <p className="max-w-sm text-sm text-muted">{mensagemErroAdmin("funcao_nao_instalada")}</p>
      </div>
    );
  }
  if (estado === "negado") {
    return (
      <div className={base} role="alert">
        <SearchX className="h-6 w-6 text-muted" aria-hidden />
        <p className="text-sm text-muted">{mensagemErroAdmin(erro ?? "acesso_negado")}</p>
      </div>
    );
  }
  return (
    <div className={base} role="alert">
      <TriangleAlert className="h-6 w-6 text-neg" aria-hidden />
      <p className="text-sm text-ink">{mensagemErroAdmin(erro ?? "erro_desconhecido")}</p>
      {onTentarDeNovo && (
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="mt-1 h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:bg-background focus-visible:ring-2 focus-visible:ring-accent"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/** Cobre o caso em que o código do envelope decide o estado. */
export function estadoDoErro(erro: CodigoErroAdmin): EstadoTelaTipo {
  if (erro === "funcao_nao_instalada") return "nao_instalado";
  if (erro === "acesso_negado") return "negado";
  return "erro";
}
