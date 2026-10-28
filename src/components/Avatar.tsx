"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

/** Tamanhos padrão do sistema: use sempre estes nomes em vez de números soltos. */
export const TAMANHOS_AVATAR = { xs: 22, sm: 28, md: 40, lg: 56, xl: 96 } as const;
export type TamanhoAvatar = keyof typeof TAMANHOS_AVATAR | number;

type AvatarProps = {
  src?: string | null;
  nome?: string | null;
  cor?: string | null;
  tamanho?: TamanhoAvatar;
  /** Anel na cor da pessoa (ajuda a identificar quem é quem em listas) */
  anel?: boolean;
  className?: string;
};

const px = (t: TamanhoAvatar) => (typeof t === "number" ? t : TAMANHOS_AVATAR[t]);

/** Foto do perfil; se não houver (ou falhar ao carregar), mostra a inicial do nome na cor da pessoa. */
export default function Avatar({ src, nome, cor, tamanho = "md", anel = false, className = "" }: AvatarProps) {
  const [falhou, setFalhou] = useState(false);
  const t = px(tamanho);

  // Se a URL mudar (ex.: nova foto), tenta carregar de novo.
  useEffect(() => {
    setFalhou(false);
  }, [src]);

  const inicial = nome?.trim()?.[0]?.toUpperCase() || null;
  const mostrarImagem = !!src && !falhou;
  const corPessoa = cor || "#10B981";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${className}`}
      style={{
        width: t,
        height: t,
        fontSize: Math.max(9, Math.round(t * 0.42)),
        backgroundColor: mostrarImagem ? "transparent" : corPessoa,
        boxShadow: anel ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${corPessoa}` : undefined,
      }}
      role="img"
      aria-label={nome ? `Foto de ${nome}` : "Foto de perfil"}
    >
      {mostrarImagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src as string} alt="" className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      ) : inicial ? (
        inicial
      ) : (
        <UserRound size={Math.round(t * 0.55)} aria-hidden />
      )}
    </div>
  );
}

export type PessoaVisual = { nome: string; avatar?: string | null; cor?: string | null };

/** Várias pessoas sobrepostas (até 3, depois "+N"). */
export function AvatarPilha({ pessoas, tamanho = "sm" }: { pessoas: PessoaVisual[]; tamanho?: TamanhoAvatar }) {
  const t = px(tamanho);
  const vistas = pessoas.slice(0, 3);
  const resto = pessoas.length - vistas.length;
  return (
    <span className="inline-flex items-center" aria-label={pessoas.map((p) => p.nome).join(", ")}>
      {vistas.map((p, i) => (
        <span key={p.nome} style={{ marginLeft: i ? -t * 0.3 : 0 }} className="rounded-full ring-2 ring-[var(--surface)]">
          <Avatar src={p.avatar} nome={p.nome} cor={p.cor} tamanho={tamanho} />
        </span>
      ))}
      {resto > 0 && (
        <span style={{ width: t, height: t, marginLeft: -t * 0.3, fontSize: Math.max(9, t * 0.38) }} className="grid place-items-center rounded-full bg-background font-semibold text-muted ring-2 ring-[var(--surface)]">+{resto}</span>
      )}
    </span>
  );
}

/** Foto pequena + nome: o jeito padrão de mostrar "quem" em tabelas e listas. */
export function ResponsavelChip({ nome, avatar, cor, className = "" }: { nome?: string | null; avatar?: string | null; cor?: string | null; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-background py-0.5 pl-0.5 pr-2.5 text-xs font-medium ring-1 ring-line ${className}`}>
      <Avatar src={avatar} nome={nome} cor={cor} tamanho="xs" />
      <span className="truncate">{nome || "Membro"}</span>
    </span>
  );
}
