"use client";

import { useEffect, useState } from "react";

type Tema = "light" | "dark" | "system";
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

export default function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("system");
  const [destaque, setDestaque] = useState<Destaque>("teal");
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const temaSalvo = (localStorage.getItem("homecash-theme") || localStorage.getItem("tema")) as Tema | null;
    const destaqueSalvo = localStorage.getItem("homecash-accent") as Destaque | null;
    const temaInicial = temaSalvo && ["light", "dark", "system"].includes(temaSalvo) ? temaSalvo : "system";
    const destaqueInicial = destaqueSalvo && DESTAQUES.some((item) => item.id === destaqueSalvo) ? destaqueSalvo : "teal";
    setTema(temaInicial);
    setDestaque(destaqueInicial);
    aplicarTema(temaInicial, destaqueInicial);

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-accent/50 hover:bg-background"
      >
        <span aria-hidden="true">◐</span>
        <span className="hidden sm:inline">Aparência</span>
      </button>

      {aberto && (
        <div role="dialog" aria-label="Personalizar aparência" className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Aparência</h2>
              <p className="mt-0.5 text-xs text-muted">Personalize o visual do HomeCash.</p>
            </div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar aparência" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-background">×</button>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted">Tema</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as Tema[]).map((opcao) => {
                const nomes = { light: "Claro", dark: "Escuro", system: "Sistema" };
                return (
                  <button key={opcao} type="button" onClick={() => mudarTema(opcao)} aria-pressed={tema === opcao} className={`rounded-lg border px-2 py-2 text-xs transition ${tema === opcao ? "border-accent bg-accent/10 text-accent" : "border-line text-ink hover:bg-background"}`}>
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
                <button key={opcao.id} type="button" onClick={() => mudarDestaque(opcao.id)} aria-pressed={destaque === opcao.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs text-ink transition ${destaque === opcao.id ? "border-accent bg-background" : "border-line hover:bg-background"}`}>
                  <span className="size-3 rounded-full" style={{ backgroundColor: opcao.cor }} />
                  {opcao.nome}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 rounded-xl border border-line bg-background p-3">
            <p className="text-[11px] font-medium text-muted">Prévia da cor</p>
            <button type="button" className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent">Botão principal</button>
          </div>
        </div>
      )}
    </div>
  );
}
