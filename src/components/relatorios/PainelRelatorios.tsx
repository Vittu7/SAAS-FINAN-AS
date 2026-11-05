"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Ico } from "@/components/icons";
import { avisos } from "@/lib/avisos";
import { addMeses, brl, pct } from "@/lib/finance";
import { gerarRelatorio, mesCurto, mesesDoPeriodo } from "@/lib/relatorio";
import { lancamentosDoGrupo } from "@/lib/grupo";
import { calcularFatura } from "@/lib/pagamentoFatura";
import { useOpcoes } from "@/lib/useOpcoes";
import { Bloco, Colunas, Kpi, Linha, Ranking, SemDados, Tabela, Variacao } from "./graficos";

type Item = Record<string, any>;
type Dados = { extrato: Item[]; cartao: Item[]; contas: Item[] };
type Aba = "despesas" | "pessoa" | "cartao" | "repasses" | "fluxo";
type Preset = "mes" | "3m" | "6m" | "12m" | "ano" | "custom";

const ABAS: { id: Aba; r: string; filtros: ("resp" | "cat" | "cartao")[] }[] = [
  { id: "despesas", r: "Despesas", filtros: ["resp", "cat", "cartao"] },
  { id: "pessoa", r: "Por pessoa", filtros: ["cat", "cartao"] },
  { id: "cartao", r: "Por cartão", filtros: ["resp", "cat", "cartao"] },
  { id: "repasses", r: "Repasses", filtros: ["resp"] },
  { id: "fluxo", r: "Entradas e saídas", filtros: ["resp"] },
];
const PRESETS: { id: Preset; r: string }[] = [
  { id: "mes", r: "Mês selecionado" },
  { id: "3m", r: "Últimos 3 meses" },
  { id: "6m", r: "Últimos 6 meses" },
  { id: "12m", r: "Últimos 12 meses" },
  { id: "ano", r: "Ano do mês" },
  { id: "custom", r: "Personalizado" },
];

const campo = "h-10 w-full rounded-xl border border-line bg-background px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";
const rotulo = "mb-1 block text-xs font-medium text-muted";
const soma = (l: { valor: number }[]) => l.reduce((t, x) => t + x.valor, 0);

type Tab = { titulo: string; cab: string[]; linhas: (string | number)[][] };

