# Auditoria de segurança — SAAS FINANCEIRO (pré-beta)

Data: 21/10/2026 · Escopo: isolamento de dados por usuário/grupo, RLS, proteção de credenciais Supabase.

## 1. Resumo executivo

| Critério de aceite | Status | Observação |
|---|---|---|
| Usuários não acessam dados de terceiros | ⚠️ **NÃO VALIDADO** | Depende de RLS que **não está versionada** no repositório. Há 4 riscos fortes no fluxo de grupos (F-01 a F-04). Testes prontos, execução pendente. |
| Permissões aplicadas no banco | ⚠️ **NÃO VERIFICADO** | Nenhuma política/migration no repo (`supabase/migrations` é citada no `LEIA-ME.md` mas não existe). Diagnóstico SQL pronto. |
| Sem credenciais privilegiadas no cliente | ✅ **VALIDADO** (código, histórico Git e bundle) | Falta só conferir as variáveis na Vercel (checklist §5). |
| Testes de isolamento executados e documentados | ⚠️ **PENDENTE** | Suíte criada (103 testes), validada apenas quanto a tipos e a "pular sem credenciais". **Não foi executada contra um Supabase.** |

> **Princípio seguido:** a interface esconder dados **não** conta como segurança. Por isso os testes
> (`tests/rls/isolamento.rls.ts`) falam direto com a API do Supabase usando contas distintas.

**O que NÃO foi possível fazer nesta auditoria:** acessar o painel do Supabase, a Vercel ou o banco.
Tudo que depende deles está marcado como *pendente* e tem um passo a passo na §5. Nada foi
considerado seguro por suposição.

## 2. Achados

Legenda de status: **CORRIGIDO** (alterado no repo) · **CONFIRMAR NO BANCO** (risco visível no código; só os testes/diagnóstico dizem se o RLS já cobre) · **OK**.

### Fluxo de grupos e permissões (maior risco)

| ID | Sev. | Achado | Onde | Status |
|---|---|---|---|---|
| F-01 | 🔴 Crítico | **Entrar em um grupo exige apenas conhecer o UUID.** O cliente faz `upsert` do próprio perfil com `grupo_id` digitado. Como a leitura do grupo é por `grupo_id` (`.or(...grupo_id.eq.X)`), quem obtiver o UUID passa a ver o financeiro de todos. Não há convite, expiração nem aprovação do gestor. | `GrupoModal.tsx` (modo "entrar", upsert ~l.108); `grupo/page.tsx` exibe o UUID para copiar | CONFIRMAR NO BANCO |
| F-02 | 🔴 Crítico | **`cargo` é definido pelo próprio cliente** (`"gestor"`/`"membro"`). Se o RLS de `perfis` permitir UPDATE do próprio registro sem restringir colunas, qualquer membro se promove a gestor. RLS não restringe colunas por si só: exige trigger ou RPC. | `grupo/page.tsx:49`; `GrupoModal.tsx` (~l.94 e ~l.108) | CONFIRMAR NO BANCO |
| F-03 | 🟠 Alto | **Escrita em perfis de terceiros pelo cliente**: alterar cor e **excluir** membro usam só `.eq("id", membroId)`; não há checagem de "sou o gestor?" no código. A autorização inteira recai sobre o RLS. | `GrupoModal.tsx:74, 157`; `ResponsavelPanel.tsx:69` | CONFIRMAR NO BANCO |
| F-04 | 🟠 Alto | **Campos de autoria e escopo vêm do cliente**: `owner_id`, `usuario_id`, `grupo_id`, `responsavel_id`, `privado`, `compartilhado_com` (e `user_id`/`caixinha_id` em movimentos). Sem `WITH CHECK` correto, é possível lançar dados em nome de outro usuário, injetar lançamentos no grupo alheio ou criar movimento em caixinha de terceiros. | `useFinanceStore.ts` (payloads ~l.164–176, 213–225, 256–270); `useCaixinhas.ts:39` | CONFIRMAR NO BANCO |
| F-05 | 🟠 Alto | **`privado` / `compartilhado_com` só são respeitados se o RLS os implementar.** O filtro do frontend (`owner_id`, `responsavel_id` ou `grupo_id`) **não** considera `privado`; se o banco não filtrar, lançamentos privados vazam para o grupo. | `useFinanceStore.ts:114–120` | CONFIRMAR NO BANCO |

### Dados, storage e integridade

