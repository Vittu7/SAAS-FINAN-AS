/**
 * RELATÓRIO FINANCEIRO — usa a mesma lógica única de cálculo (calculos.ts):
 * os totais do relatório sempre batem com o resumo, o extrato e os gráficos.
 */
import { addMeses } from "./finance";
import { arred, calcularMes, ehEntrada, semDuplicados } from "./calculos";

type Item = Record<string, any>;
type Fonte = { extrato?: Item[]; cartao?: Item[]; contas?: Item[]; config?: { salario?: number } };

export type FiltroRelatorio = {
  de: string;
  ate: string;
  responsaveis?: string[];
  /** Só para exibição (CSV/PDF): pessoas do filtro global já aplicado nos dados. Não altera o cálculo. */
  rotuloResponsaveis?: string;
  categoria?: string;
};

export type MovimentoRelatorio = {
  mes: string;
  tipo: "Entrada" | "Saída";
  origem: "Entrada" | "À vista" | "Parcela" | "Conta fixa" | "Salário configurado";
  descricao: string;
  categoria: string;
  forma: string;
  responsavel: string;
  valor: number;
  situacao: string;
};

export type Grupo = { nome: string; valor: number; pct: number };

export type Relatorio = {
  filtro: FiltroRelatorio;
  geradoEm: string;
  totais: { entradas: number; saidas: number; saldo: number; faltaPagar: number; movimentacoes: number };
  meses: { mes: string; entradas: number; saidas: number; saldo: number }[];
  porCategoria: Grupo[];
  porResponsavel: Grupo[];
  porForma: Grupo[];
  porOrigem: Grupo[];
  movimentos: MovimentoRelatorio[];
};

const num = (v: unknown) => Number(v) || 0;

export function mesesDoPeriodo(de: string, ate: string): string[] {
  if (!de || !ate) return [];
  const [ini, fim] = de <= ate ? [de, ate] : [ate, de];
  const lista: string[] = [];
  for (let m = ini; m <= fim && lista.length < 60; m = addMeses(m, 1)) lista.push(m);
  return lista;
}

