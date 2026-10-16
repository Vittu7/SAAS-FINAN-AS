"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import FiltrosLancamentos, { type FiltrosLancamentoState } from "@/components/FiltrosLancamentos";
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

type AbaId = "inicio" | "extrato" | "lancamentos" | "cartao" | "contas";

export default function Home() {
  const router = useRouter();
  const loja = useFinanceStore();

  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [membroSelecionado, setMembroSelecionado] = useState("TODOS");
  const [sidebarExpandida, setSidebarExpandida] = useState(true);
  const [mes, setMes] = useState("");
  const [aba, setAba] = useState<AbaId>("inicio");
  const [menuMobile, setMenuMobile] = useState(false);
  const [filtrosMobile, setFiltrosMobile] = useState(false);
  const irPara = (a: AbaId) => { setAba(a); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const [filtros, setFiltros] = useState<FiltrosLancamentoState>({
    busca: "", responsavel: "", categoria: "", pagamento: "", tipo: "todos", status: "todos",
  });

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

  const passaFiltro = useCallback(
    (item: any) => {
      if (membroSelecionado === "TODOS") return true;
      if (membroSelecionado === "EU") return item.responsavel_id === userId;
      return item.responsavel === membroSelecionado;
    },
    [membroSelecionado, userId],
  );

  const nomesOutrosMembros = useMemo(
    () => membros.filter((membro) => membro.id !== userId).map((membro) => membro.nome),
    [membros, userId],
  );

  const estadoFiltrado = useMemo(
    () => ({
      ...estado,
      extrato: estado.extrato.filter(passaFiltro),
      cartao: estado.cartao.filter(passaFiltro),
      contas: estado.contas.filter(passaFiltro),
    }),
    [estado, passaFiltro],
  );

  const arraysMensais = useMemo(() => ({
    extrato: estadoFiltrado.extrato.filter((item) => item.mes === mes),
    cartao: estadoFiltrado.cartao.filter((item) => item.mes === mes),
    contas: estadoFiltrado.contas.filter((item) => item.mes === mes),
  }), [estadoFiltrado, mes]);

  const opcoesFiltro = useMemo(() => {
    const todos: any[] = [...arraysMensais.extrato, ...arraysMensais.cartao, ...arraysMensais.contas];
    return {
      responsaveis: [...new Set<string>(todos.map((item) => String(item.responsavel || "").trim()).filter(Boolean))].sort(),
      categorias: [...new Set<string>(todos.map((item) => String(item.categoria || "").trim()).filter(Boolean))].sort(),
      pagamentos: [...new Set<string>(todos.map((item) => String(item.pagamento || item.forma_pagamento || item.cartao || "").trim()).filter(Boolean))].sort(),
    };
  }, [arraysMensais]);

  const correspondeFiltros = useCallback((item: any, origem: "extrato" | "cartao" | "contas") => {
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
  }, [aba, filtros]);

  const extrato = useMemo(() => arraysMensais.extrato.filter((item) => correspondeFiltros(item, "extrato")), [arraysMensais, correspondeFiltros]);
  const cartao = useMemo(() => arraysMensais.cartao.filter((item) => correspondeFiltros(item, "cartao")), [arraysMensais, correspondeFiltros]);
  const contas = useMemo(() => arraysMensais.contas.filter((item) => correspondeFiltros(item, "contas")), [arraysMensais, correspondeFiltros]);

  const estadoComFiltros = useMemo(() => ({ ...estadoFiltrado, extrato, cartao, contas }), [estadoFiltrado, extrato, cartao, contas]);

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
        className={`min-h-screen min-w-0 pb-28 transition-[padding] duration-200 md:pb-0 ${sidebarExpandida ? "md:pl-60" : "md:pl-16"
          }`}
      >
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-4 md:p-8">
          <MobileHeader
            titulo={mostrarPainel ? "Olá 👋" : aba === "extrato" ? "Extrato" : aba === "lancamentos" ? "Lançamentos" : aba === "cartao" ? "Parcelas" : "Contas fixas"}
            mes={mes}
            setMes={setMes}
            membroSelecionado={membroSelecionado}
            setMembroSelecionado={setMembroSelecionado}
            listaMembros={nomesOutrosMembros}
            onAbrirMenu={() => setMenuMobile(true)}
          />
          <header className="hidden flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {mostrarPainel
                  ? "Visão geral"
                  : aba === "extrato"
                    ? "Extrato"
                    : aba === "lancamentos"
                      ? "Lançamentos"
                    : aba === "cartao"
                      ? "Contas parceladas"
                      : "Contas fixas"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {mostrarPainel
                  ? "Seu mês, organizado em um só lugar."
                  : aba === "extrato"
                    ? "Todas as movimentações do mês em um só lugar."
                    : "Cadastre, consulte e edite seus registros."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-10 items-center rounded-lg border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setMes(addMeses(mes, -1))}
                  aria-label="Mês anterior"
                  className="grid h-full w-10 place-items-center rounded-l-lg text-muted transition hover:bg-background hover:text-ink"
                >
                  ‹
                </button>

                <span
                  className="min-w-32 px-2 text-center text-sm font-medium"
                  aria-live="polite"
                >
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
              </div>

              <AjudaEInstalacao mostrarConvite={mostrarPainel} />
              <ThemeToggle />
            </div>
          </header>

          {mostrarPainel && (
            <>
              <MobileSaldo resumo={resumo} salario={estado.config.salario} onConfig={(salario) => loja.atualizarConfig({ salario })} />
              <MobileAtalhos onAba={irPara} onGrupo={() => setModalGrupoAberto(true)} />
              <div className="hidden md:block">
              <SummaryCards
                resumo={resumo}
                salario={estado.config.salario}
                onConfig={(salario) => loja.atualizarConfig({ salario })}
              />
              </div>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <InvestimentosReservaCard config={estado.config} onConfig={loja.atualizarConfig} />
                <ResponsavelPanel resumo={resumo} />
              </div>
            </>
          )}

          {!mostrarPainel && (
            <button type="button" onClick={() => setFiltrosMobile((f) => !f)}
              className="flex h-10 w-full items-center justify-between rounded-full bg-surface px-4 text-sm font-medium ring-1 ring-line md:hidden">
              <span>⚲ Buscar e filtrar</span><span className="text-muted">{filtrosMobile ? "▴" : "▾"}</span>
            </button>
          )}

          {!mostrarPainel && (
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
              {aba === "extrato" && (
                <ExtratoGeral
                  mes={mes}
                  extrato={extrato}
                  cartao={cartao}
                  contas={contas}
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

              {aba === "cartao" && (
                <CartaoTable
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

          <MobileBottomNav aba={aba} onAba={irPara} />
          <MobileMenu aberto={menuMobile} onFechar={() => setMenuMobile(false)} onGrupo={() => setModalGrupoAberto(true)} />

          {modalGrupoAberto && (
            <GrupoModal onClose={() => setModalGrupoAberto(false)} />
          )}
        </div>
      </main>
    </div>
  );
}
