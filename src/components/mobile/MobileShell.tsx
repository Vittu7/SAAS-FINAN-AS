"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Menu, Moon, Palette, Sun, SunMoon, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ICONES, ICONE_ABA, Ico } from "@/components/icons";
import { addMeses, brl, pct as porc, rotuloMes, useValoresOcultos, type Resumo } from "@/lib/finance";
import { useAparencia } from "@/components/ThemeToggle";
import Avatar from "@/components/Avatar";
import { sairDaConta } from "@/lib/auth";
import BotaoOcultarValores from "@/components/BotaoOcultarValores";
import DialogResponsivo from "@/components/DialogResponsivo";

type Aba = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas" | "fatura" | "graficos" | "investimentos" | "ajuda" | "grupo" | "ajustes";

/* ---------- Cabeçalho do app no celular ---------- */
export function MobileHeader({
  titulo,
  mes,
  setMes,
  membroSelecionado,
  setMembroSelecionado,
  listaMembros,
  onAbrirMenu,
  mostrarMes = true,
  mostrarVisualizacao = true,
}: {
  mostrarMes?: boolean;
  mostrarVisualizacao?: boolean;
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="min-w-0 truncate text-lg font-semibold">{titulo}</span>
        </div>
        <div className="flex items-center gap-2">
          <BotaoOcultarValores className="!size-10 !rounded-full !border-0 shadow-sm ring-1 ring-line" />
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menu"
            className="grid size-10 place-items-center rounded-full bg-surface shadow-sm ring-1 ring-line active:scale-95"
          >
            <Ico icon={Menu} />
          </button>
        </div>
      </div>

      {(mostrarMes || mostrarVisualizacao) && <div className="mt-3 flex items-center gap-2">
        {mostrarMes && <div className="flex h-9 flex-1 items-center justify-between rounded-full bg-surface px-1 ring-1 ring-line">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMes(addMeses(mes, -1))}
            className="grid size-7 place-items-center rounded-full text-muted active:bg-background"
          >
            <Ico icon={ChevronLeft} size={18} />
          </button>
          <span className="text-sm font-medium capitalize" aria-live="polite">
            {rotuloMes(mes)}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMes(addMeses(mes, 1))}
            className="grid size-7 place-items-center rounded-full text-muted active:bg-background"
          >
            <Ico icon={ChevronRight} size={18} />
          </button>
        </div>}
        {mostrarVisualizacao && <select
          aria-label="Visualização"
          value={membroSelecionado}
          onChange={(e) => setMembroSelecionado(e.target.value)}
          className="h-9 max-w-[42%] rounded-full bg-surface px-3 text-xs font-medium text-ink outline-none ring-1 ring-line"
        >
          <option value="EU">Somente eu</option>
          <option value="TODOS">Todo o grupo</option>
          {listaMembros.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>}
      </div>}
    </header>
  );
}

/* ---------- Resumo do mês: saldo em destaque + entradas (verde) e saídas (vermelho) ---------- */
export type TipoResumo = "gastos" | "disponivel" | "entradas";

export function MobileSaldo({
  resumo,
  onAbrirExtrato,
}: {
  resumo: Resumo;
  onAbrirExtrato?: (tipo: TipoResumo) => void;
}) {
  const [oculto, setOculto] = useValoresOcultos();
  const negativo = resumo.sobra < 0;
  const pct = resumo.entradas > 0 ? Math.min(100, (resumo.totalGasto / resumo.entradas) * 100) : 0;
  const v = (n: number) => brl(n);
  const cartao = "rounded-2xl bg-surface p-4 text-left ring-1 ring-line active:scale-[0.98]";

  return (
    <section className="md:hidden" aria-label="Resumo do mês">
      <button
        type="button"
        onClick={() => onAbrirExtrato?.("disponivel")}
        className={`relative block w-full overflow-hidden rounded-3xl p-5 text-left shadow-lg ${negativo ? "bg-rose-700 text-white" : "bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent),black_28%)] text-on-accent"}`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <p className="text-xs font-medium opacity-80">{negativo ? "Saldo negativo" : "Saldo restante"}</p>
          <span
            role="button"
            tabIndex={0}
            aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
            onClick={(e) => { e.stopPropagation(); setOculto(!oculto); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setOculto(!oculto); } }}
            className="grid size-8 place-items-center rounded-full bg-white/15 active:scale-95"
          >
            <Ico icon={oculto ? Eye : EyeOff} size={16} />
          </span>
        </div>
        <p className="relative mt-2 text-4xl font-semibold tracking-tight tabular-nums">{negativo ? "− " : ""}{v(Math.abs(resumo.sobra))}</p>
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="relative mt-2 text-xs opacity-80">{porc(pct)} das entradas já usado</p>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onAbrirExtrato?.("entradas")} className={cartao}>
          <p className="flex items-center gap-1.5 text-xs text-muted"><span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><Ico icon={ArrowDownLeft} size={12} /></span>Entradas</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{v(resumo.entradas)}</p>
        </button>
        <button type="button" onClick={() => onAbrirExtrato?.("gastos")} className={cartao}>
          <p className="flex items-center gap-1.5 text-xs text-muted"><span className="grid size-5 place-items-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400"><Ico icon={ArrowUpRight} size={12} /></span>Saídas</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">{v(resumo.totalGasto)}</p>
          {resumo.faltaPagar > 0 && <p className="mt-0.5 text-[11px] text-muted">Falta pagar {v(resumo.faltaPagar)}</p>}
        </button>
      </div>
    </section>
  );
}

