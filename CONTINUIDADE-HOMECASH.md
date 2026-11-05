# Continuidade — HomeCash

Atualizado em 2026-11-05. Documento de passagem de trabalho entre computadores/sessões.
Não contém senhas, tokens nem conteúdo de `.env`.

---

## 1. Estado atual

- **Branch:** `feature/teste-pagamento-fatura` (rastreia `origin/feature/teste-pagamento-fatura`, sem commits à frente ou atrás).
- **HEAD:** `20f3d5e feat: implementa teste inicial de pagamento de fatura` (a limpeza anterior do código está neste commit).
- **Nada foi commitado** desde então: todo o trabalho abaixo está no diretório de trabalho (staged, unstaged e não rastreado).
- **`main` não foi alterada.** O app em produção (Vercel) ainda roda o código da `main`.
- **Supabase:** projeto `iitgqormevgznxikwyvu` (região sa-east-1). Migrações 09, 10, 11, 13 e 14 aplicadas; demais pendentes (ver seção 5).
- **Next.js:** 16.4.5 (atualização de segurança a partir de 16.4.0, já incorporada nesta branch).

### Worktrees

| Caminho | Branch | Conteúdo |
|---|---|---|
| `D:/Downloads/Trabalho/SAAS-FINAN-AS` | `feature/teste-pagamento-fatura` | **Trabalho principal (o que importa).** |
| `D:/Downloads/Trabalho/SAAS-FINAN-AS-next-upgrade` | `chore/next-security-upgrade` (local, sem commits) | Cópia antiga do trabalho + teste de `vitest@4.1.12`. **Nada único de valor**: o upgrade do Next já está na principal; o teste do Vitest pode ser refeito com um comando. Pode ser descartada quando quiser (`git worktree remove`), mas só com decisão explícita. |

---

## 2. O que já foi implementado

### Código (nesta branch, não commitado)
1. **Entrada no grupo só por código de convite** (`GrupoModal.tsx`): usa `entrar_grupo_por_convite`; gestor gera código com `gerar_convite_grupo_familiar` (7 dias, uso único). Antes o app gravava `grupo_id` direto no perfil (qualquer pessoa com o UUID entrava e podia virar gestor).
2. **Só o gestor adiciona convidado sem conta** (D1): app chama `adicionar_convidado_grupo`; botão só aparece para o gestor. Removido o fallback de insert direto em `perfis` (nunca funcionava por RLS).
3. **Cor de outro membro** via `alterar_cor_membro_grupo` (só gestor); antes o app dizia "Cor atualizada" sem gravar. Função `alterarCorMembro` em `src/lib/perfil.ts`.
4. **Regra 3 na tela** (D2): `travadoPorRepasse` em `src/lib/grupo.ts`; `useFinanceStore` recusa editar/excluir lançamento com repasse confirmado (inclusive séries) com aviso claro.
5. **Inclusão de lançamentos no grupo** (`lancamentosGrupo.ts`) ignora os que têm repasse confirmado.
6. **`src/lib/supabase.ts`:** removido fallback com chave falsa e URL errada; erro claro se faltar variável de ambiente.
7. **Rota órfã `/grupo` removida** (sem links; mostrava o UUID como convite).
8. **Next.js 16.4.0 → 16.4.5** (`package.json`, `package-lock.json`, `next.config.ts` com `experimental.agentUpgrade: "security"`).
9. **`.gitignore`:** `/backups/` (dados financeiros exportados nunca vão para o Git).

### Supabase (aplicado e verificado)
- **09** permissões: sem EXECUTE para `anon` em `adicionar_convidado`/`registrar_repasse_conta`; funções de trigger sem EXECUTE pela API; `search_path` fixo em `opcoes_pagamento_normaliza`.
- **10** RLS: 33 políticas com `(select auth.uid())` via `ALTER POLICY` (acesso idêntico, verificado para os 8 usuários).
- **11** índices em chaves estrangeiras das tabelas em uso + `perfis(user_id)`/`perfis(grupo_id)`.
- **13** D1: `adicionar_convidado` passa a chamar `adicionar_convidado_grupo` (só gestor). Testado com gestor, membro, sem grupo e anon.
- **14** D2: trigger `lancamento_trava_repasse_confirmado` em `extrato`, `cartao`, `contas_fixas`. md5 dos dados idêntico antes/depois. Testado: edição/exclusão bloqueadas; estorno (`reabrir`) + edição ok; reconfirmar + gravar conta ok; `pago` de conta fixa ok; `service_role` ok.

