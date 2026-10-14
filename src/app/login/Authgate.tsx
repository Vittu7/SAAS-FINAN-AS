"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, type Membro } from "@/lib/supabase";
import { botaoPrimario, campo } from "./ui";

type Grupo = {
  userId: string;
  /** O membro que está logado (com o nome de usuário escolhido). */
  eu: Membro;
  /** Todos os membros do grupo familiar, incluindo "eu". */
  membros: Membro[];
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
};

const GrupoContext = createContext<Grupo | null>(null);

export function useGrupo(): Grupo {
  const ctx = useContext(GrupoContext);
  if (!ctx) throw new Error("useGrupo precisa ser usado dentro de <AuthGate>.");
  return ctx;
}

/**
 * Controla o acesso ao app:
 * 1. sem login            -> tela "Entrar com Google"
 * 2. logado, sem grupo    -> tela para criar o grupo e escolher o nome de usuário
 * 3. logado, com grupo    -> mostra o app (children)
 * Convites feitos para o seu e-mail são aceitos automaticamente após o login.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [dados, setDados] = useState<{ eu: Membro; membros: Membro[] } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const userId = sessao?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    // Dentro deste callback só atualizamos estado (chamar o Supabase aqui pode travar).
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => setSessao(nova));
    return () => data.subscription.unsubscribe();
  }, []);

  const carregar = useCallback(async () => {
    if (!userId) return;
    setCarregando(true);
    setErro(null);

    const falha = (mensagem: string) => {
      setErro(mensagem);
      setCarregando(false);
    };

    const convites = await supabase.rpc("aceitar_convites");
    if (convites.error) return falha(convites.error.message);

    const meus = await supabase
      .from("membros")
      .select("*")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1);
    if (meus.error) return falha(meus.error.message);

    const eu = (meus.data as Membro[])[0];
    if (!eu) {
      setDados(null);
      setCarregando(false);
      return;
    }

    const todos = await supabase
      .from("membros")
      .select("*")
      .eq("grupo_id", eu.grupo_id)
      .order("created_at");
    if (todos.error) return falha(todos.error.message);

    setDados({ eu, membros: todos.data as Membro[] });
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setDados(null);
    setCarregando(true);
  }, []);

  if (sessao === undefined) return <Tela>Carregando…</Tela>;
  if (sessao === null) return <Login />;

  if (erro) {
    return (
      <Tela>
        <p className="max-w-sm text-center text-sm text-rose-500">Não foi possível carregar seus dados: {erro}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" className={botaoPrimario} onClick={() => void carregar()}>
            Tentar de novo
          </button>
          <button type="button" className="h-9 rounded-lg border border-line px-3 text-sm" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </Tela>
    );
  }

  if (carregando) return <Tela>Carregando…</Tela>;

  if (!dados) {
    const metadados = sessao.user.user_metadata as { full_name?: string } | undefined;
    return (
      <CriarGrupo
        sugestao={metadados?.full_name?.split(" ")[0] ?? ""}
        email={sessao.user.email ?? ""}
        onCriado={carregar}
        onSair={sair}
      />
    );
  }

  return (
    <GrupoContext.Provider value={{ userId: userId!, eu: dados.eu, membros: dados.membros, recarregar: carregar, sair }}>
      <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-3 px-4 pt-4 text-sm text-muted md:px-8">
        <span>
          Olá, <strong className="font-semibold text-ink">{dados.eu.nome}</strong>
        </span>
        <button
          type="button"
          onClick={() => void sair()}
          className="rounded-md px-2 py-1 transition hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          Sair
        </button>
      </div>
      {children}
    </GrupoContext.Provider>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 text-sm text-muted">
      <div>{children}</div>
    </main>
  );
}

function Login() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setErro(error.message);
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold">Home Cash</h1>
        <p className="mt-1 text-sm text-muted">Entre para acessar seu painel em qualquer aparelho.</p>

        <button type="button" onClick={() => void entrar()} disabled={enviando} className={`${botaoPrimario} mt-6 w-full disabled:opacity-60`}>
          {enviando ? "Abrindo o Google…" : "Entrar com Google"}
        </button>

        {erro && (
          <p role="alert" className="mt-3 text-sm text-rose-500">
            {erro}
          </p>
        )}
      </div>
    </main>
  );
}

function CriarGrupo({
  sugestao,
  email,
  onCriado,
  onSair,
}: {
  sugestao: string;
  email: string;
  onCriado: () => Promise<void>;
  onSair: () => Promise<void>;
}) {
  const [nomeGrupo, setNomeGrupo] = useState("Minha família");
  const [meuNome, setMeuNome] = useState(sugestao);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nomeGrupo.trim() || !meuNome.trim()) return;
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.rpc("criar_grupo", {
      p_nome: nomeGrupo.trim(),
      p_meu_nome: meuNome.trim(),
    });
    if (error) {
      setErro(error.message);
      setEnviando(false);
      return;
    }
    await onCriado();
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold">Crie seu grupo familiar</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha o nome que os outros membros vão ver. Depois você convida a família pelo e-mail do Google.
        </p>

        <label className="mt-6 block text-sm">
          <span className="mb-1 block text-muted">Seu nome de usuário</span>
          <input className={campo} value={meuNome} onChange={(e) => setMeuNome(e.target.value)} maxLength={30} placeholder="Ex.: Vittor" required />
        </label>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-muted">Nome do grupo</span>
          <input className={campo} value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} maxLength={40} required />
        </label>

        <button type="submit" disabled={enviando} className={`${botaoPrimario} mt-6 w-full disabled:opacity-60`}>
          {enviando ? "Criando…" : "Criar grupo"}
        </button>

        {erro && (
          <p role="alert" className="mt-3 text-sm text-rose-500">
            {erro}
          </p>
        )}

        <p className="mt-5 text-xs text-muted">
          Entrou como {email}. Se alguém da família já te convidou, entre com o mesmo e-mail que ele usou no convite.{" "}
          <button type="button" onClick={() => void onSair()} className="underline">
            Sair
          </button>
        </p>
      </form>
    </main>
  );
}
