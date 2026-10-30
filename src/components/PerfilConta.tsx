
"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/icons";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import {
  avatarDoProvedor,
  avisarPerfilAtualizado,
  enviarFotoPerfil,
  garantirPerfil,
  nomePadrao,
  salvarPerfil,
} from "@/lib/perfil";

type Status = {
  tipo: "ok" | "erro";
  texto: string;
};

export default function PerfilConta() {
  const router = useRouter();

  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [grupoNome, setGrupoNome] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;

    const carregarPerfil = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!ativo) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email || "");

      try {
        const perfil = await garantirPerfil(supabase as any, user);

        if (!ativo) return;

        setNomeUsuario(perfil.nome_usuario || nomePadrao(user));
        setAvatar(perfil.avatar_url || avatarDoProvedor(user));

        const { data: grupo } = await supabase
          .from("perfis")
          .select("grupos_familiares(nome)")
          .eq("id", user.id)
          .maybeSingle();

        if (!ativo) return;

        setGrupoNome(
          (grupo as any)?.grupos_familiares?.nome || "Sem grupo vinculado"
        );
      } catch (e: any) {
        if (!ativo) return;

        setStatus({
          tipo: "erro",
          texto: e?.message || "Não foi possível carregar o perfil.",
        });

        setNomeUsuario(nomePadrao(user));
        setAvatar(avatarDoProvedor(user));
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregarPerfil();

    return () => {
      ativo = false;
    };
  }, [router]);

  const usuarioAtual = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  };

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
      setStatus({
        tipo: "erro",
        texto: e?.message || "Não foi possível enviar a foto.",
      });
    } finally {
      setEnviandoFoto(false);

      if (inputFoto.current) {
        inputFoto.current.value = "";
      }
    }
  };

  const removerFoto = async () => {
    if (!window.confirm("Remover sua foto de perfil?")) return;

    const user = await usuarioAtual();
    if (!user) return;

    setStatus(null);

    try {
      await salvarPerfil(supabase as any, user, { avatar_url: null });
      setAvatar(null);
      avisarPerfilAtualizado();

      setStatus({ tipo: "ok", texto: "Foto removida." });
    } catch (e: any) {
      setStatus({
        tipo: "erro",
        texto: e?.message || "Não foi possível remover a foto.",
      });
    }
  };

  const salvarPerfilForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomeUsuario.trim()) {
      setStatus({ tipo: "erro", texto: "Digite um nome." });
      return;
    }

    const user = await usuarioAtual();
    if (!user) return;

    setSalvando(true);
    setStatus(null);

    try {
      const salvo = await salvarPerfil(supabase as any, user, {
        nome: nomeUsuario.trim(),
      });

      setNomeUsuario(salvo.nome_usuario || nomeUsuario.trim());
      avisarPerfilAtualizado();

      setStatus({
        tipo: "ok",
        texto: "Perfil atualizado com sucesso!",
      });
    } catch (e: any) {
      setStatus({
        tipo: "erro",
        texto: e?.message || "Não foi possível salvar o perfil.",
      });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <p className="py-6 text-sm text-muted">Carregando perfil...</p>;
  }

  const campo =
    "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="space-y-4">
      <div className="card-glass overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-accent/70 via-accent/30 to-transparent" />

        <div className="-mt-10 flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              disabled={enviandoFoto}
              className="group relative grid size-24 place-items-center overflow-hidden rounded-3xl bg-accent text-3xl font-bold text-on-accent ring-4 ring-surface shadow-lg"
              aria-label="Alterar foto de perfil"
            >
              <Avatar
                src={avatar}
                nome={nomeUsuario}
                cor="var(--accent)"
                tamanho="xl"
                className="!h-full !w-full !rounded-none"
              />

              <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                {enviandoFoto ? "Enviando..." : "Alterar foto"}
              </span>
            </button>

            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => enviarFoto(e.target.files?.[0])}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">
              {nomeUsuario || "Meu perfil"}
            </p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              disabled={enviandoFoto}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50"
            >
              {enviandoFoto
                ? "Enviando..."
                : avatar
                  ? "Trocar foto"
                  : "Enviar foto"}
            </button>

            {avatar && (
              <button
                type="button"
                onClick={removerFoto}
                className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
              >
                <span className="inline-flex items-center gap-1">
                  <Ico icon={Trash2} size={14} />
                  Remover
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={salvarPerfilForm} className="card-glass space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Nome de exibição no app
          </label>

          <input
            type="text"
            required
            value={nomeUsuario}
            onChange={(e) => setNomeUsuario(e.target.value)}
            className={campo}
            placeholder="Seu nome"
          />

          <p className="mt-1 text-xs text-muted">
            Aparece no gráfico de divisão de gastos e nas despesas da família.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Conta Google
            </label>
            <input
              type="text"
              disabled
              value={email}
              className={`${campo} cursor-not-allowed text-muted`}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Grupo financeiro
            </label>
            <input
              type="text"
              disabled
              value={grupoNome}
              className={`${campo} cursor-not-allowed text-muted`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-xl bg-accent py-3 font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>

        {status && (
          <p
            role="status"
            className={`rounded-xl px-3 py-2 text-sm ${
              status.tipo === "ok"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            }`}
          >
            {status.texto}
          </p>
        )}
      </form>
    </div>
  );
}
