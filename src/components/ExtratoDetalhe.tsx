"use client";

import { useMemo, useState } from "react";
import DialogResponsivo from "@/components/DialogResponsivo";
import ExtratoLista from "@/components/ExtratoLista";
import { brl, rotuloMes } from "@/lib/finance";
import { entradasDoMeuFinanceiro, montarLinhas, ordenarPorValor, saidasDoMeuFinanceiro, totalGastos, totalPendentes, type LinhaExtrato, type Ordem, type OrigemLinha } from "@/lib/extrato";

import type { ModoSaldo, Painel } from "@/lib/painel";

export type TipoDetalhe = "gastos" | "disponivel" | "entradas";

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: "", rotulo: "Padrão" },
  { id: "maior", rotulo: "Maior valor" },
  { id: "menor", rotulo: "Menor valor" },
  { id: "recente", rotulo: "Mais recente" },
  { id: "antiga", rotulo: "Mais antiga" },
  { id: "az", rotulo: "Nome A→Z" },
  { id: "za", rotulo: "Nome Z→A" },
];

const ORIGENS: { id: "" | OrigemLinha; rotulo: string }[] = [
  { id: "", rotulo: "Tudo" },
  { id: "extrato", rotulo: "Lançamentos" },
  { id: "cartao", rotulo: "Parcelas" },
  { id: "contas", rotulo: "Fixas" },
];

