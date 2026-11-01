/**
 * PAINEL FINANCEIRO — separa o RESULTADO DO MÊS da SITUAÇÃO ACUMULADA (dinheiro disponível).
 *
 * - Resultado do mês = entradas externas − saídas do mês (calcularMes). Não inclui repasses nem meses anteriores.
 * - Total disponível = saldo inicial + resultado de todos os meses até o selecionado + repasses concluídos.
 *   É uma soma corrida: pode ficar negativa e um mês no vermelho não apaga o que veio dos anteriores.
 * - REPASSES são transferência interna, nunca receita nem despesa:
 *   · Todos / pessoas envolvidas na visão: a despesa já conta uma vez (é de quem deve) e quem enviou e quem
 *     recebeu estão na visão, então o repasse se anula. Nenhuma linha extra.
 *   · Visão em que só quem LANÇOU está presente (ex.: "Somente eu"): a despesa da outra pessoa fica fora do
 *     resultado (foraDoMeuSaldo), mas o dinheiro saiu do meu bolso. Entra como ADIANTADO (−) no mês da despesa
 *     e como REPASSE RECEBIDO (+) no mês em que o repasse foi CONCLUÍDO. Repasse pendente não devolve nada.
 *   · Quem deve (responsável, com quem lançou fora da visão) já tem a despesa no resultado dele. O dinheiro só sai
 *     do bolso dele quando o repasse é CONCLUÍDO: até lá a despesa não reduz o disponível (fica em "a repassar")
 *     e, ao concluir, sai uma única vez. Assim "Somente eu" + "outra pessoa" sempre soma o mesmo que "Todos".
 * - Os saldos por conta (Saldos e limites) são outro controle: dinheiro de cada conta de débito do usuário.
 */
import { arred, calcularMes, ehEntrada, semDuplicados } from "./calculos";
import { addMeses } from "./finance";

type Item = Record<string, any>;
type Dados = { extrato?: Item[]; cartao?: Item[]; contas?: Item[] };
export type ModoSaldo = "mes" | "total";

const num = (v: unknown) => Number(v) || 0;
const ORIGENS = ["extrato", "cartao", "contas"] as const;
const mesDoRepasse = (i: Item): string => (i.repasse_pago_em ? String(i.repasse_pago_em).slice(0, 7) : String(i.mes));

/** Despesas que EU adiantei para outra pessoa (a despesa está fora do meu resultado). */
function adiantamentos(e: Dados): { mes: string; valor: number; concluido: boolean; mesRepasse: string }[] {
  const lista: { mes: string; valor: number; concluido: boolean; mesRepasse: string }[] = [];
  for (const o of ORIGENS) {
    for (const i of semDuplicados(e[o] || [], o)) {
      if (!i.foraDoMeuSaldo || i.repasseSintetico || ehEntrada(i)) continue;
      if (!i.owner_id || !i.responsavel_id || i.owner_id === i.responsavel_id) continue;
      lista.push({ mes: String(i.mes), valor: num(i.valor), concluido: Boolean(i.repasse_pago ?? i.repassePago), mesRepasse: mesDoRepasse(i) });
    }
  }
  return lista;
}

/** Despesas lançadas por outra pessoa (fora da visão) em que EU sou o responsável: o repasse sai do meu bolso. */
function devidos(e: Dados, escopo: Set<string> | null): { mes: string; valor: number; concluido: boolean; mesRepasse: string }[] {
  if (!escopo) return [];
  const lista: { mes: string; valor: number; concluido: boolean; mesRepasse: string }[] = [];
  for (const o of ORIGENS) {
    for (const i of semDuplicados(e[o] || [], o)) {
      if (i.foraDoMeuSaldo || i.repasseSintetico || ehEntrada(i)) continue;
      if (!i.owner_id || !i.responsavel_id || i.owner_id === i.responsavel_id) continue;
      if (escopo.has(String(i.owner_id)) || !escopo.has(String(i.responsavel_id))) continue;
      lista.push({ mes: String(i.mes), valor: num(i.valor), concluido: Boolean(i.repasse_pago ?? i.repassePago), mesRepasse: mesDoRepasse(i) });
    }
  }
  return lista;
}

