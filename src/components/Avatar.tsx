"use client";

import { useEffect, useState } from "react";

type AvatarProps = {
  src?: string | null;
  nome?: string | null;
  cor?: string | null;
  tamanho?: number;
  className?: string;
};

/** Foto do perfil; se não houver (ou falhar ao carregar), mostra a inicial do nome. */
export default function Avatar({ src, nome, cor, tamanho = 36, className = "" }: AvatarProps) {
  const [falhou, setFalhou] = useState(false);

  // Se a URL mudar (ex.: nova foto), tenta carregar de novo.
  useEffect(() => {
    setFalhou(false);
  }, [src]);

  const inicial = (nome?.trim()?.[0] || "?").toUpperCase();
  const mostrarImagem = !!src && !falhou;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${className}`}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.42),
        backgroundColor: mostrarImagem ? "transparent" : cor || "#10B981",
      }}
      aria-label={nome ? `Foto de ${nome}` : "Foto de perfil"}
    >
      {mostrarImagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFalhou(true)}
        />
      ) : (
        inicial
      )}
    </div>
  );
}
