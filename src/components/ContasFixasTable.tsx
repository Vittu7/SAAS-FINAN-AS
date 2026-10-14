"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";

export default function ContasFixasTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onTogglePago,
  onCopiarMesAnterior,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any) => void;
  onRemove: (id: string) => void;
  onTogglePago: (id: string) => void;
  onCopiarMesAnterior: () => void;
}) {
  const [nome, setNome] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [vencimento, setVencimento] = useState("");

  const [membros, setMembros] = useState<string[]>([]);
  const [meuNome, setMeuNome] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [menuResponsavelAberto, setMenuResponsavelAberto] = useState(false);

  useEffect(() => {
    carregarMembrosDoGrupo();
  }, []);

  const carregarMembrosDoGrupo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil) {
      const nomeReal = perfil.nome_usuario || "Usuário";
      setMeuNome(nomeReal);
      setResponsaveisSelecionados([nomeReal]);

      if (perfil.grupo_id) {
        const { data: lista } = await supabase
          .from("perfis")
          .select("nome_usuario")
          .eq("grupo_id", perfil.grupo_id);

        if (lista && lista.length > 0) {
          const nomes = lista.map((m) => m.nome_usuario).filter(Boolean);
          setMembros(nomes);
        } else {
          setMembros([nomeReal]);
        }
      } else {
        setMembros([nomeReal]);
      }
    }
  };

  const alternarResponsavel = (n: string) => {
    setResponsaveisSelecionados((prev) => {
      if (prev.includes(n)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== n);
      } else {
        return [...prev, n];
      }
    });
  };

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = parseValor(valorTexto);
    if (!valorTotal || !nome.trim()) return;

    const qtd = responsaveisSelecionados.length;
    const valorIndividual = valorTotal / qtd;

    responsaveisSelecionados.forEach((resp) => {
      onAdd({
        mes,
        nome: qtd > 1 ? `${nome} (1/${qtd})` : nome,
        valor: valorIndividual,
        vencimento,
        pago: false,
        responsavel: resp,
      });
    });

    setNome("");
    setValorTexto("");
    setVencimento("");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 shadow-lg space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-muted">Contas Recorrentes do Mês</h3>
        <button
          onClick={onCopiarMesAnterior}
          className="text-xs bg-surface border border-line hover:bg-background px-3 py-1.5 rounded-xl transition"
        >
          📋 Copiar Contas do Mês Anterior
        </button>
      </div>

      <form onSubmit={handleAdicionar} className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Nome da Conta</label>
          <input
            type="text"
            placeholder="Ex: Energia, Internet"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Valor (R$)</label>
          <input
            type="text"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Vencimento</label>
          <input
            type="text"
            placeholder="Dia (ex: 10)"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* SELETOR MULTIPLO DE RESPONSÁVEIS */}
        <div className="relative">
          <label className="text-xs font-medium text-muted block mb-1">Responsável(is)</label>
          <button
            type="button"
            onClick={() => setMenuResponsavelAberto(!menuResponsavelAberto)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-xs font-medium text-left truncate flex items-center justify-between outline-none"
          >
            <span>
              {responsaveisSelecionados.length === 1
                ? responsaveisSelecionados[0]
                : `${responsaveisSelecionados.length} selecionados`}
            </span>
            <span className="text-xs text-muted">▾</span>
          </button>

          {menuResponsavelAberto && (
            <div className="absolute z-30 top-full mt-1 left-0 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl space-y-1">
              <div className="max-h-36 overflow-y-auto space-y-1">
                {membros.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-background cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={responsaveisSelecionados.includes(m)}
                      onChange={() => alternarResponsavel(m)}
                      className="rounded border-line text-accent focus:ring-accent"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-accent text-on-accent h-9 rounded-xl font-medium text-sm hover:opacity-90 transition"
        >
          Adicionar
        </button>
      </form>

      {/* TABELA DE EXIBIÇÃO */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2">Status</th>
              <th className="py-2">Conta</th>
              <th className="py-2">Vencimento</th>
              <th className="py-2">Responsável</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-line/40 last:border-0 hover:bg-background/30">
                <td className="py-3">
                  <button
                    onClick={() => onTogglePago(item.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      item.pago
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {item.pago ? "✓ Pago" : "Pendente"}
                  </button>
                </td>
                <td className="py-3 font-medium">{item.nome}</td>
                <td className="py-3 text-xs text-muted">{item.vencimento ? `Dia ${item.vencimento}` : "-"}</td>
                <td className="py-3">
                  <span className="bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded text-xs">
                    {item.responsavel || "Membro"}
                  </span>
                </td>
                <td className="py-3 text-right font-bold">{brl(item.valor)}</td>
                <td className="py-3 text-center">
                  <button onClick={() => onRemove(item.id)} className="text-xs text-red-400 hover:text-red-300">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}