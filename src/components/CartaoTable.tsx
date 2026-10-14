"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";

export default function CartaoTable({
  mes,
  itens,
  onAdd,
  onRemove,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any, gerarSeguintes: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const [cartao, setCartao] = useState("Cartão de Crédito");
  const [categoria, setCategoria] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState(1);
  const [parcelaTotal, setParcelaTotal] = useState(1);
  const [gerarSeguintes, setGerarSeguintes] = useState(true);

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

  const alternarResponsavel = (nome: string) => {
    setResponsaveisSelecionados((prev) => {
      if (prev.includes(nome)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== nome);
      } else {
        return [...prev, nome];
      }
    });
  };

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = parseValor(valorTexto);
    if (!valorTotal || !descricao.trim()) return;

    const qtd = responsaveisSelecionados.length;
    const valorIndividual = valorTotal / qtd;

    responsaveisSelecionados.forEach((resp) => {
      onAdd(
        {
          mes,
          cartao,
          categoria,
          valor: valorIndividual,
          descricao: qtd > 1 ? `${descricao} (1/${qtd})` : descricao,
          parcelaAtual: Number(parcelaAtual),
          parcelaTotal: Number(parcelaTotal),
          responsavel: resp,
        },
        gerarSeguintes
      );
    });

    setCategoria("");
    setValorTexto("");
    setDescricao("");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 shadow-lg space-y-4">
      <form onSubmit={handleAdicionar} className="grid gap-3 sm:grid-cols-2 md:grid-cols-6 items-end">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Cartão</label>
          <input
            type="text"
            value={cartao}
            onChange={(e) => setCartao(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Valor da Parcela (R$)</label>
          <input
            type="text"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Descrição</label>
          <input
            type="text"
            placeholder="Descrição..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex gap-2">
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted block mb-1">Parc. Atual</label>
            <input
              type="number"
              min="1"
              value={parcelaAtual}
              onChange={(e) => setParcelaAtual(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-background px-2 py-2 text-sm outline-none"
            />
          </div>
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted block mb-1">Total Parc.</label>
            <input
              type="number"
              min="1"
              value={parcelaTotal}
              onChange={(e) => setParcelaTotal(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-background px-2 py-2 text-sm outline-none"
            />
          </div>
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
                {membros.map((nome) => (
                  <label
                    key={nome}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-background cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={responsaveisSelecionados.includes(nome)}
                      onChange={() => alternarResponsavel(nome)}
                      className="rounded border-line text-accent focus:ring-accent"
                    />
                    <span>{nome}</span>
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
              <th className="py-2">Cartão</th>
              <th className="py-2">Descrição</th>
              <th className="py-2">Parcela</th>
              <th className="py-2">Responsável</th>
              <th className="py-2 text-right">Valor Parcela</th>
              <th className="py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-line/40 last:border-0 hover:bg-background/30">
                <td className="py-3 font-medium">{item.cartao}</td>
                <td className="py-3">{item.descricao}</td>
                <td className="py-3 text-xs text-muted">
                  {item.parcelaAtual}/{item.parcelaTotal}
                </td>
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