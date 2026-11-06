/**
 * FINANCEIRO DO GRUPO — visão de quem CRIOU os lançamentos para outros integrantes.
 *
 * Não é um segundo motor de cálculo: parte do `Painel` pessoal (calcularPainel com escopo = só eu) e dos lançamentos
 * que EU criei (autor = eu) para outro responsável (lancamentosDoGrupo). Nenhum saldo, caixinha, fatura ou despesa
 * particular de outro integrante entra: eles aparecem só como responsáveis pelos valores que usei por eles.
 *
 * - Meu disponível = o Total disponível do Meu financeiro (minhas entradas − minhas despesas, competência).
 * - Utilizado pelos integrantes = despesas que EU criei e em que o responsável é outro integrante, desde a criação,
 *   qualquer forma de pagamento. Minhas despesas pessoais e as de terceiros que não criei ficam de fora.
 * - Repasses recebidos = só os CONFIRMADOS por mim (no mês do recebimento). Pendente e "repassado" não contam.
 * - Disponível do grupo = meu disponível + repasses recebidos − utilizado pelos integrantes.
 *   Quando um integrante devolve, o disponível do grupo sobe e o pendente dele cai na mesma quantia (sem duplicar).
 * - Tudo é acumulado até o mês visto, como o Total disponível. Repasse nunca é entrada nem despesa.
 */
import { arred, mesEmBrasilia } from "./calculos";
import { lancamentosDoGrupo, type LancGrupo } from "./grupo";
import type { Painel } from "./painel";

type Dados = Parameters<typeof lancamentosDoGrupo>[0];

export type MembroRepasse = {
  id: string;
  nome: string;
  avatar: string | null;
  cor: string | null;
  /** Utilizado por ele até o mês visto (acumulado) */
  utilizado: number;
  /** Que ele já devolveu e eu confirmei até o mês visto (acumulado) */
  recebido: number;
  /** utilizado − recebido */
  pendente: number;
  /** Parte do pendente que ele já marcou como "Repassado" e espera a minha confirmação (ainda não conta como recebido) */
  aguardando: number;
  /** Utilizado só neste mês */
  utilizadoNoMes: number;
  /** Devolvido (confirmado) só neste mês, de qualquer mês de despesa */
  recebidoNoMes: number;
};

export type FinanceiroGrupo = {
  mes: string;
  /** Meu financeiro: o mesmo Total disponível do painel pessoal */
  meuDisponivel: number;
  utilizado: number;
  recebido: number;
  pendente: number;
  aguardando: number;
  utilizadoNoMes: number;
  recebidoNoMes: number;
  /** meuDisponivel + recebido − utilizado */
  disponivelGrupo: number;
  membros: MembroRepasse[];
};

export function financeiroDoGrupo(painel: Painel, dados: Dados, meuId: string): FinanceiroGrupo {
  const mes = painel.mes;
  const mesConfirmado = (l: LancGrupo) => mesEmBrasilia(l.repassePagoEm, l.mes);
  // Só o que eu criei para outro responsável, até o mês visto (parcelas e contas de meses futuros ainda não contam)
  const meus = lancamentosDoGrupo(dados, mes).filter((l) => l.autorId === meuId && l.respId !== meuId && l.mes <= mes);

  const porMembro = new Map<string, MembroRepasse>();
  for (const l of meus) {
    let m = porMembro.get(l.respId);
    if (!m) {
      m = { id: l.respId, nome: l.respNome, avatar: l.respAvatar, cor: l.respCor, utilizado: 0, recebido: 0, pendente: 0, aguardando: 0, utilizadoNoMes: 0, recebidoNoMes: 0 };
      porMembro.set(l.respId, m);
    }
    m.utilizado = arred(m.utilizado + l.valor);
    if (l.mes === mes) m.utilizadoNoMes = arred(m.utilizadoNoMes + l.valor);
    const confirmado = l.repassePago && mesConfirmado(l) <= mes;
    if (confirmado) {
      m.recebido = arred(m.recebido + l.valor);
      if (mesConfirmado(l) === mes) m.recebidoNoMes = arred(m.recebidoNoMes + l.valor);
    } else if (l.situacaoRepasse === "aguardando") {
      m.aguardando = arred(m.aguardando + l.valor);
    }
  }
  for (const m of porMembro.values()) m.pendente = arred(m.utilizado - m.recebido);
  const membros = [...porMembro.values()].sort((a, b) => b.pendente - a.pendente || b.utilizado - a.utilizado);
  const soma = (f: (m: MembroRepasse) => number) => arred(membros.reduce((s, m) => s + f(m), 0));

  const utilizado = soma((m) => m.utilizado);
  const recebido = soma((m) => m.recebido);
  return {
    mes,
    meuDisponivel: painel.totalDisponivel,
    utilizado,
    recebido,
    pendente: arred(utilizado - recebido),
    aguardando: soma((m) => m.aguardando),
    utilizadoNoMes: soma((m) => m.utilizadoNoMes),
    recebidoNoMes: soma((m) => m.recebidoNoMes),
    disponivelGrupo: arred(painel.totalDisponivel + recebido - utilizado),
    membros,
  };
}
