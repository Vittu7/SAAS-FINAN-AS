"use client";

import { useEffect, useState, useCallback } from "react";
import { addMeses } from "@/lib/finance";
import type { Cartao, Config, ContaFixa, Estado, Extrato, Tabela } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const VAZIO: Estado = {
  extrato: [],
  cartao: [],
  contas: [],
  config: { salario: 0, investido: 0, reservaAtual: 0, reservaMeta: 0 },
};

export function useFinanceStore() {
  const [estado, setEstado] = useState<Estado>(VAZIO);
  const [pronto, setPronto] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [grupoId, setGrupoId] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPronto(true);
      return;
    }
    setUserId(user.id);

    // Busca o perfil do usuário ativo e o ID do seu grupo
    const { data: perfil } = await supabase
      .from("perfis")
      .select("id, grupo_id, salario, investido, reserva_atual, reserva_meta")
      .eq("id", user.id)
      .maybeSingle();

    const gId = perfil?.grupo_id || null;
    setGrupoId(gId);

    // Regra de visibilidade: traz lançamentos criados pelo usuário, onde ele é responsável ou do seu grupo
    const filtro = gId
      ? `owner_id.eq.${user.id},responsavel_id.eq.${user.id},grupo_id.eq.${gId}`
      : `owner_id.eq.${user.id},responsavel_id.eq.${user.id}`;

    const [resExtrato, resCartao, resContas] = await Promise.all([
      supabase.from("extrato").select("*").or(filtro),
      supabase.from("cartao").select("*").or(filtro),
      supabase.from("contas_fixas").select("*").or(filtro),
    ]);

    setEstado({
      extrato: resExtrato.data || [],
      cartao: resCartao.data || [],
      contas: resContas.data || [],
      config: {
        salario: perfil?.salario || 0,
        investido: perfil?.investido || 0,
        reservaAtual: perfil?.reserva_atual || 0,
        reservaMeta: perfil?.reserva_meta || 0,
      },
    });

    setPronto(true);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const adicionarExtrato = async (i: Omit<Extrato, "id"> & { responsavel_id?: string }) => {
    if (!userId) return;

    const payload = {
      owner_id: userId,
      usuario_id: userId,
      grupo_id: grupoId,
      responsavel_id: i.responsavel_id || userId,
      mes: i.mes,
      pagamento: (i as any).pagamento || (i as any).forma_pagamento || "Outros",
      categoria: i.categoria,
      valor: i.valor,
      descricao: i.descricao,
      privado: (i as any).privado ?? false,
    };

    const { data, error } = await supabase.from("extrato").insert([payload]).select().single();
    if (error) {
      console.error("Erro ao adicionar no extrato:", error);
      alert("Erro ao salvar extrato: " + error.message);
    } else if (data) {
      setEstado((e) => ({ ...e, extrato: [...e.extrato, data] }));
    }
  };

  const adicionarCartao = async (i: Omit<Cartao, "id"> & { responsavel_id?: string }, gerarSeguintes: boolean) => {
    if (!userId) return;

    const restantes = gerarSeguintes ? Math.max(0, i.parcelaTotal - i.parcelaAtual) : 0;
    const novos = Array.from({ length: restantes + 1 }, (_, k) => ({
      owner_id: userId,
      usuario_id: userId,
      grupo_id: grupoId,
      responsavel_id: i.responsavel_id || userId,
      mes: addMeses(i.mes, k),
      nome: i.descricao,
      cartao: i.cartao,
      parcela_atual: i.parcelaAtual + k,
      parcela_total: i.parcelaTotal,
      categoria: i.categoria,
      valor: i.valor,
      privado: (i as any).privado ?? false,
    }));

    const { data, error } = await supabase.from("cartao").insert(novos).select();
    if (error) {
      console.error("Erro ao adicionar cartão:", error);
      alert("Erro ao salvar cartão: " + error.message);
    } else if (data) {
      setEstado((e) => ({ ...e, cartao: [...e.cartao, ...data] }));
    }
  };

  const adicionarConta = async (i: Omit<ContaFixa, "id"> & { responsavel_id?: string }) => {
    if (!userId) return;

    const payload = {
      owner_id: userId,
      grupo_id: grupoId,
      responsavel_id: i.responsavel_id || userId,
      mes: i.mes,
      nome: i.nome,
      pago: i.pago ?? false,
      valor: i.valor,
      forma_pagamento: (i as any).forma_pagamento || null,
      categoria: i.categoria || null,
      vencimento: (i as any).vencimento ? Number((i as any).vencimento) : null,
    };

    const { data, error } = await supabase.from("contas_fixas").insert([payload]).select().single();
    if (error) {
      console.error("Erro ao adicionar conta fixa:", error);
      alert("Erro ao salvar conta fixa: " + error.message);
    } else if (data) {
      setEstado((e) => ({ ...e, contas: [...e.contas, data] }));
    }
  };

  const remover = async (tabela: Tabela, id: string) => {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (!error) {
      setEstado(
        (e) => ({ ...e, [tabela]: (e[tabela] as { id: string }[]).filter((x) => x.id !== id) }) as Estado,
      );
    }
  };

  const alternarPago = async (id: string) => {
    const contaAtual = estado.contas.find((c) => c.id === id);
    if (!contaAtual) return;

    const novoStatus = !contaAtual.pago;
    const { error } = await supabase.from("contas_fixas").update({ pago: novoStatus }).eq("id", id);

    if (!error) {
      setEstado((e) => ({
        ...e,
        contas: e.contas.map((c) => (c.id === id ? { ...c, pago: novoStatus } : c)),
      }));
    }
  };

  const copiarContasDoMesAnterior = async (mes: string) => {
    if (!userId) return;
    const anterior = addMeses(mes, -1);
    const jaTem = new Set(estado.contas.filter((c) => c.mes === mes).map((c) => c.nome.toLowerCase()));

    const novas = estado.contas
      .filter((c) => c.mes === anterior && !jaTem.has(c.nome.toLowerCase()))
      .map(({ id, created_at, ...resto }: any) => ({
        owner_id: userId,
        grupo_id: grupoId,
        responsavel_id: resto.responsavel_id || userId,
        mes,
        nome: resto.nome,
        pago: false,
        valor: resto.valor,
        forma_pagamento: resto.forma_pagamento || null,
        categoria: resto.categoria || null,
        vencimento: resto.vencimento ? Number(resto.vencimento) : null,
      }));

    if (novas.length === 0) return;

    const { data, error } = await supabase.from("contas_fixas").insert(novas).select();
    if (error) {
      console.error("Erro ao copiar contas do mês anterior:", error);
      alert("Erro ao copiar contas: " + error.message);
    } else if (data) {
      setEstado((e) => ({ ...e, contas: [...e.contas, ...data] }));
    }
  };

  const atualizarConfig = async (patch: Partial<Config>) => {
    if (!userId) return;

    const patchSupabase: Record<string, any> = {};
    if (patch.salario !== undefined) patchSupabase.salario = patch.salario;
    if (patch.investido !== undefined) patchSupabase.investido = patch.investido;
    if (patch.reservaAtual !== undefined) patchSupabase.reserva_atual = patch.reservaAtual;
    if (patch.reservaMeta !== undefined) patchSupabase.reserva_meta = patch.reservaMeta;

    const { error } = await supabase.from("perfis").update(patchSupabase).eq("id", userId);

    if (!error) {
      setEstado((e) => ({ ...e, config: { ...e.config, ...patch } }));
    }
  };

  return {
    estado,
    pronto,
    adicionarExtrato,
    adicionarCartao,
    adicionarConta,
    remover,
    alternarPago,
    copiarContasDoMesAnterior,
    atualizarConfig,
    carregarDados,
  };
}