"use client";

import { Check, Palette, X } from "lucide-react";
import { Ico } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
// IMPORTAÇÃO CORRIGIDA: usando a instância que você já exporta do seu arquivo
import { supabase } from "@/lib/supabase";

type Tema = "light" | "dark" | "system";
type Fundo = "none" | "aurora" | "glow" | "dots" | "grid";
type Destaque = "teal" | "purple" | "blue" | "pink" | "orange" | "graphite";

const DESTAQUES: { id: Destaque; nome: string; cor: string }[] = [
  { id: "teal", nome: "Verde-água", cor: "#0f766e" },
  { id: "purple", nome: "Roxo", cor: "#6d28d9" },
  { id: "blue", nome: "Azul", cor: "#1d4ed8" },
  { id: "pink", nome: "Rosa", cor: "#be185d" },
  { id: "orange", nome: "Laranja", cor: "#c2410c" },
  { id: "graphite", nome: "Grafite", cor: "#334155" },
];

const PALETA: Record<Destaque, { claro: string; escuro: string; textoClaro: string; textoEscuro: string }> = {
  teal: { claro: "#0f766e", escuro: "#2dd4bf", textoClaro: "#ffffff", textoEscuro: "#06201c" },
  purple: { claro: "#6d28d9", escuro: "#a78bfa", textoClaro: "#ffffff", textoEscuro: "#20113d" },
  blue: { claro: "#1d4ed8", escuro: "#60a5fa", textoClaro: "#ffffff", textoEscuro: "#102343" },
  pink: { claro: "#be185d", escuro: "#f472b6", textoClaro: "#ffffff", textoEscuro: "#3c1027" },
  orange: { claro: "#c2410c", escuro: "#fb923c", textoClaro: "#ffffff", textoEscuro: "#3b1c07" },
  graphite: { claro: "#334155", escuro: "#cbd5e1", textoClaro: "#ffffff", textoEscuro: "#1e293b" },
};

