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
 *     e como ENTRADA REAL "Repasse recebido" (+) no mês em que o repasse foi CONCLUÍDO (soma em entradas e no
 *     resultado do mês). Repasse pendente é só "a receber": não gera entrada.
 *   · Quem deve (responsável, com quem lançou fora da visão) já tem a despesa no resultado dele. O dinheiro só sai
 *     do bolso dele quando o repasse é CONCLUÍDO: até lá a despesa não reduz o disponível (fica em "a repassar")
 *     e, ao concluir, sai uma única vez. Assim "Somente eu" + "outra pessoa" sempre soma o mesmo que "Todos".
 * - CAIXINHAS: aporte feito "pagando com o saldo da conta" tira dinheiro do disponível no mês do aporte (e o resgate
 *   devolvido a uma conta volta). Não é despesa nem receita: entradas, saídas e "sobra do mês" não mudam.
 * - Os saldos por conta (Saldos e limites) são outro controle: dinheiro de cada conta de débito do usuário.
 *
 * REGRA DE COMPETÊNCIA (meses a partir de `mesCorteCaixa`; antes do corte, tudo acima continua valendo):
 * - Total disponível = saldo acumulado das MINHAS entradas − MINHAS despesas (crédito conta na compra; conta fixa
 *   pendente já está separada). Pagar fatura, adiantar para outro integrante e receber/enviar repasse NÃO mexem nele:
 *   cada valor é contado uma única vez, no mês da despesa. Repasse nunca é entrada nem despesa adicional.
 * - Despesa que outro integrante lançou para mim só entra aqui quando o autor CONFIRMA o recebimento do repasse, no
 *   mês original da despesa (ver aguardandoRepasseDoResponsavel). Pendente e "repassado" ainda não contam.
 * - O que os integrantes usaram e devolveram aparece no Financeiro do grupo (financeiroGrupo.ts), não aqui.
 */
import { arred, calcularMes, ehEntrada, mesDoRecebimento, semDuplicados } from "./calculos";
import { addMeses } from "./finance";
import { aguardandoRepasseDoResponsavel, lancamentosDoGrupo } from "./grupo";
import type { MovCaixinhaConta } from "./contas";
import { ajusteDeFaturas, compraDeTerceirosNoCredito, type PagamentoFatura } from "./pagamentoFatura";

type Item = Record<string, any>;
type Dados = { extrato?: Item[]; cartao?: Item[]; contas?: Item[] };
type Rep = { mes: string; valor: number; concluido: boolean; informado: boolean; mesRepasse: string; /** crédito do titular: o dinheiro só sai quando a fatura é paga (ver pagamentoFatura.ts) */ naFatura?: boolean };
export type ModoSaldo = "mes" | "total";

const num = (v: unknown) => Number(v) || 0;
const ORIGENS = ["extrato", "cartao", "contas"] as const;
const mesDoRepasse = (i: Item): string => mesDoRecebimento(i);

/** Despesas que EU adiantei para outra pessoa (a despesa está fora do meu resultado). */
function adiantamentos(e: Dados, naFatura: (o: (typeof ORIGENS)[number], i: Item) => boolean): Rep[] {
  const lista: Rep[] = [];
  for (const o of ORIGENS) {
    for (const i of semDuplicados(e[o] || [], o)) {
      if (!i.foraDoMeuSaldo || i.repasseSintetico || ehEntrada(i)) continue;
      if (!i.owner_id || !i.responsavel_id || i.owner_id === i.responsavel_id) continue;
      lista.push({ naFatura: naFatura(o, i), mes: String(i.mes), valor: num(i.valor), concluido: Boolean(i.repasse_pago ?? i.repassePago), informado: Boolean(i.repasse_informado ?? i.repasseInformado), mesRepasse: mesDoRepasse(i) });
    }
  }
  return lista;
}

