-- Índices para chaves estrangeiras sem cobertura (apontadas pelo Supabase Advisor).
-- Só ADICIONA índices; não altera dados. Pode ser rodado mais de uma vez.
--
-- Benefício:
--   * perfis(user_id) e perfis(grupo_id): meus_grupos() e meus_membros() filtram perfis por user_id em TODA
--     política RLS de extrato, cartao, contas_fixas e perfis; e a tela do grupo lista perfis por grupo_id.
--   * grupo_id / usuario_id nos lançamentos: excluir grupo (update ... where grupo_id) e excluir conta
--     (delete ... where usuario_id, trigger em auth.users) deixam de varrer a tabela inteira.
--
-- Tabelas antigas sem uso (caixinhas_investimento, movimentacoes_caixinha, grupos, membros) ficaram de fora:
-- estão vazias e são candidatas a remoção.

create index if not exists perfis_user_id_idx            on public.perfis (user_id);
create index if not exists perfis_grupo_id_idx           on public.perfis (grupo_id);

create index if not exists extrato_grupo_id_idx          on public.extrato (grupo_id);
create index if not exists extrato_usuario_id_idx        on public.extrato (usuario_id);
create index if not exists cartao_grupo_id_idx           on public.cartao (grupo_id);
create index if not exists cartao_usuario_id_idx         on public.cartao (usuario_id);
create index if not exists contas_fixas_grupo_id_idx     on public.contas_fixas (grupo_id);

create index if not exists opcoes_pagamento_grupo_id_idx on public.opcoes_pagamento (grupo_id);
create index if not exists opcoes_categoria_grupo_id_idx on public.opcoes_categoria (grupo_id);

create index if not exists convites_grupo_familiar_grupo_id_idx   on public.convites_grupo_familiar (grupo_id);
create index if not exists convites_grupo_familiar_criado_por_idx on public.convites_grupo_familiar (criado_por);
