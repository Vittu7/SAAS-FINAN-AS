"use client";

import { larguraBarra, percentual } from "@/lib/privacidade";
import { useState } from "react";
import { addMeses, brl, mesAtual, parseValor, rotuloMes } from "@/lib/finance";
import { useCaixinhas } from "@/hooks/useCaixinhas";
import { metaAtingida, progressoCaixinha, rotuloLocal, totalRendimentos, type Caixinha } from "@/lib/caixinhas";

/** Tela inicial: sugestões de aporte automático do mês + cards das caixinhas marcadas para a Home. */
export default function CaixinhasDestaque() {
  const { caixinhas, movimentos, sugestoes, lembretesRendimento, carregando, confirmarSugestao, dispensarSugestao, registrarRendimento, dispensarRendimento } =
    useCaixinhas();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const destaque = caixinhas.filter((c) => c.exibirNaHome);
  if (carregando || (destaque.length === 0 && sugestoes.length === 0 && lembretesRendimento.length === 0)) return null;

  const tratar = async (id: string, acao: () => Promise<string | null>) => {
    setOcupado(id);
    setErro((await acao()) ?? "");
    setOcupado(null);
  };

  return (
    <section className="space-y-3" aria-label="Caixinhas em destaque">
      {lembretesRendimento.length > 0 && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold">Quanto seu dinheiro rendeu em {rotuloMes(addMeses(mesAtual(), -1))}?</p>
          <p className="text-xs text-muted">Veja no app do seu banco e anote aqui. Assim você acompanha o saldo crescendo mês a mês.</p>
          <ul className="mt-3 space-y-2">
            {lembretesRendimento.map((c) => (
              <LembreteRendimento
                key={c.id}
                c={c}
                onRegistrar={(v) => registrarRendimento(c, v)}
                onDispensar={() => dispensarRendimento(c)}
              />
            ))}
          </ul>
        </div>
      )}

      {sugestoes.length > 0 && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm font-semibold">Aportes de {rotuloMes(mesAtual())}</p>
          <p className="text-xs text-muted">Você configurou aporte automático nestas caixinhas. Confirme para registrar no histórico.</p>
          <ul className="mt-3 space-y-2">
            {sugestoes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  {c.nome} · <strong className="tabular-nums">{brl(c.aporteAutoValor)}</strong>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={ocupado === c.id}
                    onClick={() => tratar(c.id, () => confirmarSugestao(c))}
                    className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
                  >
                    Confirmar aporte
                  </button>
                  <button
                    type="button"
                    disabled={ocupado === c.id}
                    onClick={() => tratar(c.id, () => dispensarSugestao(c))}
                    className="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-60"
                  >
                    Agora não
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {erro && (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {erro}
            </p>
          )}
        </div>
      )}

      {destaque.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {destaque.map((c) => {
            const progresso = progressoCaixinha(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => document.getElementById("investimentos")?.scrollIntoView({ behavior: "smooth" })}
                className="min-w-0 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-accent/50"
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} aria-hidden />
                  <span className="truncate">{c.ehReserva ? "Reserva de emergência" : "Caixinha"}</span>
                </p>
                <p className="mt-1 truncate text-sm font-semibold">{c.nome}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{brl(c.saldo)}</p>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-label={`Progresso de ${c.nome}`}
                  aria-valuenow={larguraBarra(Math.round(progresso))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full transition-[width]" style={{ width: `${larguraBarra(progresso)}%`, backgroundColor: c.cor }} />
                </div>
                {rotuloLocal(c) && <p className="mt-1 truncate text-xs text-muted">{rotuloLocal(c)}</p>}
                <p className="mt-1.5 text-xs text-muted">
                  {c.meta > 0 ? (metaAtingida(c) ? `Meta de ${brl(c.meta)} atingida 🎉` : `${percentual(`${Math.round(progresso)}%`)} de ${brl(c.meta)}`) : "Sem meta definida"}
                </p>
                {totalRendimentos(movimentos, c.id) > 0 && (
                  <p className="text-xs font-medium text-emerald-500">Rendeu {brl(totalRendimentos(movimentos, c.id))}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LembreteRendimento({
  c,
  onRegistrar,
  onDispensar,
}: {
  c: Caixinha;
  onRegistrar: (valor: number) => Promise<string | null>;
  onDispensar: () => Promise<string | null>;
}) {
  const [valor, setValor] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const executar = async (acao: () => Promise<string | null>) => {
    setOcupado(true);
    setErro((await acao()) ?? "");
    setOcupado(false);
  };

  const registrar = () => {
    const v = parseValor(valor);
    if (v <= 0) {
      setErro("Informe quanto rendeu. Se não rendeu nada, toque em “Não rendeu”.");
      return;
    }
    void executar(() => onRegistrar(v));
  };

  return (
    <li className="rounded-xl bg-surface px-3 py-2">
      <p className="truncate text-sm">
        {c.nome} <span className="text-xs text-muted">· {rotuloLocal(c) || "rendimento"}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-32 items-center rounded-lg border border-line bg-background px-2 focus-within:ring-2 focus-within:ring-accent">
          <span className="mr-1 text-xs text-muted">R$</span>
          <input
            inputMode="decimal"
            placeholder="0,00"
            aria-label={`Rendimento de ${c.nome}`}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && registrar()}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button type="button" disabled={ocupado} onClick={registrar} className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent hover:opacity-90 disabled:opacity-60">
          Registrar
        </button>
        <button type="button" disabled={ocupado} onClick={() => executar(onDispensar)} className="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-60">
          Não rendeu
        </button>
      </div>
      {erro && (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {erro}
        </p>
      )}
    </li>
  );
}
