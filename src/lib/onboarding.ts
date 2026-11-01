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
  /** Etapas do guia que a pessoa escolheu pular (podem ser retomadas depois) */
  puladas: string[];
  /** Etapas sem sinal automático (ex.: aparência) que a pessoa já fez */
  feitas: string[];
};

const PADRAO: EstadoOnboarding = { boasVindas: false, guiaOculto: false, dicas: [], puladas: [], feitas: [] };

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
  const reiniciar = () => atualizar({ boasVindas: false, guiaOculto: false, dicas: [], puladas: [], feitas: [] });
  /** Pula UMA etapa do guia, sem abandonar o resto. */
  const pularEtapa = (id: string) => atualizar({ puladas: [...new Set([...(estado.puladas ?? []), id])] });
  const retomarEtapa = (id: string) => atualizar({ puladas: (estado.puladas ?? []).filter((x) => x !== id) });
  const marcarFeita = (id: string) => atualizar({ feitas: [...new Set([...(estado.feitas ?? []), id])], puladas: (estado.puladas ?? []).filter((x) => x !== id) });

  return { estado, pronto, atualizar, dispensarDica, reiniciar, pularEtapa, retomarEtapa, marcarFeita };
}