/** Despesas lançadas por outra pessoa (fora da visão) em que EU sou o responsável: o repasse sai do meu bolso. */
function devidos(e: Dados, escopo: Set<string> | null): Rep[] {
  if (!escopo) return [];
  const lista: Rep[] = [];
  for (const o of ORIGENS) {
    for (const i of semDuplicados(e[o] || [], o)) {
      if (i.foraDoMeuSaldo || i.repasseSintetico || ehEntrada(i)) continue;
      if (!i.owner_id || !i.responsavel_id || i.owner_id === i.responsavel_id) continue;
      if (escopo.has(String(i.owner_id)) || !escopo.has(String(i.responsavel_id))) continue;
      lista.push({ mes: String(i.mes), valor: num(i.valor), concluido: Boolean(i.repasse_pago ?? i.repassePago), informado: Boolean(i.repasse_informado ?? i.repasseInformado), mesRepasse: mesDoRepasse(i) });
    }
  }
  return lista;
}

/**
 * Situação dos repasses de QUEM ESTÁ USANDO o app, independente do filtro de pessoas da tela.
 * Fluxo: pendente → (quem deve marca "Repassei") aguardando confirmação → (quem lançou confirma) concluído.
 * Aguardando continua em aberto: o dinheiro só entra/sai do saldo quando é confirmado.
 */
export type SituacaoRepassesPainel = {
  /** Eu lancei e ainda não me repassaram nem marcaram como repassado */
  aReceber: number;
  /** Já marcaram como "Repassado": falta eu confirmar o recebimento */
  aReceberAguardando: number;
  /** Eu devo e ainda não marquei "Repassei" */
  aRepassar: number;
  /** Eu já marquei "Repassei": falta quem lançou confirmar */
  aRepassarAguardando: number;
  /** Confirmados NESTE mês (dinheiro que entrou na minha conta) */
  recebidosNoMes: number;
  /** Confirmados NESTE mês (dinheiro que saiu da minha conta) */
  enviadosNoMes: number;
  /** Há alguma coisa para mostrar (aberto ou concluído no mês) */
  temMovimento: boolean;
};

