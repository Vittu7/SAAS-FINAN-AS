"use client";

import { Camera, Check, RefreshCw, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { Ico } from "@/components/icons";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const [erroCarga, setErroCarga] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarPerfil = async () => {
    setErroCarga("");
    setCarregando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      setEmail(user.email || "");
      setUserId(user.id);

      const { data: perfil, error } = await supabase
        .from("perfis")
        .select("*, grupos_familiares(nome)")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;

      if (perfil) {
        setNomeUsuario(perfil.nome_usuario || "");
        setGrupoNome(perfil.grupos_familiares?.nome || "Sem grupo vinculado");
        setAvatar(perfil.avatar_url || null);
        setFotoFalhou(false);
      }
    } catch {
      setErroCarga("Não foi possível carregar seu perfil.");
    } finally {
      setCarregando(false);
    }
  };

  // Avisa o resto do app (Grupo Familiar, Sidebar) que o perfil mudou.
  const avisarPerfilAtualizado = (avatarUrl: string | null) => {
    window.dispatchEvent(
      new CustomEvent("homecash:perfil", { detail: { id: userId, avatar_url: avatarUrl } })
    );
  };

  const enviarFoto = async (arquivo?: File) => {
    if (!arquivo || !userId) return;
    setAviso(null);
    if (!arquivo.type.startsWith("image/")) return setAviso({ tipo: "erro", texto: "Escolha uma imagem (JPG, PNG ou WEBP)." });
    if (arquivo.size > 5 * 1024 * 1024) return setAviso({ tipo: "erro", texto: "A imagem deve ter no máximo 5 MB." });

    setEnviandoFoto(true);
    const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
    const caminho = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: erroUpload } = await supabase.storage.from("avatars").upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
    if (erroUpload) {
      setEnviandoFoto(false);
      return setAviso({ tipo: "erro", texto: "Não foi possível enviar a foto: " + erroUpload.message });
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(caminho);
    const { error } = await supabase.from("perfis").update({ avatar_url: data.publicUrl }).eq("id", userId);
    if (error) setAviso({ tipo: "erro", texto: "Não foi possível salvar a foto: " + error.message });
    else {
      setAvatar(data.publicUrl);
      setFotoFalhou(false);
      avisarPerfilAtualizado(data.publicUrl);
      setAviso({ tipo: "ok", texto: "Foto atualizada." });
    }
    setEnviandoFoto(false);
  };

  const removerFoto = async () => {
    if (!confirm("Remover sua foto de perfil?")) return;
    const { error } = await supabase.from("perfis").update({ avatar_url: null }).eq("id", userId);
    if (error) return setAviso({ tipo: "erro", texto: "Não foi possível remover a foto: " + error.message });
    setAvatar(null);
    setFotoFalhou(false);
    avisarPerfilAtualizado(null);
    setAviso({ tipo: "ok", texto: "Foto removida." });
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setAviso(null);
    const { error } = await supabase.from("perfis").update({ nome_usuario: nomeUsuario }).eq("id", userId);
    if (error) setAviso({ tipo: "erro", texto: "Não foi possível atualizar o nome: " + error.message });
    else {
      avisarPerfilAtualizado(avatar);
      setAviso({ tipo: "ok", texto: "Perfil atualizado com sucesso!" });
    }
    setSalvando(false);
  };

  if (carregando) {
    return <p role="status" className="py-6 text-sm text-muted">Carregando perfil...</p>;
  }

  if (erroCarga) {
    return (
      <div role="alert" className="card-glass flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
        <span className="min-w-0 flex-1 text-rose-500">{erroCarga}</span>
        <button type="button" onClick={() => void carregarPerfil()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 font-medium text-on-accent">
          <Ico icon={RefreshCw} size={14} />Tentar novamente
        </button>
      </div>
    );
  }

  const campo = "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="space-y-4">
      <div className="card-glass overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-accent/70 via-accent/30 to-transparent" />
        <div className="-mt-10 flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              className="group relative grid size-24 place-items-center overflow-hidden rounded-3xl bg-accent text-3xl font-bold text-on-accent ring-4 ring-surface shadow-lg"
              aria-label="Alterar foto de perfil"
            >
              {avatar && !fotoFalhou ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="Sua foto" className="h-full w-full object-cover" onError={() => setFotoFalhou(true)} />
              ) : nomeUsuario ? nomeUsuario[0].toUpperCase() : <Ico icon={UserRound} size={40} />}
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {enviandoFoto ? "Enviando..." : "Alterar foto"}
              </span>
            </button>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-surface text-accent shadow ring-2 ring-line">
              <Ico icon={Camera} size={16} />
            </span>
            <input ref={inputFoto} type="file" accept="image/*" className="sr-only" onChange={(e) => enviarFoto(e.target.files?.[0])} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{nomeUsuario || "Meu perfil"}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputFoto.current?.click()} disabled={enviandoFoto} className="min-h-10 flex-1 rounded-xl bg-accent px-4 py-2 text-sm sm:flex-none font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50">
              {enviandoFoto ? "Enviando..." : avatar ? "Trocar foto" : "Enviar foto"}
            </button>
            {avatar && (
              <button type="button" onClick={removerFoto} className="min-h-10 flex-1 rounded-xl border border-line px-4 py-2 text-sm sm:flex-none text-muted transition hover:text-ink">
                <span className="inline-flex items-center gap-1"><Ico icon={Trash2} size={14} />Remover</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {aviso && (
        <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${aviso.tipo === "erro" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
          <Ico icon={aviso.tipo === "erro" ? TriangleAlert : Check} size={18} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{aviso.texto}</span>
        </p>
      )}

      <form onSubmit={salvarPerfil} className="card-glass space-y-4 p-5">
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
      </form>
    </div>
  );
}
