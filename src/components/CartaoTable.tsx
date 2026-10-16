"use client";

import MobileLista from "@/components/mobile/MobileLista";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";
import { useOpcoes, type Opcao } from "@/lib/useOpcoes";
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

  const { pagamento, categoria: opcoesCategoria, recarregar, corPagamento, corCategoria } = useOpcoes();
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

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

  // Cálculo e agrupamento de limites para os cartões cadastrados
  const cartoesComLimite = pagamento
    .filter((f: Opcao) => f.eh_cartao)
    .map((cartaoItem: Opcao) => {
      const lancamentosDoCartao = itens.filter(
        (c) => (c.cartao || "").toLowerCase() === cartaoItem.nome.toLowerCase()
      );
      const totalUtilizado = lancamentosDoCartao.reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
      const limite = Number(cartaoItem.limite) || 0;
      const disponivel = limite - totalUtilizado;

      return {
        ...cartaoItem,
        totalUtilizado,
        disponivel,
      };
    });

  return (
    <div className="space-y-6 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6 md:shadow-lg">
      {/* PAINEL RESUMO DE LIMITES */}
      {cartoesComLimite.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cartoesComLimite.map((c: any) => {
            const limite = c.limite || 0;
            const porcentagemUso = limite > 0 ? Math.min(100, (c.totalUtilizado / limite) * 100) : 0;

            return (
              <div
                key={c.id || c.nome}
                className="p-4 rounded-2xl border border-line bg-background/50 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Selo nome={c.nome} cor={corPagamento(c.nome)} />
                  </div>
                  <span className="text-xs font-semibold text-muted">
                    {porcentagemUso.toFixed(0)}% usado
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Fatura Atual:</span>
                    <span className="font-bold text-red-400">{brl(c.totalUtilizado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Limite Total:</span>
                    <span className="font-medium text-ink">{brl(limite)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Disponível:</span>
                    <span className="font-medium text-accent">{brl(c.disponivel)}</span>
                  </div>
                </div>

                <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      porcentagemUso > 90
                        ? "bg-red-500"
                        : porcentagemUso > 70
                        ? "bg-amber-500"
                        : "bg-accent"
                    }`}
                    style={{ width: `${porcentagemUso}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BOTÃO MOBILE DE ADICIONAR */}
      <button
        type="button"
        onClick={() => setFormAberto((a) => !a)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-on-accent active:scale-[0.98] md:hidden"
      >
        {formAberto ? "Fechar formulário" : "＋ Adicionar novo"}
      </button>

      {/* FORMULÁRIO */}
      <form
        onSubmit={handleAdicionar}
        className={`${
          formAberto ? "grid" : "hidden"
        } rounded-2xl bg-surface p-4 ring-1 ring-line md:grid md:rounded-none md:bg-transparent md:p-0 md:ring-0 gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-end`}
      >
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

        <div className="lg:col-span-2">
          <button
            type="submit"
            className="w-full bg-accent text-on-accent h-[38px] rounded-xl font-medium text-sm hover:opacity-90 transition flex items-center justify-center shadow-sm"
          >
            Adicionar
          </button>
        </div>
      </form>

      {/* EXIBIÇÃO MOBILE */}
      <MobileLista
        vazio="Nenhuma conta parcelada neste mês."
        itens={itens.map((item: any) => ({
          id: item.id,
          titulo: item.descricao || item.nome || "Sem descrição",
          subtitulo: [item.cartao, item.categoria].filter(Boolean).join(" · "),
          valor: item.valor,
          icone: "▤",
          tags: [item.cartao, item.categoria, item.responsavel],
          status: { texto: `${item.parcelaAtual ?? 1}/${item.parcelaTotal ?? 1}`, tom: "neutro" as const },
          progresso: ((item.parcelaAtual ?? 1) / Math.max(1, item.parcelaTotal ?? 1)) * 100,
          onEditar: onEdit ? () => setEditando(item) : undefined,
          onRemover: () => onRemove(item.id),
        }))}
      />

      {/* EXIBIÇÃO DESKTOP */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2">Forma de Pagamento</th>
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
                  <Selo nome={item.cartao || "Forma de Pagamento"} cor={corPagamento(item.cartao)} />
                </td>
                <td className="py-3">
                  {item.categoria ? <Selo nome={item.categoria} cor={corCategoria(item.categoria)} /> : "-"}
                </td>
                <td className="py-3">{item.descricao}</td>
                <td className="py-3 text-xs text-muted">
                  {item.parcelaAtual}/{item.parcelaTotal}
                </td>
                <td className="py-3">
                  <Selo nome={item.responsavel || "Membro"} cor={item.responsavelCor} />
                </td>
                <td className="py-3 text-right font-bold">{brl(item.valor)}</td>
                <td className="py-3 text-center">
                  {onEdit && (
                    <button type="button" onClick={() => setEditando(item)} className="mr-3 text-xs text-accent hover:underline">
                      Editar
                    </button>
                  )}
                  <button onClick={() => onRemove(item.id)} className="text-xs text-red-400 hover:text-red-300">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAIS */}
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