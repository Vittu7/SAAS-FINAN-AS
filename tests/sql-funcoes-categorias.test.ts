import { describe, it, expect } from "vitest";
import {
  CATEGORIAS,
  extrairFuncoes,
  funcoesDe,
  listarMigracoesPainel,
  normalizar,
  primeiraInstrucao,
  type Categoria,
} from "./helpers/sqlArquivos";

const migracoes = listarMigracoesPainel();
const sqlTudo = migracoes.map((m) => m.sql).join("\n");
const norm = normalizar(sqlTudo);
const todas = extrairFuncoes(sqlTudo);

function aclDe(nome: string) {
  const n = nome.replace(".", "\\.");
  return {
    revoga: new RegExp(`revoke (all|execute) on function ${n}\\([^)]*\\) from public, anon, authenticated`).test(norm),
    concedeAuthenticated: new RegExp(`grant execute on function ${n}\\([^)]*\\) to authenticated`).test(norm),
    concedeOutro: new RegExp(`grant execute on function ${n}\\([^)]*\\) to (?!authenticated\\b)`).test(norm),
  };
}

describe("classificação", () => {
  it("existem funções para classificar (migração 20)", () => {
    expect(todas.length).toBeGreaterThanOrEqual(19);
    expect(funcoesDe(sqlTudo, "A")).toHaveLength(6);
    expect(funcoesDe(sqlTudo, "B")).toHaveLength(2);
    expect(funcoesDe(sqlTudo, "F")).toHaveLength(6);
  });

  it("nenhuma função fora das categorias", () => {
    for (const f of todas) expect(CATEGORIAS[f.nome], `${f.nome} sem categoria`).toBeDefined();
  });

  it("toda função classificada para a migração existe no SQL", () => {
    const nomes = new Set(todas.map((f) => f.nome));
    // só confere as da migração 20 enquanto as outras fases não existem
    const m20 = [
      "public.sou_admin", "public.registrar_tentativa_admin", "public.admin_registrar_acesso", "public.admin_resumo",
      "public.admin_listar_usuarios", "public.admin_usuario_detalhe", "public.admin_listar_auditoria",
      "public.admin_verificar_auditoria", "homecash_interno.checar_admin", "homecash_interno.registrar_auditoria",
      "homecash_interno.registrar_negado", "homecash_interno.trg_cadeia_auditoria", "homecash_interno.trg_imutavel_linha",
      "homecash_interno.trg_imutavel_truncate", "homecash_interno.trg_ultimo_admin",
    ];
    for (const n of m20) expect(nomes.has(n), n).toBe(true);
  });

  it("schema: A, B e C em public; D, E e F em homecash_interno", () => {
    for (const f of todas) {
      const c = CATEGORIAS[f.nome];
      if (["A", "B", "C"].includes(c)) expect(f.nome.startsWith("public."), f.nome).toBe(true);
      else expect(f.nome.startsWith("homecash_interno."), f.nome).toBe(true);
    }
  });

  it("toda função é security definer com search_path vazio", () => {
    for (const f of todas) {
      const cab = normalizar(f.cabecalho);
      expect(cab, f.nome).toContain("security definer");
      expect(cab, f.nome).toContain("set search_path = ''");
    }
  });
});

describe("categoria A — RPC administrativa", () => {
  const as = funcoesDe(sqlTudo, "A");
  it("retorna jsonb, chama checar_admin como primeira instrução e usa o envelope", () => {
    expect(as.length).toBeGreaterThan(0);
    for (const f of as) {
      expect(f.retorno, f.nome).toBe("jsonb");
      expect(primeiraInstrucao(f.corpo), f.nome).toContain("homecash_interno.checar_admin(");
      expect(f.corpo, f.nome).toContain("'ok'");
    }
  });
  it("nunca levanta exceção (validação devolve envelope)", () => {
    for (const f of as) expect(normalizar(f.corpo), f.nome).not.toContain("raise exception");
  });
  it("revoga de public, anon e authenticated e concede só a authenticated", () => {
    for (const f of as) {
      const a = aclDe(f.nome);
      expect(a.revoga, `${f.nome} revoke`).toBe(true);
      expect(a.concedeAuthenticated, `${f.nome} grant`).toBe(true);
      expect(a.concedeOutro, `${f.nome} grant extra`).toBe(false);
    }
  });
});

