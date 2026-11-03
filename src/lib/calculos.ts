/**
 * LÓGICA ÚNICA DE CÁLCULO FINANCEIRO — resumo, gráficos, extrato e filtros usam este arquivo.
 *
 * - Entradas: dinheiro recebido = lançamentos do extrato com tipo "entrada" (salário, extras, reembolsos).
 *   Não existe salário automático: somente entradas lançadas manualmente são consideradas.
 * - Saídas (gasto do mês): lançamentos à vista + parcelas do mês + contas fixas do mês (regra original).
 * - Saldo restante = entradas − saídas.
 * - "Falta pagar" é só informativo: contas fixas ainda não marcadas como pagas.
 * - Sem duplicidade: a mesma parcela da mesma compra e o mesmo id contam uma vez.
 *   Pagamento de fatura não é lançado (as compras já contam); transferência própria não é lançada.
 * - Investimentos: aporte/resgate/rendimento ficam nas caixinhas e NÃO entram em entradas nem saídas.
 * - Repasses (transferência interna entre membros): NÃO são entrada externa. Quando o chamador informa
 *   `repassesRecebidos` (ver repassesRecebidosNoMes), esse valor entra só no saldo restante e na sobra que passa
 *   para o mês seguinte; `entradas` continua sendo só dinheiro externo. Sem essa opção, nada muda.
 */

type Item = Record<string, any>;
export type Origem = "extrato" | "cartao" | "contas";

const num = (v: unknown) => Number(v) || 0;
export const arred = (n: number) => Math.round(n * 100) / 100;
export const ehEntrada = (i: Item) => i?.tipo === "entrada";

export function semDuplicados<T extends Item>(itens: T[], origem: Origem): T[] {
  const vistos = new Set<string>();
  return (itens || []).filter((i) => {
    const porId = `id|${origem}|${i.id}`;
    const porParcela =
      origem === "cartao"
        ? `p|${i.cartao}|${i.nome ?? i.descricao}|${i.parcelaAtual ?? i.parcela_atual}/${i.parcelaTotal ?? i.parcela_total}|${i.mes}|${i.responsavel_id ?? i.responsavel}`
        : porId;
    if (vistos.has(porId) || vistos.has(porParcela)) return false;
    vistos.add(porId);
    vistos.add(porParcela);
    return true;
  });
}

const soma = (itens: Item[]) => arred(itens.reduce((s, i) => s + num(i?.valor), 0));

/** Mês (AAAA-MM) em que o repasse foi confirmado; sem data, vale o mês do lançamento. */
const mesDoRepasse = (i: Item): string => (i.repasse_pago_em ? String(i.repasse_pago_em).slice(0, 7) : String(i.mes));

/**
 * Repasses internos CONFIRMADOS no mês: dinheiro que um membro mandou para quem lançou a despesa.
 * - Conta uma vez só (semDuplicados) e pelo mês em que foi confirmado, não pelo mês da despesa.
 * - Só entra quando a despesa também conta na visão (itens "foraDoMeuSaldo" ficam de fora: o gasto é de outra
 *   pessoa e o repasse só acerta contas entre membros).
 * - `escopo` = ids das pessoas da visão (null = todo o grupo). Quem lançou e quem deve precisam estar no escopo;
 *   assim "Somente eu" nunca soma o que eu paguei a outra pessoa nem o que outra pessoa me pagou por algo fora da visão.
 * - Entradas nunca geram repasse.
 */
export function repassesRecebidosNoMes(
  e: { extrato?: Item[]; cartao?: Item[]; contas?: Item[] },
  mes: string,
  escopo: Set<string> | null = null,
): number {
  let total = 0;
  for (const o of ["extrato", "cartao", "contas"] as Origem[]) {
    for (const i of semDuplicados(e?.[o] || [], o)) {
      if (ehEntrada(i) || i.foraDoMeuSaldo) continue;
      if (!(i.repasse_pago ?? i.repassePago)) continue;
      const autor = i.owner_id;
      const resp = i.responsavel_id;
      if (!autor || !resp || autor === resp) continue;
      if (escopo && !(escopo.has(String(autor)) && escopo.has(String(resp)))) continue;
      if (mesDoRepasse(i) !== mes) continue;
      total += num(i.valor);
    }
  }
  return arred(total);
}

