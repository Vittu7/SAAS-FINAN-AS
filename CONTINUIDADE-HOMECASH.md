# Continuidade — HomeCash

Atualizado em 2026-11-05. Documento de passagem de trabalho entre computadores/sessões.
Não contém senhas, tokens nem conteúdo de `.env`.

---

## 1. Estado atual

- **Branch:** `feature/teste-pagamento-fatura` (rastreia `origin/feature/teste-pagamento-fatura`, sem commits à frente ou atrás).
- **HEAD:** `3559546 Salva progresso da reestruturacao financeira do HomeCash` (2026-11-05). Todo o trabalho abaixo
  está neste commit, já enviado ao GitHub. Commit anterior: `20f3d5e feat: implementa teste inicial de pagamento de fatura`.
- **`main` não foi alterada.** A branch está 2 commits à frente da `main`. O app em produção (Vercel) ainda roda o código da `main`.
- **Supabase:** projeto `iitgqormevgznxikwyvu` (região sa-east-1). Migrações 09, 10, 11, 13 e 14 aplicadas; demais pendentes (ver seção 5).
- **Next.js:** 16.4.5 (atualização de segurança a partir de 16.4.0, já incorporada nesta branch).

### Computadores e worktrees

| Local | Branch | Conteúdo |
|---|---|---|
| `C:/Users/Ergon/Documents/Vitu/SAAS-FINAN-AS` (computador atual) | `feature/teste-pagamento-fatura` | Clone do GitHub em `3559546`. Tem `.env.local`. **Não tem** a pasta `backups/`. |
| `D:/Downloads/Trabalho/SAAS-FINAN-AS` (computador anterior) | `feature/teste-pagamento-fatura` | Cópia original. Única que tem `backups/supabase-2026-11-05/`. |
| `D:/Downloads/Trabalho/SAAS-FINAN-AS-next-upgrade` (computador anterior) | `chore/next-security-upgrade` (local, sem commits) | Cópia antiga + teste de `vitest@4.1.12`. **Nada único de valor**. Pode ser descartada (`git worktree remove`), mas só com decisão explícita. |

---

## 2. O que já foi implementado

### Código (nesta branch, commit `3559546`)
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
  Existe **só no computador anterior** (`D:/Downloads/Trabalho/SAAS-FINAN-AS`); não foi copiada para o atual.
- Tabelas de backup **continuam no banco**.

---

## 3. Arquivos modificados e criados

Todos os arquivos abaixo estão no commit `3559546` (29 arquivos: 1271 inserções, 206 remoções).

**Removido:** `src/app/grupo/page.tsx`

**Modificados:**
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

