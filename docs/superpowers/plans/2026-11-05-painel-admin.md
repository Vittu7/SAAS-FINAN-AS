# Painel administrativo do HomeCash — Plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas `- [ ]`.

**Objetivo:** entregar a área `/admin` do HomeCash (dashboard, usuários, suporte somente leitura, erros, solicitações com anexos e e-mail, auditoria) com permissão própria, MFA obrigatório e sem `service_role`.

**Arquitetura:** funções `SECURITY DEFINER` no Supabase (abordagem A) chamam `homecash_interno.checar_admin` antes de qualquer coisa e devolvem um envelope `{ok, dados|erro}`. A interface é Next/React puro sobre `supabase.rpc`. Há um único código de servidor (route handler de e-mail e validação de imagem). A auditoria é imutável e encadeada por hash.

**Tecnologias:** Next.js 16.4.5 (`cacheComponents: true`), React 19.3, Tailwind 4, supabase-js 2.x, Vitest 3, PostgreSQL 17.11 (Supabase, sa-east-1), `sharp` (fase 5, a aprovar).

**Spec (referência obrigatória, inclusive o §18.5):** `docs/superpowers/specs/2026-11-05-painel-admin-design.md`

## Global Constraints

Valem para todas as tarefas.

- **Nada acontece no banco sem autorização expressa, migração por migração.** Este plano só descreve. Escrever o arquivo `.sql` localmente é permitido durante a execução; **aplicá-lo, rodar roteiro de banco, inserir admin ou segredo são "portões" (G-*) que esperam sua resposta.**
- **Sem commit, push, merge ou deploy sem autorização** (CONTINUIDADE seção 9). Os passos "Commit" abaixo só ocorrem quando você mandar. A árvore já tem 15 arquivos alheios modificados/novos (`useFinanceStore.ts`, `TelaGrupo.tsx` etc.): **nunca usar `git add -A`**; adicionar só os arquivos da tarefa.
- **Sem `service_role`** no repositório, no navegador ou no handler. Só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nas telas.
- **Autorização do painel nunca lê `perfis.cargo`, `perfis.grupo_id` nem grupos** (E5-1: o usuário edita essas colunas). A permissão é `admin_usuarios` + MFA `aal2`.
- **O painel não escreve em dado de usuário.** Únicas escritas: status/nota/resposta de erros e solicitações, mais os registros próprios (auditoria, negados, sessões de suporte, confirmações, concessões de anexo).
- **Numeração das migrações (final, v3.3):** já existem no repositório e **não são do painel nem são alteradas**: `supabase/supabase-19-excluir-grupo-convidado.sql`, `supabase/supabase-21-storage.sql` e `supabase/supabase-22-remove-objetos-antigos.sql`. Painel: `supabase-20-admin-base.sql` (fase 1), `supabase-23-admin-suporte.sql` (fase 3), `supabase-24-erros-solicitacoes.sql` (fase 4) e `supabase-25-solicitacoes-anexos-email.sql` (fase 5). Os rótulos 19 a 22 do spec (§17 e §18) são os antigos: base = 19, suporte = 20, erros = 21, anexos = 22. A 12 e a 18 continuam fora do painel.
- **Padrão de migração (§12.1):** transação com `set local lock_timeout`; pré-checagem primeiro; `comment ... is 'homecash-admin:v1'` em todo objeto criado; aborta ante nome preexistente sem marca; nenhum `drop/alter/truncate/delete` sobre objeto antigo; `revoke ... from public, anon, authenticated` antes do `grant` da categoria; validação de estrutura; assert final de postura; bloco de desfazer **comentado**.
- **Categorias de função (§5.2):** A admin, B usuário, C servidor, D internas, E auxiliares do Storage, F triggers. Funções novas só em `public` (A, B, C) e `homecash_interno` (D, E, F). `set search_path = ''` e nomes com schema em todas.
- **Envelope e erros (§5.7):** validação falha → `return {"ok":false,"erro":...}`; o registro é gravado antes do `return`; nenhum `raise` depois de gravar.
- **Valores do spec:** MFA TOTP `aal2`; `amr` totp ≤ 8 h (se #30 confirmar); sessão de suporte 30 min, motivo ≥ 10 letras, uma ativa por admin; `p_limite` ≤ 200; reserva de e-mail 10 min / 3 tentativas; reserva de anexo 5 min / 3 tentativas; anexo `registrado` expira em 1 h; ≤ 4 anexos e 12 MB por solicitação; imagem ≤ 3 MB, 16–4096 px, ≤ 16 MP; concessão de anexo 2 min; teto de 200 negados novos por hora; 5 `segredo_invalido` em 10 min; destinatário `homecashofc@gmail.com` só em variável do servidor.
- **Next 16:** antes de cada tarefa de rota, layout, handler ou CSP, ler o guia correspondente em `node_modules/next/dist/docs/` (AGENTS.md). Citar o arquivo lido no commit/PR.
- **Conteúdo de terceiros é texto.** Proibidos `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `<iframe>` em `src/app/admin`, `src/components/admin`, `src/app/api`.
- **Comandos de verificação padrão** (não há script `test` no `package.json`): `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **Branch:** `HEAD` está destacado. A Fase 0 pede autorização para criar `feature/painel-admin`.

## Review Focus

Entradas que o spec implica e nenhuma tarefa óbvia cobre; cada uma tem teste na tarefa dona.

1. **Usuário comum com `perfis.cargo = 'gestor'` forjado** (E5-1) ou dentro de grupo de admin chamando uma RPC A: deve receber `acesso_negado`. Teste na T1.5 (roteiro) e teste estático na T1.1 (nenhum corpo de função A/D menciona `cargo`).
2. **`admin_id` nulo** (insert no SQL Editor): a cadeia de hash grava e a verificação passa. T1.2 (vetor TS) e roteiro da T1.5.
3. **Termo de busca com `%`, `_`, `\`, aspas, `|` e emoji** em `admin_listar_usuarios`: sem erro, sem coringa, entra na auditoria como texto. T1.4 e T1.5.
4. **Alvo sem grupo, convidado sem conta (`user_id` nulo), conta sem perfil, perfil com colunas legadas preenchidas:** ficha e suporte não quebram e não devolvem colunas legadas. T1.4 (ficha) e T3.3 (suporte).
5. **Token `aal2` antigo depois de remover o fator, e token sem claim `amr`:** `mfa_nao_configurada` e fallback sem `mfa_expirada` indevida. T1.5 e portão G1.4.
6. **Admin desativado com sessão de suporte aberta; sessão expirando entre duas leituras:** a leitura seguinte falha com envelope e registro. T3.3.

---

## Mapa de arquivos

| Fase | Criar | Modificar |
|---|---|---|
| 0 | — | — |
| 1 | `supabase/supabase-20-admin-base.sql`; `supabase/testes/admin-base.sql`; `src/lib/admin.ts`; `src/lib/adminMfa.ts`; `src/app/admin/{layout,page}.tsx`; `src/app/admin/{seguranca,auditoria}/page.tsx`; `src/components/admin/{AdminShell,AdminMenu,CartaoIndicador,GraficoBarrasSvg,TabelaPaginada,EstadoTela}.tsx`; testes `tests/{sql-migracoes,sql-funcoes-categorias,hash-auditoria,admin-lib,admin-mfa,admin-ui-seguranca}.test.ts`; `tests/helpers/{sqlArquivos,hashAuditoria}.ts` | `next.config.*` ou `proxy.ts` (CSP só de `/admin`) |
| 2 | `src/app/admin/usuarios/page.tsx`; `src/app/admin/usuarios/[id]/page.tsx`; `src/components/admin/{FiltrosUsuarios,FichaUsuario}.tsx` | — |
| 3 | `supabase/supabase-23-admin-suporte.sql`; `supabase/testes/admin-suporte.sql`; `src/lib/adminSuporte.ts`; `src/components/admin/suporte/*`; `tests/{admin-suporte,sql-elegibilidade}.test.ts` | `src/app/admin/usuarios/[id]/page.tsx` |
| 4 | `supabase/supabase-24-erros-solicitacoes.sql`; `supabase/testes/admin-erros-solicitacoes.sql`; `src/lib/{erros,solicitacoes}.ts`; `src/components/{CaptadorErros,SolicitacaoModal}.tsx`; `src/app/admin/{erros,solicitacoes}/page.tsx`; `tests/{erros-sanitizacao,solicitacoes-lib}.test.ts` | `src/app/layout.tsx`; `src/components/TelaAjuda.tsx`; `src/app/admin/page.tsx` |
| 5 | `supabase/supabase-25-solicitacoes-anexos-email.sql`; `supabase/testes/admin-anexos-email.sql`; `src/app/api/solicitacoes/[id]/processar/route.ts`; `src/lib/servidor/{anexos,email,segredo}.ts`; `tests/{servidor-anexos,email-solicitacao,anexos-ciclo,email-ciclo}.test.ts` | `package.json` (`sharp`); `src/lib/solicitacoes.ts`; `src/components/SolicitacaoModal.tsx`; `src/app/admin/solicitacoes/page.tsx`; `README.md` (nomes de variáveis) |

`src/lib/imagem.ts` **não** muda. Nenhuma tabela, política ou função existente é alterada.

## Dependências entre fases

```
F0 pré-requisitos ──► F1 (mig 20 + telas MFA) ──► F2 (UI usuários; usa RPCs da mig 20)
                              │                         
                              ├──► F3 (mig 23; exige F1 aplicada)  ──┐
                              └──► F4 (mig 24; exige F1 aplicada)    ├─► portão Política de Privacidade (antes do DEPLOY de F3, F4, F5)
                                       └──► F5 (mig 25; exige 24 + E7 + sharp + provedor de e-mail)
```
F3 e F4 não dependem uma da outra; a ordem 3→4 do spec é mantida por padrão.

## Trilha paralela fora do painel (documentada, **não** corrigida por este plano)

Itens abertos que o painel não corrige, não oculta e não considera resolvidos. Cada um precisa de ordem sua.

| Achado | Estado | Efeito no painel | Ação futura (sob autorização) |
|---|---|---|---|
| **E5-1** (Alta): migração 12 não aplicada; usuário edita `perfis.grupo_id/cargo/eh_convidado/user_id` | Aberto | Nenhum: permissão do painel não usa `perfis`. A ficha rotula `cargo` como "informado pelo usuário" | Deploy do código da branch, depois migração 12 |
| **E4-2** (Média): colunas financeiras legadas de `perfis` visíveis ao grupo (2 de 12 perfis) | Aberto | Suporte e ficha **não** devolvem `salario/investido/reserva_*` | Decidir limpeza/restrição das colunas |
| **E4-3** (Baixa): migração 19 local de exclusão de grupo não aplicada | Aberto | Nenhum | Aplicar o arquivo existente sem renomear |
| **E5b-1** `criar_grupo_familiar` sem checar vínculo | Aberto | Nenhum | Corrigir função |
| **E5b-2** ex-membro pode perder edição de lançamentos antigos | Aberto, **precisa de teste** | Suporte mostra o que o banco tem | Testar com conta de teste, depois corrigir |
| **E5b-3** comentário de trava inexistente; erro `23502` cru | Aberto | Nenhum | Ajustar função |
| **E5b-4** `entrar_grupo_familiar(uuid)` morta e perigosa | Aberto | Nenhum. **Regra:** a migração 20 e seguintes nunca concedem `EXECUTE` a ela | Remover |
| **E5b-5** funções legadas executáveis | Aberto | Nenhum | Revogar/remover |
| **E5b-6** sem limite em criação de grupo/convidado | Aberto | Nenhum | Definir limites |
| Colisão de numeração (#35) | Resolvida neste plano (20–23) | — | — |

## Contas de teste

- **Conta real do dono:** só para o primeiro admin (G1.3). Nunca usada para testar falha de segurança destrutiva.
- **Contas de teste (criar 3, e-mail descartável do próprio domínio ou alias seu; criação via fluxo normal de cadastro, com sua autorização):** `teste-admin` (será admin e fará MFA), `teste-comum` (usuário comum, com `perfis.cargo` editado para `gestor` **por você** no Table Editor, apenas para o teste do Review Focus 1), `teste-alvo` (alvo do suporte, com um grupo, um convidado, um lançamento privado e um partilhado, uma caixinha).
- Os roteiros `supabase/testes/admin-*.sql` usam `begin ... rollback` e criam usuários de teste **dentro da transação**; os testes de token real (V10.7) usam as contas acima.
- Dados reais de usuários nunca são lidos para testar. O suporte só é aberto sobre `teste-alvo` até a liberação.

---

# Fase 0 — Pré-requisitos (sem código, sem SQL)

### Task 0: Decisões e verificações manuais

**Portões:** G0.1 a G0.5, todos seus.

- [ ] **G0.1 — Branch.** Pedir autorização para `git switch -c feature/painel-admin` a partir de `HEAD` (detached em `b86dbf9`). As alterações alheias não commitadas (15 arquivos) ficam como estão e **nunca entram** nos commits do painel.
- [ ] **G0.2 — V10.1.** Você confirma no painel Supabase (Auth → MFA) que **TOTP está habilitado** (cadastro e verificação) e anota o limite de tentativas e `max_enrolled_factors` (#33). Se estiver desligado, a Fase 1 não pode ser testada de ponta a ponta.
- [ ] **G0.3 — V10.3.** Você confirma em Settings → API que **`homecash_interno` não está em "Exposed schemas"** (#15). Se estiver, não expor; a migração 20 não passa no G1.2 até isso estar certo.
- [ ] **G0.4 — Leituras obrigatórias** (executor): `node_modules/next/dist/docs/01-app/` — layouts e páginas, tratamento de erro, route handlers, `proxy.ts`, `02-guides/authentication.md`, `02-guides/content-security-policy.md`. Anotar no topo de cada tarefa de UI quais convenções de Next 16 valem (por exemplo `cacheComponents`, `proxy`).
- [ ] **G0.5 — Decisões que podem esperar a Fase 5, mas são pedidas agora:** (a) aprovar `sharp` (#16); (b) escolher provedor de e-mail e remetente (#17); (c) responsável e data da tarefa da **Política de Privacidade** (portão de deploy das Fases 3 a 5); (d) afrouxar ou não a regra do §6.5 (spec mantém a conservadora).

**Critério de conclusão:** G0.1 a G0.3 respondidos; G0.4 lido; G0.5 (a–d) respondido ou explicitamente adiado.

---

# Fase 1 — Base: migração 20, MFA, layout, dashboard parcial, auditoria

**Critério de conclusão da fase:** testes locais verdes (`vitest`, `tsc`, `lint`, `build`); migração 20 escrita e aprovada pelos testes estáticos; **depois de G1.2 a G1.4**: migração aplicada com sua autorização, roteiro de banco verde, primeiro admin ativado na ordem do §5.8 R3, V10.7 feito com `teste-admin`. Nenhuma RPC A funciona sem `aal2`.

### Task 1.1: Testes estáticos de SQL (escritos antes da migração)

**Files:**
- Create: `tests/helpers/sqlArquivos.ts`, `tests/sql-migracoes.test.ts`, `tests/sql-funcoes-categorias.test.ts`
- Test: os mesmos

**Interfaces:**
- Produces: `listarMigracoesPainel(): { arquivo: string; sql: string }[]` (lê só os arquivos que existirem entre `supabase-20-admin-base.sql`, `supabase-23-admin-suporte.sql`, `supabase-24-erros-solicitacoes.sql`, `supabase-25-solicitacoes-anexos-email.sql`); `CATEGORIAS: Record<string, "A"|"B"|"C"|"D"|"E"|"F">` com a classificação de cada função do §5.2 e das RPCs de cada migração (preenchida por fase). `extrairFuncao(sql: string, nome: string): string`.

- [ ] **Step 1: Escrever os testes (devem falhar sem a migração).** Casos, cada um nomeado:
  - `sql-migracoes`: `"pré-checagem é o primeiro bloco"`, `"todo create leva comment homecash-admin:v1"`, `"nenhum drop table/schema/function, truncate ou delete from sobre objeto antigo"`, `"nenhum create or replace trigger"`, `"triggers só em tabelas novas"`, `"nenhuma referência a supabase-19 nem a funções antigas alteradas"`, `"contém validação de estrutura, assert de postura e bloco de desfazer comentado"`, `"nenhum alter default privileges"`, `"nenhum service_role"`, `"nunca concede execute a entrar_grupo_familiar"`.
  - `sql-funcoes-categorias`: um teste por categoria A–F conforme §12.2 (A: `security definer`, `set search_path = ''`, primeira chamada `homecash_interno.checar_admin`, retorno `jsonb`, `revoke ... from public, anon, authenticated` + `grant ... to authenticated`, sem `raise exception` depois de insert de registro; B: usa `auth.uid()` e não chama `checar_admin`, `sou_admin` é a única que retorna `boolean`; C: `segredo_valido` e `update` único; D: sem `grant execute` a `anon`/`authenticated`/`public`; E: `grant execute` só a `authenticated`, parâmetro `text`, retorno `boolean`; F: retornam `trigger`, sem grant; dois triggers distintos de imutabilidade nas tabelas imutáveis).
  - **Review Focus 1:** `"nenhum corpo de função A, D ou E contém a palavra cargo ou perfis.grupo_id para autorizar"` (só `admin_usuario_detalhe` e `admin_listar_usuarios` podem **ler** `perfis.cargo`, e só como dado de exibição).
  - `"hash usa jsonb_build_array e nunca || nem concatenação"`.
- [ ] **Step 2: Rodar.** `npx vitest run tests/sql-migracoes.test.ts tests/sql-funcoes-categorias.test.ts` → esperado: FAIL "arquivo não encontrado" (a migração ainda não existe).
- [ ] **Step 3: Implementar os helpers** em `tests/helpers/sqlArquivos.ts` (leitura de arquivos, divisão por `create ... function`, extração de corpo).
- [ ] **Step 4: Rodar de novo** → ainda FAIL pelo mesmo motivo (esperado até a T1.5).
- [ ] **Step 5: Commit** (só com autorização): `git add tests/helpers/sqlArquivos.ts tests/sql-migracoes.test.ts tests/sql-funcoes-categorias.test.ts`.

### Task 1.2: Especificação executável do hash da auditoria

**Files:**
- Create: `tests/helpers/hashAuditoria.ts`, `tests/hash-auditoria.test.ts`

**Interfaces:**
- Produces: `serializarLinha(l: LinhaAuditoria): string` (equivalente a `jsonb_build_array('v1', ordem, hash_anterior, id, admin_id, admin_email, acao, alvo_user_id, alvo_email, recurso, linhas, motivo, sessao_suporte, criado_em_utc, parametros)::text`, com `criado_em` no formato `YYYY-MM-DDTHH:MM:SS.ffffff` UTC); `hashLinha(l): string` (sha256 hex); `verificarCadeia(ls: LinhaAuditoria[]): { primeiraQuebra: number | null }`.

- [ ] **Step 1: Testes:** `"vetor conhecido de hash de uma linha"` (valores fixos escritos no teste); `"admin_id nulo é preservado como null e a linha tem hash"` (**Review Focus 2**); `"barra vertical dentro do motivo não desloca campos"`; `"duas linhas com a mesma ordem são detectadas"`; `"salto de ordem é detectado"`; `"alterar um campo do meio devolve a ordem correta"`; `"verificação em páginas dá o mesmo resultado da verificação inteira"`.
- [ ] **Step 2: Rodar** `npx vitest run tests/hash-auditoria.test.ts` → FAIL.
- [ ] **Step 3: Implementar** os helpers com `node:crypto` (`createHash('sha256')`) e `JSON.stringify` com a mesma regra de espaços do `jsonb::text` (`", "` e `": "`); documentar a regra no topo do arquivo.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** (com autorização).

### Task 1.3: Migração 20, parte 1 — pré-checagem, schema, tabelas, triggers

**Files:**
- Create: `supabase/supabase-20-admin-base.sql` (seções 1–3)

**Interfaces:**
- Produces (todos marcados `homecash-admin:v1`): schema `homecash_interno`; `public.admin_usuarios(user_id uuid pk, ativo boolean, fatores_aprovados uuid[] not null default '{}', email_registrado text, criado_em timestamptz, criado_por text, observacao text)` **sem FK**; `public.admin_auditoria` e `public.admin_acessos_negados` com os campos do §5.4 e §5.7; `homecash_interno.acessos_negados_contagem`; triggers F: `trg_auditoria_cadeia` (before insert, lock `pg_advisory_xact_lock(classe, chave)`), `trg_auditoria_imutavel_linha` (before update or delete), `trg_auditoria_imutavel_truncate` (before truncate, por instrução), os equivalentes para negados, `trg_admin_usuarios_ultimo_admin`, `trg_admin_usuarios_auditoria`.

- [ ] **Step 1:** Antes, ler uma migração antiga (por exemplo `supabase-14-trava-repasse-confirmado.sql`) para copiar o estilo do bloco de desfazer comentado.
- [ ] **Step 2: Escrever o bloco de pré-checagem** (primeiro bloco do arquivo): `auth.users` existe; `pg_catalog.sha256(bytea)` ou `digest`; dono pode ler `auth.mfa_factors(id,user_id,status,factor_type)`; `homecash_interno` ausente ou marcado; nenhum objeto com nosso nome sem marca. Aborta sem criar nada.
- [ ] **Step 3: Criar schema e tabelas** (`revoke all ... from public, anon, authenticated` em cada uma; RLS ligada em `admin_usuarios`, `admin_auditoria`, `admin_acessos_negados`, sem política).
- [ ] **Step 4: Criar as funções F e os triggers** pela regra do §5.4: `ordem` sob lock; `hash` sobre `jsonb_build_array(...)::text`; o trigger de `admin_usuarios` grava `current_user` e **admite `auth.uid()` nulo**; o do último admin impede desativar/remover o último ativo.
- [ ] **Step 5: Rodar os testes estáticos** `npx vitest run tests/sql-migracoes.test.ts` → os casos de estrutura desta parte passam; os demais seguem FAIL até a T1.5.
- [ ] **Step 6: Commit** (com autorização).

### Task 1.4: Migração 20, parte 2 — funções internas e RPCs

**Files:**
- Modify: `supabase/supabase-20-admin-base.sql` (seções 4–6)

**Interfaces:**
- Produces D: `homecash_interno.hash_texto(p_texto text) returns text`; `homecash_interno.checar_admin(p_funcao text) returns text` (devolve `null` quando liberado, senão o código de erro; ordem do R5: `acesso_negado`, `mfa_requerida`/`mfa_nao_configurada`, `fator_nao_aprovado`, `mfa_nao_configurada`, `mfa_expirada`); `homecash_interno.registrar_auditoria(...)`; `homecash_interno.registrar_negado(p_funcao text, p_motivo text, p_rota text)` com agrupamento por hora e teto global 200/h; `homecash_interno.segredo_valido` **não** nasce aqui (T5.2).
- Produces B (`public`): `sou_admin() returns boolean`; `registrar_tentativa_admin(p_rota text) returns jsonb`.
- Produces A (`public`, todas `returns jsonb` e começando por `checar_admin`): `admin_registrar_acesso()`, `admin_resumo()`, `admin_listar_usuarios(p_busca text, p_filtro text, p_pagina int, p_limite int)`, `admin_usuario_detalhe(p_user uuid)`, `admin_listar_auditoria(p_aba text, p_pagina int, p_limite int)`, `admin_verificar_auditoria(p_desde bigint, p_limite int)`.

- [ ] **Step 1:** `checar_admin` compara `auth.jwt()->>'aal'` com `is distinct from 'aal2'`; só `factor_type = 'totp'` e `status = 'verified'` conta; `amr` é lida só se presente.
- [ ] **Step 2:** `admin_listar_usuarios` escapa `\`, `%`, `_` do termo antes do `ilike ... escape '\'`; junção por `perfis.id = auth.users.id`; **convidados nunca aparecem como usuário**; `ordem` por lista fixa; contagem de lançamentos pela mesma regra do §6.5 (ainda sem `elegivel_suporte`: nesta migração conta só `owner_id = alvo`, e a ficha avisa; a contagem completa fica para a migração 23). **Cobre Review Focus 3 e 4.**
- [ ] **Step 3:** `admin_usuario_detalhe` não devolve `salario`, `investido`, `reserva_*`, `avatar_url`; rotula `cargo` como `cargo_informado_pelo_usuario`; não quebra para alvo sem grupo, sem perfil ou convidado.
- [ ] **Step 4:** `admin_resumo` devolve contagens e séries de 30 dias (cadastros, ativos, erros e solicitações como `null` até a migração 24), uma auditoria por carregamento, no máximo uma a cada 10 min por admin.
- [ ] **Step 5:** `revoke ... from public, anon, authenticated` + `grant` por categoria, sempre após cada `create`.
- [ ] **Step 6: Rodar** `npx vitest run tests/sql-funcoes-categorias.test.ts` → casos de A, B, D, F passam.
- [ ] **Step 7: Commit** (com autorização).

### Task 1.5: Migração 20, parte 3 — validação de estrutura, postura final, desfazer, roteiro de banco

**Files:**
- Modify: `supabase/supabase-20-admin-base.sql` (seções 7–9)
- Create: `supabase/testes/admin-base.sql`

- [ ] **Step 1:** Bloco de validação de estrutura (colunas, `check`s, índices, triggers esperados e inesperados, RLS, políticas, ACL, `prosecdef`, `proconfig`) e **assert final de postura** (§12.1 itens 11 e 12). Bloco de desfazer comentado que remove só o que a migração criou.
- [ ] **Step 2: Rodar a suíte inteira** `npx vitest run tests/sql-migracoes.test.ts tests/sql-funcoes-categorias.test.ts tests/hash-auditoria.test.ts` → PASS.
- [ ] **Step 3: Escrever o roteiro de banco** (`begin ... rollback`, nada persiste): para cada código registrável, `anon` e não-admin recusados; `update`, `delete`, `truncate` (três comandos separados) em `admin_auditoria` e `admin_acessos_negados` falham; duas sessões inserindo ao mesmo tempo mantêm `ordem` sem repetição ou salto; adulteração simulada é achada por `admin_verificar_auditoria`; `admin_id` nulo grava (Review Focus 2); claims simuladas por `set_config('request.jwt.claims', ...)`: `aal1`, `aal2`, `amr` ausente, `amr` antigo, fator novo não aprovado, fator removido com JWT `aal2` antigo (Review Focus 5); usuário com `cargo='gestor'` forjado recebe `acesso_negado` (Review Focus 1); termo de busca hostil (Review Focus 3); funções D, E e F ausentes de `/rest/v1/rpc`; excluir conta de teste não falha e preserva a auditoria.
- [ ] **Step 4: Commit** (com autorização).

### Task 1.6: Cliente tipado das RPCs

**Files:**
- Create: `src/lib/admin.ts`, `tests/admin-lib.test.ts`

**Interfaces:**
- Produces: `type Envelope<T> = { ok: true; dados: T } | { ok: false; erro: CodigoErroAdmin }`; `CodigoErroAdmin` (todos os códigos do §5.7 e §5.8, mais `funcao_nao_instalada` e `erro_rede`); `chamarAdmin<T>(funcao: string, args?: Record<string, unknown>): Promise<Envelope<T>>` (traduz "função não existe" do PostgREST em `funcao_nao_instalada` e qualquer erro inesperado em `erro_rede`, nunca lança); `mensagemErroAdmin(c: CodigoErroAdmin): string` (português); `paginar(pagina: number, limite: number): { p_pagina: number; p_limite: number }` (limite máximo 200); `souAdmin(): Promise<boolean>`.

- [ ] **Step 1: Testes** (supabase mockado): `"devolve ok/dados"`, `"devolve erro do envelope sem lançar"`, `"função inexistente vira funcao_nao_instalada"`, `"limite acima de 200 é cortado"`, `"página negativa vira 1"`, `"cada código tem mensagem em português"`.
- [ ] **Step 2: Rodar** `npx vitest run tests/admin-lib.test.ts` → FAIL.
- [ ] **Step 3: Implementar** usando `supabase` de `src/lib/supabase.ts`.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** (com autorização).

### Task 1.7: Lógica de telas do MFA

**Files:**
- Create: `src/lib/adminMfa.ts`, `tests/admin-mfa.test.ts`

**Interfaces:**
- Produces: `type TelaMfa = "cadastro" | "verificacao" | "liberado" | "bloqueado"`; `decidirTela(atual: "aal1"|"aal2", proximo: "aal1"|"aal2"): TelaMfa` (a tabela do §5.8 R9); `iniciarCadastroTotp(): Promise<{ fatorId: string; criadoEm: string; qrDataUri: string; segredo: string }>`; `confirmarCadastro(fatorId: string, codigo: string)`; `verificarCodigo(codigo: string)` (challenge + verify; troca o token; `refreshSession()` só como reserva); `listarFatores()`; `mensagemMfa(codigo: string): string` (`mfa_verification_failed`, `mfa_challenge_expired`, `mfa_verification_rejected`).

- [ ] **Step 1: Testes:** os quatro pares de `decidirTela` (incluindo `aal2`/`aal1` → `bloqueado`); mensagens em português; **`"QR e segredo nunca vão para localStorage, sessionStorage nem console"`** (espiões em `Storage.prototype.setItem` e `console.*`); o código digitado não é devolvido nem guardado.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** com `supabase.auth.mfa.*`. Não há função de remover fator.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** (com autorização).

### Task 1.8: Layout `/admin`, telas de segurança, dashboard parcial e auditoria

**Antes de começar:** ler os guias de layouts, tratamento de erro e `proxy.ts` do Next 16 (G0.4). A sessão fica em `localStorage`, então `proxy.ts` não protege `/admin`; a guarda é cliente.

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/seguranca/page.tsx`, `src/app/admin/auditoria/page.tsx`, `src/components/admin/{AdminShell,AdminMenu,CartaoIndicador,GraficoBarrasSvg,TabelaPaginada,EstadoTela}.tsx`
- Modify: configuração de cabeçalhos (CSP com nonce, `nosniff`, `frame-ancestors 'none'`, `img-src data:` só em `/admin/seguranca`), no arquivo que o guia de CSP do Next 16 indicar.

**Interfaces:**
- Consumes: `chamarAdmin`, `souAdmin`, `mensagemErroAdmin` (T1.6); `decidirTela`, `iniciarCadastroTotp`, `confirmarCadastro`, `verificarCodigo`, `listarFatores` (T1.7).
- Produces: `<AdminShell>` (guarda + menu), `<TabelaPaginada<T> colunas busca filtros pagina total onPagina />`, `<CartaoIndicador titulo valor />`, `<GraficoBarrasSvg serie />`, `<EstadoTela estado="carregando|vazio|erro|nao_instalado|negado" />`.

- [ ] **Step 1:** Sem sessão → `/login`. `souAdmin()` falso → `registrar_tentativa_admin` e página "não encontrada". Com `souAdmin()` verdadeiro → `decidirTela` e as telas do R9. Só em `liberado` o painel é montado. Menu lateral no desktop, gaveta no celular; selo "Admin"; tema por tokens de `globals.css`; sem rolagem horizontal; alvos ≥ 44 px.
- [ ] **Step 2:** `/admin/seguranca`: cadastro (QR, segredo, **id completo e horário do fator**), verificação, lista de fatores sem opção de remover.
- [ ] **Step 3:** Dashboard: indicadores e gráficos de `admin_resumo` (sem dados pessoais); tela de Auditoria com abas "Ações" e "Acessos negados", mostra `cabeca` e total, botão de verificar que encadeia páginas.
- [ ] **Step 4:** Todas as telas tratam carregando, vazio, erro, "função não instalada" e acesso negado.
- [ ] **Step 5: Verificar:** `npx tsc --noEmit`, `npm run lint`, `npm run build` → sem erro.
- [ ] **Step 6: Verificação visual** (skill `run`): 390 px e 1280 px, tema claro e escuro, sem rolagem lateral. Sem migração aplicada, o painel mostra "não instalado".
- [ ] **Step 7: Commit** (com autorização).

### Task 1.9: Teste estático de segurança da interface

**Files:**
- Create: `tests/admin-ui-seguranca.test.ts`

- [ ] **Step 1: Testes:** `"sem dangerouslySetInnerHTML, innerHTML, eval(, new Function, <iframe em src/app/admin, src/components/admin e src/app/api"`; `"SOLICITACOES_SEGREDO_SERVIDOR, EMAIL_API_KEY e SERVICE_ROLE não aparecem em código de cliente nem com NEXT_PUBLIC_"`; `"service_role não existe no repositório (fora de docs e testes)"`; `"links de terceiros só https/mailto com rel=noreferrer"`; `"/admin não importa useFinanceStore"`.
- [ ] **Step 2: Rodar** `npx vitest run tests/admin-ui-seguranca.test.ts` → PASS (falha se T1.8 violou algo).
- [ ] **Step 3: Rodar a suíte completa** `npx vitest run` → tudo verde, incluindo os 17 testes que já existiam.
- [ ] **Step 4: Commit** (com autorização).

### Procedimento de aplicação da migração 20 (resumo; o relatório da fase 1 traz o passo a passo)

1. G0.2 e G0.3 confirmados; G1.1 revisão do SQL. 2. Autorização expressa. 3. Aplicar `supabase/supabase-20-admin-base.sql` numa única transação (ela se pré-checa e aborta sozinha). 4. Conferir postura e a lista de objetos. 5. Com nova autorização, rodar `supabase/testes/admin-base.sql` e exigir `0 falha(s)`. 6. Ativação do admin (G1.4) e testes de token real (G1.5).

### Portões da Fase 1 (todos esperam você)

- [ ] **G1.1** Revisão do arquivo `supabase-20-admin-base.sql` por você.
- [ ] **G1.2** Autorização para **aplicar a migração 20** (ela se pré-checa e aborta sozinha). Antes: conferir G0.3. Depois: conferir que as funções D/E/F não aparecem na API.
- [ ] **G1.3** Autorização para rodar `supabase/testes/admin-base.sql` (rollback). Resultado registrado no §18.5 do spec ou em arquivo de resultados à parte.
- [ ] **G1.4 — Ativação do primeiro admin (§5.8 R3), uma sessão só, cada passo com sua autorização:** (1) código da fase publicado e migração aplicada; (2) você insere o seu `user_id` em `admin_usuarios` (`ativo = true`, `fatores_aprovados = '{}'`); (3) cadastra o TOTP em `/admin/seguranca` e confere id e horário; (4) autoriza o `update ... fatores_aprovados = array['<id>']`; (5) sai, entra, verifica o TOTP; (6) cadastra o segundo fator. Se id ou horário não baterem: remover o fator e recomeçar.
- [ ] **G1.5 — V10.7 com `teste-admin`:** inspecionar um token `aal2` real e decidir sobre a regra `amr` (#30); testar se `listFactors()` inclui fatores não verificados (#31); testar cadastro com fator existente em `aal1` (deve falhar com `insufficient_aal`); testar JWT `aal2` após remover o fator (`mfa_nao_configurada`).

**Se qualquer passo do G1.4 ou G1.5 falhar, parar. Não seguir para a Fase 2.**

---

# Fase 2 — Usuários (sem nova migração)

As RPCs `admin_listar_usuarios` e `admin_usuario_detalhe` já estão na migração 20. **Critério de conclusão:** listagem, busca, filtros, paginação e ficha funcionam com `teste-admin`; `teste-comum` não vê nada; auditoria registra o termo buscado e a abertura da ficha.

### Task 2.1: Lista de usuários

**Files:**
- Create: `src/app/admin/usuarios/page.tsx`, `src/components/admin/FiltrosUsuarios.tsx`
- Test: `tests/admin-lib.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `chamarAdmin("admin_listar_usuarios", {...})`, `TabelaPaginada`.
- Produces: `type UsuarioLinha = { id: string; email: string; nome: string | null; provedor: string; cadastro: string; ultimo_acesso: string | null; email_confirmado: boolean; grupo: string | null; cargo_informado: string | null; lancamentos: number }`; `FILTROS_USUARIOS` (`com_grupo`, `sem_grupo`, `ativos_7`, `ativos_30`, `nunca_acessou`, `novos_7`).

- [ ] **Step 1: Testes** em `tests/admin-lib.test.ts`: `"montarArgsListarUsuarios envia busca, filtro e paginação"`; `"termo vazio vira null"`; `"filtro fora da lista é descartado antes de chamar"`.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** a página: busca com atraso (debounce), filtros, paginação no servidor; no celular cartões empilhados; coluna `cargo` titulada "Cargo (informado pelo usuário)". Convidados não aparecem. Texto sempre escapado.
- [ ] **Step 4: Rodar** `npx vitest run` e `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** (com autorização).

### Task 2.2: Ficha do usuário (sem suporte ainda)

**Files:**
- Create: `src/app/admin/usuarios/[id]/page.tsx`, `src/components/admin/FichaUsuario.tsx`

- [ ] **Step 1:** Ler o guia de rotas dinâmicas do Next 16 (parâmetros assíncronos, se for o caso nesta versão).
- [ ] **Step 2:** Ficha: perfil, grupo, integrantes (convidados marcados), contagens, últimos erros e solicitações (vazios até a Fase 4), botão "Abrir suporte" **desabilitado** com texto "disponível na fase 3". Nunca mostra colunas legadas financeiras.
- [ ] **Step 3: Verificar:** alvo sem grupo, convidado, conta sem perfil renderizam sem erro (Review Focus 4). `tsc`, `lint`, `build`.
- [ ] **Step 4: Commit** (com autorização).

**Portão G2:** teste manual com `teste-admin` e `teste-comum`. Nenhum SQL.

---

# Fase 3 — Suporte somente leitura: migração 23

**Critério de conclusão:** o suporte devolve só os campos do §6.4 das linhas elegíveis; aba financeira sem confirmação devolve `aba_nao_confirmada` e registra; privados e partilhados de outros integrantes nunca saem; md5 das tabelas de domínio idêntico antes e depois; sessão expirada, encerrada, de outro admin ou de admin desativado não lê nada.
**Portão de deploy: Política de Privacidade revisada (G3.0).** O código pode ser desenvolvido antes, mas não publicado em produção sem isso.

### Task 3.0: Portão G-CSP — CSP definitiva (OBRIGATÓRIO antes de publicar a fase 3)

A fase 1 e a fase 2 usam a CSP temporária de `src/proxy.ts` (`script-src 'self' 'unsafe-inline'`), porque o nonce é incompatível com `cacheComponents` (provado com `next build` + `next start`). A fase 3 mostra lançamentos financeiros: **não é publicada nem aplicada em produção sem este portão.**

- [ ] **Step 1:** Escolher, com você, a solução (spec §11, em ordem de preferência): (1) `/admin` em aplicação Next separada, sem `cacheComponents`, com nonce (**único caminho técnico viável**: `experimental.sri` foi refutada em 2026-11-05, pois o HTML mantém 11 scripts inline que `script-src 'self'` bloqueia e o painel não hidrata); (2) sem isso, a fase 3 fica restrita a contagens, sem lançamentos.
- [ ] **Step 2:** Teste automatizado novo (`tests/admin-ui-seguranca.test.ts`): a política de `/admin` não contém `'unsafe-inline'` em `script-src` e contém nonce ou integridade; falha enquanto isso não for verdade.
- [ ] **Step 3:** Prova funcional: `/admin` carrega e funciona com a política final (`next build` + `next start` e navegador), nos temas claro e escuro, em 390 e 1280 px.
- [ ] **Step 4:** Registrar o resultado no spec (§11) e só então liberar as tarefas 3.1 em diante para publicação.

### Task 3.1: Testes de elegibilidade e de campos permitidos (antes da migração)

**Files:**
- Create: `tests/sql-elegibilidade.test.ts`
- Modify: `tests/helpers/sqlArquivos.ts` (acrescentar a migração 23 e as funções A/D novas a `CATEGORIAS`)

- [ ] **Step 1: Testes sobre o SQL:** `"a pré-checagem aborta se faltam owner_id, responsavel_id, privado ou compartilhado_com em extrato e cartao, ou compartilhado_com/owner_id/responsavel_id em contas_fixas"`; `"contas_fixas não referencia a coluna privado"`; `"nenhum to_jsonb( devolvido sem campos_permitidos"`; `"as listas do §6.4 estão no arquivo e não contêm privado, compartilhado_com, avatar_url, usuario_id, salario, investido, reserva_atual, reserva_meta de perfis"`; `"to_regclass protege o ramo fechamento"`; `"varredura de escrita: só insert/update nas tabelas da lista do §5.5"`; `"nenhuma referência a perfis.cargo para decidir elegibilidade"`.
- [ ] **Step 2: Modelar a regra em TypeScript** (`tests/helpers/elegivel.ts`, `elegivelSuporte(linha, alvoId, perfisDoAlvo): boolean`) e testar os casos do §6.5: linha privada de outro membro, partilhada com o alvo, partilhada com terceiro, `privado` nulo, alvo sem grupo, linha de grupo antigo, lançamento privado do próprio alvo.
- [ ] **Step 3: Rodar** → FAIL (sem migração).
- [ ] **Step 4: Commit** (com autorização).

### Task 3.2: Migração 23

**Files:**
- Create: `supabase/supabase-23-admin-suporte.sql`

**Interfaces:**
- Produces: tabelas `public.admin_sessoes_suporte`, `public.admin_suporte_confirmacoes` (sem acesso pela API); D: `homecash_interno.campos_permitidos(p_linha jsonb, p_permitidos text[]) returns jsonb`, `homecash_interno.elegivel_suporte(...) returns boolean` (falha fechada); A: `admin_suporte_iniciar(p_user uuid, p_motivo text)`, `admin_suporte_confirmar(p_sessao uuid, p_aba text)`, `admin_suporte_ler(p_sessao uuid, p_recurso text, p_mes text, p_pagina int, p_limite int)`, `admin_suporte_encerrar(p_sessao uuid)`; atualiza `admin_usuario_detalhe` **por uma função nova** (`admin_usuario_contagens`), sem alterar a função da migração 20.

- [ ] **Step 1:** Pré-checagem de colunas e do que a migração 20 já criou; aborta com mensagem clara.
- [ ] **Step 2:** Um ramo explícito por recurso (§6.2), sem SQL dinâmico; `to_regclass` para `fechamento_*`; `p_limite` ≤ 200; `total` e `omitidas`.
- [ ] **Step 3:** Todo caminho de falha devolve envelope e registra antes (§5.7): `sessao_invalida`, `aba_nao_confirmada`, `recurso_invalido`, `parametro_invalido`.
- [ ] **Step 4:** Iniciar sessão encerra a anterior do mesmo admin (com auditoria); motivo < 10 letras → `parametro_invalido`.
- [ ] **Step 5:** Validação de estrutura, assert de postura, desfazer comentado.
- [ ] **Step 6: Rodar** `npx vitest run tests/sql-migracoes.test.ts tests/sql-funcoes-categorias.test.ts tests/sql-elegibilidade.test.ts` → PASS.
- [ ] **Step 7: Commit** (com autorização).

### Task 3.3: Roteiro de banco do suporte

**Files:**
- Create: `supabase/testes/admin-suporte.sql`

- [ ] **Step 1:** Casos, tudo em `begin ... rollback`: md5 das tabelas de domínio antes e depois de uma sessão completa; chaves devolvidas iguais à lista esperada por recurso (detecta erro de digitação nas listas); os 7 casos de `elegivel_suporte`; **Review Focus 4** (alvo sem grupo; perfil com colunas legadas preenchidas não devolve essas colunas); **Review Focus 6** (admin desativado com sessão aberta; sessão que expira entre duas leituras; sessão de outro admin); confirmação por aba; contagens da ficha respeitam a regra; `fechamento` com e sem as tabelas.
- [ ] **Step 2: Commit** (com autorização).

### Task 3.4: Interface do suporte

**Files:**
- Create: `src/lib/adminSuporte.ts`, `src/components/admin/suporte/{FaixaSuporte,AbasSuporte,AbaTabela,ConfirmarAba,ModalMotivo}.tsx`, `tests/admin-suporte.test.ts`
- Modify: `src/app/admin/usuarios/[id]/page.tsx`, `src/components/admin/FichaUsuario.tsx` (habilitar "Abrir suporte")

**Interfaces:**
- Produces: `iniciarSuporte(user: string, motivo: string)`, `confirmarAba(sessao: string, aba: AbaSuporte)`, `lerRecurso(sessao: string, recurso: RecursoSuporte, mes?: string, pagina?: number)`, `encerrarSuporte(sessao: string)`; `ABA_DO_RECURSO: Record<RecursoSuporte, AbaSuporte>`; `restanteSegundos(expiraEm: string, agora: Date): number`; `ABAS_FINANCEIRAS`.

- [ ] **Step 1: Testes:** `"recurso financeiro exige confirmação antes da primeira leitura da aba"`; `"motivo com menos de 10 letras é recusado no cliente"`; `"faixa mostra tempo restante e some ao expirar"`; `"ao expirar, a tela descarta os dados em memória"`; `"mensagem de lançamentos omitidos usa a contagem"`; `"totais calculados avisam que usam só as linhas exibidas"`; `"nenhum dado do suporte vai para localStorage, sessionStorage ou console"`.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar.** Telas **próprias**, sem `useFinanceStore` nem botões de escrita; reaproveitar só funções puras de `src/lib` se ajudar. Faixa fixa "MODO SUPORTE · somente leitura · {nome/e-mail} · expira em mm:ss".
- [ ] **Step 4: Verificar:** `npx vitest run`, `tsc`, `lint`, `build`; visual em 390/1280 px, claro/escuro.
- [ ] **Step 5: Commit** (com autorização).

### Portões da Fase 3
- [ ] **G3.0** Política de Privacidade e Termos revisados e publicados **(tarefa separada, antes do deploy de produção)**.
- [ ] **G3.1** Revisão do SQL por você; **G3.2** autorização para aplicar a migração 23; **G3.3** autorização para rodar `admin-suporte.sql`; **G3.4** teste manual com `teste-admin` sobre `teste-alvo` (privado e partilhado do alvo aparecem; de outro integrante, não). **Nenhuma conta real é aberta antes de G3.0.**

---

# Fase 4 — Erros e solicitações: migração 24

**Critério de conclusão:** erros do app são gravados com sanitização e limite; usuário cria e lê só as próprias solicitações; usuário nunca lê `erros_app`; admin lista, agrupa e atualiza com auditoria; `user_id` zera ao excluir a conta; o app continua igual (sem migração aplicada, o captador e o botão falham em silêncio).
**Portão de deploy:** G3.0 (Política de Privacidade cobre erros técnicos).

### Task 4.1: Sanitização e captura de erros no cliente

**Files:**
- Create: `src/lib/erros.ts`, `src/components/CaptadorErros.tsx`, `tests/erros-sanitizacao.test.ts`

**Interfaces:**
- Produces: `sanitizarMensagem(s: string): string` (remove query string, fragmento, JWT/token e e-mails; corta em 500); `sanitizarStack(s: string): string` (corta em 4000); `registrarErro(e: { origem: "janela"|"promessa"|"react"|"rpc"|"manual"; mensagem: string; stack?: string; tela?: string; contexto?: Record<string, unknown> }): Promise<void>` (nunca lança; trava contra laço; limite de disparo no cliente).

- [ ] **Step 1: Testes:** token JWT removido; e-mail removido; `?code=...#access_token=...` removido; corte em 500/4000; falha da RPC não lança; erro dentro do próprio `registrarErro` não gera laço; limite local de disparos; nenhum valor financeiro ou corpo de requisição no contexto.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar. Step 4: Rodar** → PASS.
- [ ] **Step 5:** Captador (`error`, `unhandledrejection`) montado em `src/app/layout.tsx` (única alteração; ler antes o guia de tratamento de erro do Next 16 e o `layout.tsx` atual). Conferir que o app abre igual com e sem migração.
- [ ] **Step 6: Commit** (com autorização).

### Task 4.2: Migração 24

**Files:**
- Create: `supabase/supabase-24-erros-solicitacoes.sql`
- Modify: `tests/helpers/sqlArquivos.ts` (classificar as funções novas)

**Interfaces:**
- Produces: tabelas `public.erros_app`, `public.solicitacoes` (+ `homecash_interno.solicitacoes_envios`, criada junto da solicitação); B: `registrar_erro(p_origem text, p_mensagem text, p_stack text, p_tela text, p_rota text, p_user_agent text, p_versao_app text, p_contexto jsonb) returns jsonb`, `criar_solicitacao(p_tipo text, p_titulo text, p_descricao text, p_tela text) returns jsonb`; A: `admin_listar_erros`, `admin_atualizar_erro(p_id bigint, p_status text, p_nota text)`, `admin_listar_solicitacoes`, `admin_atualizar_solicitacao(p_id uuid, p_status text, p_resposta text)`, `admin_resumo_operacao()`.

- [ ] **Step 1:** Limites com `pg_advisory_xact_lock(<classe de limites>, hashtext(...))` antes da contagem: 30 erros por 10 min; 5 solicitações por hora; excedente de erro devolve `{"ok":true,"descartado":true}`, de solicitação `limite_excedido`.
- [ ] **Step 2:** `user_id ... on delete set null` (sem tocar em `excluir_minha_conta`); RLS: usuário lê só as próprias solicitações; **nenhuma** política em `erros_app`; nenhum `insert/update/delete` direto.
- [ ] **Step 3:** Validação de estrutura, assert de postura, desfazer comentado.
- [ ] **Step 4: Rodar** os testes estáticos → PASS. **Step 5: Commit** (com autorização).

### Task 4.3: Roteiro de banco, lib de solicitações, botão e telas admin

**Files:**
- Create: `supabase/testes/admin-erros-solicitacoes.sql`, `src/lib/solicitacoes.ts`, `src/components/SolicitacaoModal.tsx`, `src/app/admin/erros/page.tsx`, `src/app/admin/solicitacoes/page.tsx`, `tests/solicitacoes-lib.test.ts`
- Modify: `src/components/TelaAjuda.tsx` (botão "Reportar problema ou sugerir" e lista "Minhas solicitações" — **única mudança visível no app**), `src/app/admin/page.tsx` (indicadores de erros e solicitações)

**Interfaces:**
- Produces: `criarSolicitacao(d: { tipo: "bug"|"problema"|"sugestao"; titulo: string; descricao: string; tela?: string }): Promise<Envelope<{ id: string }>>`; `listarMinhasSolicitacoes()`; `validarFormularioSolicitacao(d): string | null` (título ≤ 120, descrição ≤ 4000).

- [ ] **Step 1: Testes** em `tests/solicitacoes-lib.test.ts` (limites de tamanho, tipo fora da lista, `limite_excedido` traduzido). **Step 2: Rodar** → FAIL. **Step 3: Implementar. Step 4: Rodar** → PASS.
- [ ] **Step 5:** Telas admin com agrupamento por `impressao`, mudança de status/nota/resposta, e conteúdo de terceiros **sempre como texto**. Ler `TelaAjuda.tsx` inteiro antes de editar.
- [ ] **Step 6:** Roteiro de banco (rollback): usuário comum não lê `erros_app` nem solicitação alheia; limite com chamadas simultâneas; excluir conta zera `user_id`; códigos registráveis registram.
- [ ] **Step 7: Verificar:** `vitest`, `tsc`, `lint`, `build`; `/`, `/login`, `/perfil` abrem como antes. **Step 8: Commit** (com autorização).

### Portões da Fase 4
- [ ] **G4.1** revisão do SQL; **G4.2** autorização para aplicar a migração 24; **G4.3** roteiro de banco; **G4.4** teste manual com `teste-comum` e `teste-admin`; **G4.5** G3.0 antes do deploy.

---

# Fase 5 — Anexos e e-mail: migração 25

**Pré-requisitos:** migração 24 aplicada; **E7** (leitura de `storage.buckets` e das políticas de `storage.objects`, #13) com sua autorização; `sharp` aprovado e instalável sem scripts (#16); provedor de e-mail e remetente definidos (#17); G3.0.
**Critério de conclusão:** os critérios de aceite do §10 e §15 sobre anexos, segredo, reserva de e-mail e concorrência.

### Task 5.0: Pré-voo (sem SQL de escrita)

- [ ] **G5.1** Autorização para executar **E7** (somente `select`): bucket `avatars`, `storage.buckets` e suas colunas, políticas de `storage.objects`. Registrar no §18.5. Se houver política permissiva sem `bucket_id`, **parar**: a migração 25 abortaria por desenho.
- [ ] **G5.2** Autorização para `npm install sharp` sem scripts de instalação; conferir build local e, na Vercel, memória, tempo e tamanho de resposta para 4 imagens de 16 MP (#16). Se não couber, voltar com alternativa; não improvisar.
- [ ] **G5.3** Ler `node_modules/next/dist/docs/01-app/` sobre route handlers e `cacheComponents`.

### Task 5.1: Validação de imagem no servidor

**Files:**
- Create: `src/lib/servidor/anexos.ts`, `tests/servidor-anexos.test.ts`, fixtures em `tests/fixtures/imagens/`

**Interfaces:**
- Produces: `validarImagem(bytes: Uint8Array, mimeDeclarado: string): Promise<{ ok: true; mime: "image/png"|"image/jpeg"|"image/webp"; bytes: Uint8Array; largura: number; altura: number; sha256: string } | { ok: false; motivo: string }>` (os 9 passos do §10.1: tamanho real, bytes mágicos, decodificação inteira com `failOn: 'error'` e `limitInputPixels` 16 000 000, 16–4096 px, formato decodificado igual ao declarado, rotação EXIF, recodificação sem metadados ≤ 3 MB, SHA-256 do resultado).

- [ ] **Step 1: Testes:** JPEG, PNG e WEBP válidos passam e a saída não tem EXIF; truncado, SVG, GIF, HTML renomeado `.png`, poliglota, acima de 4096 px, acima de 16 MP, acima de 3 MB reais, formato diferente do declarado → rejeitados. **Step 2: Rodar** → FAIL. **Step 3: Implementar. Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** (com autorização).

### Task 5.2: E-mail, segredo e máquinas de estado

**Files:**
- Create: `src/lib/servidor/email.ts`, `src/lib/servidor/segredo.ts`, `tests/email-solicitacao.test.ts`, `tests/anexos-ciclo.test.ts`, `tests/email-ciclo.test.ts`, `tests/helpers/maquinaReserva.ts`

**Interfaces:**
- Produces: `montarEmail(s: SolicitacaoParaEmail, anexos: AnexoValidado[], env: { destino: string; remetente: string }): { assunto: string; texto: string; anexos: ... }` (assunto sem CR/LF, ≤ 120 caracteres, com o id; nomes sanitizados; texto puro; destinatário só de `env`); `lerSegredoServidor(): string` (`import "server-only"`; lança se ausente; nunca registra); `reservar(estado, agora)`, `concluir(estado, token, resultado)` em `maquinaReserva.ts` (modelo da reserva com prazo, 3 tentativas, token antigo recusado).

- [ ] **Step 1: Testes:** assunto sem quebras de linha, corte, nome de arquivo hostil, destinatário nunca do cliente; ciclos de anexo e de e-mail (reserva viva bloqueia, reserva vencida retoma, 4ª tentativa recusada, `registrado` expira em 1 h, token antigo recusado, `em_andamento` bloqueia e-mail). **Step 2: Rodar** → FAIL. **Step 3: Implementar. Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** (com autorização).

### Task 5.3: Migração 25

**Files:**
- Create: `supabase/supabase-25-solicitacoes-anexos-email.sql`
- Modify: `tests/helpers/sqlArquivos.ts`

**Interfaces:**
- Produces: colunas de e-mail em `solicitacoes` (`add column if not exists`); `public.solicitacoes_anexos`; D/internas: `homecash_interno.servidor_segredos`, `anexos_validacao`, `anexo_leituras`, `segredo_valido(p_segredo text)`; C: `solicitacao_email_reservar(p_id uuid, p_segredo text)`, `solicitacao_email_concluir(p_id uuid, p_token uuid, p_resultado text, p_erro text, p_segredo text)`, `anexo_validacao_reservar(p_anexo uuid, p_segredo text)`, `anexo_validacao_concluir(p_anexo uuid, p_token uuid, p_resultado text, p_dados jsonb, p_segredo text)`; B: `registrar_anexo(p_solicitacao uuid, p_nome text, p_mime text, p_bytes int)`; A: `admin_abrir_anexo(p_anexo uuid)`; E: `pode_registrar_anexo`, `pode_gravar_final`, `pode_apagar_bruto`, `pode_apagar_final`, `pode_ler_proprio`, `admin_pode_ler_anexo` (todas `(p_nome text) returns boolean`); bucket `solicitacoes-anexos` privado, 3 MB; políticas `homecash_anexos_*` em `storage.objects`, uma por comando, todas com `bucket_id`.

- [ ] **Step 1:** A migração só cria a tabela de segredos **vazia**. O hash do segredo é inserido por você, fora do Git (G5.5).
- [ ] **Step 2:** Reserva de e-mail e de anexo = **um único `update`** em `solicitacoes_envios`/`anexos_validacao` com todas as condições no `where`. Dono conferido antes por consulta separada.
- [ ] **Step 3:** `admin_pode_ler_anexo` repete as condições 1–5 do §5.8 em modo somente leitura, sem registrar.
- [ ] **Step 4:** Pré-checagem: aborta se o bucket existir público/divergente ou se houver política permissiva sem `bucket_id`. Plano B: bucket criado por você no painel, migração mantém só as políticas.
- [ ] **Step 5:** Validação de estrutura, assert de postura, desfazer comentado. **Step 6: Rodar** testes estáticos → PASS. **Step 7: Commit** (com autorização).

### Task 5.4: Route handler, cliente de anexos, tela admin

**Antes:** ler o guia de route handlers do Next 16 (`cacheComponents`).

**Files:**
- Create: `src/app/api/solicitacoes/[id]/processar/route.ts`, `supabase/testes/admin-anexos-email.sql`
- Modify: `src/lib/solicitacoes.ts`, `src/components/SolicitacaoModal.tsx`, `src/app/admin/solicitacoes/page.tsx`, `package.json`, `README.md`

**Interfaces:**
- Produces: `POST /api/solicitacoes/[id]/processar` → `200 { ok, estado: "enviado"|"em_andamento"|"falhou"|"ja_enviado" }`; `anexarImagem(solicitacaoId: string, arquivo: File)` e `pedirProcessamento(solicitacaoId: string)` em `src/lib/solicitacoes.ts`; `abrirAnexo(anexoId: string): Promise<string>` (chama `admin_abrir_anexo`, depois `createSignedUrl(caminho, 60)`).

- [ ] **Step 1:** Handler: valida o JWT com `supabase.auth.getUser(token)`; cliente com o JWT do usuário; valida anexos; reserva; envia; conclui. **Nunca** `service_role`; nunca registra `process.env`, cabeçalhos nem corpo das chamadas ao Supabase. Idempotente.
- [ ] **Step 2:** Admin só abre anexo `validado` por `admin_abrir_anexo`, em `<img>` com URL assinada de 60 s.
- [ ] **Step 3:** Roteiro de banco: segredo errado → `segredo_invalido` registrado e nada muda; 5 falhas em 10 min → `limite_excedido`; duas chamadas simultâneas de reserva → uma só ganha; reserva vencida retoma; token antigo recusado; rotação com sobreposição; anexo preso em `validando` volta em 5 min e vira `rejeitado` após 3; `registrado` sem arquivo expira em 1 h; concessão de 2 min; sem MFA válido a leitura do anexo falha mesmo com concessão.
- [ ] **Step 4:** `README.md` lista **só os nomes** das variáveis (`EMAIL_API_KEY`, `SOLICITACOES_EMAIL_DESTINO`, `SOLICITACOES_SEGREDO_SERVIDOR`, remetente).
- [ ] **Step 5: Verificar:** `vitest`, `tsc`, `lint`, `build`; `tests/admin-ui-seguranca.test.ts` continua verde. **Step 6: Commit** (com autorização).

### Portões da Fase 5
- [ ] **G5.4** revisão do SQL; **G5.5** você gera o segredo na sua máquina, calcula o SHA-256 e insere **só o hash** (slot `atual`), e configura a variável na Vercel; **G5.6** autorização para aplicar a migração 25; **G5.7** roteiro de banco; **G5.8** teste ponta a ponta com `teste-comum` (imagem válida, imagem inválida, queda simulada) e `teste-admin`; **G5.9** G3.0 antes do deploy.

---

# Critérios de conclusão do projeto

1. Todos os critérios do §15 do spec verificados, cada um por teste local ou roteiro de banco registrado.
2. `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` verdes.
3. App atual (`/`, `/login`, `/perfil`) igual ao anterior, com e sem as migrações.
4. Nenhuma função nova executável por `anon`; D, E e F fora de `/rest/v1/rpc`.
5. A trilha paralela (E5-1, E4-2, E4-3, E5b-1 a E5b-6) continua listada como aberta, a menos que você mande tratar.

# Riscos e pontos que dependem de você

| Risco / ponto | Mitigação no plano | Decisão sua |
|---|---|---|
| XSS rouba o JWT do admin (token em `localStorage`) | Texto escapado, CSP, teste estático, MFA `aal2` | — |
| Perda do aplicativo autenticador | Dois fatores; recuperação pelo Supabase (R8) | Cadastrar o segundo fator (G1.4) |
| `amr` pode não existir no token | Regra de frescor só se o token real confirmar (#30) | Resultado do G1.5 |
| Migração falha no meio | Transação única, pré-checagem, estrutura validada, desfazer comentado | Autorizar cada aplicação |
| Suporte vaza lançamento de terceiros | Regra fechada, teste da regra em TS e no banco, md5 antes/depois | Afrouxar ou não o §6.5 |
| Vazamento do segredo de servidor | Só hash no banco, rotação, bloqueio de tentativas, incidente documentado | Gerar e guardar o segredo (G5.5) |
| `sharp` na Vercel (memória, tempo) | Pré-voo G5.2 | Aprovar a dependência |
| Entrega de e-mail "pelo menos uma vez" | Id no assunto, idempotência do provedor se houver | Provedor e remetente |
| Política de Privacidade defasada | Portão G3.0 antes do deploy das fases 3–5 | Tarefa separada e prazo |
| E5-1 continua aberto | Painel não depende de `perfis`; rótulo "informado pelo usuário" | Quando aplicar migração 12 |
| Árvore com alterações alheias | Branch própria, `git add` por arquivo | G0.1 |
| Colisão de numeração (19, 21 e 22 já existem no repositório) | Resolvida: painel usa 20, 23, 24 e 25; os três arquivos existentes ficam intocados | — |

# Autorizações que o plano vai pedir (resumo)

G0.1 branch · G0.2/G0.3 configurações do Supabase (você) · G1.2 aplicar migração 20 · G1.3 roteiro · G1.4 ativação do admin (5 passos) · G1.5 testes de token · G3.0 Política de Privacidade · G3.2/G3.3 migração 23 e roteiro · G4.2/G4.3 migração 24 e roteiro · G5.1 E7 · G5.2 `sharp` · G5.5 segredo e variáveis na Vercel · G5.6/G5.7 migração 25 e roteiro · todos os commits, pushes e deploys.

---

## Autorrevisão (feita)

- **Cobertura do spec:** §5 (T1.3–T1.5), §5.8 (T1.4, T1.7, T1.8, G1.4–G1.5), §6 (T3.1–T3.4), §7 (T1.4, T1.8, T4.3), §8 (T1.4, T2.1–T2.2), §9 (T4.1–T4.2), §10 (T5.1–T5.4), §11 (T1.8, T1.9), §12 (T1.1, padrão global), §13/§14/§15 (portões e critérios). Sem lacuna encontrada.
- **Consistência de nomes:** `chamarAdmin`, `Envelope`, `decidirTela`, `TabelaPaginada` e as RPCs usam o mesmo nome em todas as tarefas. A migração 20 contém `admin_listar_usuarios`/`admin_usuario_detalhe` (como no §12.1); a Fase 2 é só interface.
- **Pontos conscientes:** a contagem de lançamentos da ficha é parcial na migração 20 e completa na 23 (função nova, sem alterar a antiga); `admin_resumo` devolve `null` para erros/solicitações até a migração 24.