export type Painel = {
  mes: string;
  /** Entradas EXTERNAS do mês (sem repasses e sem saldo anterior) */
  entradas: number;
  entradasPorOrigem: { rotulo: string; valor: number }[];
  saidas: number;
  /** Entradas − saídas do mês, sozinho */
  resultadoMes: number;
  /** Dinheiro acumulado até o fim do mês anterior (saldo inicial + meses anteriores + repasses concluídos) */
  saldoAnterior: number;
  /** Repasses concluídos NESTE mês: transferência interna que entrou no meu bolso */
  repassesRecebidos: number;
  /** Despesas de outras pessoas que eu paguei neste mês (saída de caixa, não é despesa minha). No crédito, é a parte das faturas pagas no mês */
  adiantado: number;
  /** Compras no crédito (de terceiros e, pela regra de caixa, também as do titular) em faturas ainda não pagas: já estão nas saídas, mas o dinheiro ainda não saiu */
  faturaEmAberto: number;
  /** Faturas pagas NESTE mês (regra de caixa): o dinheiro saiu da conta agora, mesmo que a compra seja de meses antes */
  faturasPagas: number;
  /** Adiantado até o mês, sem repasse concluído e ainda não marcado como "Repassado" */
  aReceber: number;
  /** Adiantado até o mês que já foi marcado como "Repassado" e espera a minha confirmação */
  aReceberAguardando: number;
  /** Repasses concluídos NESTE mês que saíram do meu bolso (a despesa já está no meu resultado) */
  repassesEnviados: number;
  /** Despesas minhas deste mês lançadas por outra pessoa: estão nas saídas, mas o dinheiro só sai quando o repasse é concluído */
  despesasARepassar: number;
  /** Despesas minhas lançadas por outra pessoa, ainda sem repasse concluído e sem "Repassei" (não reduzem o disponível até lá) */
  aRepassar: number;
  /** Já marquei como "Repassado": aguardando a confirmação de quem recebe */
  aRepassarAguardando: number;
  /** Aportes em caixinhas feitos NESTE mês com o saldo de uma conta (saíram do disponível; não são despesa) */
  aportesCaixinha: number;
  /** Resgates de caixinha NESTE mês devolvidos a uma conta (voltaram ao disponível; não são entrada) */
  resgatesCaixinha: number;
  /** Quanto dinheiro existe disponível ao fim do mês selecionado */
  totalDisponivel: number;
  /** Repasses do usuário (todas as situações), para o resumo sempre mostrar onde cada valor está */
  repasses: SituacaoRepassesPainel;
  /** O mês usa a regra de competência (total disponível = entradas − minhas despesas); antes do corte vale a regra antiga */
  regraCompetencia: boolean;
  /** Só na regra de competência: acertos NESTE mês de lançamentos anteriores ao corte (regra antiga): devolução recebida (+), repasse enviado (−), fatura de compra de terceiros paga (−) */
  acertosAnterioresAoCorte: number;

  /* ---- Indicadores do Resumo (derivados; não mudam nenhuma regra acima) ---- */
  /** Entrou: renda lançada no mês, sem repasses e sem saldo anterior */
  entradasRenda: number;
  /** Saiu: despesas realizadas no mês (à vista, parcelas, contas fixas pagas). Sem contas fixas pendentes. */
  saidasRealizadas: number;
  /** Contas fixas do mês ainda não pagas (já descontadas do total disponível pela regra atual) */
  contasPendentes: number;
  /** Entrou − Saiu */
  resultadoRealizado: number;
  /** Renda por origem (sem o repasse recebido) */
  rendaPorOrigem: { rotulo: string; valor: number }[];
  /** Saiu por tipo: à vista, parcelas e contas fixas pagas */
  saidasPorOrigem: { avista: number; parcelas: number; contasPagas: number };
  /**
   * Sobra prevista: quanto sobra quando as contas, faturas e repasses até este mês forem acertados.
   * = saldo inicial + Σ(entradas − todas as despesas do período) − aportes + resgates.
   * Identidade (testada): sobraPrevista = totalDisponivel + previsao.receber − previsao.repassar + previsao.faturasOutros.
   */
  sobraPrevista: number;
  previsao: {
    /** Repasses em aberto que você vai receber (o que foi adiantado para outras pessoas da visão) */
    receber: number;
    /** Repasses em aberto que você ainda vai pagar */
    repassar: number;
    /** Compras no crédito feitas para outras pessoas cuja fatura ainda não foi paga (negativo = ainda vai sair) */
    faturasOutros: number;
  };
};

export type LinhaComposicao = { rotulo: string; dica?: string; valor: number };

/**
 * "Como chegamos ao disponível": cada movimento que levou ao total disponível, na ordem em que acontece.
 * A soma das linhas é exatamente `totalDisponivel` (testado). Linhas zeradas ficam de fora, exceto o saldo anterior.
 */
