"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl, mesAtual } from "@/lib/finance";
import {
  arred2,
  caixinhaDeLinha,
  hojeISO,
  movimentoDeLinha,
  sugestoesDoMes,
  sugestoesRendimento,
  type Caixinha,
  type DadosCaixinha,
  type Movimento,
  type NovoMovimento,
} from "@/lib/caixinhas";

/** Disparado após qualquer alteração, para os componentes na mesma tela recarregarem. */
export const EVENTO_CAIXINHAS = "homecash:caixinhas";

type ErroSupabase = { code?: string; message: string } | null;

function traduzirErro(e: ErroSupabase): string {
  if (!e) return "";
  if (e.code === "42P01" || e.code === "PGRST205") {
    return "As tabelas de caixinhas ainda não existem. Rode a migração 03_caixinhas.sql no Supabase.";
  }
  if (e.code === "PGRST204" || e.code === "42703") {
    return "Faltam colunas novas no banco. Rode a migração 04_caixinhas_rendimentos.sql no Supabase.";
  }
  if (e.code === "23514") return "Operação não permitida: o saldo da caixinha não pode ficar negativo.";
  return e.message;
}

const notificar = () => window.dispatchEvent(new Event(EVENTO_CAIXINHAS));

async function inserirMovimento(userId: string, m: NovoMovimento): Promise<string | null> {
  const { error } = await supabase.from("caixinha_movimentos").insert({
    user_id: userId,
    caixinha_id: m.caixinhaId,
    tipo: m.tipo,
    valor: arred2(m.valor),
    data: m.data,
    descricao: m.descricao ?? null,
    origem: m.origem ?? "manual",
  });
  return error ? traduzirErro(error) : null;
}

