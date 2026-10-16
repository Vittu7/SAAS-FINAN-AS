export type Responsavel = string;

export const RESPONSAVEIS: string[] = ["TODOS", "EU"];

export const COR_RESPONSAVEL: Record<string, string> = {
  Geral: "#3b82f6",
};

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
  descricao?: string;
  cartao: string;
  parcelaAtual: number;
  parcelaTotal: number;
  categoria: string;
  valor: number;
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
  categoria?: string;
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