"use client";

import { useCallback, useState } from "react";

export const MODULOS_RASTREADOS = ["extrato", "lancamentos", "cartao", "contas", "fatura", "ajustes"] as const;
export type ModuloId = (typeof MODULOS_RASTREADOS)[number];

const LIMITE = 6;
const chave = (userId: string | null) => `homecash:modulos-recentes:${userId || "anonimo"}`;

function ler(userId: string | null): ModuloId[] {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(chave(userId)) || "[]");
    if (!Array.isArray(bruto)) return [];
    return bruto.filter((m): m is ModuloId => (MODULOS_RASTREADOS as readonly string[]).includes(m)).slice(0, LIMITE);
  } catch {
    return [];
  }
}

/** Módulos que o usuário abriu por último (por usuário, neste aparelho). Só guarda ids de módulos, nunca valores. */
export function useModulosRecentes(userId: string | null) {
  const [guardado, setGuardado] = useState<{ dono: string | null; lista: ModuloId[] }>({ dono: null, lista: [] });
  // Recarrega a lista quando muda o usuário (ajuste de estado durante a renderização)
  if (guardado.dono !== userId) setGuardado({ dono: userId, lista: userId ? ler(userId) : [] });
  const recentes = guardado.dono === userId ? guardado.lista : [];

  const registrar = useCallback(
    (id: string) => {
      if (!userId || !(MODULOS_RASTREADOS as readonly string[]).includes(id)) return;
      setGuardado((g) => {
        const proximo = [id as ModuloId, ...g.lista.filter((m) => m !== id)].slice(0, LIMITE);
        try {
          window.localStorage.setItem(chave(userId), JSON.stringify(proximo));
        } catch {
          /* sem armazenamento: mantém só nesta sessão */
        }
        return { dono: userId, lista: proximo };
      });
    },
    [userId],
  );

  return { recentes, registrar };
}
