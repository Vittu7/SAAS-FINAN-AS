"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Menu, Moon, Palette, Pencil, Sun, SunMoon, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ICONES, ICONE_ABA, Ico } from "@/components/icons";
import { useValoresOcultos } from "@/hooks/useValoresOcultos";
import { addMeses, brl, rotuloMes, type Resumo } from "@/lib/finance";
import { useAparencia } from "@/components/ThemeToggle";
import DialogResponsivo from "@/components/DialogResponsivo";

type Aba = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas" | "fatura" | "ajustes";

/* ---------- Botão compartilhado: ocultar/mostrar valores ---------- */
export function BotaoOcultarValores({ className = "" }: { className?: string }) {
  const { oculto, alternar } = useValoresOcultos();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oculto}
      aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
      title={oculto ? "Mostrar valores" : "Ocultar valores"}
      className={className}
    >
      <Ico icon={oculto ? EyeOff : Eye} />
    </button>
  );
}

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
          <BotaoOcultarValores className="grid size-10 place-items-center rounded-full bg-surface shadow-sm ring-1 ring-line active:scale-95" />
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

/* ---------- Cartão de saldo estilo banco digital ---------- */
export function MobileSaldo({
  resumo,
  salario,
  onConfig,
  onAbrirExtrato,
  onAbrirResumo,
}: {
  resumo: Resumo;
  salario: number;
  onConfig: (salario: number) => void;
  onAbrirExtrato?: (tipo: "gastos" | "disponivel") => void;
  /** Abre o módulo correspondente (com filtros) ao tocar numa linha do resumo por origem. */
  onAbrirResumo?: (origem: "extrato" | "cartao" | "contas") => void;
}) {
  const { oculto, alternar } = useValoresOcultos();
  const negativo = resumo.sobra < 0;
  const pct = resumo.salario > 0 ? Math.min(100, (resumo.meusGastos / resumo.salario) * 100) : 0;
  const v = (n: number) => brl(n);

  const editarSalario = () => {
    const t = window.prompt("Salário mensal (R$)", salario && !oculto ? String(salario).replace(".", ",") : "");
    if (t == null) return;
    const n = Number(t.replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) onConfig(n);
  };

  return (
    <section className="md:hidden">
      <div
        role={onAbrirExtrato ? "button" : undefined}
        tabIndex={onAbrirExtrato ? 0 : undefined}
        aria-label={onAbrirExtrato ? "Ver extrato do valor disponível" : undefined}
        onClick={() => onAbrirExtrato?.("disponivel")}
        onKeyDown={(e) => { if (onAbrirExtrato && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrirExtrato("disponivel"); } }}
        className={`relative overflow-hidden rounded-3xl p-5 shadow-lg ${negativo ? "bg-rose-600 text-white" : "bg-accent text-on-accent"} ${onAbrirExtrato ? "cursor-pointer active:scale-[0.99]" : ""}`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 size-36 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between">
          <p className="text-xs font-medium opacity-80">{negativo ? "Acima do salário" : "Disponível após os gastos"}{onAbrirExtrato && <Ico icon={ChevronRight} size={14} className="ml-1 inline" />}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); alternar(); }}
            aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium active:scale-95"
          >
            <span className="inline-flex items-center gap-1.5"><Ico icon={oculto ? Eye : EyeOff} size={14} />{oculto ? "Mostrar" : "Ocultar"}</span>
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
          <p className="flex items-center gap-1 text-xs text-muted">Salário <Ico icon={Pencil} size={12} /></p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{v(salario)}</p>
        </button>
        <button type="button" onClick={() => onAbrirExtrato?.("gastos")} className="rounded-2xl bg-surface p-4 text-left ring-1 ring-line active:scale-[0.98]">
          <p className="text-xs text-muted">Gastos do mês{onAbrirExtrato && <Ico icon={ChevronRight} size={14} className="ml-1 inline" />}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{v(resumo.totalGasto)}</p>
        </button>
      </div>

      <div className="mt-3 divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
        {[
          { id: "extrato" as const, r: "Lançamentos do mês", n: resumo.porOrigem.extrato, s: ICONE_ABA.lancamentos },
          { id: "cartao" as const, r: "Parcelas", n: resumo.porOrigem.cartao, s: ICONE_ABA.cartao },
          { id: "contas" as const, r: "Contas fixas", n: resumo.porOrigem.contas, s: ICONE_ABA.contas },
        ].map((i) => (
          <button
            key={i.r}
            type="button"
            onClick={() => onAbrirResumo?.(i.id)}
            disabled={!onAbrirResumo}
            aria-label={`Abrir ${i.r}`}
            className="flex w-full items-center gap-3 px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl enabled:active:bg-background"
          >
            <span className="grid size-9 place-items-center rounded-full bg-accent/10 text-accent"><Ico icon={i.s} /></span>
            <span className="min-w-0 flex-1 truncate text-sm">{i.r}</span>
            <span className="text-sm font-semibold tabular-nums">{v(i.n)}</span>
            {onAbrirResumo && <Ico icon={ChevronRight} size={16} className="text-muted" />}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Barra de navegação inferior ---------- */
export function MobileBottomNav({
  aba,
  onAba,
  onGrupo,
  onPerfil,
}: {
  aba: Aba;
  onAba: (a: Aba) => void;
  onGrupo: () => void;
  onPerfil: () => void;
}) {
  const [novoAberto, setNovoAberto] = useState(false);
  const Item = ({ id, r, s, onClick, ativo: ativoForcado }: { id: string; r: string; s: LucideIcon; onClick?: () => void; ativo?: boolean }) => {
    const ativo = ativoForcado ?? aba === id;
    return (
      <button
        type="button"
        onClick={onClick ?? (() => onAba(id as Aba))}
        aria-current={ativo ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
          ativo ? "text-accent" : "text-muted"
        }`}
      >
        <span className={`grid h-7 w-12 place-items-center rounded-full ${ativo ? "bg-accent/15" : ""}`}><Ico icon={s} size={22} /></span>
        {r}
      </button>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 left-0 right-0 z-50 w-full border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-end px-2">
          <Item id="inicio" r="Início" s={ICONE_ABA.inicio} />
          <Item id="extrato" r="Extrato" s={ICONE_ABA.extrato} />
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setNovoAberto(true)}
              aria-label="Novo lançamento"
              className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-on-accent shadow-lg ring-4 ring-background active:scale-95"
            >
              <Ico icon={ICONES.novo} size={26} />
            </button>
          </div>
          <Item id="grupo" r="Grupo" s={ICONES.grupo} onClick={onGrupo} ativo={false} />
          <Item id="perfil" r="Perfil" s={ICONES.perfil} onClick={onPerfil} ativo={aba === "ajustes"} />
        </div>
      </nav>

      <Sheet aberto={novoAberto} onFechar={() => setNovoAberto(false)} titulo="Novo lançamento">
        {[
          { id: "lancamentos" as Aba, r: "Lançamento normal", d: "Gasto ou entrada do dia a dia", s: ICONE_ABA.lancamentos },
          { id: "cartao" as Aba, r: "Conta parcelada", d: "Compras divididas em parcelas", s: ICONE_ABA.cartao },
          { id: "contas" as Aba, r: "Conta fixa", d: "Aluguel, internet, assinaturas", s: ICONE_ABA.contas },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onAba(t.id);
              setNovoAberto(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left active:bg-background"
          >
            <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent"><Ico icon={t.s} /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{t.r}</span>
              <span className="block text-xs text-muted">{t.d}</span>
            </span>
            <Ico icon={ChevronRight} size={18} className="text-muted" />
          </button>
        ))}
      </Sheet>
    </>
  );
}

/* ---------- Menu lateral (gaveta fixa à direita) ---------- */
export function MobileMenu({
  aberto,
  onFechar,
  onGrupo,
  onAba,
}: {
  aberto: boolean;
  onFechar: () => void;
  onGrupo: () => void;
  onAba: (a: Aba) => void;
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
    await supabase.auth.signOut();
    router.push("/login");
  };
  const ir = (a: Aba) => { onFechar(); onAba(a); };
  const linha = "flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium active:bg-background";
  const icone = "grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent";

  return createPortal(
    <div className="fixed inset-0 z-[10020] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <aside className="absolute inset-y-0 right-0 flex w-[min(85vw,340px)] flex-col bg-surface shadow-2xl" style={{ paddingTop: "max(env(safe-area-inset-top),16px)", paddingBottom: "max(env(safe-area-inset-bottom),16px)", animation: "hc-drawer-in .22s ease-out" }}>
        <style>{`@keyframes hc-drawer-in{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <header className="flex items-center justify-between px-4 pb-3">
          <p className="text-lg font-semibold">Menu</p>
          <button type="button" onClick={onFechar} aria-label="Fechar menu" className="grid size-10 place-items-center rounded-full text-muted active:bg-background"><Ico icon={X} /></button>
        </header>
        <div className="flex-1 space-y-1 overflow-y-auto px-3">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Contas</p>
          <button type="button" className={linha} onClick={() => ir("cartao")}><span className={icone}><Ico icon={ICONE_ABA.cartao} /></span>Contas parceladas</button>
          <button type="button" className={linha} onClick={() => ir("fatura")}><span className={icone}><Ico icon={ICONE_ABA.fatura} /></span>Faturas do cartão</button>
          <button type="button" className={linha} onClick={() => ir("contas")}><span className={icone}><Ico icon={ICONE_ABA.contas} /></span>Contas fixas</button>
          <button type="button" className={linha} onClick={() => ir("lancamentos")}><span className={icone}><Ico icon={ICONE_ABA.lancamentos} /></span>Lançamentos do mês</button>

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Conta</p>
          <button type="button" className={linha} onClick={() => ir("ajustes")}><span className={icone}><Ico icon={ICONE_ABA.ajustes} /></span>Configurações e perfil</button>
          <button type="button" className={linha} onClick={() => { onFechar(); onGrupo(); }}><span className={icone}><Ico icon={ICONES.grupo} /></span>Gerenciar grupo</button>

          <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Tema</p>
          <div className="mx-1 grid grid-cols-3 gap-1 rounded-2xl bg-background p-1 ring-1 ring-line">
            {([["light", Sun, "Claro"], ["dark", Moon, "Escuro"], ["system", SunMoon, "Sistema"]] as const).map(([id, s, r]) => (
              <button key={id} type="button" aria-pressed={tema === id} onClick={() => mudarTema(id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium ${tema === id ? "bg-accent text-on-accent" : "text-ink"}`}>
                <Ico icon={s} size={18} />{r}
              </button>
            ))}
          </div>
          <button type="button" className={`${linha} mt-1 text-muted`} onClick={() => ir("ajustes")}><span className={icone}><Ico icon={Palette} /></span>Mais opções de aparência</button>
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
