# Alterações — SAAS FINANCEIRO

## Ordem para aplicar
1. **Supabase → SQL Editor:** rode `supabase/migrations/02_privacidade_opcoes_e_cartoes.sql` (pode rodar mais de uma vez).
2. Copie os arquivos desta pasta para o repositório, mantendo os caminhos (substituem os existentes).
3. `git push` → deploy na Vercel.

> Rode o SQL **antes** do deploy: o código novo lê `user_id` em `opcoes_pagamento` / `opcoes_categoria`.

## Depois do SQL, confira
```sql
select tablename, policyname, cmd, qual from pg_policies
 where tablename in ('opcoes_pagamento','opcoes_categoria');   -- 1 policy por tabela, usando user_id
select count(*) from opcoes_pagamento where user_id is null;    -- ideal: 0
select count(*) from opcoes_categoria where user_id is null;    -- ideal: 0
```

## Cadastros antigos
Não havia registro de quem criou cada cartão/categoria/forma de pagamento. Os que já existiam foram atribuídos
ao gestor do grupo (perfil que não é convidado). Os demais membros começam apenas com os padrões
(Débito, Pix, Dinheiro e 9 categorias genéricas) e cadastram os próprios.