function agrupar(mapa: Map<string, number>, total: number): Grupo[] {
  return [...mapa.entries()]
    .map(([nome, valor]) => ({ nome, valor: arred(valor), pct: total > 0 ? (valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function gerarRelatorio(e: Fonte, f: FiltroRelatorio, agora: Date = new Date()): Relatorio {
  const meses = mesesDoPeriodo(f.de, f.ate);
  const escolhidos = f.responsaveis ?? [];
  const temFiltro = Boolean(escolhidos.length || f.categoria);
  const manter = (i: Item) => !i.foraDoMeuSaldo && (escolhidos.length === 0 || escolhidos.includes(i.responsavel)) && (!f.categoria || i.categoria === f.categoria);
  const fonte = {
    extrato: (e.extrato || []).filter(manter),
    cartao: (e.cartao || []).filter(manter),
    contas: (e.contas || []).filter(manter),
  };
  // O salário configurado só substitui entradas ausentes quando não há filtro por pessoa/categoria
  const salarioConfig = temFiltro ? 0 : num(e.config?.salario);

  const porMes: Relatorio["meses"] = [];
  const movimentos: MovimentoRelatorio[] = [];
  const cat = new Map<string, number>();
  const resp = new Map<string, number>();
  const forma = new Map<string, number>();
  const orig = new Map<string, number>();
  let faltaPagar = 0;
  const somar = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);

  for (const mes of meses) {
    const r = calcularMes(fonte, { mes, salarioConfig });
    porMes.push({ mes, entradas: r.entradas, saidas: r.saidas, saldo: r.saldoRestante });
    faltaPagar += r.faltaPagar;
    const doMes = (o: "extrato" | "cartao" | "contas") => semDuplicados(fonte[o].filter((i) => i.mes === mes), o);

    if (r.fallbackSalario) {
      movimentos.push({ mes, tipo: "Entrada", origem: "Salário configurado", descricao: "Salário configurado", categoria: "Salário", forma: "", responsavel: "", valor: r.entradas, situacao: "Previsto" });
    }
    for (const i of doMes("extrato")) {
      const entrada = ehEntrada(i);
      const valor = num(i.valor);
      movimentos.push({ mes, tipo: entrada ? "Entrada" : "Saída", origem: entrada ? "Entrada" : "À vista", descricao: i.descricao || "", categoria: i.categoria || "", forma: entrada ? "" : i.pagamento || "", responsavel: i.responsavel || "", valor, situacao: entrada ? "Recebido" : "Pago" });
      if (!entrada) { somar(cat, i.categoria || "Sem categoria", valor); somar(resp, i.responsavel || "Membro", valor); somar(forma, i.pagamento || "Sem forma", valor); somar(orig, "À vista", valor); }
    }
    for (const i of doMes("cartao")) {
      const valor = num(i.valor);
      const pa = i.parcelaAtual ?? i.parcela_atual ?? 1;
      const pt = i.parcelaTotal ?? i.parcela_total ?? 1;
      movimentos.push({ mes, tipo: "Saída", origem: "Parcela", descricao: `${i.descricao || i.nome || ""} (${pa}/${pt})`, categoria: i.categoria || "", forma: i.cartao || "", responsavel: i.responsavel || "", valor, situacao: `Parcela ${pa}/${pt}` });
      somar(cat, i.categoria || "Sem categoria", valor); somar(resp, i.responsavel || "Membro", valor); somar(forma, i.cartao || "Sem forma", valor); somar(orig, "Parcelas", valor);
    }
    for (const i of doMes("contas")) {
      const valor = num(i.valor);
      movimentos.push({ mes, tipo: "Saída", origem: "Conta fixa", descricao: i.nome || "", categoria: i.categoria || "", forma: i.forma_pagamento || "", responsavel: i.responsavel || "", valor, situacao: i.pago ? "Pago" : "Pendente" });
      somar(cat, i.categoria || "Sem categoria", valor); somar(resp, i.responsavel || "Membro", valor); somar(forma, i.forma_pagamento || "Sem forma", valor); somar(orig, "Contas fixas", valor);
    }
  }

  const entradas = arred(porMes.reduce((t, m) => t + m.entradas, 0));
  const saidas = arred(porMes.reduce((t, m) => t + m.saidas, 0));
  movimentos.sort((a, b) => a.mes.localeCompare(b.mes) || (a.tipo === b.tipo ? b.valor - a.valor : a.tipo === "Entrada" ? -1 : 1));

  return {
    filtro: f,
    geradoEm: agora.toLocaleString("pt-BR"),
    totais: { entradas, saidas, saldo: arred(entradas - saidas), faltaPagar: arred(faltaPagar), movimentacoes: movimentos.length },
    meses: porMes,
    porCategoria: agrupar(cat, saidas),
    porResponsavel: agrupar(resp, saidas),
    porForma: agrupar(forma, saidas),
    porOrigem: agrupar(orig, saidas),
    movimentos,
  };
}

/* ---------- Exportação (sempre com valores reais, mesmo com "ocultar valores" ligado) ---------- */
export const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const mesCurto = (mes: string) => mes.split("-").reverse().join("/");
const dec = (n: number) => n.toFixed(2).replace(".", ",");

function celula(v: string | number): string {
  const s = String(v ?? "");
  // Evita "injeção de fórmula" ao abrir no Excel e escapa aspas/separadores
  const seguro = /^[=+\-@]/.test(s) && Number.isNaN(Number(s.replace(",", "."))) ? `'${s}` : s;
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function relatorioParaCSV(r: Relatorio): string {
  const l = (...c: (string | number)[]) => c.map(celula).join(";");
  const grupo = (titulo: string, g: Grupo[]) => ["", l(titulo, "Valor (R$)", "% das saídas"), ...g.map((x) => l(x.nome, dec(x.valor), dec(x.pct)))];
  const linhas = [
    l("Relatório financeiro HomeCash"),
    l("Período", `${mesCurto(r.filtro.de)} a ${mesCurto(r.filtro.ate)}`),
    l("Responsáveis", r.filtro.rotuloResponsaveis || (r.filtro.responsaveis?.length ? r.filtro.responsaveis.join(", ") : "Todos")),
    l("Categoria", r.filtro.categoria || "Todas"),
    l("Gerado em", r.geradoEm),
    "",
    l("Resumo", "Valor (R$)"),
    l("Entradas", dec(r.totais.entradas)),
    l("Saídas", dec(r.totais.saidas)),
    l("Saldo restante", dec(r.totais.saldo)),
    l("Falta pagar (contas fixas)", dec(r.totais.faltaPagar)),
    "",
    l("Mês", "Entradas (R$)", "Saídas (R$)", "Saldo (R$)"),
    ...r.meses.map((m) => l(mesCurto(m.mes), dec(m.entradas), dec(m.saidas), dec(m.saldo))),
    ...grupo("Saídas por categoria", r.porCategoria),
    ...grupo("Saídas por responsável", r.porResponsavel),
    ...grupo("Saídas por forma de pagamento", r.porForma),
    ...grupo("Saídas por tipo", r.porOrigem),
    "",
    l("Mês", "Tipo", "Origem", "Descrição", "Categoria", "Forma de pagamento", "Responsável", "Valor (R$)", "Situação"),
    ...r.movimentos.map((m) => l(mesCurto(m.mes), m.tipo, m.origem, m.descricao, m.categoria, m.forma, m.responsavel, dec(m.valor), m.situacao)),
  ];
  return "\ufeff" + linhas.join("\r\n"); // BOM para o Excel reconhecer acentos
}

const esc = (s: string | number) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function relatorioParaHTML(r: Relatorio): string {
  const tabelaGrupo = (t: string, g: Grupo[]) =>
    g.length ? `<h2>${esc(t)}</h2><table><tr><th>Nome</th><th class="n">Valor</th><th class="n">%</th></tr>${g.map((x) => `<tr><td>${esc(x.nome)}</td><td class="n">${moeda(x.valor)}</td><td class="n">${x.pct.toFixed(1)}%</td></tr>`).join("")}</table>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório financeiro HomeCash</title>
<style>
body{font-family:system-ui,Arial,sans-serif;color:#0f172a;margin:24px;font-size:12px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
p{margin:2px 0;color:#475569}table{width:100%;border-collapse:collapse;margin-top:4px}
th,td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}th{background:#f1f5f9}.n{text-align:right;white-space:nowrap}
.cards{display:flex;gap:10px;margin:12px 0}.c{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:10px}.c b{display:block;font-size:16px;margin-top:4px}
.e{color:#047857}.s{color:#be123c}tr{page-break-inside:avoid}@media print{body{margin:10mm}}
</style></head><body>
<h1>Relatório financeiro HomeCash</h1>
<p>Período: ${mesCurto(r.filtro.de)} a ${mesCurto(r.filtro.ate)} · Responsáveis: ${esc(r.filtro.rotuloResponsaveis || (r.filtro.responsaveis?.length ? r.filtro.responsaveis.join(", ") : "Todos"))} · Categoria: ${esc(r.filtro.categoria || "Todas")}</p>
<p>Gerado em ${esc(r.geradoEm)}</p>
<div class="cards">
<div class="c">Entradas<b class="e">${moeda(r.totais.entradas)}</b></div>
<div class="c">Saídas<b class="s">${moeda(r.totais.saidas)}</b></div>
<div class="c">Saldo restante<b>${moeda(r.totais.saldo)}</b></div>
<div class="c">Falta pagar<b>${moeda(r.totais.faltaPagar)}</b></div></div>
<h2>Resumo por mês</h2><table><tr><th>Mês</th><th class="n">Entradas</th><th class="n">Saídas</th><th class="n">Saldo</th></tr>
${r.meses.map((m) => `<tr><td>${mesCurto(m.mes)}</td><td class="n">${moeda(m.entradas)}</td><td class="n">${moeda(m.saidas)}</td><td class="n">${moeda(m.saldo)}</td></tr>`).join("")}</table>
${tabelaGrupo("Saídas por categoria", r.porCategoria)}${tabelaGrupo("Saídas por responsável", r.porResponsavel)}${tabelaGrupo("Saídas por forma de pagamento", r.porForma)}
<h2>Movimentações (${r.movimentos.length})</h2><table><tr><th>Mês</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th>Responsável</th><th>Situação</th><th class="n">Valor</th></tr>
${r.movimentos.map((m) => `<tr><td>${mesCurto(m.mes)}</td><td>${esc(m.origem)}</td><td>${esc(m.descricao)}</td><td>${esc(m.categoria)}</td><td>${esc(m.forma)}</td><td>${esc(m.responsavel)}</td><td>${esc(m.situacao)}</td><td class="n ${m.tipo === "Entrada" ? "e" : "s"}">${m.tipo === "Entrada" ? "+ " : "− "}${moeda(m.valor)}</td></tr>`).join("")}</table>
</body></html>`;
}