export type ResumoMes = {
  entradas: number;
  /** Repasses internos recebidos no mês (não são entrada externa; já somados no saldoRestante) */
  repassesRecebidos: number;
  saidas: number;
  saldoRestante: number;
  faltaPagar: number;
  porOrigem: { extrato: number; cartao: number; contas: number };
  porResponsavel: Record<string, number>;
};

export function calcularMes(
  e: { extrato?: Item[]; cartao?: Item[]; contas?: Item[] },
  opts: { mes: string; repassesRecebidos?: number },
): ResumoMes {
  // Itens marcados "foraDoMeuSaldo" (lançados por mim para outra pessoa, na visão "Somente eu") não entram:
  // o gasto é de quem é o responsável, e o repasse é só um acerto entre membros (nunca vira entrada/saída).
  const doMes = (o: Origem) => semDuplicados((e?.[o] || []).filter((i) => i?.mes === opts.mes && !i?.foraDoMeuSaldo), o);
  const extratoMes = doMes("extrato");
  const cartao = doMes("cartao");
  const contas = doMes("contas");
  const entradasLancadas = extratoMes.filter(ehEntrada);
  const extrato = extratoMes.filter((i) => !ehEntrada(i));

  const porOrigem = { extrato: soma(extrato), cartao: soma(cartao), contas: soma(contas) };
  const porResponsavel: Record<string, number> = {};
  for (const i of [...extrato, ...cartao, ...contas]) {
    const r = i?.responsavel || "Membro";
    porResponsavel[r] = arred((porResponsavel[r] || 0) + num(i?.valor));
  }

  const entradas = soma(entradasLancadas);
  const saidas = arred(porOrigem.extrato + porOrigem.cartao + porOrigem.contas);

  const repassesRecebidos = arred(num(opts.repassesRecebidos));

  return {
    entradas,
    repassesRecebidos,
    saidas,
    saldoRestante: arred(entradas + repassesRecebidos - saidas),
    faltaPagar: soma(contas.filter((i) => !i?.pago)),
    porOrigem,
    porResponsavel,
  };
}


const proximoMes = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  const d = new Date(a, mm, 1); // mm já é o mês seguinte (0-based)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * O que SOBROU dos meses anteriores e passa para `mes` (entra como entrada do mês).
 * Vai do primeiro mês com lançamentos até o mês anterior, acumulando mês a mês: sobra = entradas − saídas
 * (considerando somente as entradas efetivamente lançadas). Mês no vermelho não vira dívida para o
 * seguinte: a sobra nunca fica negativa. Sem lançamentos antes de `mes`, não há o que passar.
 */
export function sobraDosMesesAnteriores(
  e: { extrato?: Item[]; cartao?: Item[]; contas?: Item[] },
  mes: string,
  /** Informe para somar os repasses recebidos em cada mês anterior (escopo: ver repassesRecebidosNoMes). */
  repasses?: { escopo: Set<string> | null },
): number {
  const meses = [...(e.extrato || []), ...(e.cartao || []), ...(e.contas || [])]
    .map((i) => String(i?.mes || ""))
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && m < mes);
  if (meses.length === 0) return 0;
  let m = meses.reduce((a, b) => (a < b ? a : b));
  let sobra = 0;
  for (let n = 0; m < mes && n < 240; n++, m = proximoMes(m)) {
    const repassesRecebidos = repasses ? repassesRecebidosNoMes(e, m, repasses.escopo) : 0;
    sobra = Math.max(0, arred(sobra + calcularMes(e, { mes: m, repassesRecebidos }).saldoRestante));
  }
  return sobra;
}