export type Painel = {
  mes: string;
  /** Entradas EXTERNAS do mês (sem repasses e sem saldo anterior) */
  entradas: number;
  entradasPorOrigem: { rotulo: string; valor: number }[];
  usandoSalarioConfigurado: boolean;
  saidas: number;
  /** Entradas − saídas do mês, sozinho */
  resultadoMes: number;
  /** Dinheiro acumulado até o fim do mês anterior (saldo inicial + meses anteriores + repasses concluídos) */
  saldoAnterior: number;
  /** Repasses concluídos NESTE mês: transferência interna que entrou no meu bolso */
  repassesRecebidos: number;
  /** Despesas de outras pessoas que eu paguei neste mês (saída de caixa, não é despesa minha) */
  adiantado: number;
  /** Adiantado até o mês e ainda sem repasse concluído */
  aReceber: number;
  /** Repasses concluídos NESTE mês que saíram do meu bolso (a despesa já está no meu resultado) */
  repassesEnviados: number;
  /** Despesas minhas lançadas por outra pessoa, ainda sem repasse concluído (não reduzem o disponível até lá) */
  aRepassar: number;
  /** Quanto dinheiro existe disponível ao fim do mês selecionado */
  totalDisponivel: number;
};

export function calcularPainel(
  e: Dados,
  /** escopo = ids das pessoas da visão (null = todo o grupo) */
  opts: { mes: string; saldoInicial?: number; salarioConfig?: number; escopo?: Set<string> | null },
): Painel {
  const { mes } = opts;
  const salarioConfig = opts.salarioConfig ?? 0;
  const adiant = adiantamentos(e);
  const deve = devidos(e, opts.escopo ?? null);
  const soma = (l: { valor: number }[]) => arred(l.reduce((s, a) => s + a.valor, 0));
  const movimentoDoMes = (m: string) => {
    const r = calcularMes(e, { mes: m, salarioConfig });
    const recebidos = soma(adiant.filter((a) => a.concluido && a.mesRepasse === m));
    const adiantadoMes = soma(adiant.filter((a) => a.mes === m));
    const enviados = soma(deve.filter((a) => a.concluido && a.mesRepasse === m));
    const aindaNaoSaiu = soma(deve.filter((a) => a.mes === m)); // despesa contada no resultado, dinheiro ainda não saiu
    return { r, recebidos, adiantadoMes, enviados, liquido: arred(r.saldoRestante + recebidos - adiantadoMes + aindaNaoSaiu - enviados) };
  };

  const meses = [...(e.extrato || []), ...(e.cartao || []), ...(e.contas || [])]
    .flatMap((i) => [String(i?.mes || ""), i?.repasse_pago_em ? String(i.repasse_pago_em).slice(0, 7) : ""])
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && m < mes);
  let saldoAnterior = arred(num(opts.saldoInicial));
  if (meses.length > 0) {
    let m = meses.reduce((a, b) => (a < b ? a : b));
    for (let n = 0; m < mes && n < 240; n++, m = addMeses(m, 1)) saldoAnterior = arred(saldoAnterior + movimentoDoMes(m).liquido);
  }

  const atual = movimentoDoMes(mes);
  const extratoMes = semDuplicados((e.extrato || []).filter((i) => i?.mes === mes && !i?.foraDoMeuSaldo && ehEntrada(i)), "extrato");
  const porOrigem = new Map<string, number>();
  for (const i of extratoMes) {
    const rotulo = String(i.categoria || i.descricao || "Entrada");
    porOrigem.set(rotulo, arred((porOrigem.get(rotulo) || 0) + num(i.valor)));
  }
  const entradasPorOrigem = atual.r.fallbackSalario
    ? [{ rotulo: "Salário configurado", valor: atual.r.entradas }]
    : [...porOrigem.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor);

  const aReceber = arred(adiant.filter((a) => a.mes <= mes && !(a.concluido && a.mesRepasse <= mes)).reduce((s, a) => s + a.valor, 0));
  return {
    mes,
    entradas: atual.r.entradas,
    entradasPorOrigem,
    usandoSalarioConfigurado: atual.r.fallbackSalario,
    saidas: atual.r.saidas,
    resultadoMes: atual.r.saldoRestante,
    saldoAnterior,
    repassesRecebidos: atual.recebidos,
    adiantado: atual.adiantadoMes,
    aReceber,
    repassesEnviados: atual.enviados,
    aRepassar: arred(deve.filter((a) => a.mes <= mes && !(a.concluido && a.mesRepasse <= mes)).reduce((s, a) => s + a.valor, 0)),
    totalDisponivel: arred(saldoAnterior + atual.liquido),
  };
}
