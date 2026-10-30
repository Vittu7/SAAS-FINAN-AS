/**
 * Lançamentos do grupo, repasses e resumo por membro.
 *
 * REGRAS (sem contar nada duas vezes):
 * - O GASTO pertence ao responsável (responsavel_id): é ele quem tem a despesa no saldo.
 * - O REPASSE é só um acerto entre pessoas: quando o autor (owner_id) lança algo para outro responsável,
 *   o responsável passa a dever esse valor ao autor. Marcar como recebido NUNCA cria entrada nem saída;
 *   apenas muda a situação do repasse. Por isso entradas, saídas e saldo não mudam.
 * - Entradas nunca geram repasse.
 */
import { arred, calcularMes, semDuplicados } from "./calculos";
import { mesAtual } from "./finance";

type Item = Record<string, any>;
export type OrigemGrupo = "extrato" | "cartao" | "contas";
export type TipoGrupo = "avista" | "parcelada" | "fixa";
/** pendente → (quem deve marca) aguardando → (quem recebeu confirma) concluido */
export type SituacaoRepasse = "pendente" | "aguardando" | "concluido";

export const situacaoDoRepasse = (pago: boolean, informado: boolean): SituacaoRepasse => (pago ? "concluido" : informado ? "aguardando" : "pendente");

export type LancGrupo = {
  chave: string;
  id: string;
  origem: OrigemGrupo;
  tipo: TipoGrupo;
  tipoRotulo: "À vista" | "Parcelada" | "Conta fixa";
  descricao: string;
  categoria: string;
  forma: string;
  valor: number;
  mes: string;
  parcela: string | null;
  vencimento: number | null;
  contaPaga: boolean | null; // só contas fixas
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  autorCor: string | null;
  respId: string;
  respNome: string;
  respAvatar: string | null;
  respCor: string | null;
  /** Concluído: quem recebeu confirmou */
  repassePago: boolean;
  repassePagoEm: string | null;
  /** Quem deve marcou "Repassado" (aguardando a confirmação de quem recebeu) */
  repasseInformado: boolean;
  repasseInformadoEm: string | null;
  situacaoRepasse: SituacaoRepasse;
  /** Mês já chegou (vencido ou do mês atual)? Parcelas e contas futuras ficam "a vencer". */
  vencido: boolean;
};

const ROTULO: Record<TipoGrupo, LancGrupo["tipoRotulo"]> = { avista: "À vista", parcelada: "Parcelada", fixa: "Conta fixa" };
const num = (v: unknown) => Number(v) || 0;

/** Lançamentos feitos por uma pessoa para OUTRA ser a responsável (base dos repasses). */
export function lancamentosDoGrupo(e: { extrato?: Item[]; cartao?: Item[]; contas?: Item[] }, mesRef: string = mesAtual()): LancGrupo[] {
  const saida: LancGrupo[] = [];
  const montar = (i: Item, origem: OrigemGrupo): LancGrupo | null => {
    if (!i.owner_id || !i.responsavel_id || i.owner_id === i.responsavel_id || i.tipo === "entrada") return null;
    const tipo: TipoGrupo = origem === "extrato" ? "avista" : origem === "cartao" ? "parcelada" : "fixa";
    return {
      chave: `${origem}:${i.id}`,
      id: String(i.id),
      origem,
      tipo,
      tipoRotulo: ROTULO[tipo],
      descricao: String((origem === "contas" ? i.nome : i.descricao ?? i.nome) || "Sem descrição"),
      categoria: String(i.categoria || ""),
      forma: String(i.pagamento || i.forma_pagamento || i.cartao || ""),
      valor: num(i.valor),
      mes: String(i.mes || ""),
      parcela: tipo === "parcelada" ? `${i.parcelaAtual ?? i.parcela_atual ?? 1}/${i.parcelaTotal ?? i.parcela_total ?? 1}` : null,
      vencimento: tipo === "fixa" && i.vencimento ? Number(i.vencimento) : null,
      contaPaga: tipo === "fixa" ? Boolean(i.pago) : null,
      autorId: String(i.owner_id),
      autorNome: i.autorNome || "Membro",
      autorAvatar: i.autorAvatar ?? null,
      autorCor: i.autorCor ?? null,
      respId: String(i.responsavel_id),
      respNome: i.responsavel || "Membro",
      respAvatar: i.responsavelAvatar ?? null,
      respCor: i.responsavelCor ?? null,
      repassePago: Boolean(i.repasse_pago ?? i.repassePago),
      repassePagoEm: i.repasse_pago_em ?? null,
      repasseInformado: Boolean(i.repasse_informado ?? i.repasseInformado),
      repasseInformadoEm: i.repasse_informado_em ?? null,
      situacaoRepasse: situacaoDoRepasse(Boolean(i.repasse_pago ?? i.repassePago), Boolean(i.repasse_informado ?? i.repasseInformado)),
      vencido: String(i.mes || "") <= mesRef,
    };
  };
  for (const o of ["extrato", "cartao", "contas"] as OrigemGrupo[]) {
    for (const i of semDuplicados(e[o] || [], o)) {
      const l = montar(i, o);
      if (l) saida.push(l);
    }
  }
  return saida.sort((a, b) => b.mes.localeCompare(a.mes) || b.valor - a.valor);
}