function aplicarTema(tema: Tema, destaque: Destaque) {
  const raiz = document.documentElement;
  const escuro = tema === "dark" || (tema === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  raiz.dataset.theme = tema;
  raiz.dataset.accent = destaque;
  raiz.classList.toggle("dark", escuro);
  raiz.style.setProperty("--accent", escuro ? PALETA[destaque].escuro : PALETA[destaque].claro);
  raiz.style.setProperty("--on-accent", escuro ? PALETA[destaque].textoEscuro : PALETA[destaque].textoClaro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#101722" : "#f5f7fa");
}

const FUNDOS: { id: Fundo; nome: string }[] = [
  { id: "none", nome: "Liso" },
  { id: "aurora", nome: "Aurora" },
  { id: "glow", nome: "Brilho" },
  { id: "dots", nome: "Pontos" },
  { id: "grid", nome: "Grade" },
];

const AMOSTRAS: Record<Fundo, React.CSSProperties> = {
  none: {},
  aurora: { backgroundImage: "radial-gradient(70% 70% at 10% 0%, color-mix(in oklab, var(--accent) 45%, transparent), transparent 70%), radial-gradient(60% 60% at 100% 100%, rgb(56 189 248 / .35), transparent 70%)" },
  glow: { backgroundImage: "radial-gradient(90% 80% at 50% -20%, color-mix(in oklab, var(--accent) 45%, transparent), transparent 70%)" },
  dots: { backgroundImage: "radial-gradient(color-mix(in oklab, var(--accent) 60%, transparent) 1px, transparent 1.4px)", backgroundSize: "8px 8px" },
  grid: { backgroundImage: "linear-gradient(color-mix(in oklab, var(--accent) 35%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--accent) 35%, transparent) 1px, transparent 1px)", backgroundSize: "10px 10px" },
};

function aplicarFundo(fundo: Fundo) {
  document.documentElement.dataset.bg = fundo;
  localStorage.removeItem("homecash-bg-img");
}

export function useAparencia() {
  const [fundo, setFundo] = useState<Fundo>("none");
  const [tema, setTema] = useState<Tema>("system");
  const [destaque, setDestaque] = useState<Destaque>("teal");

  useEffect(() => {
    // 1. Carrega primeiro o que está rápido no LocalStorage (evita ecrã a piscar)
    const temaSalvo = (localStorage.getItem("homecash-theme") || localStorage.getItem("tema")) as Tema | null;
    const destaqueSalvo = localStorage.getItem("homecash-accent") as Destaque | null;
    const temaInicial = temaSalvo && ["light", "dark", "system"].includes(temaSalvo) ? temaSalvo : "system";
    const destaqueInicial = destaqueSalvo && DESTAQUES.some((item) => item.id === destaqueSalvo) ? destaqueSalvo : "teal";
    setTema(temaInicial);
    setDestaque(destaqueInicial);
    aplicarTema(temaInicial, destaqueInicial);

    const fundoSalvo = localStorage.getItem("homecash-bg") as Fundo | null;
    const fundoInicial = fundoSalvo && FUNDOS.some((f) => f.id === fundoSalvo) ? fundoSalvo : "none";
    setFundo(fundoInicial);
    aplicarFundo(fundoInicial);

    // 2. Sincroniza com os dados do Supabase usando a sua instância direta
    const syncSupabase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { theme_color, theme_accent, theme_bg } = user.user_metadata ?? {};
          let atualizado = false;
          // Cor de destaque: a escolhida PELO PRÓPRIO usuário; sem escolha, o padrão é verde-água
          // (nunca herda a cor que outra pessoa deixou neste aparelho).
          const destaqueFinal = (theme_accent as Destaque) || "teal";

          if (theme_color && theme_color !== temaInicial) {
            setTema(theme_color);
            localStorage.setItem("homecash-theme", theme_color);
            atualizado = true;
          }
          if (destaqueFinal !== destaqueInicial) {
            setDestaque(destaqueFinal);
            localStorage.setItem("homecash-accent", destaqueFinal);
            atualizado = true;
          }
          if (theme_bg && theme_bg !== fundoInicial) {
            setFundo(theme_bg);
            localStorage.setItem("homecash-bg", theme_bg);
            atualizado = true;
          }

          if (atualizado) {
            aplicarTema(theme_color || temaInicial, destaqueFinal);
            aplicarFundo(theme_bg || fundoInicial);
            avisar();
          }
        }
      } catch (error) {
        console.error("Erro ao sincronizar aparência com Supabase:", error);
      }
    };

    syncSupabase();

    const sync = () => {
      const t = (localStorage.getItem("homecash-theme") as Tema) || "system";
      const d = (localStorage.getItem("homecash-accent") as Destaque) || "teal";
      const f = (localStorage.getItem("homecash-bg") as Fundo) || "none";
      setTema(t); setDestaque(d); setFundo(f);
    };
    window.addEventListener("homecash-aparencia", sync);
    return () => window.removeEventListener("homecash-aparencia", sync);
  }, []);

  useEffect(() => {
    if (tema !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const atualizarSistema = () => aplicarTema("system", destaque);
    media.addEventListener("change", atualizarSistema);
    return () => media.removeEventListener("change", atualizarSistema);
  }, [tema, destaque]);

  const avisar = () => window.dispatchEvent(new Event("homecash-aparencia"));

  // Função para atualizar preferências silenciosamente na nuvem
  const salvarNoSupabase = async (dados: Record<string, string>) => {
    try {
      await supabase.auth.updateUser({ data: dados });
    } catch (error) {
      console.error("Erro ao salvar aparência no Supabase:", error);
    }
  };

  const mudarTema = (novo: Tema) => {
    setTema(novo);
    localStorage.setItem("homecash-theme", novo);
    aplicarTema(novo, destaque);
    avisar();
    salvarNoSupabase({ theme_color: novo });
  };

  const mudarDestaque = (novo: Destaque) => {
    setDestaque(novo);
    localStorage.setItem("homecash-accent", novo);
    aplicarTema(tema, novo);
    avisar();
    salvarNoSupabase({ theme_accent: novo });
  };

  const mudarFundo = (novo: Fundo) => {
    setFundo(novo);
    localStorage.setItem("homecash-bg", novo);
    aplicarFundo(novo);
    avisar();
    salvarNoSupabase({ theme_bg: novo });
  };

  return { tema, destaque, fundo, mudarTema, mudarDestaque, mudarFundo };
}

const NOMES_TEMA: Record<Tema, string> = { light: "Claro", dark: "Escuro", system: "Sistema" };

function MiniaturaTema({ t }: { t: Tema }) {
  const claro = { bg: "#f8fafc", card: "#ffffff", line: "#e7ebf0" };
  const escuro = { bg: "#101722", card: "#182230", line: "#29384a" };
  const lado = (c: typeof claro) => (
    <span className="flex h-full flex-1 flex-col gap-1 p-1.5" style={{ background: c.bg }}>
      <span className="h-1.5 w-2/3 rounded-full" style={{ background: "var(--accent)" }} />
      <span className="flex-1 rounded" style={{ background: c.card, border: `1px solid ${c.line}` }} />
    </span>
  );
  return (
    <span aria-hidden="true" className="flex h-14 w-full overflow-hidden rounded-lg border border-line">
      {t === "light" && lado(claro)}
      {t === "dark" && lado(escuro)}
      {t === "system" && (<>{lado(claro)}{lado(escuro)}</>)}
    </span>
  );
}

