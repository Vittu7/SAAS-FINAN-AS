"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Ico, ICONE_ABA } from "@/components/icons";
import { CONCEITOS, PERGUNTAS, TUTORIAIS } from "@/lib/ajuda";

type Sub = "tutoriais" | "perguntas" | "conceitos";
const ROTULO_ABA: Record<string, string> = {
  inicio: "Início", extrato: "Extrato", fatura: "Cartões e Faturas", cartao: "Contas parceladas", contas: "Contas fixas",
  graficos: "Gráficos e relatórios", investimentos: "Investimentos", ajustes: "Configurações",
};
const norm = (s: string) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Central de ajuda: tutoriais passo a passo, perguntas frequentes e conceitos básicos. */
export default function TelaAjuda({ foco, onIrPara, onRever }: { foco?: string | null; onIrPara: (aba: string) => void; onRever: () => void }) {
  const [sub, setSub] = useState<Sub>("tutoriais");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(foco ?? null);
  const focoRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!foco) return;
    setSub("tutoriais");
    setAberto(foco);
    setTimeout(() => focoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, [foco]);

  const q = norm(busca.trim());
  const tutoriais = useMemo(() => TUTORIAIS.filter((t) => !q || norm(`${t.titulo} ${t.resumo} ${t.passos.join(" ")}`).includes(q)), [q]);
  const perguntas = useMemo(() => PERGUNTAS.filter((p) => !q || norm(`${p.pergunta} ${p.resposta}`).includes(q)), [q]);
  const conceitos = useMemo(() => CONCEITOS.filter((c) => !q || norm(`${c.titulo} ${c.texto}`).includes(q)), [q]);
  const total = tutoriais.length + perguntas.length + conceitos.length;

  const chip = (a: boolean) => `h-10 flex-1 rounded-full text-sm font-semibold transition sm:flex-none sm:px-5 ${a ? "bg-accent text-on-accent shadow-sm" : "text-muted"}`;

  return (
    <div className="space-y-5">
      <section className="card-glass space-y-3 p-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Ico icon={Search} size={18} /></span>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ajuda (ex.: cartão, parcela, relatório)" aria-label="Buscar na ajuda" className="h-12 w-full rounded-xl border border-line bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div className="flex gap-1 rounded-full bg-background p-1 ring-1 ring-line sm:w-fit" role="tablist" aria-label="Seções da ajuda">
          <button type="button" role="tab" aria-selected={sub === "tutoriais"} onClick={() => setSub("tutoriais")} className={chip(sub === "tutoriais")}>Tutoriais</button>
          <button type="button" role="tab" aria-selected={sub === "perguntas"} onClick={() => setSub("perguntas")} className={chip(sub === "perguntas")}>Perguntas</button>
          <button type="button" role="tab" aria-selected={sub === "conceitos"} onClick={() => setSub("conceitos")} className={chip(sub === "conceitos")}>Conceitos</button>
        </div>
        {q && total === 0 && <p className="text-sm text-muted">Nada encontrado para “{busca}”. Tente outra palavra.</p>}
      </section>

      {sub === "tutoriais" && (
        <ul className="anim-stagger space-y-3">
          {tutoriais.map((t) => {
            const ativo = aberto === t.id;
            return (
              <li key={t.id} ref={ativo ? focoRef : undefined} className="card-glass overflow-hidden">
                <button type="button" onClick={() => setAberto(ativo ? null : t.id)} aria-expanded={ativo} className="flex w-full items-center gap-3 p-4 text-left">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent"><Ico icon={ICONE_ABA[t.aba] ?? ICONE_ABA.inicio} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.titulo}</span>
                    <span className="block text-xs text-muted">{t.resumo}</span>
                  </span>
                  <span className={`text-muted transition-transform duration-200 ${ativo ? "rotate-180" : ""}`}><Ico icon={ChevronDown} size={18} /></span>
                </button>
                {ativo && (
                  <div className="anim-fade space-y-3 border-t border-line px-4 pb-4 pt-3">
                    <ol className="space-y-2">
                      {t.passos.map((p, i) => (
                        <li key={p} className="flex items-start gap-3 text-sm">
                          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent">{i + 1}</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                    {t.dicas?.map((d) => <p key={d} className="rounded-xl bg-accent/8 px-3 py-2 text-xs text-muted">💡 {d}</p>)}
                    <button type="button" onClick={() => onIrPara(t.aba)} className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">Abrir {ROTULO_ABA[t.aba] ?? "módulo"}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sub === "perguntas" && (
        <ul className="anim-stagger space-y-2">
          {perguntas.map((p) => (
            <li key={p.id} className="card-glass">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-semibold marker:hidden">
                  {p.pergunta}
                  <span className="text-muted transition-transform duration-200 group-open:rotate-180"><Ico icon={ChevronDown} size={18} /></span>
                </summary>
                <div className="space-y-3 px-4 pb-4 text-sm text-muted">
                  <p>{p.resposta}</p>
                  {p.aba && <button type="button" onClick={() => onIrPara(p.aba!)} className="text-sm font-medium text-accent hover:underline">Ir para {ROTULO_ABA[p.aba]}</button>}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {sub === "conceitos" && (
        <div className="anim-stagger grid gap-3 sm:grid-cols-2">
          {conceitos.map((c) => (
            <div key={c.titulo} className="card-glass p-4">
              <p className={`text-sm font-bold ${c.tom === "entrada" ? "text-emerald-700 dark:text-emerald-400" : c.tom === "saida" ? "text-rose-700 dark:text-rose-400" : ""}`}>{c.titulo}</p>
              <p className="mt-1 text-sm text-muted">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      <section className="card-glass flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Quer rever a apresentação inicial?</p>
          <p className="text-xs text-muted">Mostra de novo as boas-vindas, o guia de primeiros passos e as dicas de cada módulo.</p>
        </div>
        <button type="button" onClick={onRever} className="h-10 shrink-0 rounded-xl border border-line px-4 text-sm font-medium hover:bg-background">Rever orientações</button>
      </section>
    </div>
  );
}
