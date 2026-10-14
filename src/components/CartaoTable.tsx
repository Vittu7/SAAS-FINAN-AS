"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";

interface Opcao {
  id: string;
  nome: string;
  cor: string;
}

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
  const [cartao, setCartao] = useState("");
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

  // Opções compartilhadas do Supabase
  const [opcoesCartao, setOpcoesCartao] = useState<Opcao[]>([]);
  const [opcoesCategoria, setOpcoesCategoria] = useState<Opcao[]>([]);
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | "cartao" | null>(null);

  const carregarDadosIniciais = useCallback(async () => {
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
        const [resMembros, resCartoes, resCat] = await Promise.all([
          supabase.from("perfis").select("nome_usuario").eq("grupo_id", perfil.grupo_id),
          supabase.from("opcoes_cartao").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
          supabase.from("opcoes_categoria").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
        ]);

        if (resMembros.data) {
          const nomes = resMembros.data.map((m) => m.nome_usuario).filter(Boolean);
          setMembros(nomes.length > 0 ? nomes : [nomeReal]);
        }

        if (resCartoes.data) {
          setOpcoesCartao(resCartoes.data);
          if (resCartoes.data.length > 0 && !cartao) {
            setCartao(resCartoes.data[0].nome);
          }
        }

        if (resCat.data) {
          setOpcoesCategoria(resCat.data);
        }
      }
    }
  }, [cartao]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  const alternarResponsavel = (nome: string) => {
    setResponsaveisSelecionados((prev) =>
      prev.includes(nome)
        ? prev.length > 1 ? prev.filter((item) => item !== nome) : prev
        : [...prev, nome]
    );
  };

  const selecionarTodos = () => {
    setResponsaveisSelecionados(
      responsaveisSelecionados.length === membros.length ? [meuNome || "Usuário"] : [...membros]
    );
  };

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = parseValor(valorTexto);
    if (!valorTotal || !descricao.trim()) {
      alert("Informe uma descrição e um valor válido.");
      return;
    }
    const atual = Math.max(1, Number(parcelaAtual) || 1);
    const total = Math.max(atual, Number(parcelaTotal) || 1);
    const responsaveis = responsaveisSelecionados.length ? responsaveisSelecionados : [meuNome || "Usuário"];
    const valorIndividual = valorTotal / responsaveis.length;
    try {
      for (const resp of responsaveis) {
        await onAdd({
          mes, cartao: cartao || "Cartão", categoria: categoria || "Outros",
          valor: valorIndividual,
          descricao: responsaveis.length > 1 ? `${descricao} (1/${responsaveis.length})` : descricao,
          parcelaAtual: atual, parcelaTotal: total, responsavel: resp,
        }, gerarSeguintes);
      }
      setValorTexto("");
      setDescricao("");
      setParcelaAtual(1);
      setParcelaTotal(1);
      setResponsaveisSelecionados([meuNome || "Usuário"]);
      setMenuResponsavelAberto(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar a compra no cartão.");
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 shadow-lg space-y-4">
      {/* Formulário otimizado com grid responsivo de 12 colunas para ajuste perfeito em telas menores e com zoom */}
      <form onSubmit={handleAdicionar} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-end">
        
        {/* SELETOR DE CARTÃO (Ocupa 2 colunas em telas grandes) */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Cartão</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("cartao")}
              className="text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <select
            value={cartao}
            onChange={(e) => setCartao(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" className="bg-surface text-ink">Selecione...</option>
            {opcoesCartao.map((c) => (
              <option key={c.id} value={c.nome} className="bg-surface text-ink">
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* CATEGORIA (Ocupa 2 colunas) */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Categoria</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("categoria")}
              className="text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" className="bg-surface text-ink">Selecione...</option>
            {opcoesCategoria.map((c) => (
              <option key={c.id} value={c.nome} className="bg-surface text-ink">
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* VALOR DA PARCELA (Ocupa 2 colunas) */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Valor Parcela (R$)</label>
          <input
            type="text"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* DESCRIÇÃO (Ocupa 2 colunas) */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Descrição</label>
          <input
            type="text"
            placeholder="Descrição..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* PARCELAS (Ocupa 1 coluna dividida internamente) */}
        <div className="lg:col-span-1 flex gap-1">
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted block mb-1">Parc</label>
            <input
              type="number"
              min="1"
              value={parcelaAtual}
              onChange={(e) => setParcelaAtual(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-background text-ink px-1 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted block mb-1">Tot</label>
            <input
              type="number"
              min="1"
              value={parcelaTotal}
              onChange={(e) => setParcelaTotal(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-background text-ink px-1 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* RESPONSÁVEL (Ocupa 1 coluna) */}
        <div className="lg:col-span-1 relative">
          <label className="text-xs font-medium text-muted block mb-1">Resp.</label>
          <button
            type="button"
            onClick={() => setMenuResponsavelAberto(!menuResponsavelAberto)}
            className="w-full rounded-xl border border-line bg-background text-ink px-2 py-2 text-xs font-medium text-left truncate flex items-center justify-between outline-none focus:ring-2 focus:ring-accent"
          >
            <span className="truncate">
              {responsaveisSelecionados.length === 1
                ? responsaveisSelecionados[0]
                : `${responsaveisSelecionados.length}`}
            </span>
            <span className="text-xs text-muted">▾</span>
          </button>

          {menuResponsavelAberto && (
            <div className="absolute z-30 top-full mt-1 right-0 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl space-y-1">
              {membros.length > 1 && (
                <button
                  type="button"
                  onClick={selecionarTodos}
                  className="w-full text-left text-xs px-2 py-1.5 font-bold text-accent border-b border-line mb-1 hover:bg-background/50 rounded"
                >
                  {responsaveisSelecionados.length === membros.length ? "Desmarcar Todos" : "👥 Marcar Todos"}
                </button>
              )}

              <div className="max-h-36 overflow-y-auto space-y-1">
                {membros.map((nome) => (
                  <label
                    key={nome}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-background cursor-pointer select-none text-ink"
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

        {/* BOTÃO ADICIONAR (Ocupa 2 colunas no desktop, alinhado perfeitamente na linha) */}
        <div className="lg:col-span-2">
          <button
            type="submit"
            className="w-full bg-accent text-on-accent h-[38px] rounded-xl font-medium text-sm hover:opacity-90 transition flex items-center justify-center shadow-sm"
          >
            Adicionar
          </button>
        </div>

      </form>

      {/* TABELA DE EXIBIÇÃO */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2">Cartão</th>
              <th className="py-2">Categoria</th>
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
                <td className="py-3 font-medium">
                  <span className="bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded text-xs">
                    {item.cartao || "Cartão"}
                  </span>
                </td>
                <td className="py-3 text-muted">{item.categoria || "-"}</td>
                <td className="py-3">{item.descricao}</td>
                <td className="py-3 text-xs text-muted">
                  {item.parcelaAtual}/{item.parcelaTotal}
                </td>
                <td className="py-3">
                  <span className="bg-background border border-line font-medium px-2 py-0.5 rounded text-xs text-ink">
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

      {/* MODAL DE GERENCIAMENTO DE OPÇÕES */}
      {modalOpcaoAberto && (
        <GerenciarOpcoesModal
          tipo={modalOpcaoAberto}
          onClose={() => setModalOpcaoAberto(null)}
          onAtualizar={carregarDadosIniciais}
        />
      )}
    </div>
  );
}