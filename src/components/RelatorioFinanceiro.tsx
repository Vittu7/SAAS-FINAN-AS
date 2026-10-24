"use client";

import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Ico } from "@/components/icons";
import FiltroResponsaveis from "@/components/FiltroResponsaveis";
import { addMeses, brl, pct } from "@/lib/finance";
import { gerarRelatorio, mesCurto, relatorioParaCSV, relatorioParaHTML, type Grupo } from "@/lib/relatorio";

type Preset = "mes" | "3m" | "6m" | "12m" | "ano" | "custom";
const PRESETS: { id: Preset; r: string }[] = [
  { id: "mes", r: "Mês selecionado" },
  { id: "3m", r: "Últimos 3 meses" },
  { id: "6m", r: "Últimos 6 meses" },
  { id: "12m", r: "Últimos 12 meses" },
  { id: "ano", r: "Ano do mês selecionado" },
  { id: "custom", r: "Personalizado" },
];

const campo = "h-11 w-full rounded-xl border border-line bg-background px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";
const rotulo = "mb-1 block text-xs font-medium text-muted";

function Lista({ titulo, itens, cor }: { titulo: string; itens: Grupo[]; cor: string }) {
  if (!itens.length) return null;
  return (
    <div className="card-glass space-y-3 p-5">
      <h4 className="text-sm font-bold">{titulo}</h4>
      <ul className="space-y-2.5">
        {itens.map((g) => (
          <li key={g.nome}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{g.nome}</span>
              <span className="shrink-0 tabular-nums font-semibold">{brl(g.valor)} <span className="text-xs font-normal text-muted">{pct(g.pct, 0)}</span></span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background"><div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, g.pct)}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RelatorioFinanceiro({ estado, mes }: { estado: { extrato: any[]; cartao: any[]; contas: any[]; config: { salario?: number } }; mes: string }) {
  const [preset, setPreset] = useState<Preset>("mes");
  const [deC, setDeC] = useState(mes);
  const [ateC, setAteC] = useState(mes);
  const [responsaveisSel, setResponsaveisSel] = useState<string[]>([]);
  const [categoria, setCategoria] = useState("");
  const [limite, setLimite] = useState(30);

  const [de, ate] = useMemo(() => {
    switch (preset) {
      case "mes": return [mes, mes];
      case "3m": return [addMeses(mes, -2), mes];
      case "6m": return [addMeses(mes, -5), mes];
      case "12m": return [addMeses(mes, -11), mes];
      case "ano": return [`${mes.slice(0, 4)}-01`, `${mes.slice(0, 4)}-12`];
      default: return [deC || mes, ateC || mes];
    }
  }, [preset, mes, deC, ateC]);

  const todos = useMemo(() => [...estado.extrato, ...estado.cartao, ...estado.contas], [estado]);
  const pessoas = useMemo(() => {
    const vistos = new Map<string, { nome: string; avatar?: string | null; cor?: string | null }>();
    for (const i of todos) {
      const nome = String(i.responsavel || "").trim();
      if (nome && !vistos.has(nome)) vistos.set(nome, { nome, avatar: i.responsavelAvatar, cor: i.responsavelCor });
    }
    return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [todos]);
  const categorias = useMemo(() => [...new Set(todos.map((i) => String(i.categoria || "").trim()).filter(Boolean))].sort(), [todos]);

  const r = useMemo(() => gerarRelatorio(estado, { de, ate, responsaveis: responsaveisSel, categoria: categoria || undefined }), [estado, de, ate, responsaveisSel, categoria]);
  const negativo = r.totais.saldo < 0;

  const baixar = (conteudo: string, tipo: string, nome: string) => {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nome });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const nomeArquivo = `relatorio-homecash-${r.filtro.de <= r.filtro.ate ? r.filtro.de : r.filtro.ate}-a-${r.filtro.de <= r.filtro.ate ? r.filtro.ate : r.filtro.de}`;
  const exportarCSV = () => baixar(relatorioParaCSV(r), "text/csv;charset=utf-8", `${nomeArquivo}.csv`);
  const exportarPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return alert("O navegador bloqueou a janela. Permita pop-ups para exportar em PDF.");
    w.document.write(relatorioParaHTML(r));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400); // na janela de impressão escolha "Salvar como PDF"
  };

  return (
    <div className="space-y-4">
      <section className="card-glass space-y-4 p-5 md:p-6" aria-label="Filtros do relatório">
        <div>
          <h3 className="text-lg font-bold">Relatório financeiro</h3>
          <p className="text-sm text-muted">Escolha o período e exporte em Excel (CSV) ou PDF.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="rel-p" className={rotulo}>Período</label>
            <select id="rel-p" value={preset} onChange={(e) => { const p = e.target.value as Preset; if (p === "custom") { setDeC(de); setAteC(ate); } setPreset(p); }} className={campo}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.r}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="rel-c" className={rotulo}>Categoria</label>
            <select id="rel-c" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
              <option value="">Todas</option>
              {categorias.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
              <div><label htmlFor="rel-de" className={rotulo}>De</label><input id="rel-de" type="month" value={deC} onChange={(e) => setDeC(e.target.value)} className={campo} /></div>
              <div><label htmlFor="rel-ate" className={rotulo}>Até</label><input id="rel-ate" type="month" value={ateC} onChange={(e) => setAteC(e.target.value)} className={campo} /></div>
            </div>
          )}
        </div>
        <div>
          <span className={rotulo}>Responsáveis</span>
          <FiltroResponsaveis pessoas={pessoas} selecionados={responsaveisSel} onChange={setResponsaveisSel} />
        </div>
        <p className="text-xs text-muted">Período analisado: {mesCurto(r.filtro.de <= r.filtro.ate ? r.filtro.de : r.filtro.ate)} a {mesCurto(r.filtro.de <= r.filtro.ate ? r.filtro.ate : r.filtro.de)} · {r.meses.length} {r.meses.length === 1 ? "mês" : "meses"}</p>
        <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
          <button type="button" onClick={exportarCSV} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent transition active:scale-[0.98]"><Ico icon={Download} size={18} />Exportar Excel (CSV)</button>
          <button type="button" onClick={exportarPDF} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold transition hover:bg-background active:scale-[0.98]"><Ico icon={FileText} size={18} />Exportar PDF</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Totais do período">
        <div className="card-glass p-4"><p className="text-xs text-muted">Entradas</p><p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(r.totais.entradas)}</p></div>
        <div className="card-glass p-4"><p className="text-xs text-muted">Saídas</p><p className="mt-1 text-2xl font-semibold tabular-nums text-rose-700 dark:text-rose-400">{brl(r.totais.saidas)}</p>{r.totais.faltaPagar > 0 && <p className="mt-0.5 text-[11px] text-muted">Falta pagar {brl(r.totais.faltaPagar)}</p>}</div>
        <div className="card-glass p-4"><p className="text-xs text-muted">Saldo restante</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${negativo ? "text-rose-700 dark:text-rose-400" : ""}`}>{negativo ? "− " : ""}{brl(Math.abs(r.totais.saldo))}</p></div>
      </section>

      {r.meses.length > 1 && (
        <section className="card-glass p-5" aria-label="Resumo por mês">
          <h4 className="mb-3 text-sm font-bold">Mês a mês</h4>
          <ul className="divide-y divide-line">
            {r.meses.map((m) => (
              <li key={m.mes} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 py-2 text-sm">
                <span className="w-16 font-medium">{mesCurto(m.mes)}</span>
                <span className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{brl(m.entradas)}</span>
                <span className="text-right tabular-nums text-rose-700 dark:text-rose-400">{brl(m.saidas)}</span>
                <span className="text-right tabular-nums font-semibold">{brl(m.saldo)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Colunas: entradas · saídas · saldo.</p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Lista titulo="Saídas por categoria" itens={r.porCategoria} cor="bg-accent" />
        <Lista titulo="Saídas por responsável" itens={r.porResponsavel} cor="bg-accent" />
        <Lista titulo="Saídas por forma de pagamento" itens={r.porForma} cor="bg-accent" />
        <Lista titulo="Saídas por tipo" itens={r.porOrigem} cor="bg-accent" />
      </div>

      <section className="card-glass p-5" aria-label="Movimentações do período">
        <h4 className="mb-3 text-sm font-bold">Movimentações ({r.movimentos.length})</h4>
        {r.movimentos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhuma movimentação neste período.</p>
        ) : (
          <ul className="divide-y divide-line">
            {r.movimentos.slice(0, limite).map((m, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.descricao || "Sem descrição"}</p>
                  <p className="truncate text-xs text-muted">{[mesCurto(m.mes), m.origem, m.categoria, m.forma, m.responsavel].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${m.tipo === "Entrada" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{m.tipo === "Entrada" ? "+ " : ""}{brl(m.valor)}</p>
                  <p className="text-[11px] text-muted">{m.situacao}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {r.movimentos.length > limite && (
          <button type="button" onClick={() => setLimite((l) => l + 50)} className="mt-3 h-10 w-full rounded-xl border border-line text-sm font-medium text-accent hover:bg-background">Mostrar mais ({r.movimentos.length - limite} restantes)</button>
        )}
        <p className="mt-3 text-[11px] text-muted">A exportação sempre inclui todas as movimentações, com os valores reais.</p>
      </section>
    </div>
  );
}
