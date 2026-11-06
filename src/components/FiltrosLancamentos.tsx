"use client";

import { useState } from "react";
import { OPCOES_ORDEM, type Ordem } from "@/lib/extrato";

export type FiltrosLancamentoState = {
  busca: string;
  categoria: string;
  pagamento: string;
  tipo: string;
  status: string;
  /** Ordenação: padrão, data, nome A→Z / Z→A, valor ou categoria */
  ordem: Ordem;
  /** Período dentro do mês (AAAA-MM-DD), vazio = sem limite */
  dataDe: string;
  dataAte: string;
  /** Faixa de valor (texto digitado), vazio = sem limite */
  valorMin: string;
  valorMax: string;
};

export const FILTROS_INICIAIS: FiltrosLancamentoState = {
  busca: "",
  categoria: "",
  pagamento: "",
  tipo: "todos",
  status: "todos",
  ordem: "",
  dataDe: "",
  dataAte: "",
  valorMin: "",
  valorMax: "",
};

type Props = {
  filtros: FiltrosLancamentoState;
  setFiltros: (filtros: FiltrosLancamentoState) => void;
  categorias: string[];
  pagamentos: string[];
  mostrarTipo?: boolean;
  mostrarStatus?: boolean;
  /** Mês exibido (AAAA-MM): limita o seletor de datas */
  mes?: string;
};

/** Filtros de lista. Sem filtro por pessoa: a tela mostra só os lançamentos do próprio usuário; despesas divididas ficam em Repasses. */
export default function FiltrosLancamentos({
  filtros,
  setFiltros,
  categorias,
  pagamentos,
  mostrarTipo = false,
  mostrarStatus = false,
  mes,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const ativos = Object.entries(filtros).filter(([chave, valor]) =>
    chave === "tipo" || chave === "status" ? valor !== "todos" : Boolean(valor),
  ).length;

  const atualizar = (campo: keyof FiltrosLancamentoState, valor: string) =>
    setFiltros({ ...filtros, [campo]: valor } as FiltrosLancamentoState);

  const selectClass = "min-w-0 rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

  return (
    <section className="rounded-xl border border-line bg-surface p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Filtros</h2>
          <p className="text-xs text-muted">Busque por descrição, período, valor, categoria ou forma de pagamento e ordene por data, nome ou valor.</p>
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
        <select aria-label="Ordenar" value={filtros.ordem} onChange={(event) => atualizar("ordem", event.target.value)} className={selectClass}>
          <option value="">Ordenar: padrão</option>
          {["Data", "Nome", "Valor", "Outros"].map((g) => (
            <optgroup key={g} label={g === "Outros" ? "Categoria" : g}>
              {OPCOES_ORDEM.filter((o) => o.grupo === g).map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
            </optgroup>
          ))}
        </select>
        <label className="flex min-w-0 items-center gap-2 text-xs text-muted">De
          <input type="date" aria-label="Data inicial" value={filtros.dataDe} min={mes ? `${mes}-01` : undefined} max={filtros.dataAte || (mes ? `${mes}-31` : undefined)} onChange={(event) => atualizar("dataDe", event.target.value)} className={`${selectClass} w-full`} />
        </label>
        <label className="flex min-w-0 items-center gap-2 text-xs text-muted">Até
          <input type="date" aria-label="Data final" value={filtros.dataAte} min={filtros.dataDe || (mes ? `${mes}-01` : undefined)} max={mes ? `${mes}-31` : undefined} onChange={(event) => atualizar("dataAte", event.target.value)} className={`${selectClass} w-full`} />
        </label>
        <input type="text" inputMode="decimal" aria-label="Valor mínimo" placeholder="Valor mínimo (R$)" value={filtros.valorMin} onChange={(event) => atualizar("valorMin", event.target.value)} className={selectClass} />
        <input type="text" inputMode="decimal" aria-label="Valor máximo" placeholder="Valor máximo (R$)" value={filtros.valorMax} onChange={(event) => atualizar("valorMax", event.target.value)} className={selectClass} />
        {ativos > 0 && (
          <button type="button" onClick={() => setFiltros(FILTROS_INICIAIS)} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-background">
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
