import { mesAtual } from "./finance";

export type TipoMovimento = "aporte" | "resgate" | "rendimento";
export type TipoRendimento = "poupanca" | "cdb" | "conta_remunerada" | "outro";
export type OrigemMovimento = "manual" | "automatico";

export type Caixinha = {
  id: string;
  nome: string;
  ehReserva: boolean;
  rendimento: string;
  meta: number;
  saldo: number;
  aporteAutoAtivo: boolean;
  aporteAutoValor: number;
  /** 'YYYY-MM' do último mês em que a sugestão de aporte automático foi confirmada ou dispensada */
  ultimoMesAuto: string | null;
  exibirNaHome: boolean;
  cor: string;
  /** Onde o dinheiro está guardado (ex.: Nubank, Caixa) */
  banco: string;
  tipoRendimento: TipoRendimento | null;
  /** 'YYYY-MM' do último lembrete de rendimento tratado (registrado ou dispensado) */
  ultimoMesRendimento: string | null;
};

export type Movimento = {
  id: string;
  caixinhaId: string;
  tipo: TipoMovimento;
  valor: number;
  /** YYYY-MM-DD */
  data: string;
  descricao: string;
  origem: OrigemMovimento;
};

/** Dados do formulário de cadastro/edição. `saldo` é o saldo desejado (na edição, a diferença vira um ajuste no histórico). */
export type DadosCaixinha = {
  nome: string;
  ehReserva: boolean;
  rendimento: string;
  meta: number;
  saldo: number;
  aporteAutoAtivo: boolean;
  aporteAutoValor: number;
  exibirNaHome: boolean;
  cor: string;
  banco: string;
  tipoRendimento: TipoRendimento | null;
};

export type NovoMovimento = {
  caixinhaId: string;
  tipo: TipoMovimento;
  valor: number;
  data: string;
  descricao?: string;
  origem?: OrigemMovimento;
};

export const TIPOS_RENDIMENTO: { id: TipoRendimento; nome: string }[] = [
  { id: "poupanca", nome: "Poupança" },
  { id: "cdb", nome: "CDB" },
  { id: "conta_remunerada", nome: "Conta remunerada" },
  { id: "outro", nome: "Outro" },
];

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = { aporte: "Aporte", rendimento: "Rendimento", resgate: "Resgate" };

export const CORES_CAIXINHA = ["#10B981", "#6366F1", "#F59E0B", "#EC4899", "#8B5CF6", "#3B82F6", "#14B8A6", "#EF4444"];

type Linha = Record<string, unknown>;

export const caixinhaDeLinha = (l: Linha): Caixinha => ({
  id: String(l.id),
  nome: String(l.nome ?? ""),
  ehReserva: Boolean(l.eh_reserva_emergencia),
  rendimento: String(l.rendimento ?? ""),
  meta: Number(l.meta) || 0,
  saldo: Number(l.saldo) || 0,
  aporteAutoAtivo: Boolean(l.aporte_auto_ativo),
  aporteAutoValor: Number(l.aporte_auto_valor) || 0,
  ultimoMesAuto: l.ultimo_mes_auto ? String(l.ultimo_mes_auto) : null,
  exibirNaHome: Boolean(l.exibir_na_home),
  cor: String(l.cor || CORES_CAIXINHA[0]),
  banco: String(l.banco ?? ""),
  tipoRendimento: TIPOS_RENDIMENTO.some((t) => t.id === l.tipo_rendimento) ? (l.tipo_rendimento as TipoRendimento) : null,
  ultimoMesRendimento: l.ultimo_mes_rendimento ? String(l.ultimo_mes_rendimento) : null,
});

export const movimentoDeLinha = (l: Linha): Movimento => ({
  id: String(l.id),
  caixinhaId: String(l.caixinha_id),
  tipo: l.tipo === "resgate" ? "resgate" : l.tipo === "rendimento" ? "rendimento" : "aporte",
  valor: Number(l.valor) || 0,
  data: String(l.data ?? "").slice(0, 10),
  descricao: String(l.descricao ?? ""),
  origem: l.origem === "automatico" ? "automatico" : "manual",
});

export const arred2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Progresso (0–100) em direção à meta; 0 quando não há meta. */
export const progressoCaixinha = (c: Pick<Caixinha, "saldo" | "meta">) =>
  c.meta > 0 ? Math.min(100, (c.saldo / c.meta) * 100) : 0;

export const metaAtingida = (c: Pick<Caixinha, "saldo" | "meta">) => c.meta > 0 && c.saldo >= c.meta;

/** Data local de hoje em YYYY-MM-DD (toISOString usaria UTC e erraria o dia à noite no Brasil). */
export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Número → texto de campo ("1234.5" → "1234,5"; zero → vazio). */
export const decimalTexto = (n: number) => (n ? String(n).replace(".", ",") : "");

/** Caixinhas com aporte automático ainda não tratado (confirmado ou dispensado) no mês informado. */
export function sugestoesDoMes(caixinhas: Caixinha[], mes: string = mesAtual()): Caixinha[] {
  return caixinhas.filter((c) => c.aporteAutoAtivo && c.aporteAutoValor > 0 && (c.ultimoMesAuto ?? "") < mes);
}

/** Rótulo curto de onde o dinheiro está: "CDB · Nubank". */
export function rotuloLocal(c: Pick<Caixinha, "banco" | "tipoRendimento">): string {
  const tipo = TIPOS_RENDIMENTO.find((t) => t.id === c.tipoRendimento)?.nome;
  return [tipo, c.banco.trim()].filter(Boolean).join(" · ");
}

/** Soma dos rendimentos lançados no histórico (de uma caixinha ou de todas). */
export const totalRendimentos = (movimentos: Movimento[], caixinhaId?: string) =>
  arred2(movimentos.filter((m) => m.tipo === "rendimento" && (!caixinhaId || m.caixinhaId === caixinhaId)).reduce((t, m) => t + m.valor, 0));

/** Caixinhas com saldo cujo rendimento do mês anterior ainda não foi registrado nem dispensado. */
export function sugestoesRendimento(caixinhas: Caixinha[], mes: string = mesAtual()): Caixinha[] {
  return caixinhas.filter((c) => c.saldo > 0 && c.ultimoMesRendimento !== null && c.ultimoMesRendimento < mes);
}
