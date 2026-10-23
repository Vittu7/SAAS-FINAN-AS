/**
 * Preferência "ocultar valores". Fica fora do React para que `brl()` (usado em todo o app)
 * mascare qualquer valor financeiro sem depender de cada componente.
 * A tela reage via useValoresOcultos (hooks/useValoresOcultos.ts).
 */
const CHAVE = "homecash:ocultar-valores";
export const MASCARA_VALOR = "R$ ••••";
export const MASCARA_PERCENTUAL = "••%";

let oculto = false;
let carregado = false;
const ouvintes = new Set<() => void>();

function carregar() {
  if (carregado || typeof window === "undefined") return;
  carregado = true;
  try {
    oculto = window.localStorage.getItem(CHAVE) === "1";
  } catch {
    /* armazenamento indisponível: segue visível só nesta sessão */
  }
}

export function valoresOcultos(): boolean {
  carregar();
  return oculto;
}

export function definirValoresOcultos(valor: boolean) {
  carregar();
  oculto = valor;
  try {
    window.localStorage.setItem(CHAVE, valor ? "1" : "0");
  } catch {
    /* ignora */
  }
  ouvintes.forEach((f) => f());
}

export function assinarValoresOcultos(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Texto de porcentagem derivada de valores (ex.: "% do limite"): mascarada quando os valores estão ocultos. */
export const percentual = (texto: string) => (valoresOcultos() ? MASCARA_PERCENTUAL : texto);
/** Largura de barras de progresso: zerada quando os valores estão ocultos (a proporção também revela valores). */
export const larguraBarra = (pct: number) => (valoresOcultos() ? 0 : pct);
