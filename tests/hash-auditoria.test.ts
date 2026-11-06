import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  ZEROS, encadear, hashLinha, jsonbTexto, serializarLinha, verificarPagina, verificarTudo,
  type LinhaAuditoria,
} from "./helpers/hashAuditoria";

const base = {
  id: 1, admin_id: null, admin_email: null, acao: "admin_usuarios_insert", alvo_user_id: "11111111-1111-1111-1111-111111111111",
  alvo_email: null, recurso: "admin_usuarios", linhas: null, motivo: null, sessao_suporte: null,
  criado_em: "2026-11-05T12:00:00.000000", parametros: { ativo: true },
};

function cadeiaDe(n: number): LinhaAuditoria[] {
  const out: LinhaAuditoria[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(encadear(out[i - 2] ?? null, { ...base, id: i, acao: `acao_${i}`, parametros: { n: i } }));
  }
  return out;
}

describe("serialização", () => {
  it("vetor conhecido: texto e sha256 da primeira linha", () => {
    const l = encadear(null, base);
    const texto =
      '["v1", 1, "' + ZEROS + '", 1, null, null, "admin_usuarios_insert", "11111111-1111-1111-1111-111111111111", ' +
      'null, "admin_usuarios", null, null, null, "2026-11-05T12:00:00.000000", {"ativo": true}]';
    expect(serializarLinha(l)).toBe(texto);
    expect(l.hash).toBe(createHash("sha256").update(texto, "utf8").digest("hex"));
    expect(l.hash).toHaveLength(64);
  });

  it("admin_id nulo (insert no SQL Editor) é preservado como null e a linha tem hash", () => {
    const l = encadear(null, { ...base, admin_id: null });
    expect(serializarLinha(l)).toContain(", null, null, ");
    expect(l.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("barra vertical e aspas dentro do motivo não deslocam os campos", () => {
    const a = encadear(null, { ...base, motivo: 'a|b"c', recurso: "x" });
    const b = encadear(null, { ...base, motivo: 'a', recurso: 'b"c|x' });
    expect(a.hash).not.toBe(b.hash);
    expect(serializarLinha(a)).toContain('"a|b\\"c"');
  });

  it("chaves de jsonb saem ordenadas por tamanho e depois por bytes", () => {
    expect(jsonbTexto({ bb: 1, a: 2, ab: 3, z: [1, null] })).toBe('{"a": 2, "z": [1, null], "ab": 3, "bb": 1}');
  });

  it("mudar um campo muda o hash", () => {
    expect(hashLinha(encadear(null, base))).not.toBe(hashLinha(encadear(null, { ...base, linhas: 2 })));
  });
});

describe("cadeia", () => {
  it("ordem sem repetição nem salto verifica", () => {
    const r = verificarTudo(cadeiaDe(12));
    expect(r).toEqual({ verificadas: 12, primeiraQuebra: null, proxima: null });
  });

  it("duas linhas com a mesma ordem são detectadas", () => {
    const c = cadeiaDe(5);
    c.push({ ...c[2] });
    expect(verificarTudo(c).primeiraQuebra).not.toBeNull();
  });

  it("salto de ordem é detectado", () => {
    const c = cadeiaDe(6).filter((l) => l.ordem !== 3);
    expect(verificarTudo(c).primeiraQuebra).toBe(4);
  });

  it("alterar um campo do meio devolve a ordem correta", () => {
    const c = cadeiaDe(8);
    c[4] = { ...c[4], motivo: "adulterado" };
    expect(verificarTudo(c).primeiraQuebra).toBe(5);
  });

  it("apagar a última linha não quebra a cadeia (limite documentado: usar a cabeça)", () => {
    const c = cadeiaDe(8).slice(0, 7);
    expect(verificarTudo(c).primeiraQuebra).toBeNull();
  });

  it("páginas encadeadas dão o mesmo resultado da verificação inteira", () => {
    const c = cadeiaDe(23);
    expect(verificarTudo(c, 5)).toEqual(verificarTudo(c, 5000));
    const adulterada = cadeiaDe(23);
    adulterada[15] = { ...adulterada[15], acao: "x" };
    expect(verificarTudo(adulterada, 5).primeiraQuebra).toBe(16);
    expect(verificarTudo(adulterada, 5000).primeiraQuebra).toBe(16);
  });

  it("a primeira linha de uma página é encadeada com a linha anterior", () => {
    const c = cadeiaDe(10);
    expect(verificarPagina(c, 6, 5)).toEqual({ verificadas: 5, primeiraQuebra: null, proxima: null });
    c[5] = { ...c[5], hash_anterior: ZEROS };
    expect(verificarPagina(c, 6, 5).primeiraQuebra).toBe(6);
  });

  it("linha com admin_id nulo entra na cadeia e verifica", () => {
    const c = [encadear(null, base), encadear(null, base)];
    const l1 = encadear(null, { ...base, admin_id: null });
    const l2 = encadear(l1, { ...base, id: 2, admin_id: "22222222-2222-2222-2222-222222222222" });
    expect(verificarTudo([l1, l2]).primeiraQuebra).toBeNull();
    expect(c).toHaveLength(2);
  });
});