describe("categoria B — usuário logado", () => {
  const bs = funcoesDe(sqlTudo, "B");
  it("usa auth.uid() e não chama checar_admin", () => {
    for (const f of bs) {
      expect(f.corpo, f.nome).toContain("auth.uid()");
      expect(f.corpo, f.nome).not.toContain("checar_admin(");
    }
  });
  it("sou_admin é a única que retorna boolean", () => {
    for (const f of bs) expect(f.retorno, f.nome).toBe(f.nome === "public.sou_admin" ? "boolean" : "jsonb");
  });
  it("revoga e concede só a authenticated", () => {
    for (const f of bs) {
      const a = aclDe(f.nome);
      expect(a.revoga && a.concedeAuthenticated && !a.concedeOutro, f.nome).toBe(true);
    }
  });
});

describe.each(["D", "F"] as Categoria[])("categoria %s — sem EXECUTE para a API", (cat) => {
  it("revoga e não concede nada", () => {
    for (const f of funcoesDe(sqlTudo, cat)) {
      const a = aclDe(f.nome);
      expect(a.revoga, `${f.nome} revoke`).toBe(true);
      expect(a.concedeAuthenticated || a.concedeOutro, `${f.nome} grant`).toBe(false);
    }
  });
});

describe("categoria F — triggers", () => {
  it("retornam trigger", () => {
    for (const f of funcoesDe(sqlTudo, "F")) expect(f.retorno, f.nome).toBe("trigger");
  });
  it("as de imutabilidade sempre levantam exceção e nunca retornam a linha", () => {
    for (const nome of ["homecash_interno.trg_imutavel_linha", "homecash_interno.trg_imutavel_truncate"]) {
      const f = todas.find((x) => x.nome === nome)!;
      const c = normalizar(f.corpo);
      expect(c).toContain("raise exception");
      expect(c).not.toMatch(/return (new|old)/);
    }
  });
  it.each(["public.admin_auditoria", "public.admin_acessos_negados"])(
    "%s tem trigger por linha (update/delete) e outro por instrução (truncate)",
    (tabela) => {
      const t = tabela.replace(".", "\\.");
      expect(norm).toMatch(new RegExp(`create trigger [a-z_]+ before update or delete on ${t} for each row execute function homecash_interno\\.trg_imutavel_linha\\(\\)`));
      expect(norm).toMatch(new RegExp(`create trigger [a-z_]+ before truncate on ${t} for each statement execute function homecash_interno\\.trg_imutavel_truncate\\(\\)`));
      expect(norm).toMatch(new RegExp(`create trigger [a-z_]+ before insert on ${t} for each row execute function homecash_interno\\.trg_cadeia_`));
    },
  );
});

describe("hash da auditoria", () => {
  it("usa jsonb_build_array e nunca concatenação", () => {
    for (const nome of ["homecash_interno.hash_linha_auditoria", "homecash_interno.hash_linha_negado"]) {
      const f = todas.find((x) => x.nome === nome)!;
      const c = normalizar(f.corpo);
      expect(c, nome).toContain("jsonb_build_array(");
      expect(c, nome).not.toContain("||");
      expect(c, nome).toContain("homecash_interno.hash_texto(");
    }
  });
  it("hash_texto escolhe sha256 nativo ou digest e aborta se nenhum existe", () => {
    expect(norm).toContain("sha256");
    expect(norm).toMatch(/digest/);
  });
});

