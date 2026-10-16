"use client";

import { useEffect, useState, useCallback } from "react";
import { addMeses } from "@/lib/finance";
import type {
  Cartao,
  Config,
  ContaFixa,
  Estado,
  Extrato,
  Tabela,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";

const VAZIO: Estado = {
  extrato: [],
  cartao: [],
  contas: [],
  config: {
    salario: 0,
    investido: 0,
    reservaAtual: 0,
    reservaMeta: 0,
  },
};

const NOME_TABELA_DB: Record<Tabela, string> = {
  extrato: "extrato",
  cartao: "cartao",
  contas: "contas_fixas",
};

export interface Membro {
  id: string;
  nome: string;
  cor: string | null;
  convidado: boolean;
  avatar: string | null;
}

const COR_PADRAO_MEMBRO = "#64748B";

function enriquecer(row: any, membros: Membro[]): any {
  const membro = membros.find((item) => item.id === row.responsavel_id);

  const extras: Record<string, any> = {
    responsavel: membro?.nome ?? row.responsavel,
    responsavelCor: membro?.cor ?? COR_PADRAO_MEMBRO,
  };

  if (row.parcela_atual !== undefined) {
    extras.descricao = row.nome;
    extras.parcelaAtual = row.parcela_atual;
    extras.parcelaTotal = row.parcela_total;
  }

  return { ...row, ...extras };
}

export function useFinanceStore() {
  const [estado, setEstado] = useState<Estado>(VAZIO);
  const [pronto, setPronto] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);

  const carregarDados = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPronto(true);
      return;
    }

    setUserId(user.id);

    const { data: perfil } = await supabase
      .from("perfis")
      .select("id, grupo_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("salario, investido, reserva_atual, reserva_meta")
      .eq("user_id", user.id)
      .maybeSingle();

    const gId = perfil?.grupo_id || null;
    setGrupoId(gId);

    let listaMembros: Membro[] = [];

    if (gId) {
      const { data: perfisGrupo } = await supabase
        .from("perfis")
        .select("id, nome_usuario, eh_convidado, cor, avatar_url")
        .eq("grupo_id", gId);

      listaMembros = (perfisGrupo || []).map((perfilMembro: any) => ({
        id: perfilMembro.id,
        nome: perfilMembro.nome_usuario || "Membro",
        cor: perfilMembro.cor || null,
        convidado: Boolean(perfilMembro.eh_convidado),
        avatar: perfilMembro.avatar_url || null,
      }));
    }

    setMembros(listaMembros);

    const filtro = gId
      ? `owner_id.eq.${user.id},responsavel_id.eq.${user.id},grupo_id.eq.${gId}`
      : `owner_id.eq.${user.id},responsavel_id.eq.${user.id}`;

    const [resExtrato, resCartao, resContas] = await Promise.all([
      supabase.from("extrato").select("*").or(filtro),
      supabase.from("cartao").select("*").or(filtro),
      supabase.from("contas_fixas").select("*").or(filtro),
    ]);

    // Partilha seletiva: além da regra no banco, esconde o que foi partilhado com outra pessoa
    const visivel = (row: any) =>
      !row.compartilhado_com || row.owner_id === user.id || row.compartilhado_com === user.id;

    setEstado({
      extrato: (resExtrato.data || []).filter(visivel).map((row: any) =>
        enriquecer(row, listaMembros),
      ),
      cartao: (resCartao.data || []).filter(visivel).map((row: any) =>
        enriquecer(row, listaMembros),
      ),
      contas: (resContas.data || []).filter(visivel).map((row: any) =>
        enriquecer(row, listaMembros),
      ),
      config: {
        salario: cfg?.salario || 0,
        investido: cfg?.investido || 0,
        reservaAtual: cfg?.reserva_atual || 0,
        reservaMeta: cfg?.reserva_meta || 0,
      },
    });

    setPronto(true);
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const idDoResponsavel = (item: any): string | null => {
    if (item.responsavel_id) return item.responsavel_id;

    const membro = membros.find((pessoa) => pessoa.nome === item.responsavel);
    return membro?.id || userId;
  };

  const adicionarExtrato = async (
    item: Omit<Extrato, "id"> & { responsavel_id?: string },
  ) => {
    if (!userId) return;

    const payload = {
      owner_id: userId,
      usuario_id: userId,
      grupo_id: grupoId,
      responsavel_id: idDoResponsavel(item),
      mes: item.mes,
      pagamento:
        (item as any).pagamento ||
        (item as any).forma_pagamento ||
        "Outros",
      categoria: item.categoria,
      valor: item.valor,
      descricao: item.descricao,
      privado: (item as any).privado ?? false,
      compartilhado_com: (item as any).compartilhado_com || null,
    };

    const { data, error } = await supabase
      .from("extrato")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Erro ao adicionar no extrato:", error);
      alert("Erro ao salvar extrato: " + error.message);
      return;
    }

    if (data) {
      setEstado((atual) => ({
        ...atual,
        extrato: [...atual.extrato, enriquecer(data, membros)],
      }));
    }
  };

  const adicionarCartao = async (
    item: Omit<Cartao, "id"> & { responsavel_id?: string },
    gerarSeguintes: boolean,
  ) => {
    if (!userId) return;

    const restantes = gerarSeguintes
      ? Math.max(0, item.parcelaTotal - item.parcelaAtual)
      : 0;

    const responsavelId = idDoResponsavel(item);

    const novos = Array.from({ length: restantes + 1 }, (_, indice) => ({
      owner_id: userId,
      usuario_id: userId,
      grupo_id: grupoId,
      responsavel_id: responsavelId,
      mes: addMeses(item.mes, indice),
      nome: item.descricao,
      cartao: item.cartao,
      parcela_atual: item.parcelaAtual + indice,
      parcela_total: item.parcelaTotal,
      categoria: item.categoria,
      valor: item.valor,
      privado: (item as any).privado ?? false,
      compartilhado_com: (item as any).compartilhado_com || null,
    }));

    const { data, error } = await supabase
      .from("cartao")
      .insert(novos)
      .select();

    if (error) {
      console.error("Erro ao adicionar cartão:", error);
      alert("Erro ao salvar cartão: " + error.message);
      return;
    }

    if (data) {
      setEstado((atual) => ({
        ...atual,
        cartao: [
          ...atual.cartao,
          ...data.map((row: any) => enriquecer(row, membros)),
        ],
      }));
    }
  };

  const adicionarConta = async (
    item: Omit<ContaFixa, "id"> & { responsavel_id?: string },
  ) => {
    if (!userId) return;

    const payload = {
      owner_id: userId,
      grupo_id: grupoId,
      responsavel_id: idDoResponsavel(item),
      serie_id: crypto.randomUUID(),
      mes: item.mes,
      nome: item.nome,
      pago: item.pago ?? false,
      valor: item.valor,
      forma_pagamento: (item as any).forma_pagamento || null,
      categoria: item.categoria || null,
      compartilhado_com: (item as any).compartilhado_com || null,
      vencimento: (item as any).vencimento
        ? Number((item as any).vencimento)
        : null,
    };

    const { data, error } = await supabase
      .from("contas_fixas")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Erro ao adicionar conta fixa:", error);
      alert("Erro ao salvar conta fixa: " + error.message);
      return;
    }

    if (data) {
      setEstado((atual) => ({
        ...atual,
        contas: [...atual.contas, enriquecer(data, membros)],
      }));
    }
  };

  const gerarContasFixasDoMes = useCallback(
    async (mes: string) => {
      if (!userId) return;

      const mesAnterior = addMeses(mes, -1);
      const filtro = grupoId
        ? `owner_id.eq.${userId},responsavel_id.eq.${userId},grupo_id.eq.${grupoId}`
        : `owner_id.eq.${userId},responsavel_id.eq.${userId}`;

      const { data: contasAnteriores, error: erroAnterior } = await supabase
        .from("contas_fixas")
        .select("*")
        .or(filtro)
        .eq("mes", mesAnterior)
        .order("created_at", { ascending: true });

      if (erroAnterior) {
        console.error("Erro ao consultar contas do mês anterior:", erroAnterior);
        return;
      }

      const { data: contasDoMes, error: erroMes } = await supabase
        .from("contas_fixas")
        .select("*")
        .or(filtro)
        .eq("mes", mes);

      if (erroMes) {
        console.error("Erro ao consultar contas do mês:", erroMes);
        return;
      }

      const chaveConta = (conta: any) =>
        JSON.stringify([
          conta.owner_id || userId,
          conta.responsavel_id || userId,
          String(conta.nome || "").trim().toLocaleLowerCase("pt-BR"),
          Number(conta.valor),
          conta.forma_pagamento || null,
          conta.categoria || null,
          conta.vencimento ?? null,
        ]);

      // Quando existirem cópias antigas na origem, conserva a primeira para
      // que uma duplicação não seja propagada ao mês seguinte.
      const chavesAnteriores = new Set<string>();
      const contasUnicasAnteriores = (contasAnteriores || []).filter(
        (conta: any) => {
          if (!conta.serie_id) return false;
          const chave = chaveConta(conta);
          if (chavesAnteriores.has(chave)) return false;
          chavesAnteriores.add(chave);
          return true;
        },
      );

      const chavesExistentesNoMes = new Set(
        (contasDoMes || []).map((conta: any) => chaveConta(conta)),
      );

      const novas = contasUnicasAnteriores
        .filter((conta: any) => !chavesExistentesNoMes.has(chaveConta(conta)))
        .map((conta: any) => ({
        owner_id: conta.owner_id || userId,
        grupo_id: conta.grupo_id || grupoId,
        responsavel_id: conta.responsavel_id || userId,
        serie_id: conta.serie_id,
        mes,
        nome: conta.nome,
        pago: false,
        valor: conta.valor,
        forma_pagamento: conta.forma_pagamento || null,
        categoria: conta.categoria || null,
        vencimento: conta.vencimento
          ? Number(conta.vencimento)
          : null,
        }));

      if (novas.length === 0) return;

      const { data, error } = await supabase
        .from("contas_fixas")
        .upsert(novas, {
          onConflict: "serie_id,mes,responsavel_id",
          ignoreDuplicates: true,
        })
        .select();

      if (error) {
        console.error("Erro ao gerar contas fixas do mês:", error);
        alert("Erro ao gerar contas fixas: " + error.message);
        return;
      }

      if (data && data.length > 0) {
        setEstado((atual) => {
          const idsExistentes = new Set(
            atual.contas.map((conta: any) => conta.id),
          );

          const contasNovas = data
            .filter((conta: any) => !idsExistentes.has(conta.id))
            .map((conta: any) => enriquecer(conta, membros));

          return {
            ...atual,
            contas: [...atual.contas, ...contasNovas],
          };
        });
      }
    },
    [grupoId, membros, userId],
  );

  const atualizar = async (
    tabela: Tabela,
    id: string,
    patch: Record<string, any>,
  ): Promise<boolean> => {
    const { responsavel, ...resto } = patch;
    const patchBanco: Record<string, any> = { ...resto };

    if (responsavel) {
      patchBanco.responsavel_id = idDoResponsavel({ responsavel });
    }

    const { data, error } = await supabase
      .from(NOME_TABELA_DB[tabela])
      .update(patchBanco)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Erro ao alterar:", error);
      alert("Erro ao alterar: " + error.message);
      return false;
    }

    if (!data || data.length === 0) {
      alert("Não foi possível alterar: só quem criou o lançamento pode editá-lo.");
      return false;
    }

    const atualizado = enriquecer(data[0], membros);

    setEstado(
      (atual) =>
        ({
          ...atual,
          [tabela]: (atual[tabela] as { id: string }[]).map((item) =>
            item.id === id ? atualizado : item,
          ),
        }) as Estado,
    );

    return true;
  };

  const remover = async (tabela: Tabela, id: string) => {
    const { data, error } = await supabase
      .from(NOME_TABELA_DB[tabela])
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Erro ao remover:", error);
      alert("Erro ao remover: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("Não foi possível remover: só quem criou o lançamento pode apagá-lo.");
      return;
    }

    setEstado(
      (atual) =>
        ({
          ...atual,
          [tabela]: (atual[tabela] as { id: string }[]).filter(
            (item) => item.id !== id,
          ),
        }) as Estado,
    );
  };

  const alternarPago = async (id: string) => {
    const contaAtual = estado.contas.find((conta) => conta.id === id);
    if (!contaAtual) return;

    const novoStatus = !contaAtual.pago;

    const { data, error } = await supabase
      .from("contas_fixas")
      .update({ pago: novoStatus })
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Erro ao atualizar pagamento:", error);
      alert("Erro ao atualizar pagamento: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("Não foi possível atualizar o pagamento desta conta.");
      return;
    }

    setEstado((atual) => ({
      ...atual,
      contas: atual.contas.map((conta) =>
        conta.id === id ? { ...conta, pago: novoStatus } : conta,
      ),
    }));
  };

  const atualizarConfig = async (patch: Partial<Config>) => {
    if (!userId) return;

    const patchSupabase: Record<string, any> = {};

    if (patch.salario !== undefined) {
      patchSupabase.salario = patch.salario;
    }
    if (patch.investido !== undefined) {
      patchSupabase.investido = patch.investido;
    }
    if (patch.reservaAtual !== undefined) {
      patchSupabase.reserva_atual = patch.reservaAtual;
    }
    if (patch.reservaMeta !== undefined) {
      patchSupabase.reserva_meta = patch.reservaMeta;
    }

    const { data: existente, error: erroBusca } = await supabase
      .from("configuracoes")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (erroBusca) {
      console.error("Erro ao ler configurações:", erroBusca);
      alert("Erro ao salvar configurações: " + erroBusca.message);
      return;
    }

    const { error } = existente
      ? await supabase
        .from("configuracoes")
        .update(patchSupabase)
        .eq("user_id", userId)
      : await supabase.from("configuracoes").insert({
        user_id: userId,
        salario: 0,
        investido: 0,
        reserva_atual: 0,
        reserva_meta: 0,
        ...patchSupabase,
      });

    if (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar configurações: " + error.message);
      return;
    }

    setEstado((atual) => ({
      ...atual,
      config: { ...atual.config, ...patch },
    }));
  };

  return {
    estado,
    pronto,
    userId,
    membros,
    adicionarExtrato,
    adicionarCartao,
    adicionarConta,
    gerarContasFixasDoMes,
    atualizar,
    remover,
    alternarPago,
    atualizarConfig,
    carregarDados,
  };
}
