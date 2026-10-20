import { describe, expect, it } from "vitest";
import { arred2, dataBR, metaAtingida, progressoCaixinha, rotuloLocal, sugestoesDoMes, sugestoesRendimento, totalRendimentos, type Caixinha, type Movimento } from "../src/lib/caixinhas";

const base: Caixinha = {
  id: "1", nome: "Viagem", ehReserva: false, rendimento: "", meta: 1000, saldo: 250,
  aporteAutoAtivo: true, aporteAutoValor: 100, ultimoMesAuto: "2026-09", exibirNaHome: false, cor: "#10B981",
  banco: "Nubank", tipoRendimento: "cdb", ultimoMesRendimento: "2026-09",
};

describe("caixinhas", () => {
  it("calcula o progresso limitado a 100% e 0 sem meta", () => {
    expect(progressoCaixinha(base)).toBe(25);
    expect(progressoCaixinha({ saldo: 5000, meta: 1000 })).toBe(100);
    expect(progressoCaixinha({ saldo: 50, meta: 0 })).toBe(0);
  });

  it("detecta meta atingida só quando há meta", () => {
    expect(metaAtingida({ saldo: 1000, meta: 1000 })).toBe(true);
    expect(metaAtingida({ saldo: 10, meta: 0 })).toBe(false);
  });

  it("sugere aporte automático no mês seguinte ao último tratado", () => {
    expect(sugestoesDoMes([base], "2026-10")).toHaveLength(1);
    expect(sugestoesDoMes([{ ...base, ultimoMesAuto: "2026-10" }], "2026-10")).toHaveLength(0);
    expect(sugestoesDoMes([{ ...base, aporteAutoAtivo: false }], "2026-10")).toHaveLength(0);
    expect(sugestoesDoMes([{ ...base, aporteAutoValor: 0 }], "2026-10")).toHaveLength(0);
    expect(sugestoesDoMes([{ ...base, ultimoMesAuto: null }], "2026-10")).toHaveLength(1);
  });

  it("formata datas e arredonda centavos", () => {
    expect(dataBR("2026-10-05")).toBe("05/10/2026");
    expect(arred2(0.1 + 0.2)).toBe(0.3);
  });

  it("lembra de registrar o rendimento só no mês seguinte e só com saldo", () => {
    expect(sugestoesRendimento([base], "2026-10")).toHaveLength(1);
    expect(sugestoesRendimento([base], "2026-09")).toHaveLength(0);
    expect(sugestoesRendimento([{ ...base, saldo: 0 }], "2026-10")).toHaveLength(0);
    expect(sugestoesRendimento([{ ...base, ultimoMesRendimento: null }], "2026-10")).toHaveLength(0);
  });

  it("soma rendimentos por caixinha e monta o rótulo do local", () => {
    const mov = (id: string, caixinhaId: string, tipo: Movimento["tipo"], valor: number): Movimento => ({
      id, caixinhaId, tipo, valor, data: "2026-10-01", descricao: "", origem: "manual",
    });
    const lista = [mov("a", "1", "rendimento", 10.1), mov("b", "1", "aporte", 500), mov("c", "2", "rendimento", 5.2)];
    expect(totalRendimentos(lista, "1")).toBe(10.1);
    expect(totalRendimentos(lista)).toBe(15.3);
    expect(rotuloLocal(base)).toBe("CDB · Nubank");
    expect(rotuloLocal({ banco: "", tipoRendimento: null })).toBe("");
  });
});
