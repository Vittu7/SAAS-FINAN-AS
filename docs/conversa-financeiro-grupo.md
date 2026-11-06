# Conversa: Meu financeiro × Financeiro do grupo (2026-11-06)

## Pedido
Duas visões fixas no painel (sem o antigo filtro de responsáveis):
- **Meu financeiro**: minhas entradas, despesas, resultado e saldo.
- **Financeiro do grupo**: meu financeiro + o que outros membros usaram do meu dinheiro/cartão, com os repasses, sem duplicar nada. Saldos, caixinhas e faturas dos outros membros não entram.

Restrições: não alterar o banco, não fechar outubro, não commitar.

## Regras definidas
1. A despesa pertence ao mês em que foi lançada. O recebimento do repasse aumenta o caixa **no mês do recebimento**. Outubro nunca é recalculado por causa de novembro.
2. Repasse é transferência interna: nunca é entrada nem despesa do grupo.
3. Cada lançamento tem um único responsável, então somar as linhas não duplica despesa.
4. O repasse recebido aumenta o caixa, mas não entra em Entradas nem em Resultado.
5. "Quem deve": mantida a regra do HEAD (a despesa pesa no caixa quando o repasse é concluído).

## Diagnóstico da divergência (consultas somente de leitura no Supabase)
Outubro, usuário Vitu:

| Item | Valor |
|---|---|
| Entradas | 2.159,00 |
| Minhas despesas | 1.646,01 |
| Resultado do mês | 512,99 |
| Compras minhas no crédito (fatura em aberto) | +932,01 |
| Adiantado no débito (Prestação Casa 300 + Grades 125, da Gisa) | 425,00 |
| Adiantado no crédito (compensa na fatura) | 1.436,11 |

- **R$ 1.020,00** = 512,99 + 932,01 − 425,00 (regra do HEAD, correta).
- **R$ 1.445,00** = 512,99 + 932,01 (working tree: desfazia retroativamente o adiantado quando o repasse foi concluído em 05/11).
- **Diferença de R$ 425,00** = Prestação Casa (300) + Grades (125).
- Faturas de outubro pagas em 06/11: 2.368,12 (932,01 minhas + 1.436,11 de terceiros).

## Cálculo do Financeiro do grupo (outubro)
| Linha | Valor |
|---|---|
| Entradas | 2.159,00 |
| Minhas despesas | 1.646,01 |
| Pagas por mim para outros | 1.861,11 |
| Despesas totais | 3.507,12 |
| Caixa disponível | 1.020,00 |
| A receber dos membros | 1.861,11 |
| Faturas em aberto | −2.368,12 |
| **Quanto efetivamente tenho** | **512,99** |

Por membro (usou em outubro / falta em novembro): Gisa 828,73 / 1.128,25; Mãe 510,05 / 449,25; Dimitrios 522,33 / 13,25.

## O que foi alterado no código (nada commitado)
- `src/lib/painel.ts` e os testes `caixa-credito`, `painel`, `repasses-regras`, `resumo-indicadores`: revertida a mudança que recalculava outubro (edições pontuais; backup do diff antigo em `wip-painel-backup.patch` na pasta temporária da sessão).
- Novo `src/lib/financeiroGrupo.ts`: `financeiroDoGrupo(painel, dados, meuId)`, calculada sobre o `calcularPainel` com escopo só do usuário.
- Novo `src/components/resumo/FinanceiroGrupoCard.tsx`: card do grupo, repasses por membro e seletor de duas opções.
- `src/app/page.tsx`: estado `visaoFin` e o seletor na tela inicial.
- Novo `tests/financeiro-grupo.test.ts` (5 testes).

Verificação: 390 testes passando, `tsc` limpo, eslint sem erros nos arquivos novos.

## Pendências
- **Dúvida aberta:** o "Meu financeiro" destaca o Total disponível (R$ 1.020,00). O resultado do mês (R$ 512,99) aparece na linha Entrou/Saiu/Resultado. Decidir se o número principal passa a ser o resultado.
- Renomear `previsao.faturasOutros` (hoje inclui também as faturas próprias).
- Conferência visual no navegador ainda não feita.
- Outubro continua aberto; nenhum commit foi feito.
