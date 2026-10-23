/**
 * TESTES DE ISOLAMENTO E PERMISSÕES (RLS) — executam requisições REAIS contra o Supabase,
 * exatamente como um atacante faria com a chave anon + login (sem passar pela interface).
 *
 * REGRAS DE SEGURANÇA DESTE ARQUIVO
 *  - Use um projeto/branch Supabase de TESTE e 3 contas FICTÍCIAS dedicadas. Os testes escrevem,
 *    alteram e apagam dados dessas contas. NUNCA aponte para contas de pessoas reais.
 *  - Só roda com RLS_CONFIRMA_AMBIENTE_DE_TESTE=sim (ver .env.example).
 *
 * PERSONAS
 *  A = gestor do grupo A (dono dos dados de teste)
 *  B = usuário de OUTRO grupo / fora do grupo A (atacante externo)
 *  C = membro (não gestor) do grupo A, que entra no grupo pelo mesmo fluxo do app
 *
 * COMO LER OS RESULTADOS
 *  Cada `it` descreve o comportamento SEGURO esperado. Teste vermelho = vulnerabilidade
 *  (ou regra de negócio diferente da assumida — as assumidas estão marcadas "(regra assumida)").
 *
 * OBS: o setup usa as mesmas chamadas que o frontend faz hoje (criar grupo, entrar no grupo).
 *  Se esses fluxos migrarem para RPCs, ajuste apenas `prepararGrupos()`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = process.env;
const habilitado =
  env.RLS_CONFIRMA_AMBIENTE_DE_TESTE === "sim" &&
  !!env.RLS_SUPABASE_URL &&
  !!env.RLS_SUPABASE_ANON_KEY &&
  !!env.RLS_USER_A_EMAIL && !!env.RLS_USER_A_PASSWORD &&
  !!env.RLS_USER_B_EMAIL && !!env.RLS_USER_B_PASSWORD &&
  !!env.RLS_USER_C_EMAIL && !!env.RLS_USER_C_PASSWORD;

const MARCA = `RLS-TESTE-${Date.now()}`;
const MES = "2026-10";

type Sessao = { db: SupabaseClient; id: string };
type Resultado = { data: unknown; error: unknown };

function novoCliente(): SupabaseClient {
  return createClient(env.RLS_SUPABASE_URL!, env.RLS_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function entrar(email: string, senha: string): Promise<Sessao> {
  const db = novoCliente();
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) throw new Error(`Login de teste falhou (${email}): ${error?.message}`);
  return { db, id: data.user.id };
}

/** "Negado" = erro explícito OU nenhuma linha afetada/retornada. */
function negado(r: Resultado): boolean {
  if (r.error) return true;
  if (Array.isArray(r.data)) return r.data.length === 0;
  return r.data == null;
}

let A: Sessao, B: Sessao, C: Sessao;
let anon: SupabaseClient;
let grupoA = "";
let grupoB = "";

type Fixture = { tabela: string; chave: string; valor: string; patch: Record<string, unknown> };
const fixtures: Fixture[] = [];
const idsExtratoA: { aberto?: string; privado?: string } = {};
let caixinhaA = "";
let caixinhaB = "";

function exigir<T>(r: { data: T; error: unknown }, quando: string): NonNullable<T> {
  if (r.error || r.data == null) throw new Error(`Setup falhou (${quando}): ${JSON.stringify(r.error)}`);
  return r.data as NonNullable<T>;
}

async function garantirPerfil(s: Sessao, nome: string, cor: string) {
  const { data } = await s.db.from("perfis").select("id, grupo_id, cargo").eq("user_id", s.id).maybeSingle();
  if (data) return data;
  const r = await s.db
    .from("perfis")
    .upsert([{ id: s.id, user_id: s.id, nome_usuario: nome, cargo: "membro", cor }])
    .select("id, grupo_id, cargo")
    .single();
  return exigir(r, `criar perfil de ${nome}`);
}

