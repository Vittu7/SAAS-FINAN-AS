import { ehEntrada, semDuplicados } from "./calculos";
import { dataDoItem } from "./datas";

/** "" = padrão · valor · nome A→Z / Z→A · data mais recente / mais antiga · categoria A→Z */
export type Ordem = "" | "maior" | "menor" | "az" | "za" | "recente" | "antiga" | "categoria";

export const OPCOES_ORDEM: { id: Ordem; rotulo: string; grupo: string }[] = [
  { id: "recente", rotulo: "Data: mais recente primeiro", grupo: "Data" },
  { id: "antiga", rotulo: "Data: mais antiga primeiro", grupo: "Data" },
  { id: "az", rotulo: "Nome: A → Z", grupo: "Nome" },
  { id: "za", rotulo: "Nome: Z → A", grupo: "Nome" },
  { id: "maior", rotulo: "Valor: maior para menor", grupo: "Valor" },
  { id: "menor", rotulo: "Valor: menor para maior", grupo: "Valor" },
  { id: "categoria", rotulo: "Categoria: A → Z", grupo: "Outros" },
];
export type OrigemLinha = "extrato" | "cartao" | "contas";

export const ROTULO_ORIGEM: Record<OrigemLinha, string> = {
  extrato: "Lançamentos do mês",
  cartao: "Contas parceladas",
  contas: "Contas fixas",
};

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
  /** Data do lançamento (AAAA-MM-DD). Em conta fixa é o vencimento. */
  data?: string | null;
  status?: { texto: string; tom: "ok" | "alerta" | "neutro" };
  /** Entrada de dinheiro (ex.: salário) — aparece em verde e não entra em totais de gasto. */
  entrada?: boolean;
};

const num = (v: unknown) => Number(v) || 0;

const PT = (a: unknown, b: unknown) => String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { sensitivity: "base", numeric: true });
const nomeDe = (i: any) => i?.descricao ?? i?.nome ?? "";

/**
 * Ordena sem alterar o array original (aceita linhas do extrato ou linhas cruas do banco).
 * Ordem vazia mantém a ordem recebida. Sem data, o item vai para o fim; empates seguem pelo nome.
 */
export function ordenarPorValor<T extends { valor: number | string }>(itens: T[], ordem: Ordem): T[] {
  if (!ordem) return itens;
  const desempate = (a: any, b: any) => PT(nomeDe(a), nomeDe(b));
  const porData = (sinal: 1 | -1) => (a: any, b: any) => {
    const da = dataDoItem(a), db = dataDoItem(b);
    if (!da && !db) return desempate(a, b);
    if (!da) return 1;
    if (!db) return -1;
    return sinal * (da < db ? -1 : da > db ? 1 : 0) || desempate(a, b);
  };
  const comparar: Record<Exclude<Ordem, "">, (a: any, b: any) => number> = {
    maior: (a, b) => num(b.valor) - num(a.valor) || desempate(a, b),
    menor: (a, b) => num(a.valor) - num(b.valor) || desempate(a, b),
    az: (a, b) => desempate(a, b),
    za: (a, b) => desempate(b, a),
    recente: porData(-1),
    antiga: porData(1),
    categoria: (a, b) => PT(a.categoria, b.categoria) || desempate(a, b),
  };
  return [...itens].sort(comparar[ordem]);
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
      // "Repasse recebido" (linha automática) é entrada real; as demais linhas fora da visão continuam fora do saldo
      foraDoSaldo: Boolean(i.foraDoMeuSaldo) && !(i.repasseSintetico && ehEntrada(i)),
      repasse: (i.repasseDevido ? (i.repassePago ? "pago" : i.repasseInformado ? "aguardando" : "pendente") : null) as "pendente" | "aguardando" | "pago" | null,
      valor: num(i.valor),
      data: dataDoItem(i),
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
      data: dataDoItem(i),
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
      data: dataDoItem(i),
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
