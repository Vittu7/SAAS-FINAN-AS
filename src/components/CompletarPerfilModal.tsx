"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";
import { avisarPerfilAtualizado, enviarFotoPerfil, garantirPerfil, salvarPerfil } from "@/lib/perfil";
import { lerDoUsuario, salvarDoUsuario } from "@/lib/usuarioStorage";

const campo = "h-12 w-full rounded-xl border border-line bg-background px-4 text-base text-ink outline-none focus:ring-2 focus:ring-accent";

/**
 * Logo após o cadastro: pede nome e foto. Aparece uma única vez por usuário
 * (e só se ele ainda não tem foto), e pode ser pulado.
 */
export default function CompletarPerfilModal() {
  const [aberto, setAberto] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !vivo) return;
      if (lerDoUsuario(data.user.id, "perfil-etapa", { feito: false }).feito) return;
      try {
        const perfil = await garantirPerfil(supabase as any, data.user);
        if (!vivo) return;
        if (perfil.avatar_url) return salvarDoUsuario(data.user.id, "perfil-etapa", { feito: true });
        setUser(data.user);
        setNome(perfil.nome_usuario || "");
        setAberto(true);
      } catch {
        /* sem perfil não há o que completar agora */
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (!aberto || !user) return null;

  const concluir = () => {
    salvarDoUsuario(user.id, "perfil-etapa", { feito: true });
    setAberto(false);
  };

  const escolherFoto = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      setAvatar(await enviarFotoPerfil(supabase as any, user, arquivo));
      avisarPerfilAtualizado();
    } catch (e: any) {
      setErro(e.message || "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro("Digite como você quer ser chamado.");
    setSalvando(true);
    setErro("");
    try {
      await salvarPerfil(supabase as any, user, { nome });
      avisarPerfilAtualizado();
      concluir();
    } catch (e: any) {
      setErro(e.message || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogResponsivo titulo="Complete seu perfil" onFechar={concluir}>
      <form onSubmit={salvar} className="space-y-5 text-center">
        <p className="text-sm text-muted">Escolha seu nome e uma foto. Assim sua família sabe quem lançou cada despesa.</p>
        <div className="relative mx-auto w-fit">
          <Avatar src={avatar} nome={nome} cor="var(--accent)" tamanho="xl" />
          <button type="button" onClick={() => input.current?.click()} disabled={enviando} aria-label="Escolher foto" className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-accent text-on-accent shadow-lg ring-4 ring-[var(--surface)] disabled:opacity-60">
            <Ico icon={Camera} size={18} />
          </button>
          <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => { escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {enviando && <p className="text-xs text-muted">Enviando foto...</p>}
        <div className="text-left">
          <label htmlFor="cp-nome" className="mb-1 block text-xs font-medium text-muted">Nome de exibição</label>
          <input id="cp-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vittor" className={campo} />
        </div>
        {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-left text-sm text-rose-700 dark:text-rose-400">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={concluir} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Agora não</button>
          <button type="submit" disabled={salvando || enviando} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-60">{salvando ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </DialogResponsivo>
  );
}