**Novos:**
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
.env.local                       (variáveis do Supabase — NÃO enviar por canal inseguro)   já presente no computador atual
backups/supabase-2026-11-05/     (dados financeiros reais — idem)                          só no computador anterior
```

---

## 4. Testes (última execução: 2026-11-05, nesta branch, no computador atual)

| Verificação | Resultado |
|---|---|
| `npm ci` | ok; `package-lock.json` sem mudança (md5 igual). O npm 11 bloqueou os scripts `postinstall` de `esbuild` e `unrs-resolver` (`allowScripts`); não foram aprovados e não fizeram falta (binários do Windows vieram instalados). |
| `npx vitest run` | **157 passaram, 0 falharam** (antes: 151 ok / 2 falhas antigas) |
| `npx tsc --noEmit` | ok |
| `npm run build` | ok (7 rotas) |
| Lint | 234 problemas antigos em `src` (~maioria `any`); nada novo nos arquivos alterados |

### Correções de 2026-11-05 (não commitadas)

**Contas fixas pendentes no extrato** (decisão do responsável):
- Conta fixa paga entra nos gastos realizados; pendente **não** entra, mas continua na lista como compromisso ("a pagar").
- `src/lib/extrato.ts`: campo `pendente` na linha; `totalGastos` sem pendentes; nova `totalPendentes`;
  `agruparPorOrigem` devolve `total` (realizado) e `pendente` separados.
- Telas `ExtratoLista`, `ExtratoGeral`, `ExtratoDetalhe` mostram "+ R$ X a pagar" à parte.
- **Escopo só no extrato** (decisão do responsável): `calcularMes`, cards, resultado do mês e saldo/total disponível
  **não mudaram**. No `ExtratoDetalhe` o resultado continua igual ao card (entradas − saídas − a pagar).
  Teste garante: realizados + a pagar do extrato = `saidas` do resumo.
- Revisão visual (2026-11-05): prévia local temporária com dados falsos (sem Supabase, já apagada), desktop 1280px e
  celular 390px, tema escuro e claro. Sem rolagem lateral. Ajustes: no diálogo "Saídas do mês" o "a pagar" ganhou
  linha própria em âmbar; com filtro ativo, a linha "Mostrando…" também mostra o a pagar.
  Não testado com login real (exige conta no Supabase de produção).

**`tests/contas.test.ts`** (aportes x saldo): a lógica estava certa; o teste falhava desde que foi criado (`4b5ef45`):
saldo 1220, aporte 1000 deixa 220, gasto de 100 cabe. Teste mudou para gasto de 300 (aprovado pelo responsável),
conferindo disponível 1220 → 220 e faltante 80. Nenhuma lógica de saldo alterada.

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
| `supabase-15-remove-grupo-antigo.sql` | **NÃO aplicada.** P1 **não autorizada** (decisão de 2026-11-05). Fica preparada localmente. |
| `supabase-16-remove-caixinhas-antigas.sql` | **NÃO aplicada.** P2 **não autorizada**. Fica preparada localmente. |
| `supabase-17-remove-funcoes-orfas.sql` | **NÃO aplicada.** P3 **não autorizada**. Fica preparada localmente. |

Os scripts 01–07 originais não estão versionados (foram rodados à mão no SQL Editor, antes deste trabalho).

---

## 6. Pendências

1. **P1, P2, P3** — **não autorizadas** (decisão de 2026-11-05). Migrações 15, 16, 17 ficam preparadas, sem aplicar.
   Se um dia forem autorizadas: aplicar nessa ordem e, antes de cada uma, reconferir no banco que as tabelas continuam
   vazias e sem dependências (as migrações já abortam sozinhas se houver dados).
2. **P4** — **preservar** as 5 tabelas de backup no banco. Não excluir (decisão de 2026-11-05).
3. **Migração 12** — não aplicar agora; só depois do deploy do código desta branch.
4. **Vitest** — decidir se atualiza `vitest` 3.2.7 → 4.1.12 (remove 2 vulnerabilidades críticas + 1 moderada, só de desenvolvimento; testado na worktree com resultados iguais). Não usar `npm audit fix --force` (sugere vitest 5 e rebaixaria `eslint-config-next`).
5. **minimatch** (8 moderadas, via `typescript-eslint`) — sem correção oficial; decidir entre `overrides` para `minimatch@11.0.4` ou aguardar.
6. **Proteção contra senhas vazadas** — ligar no painel do Supabase (Authentication → Providers → Email). Não dá por SQL.
7. **PR / merge / deploy** — trabalho commitado e enviado na branch (`3559546`); PR, merge na `main` e deploy dependem de decisão do responsável.
8. **Cards x contas pendentes** — os cards (`calcularMes`) ainda contam conta fixa pendente como saída (e no total
   disponível). Mudar isso altera saldo disponível: só com decisão específica do responsável.
9. **Commit** das correções de 2026-11-05 (docs, extrato e testes): aguardando autorização.
10. **Nova interface (Resumo, Repasses) e fechamento mensal** — implementados localmente em 2026-11-05, sem commit.
    Detalhes na seção 11. Pendentes: aplicar a migração 18 (com autorização), decisão sobre o "Disponível" (regra atual
    x dinheiro nas contas) e a Fase B dos repasses (histórico de estorno e repasse parcial).

## 11. Nova interface e fechamento mensal (2026-11-05, NÃO commitado)

Referência visual aprovada: prévia https://claude.ai/artifact/NCA7sD7PcKQatVnHksYcq8.

**Resumo** (`src/components/resumo/`): Disponível (cor pelo sinal) e Sobra prevista; Entrou (cartão verde) x Saiu
(cartão vermelho), Resultado do mês e gráfico dos últimos 6 meses; Ainda vai sair (contas pendentes e faturas em
aberto, âmbar); Entre membros; Como chegamos ao disponível. Substitui `SummaryCards`, `MobileSaldo`, `RepassesResumo` e a
faixa "Valores a repassar" na tela inicial (arquivos antigos mantidos, sem uso).
Cálculos novos em `lib/painel.ts` (`entradasRenda`, `saidasRealizadas`, `contasPendentes`, `resultadoRealizado`,
`sobraPrevista`, `previsao`, `composicaoDoDisponivel`, `serieEntradasSaidas`) e `lib/pagamentoFatura.ts`
(`faturasEmAberto`). **Nenhuma regra de saldo mudou**: o "Disponível" continua sendo o `totalDisponivel` (já desconta
contas fixas do mês e compras no crédito); a sobra prevista é calculada para não descontar nada duas vezes (testado).

**Repasses** (aba Repasses do Grupo): todos os meses (antes só o mês selecionado); Aguardando minha ação, Tenho que
receber, Tenho que pagar, Próximos meses, Concluídos com Estornar (pede confirmação). Uma ação por vez (evita clique
duplo); a garantia final continua no banco. `lib/grupo.ts`: `acoesDoRepasse` (quem pode fazer o quê).

**Fechamento mensal**: regras em `lib/fechamento.ts`, hook `hooks/useFechamentos.ts`, telas em
`components/fechamento/Fechamento.tsx`, integração em `app/page.tsx` (seletor de mês com situação, faixa, conferência,
reabertura com motivo, lista de meses, aviso ao avançar, travas antes de gravar). Banco: migração 18 (não aplicada).
Sem a migração o app funciona como antes.

**Cores** em `globals.css`: `--pos`, `--neg`, `--warn` (+ `-ink`, `-bg`, `-borda`) e `--serie-in/out`, nos 3 temas.

Testes: 205 (157 antigos + 48 novos em `resumo-indicadores`, `faturas-em-aberto`, `fechamento`, `repasses-regras`).
tsc e build ok. Validação visual dos componentes reais (rota temporária, já apagada): 5 resoluções × 2 temas × 11
estados, sem rolagem lateral, texto cortado, sobreposição, contraste baixo ou botão < 44px no celular.

---

## 7. Última tarefa executada

Recuperação no computador atual (2026-11-05): auditoria do estado, `npm ci`, testes (151 ok / 2 antigas), tsc ok,
build ok e atualização deste documento, do `README.md` e de `docs/propostas-supabase.md` (que ainda diziam
"nada commitado" e "migração 14 não aplicada"). Depois: regra de contas pendentes no extrato e correção do teste
de aportes (seção 4); 157/157 testes, tsc e build ok. Nenhum SQL executado, nenhuma migração aplicada.

## 8. Próxima tarefa exata

Só análises e verificações locais, sem tocar no banco. Nada de commit, push, merge ou deploy sem autorização.
Antes de qualquer operação destrutiva: apresentar os riscos e pedir autorização específica.

---

## 9. Restrições e autorizações em vigor

**Regras financeiras (não alterar):**
1. Saldo negativo só por movimentação legítima do próprio titular, nunca por ação de terceiros.
2. Repasse de convidado: só quem recebe confirma.
3. Edição após repasse confirmado: bloqueada até o estorno.
Cartões, faturas, repasses, saldo disponível, total disponível e histórico financeiro são sensíveis: não simplificar.

**Autorizado (decisão de 2026-11-05):**
- Só análises e verificações locais que não alterem o banco nem os dados.

**Não autorizado agora:**
- Executar SQL no Supabase (inclusive consultas) e aplicar qualquer migração (12, 15, 16, 17).
- P1, P2, P3 (migrações 15–17 ficam só preparadas). P4: as tabelas de backup ficam no banco.

**Exige autorização específica do responsável:**
- Qualquer DROP TABLE / DROP FUNCTION / DROP POLICY; exclusão de registros; exclusão de backups (P4).
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
git log --oneline -3                # 3559546 Salva progresso da reestruturacao financeira do HomeCash (ou commit mais novo)
git status --short                 # vazio, se tudo estiver commitado
ls supabase/                       # 08 a 17 + arquivo/ + diagnostico-limpeza.sql
ls backups/supabase-2026-11-05/    # 5 JSON + MANIFESTO.md (só onde a pasta foi copiada)
md5sum backups/supabase-2026-11-05/*.json   # comparar com o MANIFESTO.md
```