async function prepararGrupos() {
  await garantirPerfil(A, `${MARCA}-A`, "#10B981");
  await garantirPerfil(B, `${MARCA}-B`, "#10B981");
  await garantirPerfil(C, `${MARCA}-C`, "#10B981");

  // A cria o grupo A (mesmo fluxo do app)
  const gA = exigir(await A.db.from("grupos_familiares").insert([{ nome: `${MARCA}-grupoA` }]).select().single(), "criar grupo A");
  grupoA = gA.id as string;
  exigir(
    await A.db.from("perfis").update({ grupo_id: grupoA, cargo: "gestor" }).eq("id", A.id).select().single(),
    "A vira gestor",
  );

  // B cria o grupo B (usuário de outro grupo)
  const gB = exigir(await B.db.from("grupos_familiares").insert([{ nome: `${MARCA}-grupoB` }]).select().single(), "criar grupo B");
  grupoB = gB.id as string;
  exigir(
    await B.db.from("perfis").update({ grupo_id: grupoB, cargo: "gestor" }).eq("id", B.id).select().single(),
    "B vira gestor",
  );

  // C entra no grupo A pelo mesmo fluxo do app (upsert do próprio perfil com grupo_id).
  // Nota: se o banco já exigir convite/RPC, adapte esta etapa.
  exigir(
    await C.db
      .from("perfis")
      .upsert({ id: C.id, user_id: C.id, nome_usuario: `${MARCA}-C`, grupo_id: grupoA, cargo: "membro", cor: "#6366F1" })
      .select()
      .single(),
    "C entra no grupo A",
  );
}

async function criarFixtures() {
  // extrato (aberto ao grupo) e extrato privado
  const base = { owner_id: A.id, usuario_id: A.id, grupo_id: grupoA, responsavel_id: A.id, mes: MES, pagamento: "Pix", categoria: "Teste" };
  const ex1 = exigir(await A.db.from("extrato").insert([{ ...base, valor: 10, descricao: `${MARCA}-extrato`, privado: false, compartilhado_com: null }]).select().single(), "extrato");
  const ex2 = exigir(await A.db.from("extrato").insert([{ ...base, valor: 20, descricao: `${MARCA}-extrato-privado`, privado: true, compartilhado_com: null }]).select().single(), "extrato privado");
  idsExtratoA.aberto = ex1.id as string;
  idsExtratoA.privado = ex2.id as string;
  fixtures.push({ tabela: "extrato", chave: "id", valor: idsExtratoA.aberto, patch: { valor: 999.99 } });

  const ct = exigir(
    await A.db.from("cartao").insert([{ owner_id: A.id, usuario_id: A.id, grupo_id: grupoA, responsavel_id: A.id, mes: MES, nome: `${MARCA}-cartao`, cartao: "Teste", parcela_atual: 1, parcela_total: 1, categoria: "Teste", valor: 30, privado: false, compartilhado_com: null }]).select().single(),
    "cartao",
  );
  fixtures.push({ tabela: "cartao", chave: "id", valor: ct.id as string, patch: { valor: 999.99 } });

  const cf = exigir(
    await A.db.from("contas_fixas").insert([{ owner_id: A.id, grupo_id: grupoA, responsavel_id: A.id, serie_id: crypto.randomUUID(), mes: MES, nome: `${MARCA}-conta`, pago: false, valor: 40, forma_pagamento: null, categoria: null, compartilhado_com: null, vencimento: null }]).select().single(),
    "contas_fixas",
  );
  fixtures.push({ tabela: "contas_fixas", chave: "id", valor: cf.id as string, patch: { valor: 999.99 } });

  // configuracoes (1 por usuário): cria ou atualiza como o app faz
  const { data: cfg } = await A.db.from("configuracoes").select("user_id").eq("user_id", A.id).maybeSingle();
  const cfgR = cfg
    ? await A.db.from("configuracoes").update({ salario: 1234 }).eq("user_id", A.id).select().single()
    : await A.db.from("configuracoes").insert({ user_id: A.id, salario: 1234, investido: 0, reserva_atual: 0, reserva_meta: 0 }).select().single();
  exigir(cfgR, "configuracoes");
  fixtures.push({ tabela: "configuracoes", chave: "user_id", valor: A.id, patch: { salario: 999999 } });

  exigir(await A.db.from("preferencias_dashboard").upsert({ user_id: A.id, preferencias: { marca: MARCA } }, { onConflict: "user_id" }).select().single(), "preferencias");
  fixtures.push({ tabela: "preferencias_dashboard", chave: "user_id", valor: A.id, patch: { preferencias: { hack: true } } });

  const ap = exigir(await A.db.from("aportes_investimento").insert({ user_id: A.id, valor: 50 }).select("id").single(), "aporte");
  fixtures.push({ tabela: "aportes_investimento", chave: "id", valor: ap.id as string, patch: { valor: 999.99 } });

  const novaCaixinha = (uid: string, nome: string) => ({ user_id: uid, nome, eh_reserva_emergencia: false, rendimento: null, meta: 1000, aporte_auto_ativo: false, aporte_auto_valor: 0, exibir_na_home: true, cor: "#3b82f6", banco: null, tipo_rendimento: null, ultimo_mes_auto: MES, ultimo_mes_rendimento: MES });
  const cxA = exigir(await A.db.from("caixinhas").insert(novaCaixinha(A.id, `${MARCA}-caixinhaA`)).select("id").single(), "caixinha A");
  caixinhaA = cxA.id as string;
  fixtures.push({ tabela: "caixinhas", chave: "id", valor: caixinhaA, patch: { nome: "HACK" } });
  const cxB = exigir(await B.db.from("caixinhas").insert(novaCaixinha(B.id, `${MARCA}-caixinhaB`)).select("id").single(), "caixinha B");
  caixinhaB = cxB.id as string;

  const mv = exigir(
    await A.db.from("caixinha_movimentos").insert({ user_id: A.id, caixinha_id: caixinhaA, tipo: "aporte", valor: 100, data: "2026-10-21", descricao: `${MARCA}-mov`, origem: "manual" }).select("id").single(),
    "movimento",
  );
  fixtures.push({ tabela: "caixinha_movimentos", chave: "id", valor: mv.id as string, patch: { valor: 999.99 } });

  const op = exigir(await A.db.from("opcoes_pagamento").insert({ user_id: A.id, grupo_id: grupoA, nome: `${MARCA}-forma`, cor: "#111111", eh_cartao: false, limite: 0 }).select("id").single(), "opcao pagamento");
  fixtures.push({ tabela: "opcoes_pagamento", chave: "id", valor: op.id as string, patch: { nome: "HACK" } });
  const oc = exigir(await A.db.from("opcoes_categoria").insert({ user_id: A.id, grupo_id: grupoA, nome: `${MARCA}-cat`, cor: "#222222" }).select("id").single(), "opcao categoria");
  fixtures.push({ tabela: "opcoes_categoria", chave: "id", valor: oc.id as string, patch: { nome: "HACK" } });
}

