"use client";

import { Trash2, UserRound } from "lucide-react";
import { Ico } from "@/components/icons";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import CampoSenha from "@/components/auth/CampoSenha";
import { traduzirErroAuth, validarSenha } from "@/lib/auth";
import { avatarDoProvedor, avisarPerfilAtualizado, enviarFotoPerfil, garantirPerfil, nomePadrao, salvarPerfil } from "@/lib/perfil";

export default function PerfilConta() {
  const router = useRouter();
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [grupoNome, setGrupoNome] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [status, setStatus] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [repetirSenha, setRepetirSenha] = useState("");
  const [tentouSenha, setTentouSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [statusSenha, setStatusSenha] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarPerfil = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");

    setEmail(user.email || "");
    setUserId(user.id);

    try {
      // Cria o perfil se ainda não existir (antes, quem acabou de se cadastrar não conseguia salvar)
      const perfil = await garantirPerfil(supabase as any, user);
      setNomeUsuario(perfil.nome_usuario || nomePadrao(user));
      setAvatar(perfil.avatar_url || null);
      const { data: grupo } = await supabase.from("perfis").select("grupos_familiares(nome)").eq("id", user.id).maybeSingle();
      setGrupoNome((grupo as any)?.grupos_familiares?.nome || "Sem grupo vinculado");
    } catch (e: any) {
      setStatus({ tipo: "erro", texto: e.message || "Não foi possível carregar o perfil." });
      setNomeUsuario(nomePadrao(user));
      setAvatar(avatarDoProvedor(user));
    }
    setCarregando(false);
  };

  const usuarioAtual = async () => (await supabase.auth.getUser()).data.user;

  const enviarFoto = async (arquivo?: File) => {
    if (!arquivo) return;
    const user = await usuarioAtual();
    if (!user) return;
    setEnviandoFoto(true);
    setStatus(null);
    try {
      const url = await enviarFotoPerfil(supabase as any, user, arquivo);
      setAvatar(url);
      avisarPerfilAtualizado();
      setStatus({ tipo: "ok", texto: "Foto atualizada." });
    } catch (e: any) {
      setStatus({ tipo: "erro", texto: e.message || "Não foi possível enviar a foto." });
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = async () => {
    if (!confirm("Remover sua foto de perfil?")) return;
    const user = await usuarioAtual();
    if (!user) return;
    try {
      await salvarPerfil(supabase as any, user, { avatar_url: null });
      setAvatar(null);
      avisarPerfilAtualizado();
      setStatus({ tipo: "ok", texto: "Foto removida." });
    } catch (e: any) {
      setStatus({ tipo: "erro", texto: e.message });
    }
  };

  const salvarPerfilForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeUsuario.trim()) return setStatus({ tipo: "erro", texto: "Digite um nome." });
    const user = await usuarioAtual();
    if (!user) return;
    setSalvando(true);
    setStatus(null);
    try {
      const salvo = await salvarPerfil(supabase as any, user, { nome: nomeUsuario });
      setNomeUsuario(salvo.nome_usuario || nomeUsuario);
      avisarPerfilAtualizado();
      setStatus({ tipo: "ok", texto: "Perfil atualizado com sucesso!" });
    } catch (e: any) {
      setStatus({ tipo: "erro", texto: e.message || "Não foi possível salvar." });
    } finally {
      setSalvando(false);
    }
  };

  const alterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentouSenha(true);
    const msg = validarSenha(novaSenha);
    if (msg) return setStatusSenha({ tipo: "erro", texto: msg });
    if (novaSenha !== repetirSenha) return setStatusSenha({ tipo: "erro", texto: "As senhas não são iguais." });
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvandoSenha(false);
    if (error) return setStatusSenha({ tipo: "erro", texto: traduzirErroAuth(error) });
    setNovaSenha("");
    setRepetirSenha("");
    setTentouSenha(false);
    setStatusSenha({ tipo: "ok", texto: "Senha alterada com sucesso." });
  };

  if (carregando) {
    return <p className="py-6 text-sm text-muted">Carregando perfil...</p>;
  }

  const campo = "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="space-y-4">
      <div className="card-glass overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-accent/70 via-accent/30 to-transparent" />
        <div className="-mt-10 flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="group relative grid size-24 place-items-center overflow-hidden rounded-3xl bg-accent text-3xl font-bold text-on-accent ring-4 ring-surface shadow-lg"
              aria-label="Alterar foto de perfil"
            >
              <Avatar src={avatar} nome={nomeUsuario} cor="var(--accent)" tamanho="xl" className="!rounded-none !h-full !w-full" />
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                {enviandoFoto ? "Enviando..." : "Alterar foto"}
              </span>
            </button>
            <input ref={inputFoto} type="file" accept="image/*" className="sr-only" onChange={(e) => enviarFoto(e.target.files?.[0])} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{nomeUsuario || "Meu perfil"}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => inputFoto.current?.click()} disabled={enviandoFoto} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50">
              {enviandoFoto ? "Enviando..." : avatar ? "Trocar foto" : "Enviar foto"}
            </button>
            {avatar && (
              <button type="button" onClick={removerFoto} className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink">
                <span className="inline-flex items-center gap-1"><Ico icon={Trash2} size={14} />Remover</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={salvarPerfilForm} className="card-glass space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nome de exibição no app</label>
          <input type="text" required value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} className={campo} placeholder="Ex: Vittor" />
          <p className="mt-1 text-xs text-muted">Aparece no gráfico de divisão de gastos e nas despesas da família.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">E-mail de login</label>
            <input type="text" disabled value={email} className={`${campo} cursor-not-allowed text-muted`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Grupo financeiro</label>
            <input type="text" disabled value={grupoNome} className={`${campo} cursor-not-allowed text-muted`} />
          </div>
        </div>
        <button type="submit" disabled={salvando} className="w-full rounded-xl bg-accent py-3 font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {status && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${status.tipo === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>{status.texto}</p>}
      </form>

      <form onSubmit={alterarSenha} className="card-glass space-y-4 p-5" aria-label="Alterar senha">
        <div>
          <h3 className="text-base font-bold">Segurança</h3>
          <p className="text-xs text-muted">Troque a senha da sua conta (mínimo de 6 caracteres). Se você entra só com o Google, não precisa de senha.</p>
        </div>
        <CampoSenha id="nova-senha" rotulo="Nova senha" valor={novaSenha} onChange={setNovaSenha} autoComplete="new-password" mostrarRequisito invalido={tentouSenha} />
        <CampoSenha id="repetir-senha" rotulo="Repita a nova senha" valor={repetirSenha} onChange={setRepetirSenha} autoComplete="new-password" />
        {statusSenha && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${statusSenha.tipo === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>{statusSenha.texto}</p>}
        <button type="submit" disabled={salvandoSenha} className="w-full rounded-xl border border-line py-3 font-medium transition hover:bg-background disabled:opacity-50">{salvandoSenha ? "Salvando..." : "Alterar senha"}</button>
      </form>
    </div>
  );
}
