"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";
import { useOpcoes } from "@/lib/useOpcoes";
import { SeletorOpcao, Selo } from "@/components/SeletorOpcao";
import EditarLancamentoModal from "@/components/EditarLancamentoModal";

export default function CartaoTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onEdit,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any, gerarSeguintes: boolean) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string, patch: Record<string, any>) => Promise<boolean | void>;
}) {
  // "cartao" guarda a forma de pagamento escolhida (nome do campo no banco continua "cartao")
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

  // Listas compartilhadas (as mesmas do Extrato e das Contas Fixas), já com as cores
  const { pagamento, categoria: opcoesCategoria, recarregar, corPagamento, corCategoria } = useOpcoes();
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | null>(null);
  const [editando, setEditando] = useState<any | null>(null);

  // Seleciona a primeira forma de pagamento quando a lista chega
  useEffect(() => {
    if (!cartao && pagamento.length > 0) {
      setCartao(pagamento[0].nome);
    }
  }, [pagamento, cartao]);

  const carregarMembros = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) return;

    const nomeReal = perfil.nome_usuario || "Usuário";
    setMeuNome(nomeReal);
    setResponsaveisSelecionados((prev) => (prev.length > 0 ? prev : [nomeReal]));

    if (perfil.grupo_id) {
      const { data } = await supabase.from("perfis").select("nome_usuario").eq("grupo_id", perfil.grupo_id);
      if (data) {
        const nomes = data.map((m) => m.nome_usuario).filter(Boolean);
        setMembros(nomes.length > 0 ? nomes : [nomeReal]);
      }
    }
  }, []);

  useEffect(() => {
    carregarMembros();
  }, [carregarMembros]);

  const alternarResponsavel = (nome: string) => {
    setResponsaveisSelecionados((prev) =>
      prev.includes(nome)
        ? prev.length > 1
          ? prev.filter((item) => item !== nome)
          : prev
        : [...prev, nome]
    );
  };

  const selecionarTodos = () => {
    setResponsaveisSelecionados(
      responsaveisSelecionados.length === membros.length ? [meuNome || "Usuário"] : [...membros]
    );
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
          cartao: cartao || "Forma de Pagamento",
          categoria: categoria || "Outros",
          valor: valorIndividual,
          descricao: qtd > 1 ? `${descricao} (1/${qtd})` : descricao,
          parcelaAtual: Number(parcelaAtual) || 1,
          parcelaTotal: Number(parcelaTotal) || 1,
          responsavel: resp,
        },
        gerarSeguintes
      );
    });

    setValorTexto("");
    setDescricao("");
    setParcelaAtual(1);
    setParcelaTotal(1);
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4 md:p-6 shadow-sm md:shadow-lg space-y-4">
      {/* Formulário otimizado com grid responsivo de 12 colunas para ajuste perfeito em telas menores e com zoom */}
      <form id="form-parcelas" onSubmit={handleAdicionar} className="scroll-mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
        {/* FORMA DE PAGAMENTO (Ocupa 2 colunas em telas grandes) */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Forma de Pagamento</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("pagamento")}
              className="shrink-0 whitespace-nowrap text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <SeletorOpcao opcoes={pagamento} valor={cartao} onChange={setCartao} />
        </div>

        {/* CATEGORIA (Ocupa 2 colunas) */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Categoria</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("categoria")}
              className="shrink-0 whitespace-nowrap text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <SeletorOpcao opcoes={opcoesCategoria} valor={categoria} onChange={setCategoria} />
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
              className="w-full rounded-xl border border-line bg-background text-ink px-1 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <div className="w-1/2">
            <label className="text-xs font-medium text-muted block mb-1">Tot</label>
            <input
              type="number"
              min="1"
              value={parcelaTotal}
              onChange={(e) => setParcelaTotal(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-background text-ink px-1 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

      {/* Cartões compactos para celular */}
      <div className="space-y-3 md:hidden">
        {itens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">Nenhuma parcela neste mês</p>
            <p className="mt-1 text-xs text-muted">Cadastre uma compra no formulário acima.</p>
          </div>
        ) : itens.map((item) => (
          <article key={item.id} className="rounded-2xl border border-line bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{item.descricao}</p>
                <p className="mt-1 text-xs text-muted">Parcela {item.parcelaAtual}/{item.parcelaTotal}</p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums text-ink">{brl(item.valor)}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Selo nome={item.cartao || "Forma de Pagamento"} cor={corPagamento(item.cartao)} />
              {item.categoria && <Selo nome={item.categoria} cor={corCategoria(item.categoria)} />}
              <Selo nome={item.responsavel || "Membro"} cor={item.responsavelCor} />
            </div>
            <div className="mt-3 flex justify-end gap-4 border-t border-line/60 pt-3">
              {onEdit && <button type="button" onClick={() => setEditando(item)} className="text-xs font-semibold text-accent">Editar</button>}
              <button type="button" onClick={() => onRemove(item.id)} className="text-xs font-semibold text-red-400">Remover</button>
            </div>
          </article>
        ))}
      </div>

      {/* Tabela completa no desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-xs text-muted">
            <th className="py-2">Forma de Pagamento</th><th className="py-2">Categoria</th><th className="py-2">Descrição</th><th className="py-2">Parcela</th><th className="py-2">Responsável</th><th className="py-2 text-right">Valor Parcela</th><th className="py-2 text-center">Ações</th>
          </tr></thead>
          <tbody>{itens.map((item) => (
            <tr key={item.id} className="border-b border-line/40 last:border-0 hover:bg-background/30">
              <td className="py-3 font-medium"><Selo nome={item.cartao || "Forma de Pagamento"} cor={corPagamento(item.cartao)} /></td>
              <td className="py-3">{item.categoria ? <Selo nome={item.categoria} cor={corCategoria(item.categoria)} /> : "-"}</td>
              <td className="py-3">{item.descricao}</td><td className="py-3 text-xs text-muted">{item.parcelaAtual}/{item.parcelaTotal}</td>
              <td className="py-3"><Selo nome={item.responsavel || "Membro"} cor={item.responsavelCor} /></td><td className="py-3 text-right font-bold">{brl(item.valor)}</td>
              <td className="py-3 text-center">{onEdit && <button type="button" onClick={() => setEditando(item)} className="mr-3 text-xs text-accent hover:underline">Editar</button>}<button type="button" onClick={() => onRemove(item.id)} className="text-xs text-red-400 hover:text-red-300">Remover</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* MODAL DE GERENCIAMENTO DE OPÇÕES */}
      {editando && onEdit && (
        <EditarLancamentoModal
          tipo="cartao"
          item={editando}
          membros={membros}
          onSalvar={(patch) => onEdit(editando.id, patch)}
          onClose={() => setEditando(null)}
        />
      )}

      {modalOpcaoAberto && (
        <GerenciarOpcoesModal
          tipo={modalOpcaoAberto}
          onClose={() => setModalOpcaoAberto(null)}
          onAtualizar={recarregar}
        />
      )}
    </div>
  );
}