### Backups (P4) exportados
- `backups/supabase-2026-11-05/` (fora do Git): 5 arquivos JSON + `MANIFESTO.md` com md5 conferido (banco = arquivo).
- Tabelas de backup **continuam no banco**.

---

## 3. Arquivos modificados e criados

**Staged:** `D src/app/grupo/page.tsx`

**Modificados (unstaged):**
```
.gitignore
README.md
next.config.ts
package-lock.json
package.json
src/components/GrupoModal.tsx
src/components/ResponsavelPanel.tsx
src/hooks/useFinanceStore.ts
src/lib/grupo.ts
src/lib/lancamentosGrupo.ts
src/lib/perfil.ts
src/lib/supabase.ts
supabase/supabase-08-pagamentos-fatura.sql
tests/grupo.test.ts
tests/lancamentos-grupo.test.ts
tests/perfil.test.ts
```

**Novos (não rastreados):**
```
CONTINUIDADE-HOMECASH.md                       (este arquivo)
docs/propostas-supabase.md                     (propostas, SQL exato, situação de cada item)
supabase/arquivo/definicoes-anteriores.sql     (definições originais para desfazer remoções)
supabase/supabase-09-permissoes-funcoes.sql
supabase/supabase-10-rls-auth-uid.sql
supabase/supabase-11-indices.sql
supabase/supabase-12-perfis-protecao.sql
supabase/supabase-13-convidado-so-gestor.sql
supabase/supabase-14-trava-repasse-confirmado.sql
supabase/supabase-15-remove-grupo-antigo.sql
supabase/supabase-16-remove-caixinhas-antigas.sql
supabase/supabase-17-remove-funcoes-orfas.sql
```

**Ignorados pelo Git, mas necessários (transferir à parte, com cuidado):**
```
.env.local                       (variáveis do Supabase — NÃO enviar por canal inseguro)
backups/supabase-2026-11-05/     (dados financeiros reais — idem)
```

---

## 4. Testes (última execução: 2026-11-05, nesta branch)

| Verificação | Resultado |
|---|---|
| `npx vitest run` | 151 passaram, 2 falharam |
| `npx tsc --noEmit` | ok |
| `npm run build` | ok (7 rotas) |
| Lint | sem regressão no código do app (~300 `any` antigos continuam) |

As 2 falhas são **antigas** (já falhavam antes de todo este trabalho):
- `tests/contas.test.ts` › "a verificação de saldo ao lançar considera os aportes"
- `tests/extrato-ordenacao.test.ts` › "agrupa por origem com subtotal e ignora entradas"

---

## 5. Migrações

| Arquivo | Situação no Supabase |
|---|---|
| `supabase-08-pagamentos-fatura.sql` | Já existia e estava aplicado. Só o texto da política foi ajustado para `(select auth.uid())` (igual ao que a 10 aplicou). |
| `supabase-09-permissoes-funcoes.sql` | **Aplicada** |
| `supabase-10-rls-auth-uid.sql` | **Aplicada** |
| `supabase-11-indices.sql` | **Aplicada** |
| `supabase-12-perfis-protecao.sql` | **NÃO aplicada.** Rodar só DEPOIS do deploy do código novo (o app da `main` grava `grupo_id` direto e quebraria). Testada com rollback. |
| `supabase-13-convidado-so-gestor.sql` | **Aplicada** |
| `supabase-14-trava-repasse-confirmado.sql` | **Aplicada** (sem DROP; usa `create or replace trigger`) |
| `supabase-15-remove-grupo-antigo.sql` | **NÃO aplicada** (P1 autorizada; a aplicação foi recusada no prompt de permissão). |
| `supabase-16-remove-caixinhas-antigas.sql` | **NÃO aplicada** (P2 autorizada; não tentada após a recusa da 15). |
| `supabase-17-remove-funcoes-orfas.sql` | **NÃO aplicada** (P3 autorizada; não tentada após a recusa da 15). |