/** Todas as funções de escrita devolvem `null` em caso de sucesso ou a mensagem de erro. */
export function useCaixinhas() {
  const [userId, setUserId] = useState<string | null>(null);
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCarregando(false);
      return;
    }
    setUserId(user.id);

    const [c, m] = await Promise.all([
      supabase.from("caixinhas").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase
        .from("caixinha_movimentos")
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const falha = c.error || m.error;
    if (falha) {
      console.error("Erro ao carregar caixinhas:", falha);
      setErro(traduzirErro(falha));
    } else {
      setErro(null);
      setCaixinhas((c.data || []).map(caixinhaDeLinha));
      setMovimentos((m.data || []).map(movimentoDeLinha));
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // carga inicial assíncrona (fora do corpo síncrono do efeito)
    void Promise.resolve().then(carregar);
    const aoMudar = () => void carregar();
    window.addEventListener(EVENTO_CAIXINHAS, aoMudar);
    return () => window.removeEventListener(EVENTO_CAIXINHAS, aoMudar);
  }, [carregar]);

  const sugestoes = useMemo(() => sugestoesDoMes(caixinhas), [caixinhas]);
  const lembretesRendimento = useMemo(() => sugestoesRendimento(caixinhas), [caixinhas]);

  const registrarMovimento = async (m: NovoMovimento): Promise<string | null> => {
    if (!userId) return "Entre na sua conta para registrar movimentações.";
    if (!(m.valor > 0)) return "Informe um valor maior que zero.";
    const alvo = caixinhas.find((c) => c.id === m.caixinhaId);
    if (!alvo) return "Escolha a caixinha de destino.";
    if (m.tipo === "resgate" && m.valor > alvo.saldo) {
      return `Saldo insuficiente: "${alvo.nome}" tem ${brl(alvo.saldo)}.`;
    }
    const msg = await inserirMovimento(userId, m);
    if (!msg && m.tipo === "rendimento") {
      // registrou o rendimento: o lembrete do mês some
      await supabase.from("caixinhas").update({ ultimo_mes_rendimento: mesAtual() }).eq("id", m.caixinhaId);
    }
    if (!msg) notificar();
    return msg;
  };

  const excluirMovimento = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from("caixinha_movimentos").delete().eq("id", id);
    if (error) return traduzirErro(error);
    notificar();
    return null;
  };

  const criar = async (d: DadosCaixinha): Promise<string | null> => {
    if (!userId) return "Entre na sua conta para criar uma caixinha.";
    const { data, error } = await supabase
      .from("caixinhas")
      .insert({
        user_id: userId,
        nome: d.nome.trim(),
        eh_reserva_emergencia: d.ehReserva,
        rendimento: d.rendimento.trim() || null,
        meta: d.meta,
        aporte_auto_ativo: d.aporteAutoAtivo && d.aporteAutoValor > 0,
        aporte_auto_valor: d.aporteAutoValor,
        exibir_na_home: d.exibirNaHome,
        cor: d.cor,
        banco: d.banco.trim() || null,
        tipo_rendimento: d.tipoRendimento,
        // lembretes (aporte automático e rendimento) começam no mês seguinte ao cadastro
        ultimo_mes_auto: mesAtual(),
        ultimo_mes_rendimento: mesAtual(),
      })
      .select("id")
      .single();
    if (error) return traduzirErro(error);

    // O saldo inicial entra como um aporte, para o histórico bater com o saldo.
    if (d.saldo > 0) {
      const msg = await inserirMovimento(userId, {
        caixinhaId: data.id as string,
        tipo: "aporte",
        valor: d.saldo,
        data: hojeISO(),
        descricao: "Saldo inicial",
      });
      if (msg) {
        notificar();
        return `Caixinha criada, mas o saldo inicial não foi registrado: ${msg}`;
      }
    }
    notificar();
    return null;
  };

  const editar = async (id: string, d: DadosCaixinha): Promise<string | null> => {
    if (!userId) return "Entre na sua conta para editar.";
    const atual = caixinhas.find((c) => c.id === id);
    if (!atual) return "Caixinha não encontrada.";

    const ativarAuto = d.aporteAutoAtivo && d.aporteAutoValor > 0;
    const { error } = await supabase
      .from("caixinhas")
      .update({
        nome: d.nome.trim(),
        eh_reserva_emergencia: d.ehReserva,
        rendimento: d.rendimento.trim() || null,
        meta: d.meta,
        aporte_auto_ativo: ativarAuto,
        aporte_auto_valor: d.aporteAutoValor,
        exibir_na_home: d.exibirNaHome,
        cor: d.cor,
        banco: d.banco.trim() || null,
        tipo_rendimento: d.tipoRendimento,
        // ao ligar o aporte automático agora, a primeira sugestão vem no mês seguinte
        ...(ativarAuto && !atual.aporteAutoAtivo ? { ultimo_mes_auto: mesAtual() } : {}),
      })
      .eq("id", id);
    if (error) return traduzirErro(error);

    const diferenca = arred2(d.saldo - atual.saldo);
    if (diferenca !== 0) {
      const msg = await inserirMovimento(userId, {
        caixinhaId: id,
        tipo: diferenca > 0 ? "aporte" : "resgate",
        valor: Math.abs(diferenca),
        data: hojeISO(),
        descricao: "Ajuste de saldo",
      });
      if (msg) {
        notificar();
        return `Dados salvos, mas o ajuste de saldo falhou: ${msg}`;
      }
    }
    notificar();
    return null;
  };

  const excluir = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from("caixinhas").delete().eq("id", id);
    if (error) return traduzirErro(error);
    notificar();
    return null;
  };

  /** Registra o aporte automático do mês e marca o mês como tratado. */
  const confirmarSugestao = async (c: Caixinha): Promise<string | null> => {
    if (!userId) return "Entre na sua conta.";
    const msg = await inserirMovimento(userId, {
      caixinhaId: c.id,
      tipo: "aporte",
      valor: c.aporteAutoValor,
      data: hojeISO(),
      descricao: "Aporte automático mensal",
      origem: "automatico",
    });
    if (msg) return msg;
    const { error } = await supabase.from("caixinhas").update({ ultimo_mes_auto: mesAtual() }).eq("id", c.id);
    notificar();
    return error ? traduzirErro(error) : null;
  };

  /** "Agora não": some até o mês seguinte, sem registrar nada. */
  const dispensarSugestao = async (c: Caixinha): Promise<string | null> => {
    const { error } = await supabase.from("caixinhas").update({ ultimo_mes_auto: mesAtual() }).eq("id", c.id);
    if (error) return traduzirErro(error);
    notificar();
    return null;
  };

  /** Registra o rendimento do mês informado pelo usuário. */
  const registrarRendimento = (c: Caixinha, valor: number) =>
    registrarMovimento({ caixinhaId: c.id, tipo: "rendimento", valor, data: hojeISO(), descricao: "Rendimento do mês" });

  /** "Não rendeu / agora não": some até o mês seguinte. */
  const dispensarRendimento = async (c: Caixinha): Promise<string | null> => {
    const { error } = await supabase.from("caixinhas").update({ ultimo_mes_rendimento: mesAtual() }).eq("id", c.id);
    if (error) return traduzirErro(error);
    notificar();
    return null;
  };

  return {
    userId,
    caixinhas,
    movimentos,
    sugestoes,
    lembretesRendimento,
    carregando,
    erro,
    criar,
    editar,
    excluir,
    registrarMovimento,
    excluirMovimento,
    confirmarSugestao,
    dispensarSugestao,
    registrarRendimento,
    dispensarRendimento,
  };
}
