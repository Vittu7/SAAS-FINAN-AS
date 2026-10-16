"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { addMeses, gastosDoUsuario, mesAtual, resumoDoMes, rotuloMes } from "@/lib/finance";
import { supabase } from "@/lib/supabase";

// O id interno "cartao" continua o mesmo (ligado ao banco); só o texto da aba mudou.
const ABAS = [
  { id: "extrato", nome: "Extrato" },
  { id: "cartao", nome: "Contas Parceladas" },
  { id: "contas", nome: "Contas fixas" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

export default function Home() {
  const router = useRouter();
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [membroSelecionado, setMembroSelecionado] = useState("TODOS");
  const [sidebarExpandida, setSidebarExpandida] = useState(true);

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

  const { estado, userId, membros } = loja;

  // Filtro da Sidebar: "TODOS" mostra tudo; "EU" mostra o que é do usuário logado;
  // qualquer outro valor é o nome de um membro do grupo.
  const passaFiltro = useCallback(
    (i: any) => {
      if (membroSelecionado === "TODOS") return true;
      if (membroSelecionado === "EU") return i.responsavel_id === userId;
      return i.responsavel === membroSelecionado;
    },
    [membroSelecionado, userId],
  );

  // Nomes dos outros membros (e convidados) para o filtro da Sidebar
  const nomesOutrosMembros = useMemo(
    () => membros.filter((m) => m.id !== userId).map((m) => m.nome),
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

  // Totais seguem o filtro da Sidebar; a "sobra" usa sempre o salário menos os gastos do próprio usuário
  const resumo = useMemo(() => {
    const base = resumoDoMes(estadoFiltrado, mes);
    const meusGastos = gastosDoUsuario(estado, mes, userId);
    return { ...base, meusGastos, sobra: base.salario - meusGastos };
  }, [estadoFiltrado, estado, mes, userId]);
  const extrato = useMemo(() => estadoFiltrado.extrato.filter((i) => i.mes === mes), [estadoFiltrado, mes]);
  const cartao = useMemo(() => estadoFiltrado.cartao.filter((i) => i.mes === mes), [estadoFiltrado, mes]);
  const contas = useMemo(() => estadoFiltrado.contas.filter((i) => i.mes === mes), [estadoFiltrado, mes]);

  if (verificandoAuth || !loja.pronto || !mes) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted">Carregando painel...</main>;
  }

  return (
    <div className="flex min-h-screen bg-background text-ink">
      {/* Menu Lateral Expansível */}
      <Sidebar
        onAbrirGrupo={() => setModalGrupoAberto(true)}
        membroSelecionado={membroSelecionado}
        setMembroSelecionado={setMembroSelecionado}
        listaMembros={nomesOutrosMembros}
        abaAtiva={aba}
        onSelecionarAba={(id) => setAba(id as AbaId)}
        onAlterarExpandido={setSidebarExpandida}
      />

      {/* Conteúdo Principal: a margem esquerda reserva o espaço da Sidebar e o conteúdo fica centralizado */}
      <main
        className={`min-w-0 flex-1 transition-all duration-300 ${sidebarExpandida ? "pl-20 md:pl-64" : "pl-20"
          }`}
      >
        <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-8">
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
                <span className="min-w-28 text-center text-sm font-medium sm:min-w-36" aria-live="polite">
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

          <SummaryCards resumo={resumo} config={estado.config} onConfig={loja.atualizarConfig} />

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <div
                role="tablist"
                aria-label="Tipo de lançamento"
                className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1"
              >
                {ABAS.map((a) => (
                  <button
                    key={a.id}
                    role="tab"
                    type="button"
                    aria-selected={aba === a.id}
                    onClick={() => setAba(a.id)}
                    className={`h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-accent sm:text-sm ${aba === a.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
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
                    onCopiarMesAnterior={() => loja.copiarContasDoMesAnterior(mes)}
                  />
                )}
              </div>
            </div>

            <div className="min-w-0 lg:sticky lg:top-6">
              <ResponsavelPanel resumo={resumo} />
            </div>
          </div>

          {/* Modal de Gerenciamento do Grupo */}
          {modalGrupoAberto && <GrupoModal onClose={() => setModalGrupoAberto(false)} />}
        </div>
      </main>
    </div>
  );
}