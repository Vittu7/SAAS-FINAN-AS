# HomeCash - Regras do Claude Code

## 1. Economia de tokens
- Seja direto e econômico nas respostas.
- Trabalhe sempre com o menor escopo possível.
- Analise somente arquivos necessários para a tarefa.
- Não leia arquivos completos quando bastarem trechos específicos.
- Não repita análises ou comandos sem necessidade.
- Não faça pesquisas externas sem necessidade.
- Não apresente várias soluções quando uma for suficiente.
- Evite explicações e resumos extensos.
- Não faça refatorações ou melhorias não solicitadas.

## 2. Desenvolvimento
- Identifique a causa do problema antes de corrigir.
- Altere o mínimo possível de arquivos.
- Preserve a arquitetura, os padrões e as funcionalidades existentes.
- Reaproveite componentes e funções existentes.
- Não reescreva arquivos inteiros para pequenas alterações.
- Não crie arquivos ou instale dependências sem necessidade.
- Não altere banco de dados, tabelas, RLS, autenticação ou regras financeiras sem autorização explícita.
- Não faça commit ou push sem autorização.

## 3. Validação
- Execute testes relacionados à alteração.
- Execute build somente quando necessário.
- Não repita verificações que já passaram sem motivo.
- Corrija apenas problemas relacionados à tarefa.
- Informe claramente quando não executar testes.

## 4. Resposta final
Responda de forma curta, informando somente:

1. **Problema:** causa identificada.
2. **Solução:** alteração realizada.
3. **Arquivos:** arquivos modificados.
4. **Testes:** verificações realizadas e resultados.

Não apresente melhorias adicionais ou sugestões não solicitadas.