export type FiltroGrupo = {
  tipo: "todos" | TipoGrupo;
  /** vazio = todos */
  responsavelId: string;
  autorId: string;
  situacao: "todas" | "repasse-pendente" | "repasse-aguardando" | "repasse-concluido" | "conta-a-pagar" | "conta-paga";
};
export const FILTRO_GRUPO_INICIAL: FiltroGrupo = { tipo: "todos", responsavelId: "", autorId: "", situacao: "todas" };

export function filtrarGrupo(lista: LancGrupo[], f: FiltroGrupo): LancGrupo[] {
  return lista.filter((l) => {
    if (f.tipo !== "todos" && l.tipo !== f.tipo) return false;
    if (f.responsavelId && l.respId !== f.responsavelId) return false;
    if (f.autorId && l.autorId !== f.autorId) return false;
    switch (f.situacao) {
      case "repasse-pendente": return l.situacaoRepasse === "pendente";
      case "repasse-aguardando": return l.situacaoRepasse === "aguardando";
      case "repasse-concluido": return l.situacaoRepasse === "concluido";
      case "conta-a-pagar": return l.tipo === "fixa" && !l.contaPaga;
      case "conta-paga": return l.tipo === "fixa" && Boolean(l.contaPaga);
      default: return true;
    }
  });
}

/**
 * Converte o filtro global de responsáveis (token "somente eu" + nomes) em ids de membros.
 * Lista vazia = todo o grupo (retorna `null`, que significa "sem filtro").
 */
export function idsDaSelecao(selecao: string[], membros: { id: string; nome: string }[], meuId: string, tokenEu: string): Set<string> | null {
  if (selecao.length === 0) return null;
  const ids = new Set<string>();
  for (const t of selecao) {
    if (t === tokenEu) ids.add(meuId);
    else for (const m of membros) if (m.nome === t) ids.add(m.id);
  }
  return ids;
}

/** Mantém os lançamentos em que alguma das pessoas selecionadas é o responsável ou o autor. */
export function filtrarGrupoPorPessoas(lista: LancGrupo[], ids: Set<string> | null): LancGrupo[] {
  if (!ids) return lista;
  return lista.filter((l) => ids.has(l.respId) || ids.has(l.autorId));
}

export type PendenciaPessoa = {
  pessoaId: string;
  nome: string;
  avatar: string | null;
  cor: string | null;
  /** pendente que já venceu/é do mês atual */
  agora: number;
  /** pendente de meses futuros (parcelas e contas a vencer) */
  aVencer: number;
  /** Parte do "agora/a vencer" que já foi marcada como repassada e espera a confirmação de quem recebe */
  aguardando: number;
  recebido: number;
  itens: LancGrupo[];
};