export function composicaoDoDisponivel(p: Painel, rotuloMesAnterior: string): LinhaComposicao[] {
  if (p.regraCompetencia) {
    // Competência: só entra o que é meu. Fatura paga, adiantado e repasse não mexem no total (cada valor conta uma vez).
    const linhasCompetencia: LinhaComposicao[] = [
      { rotulo: `Saldo até ${rotuloMesAnterior}`, dica: "Saldo inicial das contas + meses anteriores", valor: p.saldoAnterior },
      { rotulo: "Entrou (renda do mês)", valor: p.entradasRenda },
      { rotulo: "Saiu (despesas do mês, inclusive no crédito)", dica: "A compra no crédito já foi descontada; pagar a fatura não desconta de novo", valor: -p.saidasRealizadas },
      { rotulo: "Contas fixas pendentes do mês", dica: "Já separadas do disponível até serem pagas", valor: -p.contasPendentes },
      { rotulo: "Acertos de lançamentos anteriores ao corte", dica: "Devoluções, repasses e faturas de meses que seguem a regra antiga", valor: p.acertosAnterioresAoCorte },
      { rotulo: "Aportes em caixinhas", dica: "Saíram do saldo, não são despesa", valor: -p.aportesCaixinha },
      { rotulo: "Resgates de caixinhas", valor: p.resgatesCaixinha },
    ];
    return linhasCompetencia.filter((l, i) => i === 0 || Math.abs(l.valor) >= 0.005);
  }
  const linhas: LinhaComposicao[] = [
    { rotulo: `Saldo até ${rotuloMesAnterior}`, dica: "Saldo inicial das contas + meses anteriores", valor: p.saldoAnterior },
    { rotulo: "Entrou (renda do mês)", valor: p.entradasRenda },
    { rotulo: "Repasses recebidos e confirmados", valor: p.repassesRecebidos },
    { rotulo: "Saiu (despesas realizadas)", valor: -p.saidasRealizadas },
    { rotulo: "Contas fixas pendentes do mês", dica: "Já separadas do disponível até serem pagas", valor: -p.contasPendentes },
    { rotulo: "Você pagou por outras pessoas", dica: "Volta quando elas repassarem", valor: -p.adiantado },
    { rotulo: "Compras no crédito ainda não pagas", dica: "Saem do saldo quando a fatura for paga", valor: p.faturaEmAberto },
    { rotulo: "Faturas pagas no mês", dica: "O dinheiro saiu da conta ao pagar a fatura", valor: -p.faturasPagas },
    { rotulo: "Gastos seus pagos por outra pessoa", dica: "Saem quando você repassar", valor: p.despesasARepassar },
    { rotulo: "Repasses que você enviou", valor: -p.repassesEnviados },
    { rotulo: "Aportes em caixinhas", dica: "Saíram do saldo, não são despesa", valor: -p.aportesCaixinha },
    { rotulo: "Resgates de caixinhas", valor: p.resgatesCaixinha },
  ];
  return linhas.filter((l, i) => i === 0 || Math.abs(l.valor) >= 0.005);
}

/**
 * Entradas e saídas realizadas dos últimos `n` meses até `mes` (para o gráfico do Resumo).
 * Usa o mesmo cálculo do mês (calcularMes): sem duplicados, sem repasses, sem contas fixas pendentes.
 */
export function serieEntradasSaidas(e: Dados, mes: string, n = 6): { mes: string; entrou: number; saiu: number }[] {
  const lista: { mes: string; entrou: number; saiu: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = addMeses(mes, -i);
    const r = calcularMes(e, { mes: m });
    lista.push({ mes: m, entrou: r.entradas, saiu: arred(r.saidas - r.faltaPagar) });
  }
  return lista;
}

