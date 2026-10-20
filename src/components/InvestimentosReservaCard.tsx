"use client";

import { useState } from "react";
import { brl } from "@/lib/finance";
import { useCaixinhas } from "@/hooks/useCaixinhas";
import { metaAtingida, progressoCaixinha, rotuloLocal, totalRendimentos, type Caixinha, type TipoMovimento } from "@/lib/caixinhas";
import { FormularioCaixinha, HistoricoDialog, MovimentoDialog } from "./CaixinhaModais";

type Dialogo =
  | { tipo: "form"; caixinha: Caixinha | null; comoReserva?: boolean }
  | { tipo: "movimento"; caixinhaId?: string; mov: TipoMovimento }
  | { tipo: "historico"; caixinhaId?: string }
  | null;

const chaveOnboarding = (userId: string) => `homecash:onboarding-reserva:${userId}`;
const lerFlag = (chave: string) => {
  try {
    return localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
};
const gravarFlag = (chave: string) => {
  try {
    localStorage.setItem(chave, "1");
  } catch {
    // armazenamento indisponível (modo privado): o banner volta na próxima visita
  }
};

const botaoMini = "rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition hover:text-ink";

export default function InvestimentosReservaCard() {
  const c = useCaixinhas();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [, atualizarTela] = useState(0);

  const chave = c.userId ? chaveOnboarding(c.userId) : null;
  const onboardingVisivel = !c.carregando && !c.erro && c.caixinhas.length === 0 && !!chave && !lerFlag(chave);
  const dispensarOnboarding = () => {
    if (chave) gravarFlag(chave);
    atualizarTela((n) => n + 1);
  };

  const total = c.caixinhas.reduce((t, x) => t + x.saldo, 0);
  const rendimentos = totalRendimentos(c.movimentos);
  const reservas = c.caixinhas.filter((x) => x.ehReserva);
  const reservaSaldo = reservas.reduce((t, x) => t + x.saldo, 0);
  const reservaMeta = reservas.reduce((t, x) => t + x.meta, 0);
  const progReserva = progressoCaixinha({ saldo: reservaSaldo, meta: reservaMeta });
  const comMeta = c.caixinhas.filter((x) => x.meta > 0);
  const atingidas = comMeta.filter(metaAtingida).length;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 md:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Planejamento</p>
          <h2 className="mt-1 text-lg font-semibold">Caixinhas de investimento</h2>
          <p className="mt-1 text-sm text-muted">Organize seus objetivos e acompanhe cada aporte.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.caixinhas.length > 0 && (
            <>
              <button type="button" className={botaoMini} onClick={() => setDialogo({ tipo: "movimento", mov: "aporte" })}>
                + Registrar movimentação
              </button>
              <button type="button" className={botaoMini} onClick={() => setDialogo({ tipo: "historico" })}>
                Histórico
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent transition hover:opacity-90"
            onClick={() => setDialogo({ tipo: "form", caixinha: null })}
          >
            + Nova caixinha
          </button>
        </div>
      </header>

      {c.erro && (
        <p className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-400" role="alert">
          {c.erro}
        </p>
      )}

      {onboardingVisivel && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold">Gostaria de criar sua Reserva de Emergência para começar?</p>
          <p className="mt-1 text-xs text-muted">É o dinheiro guardado para imprevistos. Leva menos de um minuto e depois você acompanha o saldo e os rendimentos crescendo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:opacity-90"
              onClick={() => setDialogo({ tipo: "form", caixinha: null, comoReserva: true })}
            >
              Sim, criar agora
            </button>
            <button type="button" className={botaoMini} onClick={dispensarOnboarding}>
              Agora não
            </button>
          </div>
        </div>
      )}

      {c.caixinhas.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Resumo rotulo="Total guardado" valor={brl(total)} detalhe={rendimentos > 0 ? `${brl(rendimentos)} de rendimentos` : undefined} />
          <Resumo
            rotulo="Reserva de emergência"
            valor={reservas.length ? brl(reservaSaldo) : "—"}
            detalhe={reservaMeta > 0 ? `${Math.round(progReserva)}% da meta` : reservas.length ? "Sem meta definida" : "Não criada"}
          />
          <Resumo rotulo="Metas atingidas" valor={comMeta.length ? `${atingidas} de ${comMeta.length}` : "—"} />
        </div>
      )}

      {c.carregando ? (
        <p className="text-sm text-muted">Carregando caixinhas...</p>
      ) : c.caixinhas.length === 0 ? (
        !onboardingVisivel && <p className="text-sm text-muted">Nenhuma caixinha ainda. Crie a primeira em “Nova caixinha”.</p>
      ) : (
        <div className="grid gap-3 2xl:grid-cols-2">
          {c.caixinhas.map((x) => (
            <CartaoCaixinha
              key={x.id}
              c={x}
              rendimentos={totalRendimentos(c.movimentos, x.id)}
              onRendimento={() => setDialogo({ tipo: "movimento", caixinhaId: x.id, mov: "rendimento" })}
              onGuardar={() => setDialogo({ tipo: "movimento", caixinhaId: x.id, mov: "aporte" })}
              onResgatar={() => setDialogo({ tipo: "movimento", caixinhaId: x.id, mov: "resgate" })}
              onHistorico={() => setDialogo({ tipo: "historico", caixinhaId: x.id })}
              onEditar={() => setDialogo({ tipo: "form", caixinha: x })}
            />
          ))}
        </div>
      )}

      {dialogo?.tipo === "form" && (
        <FormularioCaixinha
          inicial={dialogo.caixinha}
          comoReserva={dialogo.comoReserva}
          onSalvar={(d) => (dialogo.caixinha ? c.editar(dialogo.caixinha.id, d) : c.criar(d))}
          onExcluir={dialogo.caixinha ? () => c.excluir(dialogo.caixinha!.id) : undefined}
          onFechar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "movimento" && (
        <MovimentoDialog
          caixinhas={c.caixinhas}
          caixinhaId={dialogo.caixinhaId}
          tipoInicial={dialogo.mov}
          onRegistrar={c.registrarMovimento}
          onFechar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "historico" && (
        <HistoricoDialog
          movimentos={c.movimentos}
          caixinhas={c.caixinhas}
          caixinhaId={dialogo.caixinhaId}
          onExcluir={c.excluirMovimento}
          onFechar={() => setDialogo(null)}
        />
      )}
    </section>
  );
}

function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="text-xs text-muted">{detalhe}</p>}
    </div>
  );
}