| ID | Sev. | Achado | Onde | Status |
|---|---|---|---|---|
| F-06 | 🟡 Médio | **Storage `avatars`**: upload com `upsert: true` e URL pública. Precisa de política por pasta (`<uid>/…`) para B não sobrescrever/remover avatar de A. As URLs públicas são acessíveis a quem as tiver (aceitável para avatar, mas é decisão consciente). | `PerfilConta.tsx:61–67` | CONFIRMAR NO BANCO |
| F-07 | 🟡 Médio | **Operações em várias etapas, sem transação**: criar grupo → atualizar perfil; criar caixinha → lançar saldo inicial; editar caixinha → ajuste de saldo. Falha no meio deixa estado inconsistente (grupo sem gestor, caixinha sem saldo). Não vaza dados, mas afeta integridade das movimentações vinculadas. | `grupo/page.tsx`; `useCaixinhas.ts` (criar/editar) | Recomendação (RPC transacional) |
| F-08 | 🟡 Médio | **Exclusão de caixinha vs. movimentos**: o código só apaga a caixinha; órfãos dependem de `ON DELETE CASCADE` no banco. | `useCaixinhas.ts:213` | CONFIRMAR NO BANCO |
| F-09 | 🔵 Baixo | `grupo_id` do perfil é interpolado em `.or("…grupo_id.eq.${gId}")`. Se a coluna for `text` (não `uuid`), um valor malicioso (o usuário digita o valor em "entrar") poderia alterar o filtro. O RLS continua valendo, mas confirme o tipo. | `useFinanceStore.ts:114`; `GrupoModal` | CONFIRMAR (diag. SQL nº 9) |
| F-10 | 🔵 Baixo | RPC `criar_opcoes_padrao` é chamada a cada carregamento. Confirmar que é `SECURITY DEFINER` com `search_path` fixo e usa `auth.uid()` (sem receber `user_id`). | `useOpcoes.ts:43` | CONFIRMAR (diag. SQL nº 6/7) |

### Credenciais

| ID | Sev. | Achado | Status |
|---|---|---|---|
| F-11 | 🟡 Médio | `src/lib/supabase.ts` tinha **URL do projeto e chave `anon` fixas como fallback**. A chave é `role=anon` (pública por desenho) e com assinatura placeholder (`…exemplo_chave_padrao`, inválida), então não dá acesso — mas o fallback faz um ambiente sem `.env` apontar **silenciosamente para o projeto real** e esconde erro de configuração. | **CORRIGIDO**: sem fallback; falha na inicialização com mensagem clara. |
| F-12 | ✅ | Nenhuma chave `service_role`/`sb_secret_` no código, no histórico (1 commit: `9d39f51`), nem no bundle do cliente (`.next/static`). Nenhum `.env` rastreado ou commitado; `.gitignore` cobre `.env*`. Não há Route Handlers/Server Actions no projeto (nada roda com privilégio de servidor). | **OK** |
| F-13 | ✅ | `npm audit` (dependências de produção): 0 vulnerabilidades. Único `dangerouslySetInnerHTML` é um script estático de tema, sem entrada do usuário. | **OK** |

**Rotação de chaves:** como a única chave no histórico é `anon` com assinatura inválida, **não há necessidade de rotacionar** por conta do histórico. Se a Vercel/painel revelar qualquer `service_role` em variável pública, **rotacione imediatamente** (Settings → API → JWT secret/keys) antes do beta.

## 3. O que foi alterado no repositório

- `src/lib/supabase.ts` — remove fallbacks; exige variáveis (F-11).
- `.env.example` (+ liberado no `.gitignore`) — documenta variáveis e proíbe `service_role` em `NEXT_PUBLIC_*`.
- `scripts/verificar-segredos.mjs` + `npm run seguranca:segredos` — varre código, `.env` rastreados, **bundle** e **histórico do Git**; falha se achar JWT `service_role`, `sb_secret_`, `NEXT_PUBLIC_*SERVICE/SECRET` ou JWT fixo no código.
- `supabase/audit/00_diagnostico_rls.sql` — 12 consultas **somente leitura** (+ checklist do painel de Auth) (RLS, políticas, grants, views, funções `SECURITY DEFINER`, triggers, FKs, storage).
- `tests/rls/isolamento.rls.ts` + `vitest.rls.config.ts` + `npm run test:rls` — 103 testes de isolamento com 3 contas.
- `vitest.config.ts` e script `npm test` — separa os testes unitários dos de RLS.

## 4. Evidências já obtidas (executadas nesta auditoria)

| Verificação | Resultado |
|---|---|
| `git log --all` / arquivos `.env` no histórico | 1 commit, nenhum `.env` |
| Busca de `service_role`/`sb_secret_`/JWT em todo o histórico | Só 1 JWT `role=anon` com assinatura placeholder |
| Build **sem** variáveis | Falha com a mensagem de configuração (fail-fast ✔) |
| Build **com** variáveis fictícias + varredura de `.next/static` | Apenas a `anon` (esperado); **nenhum** `service_role` |
| Teste negativo: plantar JWT `service_role` falso em `src/` | Verificador falha (exit 1) ✔ |
| Teste negativo: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Verificador falha (exit 1) ✔ |
| `tsc --noEmit`, `eslint` (arquivos novos), `npm test` | Sem erros; 18/18 testes unitários |
| `npm run test:rls` sem variáveis | 103 testes **pulados** (nunca toca no banco sem confirmação) |

