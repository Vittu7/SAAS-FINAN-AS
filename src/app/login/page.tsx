"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const handleLoginGoogle = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErro(err.message || "Erro ao conectar com o Google");
      setCarregando(false);
    }
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setSucesso(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });
        if (error) throw error;
        router.push("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
        });
        if (error) throw error;
        setSucesso("Conta criada com sucesso! Faça login com a sua senha.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setErro(err.message || "Ocorreu um erro na autenticação.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-line bg-background p-8 shadow-lg">
        <div className="space-y-2 text-center">
<div className="flex flex-col items-center gap-1">
  <img 
    src="/logo.png" 
    alt="HomeCash Logo" 
    className="h-40 w-auto" 
  />

  <h1 className="text-4xl font-bold tracking-tight">
    <span className="text-white">Home</span><span className="text-accent">Cash</span>
  </h1>
</div>          <p className="text-sm text-muted">
            Aceda ao seu painel financeiro na nuvem
          </p>
        </div>

        {erro && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500 text-center">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-500 text-center">
            {sucesso}
          </div>
        )}

        <button
          onClick={handleLoginGoogle}
          disabled={carregando}
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface py-3 text-sm font-medium transition hover:bg-muted/10 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
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
          Entrar com o Google
        </button>

        <div className="flex items-center gap-4 text-xs text-muted">
          <div className="h-px flex-1 bg-line"></div>
          <span>ou use e-mail e senha</span>
          <div className="h-px flex-1 bg-line"></div>
        </div>

        <div className="flex rounded-lg border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErro(null); setSucesso(null); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${isLogin ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErro(null); setSucesso(null); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${!isLogin ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmitEmail} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@gmail.com"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50"
          >
            {carregando ? "Aguarde..." : isLogin ? "Entrar na Conta" : "Criar Nova Conta"}
          </button>
        </form>
      </div>
    </main>
  );
}