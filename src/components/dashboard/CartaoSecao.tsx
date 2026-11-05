import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Ico } from "@/components/icons";

/**
 * Moldura única dos blocos da tela inicial: mesmo espaçamento, mesmo título e a mesma ação "ver mais".
 * Os tamanhos respondem à largura da própria tela (container queries do contêiner da Dashboard).
 */
export default function CartaoSecao({
  titulo,
  descricao,
  acao,
  lateral,
  children,
  className = "",
}: {
  titulo: string;
  descricao?: string;
  acao?: { rotulo: string; onClick: () => void };
  /** Controle extra ao lado da ação (ex.: "Expandir todos") */
  lateral?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={titulo} className={`card-flat grid min-w-0 content-start gap-4 p-5 @xl:p-6 ${className}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{titulo}</h2>
          {descricao && <p className="mt-1 text-xs text-muted">{descricao}</p>}
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0 items-center">
        {lateral}
        {acao && (
          <button
            type="button"
            onClick={acao.onClick}
            className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-accent transition hover:bg-background md:min-h-9"
          >
            {acao.rotulo}
            <Ico icon={ChevronRight} size={16} />
          </button>
        )}
        </div>
      </header>
      {children}
    </section>
  );
}
