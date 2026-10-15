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

// nome interno do app -> nome real da tabela no Supabase
const NOME_TABELA_DB: Record<Tabela, string> = {
  extrato: "extrato",
  cartao: "cartao",
  contas: "contas_fixas",
};

export interface Membro {
  id: string; // id do perfil (é o que vai em responsavel_id)
  nome: string;
  cor: string | null;
  convidado: boolean;
}

const COR_PADRAO_MEMBRO = "#64748B";

// Acrescenta aos lançamentos vindos do banco os campos que as telas usam:
// nome e cor do responsável e, no cartão, descricao / parcelaAtual / parcelaTotal.
function enriquecer(row: any, membros: Membro[]): any {
  const m = membros.find((x) => x.id === row.responsavel_id);
  const extras: Record<string, any> = {
    responsavel: m?.nome ?? row.responsavel,
    responsavelCor: m?.cor ?? COR_PADRAO_MEMBRO,
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

    // Membros do grupo (inclui convidados): serve para mostrar o nome e a cor do responsável
    let listaMembros: Membro[] = [];
    if (gId) {
      const { data: perfisGrupo } = await supabase.from("perfis").select("*").eq("grupo_id", gId);
      listaMembros = (perfisGrupo || []).map((p: any) => ({
        id: p.id,
        nome: p.nome_usuario || "Membro",
        cor: p.cor || null,
        convidado: !!p.eh_convidado,
      }));
    }
    setMembros(listaMembros);

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
      extrato: (resExtrato.data || []).map((r: any) => enriquecer(r, listaMembros)),
      cartao: (resCartao.data || []).map((r: any) => enriquecer(r, listaMembros)),
      contas: (resContas.data || []).map((r: any) => enriquecer(r, listaMembros)),
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

  // Descobre o id do perfil responsável: aceita o id direto ou o nome escolhido na tela
  const idDoResponsavel = (i: any): string | null => {
    if (i.responsavel_id) return i.responsavel_id;
    const achado = membros.find((m) => m.nome === i.responsavel);
    return achado?.id || userId;
  };

  const adicionarExtrato = async (i: Omit<Extrato, "id"> & { responsavel_id?: string }) => {
    if (!userId) return;

    const payload = {
      owner_id: userId,
      usuario_id: userId,
      grupo_id: grupoId,
      responsavel_id: idDoResponsavel(i),
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
      setEstado((e) => ({ ...e, extrato: [...e.extrato, enriquecer(data, membros)] }));
    }
  };

  const adicionarCartao = async (i: Omit<Cartao, "id"> & { responsavel_id?: string }, gerarSeguintes: boolean) => {
    if (!userId) return;

    const restantes = gerarSeguintes ? Math.max(0, i.parcelaTotal - i.parcelaAtual) : 0;
    const respId = idDoResponsavel(i);
    const novos = Array.from({ length: restantes + 1 }, (_, k) => ({
      owner_id: userId,
      usuario_id: userId,
      grupo_id: grupoId,
      responsavel_id: respId,
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
      setEstado((e) => ({ ...e, cartao: [...e.cartao, ...data.map((r: any) => enriquecer(r, membros))] }));
    }
  };

  const adicionarConta = async (i: Omit<ContaFixa, "id"> & { responsavel_id?: string }) => {
    if (!userId) return;

    const payload = {
      owner_id: userId,
      grupo_id: grupoId,
      responsavel_id: idDoResponsavel(i),
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
      setEstado((e) => ({ ...e, contas: [...e.contas, enriquecer(data, membros)] }));
    }
  };

  // Altera um lançamento já salvo. O patch usa os nomes das colunas do banco;
  // se vier "responsavel" (nome), ele é convertido para responsavel_id.
  const atualizar = async (tabela: Tabela, id: string, patch: Record<string, any>): Promise<boolean> => {
    const { responsavel, ...resto } = patch;
    const dbPatch: Record<string, any> = { ...resto };
    if (responsavel) {
      dbPatch.responsavel_id = idDoResponsavel({ responsavel });
    }

    const { data, error } = await supabase
      .from(NOME_TABELA_DB[tabela])
      .update(dbPatch)
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
      (e) =>
        ({
          ...e,
          [tabela]: (e[tabela] as { id: string }[]).map((x) => (x.id === id ? atualizado : x)),
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
      (e) => ({ ...e, [tabela]: (e[tabela] as { id: string }[]).filter((x) => x.id !== id) }) as Estado,
    );
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
      setEstado((e) => ({ ...e, contas: [...e.contas, ...data.map((r: any) => enriquecer(r, membros))] }));
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
    membros,
    adicionarExtrato,
    adicionarCartao,
    adicionarConta,
    atualizar,
    remover,
    alternarPago,
    copiarContasDoMesAnterior,
    atualizarConfig,
    carregarDados,
  };
}