const TABELAS_DADOS = [
  "extrato", "cartao", "contas_fixas", "configuracoes", "preferencias_dashboard",
  "aportes_investimento", "caixinhas", "caixinha_movimentos", "opcoes_pagamento",
  "opcoes_categoria", "perfis", "grupos_familiares",
];

async function limpar() {
  const tentar = async (p: PromiseLike<unknown>) => { try { await p; } catch { /* limpeza é best-effort */ } };
  const alvos: [tabela: string, coluna: string][] = [
    ["caixinha_movimentos", "descricao"], ["caixinhas", "nome"], ["extrato", "descricao"],
    ["cartao", "nome"], ["contas_fixas", "nome"], ["opcoes_pagamento", "nome"], ["opcoes_categoria", "nome"],
  ];
  for (const [tabela, coluna] of alvos) await tentar(A.db.from(tabela).delete().like(coluna, `${MARCA}%`));
  const aporte = fixtures.find((f) => f.tabela === "aportes_investimento");
  if (aporte) await tentar(A.db.from("aportes_investimento").delete().eq("id", aporte.valor));
  await tentar(B.db.from("caixinhas").delete().eq("id", caixinhaB));
  await tentar(C.db.from("perfis").update({ grupo_id: null }).eq("id", C.id));
  await tentar(A.db.from("perfis").delete().eq("eh_convidado", true).like("nome_usuario", `${MARCA}%`));
}

