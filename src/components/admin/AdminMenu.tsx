"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, LogOut, ScrollText, ShieldCheck } from "lucide-react";

/** Rotas fechadas do painel (links só para destinos conhecidos). */
export const ROTAS_ADMIN = {
  dashboard: "/admin",
  auditoria: "/admin/auditoria",
  seguranca: "/admin/seguranca",
} as const;

type Rota = keyof typeof ROTAS_ADMIN;

const ITENS: { rota: Rota; rotulo: string; Icone: typeof LayoutDashboard }[] = [
  { rota: "dashboard", rotulo: "Visão geral", Icone: LayoutDashboard },
  { rota: "auditoria", rotulo: "Auditoria", Icone: ScrollText },
  { rota: "seguranca", rotulo: "Segurança", Icone: ShieldCheck },
];

function ativo(pathname: string, rota: Rota): boolean {
  const alvo = ROTAS_ADMIN[rota];
  return rota === "dashboard" ? pathname === alvo : pathname === alvo || pathname.startsWith(`${alvo}/`);
}

interface Props {
  onSair: () => void;
}

export default function AdminMenu({ onSair }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <>
      {/* Desktop: menu lateral */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="text-base font-bold text-ink">HomeCash</span>
          <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-accent">Admin</span>
        </div>
        <nav aria-label="Painel" className="flex flex-col gap-1">
          {ITENS.map(({ rota, rotulo, Icone }) => (
            <Link
              key={rota}
              href={ROTAS_ADMIN[rota]}
              aria-current={ativo(pathname, rota) ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-accent ${
                ativo(pathname, rota) ? "bg-accent text-on-accent" : "text-ink hover:bg-background"
              }`}
            >
              <Icone className="h-4 w-4" aria-hidden /> {rotulo}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link href="/" className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-background focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao app
          </Link>
          <button type="button" onClick={onSair} className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-background focus-visible:ring-2 focus-visible:ring-accent">
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>
      </aside>

      {/* Celular: barra inferior */}
      <nav aria-label="Painel" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITENS.map(({ rota, rotulo, Icone }) => (
          <Link
            key={rota}
            href={ROTAS_ADMIN[rota]}
            aria-current={ativo(pathname, rota) ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-accent ${
              ativo(pathname, rota) ? "text-accent" : "text-muted"
            }`}
          >
            <Icone className="h-5 w-5" aria-hidden /> {rotulo}
          </Link>
        ))}
        <button type="button" onClick={onSair} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted focus-visible:ring-2 focus-visible:ring-accent">
          <LogOut className="h-5 w-5" aria-hidden /> Sair
        </button>
      </nav>
    </>
  );
}