Os scripts 01–07 originais não estão versionados (foram rodados à mão no SQL Editor, antes deste trabalho).

---

## 6. Pendências

1. **P1, P2, P3** — aplicar 15, 16, 17 (nessa ordem), após confirmar com o responsável por que a 15 foi recusada.
   Antes de cada uma: reconferir no banco que as tabelas continuam vazias e sem dependências (as migrações já abortam sozinhas se houver dados).
2. **P4** — excluir as 5 tabelas de backup: **só com autorização específica**, depois que o responsável conferir os arquivos exportados.
3. **Migração 12** — aplicar depois do deploy do código desta branch.
4. **Vitest** — decidir se atualiza `vitest` 3.2.7 → 4.1.12 (remove 2 vulnerabilidades críticas + 1 moderada, só de desenvolvimento; testado na worktree com resultados iguais). Não usar `npm audit fix --force` (sugere vitest 5 e rebaixaria `eslint-config-next`).
5. **minimatch** (8 moderadas, via `typescript-eslint`) — sem correção oficial; decidir entre `overrides` para `minimatch@11.0.4` ou aguardar.
6. **Proteção contra senhas vazadas** — ligar no painel do Supabase (Authentication → Providers → Email). Não dá por SQL.
7. **Commit / PR / deploy** — nada foi commitado; depende de decisão do responsável.
8. **2 testes antigos falhando** — investigar separadamente (não relacionados a este trabalho).

---

## 7. Última tarefa executada

Validação final de 2026-11-05: testes (151 ok / 2 antigas), tsc ok, build ok, conferência de triggers e permissões no Supabase,
investigação das vulnerabilidades de desenvolvimento e criação deste documento.

## 8. Próxima tarefa exata

1. No computador novo, conferir o estado (seção 10) e rodar `npm ci`, `npx vitest run`, `npx tsc --noEmit`, `npm run build`
   (esperado: 151 ok / 2 falhas antigas, tsc ok, build ok).
2. Perguntar ao responsável se pode tentar de novo a **migração 15 (P1)** e, se sim, aplicar 15 → 16 → 17,
   reconferindo dependências no banco antes de cada uma, e validar depois (objetos removidos, preservados intactos, advisors).

---

## 9. Restrições e autorizações em vigor

**Regras financeiras (não alterar):**
1. Saldo negativo só por movimentação legítima do próprio titular, nunca por ação de terceiros.
2. Repasse de convidado: só quem recebe confirma.
3. Edição após repasse confirmado: bloqueada até o estorno.
Cartões, faturas, repasses, saldo disponível, total disponível e histórico financeiro são sensíveis: não simplificar.

**Autorizado:**
- Editar código, corrigir bugs e segurança, refatorar, criar migrações, consultas de diagnóstico, correções não destrutivas e seguras no Supabase.
- P1, P2, P3 (remoções descritas em `docs/propostas-supabase.md`), com migração separada por grupo, sem `CASCADE` indiscriminado.

**Exige autorização específica do responsável:**
- Qualquer DROP TABLE / DROP FUNCTION / DROP POLICY fora de P1–P3; exclusão de registros; exclusão de backups (P4).
- Qualquer operação destrutiva ou irreversível no Supabase ou que possa afetar dados financeiros.
- Commit, push, merge ou deploy.
- `npm audit fix --force` (apresentar versões e riscos antes).

**Não fazer:**
- P5 (consolidação de políticas) — não executar.
- Esconder comandos destrutivos em migrações ou scripts.
- Preservar sempre: `membro_pertence`, `meus_grupos`, `meus_membros`, `aportes_investimento`, `caixinhas`, `caixinha_movimentos`, `opcoes_padrao_criadas`.

---

## 10. Como conferir o estado no computador novo

```bash
git branch --show-current          # feature/teste-pagamento-fatura
git log -1 --oneline               # 20f3d5e feat: implementa teste inicial de pagamento de fatura
git status --short                 # deve listar os arquivos da seção 3
ls supabase/                       # 08 a 17 + arquivo/ + diagnostico-limpeza.sql
ls backups/supabase-2026-11-05/    # 5 JSON + MANIFESTO.md
md5sum backups/supabase-2026-11-05/*.json   # comparar com o MANIFESTO.md
```