function CartaoCaixinha({
  c,
  rendimentos,
  onRendimento,
  onGuardar,
  onResgatar,
  onHistorico,
  onEditar,
}: {
  c: Caixinha;
  rendimentos: number;
  onRendimento: () => void;
  onGuardar: () => void;
  onResgatar: () => void;
  onHistorico: () => void;
  onEditar: () => void;
}) {
  const progresso = progressoCaixinha(c);
  const atingida = metaAtingida(c);

  return (
    <article className="min-w-0 rounded-xl bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} aria-hidden />
            <span className="truncate">{c.nome}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {c.ehReserva && <Etiqueta>Reserva de emergência</Etiqueta>}
            {c.exibirNaHome && <Etiqueta>Na Home</Etiqueta>}
            {atingida && <Etiqueta>Meta atingida 🎉</Etiqueta>}
          </div>
        </div>
        <button type="button" onClick={onEditar} className="shrink-0 text-xs text-muted hover:text-ink">
          Editar
        </button>
      </div>

      <p className="mt-3 text-2xl font-semibold tabular-nums">{brl(c.saldo)}</p>
      <p className="text-xs text-muted">
        {c.meta > 0 ? `Meta ${brl(c.meta)}` : "Sem meta definida"}
        {rotuloLocal(c) ? ` · ${rotuloLocal(c)}` : ""}
        {c.rendimento ? ` · ${c.rendimento}` : ""}
      </p>
      {rendimentos > 0 && <p className="text-xs font-medium text-emerald-500">Rendeu {brl(rendimentos)} até agora</p>}

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label={`Progresso de ${c.nome}`}
        aria-valuenow={Math.round(progresso)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${progresso}%`, backgroundColor: c.cor }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {c.meta > 0 ? `${Math.round(progresso)}% da meta` : "Defina uma meta para acompanhar"}
        {c.aporteAutoAtivo && c.aporteAutoValor > 0 ? ` · Aporte automático ${brl(c.aporteAutoValor)}/mês` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onGuardar} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent hover:opacity-90">
          Guardar
        </button>
        <button type="button" onClick={onRendimento} className={botaoMini}>
          Rendimento
        </button>
        <button type="button" onClick={onResgatar} disabled={c.saldo <= 0} className={`${botaoMini} disabled:opacity-40`}>
          Resgatar
        </button>
        <button type="button" onClick={onHistorico} className={botaoMini}>
          Histórico
        </button>
      </div>
    </article>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{children}</span>;
}
