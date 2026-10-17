"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Perfil agora vive dentro da Central de Configurações. */
export default function PerfilPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?aba=ajustes&secao=perfil");
  }, [router]);
  return <main className="grid min-h-screen place-items-center text-sm text-muted">Abrindo configurações...</main>;
}
