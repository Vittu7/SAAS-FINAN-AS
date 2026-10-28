"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, Sparkles, Users, WalletCards, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Ico } from "@/components/icons";
import Avatar from "@/components/Avatar";
import CampoSenha from "@/components/auth/CampoSenha";
import { ContaLembrada, contasLembradas, emailValido, esquecerConta, interpretarCadastro, lembrarConta, traduzirErroAuth, validarSenha } from "@/lib/auth";
import { garantirPerfil } from "@/lib/perfil";

type Modo = "entrar" | "cadastrar" | "esqueci" | "nova-senha" | "confirmar-email" | "email-recuperacao";

const campo = "h-12 w-full rounded-xl border border-line bg-background px-4 text-base text-ink outline-none transition focus:ring-2 focus:ring-accent";

function LoginConteudo() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [contas, setContas] = useState<ContaLembrada[]>([]);
  const [reenvioEm, setReenvioEm] = useState(0);
  const recuperando = useRef(false);
  const senhaRef = useRef<HTMLDivElement>(null);

  const origem = () => window.location.origin;

  // Contas lembradas neste aparelho + retorno do e-mail de confirmação / recuperação
  useEffect(() => {
    setContas(contasLembradas());
    recuperando.current = window.location.hash.includes("type=recovery");
    if (recuperando.current) setModo("nova-senha");
    if (new URLSearchParams(window.location.search).get("confirmado")) setAviso("E-mail confirmado! Estamos entrando na sua conta...");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") {
        recuperando.current = true;
        setModo("nova-senha");
      } else if (sessao && !recuperando.current && (evento === "SIGNED_IN" || evento === "INITIAL_SESSION")) {
        router.replace("/");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !recuperando.current) router.replace("/");
    });
    return () => subscription.unsubscribe();
    // Executa só uma vez ao abrir a tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contagem regressiva do botão "Reenviar e-mail"
  useEffect(() => {
    if (reenvioEm <= 0) return;
    const t = setTimeout(() => setReenvioEm((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioEm]);

  const trocarModo = (m: Modo) => {
    setModo(m);
    setErro(null);
    setAviso(null);
    setTentou(false);
    setSenha("");
    setConfirmacao("");
  };

  const escolherConta = (c: ContaLembrada) => {
    setEmail(c.email);
    setModo("entrar");
    setErro(null);
    setSenha("");
    setTimeout(() => senhaRef.current?.querySelector("input")?.focus(), 50);
  };

  const emailParaConfirmacao = () => ({ emailRedirectTo: `${origem()}/login?confirmado=1` });

  const entrarComGoogle = async () => {
    setCarregando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origem()}/` } });
    if (error) {
      setErro(traduzirErroAuth(error));
      setCarregando(false);
    }
  };

  const reenviar = useCallback(async () => {
    if (reenvioEm > 0 || !emailValido(email)) return;
    setErro(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: emailParaConfirmacao() });
    if (error) return setErro(traduzirErroAuth(error));
    setAviso("Enviamos o e-mail novamente. Confira também a caixa de spam.");
    setReenvioEm(60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, reenvioEm]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    setAviso(null);

    if (!emailValido(email) && modo !== "nova-senha") return setErro("Digite um e-mail válido.");

    // Regra de senha (mínimo de 6 caracteres) vale para cadastro e para nova senha
    if (modo === "cadastrar" || modo === "nova-senha") {
      const msg = validarSenha(senha);
      if (msg) return setErro(msg);
    }
    if (modo === "nova-senha" && senha !== confirmacao) return setErro("As senhas não são iguais.");
    if (modo === "entrar" && !senha) return setErro("Digite a sua senha.");

    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        if (lembrar && data.user) {
          const perfil = await garantirPerfil(supabase as any, data.user).catch(() => null);
          lembrarConta({ email: email.trim(), nome: perfil?.nome_usuario || data.user.user_metadata?.full_name || email.split("@")[0], avatar: perfil?.avatar_url || data.user.user_metadata?.avatar_url || null });
        }
        router.replace("/");
      } else if (modo === "cadastrar") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: emailParaConfirmacao() });
        if (error) throw error;
        const resultado = interpretarCadastro(data);
        if (resultado === "ja-cadastrado") throw new Error("User already registered");
        if (resultado === "logado") {
          router.replace("/");
        } else {
          setModo("confirmar-email");
          setReenvioEm(60);
        }
      } else if (modo === "esqueci") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origem()}/login` });
        if (error) throw error;
        setModo("email-recuperacao");
      } else if (modo === "nova-senha") {
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw error;
        recuperando.current = false;
        router.replace("/");
      }
    } catch (err) {
      const msg = traduzirErroAuth(err);
      setErro(msg);
      if (modo === "entrar" && msg.includes("não foi confirmado")) setAviso("Use o botão abaixo para reenviar o e-mail de confirmação.");
    } finally {
      setCarregando(false);
    }
  };

  const titulo: Record<Modo, string> = {
    entrar: "Bem-vindo de volta",
    cadastrar: "Crie a sua conta",
    esqueci: "Recuperar senha",
    "nova-senha": "Crie uma nova senha",
    "confirmar-email": "Confirme o seu e-mail",
    "email-recuperacao": "Verifique o seu e-mail",
  };
  const subtitulo: Record<Modo, string> = {
    entrar: "Entre para acompanhar as finanças da sua casa.",
    cadastrar: "É grátis e leva menos de um minuto.",
    esqueci: "Informe o e-mail da conta e enviaremos um link para criar uma nova senha.",
    "nova-senha": "Escolha uma senha com pelo menos 6 caracteres.",
    "confirmar-email": "",
    "email-recuperacao": "",
  };
  const comAbas = modo === "entrar" || modo === "cadastrar";

  return (
    <main className="grid min-h-dvh bg-background text-ink lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca (desktop) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent),black_40%)] p-12 text-on-accent lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-black/10" />
        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-12 w-auto" />
          <span className="text-2xl font-bold">HomeCash</span>
        </div>
        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-bold leading-tight">O dinheiro da casa, organizado em um só lugar.</h2>
          <ul className="space-y-4 text-base">
            {[[WalletCards, "Entradas, saídas e saldo restante sempre claros"], [Users, "Controle em família, com quem pagou cada despesa"], [ShieldCheck, "Seus dados protegidos na nuvem"]].map(([I, t]: any) => (
              <li key={t} className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15"><Ico icon={I} size={20} /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm opacity-80">© HomeCash · Finanças da família</p>
      </aside>

      {/* Formulário */}
      <section className="flex items-center justify-center px-5 py-8 sm:px-8">
        <div className="anim-page w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2 text-center lg:hidden">
            <img src="/logo.png" alt="HomeCash" className="h-20 w-auto" />
            <p className="text-3xl font-bold tracking-tight">Home<span className="text-accent">Cash</span></p>
          </div>

          {/* Contas já usadas neste aparelho */}
          {modo === "entrar" && contas.length > 0 && (
            <div className="space-y-2" aria-label="Contas neste aparelho">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Entrar como</p>
              <ul className="space-y-2">
                {contas.map((c) => (
                  <li key={c.email} className="flex items-center gap-2">
                    <button type="button" onClick={() => escolherConta(c)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-accent/60 active:scale-[0.99]">
                      <Avatar src={c.avatar} nome={c.nome} cor="var(--accent)" tamanho="md" />
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{c.nome}</span><span className="block truncate text-xs text-muted">{c.email}</span></span>
                    </button>
                    <button type="button" onClick={() => { esquecerConta(c.email); setContas(contasLembradas()); }} aria-label={`Remover ${c.email} deste aparelho`} title="Remover deste aparelho" className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface hover:text-ink"><Ico icon={X} size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            {(modo === "esqueci" || modo === "nova-senha") && modo !== "nova-senha" && (
              <button type="button" onClick={() => trocarModo("entrar")} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><Ico icon={ArrowLeft} size={16} />Voltar</button>
            )}
            <h1 className="text-2xl font-bold">{titulo[modo]}</h1>
            {subtitulo[modo] && <p className="text-sm text-muted">{subtitulo[modo]}</p>}
          </div>

          {/* Telas de confirmação */}
          {(modo === "confirmar-email" || modo === "email-recuperacao") && (
            <div className="space-y-4 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent/12 text-accent"><Ico icon={Mail} size={30} /></span>
              <p className="text-sm text-muted">
                {modo === "confirmar-email" ? <>Enviamos um link de confirmação para <b className="text-ink">{email}</b>. Abra o e-mail e toque no link para ativar a sua conta. Depois é só entrar.</> : <>Se existir uma conta para <b className="text-ink">{email}</b>, enviamos um link para criar uma nova senha.</>}
              </p>
              {aviso && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">{aviso}</p>}
              {erro && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}
              <div className="grid gap-2">
                {modo === "confirmar-email" && <button type="button" onClick={reenviar} disabled={reenvioEm > 0} className="h-12 rounded-xl border border-line text-sm font-medium transition hover:bg-surface disabled:opacity-50">{reenvioEm > 0 ? `Reenviar e-mail em ${reenvioEm}s` : "Reenviar e-mail"}</button>}
                <button type="button" onClick={() => trocarModo("entrar")} className="h-12 rounded-xl bg-accent text-sm font-semibold text-on-accent">Ir para o login</button>
              </div>
              <p className="text-xs text-muted">Não chegou? Veja a caixa de spam ou confira se o e-mail está correto.</p>
            </div>
          )}

          {modo !== "confirmar-email" && modo !== "email-recuperacao" && (
            <>
              {comAbas && (
                <>
                  <button onClick={entrarComGoogle} disabled={carregando} type="button" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface text-sm font-medium transition hover:bg-background disabled:opacity-50">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.2v3.15C3.17 21.32 7.22 24 12 24z" /><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.5-.38-2.27s.13-1.55.38-2.27V6.58H1.2C.43 8.13 0 9.99 0 12s.43 3.87 1.2 5.42l4.08-3.15z" /><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.22 0 3.17 2.68 1.2 6.58l4.08 3.15c.95-2.83 3.6-4.98 6.72-4.98z" /></svg>
                    Continuar com o Google
                  </button>
                  <div className="flex items-center gap-4 text-xs text-muted"><div className="h-px flex-1 bg-line" /><span>ou com e-mail</span><div className="h-px flex-1 bg-line" /></div>
                  <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line" role="tablist">
                    {(["entrar", "cadastrar"] as const).map((m) => (
                      <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => trocarModo(m)} className={`h-10 rounded-xl text-sm font-semibold transition ${modo === m ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{m === "entrar" ? "Entrar" : "Criar conta"}</button>
                    ))}
                  </div>
                </>
              )}

              <form onSubmit={enviar} className="space-y-4" noValidate>
                {modo !== "nova-senha" && (
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-medium text-muted">E-mail</label>
                    <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className={campo} />
                  </div>
                )}

                {(modo === "entrar" || modo === "cadastrar" || modo === "nova-senha") && (
                  <div ref={senhaRef}>
                    <CampoSenha id="senha" rotulo={modo === "nova-senha" ? "Nova senha" : "Senha"} valor={senha} onChange={setSenha} autoComplete={modo === "entrar" ? "current-password" : "new-password"} mostrarRequisito={modo !== "entrar"} invalido={tentou} />
                  </div>
                )}

                {modo === "nova-senha" && (
                  <CampoSenha id="confirmacao" rotulo="Repita a nova senha" valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
                )}

                {modo === "entrar" && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <label className="flex cursor-pointer items-center gap-2 text-muted"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="size-4 accent-[var(--accent)]" />Lembrar desta conta</label>
                    <button type="button" onClick={() => trocarModo("esqueci")} className="font-medium text-accent hover:underline">Esqueci a senha</button>
                  </div>
                )}

                {erro && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}
                {aviso && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">{aviso}</p>}
                {modo === "entrar" && erro?.includes("não foi confirmado") && (
                  <button type="button" onClick={async () => { await reenviar(); setModo("confirmar-email"); }} className="text-sm font-medium text-accent hover:underline">Reenviar e-mail de confirmação</button>
                )}

                <button type="submit" disabled={carregando || ((modo === "cadastrar" || modo === "nova-senha") && validarSenha(senha) !== null && tentou)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent shadow-lg shadow-accent/20 transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50">
                  {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : modo === "cadastrar" ? <><Ico icon={Sparkles} size={18} />Criar minha conta</> : modo === "esqueci" ? "Enviar link de recuperação" : "Salvar nova senha"}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-muted">
            Ao continuar, você concorda com os <Link href="/termos" className="font-medium text-accent hover:underline">Termos de Serviço</Link> e com a <Link href="/privacidade" className="font-medium text-accent hover:underline">Política de Privacidade</Link>.
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
