# Plano: contas fixas × débito/crédito/faturas

Spec: `docs/superpowers/specs/2026-11-06-contas-fixas-cartoes-design.md`. Cada tarefa segue TDD (teste que falha, implementação, teste passa). Sem commit, push, deploy ou SQL executado. Antes de iniciar, o usuário aprova este plano e os impactos.

Linha de base: `npm test` (390 testes), `npx tsc --noEmit` e eslint precisam estar verdes antes e depois de cada tarefa.

## T0 — Verificações só de leitura
- Confirmar em `EditarLancamentoModal` que editar conta fixa altera uma linha só.
- Confirmar que `FaturaCartao` soma pendentes (divergência) com um teste que falha primeiro.
- Listar o `pago` nos testes existentes para saber o que fixa a regra atual.
- Ler `extrato.ts` e o clique de Entradas/Saídas (`onAbrirExtrato` em `PainelResumo`) e registrar, com um teste, se o detalhe do Meu financeiro já lista só lançamentos em que eu sou o responsável. O resultado define se T8b muda algo no pessoal.

## T1 — Migração aditiva (arquivo apenas)
- Criar `supabase/supabase-23-contas-fixas.sql` com `add column if not exists` (4 colunas em `contas_fixas`, `dia_fechamento` em `opcoes_pagamento`) e ajuste da lista de campos do trigger 14.
- Teste em `tests/sql-migracoes.test.ts`: o arquivo só contém `add column if not exists`/`create or replace`, nenhum `update`, `delete` ou `drop table`.
- **O usuário executa o SQL; eu não.**

## T2 — Tipos e leitura
- `src/lib/types.ts`: novos campos opcionais em `ContaFixa`. `useOpcoes.ts`: `dia_fechamento`.
- `useFinanceStore.ts`: ler/gravar as colunas novas tolerando coluna ausente.

## T3 — Fatura com fechamento (`pagamentoFatura.ts`)
- **Antes de tudo:** teste golden do painel pessoal (`calcularPainel`/resumo) com dados de outubro e de novembro (com conta cobrada e `dia_fechamento`). Salvar a saída atual como esperada; ele precisa continuar verde até o fim.
- `MES_CORTE_FECHAMENTO = "2026-11"` e `mesDaFatura(data, diaFechamento)` como helper novo, ativado por parâmetro (`opts.fechamento`). O padrão é o caminho legado por `mes`.
- `calcularFatura` exclui conta fixa pendente; só as telas de fatura a usam.
- `faturasEmAberto` e `ajusteDeFaturas` mantêm o comportamento atual para o painel pessoal. A versão com fechamento é chamada só pelo Financeiro do grupo e pelas telas de fatura.
- Testes: antes e depois do fechamento; outubro idêntico; pendente fora da fatura; sem `dia_fechamento` = comportamento atual; não duplica; **painel pessoal inalterado**.

## T4 — Saldo da conta de débito (`contas.ts`)
- Fixa paga entra no mês de `pago_em` (fallback `mes`). Crédito nunca mexe em saldo.
- Testes: confirmação em mês posterior; histórico sem `pago_em` igual ao atual.

## T5 — Marcar pago/cobrada (`useFinanceStore.alternarPago` + UI)
- Gravar `pago_em` (data escolhida, padrão hoje). Desmarcar zera `pago_em`.
- `ContasFixasTable`: rótulos por tipo ("Pendente/Paga" no débito e dinheiro; "Pendente/Cobrada no cartão" no crédito) e seletor de data da cobrança.
- Cartão: campo "Dia de fechamento" ao lado do vencimento, em `FaturaCartao`/`CadastrarCartaoModal`.

## T6 — Valor variável
- Opção "valor varia" no cadastro (`NovaTransacao`, fixa).
- `gerarContasFixasDoMes` copia `valor_variavel` e marca `valor_confirmado=false` no mês novo; respeita `encerrada_em`.
- UI: aviso "informe o valor" e editar só a linha do mês. Testes: mês anterior intacto; série encerrada não gera.

## T7 — Encerrar sem apagar
- Ação "Encerrar a partir de [mês]" (grava `encerrada_em`); a exclusão total fica com confirmação reforçada.
- Teste: histórico preservado e nada gerado depois do mês de encerramento.

