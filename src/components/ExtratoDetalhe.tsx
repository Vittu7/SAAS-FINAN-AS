"use client";

import { useMemo, useState } from "react";
import DialogResponsivo from "@/components/DialogResponsivo";
import ExtratoLista from "@/components/ExtratoLista";
import { brl, rotuloMes } from "@/lib/finance";
import { montarLinhas, ordenarPorValor, totalGastos, type LinhaExtrato, type Ordem, type OrigemLinha } from "@/lib/extrato";

export type TipoDetalhe = "gastos" | "disponivel" | "entradas";

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: "", rotulo: "Padrão" },
  { id: "maior", rotulo: "Maior valor" },
  { id: "menor", rotulo: "Menor valor" },
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
  salario,
  visualizacao,
  onFechar,
}: {
  tipo: TipoDetalhe;
  mes: string;
  extrato: any[];
  cartao: any[];
  contas: any[];
  salario: number;
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

  const entradasLinhas = useMemo(() => base.filter((l) => l.entrada), [base]);
  const usandoSalario = entradasLinhas.length === 0 && salario > 0;
  const entradasTotal = usandoSalario ? salario : entradasLinhas.reduce((t, l) => t + l.valor, 0);

  const gastosLinhas = useMemo(
    () => base.filter((l) => !l.entrada && (!origem || l.origem === origem) && (!responsavel || l.responsavel === responsavel)),
    [base, origem, responsavel],
  );

  const totalMes = totalGastos(base); // indicador completo do mês, independente dos filtros do detalhe
  const totalFiltrado = totalGastos(gastosLinhas);
  const filtrado = Boolean(origem || responsavel);
  const sobra = entradasTotal - totalMes;

  const linhas: LinhaExtrato[] = useMemo(() => {
    const ordenadas = ordenarPorValor(gastosLinhas, ordem);
    const entradas: LinhaExtrato[] = usandoSalario
      ? [{ id: "salario", origem: "extrato", descricao: "Salário configurado", categoria: "", forma: "", responsavel: "", valor: salario, entrada: true }]
      : entradasLinhas;
    if (tipo === "entradas") return entradas;
    if (tipo !== "disponivel" || filtrado) return ordenadas;
    return [...entradas, ...ordenadas];
  }, [gastosLinhas, ordem, tipo, filtrado, salario, usandoSalario, entradasLinhas]);

  const titulo = tipo === "gastos" ? "Saídas do mês" : tipo === "entradas" ? "Entradas do mês" : "Saldo restante";
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
              ? `${base.length} ${base.length === 1 ? "movimentação" : "movimentações"} no mês`
              : tipo === "entradas"
              ? `${entradasLinhas.length || (usandoSalario ? 1 : 0)} ${entradasLinhas.length === 1 ? "entrada" : "entradas"} no mês`
              : `Entradas ${brl(entradasTotal)} − saídas ${brl(totalMes)}`}
          </p>
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
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Ordenar por valor">
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
              Mostrando {gastosLinhas.length} de {base.length} · {brl(totalFiltrado)}
            </p>
          )}
        </div>}

        <ExtratoLista linhas={linhas} ordem={ordem} vazio="Nenhuma movimentação encontrada neste mês." />
      </div>
    </DialogResponsivo>
  );
}