/* ---------- Módulos acessados recentemente (sem atalhos duplicados da barra inferior) ---------- */
const MODULOS: Record<string, { r: string; s: LucideIcon }> = {
  fatura: { r: "Cartões", s: ICONE_ABA.fatura },
  graficos: { r: "Gráficos", s: ICONE_ABA.graficos },
  investimentos: { r: "Investimentos", s: ICONE_ABA.investimentos },
  ajuda: { r: "Ajuda", s: ICONE_ABA.ajuda },
  cartao: { r: "Parceladas", s: ICONE_ABA.cartao },
  contas: { r: "Contas fixas", s: ICONE_ABA.contas },
  lancamentos: { r: "Lançamentos", s: ICONE_ABA.lancamentos },
};

export function MobileRecentes({ recentes, onAba }: { recentes: string[]; onAba: (a: Aba) => void }) {
  // Só o histórico REAL do usuário atual (nada de sugestões de outras pessoas)
  const ids = recentes.filter((id, i, l) => MODULOS[id] && l.indexOf(id) === i).slice(0, 3);
  if (ids.length === 0) return null;
  return (
    <section className="md:hidden" aria-label="Acessados recentemente">
      <p className="mb-2 px-1 text-xs font-medium text-muted">Acessados recentemente</p>
      <div className="grid grid-cols-3 gap-2">
        {ids.map((id) => (
          <button key={id} type="button" onClick={() => onAba(id as Aba)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-surface px-2 py-3 text-xs font-medium ring-1 ring-line active:scale-95">
            <span className="text-accent"><Ico icon={MODULOS[id].s} size={20} /></span>
            <span className="truncate">{MODULOS[id].r}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Barra inferior: Início, Extrato, Nova transação, Grupo, Perfil ---------- */
export function MobileBottomNav({ aba, onAba, onNova, onGrupo, perfil }: { aba: Aba; onAba: (a: Aba) => void; onNova: () => void; onGrupo: () => void; perfil?: { nome: string; avatar: string | null; cor: string | null } }) {
  const Item = ({ ativo, r, s, onClick }: { ativo: boolean; r: string; s: LucideIcon; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition ${ativo ? "text-accent" : "text-muted"}`}
    >
      <span className={`grid h-7 w-12 place-items-center rounded-full ${ativo ? "bg-accent/15" : ""}`}><Ico icon={s} size={22} /></span>
      {r}
    </button>
  );

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        <Item ativo={aba === "inicio"} r="Início" s={ICONE_ABA.inicio} onClick={() => onAba("inicio")} />
        <Item ativo={aba === "extrato"} r="Extrato" s={ICONE_ABA.extrato} onClick={() => onAba("extrato")} />
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onNova}
            aria-label="Nova transação"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg ring-4 ring-background active:scale-95"
          >
            <Ico icon={ICONES.novo} size={26} />
          </button>
        </div>
        <Item ativo={aba === "grupo"} r="Grupo" s={ICONES.grupo} onClick={onGrupo} />
        <button type="button" onClick={() => onAba("ajustes")} aria-current={aba === "ajustes" ? "page" : undefined} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition ${aba === "ajustes" ? "text-accent" : "text-muted"}`}>
          <span className="grid h-7 w-12 place-items-center">
            {perfil ? <Avatar src={perfil.avatar} nome={perfil.nome} cor={perfil.cor} tamanho={26} anel={aba === "ajustes"} /> : <Ico icon={ICONE_ABA.ajustes} size={22} />}
          </span>
          <span className="max-w-full truncate px-0.5 text-[10px] leading-tight">Configurações</span>
        </button>
      </div>
    </nav>
  );
}

/* ---------- Menu lateral (gaveta fixa à direita) ---------- */
export function MobileMenu({
  aberto,
  onFechar,
  onGrupo,
  onAba,
  perfil,
  abaAtiva,
  onAjustes,
}: {
  aberto: boolean;
  onFechar: () => void;
  onGrupo: () => void;
  onAba: (a: Aba) => void;
  perfil?: { nome: string; avatar: string | null; cor: string | null; email?: string };
  abaAtiva?: Aba;
  /** Abre Configurações já em uma seção específica (ex.: aparência) */
  onAjustes?: (secao: "perfil" | "aparencia") => void;
}) {
  const router = useRouter();
  const { tema, mudarTema } = useAparencia();

  useEffect(() => {
    if (!aberto) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", esc); };
  }, [aberto, onFechar]);

  if (!aberto || typeof document === "undefined") return null;

  const sair = async () => {
    await sairDaConta(supabase);
    router.push("/login");
  };
  const ir = (a: Aba) => { onFechar(); onAba(a); };
  const linha = "flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium active:bg-background";
  const icone = "grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent";

  return createPortal(
    <div className="fixed inset-0 z-[10020] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/50 anim-fade" onClick={onFechar} />
      <aside className="absolute inset-y-0 right-0 flex w-[min(85vw,340px)] flex-col bg-surface shadow-2xl" style={{ paddingTop: "max(env(safe-area-inset-top),16px)", paddingBottom: "max(env(safe-area-inset-bottom),16px)", animation: "hc-drawer-in .28s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes hc-drawer-in{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <header className="flex items-center gap-3 px-4 pb-3">
          <button type="button" onClick={() => { onFechar(); (onAjustes ? onAjustes("perfil") : onAba("ajustes")); }} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left active:bg-background">
            <Avatar src={perfil?.avatar} nome={perfil?.nome} cor={perfil?.cor || "var(--accent)"} tamanho="lg" />
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold">{perfil?.nome || "Meu perfil"}</span>
              <span className="block text-xs text-muted">Ver perfil e configurações</span>
            </span>
          </button>
          <button type="button" onClick={onFechar} aria-label="Fechar menu" className="grid size-10 shrink-0 place-items-center rounded-full text-muted active:bg-background"><Ico icon={X} /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          {([
            ["Cartões e contas", [["fatura", "Cartões e Faturas"], ["cartao", "Contas parceladas"], ["contas", "Contas fixas"], ["lancamentos", "Lançamentos do mês"]]],
            ["Análises", [["graficos", "Gráficos e relatórios"], ["investimentos", "Investimentos"]]],
          ] as [string, [Aba, string][]][]).map(([titulo, itens]) => (
            <section key={titulo}>
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{titulo}</p>
              <div className="grid grid-cols-2 gap-2 anim-stagger">
                {itens.map(([id, rotulo]) => (
                  <button key={id} type="button" onClick={() => ir(id)} aria-current={abaAtiva === id ? "page" : undefined}
                    className={`flex min-h-24 flex-col items-start justify-between rounded-2xl p-3 text-left text-sm font-medium ring-1 transition active:scale-[0.97] ${abaAtiva === id ? "bg-accent/12 text-accent ring-accent/40" : "bg-background ring-line"}`}>
                    <span className="grid size-9 place-items-center rounded-full bg-accent/10 text-accent"><Ico icon={ICONE_ABA[id]} size={18} /></span>
                    <span className="leading-tight">{rotulo}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section>
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Grupo e suporte</p>
            <button type="button" className={linha} onClick={() => { onFechar(); onGrupo(); }}><span className={icone}><Ico icon={ICONES.grupo} /></span>Gerenciar grupo</button>
            <button type="button" className={linha} onClick={() => ir("ajuda")}><span className={icone}><Ico icon={ICONE_ABA.ajuda} /></span>Central de ajuda</button>
          </section>

          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Tema</p>
          <div className="mx-1 grid grid-cols-3 gap-1 rounded-2xl bg-background p-1 ring-1 ring-line">
            {([["light", Sun, "Claro"], ["dark", Moon, "Escuro"], ["system", SunMoon, "Sistema"]] as const).map(([id, s, r]) => (
              <button key={id} type="button" aria-pressed={tema === id} onClick={() => mudarTema(id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium ${tema === id ? "bg-accent text-on-accent" : "text-ink"}`}>
                <Ico icon={s} size={18} />{r}
              </button>
            ))}
          </div>
          <button type="button" className={`${linha} mt-1 text-muted`} onClick={() => { onFechar(); (onAjustes ? onAjustes("aparencia") : onAba("ajustes")); }}><span className={icone}><Ico icon={Palette} /></span>Mais opções de aparência</button>
        </div>
        <div className="border-t border-line px-3 pt-2">
          <button type="button" className={`${linha} text-rose-500`} onClick={sair}>
            <span className="grid size-10 place-items-center rounded-full bg-rose-500/10"><Ico icon={ICONES.sair} /></span>Sair da conta
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}

/* ---------- Gaveta que sobe de baixo ---------- */
export function Sheet({
  aberto,
  onFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return aberto ? <DialogResponsivo titulo={titulo} onFechar={onFechar}><div className="space-y-1">{children}</div></DialogResponsivo> : null;
}
