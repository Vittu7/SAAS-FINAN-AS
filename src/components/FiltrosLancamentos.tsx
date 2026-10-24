"use client";

import { useState } from "react";
import FiltroResponsaveis from "@/components/FiltroResponsaveis";
import type { PessoaVisual } from "@/components/Avatar";

export type FiltrosLancamentoState = {
  busca: string;
  /** Pessoas selecionadas (vazio = todas) */
  responsavel: string[];
  categoria: string;
  pagamento: string;
  tipo: string;
  status: string;
  /** Ordenação por valor: "" (padrão) | "maior" (maior → menor) | "menor" (menor → maior). */
  ordem: "" | "maior" | "menor";
};

export const FILTROS_INICIAIS: FiltrosLancamentoState = {
  busca: "",
  responsavel: [],
  categoria: "",
  pagamento: "",
  tipo: "todos",
  status: "todos",
  ordem: "",
};

type Props = {
  filtros: FiltrosLancamentoState;
  setFiltros: (filtros: FiltrosLancamentoState) => void;
  responsaveis: string[];
  /** Foto e cor de cada pessoa (opcional) */
  pessoas?: PessoaVisual[];
  categorias: string[];
  pagamentos: string[];
  mostrarTipo?: boolean;
  mostrarStatus?: boolean;
};

export default function FiltrosLancamentos({
  filtros,
  setFiltros,
  responsaveis,
  pessoas = [],
  categorias,
  pagamentos,
  mostrarTipo = false,
  mostrarStatus = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const ativos = Object.entries(filtros).filter(([chave, valor]) =>
    chave === "tipo" || chave === "status" ? valor !== "todos" : Array.isArray(valor) ? valor.length > 0 : Boolean(valor),
  ).length;

  const atualizar = (campo: Exclude<keyof FiltrosLancamentoState, "responsavel">, valor: string) =>
    setFiltros({ ...filtros, [campo]: valor } as FiltrosLancamentoState);

  const selectClass = "min-w-0 rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

  return (
    <section className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Filtros</h2>
          <p className="text-xs text-muted">Encontre lançamentos por descrição, pessoa ou tipo e ordene por valor.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-background md:hidden"
          aria-expanded={aberto}
          onClick={() => setAberto((valor) => !valor)}
        >
          {aberto ? "Recolher" : `Filtrar${ativos ? ` (${ativos})` : ""}`}
        </button>
      </div>
      <div className={`${aberto ? "grid" : "hidden"} mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:grid md:grid-cols-3 xl:grid-cols-6`}>
        <div className="col-span-full">
          <FiltroResponsaveis
            pessoas={responsaveis.map((nome) => pessoas.find((p) => p.nome === nome) ?? { nome })}
            selecionados={filtros.responsavel}
            onChange={(nomes) => setFiltros({ ...filtros, responsavel: nomes })}
          />
        </div>
        <input
          type="search"
          value={filtros.busca}
          onChange={(event) => atualizar("busca", event.target.value)}
          placeholder="Buscar descrição..."
          aria-label="Buscar descrição"
          className={`${selectClass} xl:col-span-2`}
        />
        <select aria-label="Filtrar categoria" value={filtros.categoria} onChange={(event) => atualizar("categoria", event.target.value)} className={selectClass}>
          <option value="">Todas as categorias</option>
          {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filtrar forma de pagamento" value={filtros.pagamento} onChange={(event) => atualizar("pagamento", event.target.value)} className={selectClass}>
          <option value="">Todas as formas</option>
          {pagamentos.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {mostrarTipo && (
          <select aria-label="Filtrar tipo de lançamento" value={filtros.tipo} onChange={(event) => atualizar("tipo", event.target.value)} className={selectClass}>
            <option value="todos">Todos os tipos</option>
            <option value="extrato">Lançamentos do mês</option>
            <option value="cartao">Contas parceladas</option>
            <option value="contas">Contas fixas</option>
          </select>
        )}
        {mostrarStatus && (
          <select aria-label="Filtrar status de pagamento" value={filtros.status} onChange={(event) => atualizar("status", event.target.value)} className={selectClass}>
            <option value="todos">Todos os status</option>
            <option value="pago">Pagas</option>
            <option value="pendente">Pendentes</option>
          </select>
        )}
        <select aria-label="Ordenar por valor" value={filtros.ordem} onChange={(event) => atualizar("ordem", event.target.value)} className={selectClass}>
          <option value="">Ordenar: padrão</option>
          <option value="maior">Valor: maior para menor</option>
          <option value="menor">Valor: menor para maior</option>
        </select>
        {ativos > 0 && (
          <button type="button" onClick={() => setFiltros(FILTROS_INICIAIS)} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-background">
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
