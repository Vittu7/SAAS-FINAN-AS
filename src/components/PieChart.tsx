export type Fatia = { rotulo: string; valor: number; cor: string };

/**
 * Pizza feita com círculos de traço grosso (stroke-dasharray):
 * raio 45 + traço 90 preenche o círculo inteiro. Funciona com 1 fatia só.
 */
export default function PieChart({ fatias }: { fatias: Fatia[] }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const R = 45;
  const C = 2 * Math.PI * R;
  let acumulado = 0;

  const descricao = fatias.map((f) => `${f.rotulo}: ${f.valor.toFixed(2)} reais`).join("; ");

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`Gastos por responsável. ${descricao}`}
      className="mx-auto size-48 -rotate-90"
    >
      <circle cx="100" cy="100" r="90" fill="var(--line)" />
      {total > 0 &&
        fatias
          .filter((f) => f.valor > 0)
          .map((f) => {
            const tamanho = (f.valor / total) * C;
            const fatia = (
              <circle
                key={f.rotulo}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={f.cor}
                strokeWidth={90}
                strokeDasharray={`${tamanho} ${C - tamanho}`}
                strokeDashoffset={-acumulado}
              />
            );
            acumulado += tamanho;
            return fatia;
          })}
      {/* Borda na cor da superfície separa as fatias do fundo */}
      <circle cx="100" cy="100" r="90" fill="none" stroke="var(--surface)" strokeWidth="4" />
    </svg>
  );
}
