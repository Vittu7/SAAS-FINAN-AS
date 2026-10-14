export type Responsavel = string;

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