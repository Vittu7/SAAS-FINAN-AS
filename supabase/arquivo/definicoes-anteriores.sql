-- Definições de funções ANTES de serem substituídas ou removidas (para desfazer, se preciso).
-- Copiadas do banco em 2026-11-04 (pg_get_functiondef). Não rode este arquivo inteiro.

-- ===== adicionar_convidado (antes da migração 13: aceitava qualquer membro do grupo) =====
CREATE OR REPLACE FUNCTION public.adicionar_convidado(p_nome text, p_cor text DEFAULT '#10B981'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_grupo uuid;
  v_nome  text := btrim(coalesce(p_nome, ''));
  v_id    uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar logado.';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome do convidado.';
  end if;

  select grupo_id into v_grupo from public.perfis where (id = auth.uid() or user_id = auth.uid()) and grupo_id is not null limit 1;
  if v_grupo is null then
    raise exception 'Você ainda não está em um grupo familiar.';
  end if;

  insert into public.perfis (id, nome_usuario, grupo_id, cargo, eh_convidado, cor)
  values (gen_random_uuid(), v_nome, v_grupo, 'membro', true, coalesce(nullif(p_cor, ''), '#10B981'))
  returning id into v_id;

  return v_id;
end;
$function$;

-- =====================================================================================================
-- Objetos removidos pelas migrações 15 (P1), 16 (P2) e 17 (P3) em 2026-11-05. As tabelas estavam VAZIAS.
-- Para recriar: rodar os blocos na ordem deste arquivo (tabelas antes das funções que dependem delas).
-- =====================================================================================================

-- ===== P1: tabela grupos =====
CREATE TABLE public.grupos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  criado_por uuid DEFAULT auth.uid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT grupos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT grupos_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
  CONSTRAINT grupos_pkey PRIMARY KEY (id)
);
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