export default function PainelRelatorios({ estado, mes, rotuloResponsaveis }: { estado: Dados; mes: string; rotuloResponsaveis?: string }) {
  const { pagamento } = useOpcoes();
  const [aba, setAba] = useState<Aba>("despesas");
  const [preset, setPreset] = useState<Preset>("6m");
  const [deC, setDeC] = useState(mes);
  const [ateC, setAteC] = useState(mes);
  const [resp, setResp] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cartao, setCartao] = useState("");
  const [limite, setLimite] = useState(20);

  const [de, ate] = useMemo(() => {
    let p: [string, string];
    switch (preset) {
      case "mes": p = [mes, mes]; break;
      case "3m": p = [addMeses(mes, -2), mes]; break;
      case "6m": p = [addMeses(mes, -5), mes]; break;
      case "12m": p = [addMeses(mes, -11), mes]; break;
      case "ano": p = [`${mes.slice(0, 4)}-01`, `${mes.slice(0, 4)}-12`]; break;
      default: p = [deC || mes, ateC || mes];
    }
    return p[0] <= p[1] ? p : [p[1], p[0]];
  }, [preset, mes, deC, ateC]);
  const n = mesesDoPeriodo(de, ate).length || 1;
  const deAnt = addMeses(de, -n);
  const ateAnt = addMeses(de, -1);

  const todos = useMemo(() => [...estado.extrato, ...estado.cartao, ...estado.contas], [estado]);
  const opcoes = useMemo(() => {
    const u = (f: (i: Item) => unknown) => [...new Set(todos.map((i) => String(f(i) || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { resp: u((i) => i.responsavel), cat: u((i) => i.categoria) };
  }, [todos]);
  const cartoesCad = useMemo(() => pagamento.filter((c) => c.eh_cartao), [pagamento]);
  const nomesCartao = useMemo(() => new Set(cartoesCad.map((c) => c.nome)), [cartoesCad]);

  // Filtro por cartão/forma de pagamento (só despesas), aplicado antes do relatório
  const base = useMemo<Dados>(() => {
    if (!cartao) return estado;
    return {
      extrato: estado.extrato.filter((i) => i.tipo !== "entrada" && i.pagamento === cartao),
      cartao: estado.cartao.filter((i) => i.cartao === cartao),
      contas: estado.contas.filter((i) => (i.forma_pagamento || i.formaPagamento) === cartao),
    };
  }, [estado, cartao]);

  const filtroBase = { rotuloResponsaveis, categoria: categoria || undefined, responsaveis: resp ? [resp] : undefined };
  const gerar = (d: string, a: string, b: Dados = base, extra = {}) => gerarRelatorio(b, { ...filtroBase, ...extra, de: d, ate: a });
  const r = useMemo(() => gerar(de, ate), [base, de, ate, resp, categoria]); // eslint-disable-line react-hooks/exhaustive-deps
  const ant = useMemo(() => gerar(deAnt, ateAnt), [base, deAnt, ateAnt, resp, categoria]); // eslint-disable-line react-hooks/exhaustive-deps
  // Com um único mês, a evolução mostra os 6 meses até ele (senão seria só uma coluna)
  const deEvo = n > 1 ? de : addMeses(ate, -5);
  const evo = useMemo(() => (n > 1 ? r : gerar(deEvo, ate)), [r, n, base, deEvo, ate, resp, categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtros = ABAS.find((a) => a.id === aba)!.filtros;
  const rotPeriodo = `${mesCurto(de)} a ${mesCurto(ate)}`;

  const repasses = useMemo(
    () => lancamentosDoGrupo(estado, ate).filter((l) => l.mes >= de && l.mes <= ate && (!resp || l.respNome === resp || l.autorNome === resp) && (!categoria || l.categoria === categoria)),
    [estado, de, ate, resp, categoria],
  );

  /* ---------- exportação (valores reais, mesmo com "ocultar valores") ---------- */
  const montarTab = (): Tab => {
    switch (aba) {
      case "despesas": return { titulo: "Despesas", cab: ["Categoria", "Valor (R$)", "% das saídas"], linhas: r.porCategoria.map((g) => [g.nome, g.valor.toFixed(2).replace(".", ","), g.pct.toFixed(1).replace(".", ",")]) };
      case "pessoa": return { titulo: "Gastos por pessoa", cab: ["Pessoa", "Valor (R$)", "% das saídas"], linhas: r.porResponsavel.map((g) => [g.nome, g.valor.toFixed(2).replace(".", ","), g.pct.toFixed(1).replace(".", ",")]) };
      case "cartao": return { titulo: "Despesas por cartão", cab: ["Cartão", "Valor (R$)", "% das saídas"], linhas: r.porForma.filter((g) => nomesCartao.has(g.nome)).map((g) => [g.nome, g.valor.toFixed(2).replace(".", ","), g.pct.toFixed(1).replace(".", ",")]) };
      case "repasses": return { titulo: "Repasses", cab: ["Mês", "Descrição", "Quem deve", "Quem recebe", "Situação", "Valor (R$)"], linhas: repasses.map((l) => [mesCurto(l.mes), l.descricao, l.respNome, l.autorNome, ROTULO_REP[l.situacaoRepasse], l.valor.toFixed(2).replace(".", ",")]) };
      default: return { titulo: "Entradas e saídas", cab: ["Mês", "Entradas (R$)", "Saídas (R$)", "Saldo (R$)"], linhas: r.meses.map((m) => [mesCurto(m.mes), m.entradas.toFixed(2).replace(".", ","), m.saidas.toFixed(2).replace(".", ","), m.saldo.toFixed(2).replace(".", ",")]) };
    }
  };
  const celula = (v: string | number) => {
    const s = String(v ?? "");
    const seguro = /^[=+\-@]/.test(s) && Number.isNaN(Number(s.replace(",", "."))) ? `'${s}` : s;
    return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const cabecalho = () => [`Período: ${rotPeriodo}`, `Responsável: ${resp || rotuloResponsaveis || "Todos"}`, `Categoria: ${categoria || "Todas"}`, `Cartão: ${cartao || "Todos"}`];
  const exportarCSV = () => {
    const t = montarTab();
    const csv = "﻿" + [`HomeCash - ${t.titulo}`, ...cabecalho(), "", t.cab.map(celula).join(";"), ...t.linhas.map((l) => l.map(celula).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `homecash-${aba}-${de}-a-${ate}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const imprimir = () => {
    const t = montarTab();
    const esc = (s: string | number) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const w = window.open("", "_blank");
    if (!w) return avisos.aviso("O navegador bloqueou a janela", "Permita pop-ups para este site e tente de novo.");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>HomeCash - ${esc(t.titulo)}</title><style>body{font-family:system-ui,Arial,sans-serif;color:#0f172a;margin:24px;font-size:12px}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;color:#475569}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f1f5f9}tr{page-break-inside:avoid}</style></head><body><h1>${esc(t.titulo)}</h1>${cabecalho().map((c) => `<p>${esc(c)}</p>`).join("")}<table><tr>${t.cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${t.linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  /* ---------- Pessoas: variação e maior categoria ---------- */
  const detalhePessoa = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    const qtd = new Map<string, number>();
    for (const x of r.movimentos) {
      if (x.tipo !== "Saída") continue;
      const p = x.responsavel || "Membro";
      const c = m.get(p) ?? new Map<string, number>();
      c.set(x.categoria || "Sem categoria", (c.get(x.categoria || "Sem categoria") || 0) + x.valor);
      m.set(p, c); qtd.set(p, (qtd.get(p) || 0) + 1);
    }
    return { m, qtd };
  }, [r]);

  const anteriorDe = (lista: { nome: string; valor: number }[], nome: string) => lista.find((g) => g.nome === nome)?.valor ?? 0;

  const chip = (ativo: boolean) => `h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${ativo ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max gap-1 rounded-full bg-surface p-1 ring-1 ring-line" role="tablist" aria-label="Relatórios">
          {ABAS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={chip(aba === a.id)}>{a.r}</button>)}
        </div>
      </div>

      {/* Filtros compactos */}
      <section className="card-glass space-y-3 p-4" aria-label="Filtros">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={preset === "custom" ? "" : "col-span-2 lg:col-span-1"}>
            <label htmlFor="rp-p" className={rotulo}>Período</label>
            <select id="rp-p" value={preset} onChange={(e) => { const p = e.target.value as Preset; if (p === "custom") { setDeC(de); setAteC(ate); } setPreset(p); }} className={campo}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.r}</option>)}
            </select>
          </div>
          {preset === "custom" && (
            <>
              <div><label htmlFor="rp-de" className={rotulo}>De</label><input id="rp-de" type="month" value={deC} onChange={(e) => setDeC(e.target.value)} className={campo} /></div>
              <div><label htmlFor="rp-ate" className={rotulo}>Até</label><input id="rp-ate" type="month" value={ateC} onChange={(e) => setAteC(e.target.value)} className={campo} /></div>
            </>
          )}
          {filtros.includes("resp") && opcoes.resp.length > 1 && (
            <div><label htmlFor="rp-r" className={rotulo}>Responsável</label><select id="rp-r" value={resp} onChange={(e) => setResp(e.target.value)} className={campo}><option value="">Todos</option>{opcoes.resp.map((x) => <option key={x}>{x}</option>)}</select></div>
          )}
          {filtros.includes("cat") && (
            <div><label htmlFor="rp-c" className={rotulo}>Categoria</label><select id="rp-c" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}><option value="">Todas</option>{opcoes.cat.map((x) => <option key={x}>{x}</option>)}</select></div>
          )}
          {filtros.includes("cartao") && cartoesCad.length > 0 && (
            <div><label htmlFor="rp-k" className={rotulo}>Cartão</label><select id="rp-k" value={cartao} onChange={(e) => setCartao(e.target.value)} className={campo}><option value="">Todos</option>{cartoesCad.map((c) => <option key={c.id}>{c.nome}</option>)}</select></div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{rotPeriodo} · {n} {n === 1 ? "mês" : "meses"}{aba !== "fluxo" && aba !== "repasses" ? ` · comparado a ${mesCurto(deAnt)} a ${mesCurto(ateAnt)}` : ""}</p>
          <div className="flex gap-2">
            <button type="button" onClick={exportarCSV} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold transition hover:bg-background"><Ico icon={Download} size={16} />Exportar CSV</button>
            <button type="button" onClick={imprimir} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold transition hover:bg-background"><Ico icon={Printer} size={16} />Imprimir / PDF</button>
          </div>
        </div>
      </section>

      {/* DESPESAS */}
      {aba === "despesas" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi rotulo="Total gasto" valor={brl(r.totais.saidas)}><Variacao atual={r.totais.saidas} anterior={ant.totais.saidas} /></Kpi>
            <Kpi rotulo="Média por mês" valor={brl(r.totais.saidas / n)}><span className="text-[11px] text-muted">{r.totais.movimentacoes} lançamentos</span></Kpi>
            <Kpi rotulo="Maior categoria" valor={r.porCategoria[0]?.nome ?? "—"}>{r.porCategoria[0] && <span className="text-[11px] text-muted">{brl(r.porCategoria[0].valor)} · {pct(r.porCategoria[0].pct, 0)} das saídas</span>}</Kpi>
          </div>
          <Bloco titulo="Evolução dos gastos" descricao={n > 1 ? "Saídas mês a mês no período." : "Saídas dos 6 meses até o mês selecionado."}>
            {evo.meses.some((m) => m.saidas > 0) ? <Linha dados={evo.meses.map((m) => ({ mes: m.mes, valor: m.saidas }))} /> : <SemDados />}
          </Bloco>
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco titulo="Gastos por categoria" descricao="Participação no total do período."><Ranking itens={r.porCategoria} /></Bloco>
            <Bloco titulo="Gastos por período" descricao="Total de cada mês e variação em relação ao anterior.">
              <Tabela cab={["Mês", "Saídas", "Variação"]} alinharDireita={[1, 2]} linhas={evo.meses.map((m, i, l) => {
                const p = i > 0 ? l[i - 1].saidas : 0;
                const d = p > 0 ? ((m.saidas - p) / p) * 100 : null;
                return [mesCurto(m.mes), brl(m.saidas), d === null ? "—" : <span key={m.mes} className={d > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>{d > 0 ? "▲" : "▼"} {pct(Math.abs(d), 0)}</span>];
              })} />
            </Bloco>
          </div>
          <Bloco titulo={`Lançamentos do período (${r.movimentos.filter((m) => m.tipo === "Saída").length})`} descricao="Despesas que compõem os totais acima.">
            {(() => {
              const sai = r.movimentos.filter((m) => m.tipo === "Saída").sort((a, b) => b.valor - a.valor);
              if (!sai.length) return <SemDados />;
              return (
                <>
                  <ul className="divide-y divide-line">
                    {sai.slice(0, limite).map((m, i) => (
                      <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2.5">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{m.descricao || "Sem descrição"}</p><p className="truncate text-xs text-muted">{[mesCurto(m.mes), m.categoria, m.forma, m.responsavel].filter(Boolean).join(" · ")}</p></div>
                        <p className="text-sm font-semibold tabular-nums">{brl(m.valor)}</p>
                      </li>
                    ))}
                  </ul>
                  {sai.length > limite && <button type="button" onClick={() => setLimite((l) => l + 30)} className="h-10 w-full rounded-xl border border-line text-sm font-medium text-accent hover:bg-background">Mostrar mais ({sai.length - limite})</button>}
                </>
              );
            })()}
          </Bloco>
        </>
      )}

      {/* POR PESSOA */}
      {aba === "pessoa" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi rotulo="Total gasto no grupo" valor={brl(r.totais.saidas)}><Variacao atual={r.totais.saidas} anterior={ant.totais.saidas} /></Kpi>
            <Kpi rotulo="Pessoas com gastos" valor={String(r.porResponsavel.length)} />
            <Kpi rotulo="Quem mais gastou" valor={r.porResponsavel[0]?.nome ?? "—"}>{r.porResponsavel[0] && <span className="text-[11px] text-muted">{brl(r.porResponsavel[0].valor)} · {pct(r.porResponsavel[0].pct, 0)}</span>}</Kpi>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco titulo="Comparação entre pessoas" descricao="Quanto cada pessoa gastou no período."><Ranking itens={r.porResponsavel} max={12} /></Bloco>
            <Bloco titulo="Detalhe por pessoa" descricao="Média mensal, maior categoria e variação.">
              <Tabela cab={["Pessoa", "Média/mês", "Maior categoria", "Variação"]} alinharDireita={[1, 3]} linhas={r.porResponsavel.map((g) => {
                const cats = [...(detalhePessoa.m.get(g.nome)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
                const a = anteriorDe(ant.porResponsavel, g.nome);
                const d = a > 0 ? ((g.valor - a) / a) * 100 : null;
                return [g.nome, brl(g.valor / n), cats[0]?.[0] ?? "—", d === null ? "—" : <span key={g.nome} className={d > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>{d > 0 ? "▲" : "▼"} {pct(Math.abs(d), 0)}</span>];
              })} />
            </Bloco>
          </div>
        </>
      )}

      {/* POR CARTÃO */}
      {aba === "cartao" && (() => {
        const lista = cartoesCad
          .filter((c) => !cartao || c.nome === cartao)
          .map((c) => {
            const lim = Number(c.limite) || 0;
            const fat = calcularFatura(estado as any, c.nome, ate, lim);
            const g = r.porForma.find((x) => x.nome === c.nome);
            return { c, lim, fat, total: g?.valor ?? 0, pct: g?.pct ?? 0, uso: lim > 0 ? Math.min(100, (fat.total / lim) * 100) : 0 };
          })
          .sort((a, b) => b.total - a.total);
        const totalCartoes = lista.reduce((t, x) => t + x.total, 0);
        const usoTotal = lista.reduce((t, x) => t + x.fat.total, 0);
        const limTotal = lista.reduce((t, x) => t + x.lim, 0);
        if (!cartoesCad.length) return <Bloco titulo="Por cartão"><SemDados texto="Nenhum cartão cadastrado." /></Bloco>;
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi rotulo="Gasto nos cartões" valor={brl(totalCartoes)}><span className="text-[11px] text-muted">{pct(r.totais.saidas > 0 ? (totalCartoes / r.totais.saidas) * 100 : 0, 0)} das saídas do período</span></Kpi>
              <Kpi rotulo={`Fatura de ${mesCurto(ate)}`} valor={brl(usoTotal)} />
              <Kpi rotulo="Limite utilizado" valor={limTotal > 0 ? pct((usoTotal / limTotal) * 100, 0) : "—"}>{limTotal > 0 && <span className="text-[11px] text-muted">de {brl(limTotal)} de limite</span>}</Kpi>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Bloco titulo="Despesas por cartão" descricao="Total gasto em cada cartão no período."><Ranking itens={lista.filter((x) => x.total > 0).map((x) => ({ nome: x.c.nome, valor: x.total, pct: x.pct }))} /></Bloco>
              <Bloco titulo="Utilização do limite" descricao={`Fatura de ${mesCurto(ate)} em relação ao limite.`}>
                {lista.length === 0 ? <SemDados /> : (
                  <ul className="space-y-4">
                    {lista.map((x) => (
                      <li key={x.c.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{x.c.nome}</span><span className="shrink-0 tabular-nums">{brl(x.fat.total)}{x.lim > 0 && <span className="text-xs text-muted"> / {brl(x.lim)}</span>}</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={Math.round(x.uso)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uso do limite de ${x.c.nome}`}>
                          <div className={`h-full rounded-full ${x.uso >= 90 ? "bg-rose-600 dark:bg-rose-500" : "bg-accent"}`} style={{ width: `${x.lim > 0 ? Math.max(2, x.uso) : 0}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">{x.lim > 0 ? `${pct(x.uso, 0)} usado · ${x.fat.excedido > 0 ? `excedido em ${brl(x.fat.excedido)}` : `disponível ${brl(x.fat.disponivel)}`}` : "Limite não informado"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>
            </div>
          </>
        );
      })()}

      {/* REPASSES */}
      {aba === "repasses" && (() => {
        const pend = soma(repasses.filter((l) => l.situacaoRepasse === "pendente"));
        const agu = soma(repasses.filter((l) => l.situacaoRepasse === "aguardando"));
        const conc = soma(repasses.filter((l) => l.situacaoRepasse === "concluido"));
        const tot = pend + agu + conc;
        const par = new Map<string, { de: string; para: string; pend: number; conc: number }>();
        for (const l of repasses) {
          const k = `${l.respId}>${l.autorId}`;
          const p = par.get(k) ?? { de: l.respNome, para: l.autorNome, pend: 0, conc: 0 };
          if (l.situacaoRepasse === "concluido") p.conc += l.valor; else p.pend += l.valor;
          par.set(k, p);
        }
        const seg = (v: number, cor: string, nome: string) => v > 0 ? <div key={nome} className={`h-full ${cor}`} style={{ width: `${(v / tot) * 100}%` }} title={`${nome}: ${brl(v)}`} /> : null;
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi rotulo="Pendentes" valor={brl(pend)} tom={pend > 0 ? "ruim" : undefined}><span className="text-[11px] text-muted">ainda não repassados</span></Kpi>
              <Kpi rotulo="Aguardando confirmação" valor={brl(agu)}><span className="text-[11px] text-muted">repassados, falta quem recebeu confirmar</span></Kpi>
              <Kpi rotulo="Concluídos" valor={brl(conc)} tom={conc > 0 ? "bom" : undefined}><span className="text-[11px] text-muted">{tot > 0 ? pct((conc / tot) * 100, 0) : "0%"} do total repassável</span></Kpi>
            </div>
            <Bloco titulo="Situação dos repasses" descricao={`Total de ${brl(tot)} entre membros no período.`}>
              {tot > 0 ? (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full bg-background" role="img" aria-label={`Pendentes ${brl(pend)}, aguardando ${brl(agu)}, concluídos ${brl(conc)}`}>
                    {seg(conc, "bg-emerald-600 dark:bg-emerald-500", "Concluídos")}{seg(agu, "bg-accent", "Aguardando")}{seg(pend, "bg-rose-600 dark:bg-rose-500", "Pendentes")}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-600" />Concluídos</span>
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" />Aguardando</span>
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-600" />Pendentes</span>
                  </div>
                </>
              ) : <SemDados texto="Nenhum repasse entre membros neste período." />}
            </Bloco>
            {tot > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Bloco titulo="Entre membros" descricao="Quem deve a quem.">
                  <Tabela cab={["Quem deve", "Quem recebe", "Em aberto", "Concluído"]} alinharDireita={[2, 3]} linhas={[...par.values()].sort((a, b) => b.pend - a.pend).map((p) => [p.de, p.para, brl(p.pend), brl(p.conc)])} />
                </Bloco>
                <Bloco titulo="Repasses do período" descricao="Maiores valores primeiro.">
                  <ul className="divide-y divide-line">
                    {[...repasses].sort((a, b) => b.valor - a.valor).slice(0, limite).map((l) => (
                      <li key={l.chave} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2.5">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{l.descricao}</p><p className="truncate text-xs text-muted">{mesCurto(l.mes)} · {l.respNome} → {l.autorNome}</p></div>
                        <div className="text-right"><p className="text-sm font-semibold tabular-nums">{brl(l.valor)}</p><p className="text-[11px] text-muted">{ROTULO_REP[l.situacaoRepasse]}</p></div>
                      </li>
                    ))}
                  </ul>
                  {repasses.length > limite && <button type="button" onClick={() => setLimite((x) => x + 30)} className="h-10 w-full rounded-xl border border-line text-sm font-medium text-accent hover:bg-background">Mostrar mais ({repasses.length - limite})</button>}
                </Bloco>
              </div>
            )}
          </>
        );
      })()}

      {/* ENTRADAS E SAÍDAS */}
      {aba === "fluxo" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi rotulo="Entradas" valor={brl(r.totais.entradas)} tom="bom"><Variacao atual={r.totais.entradas} anterior={ant.totais.entradas} subirEBom /></Kpi>
            <Kpi rotulo="Saídas" valor={brl(r.totais.saidas)} tom="ruim"><Variacao atual={r.totais.saidas} anterior={ant.totais.saidas} /></Kpi>
            <Kpi rotulo="Resultado do período" valor={`${r.totais.saldo < 0 ? "− " : ""}${brl(Math.abs(r.totais.saldo))}`} tom={r.totais.saldo < 0 ? "ruim" : "bom"}><span className="text-[11px] text-muted">{r.totais.entradas > 0 ? `Saídas = ${pct((r.totais.saidas / r.totais.entradas) * 100, 0)} das entradas` : "Sem entradas no período"}</span></Kpi>
          </div>
          <Bloco titulo="Entradas x saídas" descricao={n > 1 ? "Mês a mês no período." : "Os 6 meses até o mês selecionado."}>
            {evo.meses.some((m) => m.entradas > 0 || m.saidas > 0) ? <Colunas duas dados={evo.meses.map((m) => ({ mes: m.mes, a: m.entradas, b: m.saidas }))} /> : <SemDados />}
          </Bloco>
          <Bloco titulo="Resultado mês a mês">
            <Tabela cab={["Mês", "Entradas", "Saídas", "Resultado"]} alinharDireita={[1, 2, 3]} linhas={evo.meses.map((m) => [mesCurto(m.mes), brl(m.entradas), brl(m.saidas), <span key={m.mes} className={m.entradas - m.saidas < 0 ? "text-rose-700 dark:text-rose-400" : ""}>{brl(m.entradas - m.saidas)}</span>])} />
          </Bloco>
        </>
      )}
      <p className="text-[11px] text-muted">Valores calculados a partir dos seus lançamentos. A exportação sempre usa os valores reais.</p>
    </div>
  );
}

const ROTULO_REP = { pendente: "Pendente", aguardando: "Aguardando confirmação", concluido: "Concluído" } as const;
