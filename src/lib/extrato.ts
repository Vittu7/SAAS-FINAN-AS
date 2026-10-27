import { ehEntrada, semDuplicados } from "./calculos";

export type Ordem = "" | "maior" | "menor";
export type OrigemLinha = "extrato" | "cartao" | "contas";

export const ROTULO_ORIGEM: Record<OrigemLinha, string> = {
  extrato: "Lançamentos do mês",
  cartao: "Contas parceladas",
  contas: "Contas fixas",
};

export const ICONE_ORIGEM: Record<OrigemLinha, string> = { extrato: "≡", cartao: "▤", contas: "▣" };

export type LinhaExtrato = {
  id: string;
  origem: OrigemLinha;
  descricao: string;
  categoria: string;
  forma: string;
  responsavel: string;
  responsavelCor?: string | null;
  responsavelAvatar?: string | null;
  /** Quem lançou (autor), quando é outra pessoa */
  autor?: string | null;
  autorAvatar?: string | null;
  autorCor?: string | null;
  /** Lançado por mim para outra pessoa (visão "Somente eu"): aparece, mas não entra nos meus totais */
  foraDoSaldo?: boolean;
  /** Valor a repassar já recebido? (somente quando há repasse) */
  repasse?: "pendente" | "aguardando" | "pago" | null;
  valor: number;
  status?: { texto: string; tom: "ok" | "alerta" | "neutro" };
  /** Entrada de dinheiro (ex.: salário) — aparece em verde e não entra em totais de gasto. */
  entrada?: boolean;
};

const num = (v: unknown) => Number(v) || 0;

/** Ordena por valor sem alterar o array original. Ordem vazia mantém a ordem recebida. */
export function ordenarPorValor<T extends { valor: number | string }>(itens: T[], ordem: Ordem): T[] {
  if (!ordem) return itens;
  const sinal = ordem === "maior" ? -1 : 1;
  return [...itens].sort((a, b) => sinal * (num(a.valor) - num(b.valor)));
}

/** Junta lançamentos, parcelas e contas fixas do mês numa lista única e padronizada. */
export function montarLinhas(extrato: any[], cartao: any[], contas: any[], mes?: string): LinhaExtrato[] {
  extrato = semDuplicados(extrato, "extrato");
  cartao = semDuplicados(cartao, "cartao");
  contas = semDuplicados(contas, "contas");
  const linhas: (LinhaExtrato & { mes: string })[] = [
    ...extrato.map((i) => ({
      id: `extrato-${i.id}`,
      mes: i.mes,
      origem: "extrato" as const,
      descricao: i.descricao || "—",
      categoria: i.categoria || "",
      forma: i.pagamento || "",
      responsavel: i.responsavel || "",
      responsavelCor: i.responsavelCor,
      responsavelAvatar: i.responsavelAvatar,
      autor: i.lancadoPorOutro ? i.autorNome : null,
      autorAvatar: i.autorAvatar,
      autorCor: i.autorCor,
      foraDoSaldo: Boolean(i.foraDoMeuSaldo),
      repasse: (i.repasseDevido ? (i.repassePago ? "pago" : i.repasseInformado ? "aguardando" : "pendente") : null) as "pendente" | "aguardando" | "pago" | null,
      valor: num(i.valor),
      entrada: ehEntrada(i),
    })),
    ...cartao.map((i) => ({
      id: `cartao-${i.id}`,
      mes: i.mes,
      origem: "cartao" as const,
      descricao: i.descricao || i.nome || "—",
      categoria: i.categoria || "",
      forma: i.cartao || "",
      responsavel: i.responsavel || "",
      responsavelCor: i.responsavelCor,
      responsavelAvatar: i.responsavelAvatar,
      autor: i.lancadoPorOutro ? i.autorNome : null,
      autorAvatar: i.autorAvatar,
      autorCor: i.autorCor,
      foraDoSaldo: Boolean(i.foraDoMeuSaldo),
      repasse: (i.repasseDevido ? (i.repassePago ? "pago" : i.repasseInformado ? "aguardando" : "pendente") : null) as "pendente" | "aguardando" | "pago" | null,
      valor: num(i.valor),
      status: { texto: `Parcela ${i.parcelaAtual ?? i.parcela_atual ?? 1}/${i.parcelaTotal ?? i.parcela_total ?? 1}`, tom: "neutro" as const },
    })),
    ...contas.map((i) => ({
      id: `contas-${i.id}`,
      mes: i.mes,
      origem: "contas" as const,
      descricao: i.nome || "—",
      categoria: i.categoria || "",
      forma: i.formaPagamento || i.forma_pagamento || "",
      responsavel: i.responsavel || "",
      responsavelCor: i.responsavelCor,
      responsavelAvatar: i.responsavelAvatar,
      autor: i.lancadoPorOutro ? i.autorNome : null,
      autorAvatar: i.autorAvatar,
      autorCor: i.autorCor,
      foraDoSaldo: Boolean(i.foraDoMeuSaldo),
      repasse: (i.repasseDevido ? (i.repassePago ? "pago" : i.repasseInformado ? "aguardando" : "pendente") : null) as "pendente" | "aguardando" | "pago" | null,
      valor: num(i.valor),
      status: i.pago ? { texto: "Paga", tom: "ok" as const } : { texto: "Pendente", tom: "alerta" as const },
    })),
  ];
  return linhas
    .filter((l) => !mes || l.mes === mes)
    .map(({ mes: _mes, ...l }): LinhaExtrato => l)
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}

export type GrupoExtrato = { origem: OrigemLinha; rotulo: string; total: number; linhas: LinhaExtrato[] };

/** Agrupa por origem, na ordem Lançamentos → Parcelas → Contas fixas, omitindo grupos vazios. */
export function agruparPorOrigem(linhas: LinhaExtrato[]): GrupoExtrato[] {
  return (["extrato", "cartao", "contas"] as OrigemLinha[])
    .map((origem) => {
      const doGrupo = linhas.filter((l) => l.origem === origem && !l.entrada);
      return { origem, rotulo: ROTULO_ORIGEM[origem], total: doGrupo.reduce((s, l) => s + l.valor, 0), linhas: doGrupo };
    })
    .filter((g) => g.linhas.length > 0);
}

export const totalGastos = (linhas: LinhaExtrato[]) => linhas.filter((l) => !l.entrada && !l.foraDoSaldo).reduce((s, l) => s + l.valor, 0);
