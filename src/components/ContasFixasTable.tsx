"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";
import { useOpcoes } from "@/lib/useOpcoes";
import { SeletorOpcao, Selo } from "@/components/SeletorOpcao";
import EditarLancamentoModal from "@/components/EditarLancamentoModal";

export default function ContasFixasTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onEdit,
  onTogglePago,
  onCopiarMesAnterior,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string, patch: Record<string, any>) => Promise<boolean | void>;
  onTogglePago: (id: string) => void;
  onCopiarMesAnterior: () => void;
}) {
  const [nome, setNome] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");

  const [membros, setMembros] = useState<string[]>([]);
  const [meuNome, setMeuNome] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [menuResponsavelAberto, setMenuResponsavelAberto] = useState(false);

  // Listas compartilhadas (as mesmas do Extrato e das Contas Parceladas), já com as cores
  const { pagamento, categoria: opcoesCategoria, recarregar, corPagamento, corCategoria } = useOpcoes();
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | null>(null);
  const [editando, setEditando] = useState<any | null>(null);

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

  const alternarResponsavel = (n: string) => {
    setResponsaveisSelecionados((prev) =>
      prev.includes(n)
        ? prev.length > 1
          ? prev.filter((item) => item !== n)
          : prev
        : [...prev, n]
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

    if (!nome.trim()) {
      alert("Por favor, insira o nome da conta.");
      return;
    }

    if (isNaN(valorTotal) || valorTotal <= 0) {
      alert("Por favor, insira um valor válido (ex: 50,00).");
      return;
    }

    const qtd = responsaveisSelecionados.length;
    const valorIndividual = valorTotal / (qtd > 0 ? qtd : 1);

    responsaveisSelecionados.forEach((resp) => {
      onAdd({
        mes,
        nome: qtd > 1 ? `${nome} (1/${qtd})` : nome,
        valor: valorIndividual,
        vencimento,
        categoria: categoria || "Outros",
        forma_pagamento: formaPagamento || null,
        pago: false,
        responsavel: resp,
      });
    });

    setNome("");
    setValorTexto("");
    setVencimento("");
    setCategoria("");
    setFormaPagamento("");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4 md:p-6 shadow-sm md:shadow-lg space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-muted">Contas Recorrentes do Mês</h3>
        <button
          type="button"
          onClick={onCopiarMesAnterior}
          className="text-xs bg-surface border border-line hover:bg-background px-3 py-1.5 rounded-xl transition text-ink"
        >
          📋 Copiar Contas do Mês Anterior
        </button>
      </div>

      <form id="form-contas-fixas" onSubmit={handleAdicionar} className="scroll-mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
        {/* Nome da Conta */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Nome da Conta</label>
          <input
            type="text"
            placeholder="Ex: Energia, Internet"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Forma de Pagamento (lista compartilhada com Extrato e Contas Parceladas) */}
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
          <SeletorOpcao opcoes={pagamento} valor={formaPagamento} onChange={setFormaPagamento} />
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
              ⚙️ Editar
            </button>
          </div>
          <SeletorOpcao opcoes={opcoesCategoria} valor={categoria} onChange={setCategoria} />
        </div>

        {/* Valor */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Valor (R$)</label>
          <input
            type="text"
            placeholder="0,00"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Vencimento */}
        <div className="lg:col-span-1">
          <label className="text-xs font-medium text-muted block mb-1">Venc.</label>
          <input
            type="text"
            placeholder="Dia"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-accent"
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
                {membros.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-background cursor-pointer select-none text-ink"
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

        {/* Botão Adicionar */}
        <div className="lg:col-span-2">
          <button
            type="submit"
            className="w-full bg-accent text-on-accent h-[38px] rounded-xl font-medium text-sm hover:opacity-90 transition flex items-center justify-center shadow-sm"
          >
            Adicionar
          </button>
        </div>
      </form>

      {/* Lista de contas em cartões no celular */}
      <div className="space-y-3 md:hidden">
        {itens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">Nenhuma conta fixa neste mês</p>
            <p className="mt-1 text-xs text-muted">Adicione suas contas recorrentes acima.</p>
            <button type="button" onClick={onCopiarMesAnterior} className="mt-3 text-xs font-semibold text-accent">Copiar mês anterior</button>
          </div>
        ) : itens.map((item) => (
          <article key={item.id} className="rounded-2xl border border-line bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{item.nome}</p>
                <p className="mt-1 text-xs text-muted">{item.vencimento ? "Vence dia " + item.vencimento : "Sem vencimento definido"} · {item.responsavel || "Membro"}</p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums text-ink">{brl(item.valor)}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onTogglePago(item.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.pago ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-amber-500/20 bg-amber-500/10 text-amber-500"}`}>
                {item.pago ? "✓ Pago" : "Pendente · marcar pago"}
              </button>
              {item.forma_pagamento && <Selo nome={item.forma_pagamento} cor={corPagamento(item.forma_pagamento)} />}
              {item.categoria && <Selo nome={item.categoria} cor={corCategoria(item.categoria)} />}
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
            <th className="py-2">Status</th><th className="py-2">Conta</th><th className="py-2">Forma de Pagamento</th><th className="py-2">Categoria</th><th className="py-2">Vencimento</th><th className="py-2">Responsável</th><th className="py-2 text-right">Valor</th><th className="py-2 text-center">Ações</th>
          </tr></thead>
          <tbody>{itens.map((item) => (
            <tr key={item.id} className="border-b border-line/40 last:border-0 hover:bg-background/30">
              <td className="py-3"><button type="button" onClick={() => onTogglePago(item.id)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${item.pago ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>{item.pago ? "✓ Pago" : "Pendente"}</button></td>
              <td className="py-3 font-medium">{item.nome}</td><td className="py-3">{item.forma_pagamento ? <Selo nome={item.forma_pagamento} cor={corPagamento(item.forma_pagamento)} /> : <span className="text-muted">-</span>}</td>
              <td className="py-3">{item.categoria ? <Selo nome={item.categoria} cor={corCategoria(item.categoria)} /> : <span className="text-muted">-</span>}</td>
              <td className="py-3 text-xs text-muted">{item.vencimento ? `Dia ${item.vencimento}` : "-"}</td><td className="py-3"><Selo nome={item.responsavel || "Membro"} cor={item.responsavelCor} /></td><td className="py-3 text-right font-bold">{brl(item.valor)}</td>
              <td className="py-3 text-center">{onEdit && <button type="button" onClick={() => setEditando(item)} className="mr-3 text-xs text-accent hover:underline">Editar</button>}<button type="button" onClick={() => onRemove(item.id)} className="text-xs text-red-400 hover:text-red-300">Remover</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {editando && onEdit && (
        <EditarLancamentoModal
          tipo="contas"
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