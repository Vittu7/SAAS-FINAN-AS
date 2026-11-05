-- Performance das políticas RLS: auth.uid() -> (select auth.uid()).
-- Com o SELECT o Postgres calcula o usuário uma vez por consulta, e não uma vez por linha.
-- A regra de acesso de cada política é EXATAMENTE a mesma; só muda a forma de ler o usuário.
-- Usa ALTER POLICY (não apaga nem recria políticas). Pode ser rodado mais de uma vez.
--
-- Também troca o papel de "public" para "authenticated" nas políticas das tabelas de aportes e caixinhas antigas.
-- Para o anon nada muda na prática: sem login auth.uid() é nulo e nenhuma linha passava.

-- aportes_investimento
alter policy "Usuário lê os próprios aportes"       on public.aportes_investimento to authenticated using ((select auth.uid()) = user_id);
alter policy "Usuário registra os próprios aportes" on public.aportes_investimento to authenticated with check ((select auth.uid()) = user_id);
alter policy "Usuário edita os próprios aportes"    on public.aportes_investimento to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "Usuário exclui os próprios aportes"   on public.aportes_investimento to authenticated using ((select auth.uid()) = user_id);

-- caixinhas e movimentos
alter policy caixinhas_dono on public.caixinhas
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy caixinha_movimentos_dono on public.caixinha_movimentos
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.caixinhas c where c.id = caixinha_movimentos.caixinha_id and c.user_id = (select auth.uid())));

-- tabelas antigas de caixinha (sem uso no app; mantidas até decisão sobre remoção)
alter policy "caixinhas do proprio usuario" on public.caixinhas_investimento to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter policy "historico de caixinhas do proprio usuario" on public.movimentacoes_caixinha to authenticated
  using (owner_id = (select auth.uid()));

-- configuracoes, pagamentos de fatura, membros (antigo)
alter policy configuracoes_all on public.configuracoes
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy pagamentos_fatura_dono on public.pagamentos_fatura
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy membros_update_proprio on public.membros
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- perfis
alter policy perfis_proprio_insert on public.perfis with check (id = (select auth.uid()));
alter policy perfis_proprio_select on public.perfis using ((id = (select auth.uid())) or (user_id = (select auth.uid())));
alter policy perfis_proprio_update on public.perfis
  using ((id = (select auth.uid())) or (user_id = (select auth.uid())))
  with check ((id = (select auth.uid())) or (user_id = (select auth.uid())));
alter policy "Visualizar perfis autorizados" on public.perfis
  using ((user_id = (select auth.uid())) or (grupo_id in (select public.meus_grupos())));

-- extrato, cartao, contas_fixas: mesmas 6 políticas em cada tabela
do $$
declare t text;
begin
  foreach t in array array['extrato', 'cartao', 'contas_fixas'] loop
    execute format($f$alter policy dono_sem_grupo on public.%1$I
      using ((owner_id = (select auth.uid())) and (grupo_id is null))
      with check ((owner_id = (select auth.uid())) and (grupo_id is null)
                  and ((responsavel_id is null) or (responsavel_id = (select auth.uid())))) $f$, t);
    execute format($f$alter policy %2$I on public.%1$I
      using ((owner_id = (select auth.uid())) or (responsavel_id in (select public.meus_membros()))) $f$, t, t || '_select');
    execute format($f$alter policy %2$I on public.%1$I
      with check ((owner_id = (select auth.uid())) and (grupo_id in (select public.meus_grupos()))
                  and public.membro_pertence(responsavel_id, grupo_id)) $f$, t, t || '_insert');
    execute format($f$alter policy %2$I on public.%1$I
      using (owner_id = (select auth.uid()))
      with check ((owner_id = (select auth.uid())) and (grupo_id in (select public.meus_grupos()))
                  and public.membro_pertence(responsavel_id, grupo_id)) $f$, t, t || '_update');
    execute format($f$alter policy %2$I on public.%1$I
      using (owner_id = (select auth.uid())) $f$, t, t || '_delete');
    execute format($f$alter policy "partilha seletiva segura" on public.%1$I
      using (compartilhado_com = (select auth.uid())) $f$, t);
  end loop;
end $$;
