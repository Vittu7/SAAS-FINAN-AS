"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { addMeses, brl, rotuloMes, type Resumo } from "@/lib/finance";
import ThemeToggle from "@/components/ThemeToggle";

type Aba = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas";

/* ---------- Cabeçalho do app no celular ---------- */
export function MobileHeader({
  titulo,
  mes,
  setMes,
  membroSelecionado,
  setMembroSelecionado,
  listaMembros,
  onAbrirMenu,
}: {
  titulo: string;
  mes: string;
  setMes: (m: string) => void;
  membroSelecionado: string;
  setMembroSelecionado: (m: string) => void;
  listaMembros: string[];
  onAbrirMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-4 bg-background/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="text-lg font-semibold tracking-tight">{titulo}</span>
        </div>
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menu"
          className="grid size-10 place-items-center rounded-full bg-surface text-lg shadow-sm ring-1 ring-line active:scale-95"
        >
          ☰
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex h-9 flex-1 items-center justify-between rounded-full bg-surface px-1 ring-1 ring-line">
          <button type="button" aria-label="Mês anterior" onClick={() => setMes(addMeses(mes, -1))}
            className="grid size-7 place-items-center rounded-full text-muted active:bg-background">‹</button>
          <span className="text-sm font-medium capitalize" aria-live="polite">{rotuloMes(mes)}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => setMes(addMeses(mes, 1))}
            className="grid size-7 place-items-center rounded-full text-muted active:bg-background">›</button>
        </div>
        <select
          aria-label="Visualização"
          value={membroSelecionado}
          onChange={(e) => setMembroSelecionado(e.target.value)}
          className="h-9 max-w-[42%] rounded-full bg-surface px-3 text-xs font-medium text-ink outline-none ring-1 ring-line"
        >
          <option value="TODOS">Todo o grupo</option>
          <option value="EU">Somente eu</option>
          {listaMembros.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </header>
  );
}

