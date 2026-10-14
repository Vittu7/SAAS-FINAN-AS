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

function verificarErro(operacao: string, error: { message: string } | null) {
  if (error) {
    console.error(`Falha ao ${operacao}:`, error);
    throw new Error(`Não foi possível ${operacao}: ${error.message}`);
  }
}

export function useFinanceStore() {
  const [estado, setEstado] = useState<Estado>(VAZIO);
  const [pronto, setPronto] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setErro(null);
    try {
      const { data: { user }, error: erroAuth } = await supabase.auth.getUser();
      verificarErro("validar a sessão", erroAuth);
      if (!user) {
        setUserId(null);
        setGrupoId(null);
        setEstado(VAZIO);
        setPronto(true);
        return;
      }
      setUserId(user.id);

      const { data: perfil, error: erroPerfil } = await supabase
        .from("perfis")
        .select("id, grupo_id, salario, investido, reserva_atual, reserva_meta")
        .eq("id", user.id)
        .maybeSingle();
      verificarErro("carregar o perfil financeiro", erroPerfil);

      const gId = perfil?.grupo_id || null;
      setGrupoId(gId);
      const filtro = gId
        ? `usuario_id.eq.${user.id},responsavel_id.eq.${user.id},grupo_id.eq.${gId}`
        : `usuario_id.eq.${user.id},responsavel_id.eq.${user.id}`;

      const [resExtrato, resCartao, resContas] = await Promise.all([
        supabase.from("extrato").select("*").or(filtro),
        supabase.from("cartao").select("*").or(filtro),
        supabase.from("contas").select("*").or(filtro),
      ]);
      verificarErro("carregar os lançamentos", resExtrato.error);
      verificarErro("carregar os cartões", resCartao.error);
      verificarErro("carregar as contas fixas", resContas.error);

      setEstado({
        extrato: resExtrato.data || [],
        cartao: resCartao.data || [],
        contas: resContas.data || [],
        config: {
          salario: perfil?.salario ?? 0,
          investido: perfil?.investido ?? 0,
          reservaAtual: perfil?.reserva_atual ?? 0,
          reservaMeta: perfil?.reserva_meta ?? 0,
        },
      });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido ao carregar os dados.";
      setErro(mensagem);
      console.error(mensagem);
    } finally {
      setPronto(true);
    }
  }, []);

  useEffect(() => { void carregarDados(); }, [carregarDados]);

  const adicionarExtrato = async (i: Omit<Extrato, "id">) => {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const { data, error } = await supabase.from("extrato")
      .insert([{ ...i, usuario_id: userId, grupo_id: grupoId }]).select().single();
    verificarErro("salvar o lançamento", error);
    if (!data) throw new Error("O banco não retornou o lançamento salvo.");
    setEstado((e) => ({ ...e, extrato: [...e.extrato, data] }));
  };

  const adicionarCartao = async (i: Omit<Cartao, "id">, gerarSeguintes: boolean) => {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const restantes = gerarSeguintes ? Math.max(0, i.parcelaTotal - i.parcelaAtual) : 0;
    const novos = Array.from({ length: restantes + 1 }, (_, k) => ({
      ...i, usuario_id: userId, grupo_id: grupoId, mes: addMeses(i.mes, k), parcelaAtual: i.parcelaAtual + k,
    }));
    const { data, error } = await supabase.from("cartao").insert(novos).select();
    verificarErro("salvar as parcelas do cartão", error);
    if (!data || data.length !== novos.length) throw new Error("O banco não confirmou todas as parcelas.");
    setEstado((e) => ({ ...e, cartao: [...e.cartao, ...data] }));
  };

  const adicionarConta = async (i: Omit<ContaFixa, "id">) => {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const { data, error } = await supabase.from("contas")
      .insert([{ ...i, usuario_id: userId, grupo_id: grupoId }]).select().single();
    verificarErro("salvar a conta fixa", error);
    if (!data) throw new Error("O banco não retornou a conta salva.");
    setEstado((e) => ({ ...e, contas: [...e.contas, data] }));
  };

  const remover = async (tabela: Tabela, id: string) => {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const { data, error } = await supabase.from(tabela).delete().eq("id", id).select("id").maybeSingle();
    verificarErro("excluir o registro", error);
    if (!data) throw new Error("Nenhum registro foi excluído. Verifique as permissões de acesso.");
    setEstado((e) => ({ ...e, [tabela]: (e[tabela] as { id: string }[]).filter((x) => x.id !== id) }) as Estado);
  };

  const alternarPago = async (id: string) => {
    const contaAtual = estado.contas.find((c) => c.id === id);
    if (!contaAtual) throw new Error("A conta não foi encontrada.");
    const novoStatus = !contaAtual.pago;
    const { data, error } = await supabase.from("contas").update({ pago: novoStatus }).eq("id", id).select("id").maybeSingle();
    verificarErro("atualizar o status da conta", error);
    if (!data) throw new Error("O banco não confirmou a alteração do status.");
    setEstado((e) => ({ ...e, contas: e.contas.map((c) => c.id === id ? { ...c, pago: novoStatus } : c) }));
  };

  const copiarContasDoMesAnterior = async (mes: string) => {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const anterior = addMeses(mes, -1);
    const jaTem = new Set(estado.contas.filter((c) => c.mes === mes).map((c) => c.nome.toLowerCase()));
    const novas = estado.contas.filter((c) => c.mes === anterior && !jaTem.has(c.nome.toLowerCase())).map(({ id, ...resto }) => ({
      ...resto, usuario_id: userId, grupo_id: grupoId, mes, pago: false,
    }));
    if (!novas.length) return;
    const { data, error } = await supabase.from("contas").insert(novas).select();
    verificarErro("copiar as contas do mês anterior", error);
    if (!data || data.length !== novas.length) throw new Error("O banco não confirmou todas as contas copiadas.");
    setEstado((e) => ({ ...e, contas: [...e.contas, ...data] }));
  };

  const atualizarConfig = async (patch: Partial<Config>) => {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const patchSupabase: Record<string, number> = {};
    if (patch.salario !== undefined) patchSupabase.salario = patch.salario;
    if (patch.investido !== undefined) patchSupabase.investido = patch.investido;
    if (patch.reservaAtual !== undefined) patchSupabase.reserva_atual = patch.reservaAtual;
    if (patch.reservaMeta !== undefined) patchSupabase.reserva_meta = patch.reservaMeta;

    // UPDATE sem linha correspondente pode não gerar erro; upsert cria/atualiza o perfil do usuário.
    const { data, error } = await supabase.from("perfis")
      .upsert({ id: userId, user_id: userId, ...patchSupabase }, { onConflict: "id" })
      .select("id, salario, investido, reserva_atual, reserva_meta")
      .single();
    verificarErro("salvar salário e investimentos", error);
    if (!data) throw new Error("O banco não confirmou a gravação das configurações financeiras.");
    setEstado((e) => ({ ...e, config: {
      salario: data.salario ?? e.config.salario,
      investido: data.investido ?? e.config.investido,
      reservaAtual: data.reserva_atual ?? e.config.reservaAtual,
      reservaMeta: data.reserva_meta ?? e.config.reservaMeta,
    } }));
  };

  return { estado, pronto, erro, adicionarExtrato, adicionarCartao, adicionarConta, remover, alternarPago, copiarContasDoMesAnterior, atualizarConfig, carregarDados };
}