## 5. Como concluir a validação (passo a passo)

### 5.1 Diagnóstico do banco
1. Supabase → SQL Editor → rode `supabase/audit/00_diagnostico_rls.sql` **bloco a bloco**.
2. Cole os resultados na seção §7 deste arquivo. Atenção especial a: tabela com `rls_ativo = false`; políticas com `roles = {public}`/`{anon}`, `qual = true` ou `with_check` vazio; `anon` com privilégios em tabelas financeiras; views sem `security_invoker`; funções `SECURITY DEFINER` sem `search_path`.

### 5.2 Testes de isolamento (contas distintas, dados fictícios)
1. Preferencialmente use um **projeto Supabase de teste** (ou branch). Crie 3 usuários fictícios (A, B, C) com e-mail confirmado.
2. Copie as variáveis `RLS_*` do `.env.example` para `.env.local` e defina `RLS_CONFIRMA_AMBIENTE_DE_TESTE=sim`.
3. `npm run test:rls`.
4. **Cada teste vermelho é um achado.** Falhas em cascata são possíveis (se B apagar algo de A, os testes seguintes quebram): corrija a primeira falha e rode de novo.
5. Registre o resultado na §7.

> A suíte é nova e não foi rodada contra um banco real. Se o setup acusar `Setup falhou (...)`,
> costuma ser coluna obrigatória ou nome diferente — ajuste só `prepararGrupos()`/`criarFixtures()`.

### 5.3 Variáveis de ambiente (Vercel e local)
- [ ] Vercel → Settings → Environment Variables: existem **apenas** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Nenhuma variável contém `SERVICE_ROLE`/`SECRET`. Se houver, jamais com prefixo `NEXT_PUBLIC_` e marcada como *Sensitive*.
- [ ] **Preview** e **Development** apontam para o projeto de teste, não para produção.
- [ ] `vercel env ls` (ou o painel) confere os 3 ambientes (Production, Preview, Development).
- [ ] Local: `.env.local` existe só na sua máquina (`git status` não deve listá-lo).
- [ ] Supabase → Authentication → URL Configuration: *Site URL* e *Redirect URLs* só com domínios próprios; confirmação de e-mail ligada; proteção contra senhas vazadas ligada.
- [ ] Rode `npm run build && npm run seguranca:segredos` antes de cada release.

## 6. Correções de banco — próximo passo (Fase 2)

Não escrevi a migration de RLS "às cegas": a correção correta depende do que o diagnóstico e os testes
mostrarem sobre o estado **atual** (políticas já existentes, tipos e constraints). Escrever policies
por cima sem isso pode travar o app ou criar políticas redundantes. O desenho recomendado, a ser
refinado com os resultados:

1. **Grupos por RPC, não por escrita direta em `perfis`:** funções `SECURITY DEFINER` (`search_path` fixo, `auth.uid()`) para `criar_grupo`, `entrar_no_grupo(código)`, `remover_membro` e `adicionar_convidado`, atômicas (resolve F-07).
2. **Convite em vez de UUID aberto:** código com expiração/uso único, gerado pelo gestor (resolve F-01).
3. **Proteger colunas sensíveis de `perfis`** (`cargo`, `grupo_id`, `user_id`) com trigger que rejeita mudança direta pelo cliente (F-02, F-03).
4. **Funções auxiliares** `eh_membro_do_grupo(gid)` / `eh_gestor_do_grupo(gid)` usadas nas políticas (evita recursão em `perfis`).
5. **`WITH CHECK` nos INSERT/UPDATE**: `owner_id = auth.uid()`; `grupo_id` só se o usuário for membro; `caixinha_id` só de caixinha do próprio usuário (F-04).
6. **`privado`/`compartilhado_com`** aplicados na política de SELECT (F-05).
7. **FKs com `ON DELETE CASCADE`** em `caixinha_movimentos` (F-08); `REVOKE` de tudo para `anon` nas tabelas financeiras.
8. **Storage:** política exigindo `(storage.foldername(name))[1] = auth.uid()::text` para INSERT/UPDATE/DELETE (F-06).
9. **Versionar** tudo em `supabase/migrations/` para que o banco seja reprodutível.

## 7. Evidências do banco e resultado dos testes (preencher)

- Resultado do diagnóstico SQL: _pendente_
- Saída de `npm run test:rls` (data, ambiente, nº de testes aprovados/reprovados): _pendente_
- Achados confirmados / descartados: _pendente_
- Migration(ões) aplicada(s) e re-execução dos testes: _pendente_
