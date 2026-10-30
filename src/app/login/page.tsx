
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Ico } from "@/components/icons";

function LoginConteudo() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    const verificarSessao = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!ativo) return;

      if (!error && data.session) {
        router.replace("/");
      }
    };

    verificarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;

      if (sessao && evento === "SIGNED_IN") {
        router.replace("/");
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const entrarComGoogle = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível iniciar o login com Google."
      );
      setCarregando(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-background text-ink lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent),black_40%)] p-12 text-on-accent lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-black/10" />

        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-12 w-auto" />
          <span className="text-2xl font-bold">HomeCash</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-bold leading-tight">
            O dinheiro da casa, organizado em um só lugar.
          </h2>

          <ul className="space-y-4 text-base">
            {[
              [WalletCards, "Entradas, saídas e saldo restante sempre claros"],
              [Users, "Controle em família, com quem pagou cada despesa"],
              [ShieldCheck, "Seus dados protegidos na nuvem"],
            ].map(([Icone, texto]: any) => (
              <li key={texto} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15">
                  <Ico icon={Icone} size={20} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm opacity-80">
          © HomeCash · Finanças da família
        </p>
      </aside>

      <section className="flex items-center justify-center px-5 py-8 sm:px-8">
        <div className="anim-page w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <img
              src="/logo.png"
              alt="HomeCash"
              className="h-20 w-auto lg:hidden"
            />

            <p className="text-3xl font-bold tracking-tight lg:hidden">
              Home<span className="text-accent">Cash</span>
            </p>

            <h1 className="text-2xl font-bold">
              Bem-vindo ao HomeCash
            </h1>

            <p className="text-sm text-muted">
              Entre com sua conta Google para acompanhar as finanças da sua casa.
            </p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={entrarComGoogle}
              disabled={carregando}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface text-sm font-semibold transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.2v3.15C3.17 21.32 7.22 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.5-.38-2.27s.13-1.55.38-2.27V6.58H1.2C.43 8.13 0 9.99 0 12s.43 3.87 1.2 5.42l4.08-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.17 2.68 1.2 6.58l4.08 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>

              {carregando ? "Conectando ao Google..." : "Continuar com Google"}
            </button>

            {erro && (
              <p
                role="alert"
                className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-400"
              >
                {erro}
              </p>
            )}
          </div>

          <p className="text-center text-xs leading-relaxed text-muted">
            Ao continuar, você concorda com os{" "}
            <a
              href="/termos"
              className="font-medium text-accent hover:underline"
            >
              Termos de Serviço
            </a>{" "}
            e com a{" "}
            <a
              href="/privacidade"
              className="font-medium text-accent hover:underline"
            >
              Política de Privacidade
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginConteudo />
    </Suspense>
  );
}