const chip = (ativo: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
    ativo ? "bg-accent text-on-accent" : "bg-background text-ink ring-1 ring-line hover:bg-background/70"
  }`;

/**
 * Extrato aberto ao tocar em "Gastos do mês" ou "Disponível após os gastos".
 * Recebe os dados já filtrados pelo módulo (visualização por usuário/membro) e respeita o mês selecionado.
 */
export default function ExtratoDetalhe({
  tipo,
  mes,
  extrato,
  cartao,
  contas,
  painel,
  modo = "mes",
  visualizacao,
  onFechar,
}: {
  tipo: TipoDetalhe;
  mes: string;
  extrato: any[];
  cartao: any[];
  contas: any[];
  /** Painel do mês: resultado do mês x total disponível */
  painel?: Painel;
  modo?: ModoSaldo;
  visualizacao: string;
  onFechar: () => void;
}) {
  const [ordem, setOrdem] = useState<Ordem>("");
  const [origem, setOrigem] = useState<"" | OrigemLinha>("");
  const [responsavel, setResponsavel] = useState("");

  // Os dados já chegam filtrados pela visualização escolhida (somente eu, grupo ou pessoa),
  // então este extrato bate sempre com os cards do resumo.
  const base = useMemo(() => montarLinhas(extrato, cartao, contas, mes), [extrato, cartao, contas, mes]);

  const responsaveis = useMemo(() => [...new Set(base.map((l) => l.responsavel).filter(Boolean))].sort(), [base]);

  const entradasLinhas = useMemo(() => entradasDoMeuFinanceiro(base), [base]); // só as minhas (responsável); repasse não é entrada
  const entradasTotal = entradasLinhas.reduce((t, l) => t + l.valor, 0);

  // Só despesas em que eu sou o responsável: o que lancei para outra pessoa fica de fora (é dela e não entra no total)
  const minhasSaidas = useMemo(() => saidasDoMeuFinanceiro(base), [base]);
  const gastosLinhas = useMemo(
    () => minhasSaidas.filter((l) => (!origem || l.origem === origem) && (!responsavel || l.responsavel === responsavel)),
    [minhasSaidas, origem, responsavel],
  );

  const totalMes = totalGastos(base); // gastos realizados do mês, independente dos filtros do detalhe
  const pendentesMes = totalPendentes(base); // contas fixas ainda não pagas (compromissos)
  const totalFiltrado = totalGastos(gastosLinhas);
  const pendentesFiltrado = totalPendentes(gastosLinhas);
  const filtrado = Boolean(origem || responsavel);
  // Mantém o mesmo resultado do card do resumo (calcularMes), que desconta as contas a pagar
  const resultadoMes = entradasTotal - totalMes - pendentesMes;
  const totalModo = tipo === "disponivel" && modo === "total" && Boolean(painel);
  const sobra = totalModo ? painel!.totalDisponivel : resultadoMes;

  const linhas: LinhaExtrato[] = useMemo(() => {
    const ordenadas = ordenarPorValor(gastosLinhas, ordem);
    const entradas: LinhaExtrato[] = entradasLinhas;
    // Total disponível: além das entradas do mês, mostra o que veio de antes e os repasses concluídos (transferência interna)
    const extras: LinhaExtrato[] = totalModo && painel
      ? [
          ...(painel.saldoAnterior !== 0 ? [{ id: "saldo-anterior", origem: "extrato" as const, descricao: "Saldo acumulado dos meses anteriores", categoria: "", forma: "", responsavel: "", valor: painel.saldoAnterior, entrada: true }] : []),
          ...(painel.resgatesCaixinha > 0 ? [{ id: "resgates-caixinha", origem: "extrato" as const, descricao: "Resgates de caixinhas (voltaram para a conta)", categoria: "Investimentos", forma: "", responsavel: "", valor: painel.resgatesCaixinha, entrada: true }] : []),
          ...(painel.aportesCaixinha > 0 ? [{ id: "aportes-caixinha", origem: "extrato" as const, descricao: "Aportes em caixinhas (saíram do saldo, não é despesa)", categoria: "Investimentos", forma: "", responsavel: "", valor: painel.aportesCaixinha, entrada: false }] : []),
        ]
      : [];
    if (tipo === "entradas") return entradas;
    if (tipo !== "disponivel" || filtrado) return ordenadas;
    return [...extras, ...entradas, ...ordenadas];
  }, [gastosLinhas, ordem, tipo, filtrado, entradasLinhas, totalModo, painel]);

  const titulo = tipo === "gastos" ? "Saídas do mês" : tipo === "entradas" ? "Entradas do mês" : totalModo ? "Total disponível" : "Resultado do mês";
  const negativo = tipo === "disponivel" && sobra < 0;

  return (
    <DialogResponsivo titulo={titulo} onFechar={onFechar}>
      <div className="space-y-4">
        {/* Cabeçalho do extrato */}
        <div
          className={`relative overflow-hidden rounded-3xl p-5 ${
            tipo === "gastos" ? "bg-background ring-1 ring-line" : tipo === "entradas" ? "bg-emerald-600 text-white" : negativo ? "bg-rose-600 text-white" : "bg-accent text-on-accent"
          }`}
        >
          <p className={`text-xs font-medium ${tipo === "gastos" ? "text-muted" : "opacity-80"}`}>
            {rotuloMes(mes)} · {visualizacao}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {tipo === "gastos" ? brl(totalMes) : tipo === "entradas" ? brl(entradasTotal) : `${negativo ? "− " : ""}${brl(Math.abs(sobra))}`}
          </p>
          <p className={`mt-1 text-xs ${tipo === "gastos" ? "text-muted" : "opacity-80"}`}>
            {tipo === "gastos"
              ? `${minhasSaidas.length} ${minhasSaidas.length === 1 ? "movimentação" : "movimentações"} no mês`
              : tipo === "entradas"
              ? `${entradasLinhas.length} ${entradasLinhas.length === 1 ? "entrada" : "entradas"} no mês`
              : totalModo && painel
              ? `Anterior ${brl(painel.saldoAnterior)} + entradas ${brl(painel.entradas)} − saídas ${brl(painel.saidas)}${painel.adiantado > 0 ? ` − adiantado ${brl(painel.adiantado)}` : ""}${painel.faturaEmAberto > 0 ? ` + fatura ainda não paga ${brl(painel.faturaEmAberto)}` : ""}${painel.aportesCaixinha > 0 ? ` − aportes em caixinhas ${brl(painel.aportesCaixinha)}` : ""}${painel.resgatesCaixinha > 0 ? ` + resgates ${brl(painel.resgatesCaixinha)}` : ""}`
              : `Entradas ${brl(entradasTotal)} − saídas ${brl(totalMes)}${pendentesMes > 0 ? ` − a pagar ${brl(pendentesMes)}` : ""}`}
          </p>
          {tipo === "gastos" && pendentesMes > 0 && (
            <p className="mt-1 text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">+ {brl(pendentesMes)} em contas a pagar</p>
          )}
        </div>

        {/* Filtros do detalhe */}
        {tipo !== "entradas" && <div className="space-y-2">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por tipo">
            {ORIGENS.map((o) => (
              <button key={o.id || "tudo"} type="button" aria-pressed={origem === o.id} onClick={() => setOrigem(o.id)} className={chip(origem === o.id)}>
                {o.rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Ordenar">
              {ORDENS.map((o) => (
                <button key={o.id || "padrao"} type="button" aria-pressed={ordem === o.id} onClick={() => setOrdem(o.id)} className={chip(ordem === o.id)}>
                  {o.id === "" ? "Ordem padrão" : o.rotulo}
                </button>
              ))}
            </div>

            {responsaveis.length > 1 && (
              <select
                aria-label="Filtrar responsável"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="h-8 rounded-full bg-background px-3 text-xs font-medium text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
              >
                <option value="">Todos os responsáveis</option>
                {responsaveis.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>

          {filtrado && (
            <p className="text-xs text-muted">
              Mostrando {gastosLinhas.length} de {minhasSaidas.length} · {brl(totalFiltrado)}
              {pendentesFiltrado > 0 && <span className="text-amber-600 dark:text-amber-400"> + {brl(pendentesFiltrado)} a pagar</span>}
            </p>
          )}
        </div>}

        <ExtratoLista linhas={linhas} ordem={ordem} vazio="Nenhuma movimentação encontrada neste mês." />
      </div>
    </DialogResponsivo>
  );
}
