"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CartaoTable from "@/components/CartaoTable";
import ContasFixasTable from "@/components/ContasFixasTable";
import ExtratoTable from "@/components/ExtratoTable";
import ResponsavelPanel from "@/components/ResponsavelPanel";
import SummaryCards from "@/components/SummaryCards";
import ThemeToggle from "@/components/ThemeToggle";
import GrupoModal from "@/components/GrupoModal";
import Sidebar from "@/components/Sidebar";
import { useFinanceStore } from "@/hooks/useFinanceStore";
import { addMeses, mesAtual, resumoDoMes, rotuloMes } from "@/lib/finance";
import { supabase } from "@/lib/supabase";

const ABAS = [
  { id: "extrato", nome: "Extrato" },
  { id: "cartao", nome: "Cartão parcelado" },
  { id: "contas", nome: "Contas fixas" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

export default function Home() {
  const router = useRouter();
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [membroSelecionado, setMembroSelecionado] = useState("TODOS");

  const loja = useFinanceStore();
  const [mes, setMes] = useState("");
  const [aba, setAba] = useState<AbaId>("extrato");

  // Define o mês atual apenas após a montagem do componente no cliente
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
      if (!session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // CORREÇÃO: Acessando diretamente 'loja' em vez de 'loja.estado'
  const resumo = useMemo(() => resumoDoMes(loja, mes), [loja, mes]);
  const extrato = useMemo(() => loja.extrato.filter((i) => i.mes === mes), [loja.extrato, mes]);
  const cartao = useMemo(() => loja.cartao.filter((i) => i.mes === mes), [loja.cartao, mes]);
  const contas = useMemo(() => loja.contas.filter((i) => i.mes === mes), [loja.contas, mes]);

  // CORREÇÃO: A loja usa 'carregando', não 'pronto'
  if (verificandoAuth || loja.carregando || !mes) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted">Carregando painel...</main>;
  }

  return (
    <div className="flex min-h-screen bg-background text-ink">
      {/* Menu Lateral Expansível */}
      <Sidebar
        onAbrirGrupo={() => setModalGrupoAberto(true)}
        membroSelecionado={membroSelecionado}
        setMembroSelecionado={setMembroSelecionado}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 pl-20 md:pl-64 transition-all duration-300 p-6 md:p-8 space-y-6 max-w-[1600px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Painel de controle</h1>
            <p className="text-xs text-muted">Gerencie seus gastos individuais e em grupo.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-line bg-surface">
              <button
                type="button"
                onClick={() => setMes(addMeses(mes, -1))}
                aria-label="Mês anterior"
                className="h-9 rounded-l-xl px-3 text-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
              >
                ‹
              </button>
              <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
                {rotuloMes(mes)}
              </span>
              <button
                type="button"
                onClick={() => setMes(addMeses(mes, 1))}
                aria-label="Próximo mês"
                className="h-9 rounded-r-xl px-3 text-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
              >
                ›
              </button>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* CORREÇÃO: loja.config em vez de estado.config */}
        <SummaryCards resumo={resumo} config={loja.config} onConfig={loja.atualizarConfig} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div role="tablist" aria-label="Tipo de lançamento" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  role="tab"
                  type="button"
                  aria-selected={aba === a.id}
                  onClick={() => setAba(a.id)}
                  className={`h-9 flex-1 rounded-lg px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-accent ${
                    aba === a.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  {a.nome}
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {aba === "extrato" && (
                <ExtratoTable
                  mes={mes}
                  itens={extrato}
                  onAdd={loja.adicionarExtrato}
                  onRemove={(id) => loja.remover("extrato", id)}
                />
              )}
              {aba === "cartao" && (
                <CartaoTable
                  mes={mes}
                  itens={cartao}
                  onAdd={loja.adicionarCartao}
                  onRemove={(id) => loja.remover("cartao", id)}
                />
              )}
              {aba === "contas" && (
                <ContasFixasTable
                  mes={mes}
                  itens={contas}
                  onAdd={loja.adicionarConta}
                  onRemove={(id) => loja.remover("contas", id)}
                  onTogglePago={loja.alternarPago}
                  // CORREÇÃO: Passando o mês anterior e o novo mês para copiar
                  onCopiarMesAnterior={() => loja.copiarContasDoMesAnterior(addMeses(mes, -1), mes)}
                />
              )}
            </div>
          </div>

          <div className="lg:sticky lg:top-6">
            <ResponsavelPanel resumo={resumo} />
          </div>
        </div>

        {/* Modal de Gerenciamento do Grupo */}
        {modalGrupoAberto && (
          <GrupoModal onClose={() => setModalGrupoAberto(false)} />
        )}
      </main>
    </div>
  );
}