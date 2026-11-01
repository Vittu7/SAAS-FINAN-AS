"use client";

import { useEffect, useState, useCallback } from "react";
import { addMeses, brl } from "@/lib/finance";
import type {
  Cartao,
  Config,
  ContaFixa,
  Estado,
  Extrato,
  Tabela,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { garantirPerfil } from "@/lib/perfil";
import { avisos, falhou } from "@/lib/avisos";

/** `silencioso`: quem chama (ex.: compra dividida entre várias pessoas) mostra um único aviso no final. */
type OpcoesAviso = { silencioso?: boolean };

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
  /** Se o resumo financeiro desta pessoa aparece para o grupo (padrão: sim) */
  resumoVisivel: boolean;
  cargo?: string | null;
}

const COR_PADRAO_MEMBRO = "#64748B";

function enriquecer(row: any, membros: Membro[], meuId?: string | null): any {
  const membro = membros.find((item) => item.id === row.responsavel_id);
  const autor = membros.find((item) => item.id === row.owner_id);
  const temAutor = Boolean(row.owner_id);
  const temResp = Boolean(row.responsavel_id);

  const extras: Record<string, any> = {
    responsavel: membro?.nome ?? row.responsavel,
    responsavelCor: membro?.cor ?? COR_PADRAO_MEMBRO,
    responsavelAvatar: membro?.avatar ?? null,
    // Quem lançou (autor) x quem é o responsável pelo gasto
    autorId: row.owner_id ?? null,
    autorNome: autor?.nome ?? null,
    autorCor: autor?.cor ?? COR_PADRAO_MEMBRO,
    autorAvatar: autor?.avatar ?? null,
    lancadoPorOutro: temAutor && Boolean(meuId) && row.owner_id !== meuId,
    lancadoParaOutro: temAutor && temResp && row.owner_id === meuId && row.responsavel_id !== meuId,
    // Valor a repassar: o autor pagou e outra pessoa é a responsável
    repasseDevido: temAutor && temResp && row.owner_id !== row.responsavel_id && row.tipo !== "entrada",
    repassePago: Boolean(row.repasse_pago),
    repasseInformado: Boolean(row.repasse_informado),
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

    // Todo usuário precisa ter uma linha em "perfis" (nome, foto, grupo)
    await garantirPerfil(supabase as any, user).catch(() => null);

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
        .select("*")
        .eq("grupo_id", gId);

      listaMembros = (perfisGrupo || []).map((perfilMembro: any) => ({
        id: perfilMembro.id,
        nome: perfilMembro.nome_usuario || "Membro",
        cor: perfilMembro.cor || null,
        convidado: Boolean(perfilMembro.eh_convidado),
        avatar: perfilMembro.avatar_url || null,
        resumoVisivel: perfilMembro.resumo_visivel !== false,
        cargo: perfilMembro.cargo || null,
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
        enriquecer(row, listaMembros, user.id),
      ),
      cartao: (resCartao.data || []).filter(visivel).map((row: any) =>
        enriquecer(row, listaMembros, user.id),
      ),
      contas: (resContas.data || []).filter(visivel).map((row: any) =>
        enriquecer(row, listaMembros, user.id),
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

  // Quando nome/foto mudam (Configurações ou boas-vindas), recarrega os membros para a foto aparecer em todo o sistema
  useEffect(() => {
    const aoMudarPerfil = () => void carregarDados();
    window.addEventListener("homecash:perfil", aoMudarPerfil);
    return () => window.removeEventListener("homecash:perfil", aoMudarPerfil);
  }, [carregarDados]);

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
    opcoes: OpcoesAviso = {},
  ): Promise<boolean> => {
    if (!userId) { avisos.erro("Não foi possível salvar", "Sua sessão não foi encontrada. Entre novamente."); return false; }

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
      // só envia "tipo" para entradas: saídas continuam funcionando mesmo antes da migração 02 do Supabase
      ...(item.tipo === "entrada" ? { tipo: "entrada" } : {}),
      privado: (item as any).privado ?? false,
      compartilhado_com: (item as any).compartilhado_com || null,
    };

    const { data, error } = await supabase
      .from("extrato")
      .insert([payload])
      .select()
      .single();

    if (error) {
      falhou(item.tipo === "entrada" ? "cadastrar a entrada" : "cadastrar a saída", error);
      return false;
    }

    if (data) {
      setEstado((atual) => ({
        ...atual,
        extrato: [...atual.extrato, enriquecer(data, membros, userId)],
      }));
    }
    if (!opcoes.silencioso) avisos.sucesso(item.tipo === "entrada" ? "Entrada cadastrada" : "Saída cadastrada", `${item.descricao} · ${brl(Number(item.valor) || 0)}`);
    return true;
  };

  const adicionarCartao = async (
    item: Omit<Cartao, "id"> & { responsavel_id?: string },
    gerarSeguintes: boolean,
    opcoes: OpcoesAviso = {},
  ): Promise<boolean> => {
    if (!userId) { avisos.erro("Não foi possível salvar", "Sua sessão não foi encontrada. Entre novamente."); return false; }

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
      falhou("cadastrar a compra no cartão", error);
      return false;
    }

    if (data) {
      setEstado((atual) => ({
        ...atual,
        cartao: [
          ...atual.cartao,
          ...data.map((row: any) => enriquecer(row, membros, userId)),
        ],
      }));
    }
    if (!opcoes.silencioso) avisos.sucesso(
      novos.length > 1 ? "Compra parcelada cadastrada" : "Compra no cartão cadastrada",
      novos.length > 1 ? `${item.descricao} · ${novos.length} parcelas lançadas` : `${item.descricao} · ${brl(Number(item.valor) || 0)}`,
    );
    return true;
  };

  const adicionarConta = async (
    item: Omit<ContaFixa, "id"> & { responsavel_id?: string },
    opcoes: OpcoesAviso = {},
  ): Promise<boolean> => {
    if (!userId) { avisos.erro("Não foi possível salvar", "Sua sessão não foi encontrada. Entre novamente."); return false; }

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
      falhou("cadastrar a conta fixa", error);
      return false;
    }

    if (data) {
      setEstado((atual) => ({
        ...atual,
        contas: [...atual.contas, enriquecer(data, membros, userId)],
      }));
    }
    if (!opcoes.silencioso) avisos.sucesso("Conta fixa cadastrada", `${item.nome} · ${brl(Number(item.valor) || 0)}`);
    return true;
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
        falhou("gerar as contas fixas do mês", error);
        return;
      }

      if (data && data.length > 0) {
        avisos.info(data.length === 1 ? "1 conta fixa trazida do mês anterior" : `${data.length} contas fixas trazidas do mês anterior`, "Confira os valores e marque como paga quando pagar.");
        setEstado((atual) => {
          const idsExistentes = new Set(
            atual.contas.map((conta: any) => conta.id),
          );

          const contasNovas = data
            .filter((conta: any) => !idsExistentes.has(conta.id))
            .map((conta: any) => enriquecer(conta, membros, userId));

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
    if (String(id).startsWith("repasse:")) return false; // entrada automática de repasse: não existe no banco
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
      falhou("salvar as alterações", error);
      return false;
    }

    if (!data || data.length === 0) {
      avisos.erro("Não foi possível salvar as alterações", "Só quem criou o lançamento pode editá-lo.");
      return false;
    }

    const atualizado = enriquecer(data[0], membros, userId);

    setEstado(
      (atual) =>
        ({
          ...atual,
          [tabela]: (atual[tabela] as { id: string }[]).map((item) =>
            item.id === id ? atualizado : item,
          ),
        }) as Estado,
    );

    avisos.sucesso("Alterações salvas", "O lançamento foi atualizado.");
    return true;
  };

  const remover = async (tabela: Tabela, id: string): Promise<boolean> => {
    if (String(id).startsWith("repasse:")) return false; // entrada automática de repasse: some quando o repasse é reaberto
    const { data, error } = await supabase
      .from(NOME_TABELA_DB[tabela])
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      falhou("remover o lançamento", error);
      return false;
    }

    if (!data || data.length === 0) {
      avisos.erro("Não foi possível remover o lançamento", "Só quem criou o lançamento pode apagá-lo.");
      return false;
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
    avisos.sucesso("Lançamento removido");
    return true;
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
      falhou("atualizar o pagamento da conta", error);
      return;
    }

    if (!data || data.length === 0) {
      avisos.erro("Não foi possível atualizar o pagamento", "Só quem criou a conta pode alterar o status.");
      return;
    }

    setEstado((atual) => ({
      ...atual,
      contas: atual.contas.map((conta) =>
        conta.id === id ? { ...conta, pago: novoStatus } : conta,
      ),
    }));
    avisos.sucesso(novoStatus ? "Conta marcada como paga" : "Conta voltou para pendente", contaAtual.nome);
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
      falhou("salvar as configurações", erroBusca);
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
      falhou("salvar as configurações", error);
      return;
    }

    setEstado((atual) => ({
      ...atual,
      config: { ...atual.config, ...patch },
    }));
    avisos.sucesso("Configurações salvas");
  };

  /**
   * Repasse em duas etapas (nunca cria entrada nem saída: é só o acerto entre membros):
   *  - informar / desinformar: quem DEVE marca "Repassado" (fica aguardando confirmação);
   *  - concluir / reabrir: quem LANÇOU confirma o recebimento ("Concluído").
   * As permissões são conferidas no banco pela função atualizar_repasse.
   */
  const atualizarRepasses = async (
    itens: { origem: Tabela; id: string }[],
    acao: "informar" | "desinformar" | "concluir" | "reabrir",
    /** "concluir": conta de débito que recebeu o valor. "informar": conta de débito de onde saiu o repasse. null = sem conta */
    conta: string | null = null,
  ): Promise<boolean> => {
    if (!userId || itens.length === 0) return false;
    const agora = new Date().toISOString();

    for (const origem of ["extrato", "cartao", "contas"] as Tabela[]) {
      const ids = itens.filter((i) => i.origem === origem).map((i) => i.id);
      if (ids.length === 0) continue;

      const { data, error } = await supabase.rpc("atualizar_repasse", { p_tabela: NOME_TABELA_DB[origem], p_ids: ids, p_acao: acao });

      if (error) {
        const faltaScript = /atualizar_repasse|repasse_/.test(error.message) || error.code === "PGRST202" || error.code === "42883";
        if (faltaScript) avisos.erro("Repasses ainda não habilitados", "Execute os scripts supabase-04 e supabase-05 no Supabase.");
        else falhou("atualizar o repasse", error);
        return false;
      }
      if (Number(data) !== ids.length) {
        avisos.erro(
          acao === "informar" || acao === "desinformar" ? "Não foi possível marcar como repassado" : "Não foi possível confirmar o recebimento",
          acao === "informar" || acao === "desinformar"
            ? "Só quem é o responsável pelo valor pode marcar como repassado (e só antes de concluído)."
            : "Só quem fez o lançamento pode confirmar o recebimento do repasse.",
        );
        return false;
      }

      // Contas do repasse (script supabase-06): destino (quem recebe, em "concluir") e origem (quem repassa, em "informar").
      // A origem é gravada por função no banco porque o responsável não é dono da linha.
      const avisoScript = "O repasse foi atualizado, mas para registrar as contas execute o script supabase-06-repasse-conta.sql no Supabase.";
      if (acao === "concluir" && conta) {
        const { error: e1 } = await supabase.from(NOME_TABELA_DB[origem]).update({ repasse_conta: conta }).in("id", ids);
        if (e1) avisos.aviso(/repasse_conta/.test(e1.message) ? avisoScript : "O repasse foi concluído, mas a conta de destino não foi registrada", /repasse_conta/.test(e1.message) ? undefined : e1.message);
      }
      if (acao === "reabrir") {
        const { error: e2 } = await supabase.from(NOME_TABELA_DB[origem]).update({ repasse_conta: null, repasse_conta_origem: null }).in("id", ids);
        if (e2) avisos.aviso(/repasse_conta/.test(e2.message) ? avisoScript : "O repasse foi reaberto, mas as contas não foram limpas", /repasse_conta/.test(e2.message) ? undefined : e2.message);
      }
      if (acao === "informar" || acao === "desinformar") {
        const { error: e3 } = await supabase.rpc("registrar_repasse_conta", { p_tabela: NOME_TABELA_DB[origem], p_ids: ids.map(String), p_conta: acao === "informar" ? conta : null });
        if (e3 && (conta || acao === "desinformar")) avisos.aviso(/registrar_repasse_conta|repasse_conta/.test(e3.message) || e3.code === "PGRST202" ? avisoScript : "O repasse foi atualizado, mas a conta de origem não foi registrada", /registrar_repasse_conta|repasse_conta/.test(e3.message) || e3.code === "PGRST202" ? undefined : e3.message);
      }

      const alvo = new Set(ids);
      const patch: Record<string, any> =
        acao === "informar" ? { repasse_informado: true, repasse_informado_em: agora, repasseInformado: true, repasse_conta_origem: conta }
        : acao === "desinformar" ? { repasse_informado: false, repasse_informado_em: null, repasseInformado: false, repasse_conta_origem: null }
        : acao === "concluir" ? { repasse_pago: true, repasse_pago_em: agora, repassePago: true, repasse_conta: conta }
        : { repasse_conta: null, repasse_conta_origem: null, repasse_pago: false, repasse_pago_em: null, repassePago: false, repasse_informado: false, repasse_informado_em: null, repasseInformado: false };
      setEstado((atual) => ({
        ...atual,
        [origem]: (atual[origem] as any[]).map((item) => (alvo.has(item.id) ? { ...item, ...patch } : item)),
      }) as Estado);
    }

    const n = itens.length;
    const varios = n > 1;
    if (acao === "informar") avisos.sucesso(varios ? `${n} repasses informados` : "Repasse informado", "Agora aguarda quem lançou confirmar o recebimento.");
    else if (acao === "desinformar") avisos.sucesso(varios ? `${n} repasses desmarcados` : "Repasse desmarcado", "Voltou para pendente.");
    else if (acao === "concluir") avisos.sucesso(varios ? `${n} recebimentos confirmados` : "Recebimento confirmado", conta ? `O valor entrou como entrada em ${conta}.` : "O valor foi abatido do que a pessoa devia.");
    else avisos.sucesso(varios ? `${n} repasses reabertos` : "Repasse reaberto", "Voltou para pendente.");
    return true;
  };

  return {
    atualizarRepasses,
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
