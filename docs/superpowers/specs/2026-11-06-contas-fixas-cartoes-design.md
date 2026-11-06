# Contas fixas integradas a contas, débito e crédito — Design

Status: aguardando aprovação do spec e do plano. Nenhum código, SQL ou dado foi alterado.

## Objetivo
Contas fixas passam a respeitar a forma de pagamento (débito, crédito, dinheiro/Pix), o fechamento da fatura e o valor variável, sem criar outro sistema de recorrência e sem mexer no histórico.

## Decisões aprovadas
1. **Crédito, manual:** o usuário marca "Cobrada no cartão" quando a cobrança aparece. Isso é diferente de "Fatura paga".
2. **Pendentes separadas:** conta pendente continua separada do disponível, sem ser descontada de novo.
3. **Fechamento:** vale a partir de **2026-11** (`MES_CORTE_FECHAMENTO`). Outubro e anteriores ficam exatamente como estão.

## Restrições
- Preservar todo o histórico; não alterar os 19 repasses já corrigidos; não fechar outubro.
- Sem duplicar despesa nem pagamento de fatura.
- Financeiro pessoal e do grupo usam o mesmo cálculo.
- Valor variável não altera meses anteriores. Encerrar não apaga histórico.
- Migração SQL só aditiva: eu escrevo o arquivo, o usuário revisa e executa. Nada é executado por mim.

## Modelo de estados (reaproveita `contas_fixas.pago`)
`pago` não ganha novo significado oculto: o rótulo muda conforme o tipo da forma de pagamento.

| Forma | `pago=false` | `pago=true` | Efeito no caixa |
|---|---|---|---|
| Débito | Pendente | Paga (em `pago_em`) | Saldo da conta cai no mês de `pago_em` |
| Crédito | Pendente | **Cobrada no cartão** (em `pago_em` = data da cobrança) | Nenhum. Entra na fatura; o dinheiro sai ao pagar a fatura |
| Dinheiro/Pix/sem tipo | Pendente | Paga | Sem controle de saldo, como hoje |

Histórico: linhas antigas com `pago=true` no crédito já estão nas faturas e passam a ser lidas como "cobrada", sem migração de dados. Linhas sem `pago_em` usam o `mes` da linha, como hoje.

## Mudanças de dados (migração aditiva, `supabase-23-contas-fixas.sql`, NÃO executada)
- `contas_fixas`: `valor_variavel boolean not null default false`, `valor_confirmado boolean not null default true`, `pago_em date null`, `encerrada_em text null` (mês AAAA-MM em que a série deixa de gerar).
- `opcoes_pagamento`: `dia_fechamento smallint null` (1–31), com check.
- Nenhum UPDATE, DELETE ou backfill. Defaults reproduzem o comportamento atual. Os triggers de mês fechado e de repasse confirmado (scripts 14 e 18) continuam valendo. O trigger 14 já permite alterar `pago`; incluir as colunas novas na lista de campos permitidos.

## Regras de cálculo
1. **Fatura do item (crédito):** para `mes < 2026-11` ou cartão sem `dia_fechamento`, vale o `mes` do item (hoje). A partir de 2026-11, a conta fixa cobrada cai no mês `mesDaFatura(pago_em, dia_fechamento)`: dia ≤ fechamento fica no mês da data; dia > fechamento vai para o mês seguinte. O vencimento da fatura usa `dia_vencimento` (já existe).
2. **`calcularFatura`:** passa a **excluir conta fixa pendente** e a incluir a cobrada na fatura calculada. Corrige a divergência atual entre a tela de pagar fatura e `faturasEmAberto`.
3. **Pagar fatura:** continua em `pagamentos_fatura` (id idempotente). Saída da conta escolhida, nunca despesa.
4. **Saldo de conta de débito:** conta fixa paga entra no mês de `pago_em` (fallback `mes`). Crédito nunca mexe em saldo.
5. **Competência da despesa:** a conta fixa é despesa uma única vez, no `mes` dela. Cobrança e pagamento de fatura são só movimentos de caixa.
6. **Pendente:** continua em `contasPendentes`, separada do disponível, fora de "Saiu" e fora do saldo bancário.
7. **Valor variável:** a série nasce com `valor_variavel=true`. Cada mês novo copia o valor anterior como previsto (`valor_confirmado=false`) e a UI pede "informar valor". Editar altera só aquela linha. O mês seguinte copia o último valor informado, sem tocar nos anteriores.
8. **Encerrar:** grava `encerrada_em` nas linhas da série. `gerarContasFixasDoMes` não gera meses depois dele. As linhas existentes ficam. A exclusão total continua existindo, com aviso e confirmação reforçada.

