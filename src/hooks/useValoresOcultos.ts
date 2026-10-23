"use client";

import { useSyncExternalStore } from "react";
import { assinarValoresOcultos, definirValoresOcultos, valoresOcultos } from "@/lib/privacidade";

/** Estado compartilhado de "ocultar valores". Chamar no topo da tela faz a árvore inteira se atualizar. */
export function useValoresOcultos() {
  const oculto = useSyncExternalStore(assinarValoresOcultos, valoresOcultos, () => false);
  return { oculto, alternar: () => definirValoresOcultos(!oculto), definir: definirValoresOcultos };
}
