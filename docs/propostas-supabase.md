# Propostas para o Supabase que dependem de autorização

Nenhum dos blocos P1–P5 foi executado (situação abaixo). Cada bloco apaga algo e só deve rodar com autorização explícita.
As decisões D1 e D2 (fim do arquivo) já foram aplicadas pelas migrações 13 e 14.
Levantamento feito em 2026-11-04 no projeto `iitgqormevgznxikwyvu`.

Como as dependências foram verificadas (para todos os itens):
- `pg_constraint` (chaves estrangeiras), `pg_depend`/`pg_rewrite` (views), `pg_policies` (uso em políticas),
  `pg_proc.prosrc` (uso no corpo de outras funções) e `pg_trigger`.
- `git grep` em `src/` de **todas** as branches remotas e da branch atual.

## Situação em 2026-11-05

| Item | Situação |
|---|---|
| P1, P2, P3 | **Não autorizados** (decisão de 2026-11-05). Migrações `supabase-15`, `16` e `17` ficam só preparadas localmente; nada removido. Definições salvas em `supabase/arquivo/definicoes-anteriores.sql`. |
| P4 | **Exportado** para `backups/supabase-2026-11-05/` (fora do Git), md5 conferido (ver `MANIFESTO.md` na pasta). Tabelas **preservadas** no banco: não excluir (decisão de 2026-11-05). |
| P5 | Não executar (decisão do responsável). |

---

## P1. Sistema de grupo antigo (`grupos`, `membros`)

O app usa `grupos_familiares` + `perfis.grupo_id`. As tabelas abaixo são da primeira versão.

| Objeto | Linhas | Usado por |
|---|---|---|
| `grupos` | 0 | só funções desta lista; código só na branch antiga `fix/supabase-persistence` |
| `membros` | 0 | só funções desta lista |
| `criar_grupo`, `convidar_membro`, `aceitar_convites` | – | nenhuma chamada no código de nenhuma branch |
| `sou_dono` | – | políticas de `grupos`/`membros` e `convidar_membro` (somem juntas) |

```sql
begin;
drop function public.convidar_membro(uuid, text, text);
drop function public.criar_grupo(text, text);
drop function public.aceitar_convites();
drop table public.membros;   -- leva as políticas membros_*
drop table public.grupos;    -- leva as políticas grupos_*
drop function public.sou_dono(uuid);
commit;
```

Riscos: nenhum dado (tabelas vazias). Uma versão muito antiga do app que ainda chame essas funções receberia erro.
Recuperação: as definições completas estão salvas em `supabase/arquivo/definicoes-anteriores.sql`.

`membro_pertence`, `meus_grupos` e `meus_membros` **ficam**: são usadas pelas políticas de `extrato`, `cartao`,
`contas_fixas`, `perfis` e `grupos_familiares`.

## P2. Caixinhas antigas (`caixinhas_investimento`, `movimentacoes_caixinha`)

O app usa `caixinhas` + `caixinha_movimentos` (com o trigger `caixinha_movimentos_saldo`).

| Objeto | Linhas | Usado por |
|---|---|---|
| `caixinhas_investimento` | 0 | só `registrar_movimentacao_caixinha` |
| `movimentacoes_caixinha` | 0 | só `registrar_movimentacao_caixinha` (índice `movimentacoes_caixinha_por_data` nunca usado) |
| `registrar_movimentacao_caixinha` | – | nenhuma chamada no código de nenhuma branch |

```sql
begin;
drop function public.registrar_movimentacao_caixinha(uuid, text, numeric, date, text); -- devolve o tipo da tabela: sai antes
drop table public.movimentacoes_caixinha;
drop table public.caixinhas_investimento;
commit;
```

`aportes_investimento` (1 linha) **fica**: `AportesInvestimento.tsx` ainda lê e grava nela, e `excluir_minha_conta` a limpa.

## P3. Funções órfãs

| Função | Situação |
|---|---|
| `criar_formas_pagamento_padrao(uuid)` | só repassa para `criar_opcoes_padrao()`; nenhuma chamada no código |
| `entrar_grupo_familiar(uuid)` | sem EXECUTE para ninguém do app; substituída por `entrar_grupo_por_convite` |
| `cria_perfil_automatico()` | função de trigger sem trigger; `on_auth_user_created` usa `handle_new_user` |

```sql
begin;
drop function public.criar_formas_pagamento_padrao(uuid);
drop function public.entrar_grupo_familiar(uuid);
drop function public.cria_perfil_automatico();
commit;
```

`adicionar_convidado_grupo` ficou de fora: ver a decisão D1 abaixo.

## P4. Backups e marcadores antigos

| Tabela | Linhas | Usada por |
|---|---|---|
| `contas_fixas_backup_duplicatas_20261016` | 27 | nada |
| `contas_fixas_backup_duplicatas_20261016_02` | 9 | nada |
| `contas_fixas_backup_recorrencia_20261016` | 54 | nada |
| `caixinhas_migracao_legado` | 1 | nada |
| `opcoes_padrao_aplicadas` | 4 | nada (o marcador atual é `opcoes_padrao_criadas`, que **fica**) |

