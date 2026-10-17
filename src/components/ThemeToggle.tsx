"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";

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

export default function ThemeToggle() {
  const [fundo, setFundo] = useState<Fundo>("none");
  const [tema, setTema] = useState<Tema>("system");
  const [destaque, setDestaque] = useState<Destaque>("teal");
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; mobile: boolean } | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const atualizar = () => {
      const r = botaoRef.current?.getBoundingClientRect();
      const mobile = window.innerWidth < 640;
      if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right), mobile });
    };
    atualizar();
    const fecharEsc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    window.addEventListener("keydown", fecharEsc);
    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
      window.removeEventListener("keydown", fecharEsc);
    };
  }, [aberto]);

  useEffect(() => {
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

  }, []);

  useEffect(() => {
    if (tema !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const atualizarSistema = () => aplicarTema("system", destaque);
    media.addEventListener("change", atualizarSistema);
    return () => media.removeEventListener("change", atualizarSistema);
  }, [tema, destaque]);

  const mudarTema = (novo: Tema) => {
    setTema(novo);
    localStorage.setItem("homecash-theme", novo);
    aplicarTema(novo, destaque);
  };

  const mudarDestaque = (novo: Destaque) => {
    setDestaque(novo);
    localStorage.setItem("homecash-accent", novo);
    aplicarTema(tema, novo);
  };

  const mudarFundo = (novo: Fundo) => {
    setFundo(novo);
    localStorage.setItem("homecash-bg", novo);
    aplicarFundo(novo);
  };

  return (
    <div
      className="relative z-[100] pointer-events-auto"
      onPointerDown={(event) => event.stopPropagation()}
    >      <button
      ref={botaoRef}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setAberto((valor) => !valor);
      }} aria-expanded={aberto}
      aria-haspopup="dialog"
      className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-accent/50 hover:bg-background"
    >
        <span aria-hidden="true">◐</span>
        <span className="hidden sm:inline">Aparência</span>
      </button>

      {aberto && pos && createPortal(<>
        <div aria-hidden="true" onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: pos.mobile ? "rgb(0 0 0 / .5)" : "transparent" }} />
        <div
          role="dialog"
          aria-label="Personalizar aparência"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          style={pos.mobile
            ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999, maxHeight: "85dvh", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }
            : { position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, maxHeight: `calc(100dvh - ${pos.top + 16}px)` }}
          className={`overflow-y-auto overscroll-contain border border-line bg-surface p-4 shadow-2xl ${pos.mobile ? "w-full rounded-t-3xl px-5 pt-3" : "w-80 rounded-2xl"}`}>
          {pos.mobile && <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Aparência</h2>
              <p className="mt-0.5 text-xs text-muted">Personalize o visual do HomeCash.</p>
            </div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar aparência" className="grid size-10 text-lg place-items-center rounded-lg text-muted hover:bg-background">×</button>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted">Tema</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as Tema[]).map((opcao) => {
                const nomes = { light: "Claro", dark: "Escuro", system: "Sistema" };
                return (
                  <button key={opcao} type="button" onClick={() => mudarTema(opcao)} aria-pressed={tema === opcao} className={`rounded-xl border px-2 py-3 text-sm transition ${tema === opcao ? "border-accent bg-accent/10 text-accent" : "border-line text-ink hover:bg-background"}`}>
                    {nomes[opcao]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-semibold text-muted">Cor de destaque</legend>
            <div className="grid grid-cols-2 gap-2">
              {DESTAQUES.map((opcao) => (
                <button key={opcao.id} type="button" onClick={() => mudarDestaque(opcao.id)} aria-pressed={destaque === opcao.id} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm text-ink transition ${destaque === opcao.id ? "border-accent bg-background" : "border-line hover:bg-background"}`}>
                  <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: opcao.cor }} />
                  {opcao.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-semibold text-muted">Fundo</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {FUNDOS.map((opcao) => (
                <button key={opcao.id} type="button" onClick={() => mudarFundo(opcao.id)} aria-pressed={fundo === opcao.id} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition ${fundo === opcao.id ? "border-accent bg-accent/10 text-accent" : "border-line text-ink hover:bg-background"}`}>
                  <span aria-hidden="true" className="h-10 w-full rounded-lg border border-line bg-background" style={AMOSTRAS[opcao.id]} />
                  {opcao.nome}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Aplicado de forma suave para não atrapalhar a leitura.</p>
          </fieldset>

          <div className="mt-4 rounded-xl border border-line bg-background p-3">
            <p className="text-[11px] font-medium text-muted">Prévia da cor</p>
            <button type="button" className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent">Botão principal</button>
          </div>
        </div>
      </>, document.body)}
    </div>
  );
}