export type ResumoRepasses = {
  aReceber: { agora: number; aVencer: number; aguardando: number; recebido: number; pessoas: PendenciaPessoa[] };
  aRepassar: { agora: number; aVencer: number; aguardando: number; recebido: number; pessoas: PendenciaPessoa[] };
};

const vazio = () => ({ agora: 0, aVencer: 0, aguardando: 0, recebido: 0, pessoas: [] as PendenciaPessoa[] });

/** Quem me deve (eu lancei) e a quem eu devo (outra pessoa lançou para mim). */
export function resumoRepasses(lista: LancGrupo[], meuId: string): ResumoRepasses {
  const r: ResumoRepasses = { aReceber: vazio(), aRepassar: vazio() };
  const montar = (lado: ResumoRepasses["aReceber"], l: LancGrupo, pessoa: { id: string; nome: string; avatar: string | null; cor: string | null }) => {
    let p = lado.pessoas.find((x) => x.pessoaId === pessoa.id);
    if (!p) {
      p = { pessoaId: pessoa.id, nome: pessoa.nome, avatar: pessoa.avatar, cor: pessoa.cor, agora: 0, aVencer: 0, aguardando: 0, recebido: 0, itens: [] };
      lado.pessoas.push(p);
    }
    p.itens.push(l);
    if (l.repassePago) { p.recebido = arred(p.recebido + l.valor); lado.recebido = arred(lado.recebido + l.valor); }
    else {
      // Só é "concluído" depois da confirmação de quem recebeu: até lá continua em aberto.
      if (l.vencido) { p.agora = arred(p.agora + l.valor); lado.agora = arred(lado.agora + l.valor); }
      else { p.aVencer = arred(p.aVencer + l.valor); lado.aVencer = arred(lado.aVencer + l.valor); }
      if (l.situacaoRepasse === "aguardando") { p.aguardando = arred(p.aguardando + l.valor); lado.aguardando = arred(lado.aguardando + l.valor); }
    }
  };
  for (const l of lista) {
    if (l.autorId === meuId) montar(r.aReceber, l, { id: l.respId, nome: l.respNome, avatar: l.respAvatar, cor: l.respCor });
    else if (l.respId === meuId) montar(r.aRepassar, l, { id: l.autorId, nome: l.autorNome, avatar: l.autorAvatar, cor: l.autorCor });
  }
  for (const lado of [r.aReceber, r.aRepassar]) lado.pessoas.sort((a, b) => b.agora + b.aVencer - (a.agora + a.aVencer));
  return r;
}

export type ResumoMembro = {
  id: string;
  entradas: number;
  saidas: number;
  saldo: number;
  /** repasses pendentes que o membro tem a receber / a repassar (já vencidos ou do mês atual) */
  aReceber: number;
  aRepassar: number;
};

/** Resumo financeiro de cada membro no mês, com base apenas no que o usuário atual pode ver. */
export function resumoPorMembro(
  e: { extrato?: Item[]; cartao?: Item[]; contas?: Item[] },
  membros: { id: string }[],
  mes: string,
  opts: { meuId: string; salarioConfig?: number; mesRef?: string },
): ResumoMembro[] {
  const lista = lancamentosDoGrupo(e, opts.mesRef);
  return membros.map((m) => {
    const dele = {
      extrato: (e.extrato || []).filter((i) => i.responsavel_id === m.id),
      cartao: (e.cartao || []).filter((i) => i.responsavel_id === m.id),
      contas: (e.contas || []).filter((i) => i.responsavel_id === m.id),
    };
    const r = calcularMes(dele, { mes, salarioConfig: m.id === opts.meuId ? opts.salarioConfig : 0 });
    let aReceber = 0;
    let aRepassar = 0;
    for (const l of lista) {
      if (l.repassePago || !l.vencido) continue;
      if (l.autorId === m.id) aReceber += l.valor;
      if (l.respId === m.id) aRepassar += l.valor;
    }
    return { id: m.id, entradas: r.entradas, saidas: r.saidas, saldo: r.saldoRestante, aReceber: arred(aReceber), aRepassar: arred(aRepassar) };
  });
}
