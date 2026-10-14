export const RESPONSAVEIS = ["EU", "PAI", "MÃE", "GISA"] as const;
export type Responsavel = (typeof RESPONSAVEIS)[number];
export type Responsavel = string;

/** Cor de cada responsável (usada no gráfico, na legenda e nos selos). */
export const COR_RESPONSAVEL: Record<Responsavel, string> = {
  EU: "#10b981",
  PAI: "#6366f1",
  "MÃE": "#f59e0b",
  GISA: "#ec4899",
};

export const CATEGORIAS = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Compras",
  "Outros",
];

export const BANCOS = ["Nubank", "Itaú", "Bradesco", "Caixa", "Banco do Brasil", "Inter", "Dinheiro", "Pix"];
export const CARTOES = ["Nubank", "Itaú", "Bradesco", "Inter", "C6", "Mercado Pago"];
export const FORMAS_PAGAMENTO = ["Boleto", "Pix", "Débito automático", "Cartão de crédito", "Dinheiro"];

/** `mes` sempre no formato "AAAA-MM" (ex.: "2026-10"). */
export type Extrato = {
  id: string;
  mes: string;
  pagamento: string;
  categoria: string;
  valor: number;
  descricao: string;
  responsavel: Responsavel;
};

export type Cartao = {
  id: string;
  mes: string;
  nome: string;
  cartao: string;
  parcelaAtual: number;
  parcelaTotal: number;
  categoria: string;
  valor: number; // valor da parcela
  responsavel: Responsavel;
};

export type ContaFixa = {
  id: string;
  mes: string;
  nome: string;
  pago: boolean;
  valor: number;
  responsavel: Responsavel;
  formaPagamento: string;
};

export type Config = {
  salario: number;
  investido: number;
  reservaAtual: number;
  reservaMeta: number;
};

export type Estado = {
  extrato: Extrato[];
  cartao: Cartao[];
  contas: ContaFixa[];
  config: Config;
};

export type Tabela = "extrato" | "cartao" | "contas";
