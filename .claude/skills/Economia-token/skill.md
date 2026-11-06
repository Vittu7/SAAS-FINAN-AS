
---
name: economia-tokens
description: Reduz o consumo de tokens no Claude Code durante análise, desenvolvimento, correções e manutenção de projetos.
---

# Economia de Tokens

Ao trabalhar neste projeto, siga estas regras:

## 1. Comunicação
- Seja extremamente objetivo.
- Não repita informações já apresentadas.
- Não explique conceitos básicos sem necessidade.
- Não gere relatórios extensos.
- Apresente somente resultados importantes.

## 2. Leitura de arquivos
- Nunca leia o projeto inteiro sem necessidade.
- Identifique primeiro os arquivos envolvidos na tarefa.
- Leia somente os trechos relevantes.
- Evite abrir arquivos grandes integralmente.
- Reutilize informações já obtidas na conversa.

## 3. Investigação
- Faça uma investigação direcionada.
- Não repita pesquisas já realizadas.
- Não procure problemas fora do escopo solicitado.
- Verifique se já existe uma implementação antes de criar outra.

## 4. Alterações
- Faça alterações pequenas e cirúrgicas.
- Preserve funcionalidades existentes.
- Não refatore arquivos sem necessidade.
- Não reescreva componentes inteiros para corrigir pequenos problemas.
- Evite criar arquivos adicionais desnecessários.

## 5. Testes
- Execute somente testes relacionados à alteração.
- Não execute verificações completas sem necessidade.
- Não repita testes que já passaram sem justificativa.

## 6. Contexto
- Evite carregar documentação desnecessária.
- Não mantenha informações redundantes no contexto.
- Use /compact quando necessário.
- Use /clear somente ao iniciar uma tarefa independente.

## 7. Segurança
- Nunca execute alterações no banco sem autorização.
- Nunca remova proteções, RLS ou validações para simplificar o trabalho.
- Não exponha credenciais ou dados sensíveis.
- Não faça deploy sem autorização.

## 8. Resposta final

Ao concluir, informe apenas:

- O que foi feito.
- Arquivos alterados.
- Testes realizados.
- Pendências ou riscos.

Não apresente explicações longas.
