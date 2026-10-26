"use client";

import { ChevronDown, ChevronUp, Pencil, Search } from "lucide-react";
import { Ico } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import SummaryCards from "@/components/SummaryCards";
import TelaGraficos from "@/components/TelaGraficos";
import TelaInvestimentos from "@/components/TelaInvestimentos";
import CompletarPerfilModal from "@/components/CompletarPerfilModal";
import NovaTransacao from "@/components/NovaTransacao";
import EstadoVazio from "@/components/EstadoVazio";
import DicaModulo from "@/components/DicaModulo";
import BoasVindas from "@/components/BoasVindas";
import GuiaInicial, { type PassoGuia } from "@/components/GuiaInicial";
import TelaGrupo from "@/components/TelaGrupo";
import { lancamentosDoGrupo, resumoRepasses } from "@/lib/grupo";
import TelaAjuda from "@/components/TelaAjuda";
import CadastrarCartaoModal from "@/components/CadastrarCartaoModal";
import { ICONE_ABA } from "@/components/icons";
import { useOpcoes } from "@/lib/useOpcoes";
import { useOnboarding } from "@/lib/onboarding";
import { lerListaDoUsuario, salvarDoUsuario } from "@/lib/usuarioStorage";
import { DICAS_MODULO } from "@/lib/dicasModulo";
import MovimentacoesRecentes from "@/components/MovimentacoesRecentes";
import BotaoOcultarValores from "@/components/BotaoOcultarValores";
import ThemeToggle from "@/components/ThemeToggle";
import AjudaEInstalacao from "@/components/AjudaEInstalacao";
import InvestimentosReservaCard from "@/components/InvestimentosReservaCard";
import GrupoModal from "@/components/GrupoModal";
import Sidebar from "@/components/Sidebar";
import FiltrosLancamentos, { FILTROS_INICIAIS, type FiltrosLancamentoState } from "@/components/FiltrosLancamentos";
import { ordenarPorValor } from "@/lib/extrato";
import { useFinanceStore } from "@/hooks/useFinanceStore";
import {
  addMeses,
  brl,
  mesAtual,
  useValoresOcultos,
  resumoDoMes,
  rotuloMes,
} from "@/lib/finance";
import { supabase } from "@/lib/supabase";
import { MobileBottomNav, MobileHeader, MobileMenu, MobileRecentes, MobileSaldo } from "@/components/mobile/MobileShell";
import CaixinhasDestaque from "@/components/CaixinhasDestaque";

type AbaId = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas" | "fatura" | "graficos" | "investimentos" | "ajuda" | "grupo" | "ajustes";

