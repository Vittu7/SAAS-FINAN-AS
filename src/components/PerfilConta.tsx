
"use client";

import { avisos, explicarFalha } from "@/lib/avisos";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/components/icons";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import DialogResponsivo from "@/components/DialogResponsivo";
import { falhou } from "@/lib/avisos";
import { sairDaConta } from "@/lib/auth";
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

  const [excluindoConta, setExcluindoConta] = useState(false);
  const [confirmaTexto, setConfirmaTexto] = useState("");
  const [apagando, setApagando] = useState(false);
  const PALAVRA = "EXCLUIR";

  const fecharExclusao = () => { if (!apagando) { setExcluindoConta(false); setConfirmaTexto(""); } };

  const excluirConta = async () => {
    if (confirmaTexto.trim().toUpperCase() !== PALAVRA) return;
    setApagando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão não encontrada. Entre novamente.");

      // fotos de perfil guardadas (se não der, a conta é excluída do mesmo jeito)
      try {
        const { data: arquivos } = await supabase.storage.from("avatars").list(user.id);
        if (arquivos?.length) await supabase.storage.from("avatars").remove(arquivos.map((a) => `${user.id}/${a.name}`));
      } catch { /* sem fotos ou sem permissão */ }

      // Caixinhas primeiro: se o banco apagar só os movimentos, o saldo recalculado fica negativo e a exclusão trava (caixinhas_saldo_check).
      // Apagando a caixinha inteira (os movimentos saem junto) isso não acontece. Se falhar, segue para a função do banco.
      const { error: erroCaixinhas } = await supabase.from("caixinhas").delete().eq("user_id", user.id);
      if (erroCaixinhas) console.error("Erro ao apagar caixinhas antes de excluir a conta:", erroCaixinhas);

      const { error } = await supabase.rpc("excluir_minha_conta");
      if (error) throw error;

      try {
        Object.keys(localStorage).filter((k) => k.startsWith("homecash")).forEach((k) => localStorage.removeItem(k));
      } catch { /* armazenamento indisponível */ }
      await sairDaConta(supabase as any).catch(() => null);
      avisos.sucesso("Conta excluída", "Todos os seus dados foram apagados.");
      router.replace("/login");
    } catch (e) {
      falhou("excluir a conta", e);
      setApagando(false);
    }
  };

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

      setStatus(null);
      avisos.sucesso("Foto atualizada");
    } catch (e: any) {
      setStatus(null);
      avisos.erro("Não foi possível enviar a foto", e?.message || explicarFalha(e));
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

      setStatus(null);
      avisos.sucesso("Foto removida");
    } catch (e: any) {
      setStatus(null);
      avisos.erro("Não foi possível remover a foto", e?.message || explicarFalha(e));
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

      setStatus(null);
      avisos.sucesso("Perfil atualizado", "Seu nome já aparece assim para o grupo.");
    } catch (e: any) {
      setStatus(null);
      avisos.erro("Não foi possível salvar o perfil", e?.message || explicarFalha(e));
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

      <section className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-5" aria-label="Excluir conta">
        <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Excluir conta</h3>
        <p className="mt-1 text-sm text-muted">
          Apaga para sempre o seu login e todos os seus dados: lançamentos, cartões, caixinhas, investimentos e configurações. Não dá para desfazer.
        </p>
        <button
          type="button"
          onClick={() => setExcluindoConta(true)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/50 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/10 dark:text-rose-400"
        >
          <Ico icon={Trash2} size={16} />Excluir minha conta
        </button>
      </section>

      {excluindoConta && (
        <DialogResponsivo titulo="Excluir conta" onFechar={fecharExclusao}>
          <div className="space-y-4">
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              Esta ação é permanente e não pode ser desfeita.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Seu login e seu perfil serão apagados.</li>
              <li>Os lançamentos que você criou, seus cartões, categorias, caixinhas e aportes serão apagados.</li>
              <li>Nos lançamentos de outras pessoas em que você era só o responsável, o seu nome é removido.</li>
              <li>Se você for a última pessoa do grupo familiar, o grupo e os convidados dele também serão apagados.</li>
            </ul>
            <div>
              <label htmlFor="conf-excluir" className="mb-1 block text-xs font-medium text-muted">
                Para confirmar, digite <b className="text-ink">{PALAVRA}</b>
              </label>
              <input
                id="conf-excluir"
                autoComplete="off"
                value={confirmaTexto}
                onChange={(e) => setConfirmaTexto(e.target.value)}
                className={campo}
                placeholder={PALAVRA}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={fecharExclusao} disabled={apagando} className="h-11 rounded-xl px-5 text-sm font-medium text-muted ring-1 ring-line disabled:opacity-50">Cancelar</button>
              <button
                type="button"
                onClick={excluirConta}
                disabled={apagando || confirmaTexto.trim().toUpperCase() !== PALAVRA}
                className="h-11 rounded-xl bg-rose-700 px-5 text-sm font-semibold text-white transition disabled:opacity-40"
              >
                {apagando ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </DialogResponsivo>
      )}
    </div>
  );
}
