"use client";

import { Trash2, UserRound } from "lucide-react";
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

    const { data: perfil } = await supabase
      .from("perfis")
      .select("*, grupos_familiares(nome)")
      .eq("id", user.id)
      .maybeSingle();

    if (perfil) {
      setNomeUsuario(perfil.nome_usuario || "");
      setGrupoNome(perfil.grupos_familiares?.nome || "Sem grupo vinculado");
      setAvatar(perfil.avatar_url || null);
    }
    setCarregando(false);
  };

  // Avisa o resto do app (Grupo Familiar, Sidebar) que o perfil mudou.
  const avisarPerfilAtualizado = (avatarUrl: string | null) => {
    window.dispatchEvent(
      new CustomEvent("homecash:perfil", { detail: { id: userId, avatar_url: avatarUrl } })
    );
  };

  const enviarFoto = async (arquivo?: File) => {
    if (!arquivo || !userId) return;
    if (!arquivo.type.startsWith("image/")) return alert("Escolha uma imagem (JPG, PNG ou WEBP).");
    if (arquivo.size > 5 * 1024 * 1024) return alert("A imagem deve ter no máximo 5 MB.");

    setEnviandoFoto(true);
    const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
    const caminho = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: erroUpload } = await supabase.storage.from("avatars").upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
    if (erroUpload) {
      setEnviandoFoto(false);
      return alert("Erro ao enviar a foto: " + erroUpload.message);
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(caminho);
    const { error } = await supabase.from("perfis").update({ avatar_url: data.publicUrl }).eq("id", userId);
    if (error) alert("Erro ao salvar a foto: " + error.message);
    else {
      setAvatar(data.publicUrl);
      avisarPerfilAtualizado(data.publicUrl);
    }
    setEnviandoFoto(false);
  };

  const removerFoto = async () => {
    if (!confirm("Remover sua foto de perfil?")) return;
    const { error } = await supabase.from("perfis").update({ avatar_url: null }).eq("id", userId);
    if (error) return alert("Erro ao remover: " + error.message);
    setAvatar(null);
    avisarPerfilAtualizado(null);
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from("perfis").update({ nome_usuario: nomeUsuario }).eq("id", userId);
    if (error) alert("Erro ao atualizar nome: " + error.message);
    else {
      avisarPerfilAtualizado(avatar);
      alert("Perfil atualizado com sucesso!");
    }
    setSalvando(false);
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
              {avatar ? <img src={avatar} alt="Sua foto" className="h-full w-full object-cover" /> : nomeUsuario ? nomeUsuario[0].toUpperCase() : <Ico icon={UserRound} size={40} />}
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
