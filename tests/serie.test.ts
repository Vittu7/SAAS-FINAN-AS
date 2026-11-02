import { describe, it, expect } from "vitest";
import { idsDaSerieCartao, idsDaSerieConta } from "../src/lib/serie";

const parcela = (id: string, mes: string, atual: number, extra: any = {}) => ({ id, owner_id: "u", responsavel_id: "u", cartao: "Nubank", nome: "Tênis", parcela_atual: atual, parcela_total: 3, valor: 100, categoria: "Roupa", mes, ...extra });

describe("excluir de todos os meses", () => {
  it("compra parcelada: todas as parcelas, mesmo com valor editado, sem tocar em outra compra igual", () => {
    const todas = [
      parcela("a1", "2026-10", 1), parcela("a2", "2026-11", 2, { valor: 90 }), parcela("a3", "2026-12", 3),
      parcela("b1", "2026-12", 1), parcela("b2", "2027-01", 2), // outra compra com o mesmo nome
      parcela("o1", "2026-10", 1, { owner_id: "outro" }),
    ];
    expect(idsDaSerieCartao(todas, "a2").sort()).toEqual(["a1", "a2", "a3"]);
    expect(idsDaSerieCartao(todas, "b1").sort()).toEqual(["b1", "b2"]);
  });
  it("conta fixa: toda a série pelo serie_id; sem ele, pelos dados", () => {
    const fixa = (id: string, mes: string, extra: any = {}) => ({ id, owner_id: "u", responsavel_id: "u", nome: "Internet", forma_pagamento: "Pix", categoria: "Casa", valor: 100, mes, serie_id: "s1", ...extra });
    const todas = [fixa("1", "2026-10"), fixa("2", "2026-11", { valor: 120, nome: "Internet fibra" }), fixa("3", "2026-12"), fixa("x", "2026-12", { serie_id: "s2" })];
    expect(idsDaSerieConta(todas, "2").sort()).toEqual(["1", "2", "3"]);
    const antigas = [fixa("p", "2026-10", { serie_id: null }), fixa("q", "2026-11", { serie_id: null })];
    expect(idsDaSerieConta(antigas, "p").sort()).toEqual(["p", "q"]);
  });
});