Antes de apagar: exportar cada tabela para JSON em `backups/` (pasta fora do Git), conferindo o md5 do arquivo
contra o md5 calculado no banco (`select md5(json_agg(t order by ...)::text) from ...`).

```sql
begin;
drop table public.contas_fixas_backup_duplicatas_20261016;
drop table public.contas_fixas_backup_duplicatas_20261016_02;
drop table public.contas_fixas_backup_recorrencia_20261016;
drop table public.caixinhas_migracao_legado;
drop table public.opcoes_padrao_aplicadas;
commit;
```

Recuperação: recriar a tabela e reimportar o JSON exportado.

## P5. Políticas sobrepostas (opcional, só desempenho)

O acesso efetivo hoje é a soma (OR) das políticas. A consolidação abaixo mantém exatamente o mesmo acesso:
o conteúdo de `dono_sem_grupo` e de `partilha seletiva segura` passa para as políticas por comando, e só então
essas duas são apagadas. Ganho pequeno com o volume atual de dados.

```sql
begin;
do $$
declare t text;
begin
  foreach t in array array['extrato', 'cartao', 'contas_fixas'] loop
    execute format($f$alter policy %2$I on public.%1$I using (
        (owner_id = (select auth.uid()))
        or (responsavel_id in (select public.meus_membros()))
        or (compartilhado_com = (select auth.uid()))) $f$, t, t || '_select');
    execute format($f$alter policy %2$I on public.%1$I with check (
        (owner_id = (select auth.uid())) and (
          ((grupo_id in (select public.meus_grupos())) and public.membro_pertence(responsavel_id, grupo_id))
          or ((grupo_id is null) and ((responsavel_id is null) or (responsavel_id = (select auth.uid())))))) $f$, t, t || '_insert');
    execute format($f$alter policy %2$I on public.%1$I using (owner_id = (select auth.uid())) with check (
        (owner_id = (select auth.uid())) and (
          ((grupo_id in (select public.meus_grupos())) and public.membro_pertence(responsavel_id, grupo_id))
          or ((grupo_id is null) and ((responsavel_id is null) or (responsavel_id = (select auth.uid())))))) $f$, t, t || '_update');
    execute format('drop policy dono_sem_grupo on public.%I', t);
    execute format('drop policy "partilha seletiva segura" on public.%I', t);
  end loop;
end $$;

alter policy "Visualizar perfis autorizados" on public.perfis using (
  (id = (select auth.uid())) or (user_id = (select auth.uid())) or (grupo_id in (select public.meus_grupos())));
drop policy perfis_proprio_select on public.perfis;
commit;
```

Verificação depois: o mesmo teste de contagem por usuário usado na migração 10 (0 diferenças esperadas),
mais testes de INSERT/UPDATE com e sem grupo.

---

## Decisões em aberto

- **D1. Quem adiciona convidado sem conta — RESOLVIDO (2026-11-05).** Só o gestor. Migração 13 aplicada:
  `adicionar_convidado` passou a chamar `adicionar_convidado_grupo`; o app usa `adicionar_convidado_grupo`
  e só mostra o botão ao gestor. Definição antiga em `supabase/arquivo/definicoes-anteriores.sql`.
- **D2. Regra 3 no banco — RESOLVIDO (2026-11-05).** Migração 14 aplicada e verificada (md5 dos dados igual antes/depois).
  `supabase/supabase-14-trava-repasse-confirmado.sql`: trigger em `extrato`, `cartao` e `contas_fixas` que recusa
  editar/excluir linha com `repasse_pago = true` pela API. O app já avisa antes de tentar e não move lançamentos
  com repasse confirmado para outro grupo.
- **D3. Proteção contra senhas vazadas.** Ativar no painel: Authentication → Providers → Email → "Prevent use of
  leaked passwords" (não dá para ligar por SQL).

---

## Migração 18 — fechamento mensal (preparada em 2026-11-05, NÃO aplicada)

`supabase/supabase-18-fechamento-mensal.sql`. Aditiva: cria `fechamento_controle`, `fechamento_meses`,
`fechamento_eventos`, as funções `iniciar_fechamento_mensal`, `fechar_mes`, `reabrir_mes` e as travas de mês fechado.
Não altera nem apaga dados; nenhum mês é fechado automaticamente.

Conferir no banco antes de aplicar (somente leitura):
1. `caixinha_movimentos.data` e `pagamentos_fatura.data`: tipo `date` (a trava usa `left(data::text, 7)`).
2. `public.meus_membros()` devolve os ids dos membros do grupo (usada na política de leitura de `fechamento_meses`).
3. `aportes_investimento` (tabela antiga, ainda usada por `AportesInvestimento.tsx`) **não** ganhou trava: confirmar
   colunas (`user_id`, data) e decidir se entra.
4. Definição atual de `atualizar_repasse` (não versionada): a trava de repasse vale para todos os papéis, então
   confirmar/estornar em mês fechado passa a ser recusado também dentro dessa função.

Testar com rollback: fechar um mês com um usuário de teste; tentar editar, excluir, lançar retroativo, mudar a data
para o mês fechado, marcar conta como paga, estornar repasse confirmado no mês fechado, registrar pagamento de fatura e
aporte com data no mês; tudo deve ser recusado. Reabrir com motivo curto deve falhar; com motivo válido, liberar.
