# HomeCash

Controle financeiro pessoal e familiar: lançamentos, cartões e faturas, contas fixas, caixinhas (reservas),
grupo familiar com repasses entre membros e relatórios.

Next.js 16 (App Router) + React 19, Tailwind CSS 4, Supabase (Auth, Postgres com RLS e Storage) e Vitest.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:3000
npx vitest run   # testes
npm run build    # build de produção
```

Crie um `.env.local` com:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Estrutura

```
src/app/          rotas: / (painel), /login, /perfil, /privacidade, /termos
src/components/   telas e componentes (mobile/ = versão celular)
src/hooks/        estado com Supabase: useFinanceStore (lançamentos e repasses), useCaixinhas,
                  usePagamentosFatura, useMovimentosConta, useDashboardPreferences
src/lib/          regras puras (sem React) + cliente Supabase
tests/            testes Vitest das regras em src/lib
supabase/         scripts SQL (ver abaixo)
docs/arquivo/     material antigo, só para consulta
```

### Onde fica cada regra

| Assunto | Arquivo |
|---|---|
| Totais do mês, entradas/saídas, sem duplicados | `lib/calculos.ts`, `lib/finance.ts` |
| Saldo das contas e disponibilidade | `lib/contas.ts` |
| Cartões (crédito/débito unificados, cor) | `lib/cartoes.ts` |
| Fatura do cartão e pagamentos de fatura | `lib/pagamentoFatura.ts` |
| Caixinhas | `lib/caixinhas.ts` |
| Grupo familiar e repasses | `lib/grupo.ts`, `lib/lancamentosGrupo.ts` |
| Datas (AAAA-MM-DD, sem fuso) | `lib/datas.ts` |
| Painel, relatório e gráficos | `lib/painel.ts`, `lib/relatorio.ts`, `lib/serie.ts` |

## Banco de dados (Supabase)

- Toda tabela tem RLS; operações sensíveis (grupo, repasses, excluir conta) passam por funções `security definer`
  chamadas com `supabase.rpc(...)`.
- O histórico de scripts está incompleto no repositório: os scripts 01–07 foram rodados manualmente no SQL Editor
  e não estão versionados. `supabase/supabase-08-pagamentos-fatura.sql` é o mais recente.
- `supabase/supabase-09` a `11` já foram aplicados: permissões de funções, RLS com `(select auth.uid())` e índices.
- `supabase/supabase-12-perfis-protecao.sql` **ainda não foi aplicado**: rode só depois do deploy do código que entra
  no grupo por código de convite (ele impede gravar `grupo_id`/`cargo` direto no perfil).
- `supabase/supabase-13-convidado-so-gestor.sql` já foi aplicado (só o gestor adiciona convidado sem conta).
- `supabase/supabase-14-trava-repasse-confirmado.sql` **ainda não foi aplicado** (trava edição/exclusão de lançamento
  com repasse confirmado até o estorno).
- `docs/propostas-supabase.md` lista remoções e consolidações que dependem de autorização (com o SQL exato).
- `supabase/diagnostico-limpeza.sql` contém apenas consultas de leitura para auditar o banco antes de qualquer limpeza.
- Novos scripts devem ser aditivos e reexecutáveis (`if not exists`, `drop policy if exists` + `create policy`).

## Deploy

Push no `main` → Vercel. Quando houver SQL novo, rode-o no Supabase **antes** do deploy.
