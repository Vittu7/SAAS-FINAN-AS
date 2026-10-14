"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface SidebarProps {
  onAbrirGrupo: () => void;
  membroSelecionado?: string;
  setMembroSelecionado?: (membro: string) => void;
  listaMembros?: string[];
}

export default function Sidebar({
  onAbrirGrupo,
  membroSelecionado = "TODOS",
  setMembroSelecionado,
  listaMembros = [],
}: SidebarProps) {
  const [expandido, setExpandido] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const menuItens = [
    { id: "geral", rotulo: "Visão Geral", icone: "📊", href: "/" },
    { id: "extrato", rotulo: "Extrato", icone: "📄", href: "/#extrato" },
    { id: "cartao", rotulo: "Cartão Parcelado", icone: "💳", href: "/#cartao" },
    { id: "contas", rotulo: "Contas Fixas", icone: "📌", href: "/#contas" },
    { id: "graficos", rotulo: "Gráficos", icone: "📈", href: "/#graficos" },
    { id: "investimentos", rotulo: "Investimentos", icone: "💰", href: "/#investimentos" },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen border-r border-line bg-surface transition-all duration-300 flex flex-col justify-between ${
        expandido ? "w-64" : "w-20"
      }`}
    >
      {/* Topo: Logo & Botão para Recolher */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-line">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent text-xl font-bold shadow-md">
              💎
            </div>
            {expandido && (
              <span className="font-bold text-lg whitespace-nowrap text-ink">
                Home<span className="text-accent">Cash</span>
              </span>
            )}
          </div>
          <button
            onClick={() => setExpandido(!expandido)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:bg-background transition"
            title={expandido ? "Recolher menu" : "Expandir menu"}
          >
            {expandido ? "‹" : "›"}
          </button>
        </div>

        {/* Filtro por Pessoa (Visão Individual vs Grupo) */}
        {expandido && setMembroSelecionado && (
          <div className="p-4 border-b border-line bg-background/50">
            <label className="block text-xs font-medium text-muted mb-1">
              👁️ Filtrar Visão Por:
            </label>
            <select
              value={membroSelecionado}
              onChange={(e) => setMembroSelecionado(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-accent outline-none text-ink"
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

        {/* Links de Navegação */}
        <nav className="p-3 space-y-1">
          {menuItens.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-muted hover:bg-background hover:text-ink"
              }`}
              title={!expandido ? item.rotulo : undefined}
            >
              <span className="text-lg">{item.icone}</span>
              {expandido && <span className="whitespace-nowrap">{item.rotulo}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Rodapé: Grupo, Perfil e Sair */}
      <div className="p-3 border-t border-line space-y-1 bg-surface">
        <button
          onClick={onAbrirGrupo}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-background hover:text-ink transition"
          title={!expandido ? "Gerenciar Grupo" : undefined}
        >
          <span className="text-lg">👥</span>
          {expandido && <span>Gerenciar Grupo</span>}
        </button>

        <button
          onClick={() => router.push("/perfil")}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-background hover:text-ink transition"
          title={!expandido ? "Meu Perfil" : undefined}
        >
          <span className="text-lg">⚙️</span>
          {expandido && <span>Meu Perfil</span>}
        </button>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
          title={!expandido ? "Sair da Conta" : undefined}
        >
          <span className="text-lg">🚪</span>
          {expandido && <span>Sair da conta</span>}
        </button>
      </div>
    </aside>
  );
}