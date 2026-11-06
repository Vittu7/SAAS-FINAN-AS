"use client";

interface Props {
  titulo: string;
  valor: number | string | null;
  detalhe?: string;
}

const fmt = new Intl.NumberFormat("pt-BR");

/** Cartão de indicador. Valor nulo significa "ainda não disponível" (fase futura). */
export default function CartaoIndicador({ titulo, valor, detalhe }: Props) {
  const texto = valor === null ? "—" : typeof valor === "number" ? fmt.format(valor) : valor;
  return (
    <div className="card-flat flex min-w-0 flex-col gap-1 p-4">
      <p className="truncate text-xs font-medium text-muted">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums text-ink">{texto}</p>
      {(detalhe || valor === null) && (
        <p className="truncate text-xs text-muted">{valor === null ? "disponível em fase futura" : detalhe}</p>
      )}
    </div>
  );
}
