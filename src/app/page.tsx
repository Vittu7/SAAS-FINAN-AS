"use client";

import { ChevronDown, ChevronUp, Pencil, Search } from "lucide-react";
import { Ico } from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CentralAjustes, { type SecaoAjustes } from "@/components/CentralAjustes";
import FaturaCartao from "@/components/FaturaCartao";
import PilhaCartoes from "@/components/PilhaCartoes";
import ExtratoDetalhe, { type TipoDetalhe } from "@/components/ExtratoDetalhe";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import CartaoTable from "@/components/CartaoTable";
import ContasFixasTable from "@/components/ContasFixasTable";
import ExtratoTable from "@/components/ExtratoTable";
import ExtratoGeral from "@/components/ExtratoGeral";
import ResponsavelPanel from "@/components/ResponsavelPanel";
import PainelResumo from "@/components/resumo/PainelResumo";
import FinanceiroGrupoCard, { SeletorVisaoFinanceira, type VisaoFinanceira } from "@/components/resumo/FinanceiroGrupoCard";
import { financeiroDoGrupo } from "@/lib/financeiroGrupo";
import Pendencias from "@/components/resumo/Pendencias";
import { AvisoMesNaoAberto, ConferenciaFechamento, FaixaFechamento, HistoricoFechamento, ListaMeses, ReabrirMes, SeletorMes, type AvisoConferencia } from "@/components/fechamento/Fechamento";
import { useFechamentos } from "@/hooks/useFechamentos";
import { hojeEmBrasilia, mesDeTrabalho, mesTerminou, podeFechar, podeReabrir, statusDoMes, ultimoFechado, verificarAlteracao, type Alteracao, type Retrato, type StatusMes } from "@/lib/fechamento";
import { faturasEmAberto, MES_CORTE_CAIXA } from "@/lib/pagamentoFatura";
import { idsDaSerieCartao, idsDaSerieConta } from "@/lib/serie";
import { avisos } from "@/lib/avisos";
import TelaGraficos from "@/components/TelaGraficos";
import TelaInvestimentos from "@/components/TelaInvestimentos";
import CompletarPerfilModal from "@/components/CompletarPerfilModal";
import NovaTransacao from "@/components/NovaTransacao";
import EstadoVazio from "@/components/EstadoVazio";
import DicaModulo from "@/components/DicaModulo";
import BoasVindas from "@/components/BoasVindas";
import GuiaInicial, { type PassoGuia } from "@/components/GuiaInicial";
import TelaGrupo from "@/components/TelaGrupo";
import { calcularPainel, serieEntradasSaidas, type ModoSaldo } from "@/lib/painel";
import { usePagamentosFatura } from "@/hooks/usePagamentosFatura";
import { TOKEN_EU, VISAO_SOMENTE_EU, aguardandoRepasseDoResponsavel, autorNaVisao, filtrarGrupoPorPessoas, idsDaSelecao, lancamentosDoGrupo, marcarForaDaVisao, repassesDoMes, resumoRepasses } from "@/lib/grupo";
import TelaAjuda from "@/components/TelaAjuda";
import CadastrarCartaoModal from "@/components/CadastrarCartaoModal";
import { ICONE_ABA } from "@/components/icons";
import { useOpcoes } from "@/lib/useOpcoes";
import { tipoDaConta } from "@/lib/contas";
import { useOnboarding } from "@/lib/onboarding";
import { useMovimentosConta } from "@/hooks/useMovimentosConta";
import { lerListaDoUsuario, salvarDoUsuario } from "@/lib/usuarioStorage";
import { DICAS_MODULO } from "@/lib/dicasModulo";
import MovimentacoesRecentes from "@/components/MovimentacoesRecentes";
import BotaoOcultarValores from "@/components/BotaoOcultarValores";
import ThemeToggle from "@/components/ThemeToggle";
import AjudaEInstalacao from "@/components/AjudaEInstalacao";
import InvestimentosReservaCard from "@/components/InvestimentosReservaCard";
import GrupoModal from "@/components/GrupoModal";
import { useDestacarLancamento, type FocoLancamento } from "@/hooks/useDestacarLancamento";
import { ABA_DO_LANCAMENTO, type LancamentoBloqueador } from "@/lib/bloqueioExclusao";
import RepasseTravadoModal from "@/components/RepasseTravadoModal";
import type { LancGrupo } from "@/lib/grupo";
import Sidebar from "@/components/Sidebar";
import FiltrosLancamentos, { FILTROS_INICIAIS, type FiltrosLancamentoState } from "@/components/FiltrosLancamentos";
import { ordenarPorValor } from "@/lib/extrato";
import { dataDoItem } from "@/lib/datas";
import { arred } from "@/lib/calculos";
import { useFinanceStore } from "@/hooks/useFinanceStore";
import {
  addMeses,
  brl,
  mesAtual,
  parseValor,
  useValoresOcultos,
  resumoDoMes,
  rotuloMes,
} from "@/lib/finance";
import { supabase } from "@/lib/supabase";
import { MobileBottomNav, MobileHeader, MobileMenu } from "@/components/mobile/MobileShell";
import SaldosContas from "@/components/SaldosContas";

/** Campos de um lançamento usados pelas travas do fechamento e pela conferência */
type ItemLanc = { id?: unknown; mes?: string | null; owner_id?: string | null; responsavel_id?: string | null; repasse_pago?: boolean | null; repasse_pago_em?: string | null; pago?: boolean; nome?: string; foraDoMeuSaldo?: boolean; categoria?: string; tipo?: string; repasseSintetico?: boolean };

type AbaId = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas" | "fatura" | "graficos" | "investimentos" | "ajuda" | "grupo" | "ajustes";

