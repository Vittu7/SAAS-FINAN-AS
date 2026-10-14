"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Authgate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-ink">
        <p className="text-sm font-medium animate-pulse">A carregar sistema...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-4 text-ink">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4 text-center">
          <h1 className="text-xl font-bold">Finanças da Família</h1>
          <p className="text-xs text-muted">Inicia sessão para aceder ao painel financeiro.</p>
          <button
            onClick={async () => {
              await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: window.location.origin,
                },
              });
            }}
            className="w-full rounded-xl bg-accent text-on-accent py-2.5 text-sm font-medium hover:opacity-90 transition"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}