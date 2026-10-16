"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CORES_PADRAO = [
  "#10B981",
  "#6366F1",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#3B82F6",
  "#14B8A6",
  "#F97316",
];

interface Membro {
  id: string;
  nome: string;
  cor: string;
}

export default function ResponsavelPanel({ resumo }: { resumo: any }) {
  const [membros, setMembros] = useState<Membro[]>([]);

  useEffect(() => {
    carregarMembros();

    // Inscrição em tempo real para refletir mudanças do banco (ex: alteração no modal)
    const canal = supabase
      .channel("mudancas-perfis")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "perfis" },
        () => {
          carregarMembros();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const carregarMembros = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario, cor, id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil?.grupo_id) {
      const { data } = await supabase
        .from("perfis")
        .select("id, nome_usuario, cor")
        .eq("grupo_id", perfil.grupo_id);

      if (data && data.length > 0) {
        setMembros(
          data.map((m, idx) => ({
            id: m.id,
            nome: m.nome_usuario || "Membro",
            cor: m.cor || CORES_PADRAO[idx % CORES_PADRAO.length],
          }))
        );
      }
    } else if (perfil) {
      setMembros([
        {
          id: perfil.id,
          nome: perfil.nome_usuario || "Membro",
          cor: perfil.cor || "#10B981",
        },
      ]);
    }
  };

  const alterarCor = async (membroId: string, novaCor: string) => {
    // Atualiza o estado local de imediato para resposta instantânea na interface
    setMembros((prev) =>
      prev.map((m) => (m.id === membroId ? { ...m, cor: novaCor } : m))
    );

    // Salva a nova cor no banco de dados
    await supabase.from("perfis").update({ cor: novaCor }).eq("id", membroId);
  };

  const listaMembros =
    membros.length > 0
      ? membros
      : [{ id: "1", nome: "Membro", cor: "#10B981" }];
  const totalGeral = resumo?.totalGeral || 0;

  const totais = listaMembros.map((item) => {
    const valor = resumo?.porResponsavel?.[item.nome] || 0;
    const percentual =
      totalGeral > 0 ? Math.round((valor / totalGeral) * 100) : 0;

    return {
      id: item.id,
      nome: item.nome,
      valor,
      percentual,
      cor: item.cor,
    };
  });

  const raio = 40;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div id="graficos" className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4 md:p-6">
      <div>
        <h3 className="text-lg font-bold">Divisão de Gastos</h3>
        <p className="text-xs text-muted">
          Extrato, cartão e contas fixas somados.
        </p>
      </div>

      {/* GRÁFICO DONUT / ROSCA */}
      <div className="relative flex justify-center items-center my-4 py-2">
        <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={raio}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="12"
            className="text-line/40"
          />

          {totalGeral > 0 &&
            totais.map((r) => {
              if (r.valor <= 0) return null;
              const tramo = (r.valor / totalGeral) * circunferencia;
              const strokeDasharray = `${tramo} ${circunferencia - tramo}`;
              const strokeDashoffset = -acumulado;
              acumulado += tramo;

              return (
                <circle
                  key={r.nome}
                  cx="50"
                  cy="50"
                  r={raio}
                  fill="transparent"
                  stroke={r.cor}
                  strokeWidth="12"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300"
                />
              );
            })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted font-medium uppercase tracking-wider">
            Total
          </span>
          <span className="text-xs font-bold text-ink">
            {totalGeral.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </div>
      </div>

      {/* LISTA DE MEMBROS COM SELETOR DE COR CIRCULAR E INTERATIVO */}
      <div className="space-y-3">
        {totais.map((r) => (
          <div
            key={r.id + r.nome}
            className="flex items-center justify-between text-sm py-1 border-b border-line/50 last:border-0"
          >
            <div className="flex items-center gap-2">
              {/* Bolinha de cor clicável que abre o seletor */}
              <div
                className="relative h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border border-line shadow-sm cursor-pointer transition hover:scale-125"
                style={{ backgroundColor: r.cor }}
                title={`Clique para alterar a cor de ${r.nome}`}
              >
                <input
                  type="color"
                  value={r.cor}
                  onChange={(e) => alterarCor(r.id, e.target.value)}
                  className="absolute -inset-2 h-8 w-8 cursor-pointer opacity-0"
                />
              </div>

              <span className="font-medium uppercase text-xs tracking-wide">
                {r.nome}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold">
                {r.valor.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
              <span className="text-xs text-muted w-8 text-right">
                {r.percentual}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex justify-between items-center text-sm font-bold border-t border-line">
        <span>Total do mês</span>
        <span>
          {totalGeral.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </span>
      </div>
    </div>
  );
}
