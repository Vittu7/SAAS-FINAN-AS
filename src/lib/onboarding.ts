"use client";

import { useCallback, useEffect, useState } from "react";
import { lerDoUsuario, salvarDoUsuario } from "./usuarioStorage";

export type EstadoOnboarding = {
  /** Já viu a tela de boas-vindas */
  boasVindas: boolean;
  /** Ocultou o guia "Primeiros passos" da tela inicial */
  guiaOculto: boolean;
  /** Dicas de módulo que a pessoa já dispensou */
  dicas: string[];
};

const PADRAO: EstadoOnboarding = { boasVindas: false, guiaOculto: false, dicas: [] };

/** Estado de orientação do usuário atual (salvo só para ele). */
export function useOnboarding(userId: string | null) {
  const [estado, setEstado] = useState<EstadoOnboarding>(PADRAO);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setEstado(userId ? lerDoUsuario(userId, "onboarding", PADRAO) : PADRAO);
    setPronto(Boolean(userId));
  }, [userId]);

  const atualizar = useCallback(
    (patch: Partial<EstadoOnboarding>) =>
      setEstado((atual) => {
        const novo = { ...atual, ...patch };
        salvarDoUsuario(userId, "onboarding", novo);
        return novo;
      }),
    [userId],
  );

  const dispensarDica = (id: string) => atualizar({ dicas: [...new Set([...estado.dicas, id])] });
  const reiniciar = () => atualizar({ boasVindas: false, guiaOculto: false, dicas: [] });

  return { estado, pronto, atualizar, dispensarDica, reiniciar };
}
