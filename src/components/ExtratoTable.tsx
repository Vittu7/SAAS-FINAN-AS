"use client";

import { ChevronDown, Lock, Pencil, Plus, Settings2, Trash2, Users, X } from "lucide-react";
import { ICONE_ABA, Ico } from "@/components/icons";
import MobileLista from "@/components/mobile/MobileLista";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";
import { useOpcoes } from "@/lib/useOpcoes";
import { SeletorOpcao, Selo } from "@/components/SeletorOpcao";
import EditarLancamentoModal from "@/components/EditarLancamentoModal";

export default function ExtratoTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onEdit,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string, patch: Record<string, any>) => Promise<boolean | void>;
}) {
  const [pagamento, setPagamento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");

  const [membros, setMembros] = useState<string[]>([]);
  const [membrosIds, setMembrosIds] = useState<{ id: string; nome: string }[]>([]);
  const [meuId, setMeuId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  // Padrão privado; "grupo" = todo o grupo; <id> = só eu e essa pessoa.
  const [visivelPara, setVisivelPara] = useState("privado");
  const [meuNome, setMeuNome] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [menuResponsavelAberto, setMenuResponsavelAberto] = useState(false);

  // Listas compartilhadas (as mesmas das Contas Parceladas e das Contas Fixas), já com as cores
  const {
    pagamento: opcoesPagamento,
    categoria: opcoesCategoria,
    recarregar,
    corPagamento,
    corCategoria,
  } = useOpcoes();
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  // Seleciona a primeira forma de pagamento quando a lista chega
  useEffect(() => {
    if (!pagamento && opcoesPagamento.length > 0) {
      setPagamento(opcoesPagamento[0].nome);
    }
  }, [opcoesPagamento, pagamento]);

  const carregarMembros = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMeuId(user.id);

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) return;
    setGrupoId(perfil.grupo_id || "");

    const nomeReal = perfil.nome_usuario || "Usuário";
    setMeuNome(nomeReal);
    setResponsaveisSelecionados((prev) => (prev.length > 0 ? prev : [nomeReal]));

    if (perfil.grupo_id) {
      const { data } = await supabase.from("perfis").select("id, nome_usuario").eq("grupo_id", perfil.grupo_id);
      if (data) {
        setMembrosIds(data.filter((m) => m.nome_usuario).map((m) => ({ id: m.id, nome: m.nome_usuario })));
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
      onAdd({
        mes,
        pagamento: pagamento || "Geral",
        categoria: categoria || "Outros",
        valor: valorIndividual,
        descricao: qtd > 1 ? `${descricao} (1/${qtd})` : descricao,
        responsavel: resp,
        privado: visivelPara === "privado",
        compartilhado_com:
          visivelPara === "grupo"
            ? grupoId || null
            : visivelPara !== "privado"
              ? visivelPara
              : null,
      });
    });

    setValorTexto("");
    setDescricao("");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
    setVisivelPara("privado");
  };

  return (
    <div className="space-y-4 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6 md:shadow-lg">
      <button type="button" onClick={() => setFormAberto((a) => !a)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-on-accent active:scale-[0.98] md:hidden">
        {formAberto ? <><Ico icon={X} size={18} />Fechar formulário</> : <><Ico icon={Plus} size={18} />Adicionar novo</>}
      </button>
      <form onSubmit={handleAdicionar} className={`${formAberto ? "grid" : "hidden"} rounded-2xl bg-surface p-4 ring-1 ring-line md:grid md:rounded-none md:bg-transparent md:p-0 md:ring-0 gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-end`}>
        {/* Forma de Pagamento */}
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
          <SeletorOpcao opcoes={opcoesPagamento} valor={pagamento} onChange={setPagamento} />
        </div>

        {/* Categoria */}
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

        {/* Valor Total */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Valor Total (R$)</label>
          <input
            type="text"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Descrição */}
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

        {/* Responsável */}
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

        {/* Quem pode ver */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Quem pode ver</label>
          <select
            value={visivelPara}
            onChange={(e) => setVisivelPara(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="grupo" disabled={!grupoId}>Todo o grupo</option>
            <option value="privado">Só eu</option>
            {membrosIds.filter((m) => m.id !== meuId).map((m) => (
              <option key={m.id} value={m.id}>Só eu e {m.nome}</option>
            ))}
          </select>
        </div>

        {/* Botão Adicionar */}
        <div className="lg:col-span-1">
          <button
            type="submit"
            className="w-full bg-accent text-on-accent h-[38px] rounded-xl font-medium text-sm hover:opacity-90 transition flex items-center justify-center shadow-sm"
          >
            Adicionar
          </button>
        </div>
      </form>

      <MobileLista vazio="Nenhum lançamento neste mês." itens={itens.map((item: any) => ({
        id: item.id, titulo: item.descricao || "Sem descrição", subtitulo: [item.categoria, item.pagamento].filter(Boolean).join(" · "),
        valor: item.valor, icone: ICONE_ABA.lancamentos, tags: [item.pagamento, item.categoria, item.responsavel],
        onEditar: onEdit ? () => setEditando(item) : undefined, onRemover: () => onRemove(item.id),
      }))} />

      {/* Tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2">Forma de Pagamento</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Descrição</th>
              <th className="py-2">Responsável</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-line/40 last:border-0 hover:bg-background/30">
                <td className="py-3 font-medium">
                  {item.pagamento ? (
                    <Selo nome={item.pagamento} cor={corPagamento(item.pagamento)} />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="py-3">
                  {item.categoria ? (
                    <Selo nome={item.categoria} cor={corCategoria(item.categoria)} />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="py-3">
                  {item.descricao}
                  {item.compartilhado_com && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent" title="Visível só para você e uma pessoa"><Ico icon={Lock} size={11} />partilhado</span>
                  )}
                </td>
                <td className="py-3">
                  <Selo nome={item.responsavel || "Membro"} cor={item.responsavelCor} />
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

      {editando && onEdit && (
        <EditarLancamentoModal
          tipo="extrato"
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