"use client";

import { useState } from "react";

export type FiltrosLancamentoState = {
  busca: string;
  categoria: string;
  pagamento: string;
  tipo: string;
  status: string;
  /** Quem lançou: todos | mim (lançados por mim) | grupo (lançados por outros membros) */
  autoria: "todos" | "mim" | "grupo";
  /** Ordenação por valor: "" (padrão) | "maior" (maior → menor) | "menor" (menor → maior). */
  ordem: "" | "maior" | "menor";
};

export const FILTROS_INICIAIS: FiltrosLancamentoState = {
  busca: "",
  categoria: "",
  pagamento: "",
  tipo: "todos",
  status: "todos",
  autoria: "todos",
  ordem: "",
};

type Props = {
  filtros: FiltrosLancamentoState;
  setFiltros: (filtros: FiltrosLancamentoState) => void;
  categorias: string[];
  pagamentos: string[];
  mostrarTipo?: boolean;
  mostrarStatus?: boolean;
  /** Mostra os filtros "Lançados por mim / pelo grupo" (só faz sentido com mais de uma pessoa) */
  mostrarAutoria?: boolean;
};

/** Filtros de lista. Responsáveis não ficam aqui: o filtro de pessoas é único e global, no topo da tela. */
export default function FiltrosLancamentos({
  filtros,
  setFiltros,
  categorias,
  pagamentos,
  mostrarTipo = false,
  mostrarStatus = false,
  mostrarAutoria = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const ativos = Object.entries(filtros).filter(([chave, valor]) =>
    chave === "tipo" || chave === "status" || chave === "autoria" ? valor !== "todos" : Boolean(valor),
  ).length;

  const atualizar = (campo: Exclude<keyof FiltrosLancamentoState, "autoria">, valor: string) =>
    setFiltros({ ...filtros, [campo]: valor } as FiltrosLancamentoState);

  const selectClass = "min-w-0 rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

  return (
    <section className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Filtros</h2>
          <p className="text-xs text-muted">Encontre lançamentos por descrição, tipo ou forma de pagamento e ordene por valor.</p>
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
        {mostrarAutoria && (
          <div className="col-span-full flex gap-1 rounded-full bg-background p-1 ring-1 ring-line sm:w-fit" role="group" aria-label="Quem lançou">
            {([["todos", "Todos"], ["mim", "Lançados por mim"], ["grupo", "Lançados pelo grupo"]] as const).map(([id, r]) => (
              <button key={id} type="button" aria-pressed={filtros.autoria === id} onClick={() => setFiltros({ ...filtros, autoria: id })} className={`h-9 flex-1 rounded-full px-3 text-xs font-semibold transition sm:flex-none sm:px-4 ${filtros.autoria === id ? "bg-accent text-on-accent shadow-sm" : "text-muted"}`}>{r}</button>
            ))}
          </div>
        )}
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
