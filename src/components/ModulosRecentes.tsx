"use client";

import { ICONE_ABA, Ico } from "@/components/icons";
import type { ModuloId } from "@/hooks/useModulosRecentes";

const MODULOS: Record<ModuloId, { rotulo: string; detalhe: string }> = {
  extrato: { rotulo: "Extrato", detalhe: "Todas as movimentações" },
  lancamentos: { rotulo: "Lançamentos do mês", detalhe: "Gastos e entradas" },
  cartao: { rotulo: "Contas parceladas", detalhe: "Compras em parcelas" },
  contas: { rotulo: "Contas fixas", detalhe: "Aluguel, internet e outras" },
  fatura: { rotulo: "Faturas do cartão", detalhe: "Fatura e limite" },
  ajustes: { rotulo: "Configurações", detalhe: "Perfil e preferências" },
};

/** Módulos usados recentemente pelo usuário (substitui a antiga grade de atalhos fixos). */
export default function ModulosRecentes({
  recentes,
  onAbrir,
}: {
  recentes: ModuloId[];
  onAbrir: (id: ModuloId) => void;
}) {
  const itens = recentes.slice(0, 4);
  return (
    <section aria-label="Módulos acessados recentemente" className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">Módulos acessados recentemente</h2>
      {itens.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-5 text-center text-sm text-muted ring-1 ring-line">
          Os módulos que você abrir aparecerão aqui para acesso rápido.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {itens.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onAbrir(id)}
              className="flex min-w-0 items-center gap-3 rounded-2xl bg-surface p-3 text-left ring-1 ring-line transition hover:ring-accent/50 active:scale-[0.98]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <Ico icon={ICONE_ABA[id]} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{MODULOS[id].rotulo}</span>
                <span className="block truncate text-[11px] text-muted">{MODULOS[id].detalhe}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
