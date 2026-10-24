import { describe, it, expect, afterEach } from "vitest";
import { brl, pct, definirValoresOcultos, MASCARA } from "../src/lib/finance";

afterEach(() => definirValoresOcultos(false));

describe("ocultar valores", () => {
  it("mostra normal por padrão", () => {
    expect(brl(1234.5)).toContain("1.234,50");
    expect(pct(37.4)).toBe("37%");
  });
  it("oculta dinheiro e porcentagens", () => {
    definirValoresOcultos(true);
    expect(brl(1234.5)).toBe(MASCARA);
    expect(pct(37.4)).toBe("••%");
  });
});
