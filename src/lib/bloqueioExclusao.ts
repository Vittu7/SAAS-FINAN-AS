/**
 * Exclusão de grupo/convidado bloqueada por lançamentos vinculados.
 *
 * O banco (função excluir_grupo_familiar e trava convidado_trava_exclusao) recusa apagar um convidado que ainda é
 * o responsável por lançamentos. Aqui a tela descobre QUAIS são, usando só os dados que o app já carregou
 * (o que o RLS deixa o usuário ver): nada novo é pedido ao banco nem exposto.
 */
import { dataDoItem } from "./datas";

export type TabelaLancamento = "extrato" | "cartao" | "contas";

export const ROTULO_TABELA: Record<TabelaLancamento, string> = { extrato: "Extrato", cartao: "Cartão", contas: "Conta fixa" };

export type LancamentoBloqueador = {
  tabela: TabelaLancamento;
  id: string;
  mes: string;
  descricao: string;
  valor: number;
  data: string | null;
  categoria: string;
  responsavel: string;
};

export type Convidado = { id: string; nome: string };

export type GrupoBloqueio = { convidado: Convidado; lancamentos: LancamentoBloqueador[] };

/** O erro veio da regra "convidado com lançamentos" (trava do banco ou pré-validação da função)? */
export function ehBloqueioPorLancamentos(erro: unknown): boolean {
  const e = (erro ?? {}) as { code?: string; message?: string };
  return e.code === "P0001" && /lançamento/i.test(String(e.message ?? "")) && /convidado/i.test(String(e.message ?? ""));
}

/** Campos de uma linha do store que esta tela lê (o store guarda as linhas sem tipo fixo). */
type Linha = {
  id?: unknown; mes?: unknown; descricao?: unknown; nome?: unknown; valor?: unknown; categoria?: unknown;
  responsavel_id?: unknown; repasseSintetico?: unknown; data?: unknown; vencimento?: unknown; created_at?: unknown;
};

export type DadosLancamentos = { extrato?: Linha[]; cartao?: Linha[]; contas?: Linha[] };

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

const DESCRICAO: Record<TabelaLancamento, (i: Linha) => string> = {
  extrato: (i) => texto(i.descricao) || texto(i.nome) || "Sem descrição",
  cartao: (i) => texto(i.descricao) || texto(i.nome) || "Sem descrição",
  contas: (i) => texto(i.nome) || texto(i.descricao) || "Sem nome",
};

/** Lançamentos (extrato, cartão e conta fixa) cujo responsável é um dos convidados, agrupados por convidado. */
export function lancamentosDosConvidados(dados: DadosLancamentos, convidados: Convidado[]): GrupoBloqueio[] {
  const tabelas: TabelaLancamento[] = ["extrato", "cartao", "contas"];
  return convidados
    .map((convidado) => {
      const lancamentos: LancamentoBloqueador[] = [];
      for (const tabela of tabelas) {
        for (const i of dados[tabela] ?? []) {
          // linhas sintéticas (repasses calculados) não existem no banco: não são o que bloqueia
          if (!i || i.repasseSintetico || String(i.responsavel_id) !== convidado.id) continue;
          lancamentos.push({
            tabela,
            id: String(i.id),
            mes: String(i.mes ?? ""),
            descricao: DESCRICAO[tabela](i),
            valor: Number(i.valor) || 0,
            data: dataDoItem(i),
            categoria: String(i.categoria ?? ""),
            responsavel: convidado.nome,
          });
        }
      }
      lancamentos.sort((a, b) => (b.data ?? b.mes).localeCompare(a.data ?? a.mes));
      return { convidado, lancamentos };
    })
    .filter((g) => g.lancamentos.length > 0);
}

/** Aba do app que lista cada tipo de lançamento. */
export const ABA_DO_LANCAMENTO: Record<TabelaLancamento, "lancamentos" | "cartao" | "contas"> = {
  extrato: "lancamentos",
  cartao: "cartao",
  contas: "contas",
};
