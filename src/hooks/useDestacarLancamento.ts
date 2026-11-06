"use client";

import { useEffect } from "react";
import { avisos } from "@/lib/avisos";

export type FocoLancamento = { tabela: "extrato" | "cartao" | "contas"; id: string; mes: string; n: number };

const CLASSE = "lanc-destaque";
const TENTATIVAS = 30; // 30 x 100 ms: dá tempo de a aba e o mês renderizarem
const DURACAO_MS = 4500;

/**
 * Depois de navegar até a aba/mês do lançamento, rola até a linha (marcada com data-lanc-id) e a destaca por alguns
 * segundos. A tabela do computador e a lista do celular existem juntas no HTML: vale a que está visível.
 */
export function useDestacarLancamento(foco: FocoLancamento | null, aoTerminar: () => void) {
  useEffect(() => {
    if (!foco) return;
    let tentativa = 0;
    let removerTimer: ReturnType<typeof setTimeout> | undefined;
    let el: HTMLElement | null = null;

    const procurar = setInterval(() => {
      tentativa += 1;
      const candidatos = document.querySelectorAll<HTMLElement>(`[data-lanc-id="${CSS.escape(foco.id)}"]`);
      el = Array.from(candidatos).find((c) => c.offsetParent !== null) ?? null;
      if (el) {
        clearInterval(procurar);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(CLASSE);
        removerTimer = setTimeout(() => {
          el?.classList.remove(CLASSE);
          aoTerminar();
        }, DURACAO_MS);
      } else if (tentativa >= TENTATIVAS) {
        clearInterval(procurar);
        avisos.aviso("Não encontrei o lançamento na tela", "Ele pode estar oculto por algum filtro. Confira o mês e os filtros.");
        aoTerminar();
      }
    }, 100);

    return () => {
      clearInterval(procurar);
      if (removerTimer) clearTimeout(removerTimer);
      el?.classList.remove(CLASSE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);
}
