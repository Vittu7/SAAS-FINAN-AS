"use client";

import { ResponsavelChip } from "@/components/Avatar";
import { ArrowRight, ChevronDown, Pencil, Plus, Settings2, Trash2, Users, X } from "lucide-react";
import { ICONE_ABA, Ico } from "@/components/icons";
import MobileLista from "@/components/mobile/MobileLista";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor, pct } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";
import { useOpcoes, type Opcao } from "@/lib/useOpcoes";
import { SeletorOpcao, Selo } from "@/components/SeletorOpcao";
import EditarLancamentoModal from "@/components/EditarLancamentoModal";
import { calcularFatura } from "@/lib/faturas";
import type { Estado } from "@/lib/types";

// O cadastro foi centralizado em "Nova transação" (botão +). O formulário antigo fica oculto aqui.
const ESCONDER_CADASTRO = true;
// Cartões e limites agora ficam só em "Cartões e Faturas".
const ESCONDER_CARTOES = true;

export default function CartaoTable({
  estado,
  mes,
  itens,
  onAdd,
  onRemove,
  onEdit,
}: {
  /** Base completa do grupo: a fatura de cada cartão soma todos os lançamentos, sem filtros de tela. */
  estado?: Estado;
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
  const [membrosCompartilhamento, setMembrosCompartilhamento] = useState<{ id: string; nome: string }[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [visivelPara, setVisivelPara] = useState("privado");
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
      .select("id, grupo_id, nome_usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) return;

    const nomeReal = perfil.nome_usuario || "Usuário";
    setMeuNome(nomeReal);
    setGrupoId(perfil.grupo_id || "");
    setResponsaveisSelecionados((prev) => (prev.length > 0 ? prev : [nomeReal]));

    if (perfil.grupo_id) {
      const { data } = await supabase.from("perfis").select("id, nome_usuario").eq("grupo_id", perfil.grupo_id);
      if (data) {
        const nomes = data.map((m) => m.nome_usuario).filter(Boolean);
        setMembros(nomes.length > 0 ? nomes : [nomeReal]);
        setMembrosCompartilhamento(data.filter((m) => m.id !== perfil.id && m.nome_usuario).map((m) => ({ id: m.id, nome: m.nome_usuario || "Membro" })));
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
          privado: visivelPara === "privado",
          compartilhado_com: visivelPara === "grupo" ? grupoId || null : visivelPara !== "privado" ? visivelPara : null,
        },
        gerarSeguintes
      );
    });

    setValorTexto("");
    setDescricao("");
    setParcelaAtual(1);
    setParcelaTotal(1);
    setVisivelPara("privado");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  // Cálculo e agrupamento de limites para os cartões cadastrados
  const cartoesComLimite = pagamento
    .filter((f: Opcao) => f.eh_cartao)
    .map((cartaoItem: Opcao) => {
      const limite = Number(cartaoItem.limite) || 0;
      const totalUtilizado = estado
        ? calcularFatura(estado, cartaoItem.nome, mes, limite).total
        : itens
            .filter((c) => (c.cartao || "").toLowerCase() === cartaoItem.nome.toLowerCase())
            .reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);
      const disponivel = limite - totalUtilizado;

      return {
        ...cartaoItem,
        totalUtilizado,
        disponivel,
      };
    });

  return (
    <div className="space-y-6 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6 md:shadow-lg">
      {/* CARROSSEL DE CARTÕES */}
      {!ESCONDER_CARTOES && cartoesComLimite.length > 0 && (
        <section aria-label="Resumo dos cartões">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Cartões
              </p>
              <h2 className="mt-1 text-base font-semibold text-ink">
                Faturas e limites
              </h2>
            </div>

            <span className="inline-flex items-center gap-1 text-xs text-muted">
              Deslize para ver mais <Ico icon={ArrowRight} size={14} />
            </span>
          </div>

          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-webkit-overflow-scrolling:touch]">
            {cartoesComLimite.map((cartaoItem: any) => {
              const limite = Number(cartaoItem.limite || 0);
              const faturaAtual = Number(cartaoItem.totalUtilizado || 0);
              const limiteDisponivel = Math.max(
                0,
                Number(cartaoItem.disponivel || 0),
              );

              const porcentagemUso =
                limite > 0
                  ? Math.min(100, (faturaAtual / limite) * 100)
                  : 0;

              const corCartao =
                cartaoItem.cor || corPagamento(cartaoItem.nome);

              return (
                <article
                  key={cartaoItem.id || cartaoItem.nome}
                  className="min-w-[17rem] snap-start overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:min-w-[19rem]"
                  style={{
                    background: `linear-gradient(135deg, ${corCartao}, #0f172a)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {cartaoItem.nome}
                      </p>
                      <p className="mt-1 text-xs text-white/70">
                        Cartão de crédito
                      </p>
                    </div>

                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">
                      {pct(porcentagemUso, 0)} usado
                    </span>
                  </div>

                  <div className="mt-7">
                    <p className="text-xs font-medium text-white/70">
                      Fatura atual
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">
                      {brl(faturaAtual)}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-white/70">Limite total</p>
                      <p className="mt-1 text-sm font-semibold">
                        {brl(limite)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-white/70">Disponível</p>
                      <p className="mt-1 text-sm font-semibold">
                        {brl(limiteDisponivel)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="h-2 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-[width] duration-300"
                        style={{ width: `${porcentagemUso}%` }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs text-white/75">
                      <span>Uso do limite</span>
                      <span>{pct(porcentagemUso, 1)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
{!ESCONDER_CADASTRO && (<>
      <button
        type="button"
        onClick={() => setFormAberto((a) => !a)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-on-accent active:scale-[0.98] md:hidden"
      >
        {formAberto ? <><Ico icon={X} size={18} />Fechar formulário</> : <><Ico icon={Plus} size={18} />Adicionar novo</>}
      </button>

      {/* FORMULÁRIO */}
      <form
        onSubmit={handleAdicionar}
        className={`${formAberto ? "grid" : "hidden"
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
              <span className="inline-flex items-center gap-1"><Ico icon={Settings2} size={12} />Editar</span>
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
              <span className="inline-flex items-center gap-1"><Ico icon={Settings2} size={12} />Editar</span>
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
            <Ico icon={ChevronDown} size={16} className="text-muted" />
          </button>

          {menuResponsavelAberto && (
            <div className="absolute z-30 top-full mt-1 right-0 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl space-y-1">
              {membros.length > 1 && (
                <button
                  type="button"
                  onClick={selecionarTodos}
                  className="w-full text-left text-xs px-2 py-1.5 font-bold text-accent border-b border-line mb-1 hover:bg-background/50 rounded"
                >
                  {responsaveisSelecionados.length === membros.length ? "Desmarcar Todos" : <span className="inline-flex items-center gap-1.5"><Ico icon={Users} size={14} />Marcar Todos</span>}
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
          <label className="mb-1 block text-xs font-medium text-muted">Quem pode ver?</label>
          <select value={visivelPara} onChange={(e) => setVisivelPara(e.target.value)} className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent">
            <option value="privado">Só eu</option>
            <option value="grupo" disabled={!grupoId}>Todo o grupo</option>
            {membrosCompartilhamento.map((membro) => <option key={membro.id} value={membro.id}>Só eu e {membro.nome}</option>)}
          </select>
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
</>)}


      {/* EXIBIÇÃO MOBILE */}
      <MobileLista
        vazio="Nenhuma conta parcelada neste mês."
        itens={itens.map((item: any) => ({
          id: item.id,
          titulo: item.descricao || item.nome || "Sem descrição",
          subtitulo: [item.cartao, item.categoria].filter(Boolean).join(" · "),
          valor: item.valor,
          icone: ICONE_ABA.cartao,
          pessoa: { nome: item.responsavel, avatar: item.responsavelAvatar, cor: item.responsavelCor }, 
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
                  <ResponsavelChip nome={item.responsavel} cor={item.responsavelCor} avatar={item.responsavelAvatar} />
                </td>
                <td className="py-3 text-right font-bold">{brl(item.valor)}</td>
                <td className="py-3 text-center">
                  {onEdit && (
                    <button type="button" onClick={() => setEditando(item)} className="mr-3 text-xs text-accent hover:underline">
                      <span className="inline-flex items-center gap-1"><Ico icon={Pencil} size={13} />Editar</span>
                    </button>
                  )}
                  <button onClick={() => onRemove(item.id)} className="text-xs text-red-400 hover:text-red-300">
                    <span className="inline-flex items-center gap-1"><Ico icon={Trash2} size={13} />Remover</span>
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