-- ===== P1: tabela membros =====
CREATE TABLE public.membros (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  grupo_id uuid NOT NULL,
  user_id uuid,
  email text,
  nome text NOT NULL,
  papel text DEFAULT 'membro'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT membros_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT membros_nome_check CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
  CONSTRAINT membros_papel_check CHECK ((papel = ANY (ARRAY['dono'::text, 'membro'::text]))),
  CONSTRAINT membros_pkey PRIMARY KEY (id),
  CONSTRAINT membros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX membros_nome_unico ON public.membros USING btree (grupo_id, lower(nome));
CREATE UNIQUE INDEX membros_user_unico ON public.membros USING btree (grupo_id, user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX membros_email_unico ON public.membros USING btree (grupo_id, lower(email)) WHERE (email IS NOT NULL);
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

-- ===== P1: função sou_dono =====
CREATE OR REPLACE FUNCTION public.sou_dono(p_grupo uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (
     select 1 from public.membros
     where grupo_id = p_grupo and user_id = auth.uid() and papel = 'dono'
   ) $function$;

-- ===== P1: políticas de grupos e membros =====
CREATE POLICY grupos_select ON public.grupos AS PERMISSIVE FOR SELECT TO authenticated USING ((id IN ( SELECT meus_grupos() AS meus_grupos)));
CREATE POLICY grupos_update ON public.grupos AS PERMISSIVE FOR UPDATE TO authenticated USING (sou_dono(id)) WITH CHECK (sou_dono(id));
CREATE POLICY grupos_delete ON public.grupos AS PERMISSIVE FOR DELETE TO authenticated USING (sou_dono(id));
CREATE POLICY membros_select ON public.membros AS PERMISSIVE FOR SELECT TO authenticated USING ((grupo_id IN ( SELECT meus_grupos() AS meus_grupos)));
CREATE POLICY membros_delete_dono ON public.membros AS PERMISSIVE FOR DELETE TO authenticated USING ((sou_dono(grupo_id) AND (papel <> 'dono'::text)));
CREATE POLICY membros_update_proprio ON public.membros AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

-- ===== P1: função aceitar_convites =====
CREATE OR REPLACE FUNCTION public.aceitar_convites()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_qtd int;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  update public.membros
     set user_id = auth.uid()
   where user_id is null
     and email is not null
     and lower(email) = lower(auth.jwt() ->> 'email');
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $function$;

-- ===== P1: função convidar_membro =====
CREATE OR REPLACE FUNCTION public.convidar_membro(p_grupo uuid, p_email text, p_nome text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_membro uuid;
begin
  if not public.sou_dono(p_grupo) then raise exception 'Só o dono do grupo pode convidar.'; end if;
  insert into public.membros (grupo_id, email, nome)
    values (p_grupo, nullif(lower(trim(coalesce(p_email, ''))), ''), trim(p_nome))
    returning id into v_membro;
  return v_membro;
end $function$;

-- ===== P1: função criar_grupo =====
CREATE OR REPLACE FUNCTION public.criar_grupo(p_nome text, p_meu_nome text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_grupo uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  insert into public.grupos (nome, criado_por) values (trim(p_nome), auth.uid())
    returning id into v_grupo;
  insert into public.membros (grupo_id, user_id, email, nome, papel)
    values (v_grupo, auth.uid(), lower(auth.jwt() ->> 'email'), trim(p_meu_nome), 'dono');
  return v_grupo;
end $function$;

-- ===== P2: tabela caixinhas_investimento =====
CREATE TABLE public.caixinhas_investimento (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  grupo_id uuid,
  nome text NOT NULL,
  reserva_emergencia boolean DEFAULT false NOT NULL,
  rendimento_estimado numeric(7,4) DEFAULT 0 NOT NULL,
  meta numeric(14,2) DEFAULT 0 NOT NULL,
  saldo_atual numeric(14,2) DEFAULT 0 NOT NULL,
  aporte_automatico numeric(14,2) DEFAULT 0 NOT NULL,
  exibir_no_painel boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT caixinhas_investimento_aporte_automatico_check CHECK ((aporte_automatico >= (0)::numeric)),
  CONSTRAINT caixinhas_investimento_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES grupos_familiares(id) ON DELETE SET NULL,
  CONSTRAINT caixinhas_investimento_meta_check CHECK ((meta >= (0)::numeric)),
  CONSTRAINT caixinhas_investimento_nome_check CHECK (((char_length(TRIM(BOTH FROM nome)) >= 1) AND (char_length(TRIM(BOTH FROM nome)) <= 80))),
  CONSTRAINT caixinhas_investimento_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT caixinhas_investimento_pkey PRIMARY KEY (id),
  CONSTRAINT caixinhas_investimento_rendimento_estimado_check CHECK ((rendimento_estimado >= (0)::numeric)),
  CONSTRAINT caixinhas_investimento_saldo_atual_check CHECK ((saldo_atual >= (0)::numeric))
);
CREATE UNIQUE INDEX caixinha_painel_unica_por_usuario ON public.caixinhas_investimento USING btree (owner_id) WHERE (exibir_no_painel = true);
CREATE UNIQUE INDEX reserva_emergencia_unica_por_usuario ON public.caixinhas_investimento USING btree (owner_id) WHERE (reserva_emergencia = true);
ALTER TABLE public.caixinhas_investimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caixinhas do proprio usuario" ON public.caixinhas_investimento AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

-- ===== P2: tabela movimentacoes_caixinha =====
CREATE TABLE public.movimentacoes_caixinha (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  caixinha_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  tipo text NOT NULL,
  valor numeric(14,2) NOT NULL,
  data_movimentacao date DEFAULT CURRENT_DATE NOT NULL,
  observacao text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT movimentacoes_caixinha_caixinha_id_fkey FOREIGN KEY (caixinha_id) REFERENCES caixinhas_investimento(id) ON DELETE CASCADE,
  CONSTRAINT movimentacoes_caixinha_observacao_check CHECK (((observacao IS NULL) OR (char_length(observacao) <= 240))),
  CONSTRAINT movimentacoes_caixinha_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT movimentacoes_caixinha_pkey PRIMARY KEY (id),
  CONSTRAINT movimentacoes_caixinha_tipo_check CHECK ((tipo = ANY (ARRAY['Aporte'::text, 'Resgate'::text]))),
  CONSTRAINT movimentacoes_caixinha_valor_check CHECK ((valor > (0)::numeric))
);
CREATE INDEX movimentacoes_caixinha_por_data ON public.movimentacoes_caixinha USING btree (caixinha_id, data_movimentacao DESC, created_at DESC);
ALTER TABLE public.movimentacoes_caixinha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historico de caixinhas do proprio usuario" ON public.movimentacoes_caixinha AS PERMISSIVE FOR SELECT TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));

-- ===== P2: função registrar_movimentacao_caixinha =====
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_caixinha(p_caixinha_id uuid, p_tipo text, p_valor numeric, p_data date DEFAULT CURRENT_DATE, p_observacao text DEFAULT NULL::text)
 RETURNS movimentacoes_caixinha
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_movimentacao public.movimentacoes_caixinha;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if p_tipo not in ('Aporte', 'Resgate') then
    raise exception 'Tipo de movimentação inválido';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor deve ser maior que zero';
  end if;
  update public.caixinhas_investimento
  set saldo_atual = saldo_atual + case when p_tipo = 'Aporte' then p_valor else -p_valor end,
      updated_at = now()
  where id = p_caixinha_id and owner_id = auth.uid() and (p_tipo = 'Aporte' or saldo_atual >= p_valor);
  if not found then
    raise exception 'Caixinha não encontrada ou saldo insuficiente';
  end if;
  insert into public.movimentacoes_caixinha (caixinha_id, owner_id, tipo, valor, data_movimentacao, observacao)
  values (p_caixinha_id, auth.uid(), p_tipo, p_valor, coalesce(p_data, current_date), nullif(trim(p_observacao), ''))
  returning * into v_movimentacao;
  return v_movimentacao;
end;
$function$;

-- ===== P3: função criar_formas_pagamento_padrao =====
CREATE OR REPLACE FUNCTION public.criar_formas_pagamento_padrao(p_grupo_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.criar_opcoes_padrao(); $function$;

-- ===== P3: função entrar_grupo_familiar (estava sem EXECUTE para authenticated/anon) =====
CREATE OR REPLACE FUNCTION public.entrar_grupo_familiar(p_grupo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_perfil_id uuid;
    v_grupo_atual uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;
    SELECT id, grupo_id INTO v_perfil_id, v_grupo_atual
      FROM public.perfis WHERE user_id = v_user_id AND id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado.';
    END IF;
    IF v_grupo_atual IS NOT NULL THEN
        RAISE EXCEPTION 'Você já pertence a um grupo.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.grupos_familiares WHERE id = p_grupo_id) THEN
        RAISE EXCEPTION 'Grupo não encontrado.';
    END IF;
    UPDATE public.perfis SET grupo_id = p_grupo_id, cargo = 'membro'
     WHERE id = v_perfil_id AND user_id = v_user_id AND grupo_id IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Não foi possível vincular seu perfil.';
    END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.entrar_grupo_familiar(uuid) FROM public, anon, authenticated;

-- ===== P3: função cria_perfil_automatico (função de trigger sem trigger) =====
CREATE OR REPLACE FUNCTION public.cria_perfil_automatico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.perfis (id, user_id, nome_usuario, cargo, eh_convidado)
  VALUES (NEW.id, NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'membro', false)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id WHERE public.perfis.user_id IS NULL;
  RETURN NEW;
END;
$function$;
