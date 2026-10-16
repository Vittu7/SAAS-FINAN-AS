"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/finance";
import { useOpcoes, COR_PADRAO } from "@/lib/useOpcoes";

const CORES_PADRAO = ["#10B981", "#6366F1", "#F59E0B", "#EC4899", "#8B5CF6", "#3B82F6", "#14B8A6", "#F97316"];

interface Membro {
  id: string;
  nome: string;
  cor: string;
}

type Visao = "pessoa" | "cartao" | "categoria";

const VISOES: { id: Visao; rotulo: string; descricao: string }[] = [
  { id: "pessoa", rotulo: "Por pessoa", descricao: "Quanto cada pessoa do grupo gastou." },
  { id: "cartao", rotulo: "Por cartão", descricao: "Total gasto em cada cartão de crédito." },
  { id: "categoria", rotulo: "Por categoria", descricao: "Para onde o dinheiro foi." },
];

type Fatia = { id: string; nome: string; valor: number; cor: string; limite?: number | null; editavel?: boolean };

export default function ResponsavelPanel({
  resumo,
  itens,
}: {
  resumo: any;
  itens?: { extrato: any[]; cartao: any[]; contas: any[] };
}) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [visao, setVisao] = useState<Visao>("pessoa");
  const { pagamento, corCategoria, corPagamento } = useOpcoes();

  useEffect(() => {
    carregarMembros();
    const canal = supabase
      .channel("mudancas-perfis")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "perfis" }, () => carregarMembros())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const carregarMembros = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario, cor, id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil?.grupo_id) {
      const { data } = await supabase.from("perfis").select("id, nome_usuario, cor").eq("grupo_id", perfil.grupo_id);
      if (data && data.length > 0) {
        setMembros(data.map((m, idx) => ({ id: m.id, nome: m.nome_usuario || "Membro", cor: m.cor || CORES_PADRAO[idx % CORES_PADRAO.length] })));
      }
    } else if (perfil) {
      setMembros([{ id: perfil.id, nome: perfil.nome_usuario || "Membro", cor: perfil.cor || "#10B981" }]);
    }
  };

  const alterarCor = async (membroId: string, novaCor: string) => {
    setMembros((prev) => prev.map((m) => (m.id === membroId ? { ...m, cor: novaCor } : m)));
    await supabase.from("perfis").update({ cor: novaCor }).eq("id", membroId);
  };

  const fatias: Fatia[] = useMemo(() => {
    if (visao === "pessoa") {
      const lista = membros.length > 0 ? membros : [{ id: "1", nome: "Membro", cor: "#10B981" }];
      return lista.map((m) => ({ id: m.id, nome: m.nome, cor: m.cor, valor: resumo?.porResponsavel?.[m.nome] || 0, editavel: true }));
    }

    const extrato = itens?.extrato || [];
    const cartao = itens?.cartao || [];
    const contas = itens?.contas || [];
    const mapa = new Map<string, number>();
    const somar = (nome: string, valor: number) => mapa.set(nome, (mapa.get(nome) || 0) + (Number(valor) || 0));

    if (visao === "cartao") {
      const nomesCartao = new Set(pagamento.filter((o) => o.eh_cartao).map((o) => o.nome));
      for (const i of cartao) somar(i.cartao || "Cartão", i.valor);
      for (const i of extrato) if (nomesCartao.has(i.pagamento)) somar(i.pagamento, i.valor);
      for (const i of contas) if (nomesCartao.has(i.forma_pagamento)) somar(i.forma_pagamento, i.valor);
      // Cartões cadastrados sem gasto também aparecem, para mostrar o limite livre
      for (const n of nomesCartao) if (!mapa.has(n)) mapa.set(n, 0);
      return [...mapa.entries()]
        .map(([nome, valor]) => {
          const opcao = pagamento.find((o) => o.nome === nome);
          return { id: nome, nome, valor, cor: opcao?.cor || corPagamento(nome), limite: opcao?.limite ?? null };
        })
        .sort((a, b) => b.valor - a.valor);
    }

    for (const i of [...extrato, ...cartao, ...contas]) somar(i.categoria || "Sem categoria", i.valor);
    return [...mapa.entries()]
      .map(([nome, valor]) => ({ id: nome, nome, valor, cor: corCategoria(nome) || COR_PADRAO }))
      .sort((a, b) => b.valor - a.valor);
  }, [visao, membros, resumo, itens, pagamento, corCategoria, corPagamento]);

  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const raio = 40;
  const circ = 2 * Math.PI * raio;
  let acumulado = 0;

  const indice = VISOES.findIndex((v) => v.id === visao);
  const mover = (d: number) => setVisao(VISOES[(indice + d + VISOES.length) % VISOES.length].id);
  const atual = VISOES[indice];

  return (
    <div id="graficos" className="card-glass space-y-4 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">Divisão de gastos</h3>
          <p className="text-xs text-muted">{atual.descricao}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => mover(-1)} aria-label="Gráfico anterior" className="grid size-8 place-items-center rounded-full border border-line text-muted transition hover:border-accent hover:text-accent">‹</button>
          <button type="button" onClick={() => mover(1)} aria-label="Próximo gráfico" className="grid size-8 place-items-center rounded-full border border-line text-muted transition hover:border-accent hover:text-accent">›</button>
        </div>
      </div>

      <div role="tablist" aria-label="Tipo de gráfico" className="grid grid-cols-3 gap-1 rounded-full bg-background p-1 ring-1 ring-line">
        {VISOES.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={visao === v.id}
            onClick={() => setVisao(v.id)}
            className={`rounded-full px-2 py-1.5 text-xs font-medium transition ${visao === v.id ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {v.rotulo}
          </button>
        ))}
      </div>

      <div className="relative my-2 flex items-center justify-center py-2">
        <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90">
          <circle cx="50" cy="50" r={raio} fill="transparent" stroke="currentColor" strokeWidth="12" className="text-line/40" />
          {total > 0 &&
            fatias.map((f) => {
              if (f.valor <= 0) return null;
              const tramo = (f.valor / total) * circ;
              const offset = -acumulado;
              acumulado += tramo;
              return (
                <circle key={f.id} cx="50" cy="50" r={raio} fill="transparent" stroke={f.cor} strokeWidth="12"
                  strokeDasharray={`${tramo} ${circ - tramo}`} strokeDashoffset={offset} className="transition-all duration-500" />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Total</span>
          <span className="text-sm font-bold text-ink">{brl(total)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {fatias.length === 0 && <p className="py-4 text-center text-xs text-muted">{visao === "cartao" ? "Marque formas de pagamento como cartão de crédito para vê-las aqui." : "Sem gastos neste mês."}</p>}
        {fatias.map((f) => {
          const pct = total > 0 ? Math.round((f.valor / total) * 100) : 0;
          const usoLimite = f.limite ? Math.min(100, (f.valor / f.limite) * 100) : null;
          return (
            <div key={f.id} className="border-b border-line/50 py-1 text-sm last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {f.editavel ? (
                    <div className="relative h-3.5 w-3.5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line shadow-sm transition hover:scale-125" style={{ backgroundColor: f.cor }} title={`Alterar a cor de ${f.nome}`}>
                      <input type="color" value={f.cor} onChange={(e) => alterarCor(f.id, e.target.value)} className="absolute -inset-2 h-8 w-8 cursor-pointer opacity-0" />
                    </div>
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
                  )}
                  <span className="truncate text-xs font-medium uppercase tracking-wide">{f.nome}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-bold tabular-nums">{brl(f.valor)}</span>
                  <span className="w-8 text-right text-xs text-muted">{pct}%</span>
                </div>
              </div>
              {usoLimite !== null && (
                <div className="mt-1.5 pl-5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-line/60">
                    <div className={`h-full rounded-full ${usoLimite >= 90 ? "bg-rose-500" : "bg-accent"}`} style={{ width: `${usoLimite}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {brl(f.valor)} de {brl(f.limite)} · livre {brl(Math.max(0, (f.limite || 0) - f.valor))}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-2 text-sm font-bold">
        <span>Total do mês</span>
        <span>{brl(total)}</span>
      </div>
    </div>
  );
}
