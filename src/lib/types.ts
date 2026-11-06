export type Responsavel = string;

export type Extrato = {
  id: string;
  mes: string;
  pagamento: string;
  categoria: string;
  valor: number;
  descricao: string;
  responsavel: Responsavel;
  /** "entrada" = dinheiro recebido; ausente ou "saida" = gasto */
  tipo?: "saida" | "entrada";
  /** Data do lançamento (AAAA-MM-DD); lançamentos antigos podem não ter */
  data?: string | null;
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
  /** Data da compra desta parcela (AAAA-MM-DD) */
  data?: string | null;
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
  /** Data em que foi paga (débito/dinheiro) ou cobrada no cartão (crédito). Vazio: vale o mês da linha */
  pago_em?: string | null;
  valor_variavel?: boolean;
  /** false = valor ainda é a previsão copiada do mês anterior */
  valor_confirmado?: boolean;
  /** Mês (AAAA-MM) a partir do qual a série não gera mais linhas */
  encerrada_em?: string | null;
};

export type Config = {
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