## Separação de escopo (regra explícita)
**Compartilhado entre telas** (só cadastro e mecânica, sem mudar indicadores nem saldo apresentado): cadastro de conta fixa, forma de pagamento, status "Cobrada no cartão", `pago_em`, valor variável, encerrar, `dia_fechamento`, telas de fatura e pagamento de fatura, saldo de cada conta de débito.

**Exclusivo do Financeiro do grupo** (única tela cujos indicadores e apresentação mudam): Dinheiro disponível do grupo, Contas pendentes, Faturas em aberto e Total efetivamente pago no mês.

**Meu financeiro (pessoal) fica exatamente como está:** `calcularPainel`, `calcularMes`, `PainelResumo`, `Pendencias`, o bloco "Ainda vai sair" e o Total disponível não mudam de lógica, de números nem de layout. Nenhum campo novo é lido por eles.

Como garantir:
- O mapeamento fatura-por-fechamento é um helper novo, ativado por parâmetro. Os cálculos pessoais (`faturasEmAberto` e `ajusteDeFaturas` chamados pelo painel) continuam no caminho legado, que usa `mes` do item. O helper só é usado pelas telas de fatura e pelo Financeiro do grupo.
- `calcularFatura` excluir conta fixa pendente só afeta a tela de fatura (a lógica pessoal já exclui pendentes por conta própria).
- Teste de regressão (golden): para os mesmos dados de entrada, `calcularPainel`/resumo pessoal retornam resultado idêntico antes e depois, incluindo novembro com contas cobradas e `dia_fechamento` definido.
- Os componentes do painel pessoal não são editados. Se algum arquivo compartilhado tiver de mudar, o diff precisa mostrar que o pessoal não é afetado.

## Financeiro do grupo
Continua derivado do Painel pessoal e de `lancamentosDoGrupo`, sem alterá-los. Quatro números, calculados só em `financeiroGrupo.ts` e exibidos só em `FinanceiroGrupoCard.tsx`:
- **Dinheiro disponível do grupo:** `disponivelGrupo` atual (meu disponível + repasses recebidos − utilizado pelos integrantes).
- **Contas pendentes:** soma das fixas pendentes (informativo; não subtrai do disponível).
- **Faturas em aberto:** total em aberto, com fechamento aplicado (informativo; não subtrai do disponível).
- **Total efetivamente pago no mês:** fixas pagas no débito/dinheiro (`pago_em` no mês) mais pagamentos de fatura do mês. Fixa no crédito só entra aqui via pagamento da fatura, nunca duas vezes.

Impacto, só no card do grupo: a linha "Quanto efetivamente tenho" (disponível menos faturas em aberto) sai, ou vira texto informativo claramente separado do disponível, para não parecer um segundo desconto.

## Detalhamento de Entradas e Saídas (requisito adicional)
Regra central: **o detalhe é gerado a partir da mesma lista que produz o indicador**. Valor e detalhe nunca são calculados por caminhos separados, então a soma das linhas exibidas é igual ao número clicado.

### Meu financeiro (somente minhas movimentações)
- Clicar em **Entradas** lista só as entradas que são minhas; clicar em **Saídas** lista só as despesas que são minhas.
- O critério é o **responsável do lançamento**, não quem lançou. Lançamento feito por outro integrante em que eu sou o responsável aparece (com o autor identificado); lançamento meu em que outro é o responsável não aparece.
- Nada dos outros integrantes aparece, mesmo lançado por eles em contas ou cartões compartilhados.
- Segue as regras atuais do Meu financeiro (competência, repasse como transferência interna, pagamento de fatura que não é despesa). Sem mudança de lógica nem de números pessoais.

