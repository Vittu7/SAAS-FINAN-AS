/** Datas dos lançamentos (AAAA-MM-DD). Funções puras, sem fuso: trabalham só com o texto da data. */

const dois = (n: number) => String(n).padStart(2, "0");

export const diasNoMes = (mes: string): number => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(a, m, 0).getDate();
};

export const hojeISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

/** Data sugerida para um lançamento no mês escolhido: hoje, se hoje cai nele; senão, o dia 1. */
export const dataPadraoDoMes = (mes: string): string => {
  const hoje = hojeISO();
  return hoje.slice(0, 7) === mes ? hoje : `${mes}-01`;
};

/** Mesma data N meses depois (o dia é ajustado se o mês for mais curto: 31/01 → 28/02). */
export const somarMesesData = (iso: string, n: number): string => {
  const [a, m, d] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ym = `${ano}-${dois(mes)}`;
  return `${ym}-${dois(Math.min(d, diasNoMes(ym)))}`;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const dataValida = (v: unknown): v is string => typeof v === "string" && ISO.test(v);

/**
 * Data de um lançamento (linha do banco ou linha do extrato):
 *  - se tem a data gravada, usa ela;
 *  - conta fixa: dia do vencimento dentro do mês;
 *  - lançamentos antigos (sem data): o dia em que foram criados, só se caírem no próprio mês do lançamento.
 */
export function dataDoItem(i: any): string | null {
  if (dataValida(i?.data)) return i.data;
  const mes = String(i?.mes ?? "");
  if (i?.vencimento && /^\d{4}-\d{2}$/.test(mes)) return `${mes}-${dois(Math.min(Math.max(1, Number(i.vencimento) || 1), diasNoMes(mes)))}`;
  const criado = String(i?.created_at ?? "").slice(0, 10);
  if (dataValida(criado) && criado.slice(0, 7) === mes) return criado;
  return null;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-05" → "05 nov". */
export function rotuloData(iso?: string | null): string {
  if (!iso || !dataValida(iso)) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${dois(d)} ${MESES[m - 1]}`;
}
