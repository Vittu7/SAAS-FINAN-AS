export type Coluna = { nome: string; direita?: boolean; oculta?: boolean };

type Props = {
  titulo: string;
  descricao: string;
  total: string;
  rotuloTotal?: string;
  colunas: Coluna[];
  acoes?: React.ReactNode;
  children: React.ReactNode;
};

/** Casca comum às três tabelas: título, total do mês e cabeçalho de colunas. */
export function TabelaCard({ titulo, descricao, total, rotuloTotal = "Total do mês", colunas, acoes, children }: Props) {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="text-sm text-muted">{descricao}</p>
        </div>
        <div className="flex items-center gap-4">
          {acoes}
          <p className="text-right">
            <span className="block text-xs text-muted">{rotuloTotal}</span>
            <span className="text-lg font-semibold tabular-nums">{total}</span>
          </p>
        </div>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-line text-left text-xs text-muted">
              {colunas.map((c) => (
                <th
                  key={c.nome || "acoes"}
                  scope="col"
                  className={`px-3 py-2 font-medium first:pl-5 last:pr-5 ${c.direita ? "text-right" : ""}`}
                >
                  {c.oculta ? <span className="sr-only">{c.nome}</span> : c.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr]:border-line/70 [&_td]:px-3 [&_td]:py-2 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
            {children}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LinhaVazia({ colunas, texto }: { colunas: number; texto: string }) {
  return (
    <tr>
      <td colSpan={colunas} className="!py-8 text-center text-muted">
        {texto}
      </td>
    </tr>
  );
}
