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
      ? `usuario_id.eq.${user.id},responsavel_id.eq.${user.id},grupo_id.eq.${gId}`
      : `usuario_id.eq.${user.id},responsavel_id.eq.${user.id}`;

    const [resExtrato, resCartao, resContas] = await Promise.all([
      supabase.from("extrato").select("*").or(filtro),
      supabase.from("cartao").select("*").or(filtro),
      supabase.from("contas").select("*").or(filtro),
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

  const adicionarExtrato = async (i: Omit<Extrato, "id">) => {
    if (!userId) return;
    const itemNovo = {
      ...i,
      usuario_id: userId,
      grupo_id: grupoId,
    };

    const { data, error } = await supabase.from("extrato").insert([itemNovo]).select().single();
    if (!error && data) {
      setEstado((e) => ({ ...e, extrato: [...e.extrato, data] }));
    }
  };

  const adicionarCartao = async (i: Omit<Cartao, "id">, gerarSeguintes: boolean) => {
    if (!userId) return;
    const restantes = gerarSeguintes ? Math.max(0, i.parcelaTotal - i.parcelaAtual) : 0;
    const novos = Array.from({ length: restantes + 1 }, (_, k) => ({
      ...i,
      usuario_id: userId,
      grupo_id: grupoId,
      mes: addMeses(i.mes, k),
      parcelaAtual: i.parcelaAtual + k,
    }));

    const { data, error } = await supabase.from("cartao").insert(novos).select();
    if (!error && data) {
      setEstado((e) => ({ ...e, cartao: [...e.cartao, ...data] }));
    }
  };

  const adicionarConta = async (i: Omit<ContaFixa, "id">) => {
    if (!userId) return;
    const itemNovo = {
      ...i,
      usuario_id: userId,
      grupo_id: grupoId,
    };

    const { data, error } = await supabase.from("contas").insert([itemNovo]).select().single();
    if (!error && data) {
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
    const { error } = await supabase.from("contas").update({ pago: novoStatus }).eq("id", id);

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
      .map(({ id, ...resto }) => ({
        ...resto,
        usuario_id: userId,
        grupo_id: grupoId,
        mes,
        pago: false,
      }));

    if (novas.length === 0) return;

    const { data, error } = await supabase.from("contas").insert(novas).select();
    if (!error && data) {
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