## T8 — Financeiro do grupo (único lugar onde indicadores e apresentação mudam)
- Arquivos permitidos: `financeiroGrupo.ts`, `FinanceiroGrupoCard.tsx` e seus testes. **Não editar** `painel.ts` (lógica), `PainelResumo.tsx`, `Pendencias.tsx` nem o layout do Meu financeiro. Se `page.tsx` precisar passar dados, o diff não pode mexer no ramo pessoal.
- `financeiroGrupo.ts`: acrescentar `contasPendentes`, `faturasEmAberto` (com fechamento) e `totalPagoNoMes`. `disponivelGrupo` não muda.
- `FinanceiroGrupoCard.tsx`: mostrar os quatro números; pendentes e faturas rotulados como informativos; remover ou reclassificar "Quanto efetivamente tenho".
- Testes: coerência pessoal x grupo (o `meuDisponivel` do grupo é igual ao Total disponível pessoal); fixa no crédito 1x na competência e 1x no caixa; informativos não alteram `disponivelGrupo`; os 19 repasses inalterados; outubro idêntico; **golden do painel pessoal ainda verde**.

## T8b — Detalhe de Entradas e Saídas (Meu financeiro × Grupo)
Spec: seção "Detalhamento de Entradas e Saídas". Indicador e detalhe saem da mesma lista.
- **Meu financeiro:** garantir que Entradas e Saídas detalham só lançamentos em que eu sou o responsável (`responsavel_id`), mostrando o autor quando outro lançou. Se T0 mostrar que já é assim, só entram os testes. Se não for, a correção fica restrita ao detalhe (o total não muda), com o diff mostrado ao usuário antes de aplicar, já que toca o Meu financeiro.
- **Grupo, `financeiroGrupo.ts`:** acrescentar `entradasGrupo` e `saidasGrupo`, cada uma com `total` e `itens` (data, descrição, valor, **quem lançou**, **responsável**, categoria/origem). O total é a soma de `itens`; não há outro caminho de cálculo.
- **Alcance (opção A aprovada):** consolida os lançamentos visíveis ao usuário (os dele e os de perfis dele); sem mudança de banco; a tela informa isso. Despesas realizadas apenas; pendentes ficam no informativo.
- **Andamento:** correção do detalhe do Meu financeiro feita (`saidasDoMeuFinanceiro`/`entradasDoMeuFinanceiro`, `tests/detalhe-meu-financeiro.test.ts`).
- **Grupo, `FinanceiroGrupoCard.tsx`:** dois indicadores clicáveis (Entradas do grupo, Saídas do grupo) abrindo o detalhe com as colunas "Lançado por" e "Responsável". Reaproveitar o componente de extrato existente (`extrato.ts` já traz `autor` e `responsavel`) sem alterar o uso pessoal.
- **Testes (TDD, falham primeiro):**
  - Meu financeiro: não lista lançamento de outro responsável, mesmo lançado por ele; lista o meu lançado por outro, com autor.
  - Grupo: lista de todos os integrantes, com autor e responsável preenchidos.
  - Soma do detalhe = indicador, em centavos, para meses de outubro e novembro, nas duas visões.
  - Repasse (concluído ou não), pagamento de fatura e parcela/conta fixa aparecem no máximo uma vez e nunca como entrada ou despesa indevida.
  - Mês selecionado muda a lista e o total juntos; outubro idêntico ao atual.
  - Valores pessoais não vazam para o grupo e vice-versa; trocar o seletor não deixa detalhe antigo aberto.
  - Golden do painel pessoal continua verde.

## T9 — Verificação final
- `npm test`, `npx tsc --noEmit`, eslint; diff de `tests/` mostrando que nenhum teste antigo foi enfraquecido.
- `git diff --stat` confirmando que os arquivos do Meu financeiro (`PainelResumo.tsx`, `Pendencias.tsx` e a lógica de `painel.ts`) não foram alterados; o golden pessoal verde.
- Conferência no navegador (débito, crédito antes e depois do fechamento, variável, encerrar; clicar em Entradas/Saídas no Meu financeiro e no grupo e conferir a soma com o indicador).
- Entregar a lista de arquivos alterados e o SQL para o usuário revisar. Sem commit.

## Ordem e dependências
T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T8b → T9. T3 e T4 são o núcleo de cálculo; T5 a T7 são UI e store; T8 depende de T3 e T4; T8b depende de T8.
