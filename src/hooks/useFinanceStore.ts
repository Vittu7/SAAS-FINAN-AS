"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Registro = Record<string, any>;

type FinanceState = {
  extrato: Registro[];
  cartao: Registro[];
  contas: Registro[];
  membros: Registro[];
  config: Registro;
  carregando: boolean;
};

const estadoInicial: FinanceState = {
  extrato: [],
  cartao: [],
  contas: [],
  membros: [],
  config: {},
  carregando: true,
};

export function useFinanceStore() {
  const [dados, setDados] = useState<FinanceState>(estadoInicial);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Registro | null>(null);

  const carregarDados = useCallback(async () => {
    setDados((atual) => ({ ...atual, carregando: true }));

    try {
      const {
        data: { user },
        error: erroAuth,
      } = await supabase.auth.getUser();

      if (erroAuth) throw erroAuth;

      if (!user) {
        setUsuarioId(null);
        setPerfil(null);
        setDados(estadoInicial);
        return;
      }

      setUsuarioId(user.id);

      const { data: perfilData, error: erroPerfil } = await supabase
        .from("perfis")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (erroPerfil) throw erroPerfil;

      if (!perfilData) {
        setPerfil(null);
        setDados({ ...estadoInicial, carregando: false });
        return;
      }

      // Validação de segurança: se houver grupo_id, verificamos se o grupo realmente existe na tabela grupos
      let grupoIdValido = perfilData.grupo_id ?? null;
      if (grupoIdValido) {
        const { data: grupoExiste } = await supabase
          .from("grupos")
          .select("id")
          .eq("id", grupoIdValido)
          .maybeSingle();
        
        if (!grupoExiste) {
          grupoIdValido = null; // Anula o grupo se ele não existir na base de dados
        }
      }

      // Atualiza o perfil localmente com o grupo validado
      const perfilTratado = { ...perfilData, grupo_id: grupoIdValido };
      setPerfil(perfilTratado);

      const filtro = grupoIdValido
        ? "usuario_id.eq." + user.id +
          ",responsavel_id.eq." + perfilData.id +
          ",grupo_id.eq." + grupoIdValido
        : "usuario_id.eq." + user.id;

      const [extratoRes, cartaoRes, contasRes, membrosRes] =
        await Promise.all([
          supabase.from("extrato").select("*").or(filtro),
          supabase.from("cartao").select("*").or(filtro),
          supabase
            .from("contas_fixas")
            .select("*")
            .eq("owner_id", user.id)
            .order("mes", { ascending: true }),
          grupoIdValido
            ? supabase
                .from("perfis")
                .select("*")
                .eq("grupo_id", grupoIdValido)
            : supabase.from("perfis").select("*").eq("id", perfilData.id),
        ]);

      if (extratoRes.error) throw extratoRes.error;
      if (cartaoRes.error) throw cartaoRes.error;
      if (contasRes.error) throw contasRes.error;
      if (membrosRes.error) throw membrosRes.error;

      setDados({
        extrato: extratoRes.data ?? [],
        cartao: cartaoRes.data ?? [],
        contas: (contasRes.data ?? []).map((item) => ({
          ...item,
          responsavel: item.responsavel_id,
          responsavelNome: item.responsavel_id,
          formaPagamento: item.forma_pagamento,
        })),
        membros: membrosRes.data ?? [],
        config: {
          salario: perfilTratado.salario ?? 0,
          investido: perfilTratado.investido ?? 0,
          reserva_atual: perfilTratado.reserva_atual ?? 0,
          reserva_meta: perfilTratado.reserva_meta ?? 0,
          ...perfilTratado,
        },
        carregando: false,
      });
    } catch (erro) {
      console.error("Erro ao carregar dados financeiros:", erro);
      setDados((atual) => ({ ...atual, carregando: false }));
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const inserir = useCallback(
    async (tabela: string, item: Registro) => {
      if (!usuarioId) {
        throw new Error("Faça login antes de salvar.");
      }

      const registro = {
        ...item,
        usuario_id: usuarioId,
        ...(perfil?.grupo_id
          ? { grupo_id: perfil.grupo_id }
          : {}),
      };

      const { error } = await supabase
        .from(tabela)
        .insert(registro);

      if (error) throw error;

      await carregarDados();
    },
    [usuarioId, perfil, carregarDados],
  );

  const adicionarExtrato = useCallback(
    (item: Registro) => inserir("extrato", item),
    [inserir],
  );

  const adicionarCartao = useCallback(
    (item: Registro) => inserir("cartao", item),
    [inserir],
  );

  const adicionarConta = useCallback(
    async (item: Registro) => {
      if (!usuarioId) {
        throw new Error("Faça login antes de salvar.");
      }

      // Força a utilização do grupo apenas se ele estiver validado no perfil
      const grupoIdValido = perfil?.grupo_id ? perfil.grupo_id : null;

      const registro = {
        owner_id: usuarioId,
        grupo_id: grupoIdValido,
        responsavel_id: item.responsavel_id ?? item.responsavel ?? null,
        mes: item.mes,
        nome: item.nome,
        pago: item.pago ?? false,
        valor: Number(item.valor) || 0,
        forma_pagamento:
          item.forma_pagamento ?? item.formaPagamento ?? null,
      };

      const { error } = await supabase
        .from("contas_fixas")
        .insert(registro);

      if (error) {
        const erroSerializado = JSON.stringify(error, Object.getOwnPropertyNames(error));
        console.error("ERRO SERIALIZADO EXATO:", erroSerializado);
        throw new Error(erroSerializado);
      }

      await carregarDados();
    },
    [usuarioId, perfil, carregarDados],
  );

  const remover = useCallback(
    async (tabela: string, id: string) => {
      const tabelaReal =
        tabela === "contas" ? "contas_fixas" : tabela;

      const colunaId = "id";

      const { error } = await supabase
        .from(tabelaReal)
        .delete()
        .eq(colunaId, id);

      if (error) throw error;

      await carregarDados();
    },
    [carregarDados],
  );

  const alternarPago = useCallback(
    async (id: string, pago: boolean) => {
      const { error } = await supabase
        .from("contas_fixas")
        .update({ pago })
        .eq("id", id);

      if (error) throw error;

      await carregarDados();
    },
    [carregarDados],
  );

  const atualizarConfig = useCallback(
    async (config: Registro) => {
      if (!perfil?.id) {
        throw new Error("Perfil não encontrado.");
      }

      const camposPermitidos = [
        "salario",
        "investido",
        "reserva_atual",
        "reserva_meta",
      ];

      const atualizacao: Registro = {};

      for (const campo of camposPermitidos) {
        if (config[campo] !== undefined) {
          atualizacao[campo] = config[campo];
        }
      }

      const { error } = await supabase
        .from("perfis")
        .update(atualizacao)
        .eq("id", perfil.id);

      if (error) throw error;

      await carregarDados();
    },
    [perfil, carregarDados],
  );

  const copiarContasDoMesAnterior = useCallback(
    async (mesAnterior: string, novoMes: string) => {
      if (!usuarioId) {
        throw new Error("Faça login antes de continuar.");
      }

      const { data, error } = await supabase
        .from("contas_fixas")
        .select(
          "nome, valor, forma_pagamento, responsavel_id",
        )
        .eq("owner_id", usuarioId)
        .eq("mes", mesAnterior);

      if (error) throw error;

      if (!data?.length) return;

      const novasContas = data.map((item) => ({
        ...item,
        owner_id: usuarioId,
        grupo_id: perfil?.grupo_id ? perfil.grupo_id : null,
        mes: novoMes,
        pago: false,
      }));

      const { error: erroInsercao } = await supabase
        .from("contas_fixas")
        .insert(novasContas);

      if (erroInsercao) throw erroInsercao;

      await carregarDados();
    },
    [usuarioId, perfil, carregarDados],
  );

  return {
    ...dados,
    usuarioId,
    perfil,
    carregarDados,
    adicionarExtrato,
    adicionarCartao,
    adicionarConta,
    remover,
    alternarPago,
    atualizarConfig,
    copiarContasDoMesAnterior,
  };
}