export function calcularPainel(
  e: Dados,
  /** escopo = ids das pessoas da visão (null = todo o grupo) */
  opts: { mes: string; saldoInicial?: number; /** id de quem está usando o app (habilita o bloco de repasses) */ meuId?: string | null; /** lançamentos SEM filtro de pessoas, para os repasses (padrão: os mesmos de `e`) */ dadosRepasses?: Dados; escopo?: Set<string> | null; /** aportes/resgates de caixinha ligados a uma conta (só os do usuário) */ caixinhaMovs?: MovCaixinhaConta[]; /** nomes dos cartões de crédito do usuário (para saber o que é fatura) */ cartoesCredito?: string[]; /** pagamentos de fatura do usuário */ pagamentosFatura?: PagamentoFatura[]; /** a partir deste mês (AAAA-MM) vale a regra de caixa do crédito (ver ajusteDeFaturas); sem o campo, regra antiga */ mesCorteCaixa?: string | null },
): Painel {
  const { mes } = opts;
  // Sem `meuId` (ou sem cartões) nada é rastreado como fatura: vale a regra antiga (o adiantado sai na compra)
  const credito = new Set(opts.cartoesCredito ?? []);
  const adiant = adiantamentos(e, (o, i) => compraDeTerceirosNoCredito(o, i, opts.meuId, credito));
  const faturas = ajusteDeFaturas(opts.dadosRepasses ?? e, opts.pagamentosFatura ?? [], { meuId: opts.meuId, escopo: opts.escopo ?? null, cartoesCredito: credito, mesCorte: opts.mesCorteCaixa ?? null });
  const corte = opts.mesCorteCaixa ?? null;
  const regraCompetencia = (m: string) => corte !== null && m >= corte;
  // Competência: o que outro integrante lançou para mim só conta depois que o autor confirma o repasse
  const meuIdCompetencia = opts.meuId ? String(opts.meuId) : null;
  const eCompetencia: Dados = meuIdCompetencia
    ? Object.fromEntries(ORIGENS.map((o) => [o, (e[o] || []).filter((i) => !aguardandoRepasseDoResponsavel(i, meuIdCompetencia))])) as Dados
    : e;
  const deve = devidos(e, opts.escopo ?? null);
  const soma = (l: { valor: number }[]) => arred(l.reduce((s, a) => s + a.valor, 0));
  // Só aporte/resgate que usou o saldo de uma conta mexe no disponível (sem conta, o dinheiro não saiu do saldo)
  const movsCaixinha = (opts.caixinhaMovs || [])
    .filter((x) => x.conta && (x.tipo === "aporte" || x.tipo === "resgate") && /^\d{4}-\d{2}/.test(String(x.data)))
    .map((x) => ({ tipo: x.tipo, valor: num(x.valor), mes: String(x.data).slice(0, 7) }));
  const movimentoDoMes = (m: string) => {
    const nova = regraCompetencia(m);
    const r = calcularMes(nova ? eCompetencia : e, { mes: m });
    // Repasse de compra no crédito (regra de caixa) NÃO entra pelo dia do clique: compensa nos pagamentos da fatura
    const recebidos = arred(soma(adiant.filter((a) => a.concluido && a.mesRepasse === m && !(a.naFatura && corte !== null && a.mes >= corte))) + (faturas.recebido[m] || 0));
    // Competência: a despesa adiantada sai do caixa no mês em que foi lançada, mesmo que o repasse seja concluído depois.
    // O recebimento aumenta o caixa só no mês em que ocorre (acima); um mês passado nunca é recalculado por ele.
    const adiantadoMes = arred(soma(adiant.filter((a) => a.mes === m && !a.naFatura)) + (faturas.pago[m] || 0));
    const faturaAberta = faturas.emAberto[m] || 0;
    const faturasPagas = faturas.pagoCaixa[m] || 0;
    const enviados = soma(deve.filter((a) => a.concluido && a.mesRepasse === m));
    const aindaNaoSaiu = soma(deve.filter((a) => a.mes === m)); // despesa contada no resultado, dinheiro ainda não saiu
    const aportes = soma(movsCaixinha.filter((x) => x.tipo === "aporte" && x.mes === m));
    const resgates = soma(movsCaixinha.filter((x) => x.tipo === "resgate" && x.mes === m));
    // Competência: cada valor conta uma vez, no mês da despesa. Fatura paga, adiantado e repasse são acertos e não mexem aqui.
    // EXCEÇÃO (fronteira do corte): lançamento de mês ANTERIOR ao corte segue a regra antiga mesmo que o acerto aconteça
    // depois dele. O desconto já foi feito pela regra antiga no mês da despesa, então a devolução (ou o repasse enviado, ou
    // o pagamento da fatura de compra de terceiros) precisa ser acertada pela mesma regra, senão o valor sumiria ou duplicaria.
    const anteriorAoCorte = (a: Rep) => corte !== null && a.mes < corte;
    const recebidosLegado = nova ? soma(adiant.filter((a) => anteriorAoCorte(a) && a.concluido && a.mesRepasse === m)) : 0;
    const enviadosLegado = nova ? soma(deve.filter((a) => anteriorAoCorte(a) && a.concluido && a.mesRepasse === m)) : 0;
    const faturaLegado = nova ? faturas.pago[m] || 0 : 0; // só vem de faturas anteriores ao corte (regra antiga)
    const acertosLegado = arred(recebidosLegado - enviadosLegado - faturaLegado);
    const liquido = nova
      ? arred(r.saldoRestante - aportes + resgates + acertosLegado)
      : arred(r.saldoRestante + recebidos - adiantadoMes - faturasPagas + faturaAberta + aindaNaoSaiu - enviados - aportes + resgates);
    return { r, recebidos, adiantadoMes, faturaAberta, faturasPagas, enviados, aindaNaoSaiu, aportes, resgates, acertosLegado, liquido };
  };

  const meses = [...(e.extrato || []), ...(e.cartao || []), ...(e.contas || [])]
    .flatMap((i) => [String(i?.mes || ""), (i?.repasse_pago ?? i?.repassePago) ? mesDoRecebimento(i) : ""])
    .concat(movsCaixinha.map((x) => x.mes), Object.keys(faturas.pago), Object.keys(faturas.pagoCaixa), Object.keys(faturas.recebido))
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && m < mes);
  let saldoAnterior = arred(num(opts.saldoInicial));
  // Competência pura (tudo acertado): base da sobra prevista
  let competencia = arred(num(opts.saldoInicial));
  if (meses.length > 0) {
    let m = meses.reduce((a, b) => (a < b ? a : b));
    for (let n = 0; m < mes && n < 240; n++, m = addMeses(m, 1)) {
      const mov = movimentoDoMes(m);
      saldoAnterior = arred(saldoAnterior + mov.liquido);
      competencia = arred(competencia + mov.r.saldoRestante - mov.aportes + mov.resgates);
    }
  }

  const atual = movimentoDoMes(mes);
  competencia = arred(competencia + atual.r.saldoRestante - atual.aportes + atual.resgates);
  const extratoMes = semDuplicados((e.extrato || []).filter((i) => i?.mes === mes && !i?.foraDoMeuSaldo && ehEntrada(i)), "extrato");
  const porOrigem = new Map<string, number>();
  for (const i of extratoMes) {
    const rotulo = String(i.categoria || i.descricao || "Entrada");
    porOrigem.set(rotulo, arred((porOrigem.get(rotulo) || 0) + num(i.valor)));
  }
  const entradasPorOrigem = [...porOrigem.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor);

  const emAberto = (l: Rep[]) => l.filter((a) => a.mes <= mes && !(a.concluido && a.mesRepasse <= mes));
  const aReceberAberto = emAberto(adiant);
  const aRepassarAberto = emAberto(deve);

  // Repasses do usuário: lê direto da lista do grupo (não depende do filtro de pessoas nem de "foraDoMeuSaldo"),
  // então o valor marcado como "Repassado" nunca some do resumo: ele passa a aparecer em "aguardando confirmação".
  const meuId = opts.meuId ? String(opts.meuId) : "";
  const repasses: SituacaoRepassesPainel = { aReceber: 0, aReceberAguardando: 0, aRepassar: 0, aRepassarAguardando: 0, recebidosNoMes: 0, enviadosNoMes: 0, temMovimento: false };
  if (meuId) {
    for (const l of lancamentosDoGrupo(opts.dadosRepasses ?? e, mes)) {
      const euLancei = l.autorId === meuId;
      const euDevo = l.respId === meuId;
      if (!euLancei && !euDevo) continue;
      if (l.repassePago) {
        if (l.mesRecebimento !== mes) continue;
        if (euLancei) repasses.recebidosNoMes = arred(repasses.recebidosNoMes + l.valor);
        else repasses.enviadosNoMes = arred(repasses.enviadosNoMes + l.valor);
        continue;
      }
      if (l.mes > mes) continue; // parcelas e contas de meses futuros ainda não vencem
      const aguardando = l.situacaoRepasse === "aguardando";
      if (euLancei) { if (aguardando) repasses.aReceberAguardando = arred(repasses.aReceberAguardando + l.valor); else repasses.aReceber = arred(repasses.aReceber + l.valor); }
      else if (aguardando) repasses.aRepassarAguardando = arred(repasses.aRepassarAguardando + l.valor);
      else repasses.aRepassar = arred(repasses.aRepassar + l.valor);
    }
    repasses.temMovimento = repasses.aReceber + repasses.aReceberAguardando + repasses.aRepassar + repasses.aRepassarAguardando + repasses.recebidosNoMes + repasses.enviadosNoMes > 0;
  }

  const nova = regraCompetencia(mes);
  const totalDisponivel = arred(saldoAnterior + atual.liquido);
  const receber = arred(soma(aReceberAberto));
  const repassar = arred(soma(aRepassarAberto));
  const saidasRealizadas = arred(atual.r.saidas - atual.r.faltaPagar);

  return {
    entradasRenda: atual.r.entradas,
    saidasRealizadas,
    contasPendentes: atual.r.faltaPagar,
    resultadoRealizado: arred(atual.r.entradas - saidasRealizadas),
    rendaPorOrigem: entradasPorOrigem,
    saidasPorOrigem: { avista: atual.r.porOrigem.extrato, parcelas: atual.r.porOrigem.cartao, contasPagas: arred(atual.r.porOrigem.contas - atual.r.faltaPagar) },
    sobraPrevista: competencia,
    // Regra antiga: o ajuste de faturas fecha a identidade (compras no crédito para outros ainda não pagas).
    // Competência: receber/repassar são informativos; sobraPrevista = totalDisponivel + faturasOutros (resíduo só de meses antes do corte).
    previsao: { receber, repassar, faturasOutros: arred(competencia - totalDisponivel - (nova ? 0 : receber - repassar)) },
    mes,
    // Regra antiga: repasse concluído = entrada real de quem recebeu (compensa o "adiantado").
    // Competência: repasse é acerto entre integrantes, nunca entrada nem resultado.
    entradas: nova ? atual.r.entradas : arred(atual.r.entradas + atual.recebidos),
    entradasPorOrigem: !nova && atual.recebidos > 0 ? [...entradasPorOrigem, { rotulo: "Repasse recebido", valor: atual.recebidos }].sort((a, b) => b.valor - a.valor) : entradasPorOrigem,
    saidas: atual.r.saidas,
    resultadoMes: nova ? atual.r.saldoRestante : arred(atual.r.saldoRestante + atual.recebidos),
    saldoAnterior,
    repassesRecebidos: atual.recebidos,
    adiantado: atual.adiantadoMes,
    faturaEmAberto: atual.faturaAberta,
    faturasPagas: atual.faturasPagas,
    aReceber: soma(aReceberAberto.filter((a) => !a.informado)),
    aReceberAguardando: soma(aReceberAberto.filter((a) => a.informado)),
    repassesEnviados: atual.enviados,
    despesasARepassar: atual.aindaNaoSaiu,
    aRepassar: soma(aRepassarAberto.filter((a) => !a.informado)),
    aRepassarAguardando: soma(aRepassarAberto.filter((a) => a.informado)),
    aportesCaixinha: atual.aportes,
    resgatesCaixinha: atual.resgates,
    totalDisponivel,
    repasses,
    regraCompetencia: nova,
    acertosAnterioresAoCorte: nova ? atual.acertosLegado : 0,
  };
}