export default function Home() {
  const router = useRouter();
  const loja = useFinanceStore();
  useValoresOcultos(); // re-renderiza a tela inteira quando "ocultar valores" muda

  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [membroSelecionado, setMembroSelecionado] = useState("EU"); // Privacidade: começa mostrando só os seus registros
  const [sidebarExpandida, setSidebarExpandida] = useState(true);
  const [mes, setMes] = useState("");
  const [aba, setAba] = useState<AbaId>("inicio");
  const [menuMobile, setMenuMobile] = useState(false);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [secaoAjustes, setSecaoAjustes] = useState<SecaoAjustes>("perfil");
  const [novaAberta, setNovaAberta] = useState(false);
  const [recentes, setRecentes] = useState<string[]>([]);
  const [detalheExtrato, setDetalheExtrato] = useState<TipoDetalhe | null>(null);

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
    if (loja.pronto && mes) {
      void loja.gerarContasFixasDoMes(mes);
    }
  }, [loja.pronto, loja.gerarContasFixasDoMes, mes]);

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
  const [novaPreset, setNovaPreset] = useState<{ tipo?: "saida" | "entrada"; como?: "avista" | "parcelado" | "fixa" }>({});
  const [grupoSub, setGrupoSub] = useState<"resumo" | "lancamentos" | "repasses">("resumo");
  const [ajudaFoco, setAjudaFoco] = useState<string | null>(null);
  const [cadastrandoCartao, setCadastrandoCartao] = useState(false);

  // O histórico "Acessados recentemente" é individual: carrega só o do usuário logado.
  useEffect(() => {
    try { localStorage.removeItem("modulos-recentes"); } catch { /* chave antiga, que era compartilhada no aparelho */ }
  }, []);
  useEffect(() => {
    setRecentes(lerListaDoUsuario(userId, "recentes"));
  }, [userId]);

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

  const passaFiltro = useCallback(
    (item: any) => {
      if (membroSelecionado === "TODOS") return true;
      // "Somente eu": o que é meu (responsável) e também o que EU lancei para outras pessoas
      if (membroSelecionado === "EU") return item.responsavel_id === userId || item.owner_id === userId;
      return item.responsavel === membroSelecionado;
    },
    [membroSelecionado, userId]
  );

  const nomesOutrosMembros = useMemo(
    () => membros.filter((membro) => membro.id !== userId).map((membro) => membro.nome),
    [membros, userId]
  );

  const estadoFiltrado = useMemo(() => {
    // Na visão "Somente eu", o que lancei para outra pessoa aparece nas listas (identificado),
    // mas não entra nos MEUS totais: o gasto é de quem é responsável e o repasse não conta duas vezes.
    const marcar = (item: any) => (membroSelecionado === "EU" && item.lancadoParaOutro ? { ...item, foraDoMeuSaldo: true } : item);
    return {
      ...estado,
      extrato: estado.extrato.filter(passaFiltro).map(marcar),
      cartao: estado.cartao.filter(passaFiltro).map(marcar),
      contas: estado.contas.filter(passaFiltro).map(marcar),
    };
  }, [estado, passaFiltro, membroSelecionado]);

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
      responsaveis: [...new Set<string>(todos.map((item) => String(item.responsavel || "").trim()).filter(Boolean))].sort(),
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
      if (filtros.responsavel.length > 0 && !filtros.responsavel.includes(item.responsavel)) return false;
      if (filtros.autoria === "mim" && item.owner_id && item.owner_id !== userId) return false;
      if (filtros.autoria === "grupo" && !(item.owner_id && item.owner_id !== userId)) return false;
      if (filtros.categoria && item.categoria !== filtros.categoria) return false;
      const pagamento = item.pagamento || item.forma_pagamento || item.cartao || "";
      if (filtros.pagamento && pagamento !== filtros.pagamento) return false;
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

  if (verificandoAuth || !loja.pronto || !mes) {
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
  const temEntrada = estado.extrato.some((i: any) => i.tipo === "entrada") || (estado.config?.salario ?? 0) > 0;
  const temSaida = estado.extrato.some((i: any) => i.tipo !== "entrada") || estado.cartao.length > 0 || estado.contas.length > 0;
  const passosGuia: PassoGuia[] = [
    { id: "entrada", titulo: "Lance sua primeira entrada", descricao: "Seu salário ou qualquer dinheiro que você recebeu.", feito: temEntrada, acao: "Lançar", onClick: () => abrirNova({ tipo: "entrada" }) },
    { id: "saida", titulo: "Lance sua primeira saída", descricao: "Um gasto do dia a dia, como mercado ou transporte.", feito: temSaida, acao: "Lançar", onClick: () => abrirNova({ tipo: "saida", como: "avista" }) },
    { id: "cartao", titulo: "Cadastre um cartão de crédito", descricao: "Para acompanhar fatura e limite.", feito: temCartao, opcional: true, acao: "Cadastrar", onClick: () => setCadastrandoCartao(true) },
    { id: "fixa", titulo: "Cadastre uma conta fixa", descricao: "Aluguel, internet, assinaturas: o que se repete todo mês.", feito: estado.contas.length > 0, opcional: true, acao: "Cadastrar", onClick: () => abrirNova({ tipo: "saida", como: "fixa" }) },
    { id: "grupo", titulo: "Organize o grupo da família", descricao: "Crie ou entre em um grupo para dividir despesas.", feito: membros.length > 1, opcional: true, acao: "Abrir", onClick: () => setModalGrupoAberto(true) },
  ];
  const mostrarGuia = onb.pronto && !onb.estado.guiaOculto && totalLanc <= 15 && passosGuia.some((p) => !p.feito);
  const repasses = resumoRepasses(lancamentosDoGrupo(estado), userId || "");
  const vazioDoModulo = aba === "cartao" ? semParcelas : aba === "contas" ? semContas : aba === "extrato" || aba === "graficos" ? nadaVisivel : aba === "fatura" ? !temCartao : false;
  const dica = DICAS_MODULO[aba];
  const nomeUsuario = membros.find((m) => m.id === userId)?.nome?.split(" ")[0];
  // Em Configurações nada depende de mês nem de visualização por pessoa; em Faturas o mês já tem seletor próprio
  const mostrarVisualizacao = aba !== "ajustes" && aba !== "investimentos" && aba !== "ajuda" && aba !== "grupo";
  const mostrarMesNoCabecalho = aba !== "ajustes" && aba !== "fatura" && aba !== "investimentos" && aba !== "ajuda" && aba !== "grupo";
  const rotuloVisualizacao =
    membroSelecionado === "EU" ? "Somente eu" : membroSelecionado === "TODOS" ? "Todo o grupo" : membroSelecionado;
  const mostrarFiltros = !mostrarPainel && !(aba === "cartao" ? semParcelas : aba === "contas" ? semContas : aba === "extrato" ? nadaVisivel : false) && aba !== "ajustes" && aba !== "fatura" && aba !== "graficos" && aba !== "investimentos" && aba !== "ajuda";

  return (
    <div className="min-h-screen bg-background text-ink">
      <Sidebar
        onAbrirGrupo={() => abrirGrupo()}
        onNova={() => abrirNova()}
        membroSelecionado={membroSelecionado}
        setMembroSelecionado={setMembroSelecionado}
        listaMembros={nomesOutrosMembros}
        abaAtiva={aba}
        onSelecionarAba={(id) => setAba(id as AbaId)}
        onAlterarExpandido={setSidebarExpandida}
      />

      <main
        className={`min-h-screen min-w-0 pb-28 transition-[padding] duration-200 md:pb-0 ${
          sidebarExpandida ? "md:pl-60" : "md:pl-16"
        }`}
      >
        <div key={aba} className="anim-page mx-auto w-full max-w-6xl space-y-5 px-4 pb-4 md:p-8">
          <MobileHeader
            titulo={
              aba === "grupo" ? "Grupo familiar" : aba === "ajuda" ? "Central de ajuda" : aba === "graficos" ? "Gráficos e relatórios" : aba === "investimentos" ? "Investimentos" : aba === "ajustes" ? "Configurações" : aba === "fatura" ? "Cartões e Faturas" : mostrarPainel
                ? "Olá 👋"
                : aba === "extrato"
                ? "Extrato"
                : aba === "lancamentos"
                ? "Lançamentos do mês"
                : aba === "cartao"
                ? "Contas parceladas"
                : "Contas fixas"
            }
            mostrarMes={mostrarMesNoCabecalho}
            mostrarVisualizacao={mostrarVisualizacao}
            mes={mes}
            setMes={setMes}
            membroSelecionado={membroSelecionado}
            setMembroSelecionado={setMembroSelecionado}
            listaMembros={nomesOutrosMembros}
            onAbrirMenu={() => setMenuMobile(true)}
          />

          <header className="hidden min-w-0 flex-wrap items-center justify-between gap-4 border-b border-line py-5 md:flex">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                {aba === "graficos" ? "Gráficos e relatórios" : aba === "investimentos" ? "Investimentos" : aba === "ajustes" ? "Configurações" : aba === "fatura" ? "Cartões e Faturas" : mostrarPainel
                  ? "Olá 👋 Visão geral"
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
                  ? "Seu mês, organizado em um só lugar."
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

            <div className="flex items-center gap-2">
              {mostrarVisualizacao && <select
                aria-label="Visualização"
                value={membroSelecionado}
                onChange={(e) => setMembroSelecionado(e.target.value)}
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="EU">Somente eu</option>
                <option value="TODOS">Todo o grupo</option>
                {nomesOutrosMembros.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>}

              {mostrarMesNoCabecalho && <div className="flex h-10 items-center rounded-xl border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setMes(addMeses(mes, -1))}
                  aria-label="Mês anterior"
                  className="grid h-full w-10 place-items-center rounded-l-lg text-muted transition hover:bg-background hover:text-ink"
                >
                  ‹
                </button>

                <span className="min-w-32 px-2 text-center text-sm font-medium" aria-live="polite">
                  {rotuloMes(mes)}
                </span>

                <button
                  type="button"
                  onClick={() => setMes(addMeses(mes, 1))}
                  aria-label="Próximo mês"
                  className="grid h-full w-10 place-items-center rounded-r-lg text-muted transition hover:bg-background hover:text-ink"
                >
                  ›
                </button>
              </div>}

              <div className="hidden md:block"><BotaoOcultarValores /></div>
              <AjudaEInstalacao mostrarConvite={mostrarPainel} onAbrirCentral={() => abrirAjuda()} />
              <ThemeToggle />
            </div>
          </header>

          {mostrarPainel && (
            <div className="anim-stagger space-y-5">
              {mostrarGuia && <GuiaInicial passos={passosGuia} onOcultar={() => onb.atualizar({ guiaOculto: true })} onAjuda={() => abrirAjuda()} />}
              {userId && (repasses.aReceber.agora > 0 || repasses.aRepassar.agora > 0) && (
                <button type="button" onClick={() => abrirGrupo("repasses")} className="card-glass flex w-full items-center justify-between gap-3 p-4 text-left transition hover:-translate-y-0.5" aria-label="Ver valores a repassar">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Valores a repassar</span>
                    <span className="block text-xs text-muted">
                      {repasses.aReceber.agora > 0 && <>Você tem <b className="text-emerald-700 dark:text-emerald-400">{brl(repasses.aReceber.agora)}</b> a receber</>}
                      {repasses.aReceber.agora > 0 && repasses.aRepassar.agora > 0 && " · "}
                      {repasses.aRepassar.agora > 0 && <>Você deve repassar <b className="text-amber-700 dark:text-amber-400">{brl(repasses.aRepassar.agora)}</b></>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-accent">Ver</span>
                </button>
              )}
              {dashboard.preferencias.resumo && <MobileSaldo resumo={resumo} onAbrirExtrato={setDetalheExtrato} />}
              {dashboard.preferencias.resumo && <div className="hidden md:block"><SummaryCards resumo={resumo} onAbrirExtrato={setDetalheExtrato} /></div>}
              <MobileRecentes recentes={recentes} onAba={irPara} />
              {dashboard.preferencias.faturas && <PilhaCartoes estado={estado} mes={mes} onAbrir={() => irPara("fatura")} />}
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {dashboard.preferencias.graficos && <div id="graficos" className="min-w-0"><ResponsavelPanel resumo={resumo} itens={{ extrato, cartao, contas }} /></div>}
                {dashboard.preferencias.investimentos && <div id="investimentos" className="min-w-0"><InvestimentosReservaCard /></div>}
              </div>
              <MovimentacoesRecentes extrato={extrato} cartao={cartao} contas={contas} mes={mes} onVerTudo={() => irPara("extrato")} />
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
                responsaveis={opcoesFiltro.responsaveis}
                pessoas={membros.map((m) => ({ nome: m.nome, avatar: m.avatar, cor: m.cor }))}
                mostrarAutoria={membros.length > 1}
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
                  membros={membros}
                  userId={userId}
                  mes={mes}
                  onMarcarRepasses={loja.marcarRepasses}
                  onGerenciar={() => setModalGrupoAberto(true)}
                  onNova={() => abrirNova()}
                />
              )}
              {aba === "ajuda" && <TelaAjuda foco={ajudaFoco} onIrPara={(a) => irPara(a as AbaId)} onRever={() => { onb.reiniciar(); irPara("inicio"); }} />}
              {aba === "ajustes" && <CentralAjustes key={secaoAjustes} secaoInicial={secaoAjustes} onGrupo={() => setModalGrupoAberto(true)} preferencias={dashboard.preferencias} pronto={dashboard.pronto} salvando={dashboard.salvando} erro={dashboard.erro} onAlterar={dashboard.alterar} />}
              {aba === "graficos" && nadaVisivel && (
                <EstadoVazio icone={ICONE_ABA.graficos} titulo="Ainda não há dados para os gráficos" descricao="Os gráficos e relatórios são montados a partir dos seus lançamentos. Registre algumas entradas e saídas para começar a ver para onde o dinheiro vai." passos={["Toque em Nova transação", "Lance uma entrada (seu salário) e algumas saídas", "Volte aqui para ver a evolução e exportar relatórios"]} acao={{ rotulo: "Fazer o primeiro lançamento", onClick: () => abrirNova() }} />
              )}
              {aba === "graficos" && !nadaVisivel && (
                <TelaGraficos
                  estadoCompleto={estadoFiltrado}
                  mes={mes}
                  resumo={resumo}
                  itens={{ extrato, cartao, contas }}
                  onAbrirExtrato={setDetalheExtrato}
                />
              )}
              {aba === "investimentos" && <TelaInvestimentos />}
              {aba === "fatura" && <FaturaCartao estado={estado} mes={mes} setMes={setMes} />}
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
                  onEdit={(origem, id, patch) => loja.atualizar(origem, id, patch)}
                  onRemove={(origem, id) => loja.remover(origem, id)}
                />
              )}

              {aba === "lancamentos" && (
                <ExtratoTable
                  mes={mes}
                  itens={extrato}
                  onAdd={loja.adicionarExtrato}
                  onRemove={(id) => loja.remover("extrato", id)}
                  onEdit={(id, patch) => loja.atualizar("extrato", id, patch)}
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
                  onAdd={loja.adicionarCartao}
                  onRemove={(id) => loja.remover("cartao", id)}
                  onEdit={(id, patch) => loja.atualizar("cartao", id, patch)}
                />
              )}

              {aba === "contas" && semContas && (
                <EstadoVazio icone={ICONE_ABA.contas} titulo="Nenhuma conta fixa cadastrada" descricao="Contas fixas são as que se repetem todo mês, como aluguel, internet e assinaturas. Cadastre uma vez e ela reaparece todo mês para você marcar como paga." passos={["Toque em Cadastrar conta fixa", "Informe nome, valor e (se quiser) o dia do vencimento", "Marque como paga quando pagar"]} acao={{ rotulo: "Cadastrar conta fixa", onClick: () => abrirNova({ tipo: "saida", como: "fixa" }) }} />
              )}
              {aba === "contas" && !semContas && (
                <ContasFixasTable
                  mes={mes}
                  itens={contas}
                  onAdd={loja.adicionarConta}
                  onRemove={(id) => loja.remover("contas", id)}
                  onEdit={(id, patch) => loja.atualizar("contas", id, patch)}
                  onTogglePago={loja.alternarPago}
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
      {onb.pronto && !onb.estado.boasVindas && nadaTotal && !novaAberta && (
        <BoasVindas nome={nomeUsuario} onConcluir={() => onb.atualizar({ boasVindas: true })} />
      )}
      {cadastrandoCartao && <CadastrarCartaoModal onFechar={() => setCadastrandoCartao(false)} onLancarCompra={() => abrirNova({ tipo: "saida", como: "parcelado" })} />}
      <CompletarPerfilModal />
      {novaAberta && (
        <NovaTransacao
          mes={mes}
          membros={membros}
          userId={userId}
          tipoInicial={novaPreset.tipo}
          comoInicial={novaPreset.como}
          onFechar={() => setNovaAberta(false)}
          onAdicionarExtrato={loja.adicionarExtrato}
          onAdicionarCartao={loja.adicionarCartao}
          onAdicionarConta={loja.adicionarConta}
        />
      )}
      {modalGrupoAberto && <GrupoModal onClose={() => setModalGrupoAberto(false)} />}
      {detalheExtrato && (
        <ExtratoDetalhe
          tipo={detalheExtrato}
          mes={mes}
          extrato={extrato}
          cartao={cartao}
          contas={contas}
          salario={estado.config.salario}
          visualizacao={rotuloVisualizacao}
          onFechar={() => setDetalheExtrato(null)}
        />
      )}
    </div>
  );
}