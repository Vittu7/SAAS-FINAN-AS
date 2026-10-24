/**
 * LÓGICA ÚNICA DE CÁLCULO FINANCEIRO — resumo, gráficos, extrato e filtros usam este arquivo.
 *
 * - Entradas: dinheiro recebido = lançamentos do extrato com tipo "entrada" (salário, extras, reembolsos).
 *   Compatibilidade: se o mês não tem nenhuma entrada lançada, usa o salário configurado.
 * - Saídas (gasto do mês): lançamentos à vista + parcelas do mês + contas fixas do mês (regra original).
 * - Saldo restante = entradas − saídas.
 * - "Falta pagar" é só informativo: contas fixas ainda não marcadas como pagas.
 * - Sem duplicidade: a mesma parcela da mesma compra e o mesmo id contam uma vez.
 *   Pagamento de fatura não é lançado (as compras já contam); transferência própria não é lançada.
 * - Investimentos: aporte/resgate/rendimento ficam nas caixinhas e NÃO entram em entradas nem saídas.
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

export type ResumoMes = {
  entradas: number;
  saidas: number;
  saldoRestante: number;
  fallbackSalario: boolean;
  faltaPagar: number;
  porOrigem: { extrato: number; cartao: number; contas: number };
  porResponsavel: Record<string, number>;
};

export function calcularMes(
  e: { extrato?: Item[]; cartao?: Item[]; contas?: Item[] },
  opts: { mes: string; salarioConfig?: number },
): ResumoMes {
  const doMes = (o: Origem) => semDuplicados((e?.[o] || []).filter((i) => i?.mes === opts.mes), o);
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

  const fallbackSalario = entradasLancadas.length === 0 && num(opts.salarioConfig) > 0;
  const entradas = fallbackSalario ? num(opts.salarioConfig) : soma(entradasLancadas);
  const saidas = arred(porOrigem.extrato + porOrigem.cartao + porOrigem.contas);

  return {
    entradas,
    saidas,
    saldoRestante: arred(entradas - saidas),
    fallbackSalario,
    faltaPagar: soma(contas.filter((i) => !i?.pago)),
    porOrigem,
    porResponsavel,
  };
}
