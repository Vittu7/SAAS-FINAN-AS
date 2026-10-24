"use client";

import InvestimentosReservaCard from "@/components/InvestimentosReservaCard";

/** Tela própria de Investimentos: caixinhas, reserva de emergência, aportes, resgates e rendimentos. */
export default function TelaInvestimentos() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Aportes, resgates e rendimentos ficam aqui e não entram em entradas nem saídas do mês.
      </p>
      <InvestimentosReservaCard />
    </div>
  );
}