/* ---------- Cartão de saldo estilo banco digital ---------- */
export function MobileSaldo({
  resumo,
  salario,
  onConfig,
}: {
  resumo: Resumo;
  salario: number;
  onConfig: (salario: number) => void;
}) {
  const [oculto, setOculto] = useState(false);
  const negativo = resumo.sobra < 0;
  const pct = resumo.salario > 0 ? Math.min(100, (resumo.meusGastos / resumo.salario) * 100) : 0;
  const v = (n: number) => (oculto ? "R$ ••••" : brl(n));

  const editarSalario = () => {
    const t = window.prompt("Salário mensal (R$)", salario ? String(salario).replace(".", ",") : "");
    if (t == null) return;
    const n = Number(t.replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) onConfig(n);
  };

  return (
    <section className="md:hidden">
      <div className={`relative overflow-hidden rounded-3xl p-5 shadow-lg ${negativo ? "bg-rose-600 text-white" : "bg-accent text-on-accent"}`}>
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 size-36 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <p className="text-xs font-medium opacity-80">{negativo ? "Acima do salário" : "Disponível no mês"}</p>
          <button type="button" onClick={() => setOculto((o) => !o)} aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium active:scale-95">
            {oculto ? "Mostrar" : "Ocultar"}
          </button>
        </div>
        <p className="relative mt-2 text-4xl font-semibold tracking-tight tabular-nums">{v(Math.abs(resumo.sobra))}</p>
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="relative mt-2 text-xs opacity-80">{pct.toFixed(0)}% do salário já usado</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={editarSalario} className="rounded-2xl bg-surface p-4 text-left ring-1 ring-line active:scale-[0.98]">
          <p className="text-xs text-muted">Salário ✎</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{v(salario)}</p>
        </button>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p className="text-xs text-muted">Gasto no mês</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{v(resumo.totalGasto)}</p>
        </div>
      </div>

      <div className="mt-3 divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
        {[
          { r: "Lançamentos", n: resumo.porOrigem.extrato, s: "≡" },
          { r: "Parcelas", n: resumo.porOrigem.cartao, s: "▤" },
          { r: "Contas fixas", n: resumo.porOrigem.contas, s: "▣" },
        ].map((i) => (
          <div key={i.r} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-accent/10 text-accent">{i.s}</span>
            <span className="flex-1 text-sm">{i.r}</span>
            <span className="text-sm font-semibold tabular-nums">{v(i.n)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Atalhos rápidos ---------- */
export function MobileAtalhos({ onAba, onGrupo }: { onAba: (a: Aba) => void; onGrupo: () => void }) {
  const itens = [
    { r: "Lançar", s: "＋", f: () => onAba("lancamentos") },
    { r: "Extrato", s: "≡", f: () => onAba("extrato") },
    { r: "Gráficos", s: "◷", f: () => document.getElementById("graficos")?.scrollIntoView({ behavior: "smooth" }) },
    { r: "Grupo", s: "◉", f: onGrupo },
  ];
  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 py-1 md:hidden">
      {itens.map((i) => (
        <button key={i.r} type="button" onClick={i.f} className="flex min-w-16 flex-col items-center gap-1.5 active:scale-95">
          <span className="grid size-14 place-items-center rounded-full bg-surface text-xl text-accent ring-1 ring-line">{i.s}</span>
          <span className="text-xs font-medium">{i.r}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Barra de navegação inferior ---------- */
export function MobileBottomNav({ aba, onAba }: { aba: Aba; onAba: (a: Aba) => void }) {
  const [novoAberto, setNovoAberto] = useState(false);
  const Item = ({ id, r, s }: { id: Aba; r: string; s: string }) => {
    const ativo = aba === id;
    return (
      <button type="button" onClick={() => onAba(id)} aria-current={ativo ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${ativo ? "text-accent" : "text-muted"}`}>
        <span className={`grid h-7 w-12 place-items-center rounded-full text-lg ${ativo ? "bg-accent/15" : ""}`}>{s}</span>
        {r}
      </button>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-end px-2">
          <Item id="inicio" r="Início" s="⌂" />
          <Item id="extrato" r="Extrato" s="≡" />
          <div className="flex flex-1 justify-center">
            <button type="button" onClick={() => setNovoAberto(true)} aria-label="Novo lançamento"
              className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-2xl text-on-accent shadow-lg ring-4 ring-background active:scale-95">
              ＋
            </button>
          </div>
          <Item id="cartao" r="Parcelas" s="▤" />
          <Item id="contas" r="Fixas" s="▣" />
        </div>
      </nav>

      <Sheet aberto={novoAberto} onFechar={() => setNovoAberto(false)} titulo="Novo lançamento">
        {[
          { id: "lancamentos" as Aba, r: "Lançamento normal", d: "Gasto ou entrada do dia a dia", s: "≡" },
          { id: "cartao" as Aba, r: "Conta parcelada", d: "Compras divididas em parcelas", s: "▤" },
          { id: "contas" as Aba, r: "Conta fixa", d: "Aluguel, internet, assinaturas", s: "▣" },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => { onAba(t.id); setNovoAberto(false); }}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left active:bg-background">
            <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-lg text-accent">{t.s}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{t.r}</span>
              <span className="block text-xs text-muted">{t.d}</span>
            </span>
            <span className="text-muted">›</span>
          </button>
        ))}
      </Sheet>
    </>
  );
}

/* ---------- Menu (perfil, grupo, tema, sair) ---------- */
export function MobileMenu({ aberto, onFechar, onGrupo }: { aberto: boolean; onFechar: () => void; onGrupo: () => void }) {
  const router = useRouter();
  const sair = async () => { await supabase.auth.signOut(); router.push("/login"); };
  const linha = "flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium active:bg-background";
  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo="Menu">
      <button type="button" className={linha} onClick={() => { onFechar(); router.push("/perfil"); }}>
        <span className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent">⚙</span>Perfil e ajustes
      </button>
      <button type="button" className={linha} onClick={() => { onFechar(); onGrupo(); }}>
        <span className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent">◉</span>Gerenciar grupo
      </button>
      <div className={`${linha} justify-between`}>
        <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent">◐</span>Tema</span>
        <ThemeToggle />
      </div>
      <button type="button" className={`${linha} text-rose-500`} onClick={sair}>
        <span className="grid size-10 place-items-center rounded-full bg-rose-500/10">↪</span>Sair da conta
      </button>
    </Sheet>
  );
}

/* ---------- Gaveta que sobe de baixo ---------- */
export function Sheet({ aberto, onFechar, titulo, children }: { aberto: boolean; onFechar: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 md:hidden ${aberto ? "" : "pointer-events-none"}`} aria-hidden={!aberto}>
      <div onClick={onFechar} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${aberto ? "opacity-100" : "opacity-0"}`} />
      <div role="dialog" aria-label={titulo}
        className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 shadow-2xl transition-transform duration-300 ease-out ${aberto ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <p className="px-3 pb-2 text-base font-semibold">{titulo}</p>
        <div className="space-y-1">{children}</div>
      </div>
    </div>
  );
}
