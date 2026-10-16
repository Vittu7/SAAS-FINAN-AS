"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface SidebarProps {
  onAbrirGrupo: () => void;
  membroSelecionado?: string;
  setMembroSelecionado?: (membro: string) => void;
  listaMembros?: string[];
  // Navegação entre as abas do painel (Extrato, Contas Parceladas, Contas Fixas)
  abaAtiva?: string;
  onSelecionarAba?: (id: string) => void;
  // Avisa a página quando o menu expande/recolhe, para ela ajustar a margem do conteúdo
  onAlterarExpandido?: (expandido: boolean) => void;
}

interface ItemMenu {
  id: string;
  rotulo: string;
  icone: string;
  href: string;
  aba?: boolean;
}

const ITEM_INICIO: ItemMenu = { id: "geral", rotulo: "Visão Geral", icone: "📊", href: "/" };

const SECOES: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: "Lançamentos",
    itens: [
      { id: "extrato", rotulo: "Extrato", icone: "📄", href: "/", aba: true },
      { id: "cartao", rotulo: "Contas Parceladas", icone: "💳", href: "/", aba: true },
      { id: "contas", rotulo: "Contas Fixas", icone: "📌", href: "/", aba: true },
    ],
  },
  {
    titulo: "Análises",
    itens: [
      { id: "graficos", rotulo: "Gráficos", icone: "📈", href: "/#graficos" },
      { id: "investimentos", rotulo: "Investimentos", icone: "💰", href: "/#investimentos" },
    ],
  },
];

export default function Sidebar({
  onAbrirGrupo,
  membroSelecionado = "TODOS",
  setMembroSelecionado,
  listaMembros = [],
  abaAtiva,
  onSelecionarAba,
  onAlterarExpandido,
}: SidebarProps) {
  const [expandido, setExpandido] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const alterarExpandido = (valor: boolean) => {
    setExpandido(valor);
    onAlterarExpandido?.(valor);
  };

  // Em telas pequenas o menu começa recolhido para não cobrir o conteúdo
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      alterarExpandido(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const abrirItem = (item: ItemMenu) => {
    if (item.aba && onSelecionarAba) {
      onSelecionarAba(item.id);
      if (pathname !== "/") router.push("/");
      return;
    }
    router.push(item.href);
  };

  const itemAtivo = (item: ItemMenu) => {
    if (item.aba) return abaAtiva === item.id && pathname === "/";
    if (item.id === "geral") return pathname === "/" && !abaAtiva;
    return false;
  };

  const classeItem = (ativo: boolean) =>
    `flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition ${expandido ? "gap-3 px-3" : "justify-center px-0"
    } ${ativo ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:bg-background hover:text-ink"}`;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col justify-between border-r border-line bg-surface transition-all duration-300 ${expandido ? "w-64" : "w-20"
        }`}
    >
      <div className="min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Topo: expandido mostra logo + botão de recolher; recolhido mostra só a seta para abrir */}
        <div
          className={`flex h-16 items-center border-b border-line ${expandido ? "justify-between px-4" : "justify-center px-2"
            }`}
        >
          {expandido ? (
            <>
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="HomeCash Logo" className="h-12 w-auto shrink-0 object-contain" />
                <span className="whitespace-nowrap text-lg font-bold">
                  <span className="text-ink">Home</span>
                  <span className="text-accent">Cash</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => alterarExpandido(false)}
                title="Recolher menu"
                aria-label="Recolher menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-background hover:text-ink"
              >
                ‹
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => alterarExpandido(true)}
              title="Expandir menu"
              aria-label="Expandir menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-lg text-muted transition hover:bg-background hover:text-ink"
            >
              ›
            </button>
          )}
        </div>

        {/* Filtro por pessoa (visão individual ou do grupo) */}
        {expandido && setMembroSelecionado && (
          <div className="border-b border-line bg-background/50 p-4">
            <label className="mb-1 block text-xs font-medium text-muted">👁️ Filtrar visão por:</label>
            <select
              value={membroSelecionado}
              onChange={(e) => setMembroSelecionado(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="TODOS">👥 Todo o Grupo</option>
              <option value="EU">👤 Somente Eu (Minhas Contas)</option>
              {listaMembros.map((m) => (
                <option key={m} value={m}>
                  👤 {m}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navegação */}
        <nav className="space-y-4 p-3">
          <button
            type="button"
            onClick={() => abrirItem(ITEM_INICIO)}
            className={classeItem(itemAtivo(ITEM_INICIO))}
            title={!expandido ? ITEM_INICIO.rotulo : undefined}
          >
            <span className="text-lg">{ITEM_INICIO.icone}</span>
            {expandido && <span className="whitespace-nowrap">{ITEM_INICIO.rotulo}</span>}
          </button>

          {SECOES.map((secao) => (
            <div key={secao.titulo} className="space-y-1">
              {expandido ? (
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{secao.titulo}</p>
              ) : (
                <div className="mx-2 border-t border-line" />
              )}
              {secao.itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrirItem(item)}
                  aria-current={itemAtivo(item) ? "page" : undefined}
                  className={classeItem(itemAtivo(item))}
                  title={!expandido ? item.rotulo : undefined}
                >
                  <span className="text-lg">{item.icone}</span>
                  {expandido && <span className="whitespace-nowrap">{item.rotulo}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Rodapé: grupo, perfil e sair */}
      <div className="space-y-1 border-t border-line bg-surface p-3">
        <button
          type="button"
          onClick={onAbrirGrupo}
          className={classeItem(false)}
          title={!expandido ? "Gerenciar Grupo" : undefined}
        >
          <span className="text-lg">👥</span>
          {expandido && <span>Gerenciar Grupo</span>}
        </button>

        <button
          type="button"
          onClick={() => router.push("/perfil")}
          className={classeItem(pathname === "/perfil")}
          title={!expandido ? "Meu Perfil" : undefined}
        >
          <span className="text-lg">⚙️</span>
          {expandido && <span>Meu Perfil</span>}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 ${expandido ? "gap-3 px-3" : "justify-center px-0"
            }`}
          title={!expandido ? "Sair da Conta" : undefined}
        >
          <span className="text-lg">🚪</span>
          {expandido && <span>Sair da conta</span>}
        </button>
      </div>
    </aside>
  );
}