### Financeiro do grupo (visão consolidada)
- Dois indicadores novos, calculados em `financeiroGrupo.ts`: **Entradas do grupo** e **Saídas do grupo**.
- Clicar em cada um abre o detalhe de **todos os integrantes**, com duas colunas de identificação: **quem lançou** (autor) e **de quem é** (responsável).
- **Entradas do grupo:** entradas de renda de todos os integrantes na competência. Repasse recebido não é entrada (transferência interna).
- **Saídas do grupo:** despesas de todos os integrantes na competência, cada uma uma vez (um responsável por lançamento). Repasse não é saída. Pagamento de fatura não é despesa; o gasto já está na competência em que foi lançado.
- Não mistura valores pessoais com os do grupo: cada tela tem a sua lista e o seu total. As duas visões trocam só pelo seletor, sem estado compartilhado de detalhe.

### Decisão: alcance dos dados do grupo (opção A, aprovada)
O banco só entrega ao usuário o que ele lançou (`owner_id`) ou o que é de responsabilidade de um perfil dele (`meus_membros()` = perfis ligados ao próprio usuário). Lançamentos que outro usuário faz para si mesmo, ou para um terceiro, não chegam ao cliente (verificado em `pg_policies`, só leitura).
- "Entradas do grupo" e "Saídas do grupo" consolidam **tudo o que o usuário enxerga**, sem duplicar, e a tela diz isso ("lançamentos visíveis para você").
- Nenhuma alteração de banco ou de política de acesso. Saldo, caixinha e fatura de outros integrantes continuam fora.
- Se algum dia for preciso incluir lançamentos que não chegam ao cliente, será outra decisão (mudança de política de acesso, com revisão do usuário).
- Competência: o grupo conta a despesa no mês em que foi lançada, inclusive a que outro integrante lançou para mim e cujo repasse ainda não foi confirmado (no Meu financeiro ela só entra depois da confirmação; no grupo ela é a despesa do grupo, contada uma vez).
- Saídas do grupo mostram só despesas realizadas; contas fixas pendentes seguem no informativo "Contas pendentes" e não entram na lista, para a soma bater com o indicador.

### Regras de consistência
1. Sem duplicidade: repasse, pagamento de fatura e despesa aparecem no máximo uma vez, em cada visão. Mesma chave de deduplicação do indicador (por exemplo, parcela e conta fixa já tratadas em `calculos.ts`).
2. Competência: o detalhe obedece ao mês selecionado, com a mesma regra do indicador (despesa no mês em que foi lançada).
3. Igualdade exata: soma do detalhe = indicador, em centavos, em todos os meses, inclusive outubro (que não muda).
4. Isolamento: Meu financeiro continua exclusivamente pessoal; só o Financeiro do grupo é consolidado.
5. Pontos de atenção: se hoje o detalhe do Meu financeiro já respeita o critério acima, não há mudança nele. Se o teste mostrar que hoje ele lista movimentações de outros integrantes, isso é uma correção de detalhe (o total não muda) e será apontada ao usuário antes de ser aplicada, por tocar o Meu financeiro.

## Fora do escopo
Recorrências não mensais; cobrança automática no vencimento; mexer em repasses ou em outubro; qualquer SQL executado por mim.

## Impactos esperados nos números atuais
- **Outubro e anteriores:** nenhuma mudança (regra do corte, fallback sem `pago_em`). Testes de regressão fixam isso.
- **Tela de pagar fatura:** o total pode diminuir se houver conta fixa pendente no cartão. Isso é correto, pois ela ainda não foi cobrada.
- **Novembro em diante:** conta fixa no crédito só entra na fatura depois de marcada como cobrada; o disponível não muda, já que a pendente já estava separada.
- **Meu financeiro:** nenhuma mudança de números ou layout (ver "Separação de escopo").

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Quebrar o histórico | Corte `2026-11`, fallback sem `pago_em`, testes de regressão com dados de outubro |
| Dupla contagem | Teste único de invariantes: fixa de crédito conta 1x na despesa e 1x no caixa (pagamento) |
| Migração não executada antes do deploy | Código tolera colunas ausentes (leitura com default); aviso na UI como em `dia_vencimento` |
| `EditarLancamentoModal` alterar outras linhas | Verificar e cobrir com teste antes de mudar |
| Detalhe divergir do indicador | Indicador e detalhe saem da mesma lista; teste de soma exata por mês |
| Meu financeiro mostrar movimento de outro integrante | Filtro por responsável com teste; correção só no detalhe e avisada antes |
