"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { decidirTela, obterNivel } from "@/lib/adminMfa";
import { ehErroDeMfa, registrarAcessoPainel, registrarTentativaAdmin, souAdmin, type CodigoErroAdmin } from "@/lib/admin";
import AdminMenu from "./AdminMenu";
import EstadoTela from "./EstadoTela";
import TelaSeguranca from "./TelaSeguranca";

type Fase =
  | { tipo: "carregando" }
  | { tipo: "nao_encontrada" }
  | { tipo: "seguranca"; erroBanco?: CodigoErroAdmin }
  | { tipo: "liberado" };

/** Reaplica o tema salvo (o script inline do layout raiz pode ser barrado pela CSP do painel). Só lê o armazenamento. */
function reaplicarTema() {
  try {
    const salvo = localStorage.getItem("homecash-theme") || localStorage.getItem("tema") || "system";
    const escuro = salvo === "dark" || (salvo === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", escuro);
  } catch {
    /* sem armazenamento: fica o tema padrão */
  }
}

/**
 * Guarda de tela do painel. É só experiência: a proteção real é o banco (checar_admin).
 * Fluxo: sem sessão → /login; não admin → registra a tentativa e mostra "não encontrada";
 * admin → decide a tela pelo nível de MFA; só em aal2 e com o banco liberando monta o painel.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const [fase, setFase] = useState<Fase>({ tipo: "carregando" });
  // Nova avaliação (depois de cadastrar ou verificar o MFA): basta incrementar.
  const [versao, setVersao] = useState(0);
  const rotaRef = useRef(pathname);

  useEffect(() => {
    rotaRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    reaplicarTema();
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (!(await souAdmin())) {
        await registrarTentativaAdmin(rotaRef.current);
        if (vivo) setFase({ tipo: "nao_encontrada" });
        return;
      }
      const nivel = await obterNivel();
      const tela = nivel ? decidirTela(nivel.atual, nivel.proximo) : "bloqueado";
      if (!vivo) return;
      if (tela !== "liberado") {
        setFase({ tipo: "seguranca" });
        return;
      }
      // O banco decide de verdade: se recusar (fator não aprovado, MFA expirada…), volta para a tela de segurança.
      const acesso = await registrarAcessoPainel();
      if (!vivo) return;
      if (!acesso.ok) {
        if (acesso.erro === "sessao_invalida") {
          router.replace("/login");
          return;
        }
        setFase(ehErroDeMfa(acesso.erro) ? { tipo: "seguranca", erroBanco: acesso.erro } : { tipo: "nao_encontrada" });
        return;
      }
      setFase({ tipo: "liberado" });
    })();
    return () => {
      vivo = false;
    };
  }, [router, versao]);

  const sair = useCallback(async () => {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    router.replace("/login");
  }, [router]);

  if (fase.tipo === "carregando") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm"><EstadoTela estado="carregando" /></div>
      </main>
    );
  }

  if (fase.tipo === "nao_encontrada") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-background p-4 text-center">
        <h1 className="text-2xl font-bold text-ink">404</h1>
        <p className="text-sm text-muted">Esta página não pôde ser encontrada.</p>
      </main>
    );
  }

  if (fase.tipo === "seguranca") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <TelaSeguranca onMudou={() => setVersao((v) => v + 1)} erroBanco={fase.erroBanco} onSair={() => void sair()} />
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-ink md:flex">
      <AdminMenu onSair={() => void sair()} />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>
    </div>
  );
}