export default function Home() {
  const router = useRouter();
  const loja = useFinanceStore();
  useValoresOcultos(); // re-renderiza a tela inteira quando "ocultar valores" muda

  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const pessoasSel = VISAO_SOMENTE_EU; // Privacidade: o financeiro individual mostra só os registros do próprio usuário
  const [sidebarExpandida, setSidebarExpandida] = useState(true);
  const [mes, setMes] = useState("");
  const [aba, setAba] = useState<AbaId>("inicio");
  const [menuMobile, setMenuMobile] = useState(false);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [secaoAjustes, setSecaoAjustes] = useState<SecaoAjustes>("perfil");
  const [novaAberta, setNovaAberta] = useState(false);
  const [recentes, setRecentes] = useState<string[]>([]);
  const [detalheExtrato, setDetalheExtrato] = useState<TipoDetalhe | null>(null);
  const [modoSaldo, setModoSaldo] = useState<ModoSaldo>("total"); // Resultado do mês x Total disponível
  const [visaoFin, setVisaoFin] = useState<VisaoFinanceira>("pessoal"); // Meu financeiro x Financeiro do grupo (duas opções fixas)

  // Permite abrir direto uma aba (ex.: /?aba=ajustes&secao=perfil, vindo da antiga página de perfil)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("aba") as AbaId | null;
    if (a && ["inicio", "extrato", "lancamentos", "cartao", "contas", "fatura", "graficos", "investimentos", "ajuda", "grupo", "ajustes"].includes(a)) setAba(a);
    const sec = p.get("secao") as SecaoAjustes | null;
    if (sec) setSecaoAjustes(sec);
    if (a) window.history.replaceState(null, "", "/");
  }, []);

  const irPara = (a: AbaId) => {
    if (["fatura", "cartao", "contas", "lancamentos", "graficos", "investimentos", "ajuda"].includes(a)) {
      const novos = [a, ...recentes.filter((r) => r !== a)].slice(0, 6);
      setRecentes(novos);
      salvarDoUsuario(userId, "recentes", novos); // histórico individual por usuário
    }
    setAba(a);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [filtros, setFiltros] = useState<FiltrosLancamentoState>(FILTROS_INICIAIS);

  useEffect(() => {
    setMes(mesAtual());
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setVerificandoAuth(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const { estado, userId, membros } = loja;
  const dashboard = useDashboardPreferences(userId);
  const onb = useOnboarding(userId);
  const { pagamento: formasPagamento } = useOpcoes();
  const caixinhaMovs = useMovimentosConta(); // aportes/resgates de caixinha que usaram o saldo de uma conta
  const { pagamentos: pagamentosFatura } = usePagamentosFatura(); // pagamentos de fatura (só do usuário)
  const [novaPreset, setNovaPreset] = useState<{ tipo?: "saida" | "entrada"; como?: "avista" | "parcelado" | "fixa" }>({});
  const [grupoSub, setGrupoSub] = useState<"resumo" | "lancamentos" | "repasses">("resumo");
  const [ajudaFoco, setAjudaFoco] = useState<string | null>(null);
  const [cadastrandoCartao, setCadastrandoCartao] = useState(false);
  // O popup de perfil vem ANTES do tour de boas-vindas: "verificando" segura o tour até saber se o perfil abre
  const [perfilStatus, setPerfilStatus] = useState<"verificando" | "aberto" | "fechado">("verificando");
  const [tourManual, setTourManual] = useState(false); // "Rever tour" na Central de Ajuda

  // O histórico "Acessados recentemente" é individual: carrega só o do usuário logado.
  useEffect(() => {
    try { localStorage.removeItem("modulos-recentes"); } catch { /* chave antiga, que era compartilhada no aparelho */ }
  }, []);
  useEffect(() => {
    setRecentes(lerListaDoUsuario(userId, "recentes"));
  }, [userId]);

  // "Ver lançamento" no aviso de exclusão bloqueada: abre a aba e o mês do lançamento, mostra todo o grupo (sem
  // filtros que o escondam) e destaca a linha por alguns segundos.
  const [foco, setFoco] = useState<FocoLancamento | null>(null);
  useDestacarLancamento(foco, () => setFoco(null));
  const verLancamento = (l: LancamentoBloqueador) => {
    setModalGrupoAberto(false);
    setFiltros(FILTROS_INICIAIS);
    if (l.mes) setMes(l.mes);
    irPara(ABA_DO_LANCAMENTO[l.tabela]);
    setFoco({ tabela: l.tabela, id: l.id, mes: l.mes, n: Date.now() });
  };

  // "Ir para Repasses" na orientação de repasse confirmado: abre Grupo → Repasses no mês do repasse
  // grupo e destaca a linha em "Concluídos". Não estorna nada: o estorno é feito pela pessoa, com confirmação.
  const irParaRepasses = (l: LancGrupo | null) => {
    if (l?.mes) setMes(l.mes);
    setGrupoSub("repasses");
    irPara("grupo");
    if (l) setFoco({ tabela: l.origem, id: l.id, mes: l.mes, n: Date.now() });
  };

  const abrirNova = (preset: { tipo?: "saida" | "entrada"; como?: "avista" | "parcelado" | "fixa" } = {}) => {
    setNovaPreset(preset);
    setNovaAberta(true);
  };
  const abrirGrupo = (sub: "resumo" | "lancamentos" | "repasses" = "resumo") => {
    setGrupoSub(sub);
    irPara("grupo");
  };
  const abrirAjuda = (topico?: string) => {
    setAjudaFoco(topico ?? null);
    irPara("ajuda");
  };

  const pessoaEu = membros.find((m) => m.id === userId);

  // Filtro único de responsáveis (global): vazio = todo o grupo; "Somente eu" soma o que é meu
  // (responsável ou lançado por mim); as demais pessoas entram pelo nome.
  const passaFiltro = useCallback(
    (item: any) => {
      if (pessoasSel.length === 0) return true;
      if (pessoasSel.includes(TOKEN_EU) && (item.responsavel_id === userId || item.owner_id === userId)) return true;
      return pessoasSel.some((t) => t !== TOKEN_EU && item.responsavel === t);
    },
    [pessoasSel, userId]
  );
  const nomesSelecionados = pessoasSel.map((t) => (t === TOKEN_EU ? pessoaEu?.nome || "Eu" : t));


  const escopoPessoas = useMemo(() => idsDaSelecao(pessoasSel, membros, userId || "", TOKEN_EU), [pessoasSel, membros, userId]);

  const estadoFiltrado = useMemo(() => {
    // O que alguém da visão lançou para uma pessoa fora dela vira "adiantado" (foraDoMeuSaldo) e o repasse
    // concluído volta ao saldo de quem recebeu. Vale para "Somente eu" e para qualquer pessoa filtrada.
    // Despesa que outro integrante lançou para mim só entra no meu financeiro quando o autor confirma o recebimento do
    // repasse (a partir do mês de corte). Pendente e "repassado" continuam só na tela de Repasses.
    const daVisao = (lista: any[]) =>
      lista
        .filter((item) => passaFiltro(item) || autorNaVisao(item, escopoPessoas))
        .filter((item) => !(String(item.mes) >= MES_CORTE_CAIXA && aguardandoRepasseDoResponsavel(item, userId)))
        .map((item) => marcarForaDaVisao(item, escopoPessoas));
    const filtrado = {
      extrato: daVisao(estado.extrato),
      cartao: daVisao(estado.cartao),
      contas: daVisao(estado.contas),
    };
    return { ...estado, ...filtrado };
  }, [estado, passaFiltro, escopoPessoas, pessoasSel, userId, pessoaEu?.nome]);

  const arraysMensais = useMemo(
    () => ({
      extrato: estadoFiltrado.extrato.filter((item) => item.mes === mes),
      cartao: estadoFiltrado.cartao.filter((item) => item.mes === mes),
      contas: estadoFiltrado.contas.filter((item) => item.mes === mes),
    }),
    [estadoFiltrado, mes]
  );

  const opcoesFiltro = useMemo(() => {
    const todos: any[] = [...arraysMensais.extrato, ...arraysMensais.cartao, ...arraysMensais.contas];
    return {
      categorias: [...new Set<string>(todos.map((item) => String(item.categoria || "").trim()).filter(Boolean))].sort(),
      pagamentos: [...new Set<string>(todos.map((item) => String(item.pagamento || item.forma_pagamento || item.cartao || "").trim()).filter(Boolean))].sort(),
    };
  }, [arraysMensais]);

  const correspondeFiltros = useCallback(
    (item: any, origem: "extrato" | "cartao" | "contas") => {
      if (aba === "inicio" || aba === "graficos") return true;
      if (aba === "extrato" && filtros.tipo !== "todos" && filtros.tipo !== origem) return false;
      const descricao = String(item.descricao || item.nome || "").toLocaleLowerCase("pt-BR");
      if (filtros.busca && !descricao.includes(filtros.busca.trim().toLocaleLowerCase("pt-BR"))) return false;
      if (filtros.categoria && item.categoria !== filtros.categoria) return false;
      const pagamento = item.pagamento || item.forma_pagamento || item.cartao || "";
      if (filtros.pagamento && pagamento !== filtros.pagamento) return false;
      if (filtros.dataDe || filtros.dataAte) {
        const d = dataDoItem(item);
        if (!d) return false; // sem data não dá para saber se está no período
        if (filtros.dataDe && d < filtros.dataDe) return false;
        if (filtros.dataAte && d > filtros.dataAte) return false;
      }
      const valorItem = Number(item.valor) || 0;
      const vMin = filtros.valorMin ? parseValor(filtros.valorMin) : null;
      const vMax = filtros.valorMax ? parseValor(filtros.valorMax) : null;
      if (vMin !== null && Number.isFinite(vMin) && valorItem < vMin) return false;
      if (vMax !== null && Number.isFinite(vMax) && valorItem > vMax) return false;
      if ((aba === "extrato" || aba === "contas") && origem === "contas" && filtros.status !== "todos") {
        if (Boolean(item.pago) !== (filtros.status === "pago")) return false;
      }
      return true;
    },
    [aba, filtros, userId]
  );

  // A ordenação por valor combina com todos os demais filtros e só vale nos módulos de listagem
  const ordem = aba === "inicio" || aba === "graficos" ? "" : filtros.ordem;
  const extrato = useMemo(
    () => ordenarPorValor(arraysMensais.extrato.filter((item) => correspondeFiltros(item, "extrato")), ordem),
    [arraysMensais, correspondeFiltros, ordem]
  );
  const cartao = useMemo(
    () => ordenarPorValor(arraysMensais.cartao.filter((item) => correspondeFiltros(item, "cartao")), ordem),
    [arraysMensais, correspondeFiltros, ordem]
  );
  const contas = useMemo(
    () => ordenarPorValor(arraysMensais.contas.filter((item) => correspondeFiltros(item, "contas")), ordem),
    [arraysMensais, correspondeFiltros, ordem]
  );

  const estadoComFiltros = useMemo(
    () => ({ ...estadoFiltrado, extrato, cartao, contas }),
    [estadoFiltrado, extrato, cartao, contas]
  );

  const resumo = useMemo(() => resumoDoMes(estadoComFiltros, mes), [estadoComFiltros, mes]);

  // Painel: resultado do mês (entradas − saídas) x total disponível (acumulado + repasses concluídos).
  // Usa todos os meses da visão escolhida (Todos / Somente eu / pessoas); repasse é transferência interna.
  const saldoInicialContas = useMemo(() => {
    // Só as minhas contas de débito: entram quando a visão me inclui (Todos ou "Somente eu"); as contas dos outros são privadas.
    const incluiMinhas = pessoasSel.length === 0 || pessoasSel.includes(TOKEN_EU);
    if (!incluiMinhas) return 0;
    return formasPagamento.filter((o) => tipoDaConta(o) === "debito").reduce((t, o) => t + (Number(o.saldo_inicial) || 0), 0);
  }, [formasPagamento, pessoasSel]);
  // Aportes são só meus: entram quando a visão me inclui (Todos ou "Somente eu"), como o saldo inicial das contas
  const movsCaixinhaVisao = useMemo(() => (pessoasSel.length === 0 || pessoasSel.includes(TOKEN_EU) ? caixinhaMovs : []), [caixinhaMovs, pessoasSel]);
  // Pagamentos de fatura são meus: entram quando a visão me inclui (a conta de onde saem também é minha)
  const pagamentosFaturaVisao = useMemo(() => (pessoasSel.length === 0 || pessoasSel.includes(TOKEN_EU) ? pagamentosFatura : []), [pagamentosFatura, pessoasSel]);
  const cartoesCredito = useMemo(() => formasPagamento.filter((o) => tipoDaConta(o) === "credito").map((o) => o.nome), [formasPagamento]);
  const painel = useMemo(
    () => (mes ? calcularPainel(estadoFiltrado, { mes, saldoInicial: saldoInicialContas, meuId: userId, dadosRepasses: estado, escopo: escopoPessoas, caixinhaMovs: movsCaixinhaVisao, cartoesCredito, pagamentosFatura: pagamentosFaturaVisao, mesCorteCaixa: MES_CORTE_CAIXA }) : null),
    [estadoFiltrado, estado, mes, saldoInicialContas, userId, escopoPessoas, movsCaixinhaVisao, cartoesCredito, pagamentosFaturaVisao]
  );

  // ---- Novo Resumo: gráfico e faturas em aberto (informativo) ----
  const serieResumo = useMemo(() => (mes ? serieEntradasSaidas(estadoFiltrado, mes) : []), [estadoFiltrado, mes]);
  const faturasAbertas = useMemo(
    // Só pagamentos até o fim do mês visto (um mês passado não é recalculado por pagamento posterior) e a minha parte da fatura
    () => (!mes || !(pessoasSel.length === 0 || pessoasSel.includes(TOKEN_EU)) ? [] : faturasEmAberto(estado, cartoesCredito, pagamentosFatura, [addMeses(mes, -1), mes], { meuId: userId, ateData: `${mes}-31` })),
    [estado, cartoesCredito, pagamentosFatura, mes, pessoasSel, userId],
  );

  // ---- Fechamento mensal (fica inativo enquanto a migração supabase-18 não existir no banco) ----
  const fech = useFechamentos(userId);
  // Data de hoje (Brasília) lida no navegador, depois de montar (não durante a pré-renderização)
  const [hoje, setHoje] = useState("");
  useEffect(() => { setHoje(hojeEmBrasilia()); }, []);
  const mesCorrente = hoje ? hoje.slice(0, 7) : mes;
  const statusDe = useCallback((m: string): StatusMes | null => (hoje && fech.habilitado && fech.estado.mesInicial ? statusDoMes(m, fech.estado, hoje) : null), [fech.habilitado, fech.estado, hoje]);
  const mesTrab = fech.habilitado ? mesDeTrabalho(fech.estado) : null;
  const [conferindo, setConferindo] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [listaMeses, setListaMeses] = useState(false);
  const [avisoMes, setAvisoMes] = useState<string | null>(null);

  // Ao abrir o app, começa no mês em aberto (se for anterior ao mês do calendário)
  const posicionouMes = useRef(false);
  useEffect(() => {
    if (posicionouMes.current || !fech.pronto || !mes) return;
    posicionouMes.current = true;
    if (mesTrab && mesTrab < mes) setMes(mesTrab);
  }, [fech.pronto, mesTrab, mes]);

  // Contas fixas do mês só são trazidas para meses que aceitam lançamento (nunca para mês fechado ou em espera)
  useEffect(() => {
    if (!loja.pronto || !mes || !fech.pronto) return;
    const s = statusDe(mes);
    if (s === "fechado" || s === "espera" || s === "previsao") return;
    void loja.gerarContasFixasDoMes(mes);
  }, [loja.pronto, loja.gerarContasFixasDoMes, mes, fech.pronto, statusDe]);

  // Aviso antecipado antes de gravar; o banco recusa a mesma operação (migração 18)
  const ctxTrava = useMemo(
    () => ({ estado: fech.estado, porPessoa: fech.porPessoa, hoje, meuId: userId || "", nomes: new Map(membros.map((m) => [m.id, m.nome] as [string, string])) }),
    [fech.estado, fech.porPessoa, hoje, userId, membros],
  );
  const barrar = useCallback((a: Alteracao, titulo: string) => {
    if (!fech.habilitado) return false;
    const msg = verificarAlteracao(a, ctxTrava);
    if (msg) avisos.erro(titulo, msg);
    return Boolean(msg);
  }, [fech.habilitado, ctxTrava]);
  const idResp = useCallback((item: { responsavel_id?: string | null; responsavel?: string }): string | null => item?.responsavel_id || membros.find((m) => m.nome === item?.responsavel)?.id || userId, [membros, userId]);
  const achar = useCallback((tabela: "extrato" | "cartao" | "contas", id: string): ItemLanc | undefined => (estado[tabela] as unknown as ItemLanc[]).find((i) => String(i.id) === String(id)), [estado]);
  const acao = useMemo(() => ({
    adicionarExtrato: (...a: Parameters<typeof loja.adicionarExtrato>) => barrar({ tipo: "novo", mes: a[0].mes, responsavelId: idResp(a[0]) }, "Não foi possível lançar") ? Promise.resolve(false) : loja.adicionarExtrato(...a),
    adicionarCartao: (...a: Parameters<typeof loja.adicionarCartao>) => barrar({ tipo: "novo", mes: a[0].mes, responsavelId: idResp(a[0]) }, "Não foi possível lançar") ? Promise.resolve(false) : loja.adicionarCartao(...a),
    adicionarConta: (...a: Parameters<typeof loja.adicionarConta>) => barrar({ tipo: "novo", mes: a[0].mes, responsavelId: idResp(a[0]) }, "Não foi possível lançar") ? Promise.resolve(false) : loja.adicionarConta(...a),
    atualizar: (tabela: "extrato" | "cartao" | "contas", id: string, patch: Record<string, unknown>) => {
      const item = achar(tabela, id);
      const mesNovo = typeof patch.mes === "string" ? patch.mes : typeof patch.data === "string" ? patch.data.slice(0, 7) : null;
      if (item && barrar({ tipo: "editar", item, mesNovo }, "Não foi possível salvar as alterações")) return Promise.resolve(false);
      return loja.atualizar(tabela, id, patch);
    },
    remover: (tabela: "extrato" | "cartao" | "contas", id: string) => {
      const ids = tabela === "cartao" ? idsDaSerieCartao(estado.cartao as any[], id) : tabela === "contas" ? idsDaSerieConta(estado.contas as any[], id) : [id];
      const itens = ids.map((x) => achar(tabela, String(x))).filter((x): x is ItemLanc => Boolean(x));
      if (barrar({ tipo: "remover", itens }, "Não foi possível remover o lançamento")) return Promise.resolve(false);
      return loja.remover(tabela, id);
    },
    alternarPago: (id: string) => {
      const item = achar("contas", id);
      if (item && barrar({ tipo: "pagar", item }, "Não foi possível atualizar o pagamento")) return Promise.resolve();
      return loja.alternarPago(id);
    },
    atualizarRepasses: (...a: Parameters<typeof loja.atualizarRepasses>) => {
      const [itens, acaoRep] = a;
      if (acaoRep === "reabrir" || acaoRep === "concluir") {
        // Confirmar e estornar reconhecem/desfazem a despesa do responsável no mês original: mês fechado dele bloqueia
        const lista = itens.map((i) => achar(i.origem, i.id)).filter((x): x is ItemLanc => Boolean(x));
        if (acaoRep === "reabrir" ? barrar({ tipo: "estornar", itens: lista }, "Não foi possível estornar") : barrar({ tipo: "confirmar", itens: lista }, "Não foi possível confirmar o recebimento")) return Promise.resolve(false);
      }
      return loja.atualizarRepasses(...a);
    },
  }), [barrar, idResp, achar, estado, loja]);

  // Avançar para um mês que ainda não abriu pede o fechamento antes (dá para só consultar)
  const irParaMes = (alvo: string) => {
    const sAlvo = statusDe(alvo), sAtual = statusDe(mes);
    if (mesTrab && (sAlvo === "espera" || sAlvo === "previsao") && sAtual !== "espera" && sAtual !== "previsao") { setAvisoMes(alvo); return; }
    setMes(alvo);
  };
  const abrirConferencia = () => {
    if (!mesTrab) return;
    const ok = podeFechar(mesTrab, fech.estado, hoje);
    if (!ok.ok) { avisos.erro("Ainda não dá para fechar", ok.motivo); return; }
    // O fechamento é pessoal: a conferência usa a visão "Somente eu" do mês em aberto
    setMes(mesTrab);
    setAba("inicio");
    setAvisoMes(null);
    setListaMeses(false);
    setConferindo(true);
  };

  if (verificandoAuth || !loja.pronto || !mes || !painel) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted">
        Carregando painel...
      </main>
    );
  }

  const mostrarPainel = aba === "inicio";

  // ---- Orientação para quem está começando ----
  const totalLanc = estado.extrato.length + estado.cartao.length + estado.contas.length;
  const nadaTotal = totalLanc === 0;
  const nadaVisivel = estadoFiltrado.extrato.length + estadoFiltrado.cartao.length + estadoFiltrado.contas.length === 0;
  const semParcelas = estadoFiltrado.cartao.length === 0;
  const semContas = estadoFiltrado.contas.length === 0;
  const temCartao = formasPagamento.some((f) => f.eh_cartao);
  // Cartão ou conta cadastrados (crédito ou débito): o 1º passo do guia, feito ANTES de lançar
  const temCartaoOuConta = formasPagamento.some((f) => tipoDaConta(f) !== null);
  const temEntrada = estado.extrato.some((i: any) => i.tipo === "entrada");
  const temSaida = estado.extrato.some((i: any) => i.tipo !== "entrada") || estado.cartao.length > 0 || estado.contas.length > 0;
  const passosGuia: PassoGuia[] = [
    // ESSENCIAL (nesta ordem: cadastrar primeiro, lançar depois)
    { id: "cartao", prioridade: "essencial", titulo: "Cadastre seu cartão ou conta", descricao: "Um cartão pode ter crédito (limite e fatura) e débito (saldo). Pix e dinheiro já vêm prontos.", feito: temCartaoOuConta, acao: "Cadastrar", onClick: () => setCadastrandoCartao(true) },
    { id: "entrada", prioridade: "essencial", titulo: "Lance sua primeira entrada", descricao: "Seu salário ou qualquer dinheiro que você recebeu.", feito: temEntrada, acao: "Lançar", onClick: () => abrirNova({ tipo: "entrada" }) },
    { id: "saida", prioridade: "essencial", titulo: "Lance sua primeira saída", descricao: "Um gasto do dia a dia, como mercado ou transporte. Escolha crédito ou débito do cartão.", feito: temSaida, acao: "Lançar", onClick: () => abrirNova({ tipo: "saida", como: "avista" }) },
    { id: "fixa", prioridade: "essencial", titulo: "Cadastre uma conta fixa", descricao: "Aluguel, internet, assinaturas: o que se repete todo mês.", feito: estado.contas.length > 0, acao: "Cadastrar", onClick: () => abrirNova({ tipo: "saida", como: "fixa" }) },
    // COMPLEMENTAR (pode ficar para depois)
    { id: "grupo", prioridade: "complementar", titulo: "Organize o grupo da família", descricao: "Crie ou entre em um grupo para dividir despesas.", feito: membros.length > 1, acao: "Abrir", onClick: () => setModalGrupoAberto(true) },
    { id: "aparencia", prioridade: "complementar", titulo: "Escolha a aparência", descricao: "Tema claro ou escuro, cor de destaque e fundo.", feito: (onb.estado.feitas ?? []).includes("aparencia"), acao: "Escolher", onClick: () => { onb.marcarFeita("aparencia"); setSecaoAjustes("aparencia"); irPara("ajustes"); } },
    { id: "personalizar", prioridade: "complementar", titulo: "Personalize a tela inicial", descricao: "Escolha o que aparece no início.", feito: (onb.estado.feitas ?? []).includes("personalizar"), acao: "Personalizar", onClick: () => { onb.marcarFeita("personalizar"); setSecaoAjustes("dashboard"); irPara("ajustes"); } },
  ];
  const puladasGuia = onb.estado.puladas ?? [];
  const mostrarGuia = onb.pronto && !onb.estado.guiaOculto && totalLanc <= 15 && passosGuia.some((p) => !p.feito && !puladasGuia.includes(p.id));
  // Repasses da tela inicial: só os do mês selecionado e das pessoas da visão (meses anteriores ficam no módulo Grupo, ao trocar o mês)
  const repasses = resumoRepasses(repassesDoMes(filtrarGrupoPorPessoas(lancamentosDoGrupo(estado), escopoPessoas), mes), userId || "");
  const repassesDoMesResumo = { receber: arred(repasses.aReceber.agora + repasses.aReceber.aVencer), receberAguardando: repasses.aReceber.aguardando, repassar: arred(repasses.aRepassar.agora + repasses.aRepassar.aVencer) };

  // ---- Fechamento: faixa, conferência e reabertura do mês selecionado ----
  const sMes = statusDe(mes);
  const eventosMes = fech.eventos.filter((e) => e.mes === mes);
  const ultimoEventoMes = eventosMes[eventosMes.length - 1];
  const consultaApenas = sMes === "fechado" || sMes === "espera" || sMes === "previsao";
  const faixaMes = sMes && sMes !== "historico" ? (
    <FaixaFechamento
      mes={mes} status={sMes} mesTrabalho={mesTrab} terminou={mesTerminou(mes, hoje)}
      fechadoEm={fech.meus.find((x) => x.mes === mes)?.fechadoEm ?? null}
      reabertura={ultimoEventoMes?.tipo === "reabertura" ? ultimoEventoMes : null}
      podeReabrir={podeReabrir(mes, fech.estado).ok} ultimoFechado={ultimoFechado(fech.estado)}
      onConferir={abrirConferencia} onReabrir={() => setReabrindo(true)} onIrTrabalho={() => mesTrab && setMes(mesTrab)}
    />
  ) : null;
  const retratoAtual: Retrato = {
    entrou: painel.entradasRenda, saiu: painel.saidasRealizadas, resultado: painel.resultadoRealizado, disponivel: painel.totalDisponivel,
    contasPendentes: painel.contasPendentes, receber: painel.previsao.receber, repassar: painel.previsao.repassar, sobraPrevista: painel.sobraPrevista,
  };
  const nomeDoMes = (m: string) => rotuloMes(m).split(" de ")[0];
  const avisosConferencia: AvisoConferencia[] = [];
  if (conferindo && mesTrab) {
    const pendentesMes = (contas as unknown as ItemLanc[]).filter((c) => !c.pago && !c.foraDoMeuSaldo && c.mes === mesTrab);
    if (pendentesMes.length) avisosConferencia.push({ tipo: "atencao", titulo: `${pendentesMes.length} ${pendentesMes.length === 1 ? "conta fixa sem pagamento" : "contas fixas sem pagamento"}`, texto: `${pendentesMes.map((c) => c.nome).slice(0, 3).join(", ")}${pendentesMes.length > 3 ? " e outras" : ""}. Se já pagou, marque como paga antes de fechar. Depois, só reabrindo o mês.` });
    if (painel.repasses.aReceberAguardando > 0) avisosConferencia.push({ tipo: "atencao", titulo: `Repasse de ${brl(painel.repasses.aReceberAguardando)} aguardando sua confirmação`, texto: "Confirme se o dinheiro entrou. Pode ser feito depois do fechamento." });
    const semCategoria = ([...extrato, ...cartao] as unknown as ItemLanc[]).filter((i) => i.tipo !== "entrada" && !i.foraDoMeuSaldo && !i.repasseSintetico && (!i.categoria || i.categoria === "Outros")).length;
    if (semCategoria) avisosConferencia.push({ tipo: "info", titulo: `${semCategoria} ${semCategoria === 1 ? "lançamento" : "lançamentos"} sem categoria`, texto: "Aparecem como Outros nos gráficos e relatórios." });
    const naoFecharam = membros.filter((m) => m.id !== userId && !m.convidado && !fech.porPessoa.get(m.id)?.has(mesTrab)).map((m) => m.nome);
    if (naoFecharam.length) avisosConferencia.push({ tipo: "info", titulo: `${naoFecharam.join(", ")} ainda não ${naoFecharam.length === 1 ? "fechou" : "fecharam"} ${nomeDoMes(mesTrab).toLowerCase()}`, texto: "Os lançamentos em que você participa ficam travados quando você fechar." });
  }
  const mesesEmEspera: string[] = [];
  for (let m = addMeses(mes, 1); m <= mesCorrente && mesesEmEspera.length < 24; m = addMeses(m, 1)) if (statusDe(m) !== "fechado") mesesEmEspera.push(m);
  const listaDeMeses = (() => {
    if (!listaMeses) return [];
    const inicio = [fech.estado.mesInicial, addMeses(mesCorrente, -5)].filter((x): x is string => Boolean(x)).sort()[0];
    const lista: { mes: string; status: StatusMes; detalhe: string; podeFechar: boolean }[] = [];
    for (let m = addMeses(mesCorrente, 1); m >= inicio && lista.length < 18; m = addMeses(m, -1)) {
      const s = statusDe(m) ?? "historico";
      const fechadoEm = fech.meus.find((x) => x.mes === m)?.fechadoEm;
      const detalhe = s === "aberto" ? (mesTerminou(m, hoje) ? "Terminou. Pronto para conferir e fechar." : "Mês atual.")
        : s === "fechado" ? `Fechado${fechadoEm ? ` em ${new Date(fechadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}.`
        : s === "espera" ? `Só consulta até você fechar ${mesTrab ? nomeDoMes(mesTrab).toLowerCase() : "o mês em aberto"}.`
        : s === "previsao" ? "Abre quando o mês anterior for fechado."
        : fech.estado.mesInicial ? "Antes do fechamento mensal. Fica como histórico." : "Fechamento mensal ainda não ativado.";
      lista.push({ mes: m, status: s, detalhe, podeFechar: podeFechar(m, fech.estado, hoje).ok });
    }
    return lista;
  })();
  const vazioDoModulo = aba === "cartao" ? semParcelas : aba === "contas" ? semContas : aba === "extrato" || aba === "graficos" ? nadaVisivel : aba === "fatura" ? !temCartao : false;
  const dica = DICAS_MODULO[aba];
  const nomeUsuario = membros.find((m) => m.id === userId)?.nome?.split(" ")[0];
  // Filtro de responsáveis: pílula fixa no topo, junto do seletor de mês (cabeçalho fixo no celular e barra fixa no desktop)
  // Sem filtro por pessoa: o financeiro individual mostra só o que é do próprio usuário (despesa dividida = Repasses)
  const filtroResp = null;
  const pessoasFiltradas = idsDaSelecao(pessoasSel, membros, userId || "", TOKEN_EU);
  const mostrarMesNoCabecalho = aba !== "ajustes" && aba !== "fatura" && aba !== "investimentos" && aba !== "ajuda";
  const rotuloVisualizacao =
    pessoasSel.length === 0 ? "Todo o grupo" : pessoasSel.length === 1 && pessoasSel[0] === TOKEN_EU ? "Somente eu" : nomesSelecionados.join(", ");
  const mostrarFiltros = !mostrarPainel && !(aba === "cartao" ? semParcelas : aba === "contas" ? semContas : aba === "extrato" ? nadaVisivel : false) && aba !== "ajustes" && aba !== "fatura" && aba !== "graficos" && aba !== "investimentos" && aba !== "ajuda";

  return (
    <div className="min-h-screen text-ink">
      <Sidebar
        onAbrirGrupo={() => abrirGrupo()}
        onNova={() => abrirNova()}
        abaAtiva={aba}
        onSelecionarAba={(id) => setAba(id as AbaId)}
        onAlterarExpandido={setSidebarExpandida}
      />

      <main
        className={`min-h-screen min-w-0 pb-28 transition-[padding] duration-200 md:pb-0 ${sidebarExpandida ? "md:pl-60" : "md:pl-16"
          }`}
      >
          <header className="hc-topbar sticky top-0 z-30 hidden w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-8 py-4 backdrop-blur-xl md:flex">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                {aba === "graficos" ? "Gráficos e relatórios" : aba === "investimentos" ? "Investimentos" : aba === "ajustes" ? "Configurações" : aba === "fatura" ? "Cartões e Faturas" : mostrarPainel
                  ? `Olá${nomeUsuario ? `, ${nomeUsuario}` : ""}! 👋`
                  : aba === "extrato"
                    ? "Extrato"
                    : aba === "lancamentos"
                      ? "Lançamentos do mês"
                      : aba === "cartao"
                        ? "Contas parceladas"
                        : "Contas fixas"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {mostrarPainel
                  ? "Sua situação financeira em poucos segundos."
                  : aba === "extrato"
                    ? "Todas as movimentações do mês em um só lugar."
                    : aba === "grupo"
                      ? "Resumo por pessoa, lançamentos entre membros e valores a repassar."
                      : aba === "ajuda"
                        ? "Tutoriais, perguntas frequentes e conceitos para usar o HomeCash."
                        : aba === "graficos"
                          ? "Veja para onde o dinheiro vai e gere relatórios por período."
                          : aba === "investimentos"
                            ? "Caixinhas, reserva de emergência, aportes e rendimentos."
                            : aba === "ajustes"
                              ? "Perfil, plano, aparência, cadastros e tela inicial."
                              : aba === "fatura"
                                ? "Escolha um cartão para ver a fatura do mês."
                                : "Cadastre, consulte e edite seus registros."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {filtroResp}

              {mostrarMesNoCabecalho && <SeletorMes mes={mes} status={sMes} onAnterior={() => irParaMes(addMeses(mes, -1))} onProximo={() => irParaMes(addMeses(mes, 1))} onAbrirMeses={fech.habilitado ? () => setListaMeses(true) : undefined} />}

              <div className="hidden md:block"><BotaoOcultarValores /></div>
              <AjudaEInstalacao onAbrirCentral={() => abrirAjuda()} />
              <ThemeToggle />
            </div>
          </header>
        <div key={aba} className="anim-page mx-auto w-full max-w-6xl space-y-5 px-4 pb-4 md:p-8">
          <MobileHeader
            titulo={
              aba === "grupo" ? "Grupo familiar" : aba === "ajuda" ? "Central de ajuda" : aba === "graficos" ? "Gráficos e relatórios" : aba === "investimentos" ? "Investimentos" : aba === "ajustes" ? "Configurações" : aba === "fatura" ? "Cartões e Faturas" : mostrarPainel
                ? `Olá${nomeUsuario ? `, ${nomeUsuario}` : ""}! 👋`
                : aba === "extrato"
                  ? "Extrato"
                  : aba === "lancamentos"
                    ? "Lançamentos do mês"
                    : aba === "cartao"
                      ? "Contas parceladas"
                      : "Contas fixas"
            }
            mostrarMes={mostrarMesNoCabecalho}
            filtro={filtroResp}
            mes={mes}
            setMes={setMes}
            controleMes={<SeletorMes compacto mes={mes} status={sMes} onAnterior={() => irParaMes(addMeses(mes, -1))} onProximo={() => irParaMes(addMeses(mes, 1))} onAbrirMeses={fech.habilitado ? () => setListaMeses(true) : undefined} />}
            onAbrirMenu={() => setMenuMobile(true)}
          />


          {/* Situação do mês (fechamento mensal): aparece em todos os módulos que mostram um mês */}
          {mostrarMesNoCabecalho && faixaMes}

          {/* Convite "adicionar à tela inicial": fica fora do contêiner da Dashboard (o diálogo dele é fixo na tela) */}
          {mostrarPainel && <div className="hidden md:block"><AjudaEInstalacao modo="convite" onAbrirCentral={() => abrirAjuda()} /></div>}

          {mostrarPainel && (
            // Tela inicial = consulta rápida. "@container": as colunas respondem à largura do conteúdo (com a barra lateral aberta ou fechada).
            // Ordem: situação do mês → cartões e contas → divisão de gastos e caixinhas → últimas movimentações.
            // Análises e histórico (evolução dos meses, "como chegamos ao disponível") ficam em Gráficos e relatórios.
            <div className="@container grid gap-5">
              {mostrarGuia && <GuiaInicial passos={passosGuia} puladas={puladasGuia} onPular={onb.pularEtapa} onRetomar={onb.retomarEtapa} onOcultar={() => onb.atualizar({ guiaOculto: true })} onAjuda={() => abrirAjuda()} />}
              {dashboard.preferencias.resumo && painel && userId && (
                <div className="flex justify-center @xl:justify-start"><SeletorVisaoFinanceira visao={visaoFin} onVisao={setVisaoFin} /></div>
              )}
              {dashboard.preferencias.resumo && visaoFin === "grupo" && painel && userId && (
                <FinanceiroGrupoCard g={financeiroDoGrupo(painel, estado, userId)} onAbrirRepasses={() => abrirGrupo("repasses")} />
              )}
              {dashboard.preferencias.resumo && visaoFin === "pessoal" && (
                <PainelResumo
                  painel={painel}
                  mesCorrente={mesCorrente}
                  contasDoMes={contas}
                  faturas={faturasAbertas}
                  repasses={repassesDoMesResumo}
                  onAbrirExtrato={setDetalheExtrato}
                  onAbrirRepasses={() => abrirGrupo("repasses")}
                  onAbrirContas={() => irPara("contas")}
                  onAbrirFaturas={() => irPara("fatura")}
                  somenteConsulta={consultaApenas}
                />
              )}
              {dashboard.preferencias.resumo && !consultaApenas && userId && (
                <Pendencias
                  mes={mes}
                  userId={userId}
                  estado={estado}
                  contas={contas.filter((c: any) => !c.pago && !c.foraDoMeuSaldo && c.mes === mes) as any}
                  faturas={faturasAbertas}
                  repasses={repasses}
                  onPagarConta={acao.alternarPago}
                  onRepasse={acao.atualizarRepasses}
                />
              )}
              {/* Cada bloco some sozinho quando não há dados; se sobrar um só, ele ocupa a linha inteira */}
              {dashboard.preferencias.faturas && (
                <div className="grid items-start gap-5 @2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @2xl:[&>*:only-child]:col-span-full">
                  <PilhaCartoes estado={estado} mes={mes} onAbrir={() => irPara("fatura")} />
                  <SaldosContas estado={estado} userId={userId} mes={mes} />
                </div>
              )}
              {(dashboard.preferencias.graficos || dashboard.preferencias.investimentos) && (
                <div className="grid items-start gap-5 @3xl:grid-cols-2 @3xl:[&>*:only-child]:col-span-full">
                  {dashboard.preferencias.graficos && <ResponsavelPanel compacto resumo={resumo} itens={{ extrato, cartao, contas }} onAbrir={() => irPara("graficos")} />}
                  {dashboard.preferencias.investimentos && <div id="investimentos" className="min-w-0"><InvestimentosReservaCard /></div>}
                </div>
              )}
              <MovimentacoesRecentes extrato={extrato} cartao={cartao} contas={contas} mes={mes} onVerTudo={() => irPara("extrato")} />
              <HistoricoFechamento mes={mes} eventos={eventosMes} />
              <div className="flex justify-center pt-1">
                <button type="button" onClick={() => { setSecaoAjustes("dashboard"); irPara("ajustes"); }} className="rounded-full bg-surface px-4 py-2 text-xs font-medium text-muted ring-1 ring-line transition hover:text-ink">
                  <span className="inline-flex items-center gap-1.5"><Ico icon={Pencil} size={14} />Personalizar tela inicial</span>
                </button>
              </div>
            </div>
          )}

          {mostrarFiltros && (
            <button
              type="button"
              onClick={() => setFiltrosMobile((f) => !f)}
              className="flex h-10 w-full items-center justify-between rounded-full bg-surface px-4 text-sm font-medium ring-1 ring-line md:hidden"
            >
              <span className="inline-flex items-center gap-2"><Ico icon={Search} size={16} />Buscar e filtrar</span>
              <Ico icon={filtrosMobile ? ChevronUp : ChevronDown} size={18} className="text-muted" />
            </button>
          )}

          {mostrarFiltros && (
            <div className={`${filtrosMobile ? "block" : "hidden"} md:block`}>
              <FiltrosLancamentos
                filtros={filtros}
                setFiltros={setFiltros}
                mes={mes}
                categorias={opcoesFiltro.categorias}
                pagamentos={opcoesFiltro.pagamentos}
                mostrarTipo={aba === "extrato"}
                mostrarStatus={aba === "extrato" || aba === "contas"}
              />
            </div>
          )}

          {dica && onb.pronto && !vazioDoModulo && (
            <DicaModulo titulo={dica.titulo} passos={dica.passos} visivel={!onb.estado.dicas.includes(aba)} onDispensar={() => onb.dispensarDica(aba)} onVerTutorial={() => abrirAjuda(dica.tutorial)} />
          )}

          <div className="min-w-0">
            <section className="min-w-0">
              {aba === "grupo" && (
                <TelaGrupo
                  key={grupoSub}
                  abaInicial={grupoSub}
                  dados={estado}
                  pessoasFiltradas={pessoasFiltradas}
                  membros={membros}
                  userId={userId}
                  mes={mes}
                  onRepasse={acao.atualizarRepasses}
                  onGerenciar={() => setModalGrupoAberto(true)}
                  onNova={() => abrirNova()}
                />
              )}
              {aba === "ajuda" && <TelaAjuda foco={ajudaFoco} onIrPara={(a) => irPara(a as AbaId)} onRever={() => { onb.reiniciar(); setTourManual(true); irPara("inicio"); }} />}
              {aba === "ajustes" && <CentralAjustes key={secaoAjustes} secaoInicial={secaoAjustes} onGrupo={() => setModalGrupoAberto(true)} preferencias={dashboard.preferencias} pronto={dashboard.pronto} salvando={dashboard.salvando} erro={dashboard.erro} onAlterar={dashboard.alterar} />}
              {aba === "graficos" && nadaVisivel && (
                <EstadoVazio icone={ICONE_ABA.graficos} titulo="Ainda não há dados para os gráficos" descricao="Os gráficos e relatórios são montados a partir dos seus lançamentos. Registre algumas entradas e saídas para começar a ver para onde o dinheiro vai." passos={["Toque em Nova transação", "Lance uma entrada (seu salário) e algumas saídas", "Volte aqui para ver a evolução e exportar relatórios"]} acao={{ rotulo: "Fazer o primeiro lançamento", onClick: () => abrirNova() }} />
              )}
              {aba === "graficos" && !nadaVisivel && (
                <TelaGraficos
                  estadoCompleto={estadoFiltrado}
                  rotuloResponsaveis={rotuloVisualizacao}
                  mes={mes}
                  mesCorrente={mesCorrente}
                  resumo={resumo}
                  painel={painel}
                  serie={serieResumo}
                  modo={modoSaldo}
                  onModo={setModoSaldo}
                  itens={{ extrato, cartao, contas }}
                  onAbrirExtrato={setDetalheExtrato}
                />
              )}
              {aba === "investimentos" && <TelaInvestimentos />}
              {aba === "fatura" && <FaturaCartao estado={estado} estadoLista={estadoFiltrado} mes={mes} setMes={setMes} userId={userId} />}
              {aba === "extrato" && nadaVisivel && (
                <EstadoVazio icone={ICONE_ABA.extrato} titulo="Seu extrato está vazio" descricao="O extrato reúne tudo o que você lançar: entradas, compras, parcelas e contas fixas." passos={["Toque em Nova transação", "Escolha Entrada ou Saída e preencha o valor", "Salve e o lançamento aparece aqui"]} acao={{ rotulo: "Fazer o primeiro lançamento", onClick: () => abrirNova() }} />
              )}
              {aba === "extrato" && !nadaVisivel && (
                <ExtratoGeral
                  mes={mes}
                  extrato={extrato}
                  cartao={cartao}
                  contas={contas}
                  ordem={ordem}
                  membros={membros.map((m) => m.nome)}
                  onEdit={(origem, id, patch) => acao.atualizar(origem, id, patch)}
                  onRemove={(origem, id) => acao.remover(origem, id)}
                />
              )}

              {aba === "lancamentos" && (
                <ExtratoTable
                  mes={mes}
                  itens={extrato}
                  onAdd={acao.adicionarExtrato}
                  onRemove={(id) => acao.remover("extrato", id)}
                  onEdit={(id, patch) => acao.atualizar("extrato", id, patch)}
                />
              )}

              {aba === "cartao" && semParcelas && (
                <EstadoVazio icone={ICONE_ABA.cartao} titulo="Nenhuma compra parcelada ainda" descricao="Registre uma compra parcelada uma vez e as próximas parcelas são criadas nos meses seguintes." passos={["Cadastre o cartão (se ainda não tiver)", "Lance a compra em Nova transação > Saída > Parcelado", "Acompanhe as parcelas aqui e em Cartões e Faturas"]} acao={{ rotulo: "Lançar compra parcelada", onClick: () => abrirNova({ tipo: "saida", como: "parcelado" }) }} acaoSecundaria={temCartao ? undefined : { rotulo: "Cadastrar cartão", onClick: () => setCadastrandoCartao(true) }} />
              )}
              {aba === "cartao" && !semParcelas && (
                <CartaoTable
                  estado={estado}
                  mes={mes}
                  itens={cartao}
                  onAdd={acao.adicionarCartao}
                  onRemove={(id) => acao.remover("cartao", id)}
                  onEdit={(id, patch) => acao.atualizar("cartao", id, patch)}
                />
              )}

              {aba === "contas" && semContas && (
                <EstadoVazio icone={ICONE_ABA.contas} titulo="Nenhuma conta fixa cadastrada" descricao="Contas fixas são as que se repetem todo mês, como aluguel, internet e assinaturas. Cadastre uma vez e ela reaparece todo mês para você marcar como paga." passos={["Toque em Cadastrar conta fixa", "Informe nome, valor e (se quiser) o dia do vencimento", "Marque como paga quando pagar"]} acao={{ rotulo: "Cadastrar conta fixa", onClick: () => abrirNova({ tipo: "saida", como: "fixa" }) }} />
              )}
              {aba === "contas" && !semContas && (
                <ContasFixasTable
                  mes={mes}
                  itens={contas}
                  onAdd={acao.adicionarConta}
                  onRemove={(id) => acao.remover("contas", id)}
                  onEdit={(id, patch) => acao.atualizar("contas", id, patch)}
                  onTogglePago={acao.alternarPago}
                />
              )}
            </section>
          </div>

        </div>
      </main>

      {/* Fora do container centralizado: barra fixa no rodapé e menu lateral */}
      <MobileBottomNav perfil={membros.find((m) => m.id === userId) ? { nome: membros.find((m) => m.id === userId)!.nome, avatar: membros.find((m) => m.id === userId)!.avatar, cor: membros.find((m) => m.id === userId)!.cor } : undefined} aba={aba} onAba={irPara} onNova={() => abrirNova()} onGrupo={() => abrirGrupo()} />
      <MobileMenu
        abaAtiva={aba}
        perfil={(() => { const eu = membros.find((m) => m.id === userId); return eu ? { nome: eu.nome, avatar: eu.avatar, cor: eu.cor } : undefined; })()}
        onAba={irPara}
        onAjustes={(secao) => { setSecaoAjustes(secao); irPara("ajustes"); }}
        aberto={menuMobile}
        onFechar={() => setMenuMobile(false)}
        onGrupo={() => abrirGrupo()}
      />
      {onb.pronto && perfilStatus === "fechado" && !onb.estado.boasVindas && (nadaTotal || tourManual) && !novaAberta && (
        <BoasVindas nome={nomeUsuario} onConcluir={() => { setTourManual(false); onb.atualizar({ boasVindas: true }); }} />
      )}
      {cadastrandoCartao && <CadastrarCartaoModal onFechar={() => setCadastrandoCartao(false)} onLancarCompra={() => abrirNova({ tipo: "saida", como: "parcelado" })} />}
      <CompletarPerfilModal onDecidir={(abrir) => setPerfilStatus(abrir ? "aberto" : "fechado")} onFechar={() => setPerfilStatus("fechado")} />
      {novaAberta && (
        <NovaTransacao
          estado={estado}
          mes={mes}
          membros={membros}
          userId={userId}
          tipoInicial={novaPreset.tipo}
          comoInicial={novaPreset.como}
          onFechar={() => setNovaAberta(false)}
          onAdicionarExtrato={acao.adicionarExtrato}
          onAdicionarCartao={acao.adicionarCartao}
          onAdicionarConta={acao.adicionarConta}
        />
      )}
      <RepasseTravadoModal meuId={userId || ""} onIrParaRepasses={irParaRepasses} />
      {modalGrupoAberto && <GrupoModal onClose={() => setModalGrupoAberto(false)} dados={estado} onVerLancamento={verLancamento} />}
      {conferindo && mesTrab && mes === mesTrab && pessoasSel.length === 1 && pessoasSel[0] === TOKEN_EU && (
        <ConferenciaFechamento
          mes={mesTrab}
          retrato={retratoAtual}
          faturasEmAberto={faturasAbertas.reduce((t, f) => t + f.restante, 0)}
          aguardandoConfirmacao={painel.repasses.aReceberAguardando}
          avisos={avisosConferencia}
          onFechar={() => setConferindo(false)}
          onConfirmar={async () => {
            const msg = await fech.fechar(mesTrab, retratoAtual);
            if (!msg) {
              setConferindo(false);
              avisos.sucesso(`${nomeDoMes(mesTrab)} fechado`, `${nomeDoMes(addMeses(mesTrab, 1))} é o mês em aberto agora.`);
              setMes(addMeses(mesTrab, 1));
            }
            return msg;
          }}
        />
      )}
      {reabrindo && sMes === "fechado" && (
        <ReabrirMes
          mes={mes}
          mesesEmEspera={mesesEmEspera}
          onFechar={() => setReabrindo(false)}
          onConfirmar={async (motivo) => {
            const msg = await fech.reabrir(mes, motivo);
            if (!msg) { setReabrindo(false); avisos.sucesso(`${nomeDoMes(mes)} reaberto`, "Corrija o que precisar e feche o mês de novo."); }
            return msg;
          }}
        />
      )}
      {listaMeses && (
        <ListaMeses
          meses={listaDeMeses}
          mesInicial={fech.estado.mesInicial}
          sugestaoInicio={addMeses(mesCorrente, -1)}
          onEscolher={(m) => { setListaMeses(false); setMes(m); }}
          onConferir={abrirConferencia}
          onAtivar={async (m) => {
            const msg = await fech.iniciar(m);
            if (!msg) avisos.sucesso("Fechamento mensal ativado", `A partir de ${rotuloMes(m).toLowerCase()}.`);
            return msg;
          }}
          onFechar={() => setListaMeses(false)}
        />
      )}
      {avisoMes && mesTrab && (
        <AvisoMesNaoAberto
          mes={avisoMes}
          mesTrabalho={mesTrab}
          podeConferir={podeFechar(mesTrab, fech.estado, hoje).ok}
          onFechar={() => setAvisoMes(null)}
          onConferir={abrirConferencia}
          onVerConsulta={() => { setMes(avisoMes); setAvisoMes(null); }}
        />
      )}
      {detalheExtrato && (
        <ExtratoDetalhe
          tipo={detalheExtrato}
          mes={mes}
          extrato={extrato}
          cartao={cartao}
          contas={contas}
          painel={painel}
          modo={modoSaldo}
          visualizacao={rotuloVisualizacao}
          onFechar={() => setDetalheExtrato(null)}
        />
      )}
    </div>
  );
}