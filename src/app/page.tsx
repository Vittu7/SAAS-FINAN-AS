"use client";

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
  gastosDoUsuario,
  mesAtual,
  resumoDoMes,
  rotuloMes,
} from "@/lib/finance";
import { supabase } from "@/lib/supabase";
import { MobileAtalhos, MobileBottomNav, MobileHeader, MobileMenu, MobileSaldo } from "@/components/mobile/MobileShell";
import CaixinhasDestaque from "@/components/CaixinhasDestaque";

type AbaId = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas" | "fatura" | "ajustes";

export default function Home() {
  const router = useRouter();
  const loja = useFinanceStore();

  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [membroSelecionado, setMembroSelecionado] = useState("EU"); // Privacidade: começa mostrando só os seus registros
  const [sidebarExpandida, setSidebarExpandida] = useState(true);
  const [mes, setMes] = useState("");
  const [aba, setAba] = useState<AbaId>("inicio");
  const [menuMobile, setMenuMobile] = useState(false);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const [secaoAjustes, setSecaoAjustes] = useState<SecaoAjustes>("perfil");
  const [detalheExtrato, setDetalheExtrato] = useState<TipoDetalhe | null>(null);

  // Permite abrir direto uma aba (ex.: /?aba=ajustes&secao=perfil, vindo da antiga página de perfil)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("aba") as AbaId | null;
    if (a && ["inicio", "extrato", "lancamentos", "cartao", "contas", "fatura", "ajustes"].includes(a)) setAba(a);
    const sec = p.get("secao") as SecaoAjustes | null;
    if (sec) setSecaoAjustes(sec);
    if (a) window.history.replaceState(null, "", "/");
  }, []);

  const irPara = (a: AbaId) => {
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

  const passaFiltro = useCallback(
    (item: any) => {
      if (membroSelecionado === "TODOS") return true;
      if (membroSelecionado === "EU") return item.responsavel_id === userId;
      return item.responsavel === membroSelecionado;
    },
    [membroSelecionado, userId]
  );

  const nomesOutrosMembros = useMemo(
    () => membros.filter((membro) => membro.id !== userId).map((membro) => membro.nome),
    [membros, userId]
  );

  const estadoFiltrado = useMemo(
    () => ({
      ...estado,
      extrato: estado.extrato.filter(passaFiltro),
      cartao: estado.cartao.filter(passaFiltro),
      contas: estado.contas.filter(passaFiltro),
    }),
    [estado, passaFiltro]
  );

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
      if (aba === "inicio") return true;
      if (aba === "extrato" && filtros.tipo !== "todos" && filtros.tipo !== origem) return false;
      const descricao = String(item.descricao || item.nome || "").toLocaleLowerCase("pt-BR");
      if (filtros.busca && !descricao.includes(filtros.busca.trim().toLocaleLowerCase("pt-BR"))) return false;
      if (filtros.responsavel && item.responsavel !== filtros.responsavel) return false;
      if (filtros.categoria && item.categoria !== filtros.categoria) return false;
      const pagamento = item.pagamento || item.forma_pagamento || item.cartao || "";
      if (filtros.pagamento && pagamento !== filtros.pagamento) return false;
      if ((aba === "extrato" || aba === "contas") && origem === "contas" && filtros.status !== "todos") {
        if (Boolean(item.pago) !== (filtros.status === "pago")) return false;
      }
      return true;
    },
    [aba, filtros]
  );

  // A ordenação por valor combina com todos os demais filtros e só vale nos módulos de listagem
  const ordem = aba === "inicio" ? "" : filtros.ordem;
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

  const resumo = useMemo(() => {
    const base = resumoDoMes(estadoComFiltros, mes);
    const meusGastos = gastosDoUsuario(estadoComFiltros, mes, userId);

    return {
      ...base,
      meusGastos,
      sobra: base.salario - meusGastos,
    };
  }, [estadoComFiltros, mes, userId]);

  if (verificandoAuth || !loja.pronto || !mes) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted">
        Carregando painel...
      </main>
    );
  }

  const mostrarPainel = aba === "inicio";
  // Em Configurações nada depende de mês nem de visualização por pessoa; em Faturas o mês já tem seletor próprio
  const mostrarVisualizacao = aba !== "ajustes";
  const mostrarMesNoCabecalho = aba !== "ajustes" && aba !== "fatura";
  const rotuloVisualizacao =
    membroSelecionado === "EU" ? "Somente eu" : membroSelecionado === "TODOS" ? "Todo o grupo" : membroSelecionado;
  const mostrarFiltros = !mostrarPainel && aba !== "ajustes" && aba !== "fatura";

  return (
    <div className="min-h-screen bg-background text-ink">
      <Sidebar
        onAbrirGrupo={() => setModalGrupoAberto(true)}
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
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-4 md:p-8">
          <MobileHeader
            titulo={
              aba === "ajustes" ? "Configurações" : aba === "fatura" ? "Faturas do cartão" : mostrarPainel
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
                {aba === "ajustes" ? "Configurações" : aba === "fatura" ? "Faturas do cartão" : mostrarPainel
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

              <AjudaEInstalacao mostrarConvite={mostrarPainel} />
              <ThemeToggle />
            </div>
          </header>

          {mostrarPainel && (
            <>
              {dashboard.preferencias.resumo && <MobileSaldo
                resumo={resumo}
                salario={estado.config.salario}
                onConfig={(salario) => loja.atualizarConfig({ salario })}
                onAbrirExtrato={setDetalheExtrato}
              />}
              <MobileAtalhos
                onAba={irPara}
                onGrupo={() => setModalGrupoAberto(true)}
              />
              {dashboard.preferencias.resumo && <div className="hidden md:block">
                <SummaryCards
                  resumo={resumo}
                  salario={estado.config.salario}
                  onConfig={(salario) => loja.atualizarConfig({ salario })}
                  onAbrirExtrato={setDetalheExtrato}
                />
              </div>}
              {dashboard.preferencias.faturas && <PilhaCartoes estado={estado} mes={mes} onAbrir={() => irPara("fatura")} />}
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {dashboard.preferencias.graficos && <div id="graficos" className="min-w-0"><ResponsavelPanel resumo={resumo} itens={{ extrato, cartao, contas }} /></div>}
                {dashboard.preferencias.investimentos && <div id="investimentos" className="min-w-0">=<InvestimentosReservaCard /></div>}
              </div>
              <div className="flex justify-center pt-1">
                <button type="button" onClick={() => { setSecaoAjustes("dashboard"); irPara("ajustes"); }} className="rounded-full bg-surface px-4 py-2 text-xs font-medium text-muted ring-1 ring-line transition hover:text-ink">
                  ✎ Personalizar tela inicial
                </button>
              </div>
            </>
          )}

          {mostrarFiltros && (
            <button
              type="button"
              onClick={() => setFiltrosMobile((f) => !f)}
              className="flex h-10 w-full items-center justify-between rounded-full bg-surface px-4 text-sm font-medium ring-1 ring-line md:hidden"
            >
              <span>⚲ Buscar e filtrar</span>
              <span className="text-muted">{filtrosMobile ? "▴" : "▾"}</span>
            </button>
          )}

          {mostrarFiltros && (
            <div className={`${filtrosMobile ? "block" : "hidden"} md:block`}>
              <FiltrosLancamentos
                filtros={filtros}
                setFiltros={setFiltros}
                responsaveis={opcoesFiltro.responsaveis}
                categorias={opcoesFiltro.categorias}
                pagamentos={opcoesFiltro.pagamentos}
                mostrarTipo={aba === "extrato"}
                mostrarStatus={aba === "extrato" || aba === "contas"}
              />
            </div>
          )}

          <div className="min-w-0">
            <section className="min-w-0">
              {aba === "ajustes" && <CentralAjustes key={secaoAjustes} secaoInicial={secaoAjustes} onGrupo={() => setModalGrupoAberto(true)} preferencias={dashboard.preferencias} pronto={dashboard.pronto} salvando={dashboard.salvando} erro={dashboard.erro} onAlterar={dashboard.alterar} />}
              {aba === "fatura" && <FaturaCartao estado={estado} mes={mes} setMes={setMes} />}
              {aba === "extrato" && (
                <ExtratoGeral mes={mes} extrato={extrato} cartao={cartao} contas={contas} ordem={ordem} />
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

              {aba === "cartao" && (
                <CartaoTable
                  estado={estado}
                  mes={mes}
                  itens={cartao}
                  onAdd={loja.adicionarCartao}
                  onRemove={(id) => loja.remover("cartao", id)}
                  onEdit={(id, patch) => loja.atualizar("cartao", id, patch)}
                />
              )}

              {aba === "contas" && (
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
      <MobileBottomNav aba={aba} onAba={irPara} />
      <MobileMenu
        onAba={irPara}
        aberto={menuMobile}
        onFechar={() => setMenuMobile(false)}
        onGrupo={() => setModalGrupoAberto(true)}
      />
      {modalGrupoAberto && <GrupoModal onClose={() => setModalGrupoAberto(false)} />}
      {detalheExtrato && (
        <ExtratoDetalhe
          tipo={detalheExtrato}
          mes={mes}
          extrato={extrato}
          cartao={cartao}
          contas={contas}
          salario={estado.config.salario}
          userId={userId}
          visualizacao={rotuloVisualizacao}
          onFechar={() => setDetalheExtrato(null)}
        />
      )}
    </div>
  );
}