export function PainelAparencia({ compacto = false }: { compacto?: boolean }) {
  const { tema, destaque, fundo, mudarTema, mudarDestaque, mudarFundo } = useAparencia();
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-muted">Tema</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["light", "dark", "system"] as Tema[]).map((opcao) => (
            <button key={opcao} type="button" onClick={() => mudarTema(opcao)} aria-pressed={tema === opcao}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-sm font-medium transition ${tema === opcao ? "border-accent bg-accent/10 text-accent ring-1 ring-accent" : "border-line text-ink hover:bg-background"}`}>
              <MiniaturaTema t={opcao} />
              {NOMES_TEMA[opcao]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-muted">Cor de destaque</legend>
        <div className="grid grid-cols-6 gap-2">
          {DESTAQUES.map((opcao) => (
            <button key={opcao.id} type="button" onClick={() => mudarDestaque(opcao.id)} aria-pressed={destaque === opcao.id} aria-label={opcao.nome} title={opcao.nome} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] text-muted transition">
              <span className={`grid size-9 place-items-center rounded-full text-sm font-bold text-white transition ${destaque === opcao.id ? "ring-2 ring-offset-2 ring-offset-surface scale-105" : "hover:scale-105"}`} style={{ backgroundColor: opcao.cor, ["--tw-ring-color" as string]: opcao.cor } as React.CSSProperties}>
                {destaque === opcao.id ? <Ico icon={Check} size={16} /> : null}
              </span>
              {!compacto && <span className={`w-full truncate text-center ${destaque === opcao.id ? "font-semibold text-ink" : ""}`}>{opcao.nome}</span>}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-muted">Fundo</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {FUNDOS.map((opcao) => (
            <button key={opcao.id} type="button" onClick={() => mudarFundo(opcao.id)} aria-pressed={fundo === opcao.id} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition ${fundo === opcao.id ? "border-accent bg-accent/10 text-accent" : "border-line text-ink hover:bg-background"}`}>
              <span aria-hidden="true" className="h-10 w-full rounded-lg border border-line bg-background" style={AMOSTRAS[opcao.id]} />
              {opcao.nome}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

const Z_FUNDO = 10040;
const Z_PAINEL = 10041;

export default function ThemeToggle({ rotulo = false }: { rotulo?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number; maxH: number; mobile: boolean } | null>(null);
  useAparencia();

  useEffect(() => {
    if (!aberto) return;
    const atualizar = () => {
      const r = botaoRef.current?.getBoundingClientRect();
      const mobile = window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;
      if (!r) return;
      const right = Math.max(8, window.innerWidth - r.right);
      const abaixo = window.innerHeight - r.bottom - 16;
      const acima = r.top - 16;
      if (mobile || abaixo >= 420 || abaixo >= acima) setPos({ top: r.bottom + 8, right, maxH: abaixo, mobile });
      else setPos({ bottom: window.innerHeight - r.top + 8, right, maxH: acima, mobile });
    };
    atualizar();
    const overflowAnterior = document.body.style.overflow;
    if (window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches) document.body.style.overflow = "hidden";
    const fecharEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setAberto(false); } };
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    document.addEventListener("keydown", fecharEsc, true);
    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
      document.removeEventListener("keydown", fecharEsc, true);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  return (
    <div className="relative pointer-events-auto" onPointerDown={(event) => event.stopPropagation()}>
      <button
        ref={botaoRef}
        type="button"
        onClick={(event) => { event.stopPropagation(); setAberto((valor) => !valor); }}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-accent/50 hover:bg-background"
      >
        <Ico icon={Palette} />
        <span className={rotulo ? "inline" : "hidden sm:inline"}>Aparência</span>
      </button>

      {aberto && pos && createPortal(<>
        <div aria-hidden="true" onMouseDown={(e) => { e.stopPropagation(); setAberto(false); }} style={{ position: "fixed", inset: 0, zIndex: Z_FUNDO, background: pos.mobile ? "rgb(0 0 0 / .5)" : "transparent" }} />
        <div
          role="dialog"
          aria-label="Personalizar aparência"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          style={pos.mobile
            ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: Z_PAINEL, maxHeight: "90dvh", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", animation: "hc-sheet-up .22s ease-out" }
            : { position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right, zIndex: Z_PAINEL, maxHeight: Math.max(240, pos.maxH) }}
          className={`overflow-y-auto overscroll-contain border border-line bg-surface p-4 shadow-2xl ${pos.mobile ? "mx-auto w-full max-w-lg rounded-t-3xl px-5 pt-3" : "w-96 rounded-2xl"}`}>
          <style>{`@keyframes hc-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          {pos.mobile && <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Aparência</h2>
              <p className="mt-0.5 text-xs text-muted">A mudança aparece na hora.</p>
            </div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar aparência" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-background"><Ico icon={X} /></button>
          </div>
          <PainelAparencia compacto />
        </div>
      </>, document.body)}
    </div>
  );
}