describe.skipIf(!habilitado)("Isolamento e permissões (RLS) — requisições diretas ao banco", () => {
  beforeAll(async () => {
    anon = novoCliente();
    [A, B, C] = await Promise.all([
      entrar(env.RLS_USER_A_EMAIL!, env.RLS_USER_A_PASSWORD!),
      entrar(env.RLS_USER_B_EMAIL!, env.RLS_USER_B_PASSWORD!),
      entrar(env.RLS_USER_C_EMAIL!, env.RLS_USER_C_PASSWORD!),
    ]);
    await prepararGrupos();
    await criarFixtures();
  });

  afterAll(async () => { if (A) await limpar(); });

  // ------------------------------------------------------------------ 1. visitante
  describe("1. Visitante sem login (anon)", () => {
    for (const t of TABELAS_DADOS) {
      it(`não lê nenhuma linha de ${t}`, async () => {
        const r = await anon.from(t).select("*").limit(5);
        expect(negado(r), `anon recebeu dados de ${t}`).toBe(true);
      });
    }
    it("não insere lançamentos", async () => {
      const r = await anon.from("extrato").insert([{ owner_id: A.id, grupo_id: grupoA, mes: MES, valor: 1, descricao: MARCA, pagamento: "Pix", categoria: "x" }]).select();
      expect(negado(r)).toBe(true);
    });
    it("não envia arquivos ao storage", async () => {
      const r = await anon.storage.from("avatars").upload(`${A.id}/anon-${Date.now()}.png`, new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }));
      expect(r.error, "upload anônimo foi aceito").toBeTruthy();
    });
  });

  // ------------------------------------------------------------------ 2. leitura entre usuários
  describe("2. Usuário B (fora do grupo A) não LÊ dados de A", () => {
    it("fixtures foram criadas por A (pré-condição)", async () => {
      for (const f of fixtures) {
        const r = await A.db.from(f.tabela).select(f.chave).eq(f.chave, f.valor);
        expect((r.data ?? []).length, `A não enxerga a própria linha em ${f.tabela}`).toBe(1);
      }
    });
    for (const nome of ["extrato", "cartao", "contas_fixas", "configuracoes", "preferencias_dashboard", "aportes_investimento", "caixinhas", "caixinha_movimentos", "opcoes_pagamento", "opcoes_categoria"]) {
      it(`B não consulta ${nome} de A (por id/chave)`, async () => {
        const f = fixtures.find((x) => x.tabela === nome)!;
        const r = await B.db.from(nome).select("*").eq(f.chave, f.valor);
        expect(negado(r), `B leu ${nome} de A`).toBe(true);
      });
      it(`B não consulta ${nome} de A (varredura sem filtro)`, async () => {
        const f = fixtures.find((x) => x.tabela === nome)!;
        const r = await B.db.from(nome).select("*").limit(1000);
        const vazou = ((r.data as Record<string, unknown>[] | null) ?? []).some((linha) => linha[f.chave] === f.valor);
        expect(vazou, `varredura de ${nome} por B retornou linha de A`).toBe(false);
      });
    }
    it("B não vê o extrato de A usando filtro por grupo_id de A", async () => {
      const r = await B.db.from("extrato").select("*").eq("grupo_id", grupoA);
      expect(negado(r)).toBe(true);
    });
    it("B não lê os perfis (membros) do grupo A", async () => {
      const r = await B.db.from("perfis").select("id, nome_usuario, cargo").eq("grupo_id", grupoA);
      expect(negado(r), "B listou membros do grupo A").toBe(true);
    });
    it("B não lê o grupo familiar A", async () => {
      const r = await B.db.from("grupos_familiares").select("*").eq("id", grupoA);
      expect(negado(r)).toBe(true);
    });
  });

  // ------------------------------------------------------------------ 3. alteração/exclusão
  describe("3. Usuário B não ALTERA nem EXCLUI dados de A", () => {
    for (const nome of ["extrato", "cartao", "contas_fixas", "configuracoes", "preferencias_dashboard", "aportes_investimento", "caixinhas", "caixinha_movimentos", "opcoes_pagamento", "opcoes_categoria"]) {
      it(`${nome}: UPDATE por B é negado e o dado de A permanece intacto`, async () => {
        const f = fixtures.find((x) => x.tabela === nome)!;
        const r = await B.db.from(nome).update(f.patch).eq(f.chave, f.valor).select();
        expect(negado(r), `B alterou ${nome} de A`).toBe(true);
        const depois = await A.db.from(nome).select("*").eq(f.chave, f.valor).single();
        const campo = Object.keys(f.patch)[0];
        expect(JSON.stringify(depois.data?.[campo]), `${nome}.${campo} mudou`).not.toBe(JSON.stringify(f.patch[campo]));
      });
      it(`${nome}: DELETE por B é negado e a linha de A continua existindo`, async () => {
        const f = fixtures.find((x) => x.tabela === nome)!;
        const r = await B.db.from(nome).delete().eq(f.chave, f.valor).select();
        expect(negado(r), `B excluiu ${nome} de A`).toBe(true);
        const depois = await A.db.from(nome).select(f.chave).eq(f.chave, f.valor);
        expect((depois.data ?? []).length, `linha de ${nome} sumiu`).toBe(1);
      });
    }
    it("B não altera o grupo familiar A", async () => {
      const r = await B.db.from("grupos_familiares").update({ nome: "HACK" }).eq("id", grupoA).select();
      expect(negado(r)).toBe(true);
    });
    it("B não exclui o grupo familiar A", async () => {
      const r = await B.db.from("grupos_familiares").delete().eq("id", grupoA).select();
      expect(negado(r)).toBe(true);
    });
    it("B não altera o perfil de A (nome/cor/avatar)", async () => {
      const r = await B.db.from("perfis").update({ nome_usuario: "HACK", cor: "#000000" }).eq("id", A.id).select();
      expect(negado(r), "B alterou o perfil de A").toBe(true);
    });
    it("B não exclui o perfil de A", async () => {
      const r = await B.db.from("perfis").delete().eq("id", A.id).select();
      expect(negado(r), "B excluiu o perfil de A").toBe(true);
    });
  });

  // ------------------------------------------------------------------ 4. forja de inserção
  describe("4. Forja de dados: B tenta INSERIR em nome de A / no grupo de A", () => {
    const registrar: { tabela: string; id: string }[] = [];
    afterAll(async () => {
      // se algo vazou e foi criado, apaga com o dono
      for (const x of registrar) { try { await A.db.from(x.tabela).delete().eq("id", x.id); await B.db.from(x.tabela).delete().eq("id", x.id); } catch { /* */ } }
    });
    const anotar = (tabela: string, r: { data: unknown }) => {
      for (const l of (r.data as { id?: string }[] | null) ?? []) if (l.id) registrar.push({ tabela, id: l.id });
    };

    it("extrato com owner_id de A é negado", async () => {
      const r = await B.db.from("extrato").insert([{ owner_id: A.id, usuario_id: A.id, grupo_id: grupoA, responsavel_id: A.id, mes: MES, pagamento: "Pix", categoria: "x", valor: 1, descricao: `${MARCA}-forja1`, privado: false }]).select();
      anotar("extrato", r);
      expect(negado(r), "B criou extrato em nome de A").toBe(true);
    });
    it("extrato próprio (owner_id=B) mas com grupo_id do grupo de A é negado", async () => {
      const r = await B.db.from("extrato").insert([{ owner_id: B.id, usuario_id: B.id, grupo_id: grupoA, responsavel_id: B.id, mes: MES, pagamento: "Pix", categoria: "x", valor: 1, descricao: `${MARCA}-forja2`, privado: false }]).select();
      anotar("extrato", r);
      expect(negado(r), "B injetou lançamento no grupo de A").toBe(true);
    });
    it("cartão no grupo de A é negado", async () => {
      const r = await B.db.from("cartao").insert([{ owner_id: B.id, usuario_id: B.id, grupo_id: grupoA, responsavel_id: B.id, mes: MES, nome: `${MARCA}-forja`, cartao: "x", parcela_atual: 1, parcela_total: 1, categoria: "x", valor: 1, privado: false }]).select();
      anotar("cartao", r);
      expect(negado(r)).toBe(true);
    });
    it("conta fixa no grupo de A é negada", async () => {
      const r = await B.db.from("contas_fixas").insert([{ owner_id: B.id, grupo_id: grupoA, responsavel_id: B.id, serie_id: crypto.randomUUID(), mes: MES, nome: `${MARCA}-forja`, pago: false, valor: 1 }]).select();
      anotar("contas_fixas", r);
      expect(negado(r)).toBe(true);
    });
    it("movimento na caixinha de A (user_id=B) é negado", async () => {
      const r = await B.db.from("caixinha_movimentos").insert({ user_id: B.id, caixinha_id: caixinhaA, tipo: "aporte", valor: 1, data: "2026-10-21", descricao: `${MARCA}-forja`, origem: "manual" }).select();
      anotar("caixinha_movimentos", r);
      expect(negado(r), "B lançou movimento na caixinha de A").toBe(true);
    });
    it("movimento com user_id de A é negado", async () => {
      const r = await B.db.from("caixinha_movimentos").insert({ user_id: A.id, caixinha_id: caixinhaB, tipo: "aporte", valor: 1, data: "2026-10-21", descricao: `${MARCA}-forja`, origem: "manual" }).select();
      anotar("caixinha_movimentos", r);
      expect(negado(r)).toBe(true);
    });
    it("A não lança movimento na caixinha de B (propriedade da caixinha é validada)", async () => {
      const r = await A.db.from("caixinha_movimentos").insert({ user_id: A.id, caixinha_id: caixinhaB, tipo: "aporte", valor: 1, data: "2026-10-21", descricao: `${MARCA}-forja`, origem: "manual" }).select();
      anotar("caixinha_movimentos", r);
      expect(negado(r), "movimento aceito em caixinha de outro usuário").toBe(true);
    });
    it("aporte de investimento com user_id de A é negado", async () => {
      const r = await B.db.from("aportes_investimento").insert({ user_id: A.id, valor: 1 }).select();
      anotar("aportes_investimento", r);
      expect(negado(r)).toBe(true);
    });
    it("configurações com user_id de A são negadas", async () => {
      const r = await B.db.from("configuracoes").insert({ user_id: A.id, salario: 1, investido: 0, reserva_atual: 0, reserva_meta: 0 }).select();
      expect(negado(r)).toBe(true);
    });
    it("preferências do dashboard de A não são sobrescritas via upsert por B", async () => {
      const r = await B.db.from("preferencias_dashboard").upsert({ user_id: A.id, preferencias: { hack: true } }, { onConflict: "user_id" }).select();
      expect(negado(r)).toBe(true);
      const depois = await A.db.from("preferencias_dashboard").select("preferencias").eq("user_id", A.id).single();
      expect(JSON.stringify(depois.data?.preferencias)).not.toContain("hack");
    });
    it("opções de pagamento/categoria com user_id de A são negadas", async () => {
      const a = await B.db.from("opcoes_pagamento").insert({ user_id: A.id, grupo_id: grupoA, nome: `${MARCA}-forja`, cor: "#000", eh_cartao: false, limite: 0 }).select();
      const b = await B.db.from("opcoes_categoria").insert({ user_id: A.id, grupo_id: grupoA, nome: `${MARCA}-forja`, cor: "#000" }).select();
      anotar("opcoes_pagamento", a); anotar("opcoes_categoria", b);
      expect(negado(a)).toBe(true);
      expect(negado(b)).toBe(true);
    });
  });

  // ------------------------------------------------------------------ 5. grupos
  describe("5. Grupos familiares: membros, gestor e convidados", () => {
    it("(regra assumida) C, membro do grupo A, enxerga o extrato NÃO privado do grupo", async () => {
      const r = await C.db.from("extrato").select("id").eq("id", idsExtratoA.aberto!);
      expect((r.data ?? []).length, "membro não vê lançamento compartilhado do grupo").toBe(1);
    });
    it("C NÃO enxerga o extrato marcado como privado de A", async () => {
      const r = await C.db.from("extrato").select("id").eq("id", idsExtratoA.privado!);
      expect(negado(r), "lançamento privado vazou para membro do grupo").toBe(true);
    });
    for (const nome of ["configuracoes", "preferencias_dashboard", "aportes_investimento", "caixinhas", "caixinha_movimentos", "opcoes_pagamento", "opcoes_categoria"]) {
      it(`C (mesmo grupo) NÃO enxerga ${nome} privado(a) de A`, async () => {
        const f = fixtures.find((x) => x.tabela === nome)!;
        const r = await C.db.from(nome).select("*").eq(f.chave, f.valor);
        expect(negado(r), `membro leu ${nome} de A`).toBe(true);
      });
    }
    it("C (membro) NÃO exclui lançamento criado por A", async () => {
      const r = await C.db.from("extrato").delete().eq("id", idsExtratoA.aberto!).select("id");
      expect(negado(r), "membro excluiu lançamento alheio").toBe(true);
      const depois = await A.db.from("extrato").select("id").eq("id", idsExtratoA.aberto!);
      expect((depois.data ?? []).length).toBe(1);
    });
    it("(regra assumida) C (membro) NÃO edita lançamento criado por A", async () => {
      const r = await C.db.from("extrato").update({ valor: 999.99 }).eq("id", idsExtratoA.aberto!).select("id");
      expect(negado(r), "membro editou lançamento alheio").toBe(true);
    });
    it("C NÃO se promove a gestor (escalada de privilégio)", async () => {
      await C.db.from("perfis").update({ cargo: "gestor" }).eq("id", C.id).select();
      const depois = await C.db.from("perfis").select("cargo").eq("id", C.id).single();
      const virou = depois.data?.cargo !== "membro";
      if (virou) await C.db.from("perfis").update({ cargo: "membro" }).eq("id", C.id).select(); // restaura
      expect(virou, "membro conseguiu virar gestor sozinho").toBe(false);
    });
    it("C NÃO altera o perfil do gestor A", async () => {
      const r = await C.db.from("perfis").update({ cor: "#000000" }).eq("id", A.id).select();
      expect(negado(r), "membro alterou perfil do gestor").toBe(true);
    });
    it("C NÃO remove o gestor A do grupo", async () => {
      const r = await C.db.from("perfis").delete().eq("id", A.id).select();
      expect(negado(r), "membro excluiu o gestor").toBe(true);
      const depois = await A.db.from("perfis").select("id").eq("id", A.id);
      expect((depois.data ?? []).length).toBe(1);
    });
    it("C NÃO muda o próprio grupo_id para outro grupo arbitrário sem convite", async () => {
      await C.db.from("perfis").update({ grupo_id: grupoB }).eq("id", C.id).select();
      const depois = await C.db.from("perfis").select("grupo_id").eq("id", C.id).single();
      const trocou = depois.data?.grupo_id !== grupoA;
      if (trocou) await C.db.from("perfis").update({ grupo_id: grupoA }).eq("id", C.id).select(); // restaura
      expect(trocou, "membro trocou de grupo livremente").toBe(false);
    });
    it("A (gestor) adiciona e remove um convidado do próprio grupo", async () => {
      const add = await A.db.from("perfis").insert([{ nome_usuario: `${MARCA}-convidado`, grupo_id: grupoA, cargo: "membro", eh_convidado: true, cor: "#F59E0B" }]).select("id").single();
      expect(add.error, "gestor não conseguiu adicionar convidado").toBeFalsy();
      const del = await A.db.from("perfis").delete().eq("id", add.data!.id).select("id");
      expect((del.data ?? []).length, "gestor não conseguiu remover convidado").toBe(1);
    });
    it("B NÃO cria convidado dentro do grupo de A", async () => {
      const r = await B.db.from("perfis").insert([{ nome_usuario: `${MARCA}-intruso`, grupo_id: grupoA, cargo: "membro", eh_convidado: true, cor: "#000000" }]).select();
      if (!negado(r)) await A.db.from("perfis").delete().like("nome_usuario", `${MARCA}-intruso`);
      expect(negado(r), "B inseriu convidado no grupo de A").toBe(true);
    });
    it("B NÃO entra sozinho no grupo A apenas conhecendo o UUID (sem convite/aprovação)", async () => {
      await B.db.from("perfis").upsert({ id: B.id, user_id: B.id, nome_usuario: `${MARCA}-B`, grupo_id: grupoA, cargo: "membro", cor: "#6366F1" }).select();
      const eu = await B.db.from("perfis").select("grupo_id").eq("id", B.id).single();
      const viu = await B.db.from("extrato").select("id").eq("id", idsExtratoA.aberto!);
      // restaura B no próprio grupo para não contaminar os demais testes
      await B.db.from("perfis").update({ grupo_id: grupoB }).eq("id", B.id).select();
      expect(eu.data?.grupo_id, "B conseguiu entrar no grupo de A com o UUID").not.toBe(grupoA);
      expect((viu.data ?? []).length, "B passou a ler dados do grupo de A").toBe(0);
    });
    it("B NÃO se autodeclara gestor de um grupo que não criou", async () => {
      await B.db.from("perfis").update({ grupo_id: grupoA, cargo: "gestor" }).eq("id", B.id).select();
      const eu = await B.db.from("perfis").select("grupo_id, cargo").eq("id", B.id).single();
      await B.db.from("perfis").update({ grupo_id: grupoB, cargo: "gestor" }).eq("id", B.id).select();
      expect(eu.data?.grupo_id === grupoA, "B virou gestor do grupo de A").toBe(false);
    });
  });

  // ------------------------------------------------------------------ 6. vinculadas
  describe("6. Movimentações vinculadas (caixinha ↔ movimentos)", () => {
    it("excluir a caixinha não deixa movimentos órfãos", async () => {
      const novo = exigir(await A.db.from("caixinhas").insert({ user_id: A.id, nome: `${MARCA}-vinculo`, eh_reserva_emergencia: false, rendimento: null, meta: 10, aporte_auto_ativo: false, aporte_auto_valor: 0, exibir_na_home: false, cor: "#3b82f6", banco: null, tipo_rendimento: null, ultimo_mes_auto: MES, ultimo_mes_rendimento: MES }).select("id").single(), "caixinha vínculo");
      const cid = novo.id as string;
      exigir(await A.db.from("caixinha_movimentos").insert({ user_id: A.id, caixinha_id: cid, tipo: "aporte", valor: 10, data: "2026-10-21", descricao: `${MARCA}-vinculo`, origem: "manual" }).select("id").single(), "mov vínculo");
      await A.db.from("caixinhas").delete().eq("id", cid);
      const orfaos = await A.db.from("caixinha_movimentos").select("id").eq("caixinha_id", cid);
      expect((orfaos.data ?? []).length, "movimentos órfãos após excluir a caixinha").toBe(0);
    });
    it("resgate maior que o saldo é rejeitado pelo banco (integridade, não só no frontend)", async () => {
      const r = await A.db.from("caixinha_movimentos").insert({ user_id: A.id, caixinha_id: caixinhaA, tipo: "resgate", valor: 1_000_000, data: "2026-10-21", descricao: `${MARCA}-estouro`, origem: "manual" }).select();
      if (!r.error) await A.db.from("caixinha_movimentos").delete().like("descricao", `${MARCA}-estouro`);
      expect(r.error, "saldo negativo aceito").toBeTruthy();
    });
    it("excluir o lançamento de extrato de A por A funciona (operação legítima não foi bloqueada)", async () => {
      const novo = exigir(await A.db.from("extrato").insert([{ owner_id: A.id, usuario_id: A.id, grupo_id: grupoA, responsavel_id: A.id, mes: MES, pagamento: "Pix", categoria: "x", valor: 1, descricao: `${MARCA}-descartavel`, privado: false }]).select("id").single(), "extrato descartável");
      const del = await A.db.from("extrato").delete().eq("id", novo.id).select("id");
      expect((del.data ?? []).length).toBe(1);
    });
  });

  // ------------------------------------------------------------------ 7. RPC
  describe("7. RPCs", () => {
    it("criar_opcoes_padrao chamada por B não cria nem altera cadastros de A", async () => {
      const antes = await A.db.from("opcoes_pagamento").select("id", { count: "exact", head: true });
      await B.db.rpc("criar_opcoes_padrao");
      const depois = await A.db.from("opcoes_pagamento").select("id", { count: "exact", head: true });
      expect(depois.count).toBe(antes.count);
    });
    it("criar_opcoes_padrao não aceita user_id arbitrário", async () => {
      const r = await B.db.rpc("criar_opcoes_padrao", { p_user_id: A.id, user_id: A.id, uid: A.id });
      expect(r.error, "função aceitou um user_id vindo do cliente").toBeTruthy();
    });
  });

  // ------------------------------------------------------------------ 8. storage
  describe("8. Storage (bucket avatars)", () => {
    const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
    const arquivos: { dono: Sessao; caminho: string }[] = [];
    afterAll(async () => { for (const a of arquivos) { try { await a.dono.db.storage.from("avatars").remove([a.caminho]); } catch { /* */ } } });

    it("(sanidade) cada usuário envia o próprio avatar na própria pasta", async () => {
      const caminho = `${A.id}/avatar-${MARCA}.png`;
      const r = await A.db.storage.from("avatars").upload(caminho, png(), { upsert: true, contentType: "image/png" });
      arquivos.push({ dono: A, caminho });
      expect(r.error).toBeFalsy();
    });
    it("B NÃO envia arquivo para a pasta de A", async () => {
      const caminho = `${A.id}/intruso-${MARCA}.png`;
      const r = await B.db.storage.from("avatars").upload(caminho, png(), { upsert: true, contentType: "image/png" });
      if (!r.error) arquivos.push({ dono: A, caminho });
      expect(r.error, "B gravou na pasta de A").toBeTruthy();
    });
    it("B NÃO sobrescreve o avatar de A (upsert)", async () => {
      const caminho = `${A.id}/avatar-${MARCA}.png`;
      const r = await B.db.storage.from("avatars").upload(caminho, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), { upsert: true, contentType: "image/png" });
      expect(r.error, "B sobrescreveu o avatar de A").toBeTruthy();
    });
    it("B NÃO remove o avatar de A", async () => {
      const caminho = `${A.id}/avatar-${MARCA}.png`;
      await B.db.storage.from("avatars").remove([caminho]);
      const lista = await A.db.storage.from("avatars").list(A.id);
      expect((lista.data ?? []).some((o) => o.name === `avatar-${MARCA}.png`), "avatar de A foi removido por B").toBe(true);
    });
    it("B NÃO lista a pasta de A", async () => {
      const lista = await B.db.storage.from("avatars").list(A.id);
      expect((lista.data ?? []).length, "B listou arquivos de A").toBe(0);
    });
  });
});

describe.runIf(!habilitado)("Isolamento e permissões (RLS)", () => {
  it.skip("PULADO — defina as variáveis RLS_* (ver .env.example) e RLS_CONFIRMA_AMBIENTE_DE_TESTE=sim", () => {});
});
