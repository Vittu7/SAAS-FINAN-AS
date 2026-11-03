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

/** Conta criada há poucos dias = cadastro recente: o popup aparece mesmo que o Google já tenha trazido nome e foto. */
const DIAS_CONTA_NOVA = 7;
const contaRecente = (user: { created_at?: string | null }) => {
  const criada = user.created_at ? new Date(user.created_at).getTime() : NaN;
  return Number.isFinite(criada) && Date.now() - criada < DIAS_CONTA_NOVA * 24 * 60 * 60 * 1000;
};

/**
 * Logo após o cadastro: pede nome e foto. Aparece uma única vez por usuário e pode ser pulado.
 * O login é pelo Google, que já entrega nome e foto: por isso o popup NÃO depende mais de "não ter foto"
 * (antes, quem entrava pelo Google nunca via a tela). Ele aparece para contas novas, ou para quem segue sem foto.
 * `onDecidir` avisa a tela se o popup vai abrir (para mostrar o tour de boas-vindas só depois) e
 * `onFechar` avisa quando ele termina.
 */
export default function CompletarPerfilModal({ onDecidir, onFechar }: { onDecidir?: (abrir: boolean) => void; onFechar?: () => void } = {}) {
  const [aberto, setAberto] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const decidir = useRef(onDecidir); decidir.current = onDecidir;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!vivo) return;
      if (!data.user) return decidir.current?.(false);
      // Já concluiu neste aparelho OU em outro (a marca também fica nos dados da conta)
      if (lerDoUsuario(data.user.id, "perfil-etapa", { feito: false }).feito || data.user.user_metadata?.perfil_etapa_feita) return decidir.current?.(false);
      try {
        const perfil = await garantirPerfil(supabase as any, data.user);
        if (!vivo) return;
        if (!contaRecente(data.user) && perfil.avatar_url) {
          salvarDoUsuario(data.user.id, "perfil-etapa", { feito: true });
          return decidir.current?.(false);
        }
        setUser(data.user);
        setNome(perfil.nome_usuario || "");
        setAvatar(perfil.avatar_url || null); // foto que já veio do Google: a pessoa só confirma ou troca
        setAberto(true);
        decidir.current?.(true);
      } catch {
        /* sem perfil não há o que completar agora */
        if (vivo) decidir.current?.(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (!aberto || !user) return null;

  const concluir = () => {
    salvarDoUsuario(user.id, "perfil-etapa", { feito: true });
    void Promise.resolve(supabase.auth.updateUser({ data: { perfil_etapa_feita: true } })).catch(() => null); // vale em qualquer aparelho
    setAberto(false);
    onFechar?.();
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
        <p className="text-sm text-muted">Bem-vindo ao HomeCash! Escolha como quer ser chamado e uma foto. Assim sua família sabe quem lançou cada despesa. Você pode mudar isso depois em Configurações.</p>
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