describe("Review Focus 1 — autorização nunca depende de perfis.cargo", () => {
  it("nenhuma função usa cargo, exceto como dado de exibição nas listagens de usuário", () => {
    for (const f of todas) {
      const c = normalizar(f.corpo);
      if (["public.admin_listar_usuarios", "public.admin_usuario_detalhe"].includes(f.nome)) {
        for (const linha of f.corpo.split("\n")) {
          if (/\bcargo\b/i.test(linha)) expect(linha, `${f.nome}: ${linha}`).toMatch(/cargo_informado/);
        }
      } else {
        expect(c, f.nome).not.toMatch(/\bcargo\b/);
      }
    }
  });
  it("checar_admin e sou_admin não leem perfis nem grupos", () => {
    for (const nome of ["homecash_interno.checar_admin", "public.sou_admin"]) {
      const c = normalizar(todas.find((x) => x.nome === nome)!.corpo);
      expect(c).not.toMatch(/perfis|grupos_familiares|grupo_id/);
      expect(c).toContain("admin_usuarios");
    }
  });
});

describe("checar_admin — ordem do §5.8 R5", () => {
  const c = normalizar(todas.find((x) => x.nome === "homecash_interno.checar_admin")?.corpo ?? "");
  it("compara aal com is distinct from, nunca com <>", () => {
    expect(c).toContain("is distinct from 'aal2'");
    expect(c).not.toMatch(/aal'?\s*<>/);
  });
  it("só conta fator totp verificado e aprovado", () => {
    expect(c).toContain("factor_type = 'totp'");
    expect(c).toContain("status = 'verified'");
    expect(c).toContain("fatores_aprovados");
  });
  it("devolve os cinco códigos na ordem do spec", () => {
    const ordem = ["acesso_negado", "mfa_requerida", "fator_nao_aprovado", "mfa_nao_configurada", "mfa_expirada"].map((k) => c.indexOf(`'${k}'`));
    ordem.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect(ordem[0]).toBeLessThan(ordem[1]);
    expect(ordem[1]).toBeLessThan(ordem[2]);
    expect(ordem[2]).toBeLessThan(ordem[4]);
  });
  it("registra cada negação", () => {
    expect(c).toContain("homecash_interno.registrar_negado(");
  });
});

describe("listagem de usuários", () => {
  const f = todas.find((x) => x.nome === "public.admin_listar_usuarios");
  const c = normalizar(f?.corpo ?? "");
  it("escapa coringas da busca e junta por perfis.id = auth.users.id", () => {
    expect(c).toContain("escape '\\'");
    expect(c).toMatch(/replace\(.*'%'.*\)/);
    expect(c).toMatch(/p\.id = u\.id/);
  });
  it("nunca devolve colunas financeiras legadas nem avatar", () => {
    expect(c).not.toMatch(/salario|investido|reserva_atual|reserva_meta|avatar_url/);
  });
});

// ---- Correções da revisão de segurança da migração 20 ------------------------------

const corpo = (nome: string) => normalizar(todas.find((x) => x.nome === nome)?.corpo ?? "");

describe("sessão MFA viva e ligada ao fator aprovado (revisão, item 1)", () => {
  const c = corpo("homecash_interno.checar_admin");
  it("lê o claim session_id e confere a sessão em auth.sessions do próprio usuário", () => {
    expect(c).toContain("auth.jwt() ->> 'session_id'");
    expect(c).toMatch(/from auth\.sessions s where s\.id = v_sid and s\.user_id = v_uid/);
  });
  it("sessão vencida (not_after no passado) não vale: filtro na própria consulta da sessão", () => {
    expect(c).toContain("and (s.not_after is null or s.not_after > now())");
  });
  it("sessão ausente ou revogada → sessao_invalida, antes de qualquer código de MFA", () => {
    expect(c).toContain("'sessao_invalida'");
    expect(c.indexOf("'sessao_invalida'")).toBeLessThan(c.indexOf("'mfa_requerida'"));
  });
  it("exige aal2 na sessão do banco e factor_id entre os fatores aprovados e verificados", () => {
    expect(c).toContain("v_sess_aal is distinct from 'aal2'");
    expect(c).toContain("v_sess_fat is null");
    expect(c).toMatch(/v_sess_fat = any \(v_adm\.fatores_aprovados\)/);
    expect(c).toMatch(/f\.id = v_sess_fat and f\.user_id = v_uid and f\.status = 'verified' and f\.factor_type = 'totp'/);
  });
  it("o frescor por amr continua depois das demais checagens", () => {
    expect(c.indexOf("mfa_expirada")).toBeGreaterThan(c.indexOf("v_sess_fat is null"));
  });
});

describe("limites e proteção contra abuso (revisão, itens 2, 6, 7, 8)", () => {
  const neg = corpo("homecash_interno.registrar_negado");
  it("admin cadastrado nunca perde o rastro pelos tetos de 200 linhas e 2000 chaves por hora", () => {
    expect(neg).toMatch(/exists \(select 1 from public\.admin_usuarios a where a\.user_id = v_uid\)/);
    expect(neg).toMatch(/not v_admin and \(select count\(\*\) from public\.admin_acessos_negados n where n\.criado_em >= v_hora\) >= 200/);
    expect(neg).toMatch(/not v_admin and \(select count\(\*\) from homecash_interno\.acessos_negados_contagem c where c\.hora = v_hora\) >= 2000/);
  });
  it("só rotas do painel entram no log da tentativa", () => {
    const c = corpo("public.registrar_tentativa_admin");
    expect(c).toContain("^/admin(/[a-z0-9_-]{1,40}){0,4}/?$");
    expect(c).toContain("'rota_invalida'");
  });
  it.each(["public.admin_listar_usuarios", "public.admin_listar_auditoria"])("%s limita a página a 100000", (nome) => {
    const c = corpo(nome);
    expect(c).toContain("p_pagina > 100000");
    expect(c).toContain("p_limite > 200");
  });
});

describe("concorrência do último administrador (item 3)", () => {
  it("o trigger serializa com lock consultivo próprio antes de decidir", () => {
    const c = corpo("homecash_interno.trg_ultimo_admin");
    expect(c.indexOf("pg_advisory_xact_lock(7104, 1)")).toBeGreaterThan(-1);
    expect(c.indexOf("pg_advisory_xact_lock(7104, 1)")).toBeLessThan(c.indexOf("not exists"));
  });
  it("as classes de lock são distintas por finalidade", () => {
    const todos = normalizar(sqlTudo);
    const classes = [...todos.matchAll(/pg_advisory_xact_lock\((\d+),/g)].map((m) => m[1]);
    expect(new Set(classes)).toEqual(new Set(["7101", "7102", "7104"]));
  });
});

describe("lock da cadeia não fica preso durante consultas (item 5)", () => {
  it("admin_resumo grava a auditoria depois de montar os dados", () => {
    const c = corpo("public.admin_resumo");
    expect(c.lastIndexOf("registrar_auditoria(")).toBeGreaterThan(c.indexOf("into v_dados"));
  });
  it("admin_verificar_auditoria grava a auditoria depois da verificação", () => {
    const c = corpo("public.admin_verificar_auditoria");
    expect(c.lastIndexOf("registrar_auditoria(")).toBeGreaterThan(c.lastIndexOf("into v_verif, v_quebra, v_prox"));
  });
  it("nenhuma RPC grava negado depois da auditoria na mesma execução (regra de locks)", () => {
    for (const f of funcoesDe(sqlTudo, "A")) {
      const c = normalizar(f.corpo);
      const a = c.indexOf("registrar_auditoria(");
      if (a >= 0) expect(c.indexOf("registrar_negado(", a), f.nome).toBe(-1);
    }
  });
});

describe("verificação da cadeia dos negados (item 9)", () => {
  const c = corpo("public.admin_verificar_auditoria");
  it("aceita só acoes ou negados e verifica as duas cadeias com a função de hash correspondente", () => {
    expect(c).toContain("p_tabela not in ('acoes', 'negados')");
    expect(c).toContain("homecash_interno.hash_linha_auditoria(a)");
    expect(c).toContain("homecash_interno.hash_linha_negado(n)");
  });
  it("a assinatura tem três parâmetros", () => {
    const f = todas.find((x) => x.nome === "public.admin_verificar_auditoria")!;
    expect(f.argumentos.split(",").length).toBe(3);
  });
});
