"use client";

import { Check, ChevronDown, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { ICONE_ABA, Ico } from "@/components/icons";
import MobileLista from "@/components/mobile/MobileLista";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";
import ModalFormulario from "@/components/ModalFormulario";
import { useOpcoes } from "@/lib/useOpcoes";
import { SeletorOpcao, Selo } from "@/components/SeletorOpcao";
import EditarLancamentoModal from "@/components/EditarLancamentoModal";

type Props = {
  mes: string;
  itens: any[];
  onAdd: (item: any) => void | Promise<void>;
  onRemove: (id: string) => void;
  onEdit?: (id: string, patch: Record<string, any>) => Promise<boolean | void>;
  onTogglePago: (id: string) => void;
};

export default function ContasFixasTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onEdit,
  onTogglePago,
}: Props) {
  const [nome, setNome] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);

  const [membros, setMembros] = useState<string[]>([]);
  const [membrosCompartilhamento, setMembrosCompartilhamento] = useState<{ id: string; nome: string }[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [visivelPara, setVisivelPara] = useState("privado");
  const [meuNome, setMeuNome] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [menuResponsavelAberto, setMenuResponsavelAberto] = useState(false);

  const {
    pagamento,
    categoria: opcoesCategoria,
    recarregar,
    corPagamento,
    corCategoria,
  } = useOpcoes();

  const [modalOpcaoAberto, setModalOpcaoAberto] =
    useState<"pagamento" | "categoria" | null>(null);
  const [editando, setEditando] = useState<any | null>(null);

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
    setResponsaveisSelecionados((atuais) =>
      atuais.length > 0 ? atuais : [nomeReal],
    );

    if (perfil.grupo_id) {
      const { data } = await supabase
        .from("perfis")
        .select("id, nome_usuario")
        .eq("grupo_id", perfil.grupo_id);

      const nomes = (data || [])
        .map((membro) => membro.nome_usuario)
        .filter(Boolean);

      setMembros(nomes.length > 0 ? nomes : [nomeReal]);
      setMembrosCompartilhamento((data || []).filter((membro) => membro.id !== perfil.id && membro.nome_usuario).map((membro) => ({ id: membro.id, nome: membro.nome_usuario || "Membro" })));
    } else {
      setMembros([nomeReal]);
    }
  }, []);

  useEffect(() => {
    carregarMembros();
  }, [carregarMembros]);

  const alternarResponsavel = (nomeMembro: string) => {
    setResponsaveisSelecionados((atuais) =>
      atuais.includes(nomeMembro)
        ? atuais.length > 1
          ? atuais.filter((item) => item !== nomeMembro)
          : atuais
        : [...atuais, nomeMembro],
    );
  };

  const selecionarTodos = () => {
    setResponsaveisSelecionados(
      responsaveisSelecionados.length === membros.length
        ? [meuNome || "Usuário"]
        : [...membros],
    );
  };

  const handleAdicionar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const valorTotal = parseValor(valorTexto);

    if (!nome.trim()) {
      alert("Por favor, insira o nome da conta.");
      return;
    }

    if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
      alert("Por favor, insira um valor válido (ex: 50,00).");
      return;
    }

    if (vencimento) {
      const dia = Number(vencimento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
        alert("O vencimento deve ser um dia entre 1 e 31.");
        return;
      }
    }

    const responsaveis =
      responsaveisSelecionados.length > 0
        ? responsaveisSelecionados
        : [meuNome || "Usuário"];

    const valorIndividual = valorTotal / responsaveis.length;

    await Promise.all(
      responsaveis.map((responsavel) =>
        onAdd({
          mes,
          nome:
            responsaveis.length > 1
              ? `${nome.trim()} (${responsaveis.indexOf(responsavel) + 1}/${responsaveis.length})`
              : nome.trim(),
          valor: valorIndividual,
          vencimento: vencimento || null,
          categoria: categoria || "Outros",
          forma_pagamento: formaPagamento || null,
          pago: false,
          responsavel,
          compartilhado_com: visivelPara === "grupo" ? grupoId || null : visivelPara !== "privado" ? visivelPara : null,
        }),
      ),
    );

    setNome("");
    setValorTexto("");
    setVencimento("");
    setCategoria("");
    setFormaPagamento("");
    setVisivelPara("privado");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
    setNovoAberto(false);
  };

  return (
    <section className="space-y-4 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Contas fixas</h2>
          <p className="text-sm text-muted">
            Acompanhe vencimentos e pagamentos do mês.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setNovoAberto(true)}
            className="min-h-11 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 sm:w-auto"
          >
            + Nova conta fixa
          </button>
        </div>
      </header>

      <ModalFormulario
        aberto={novoAberto}
        titulo="Cadastrar conta fixa"
        onFechar={() => {
          setNovoAberto(false);
          setMenuResponsavelAberto(false);
        }}
      >
        <form onSubmit={handleAdicionar} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Nome da conta
            </span>
            <input
              type="text"
              required
              placeholder="Ex.: Energia, internet"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Valor (R$)
            </span>
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00"
              value={valorTexto}
              onChange={(event) => setValorTexto(event.target.value)}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted">
                Forma de pagamento
              </label>
              <button
                type="button"
                onClick={() => setModalOpcaoAberto("pagamento")}
                className="text-xs text-accent hover:underline"
              >
                Gerenciar
              </button>
            </div>
            <SeletorOpcao
              opcoes={pagamento}
              valor={formaPagamento}
              onChange={setFormaPagamento}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted">Categoria</label>
              <button
                type="button"
                onClick={() => setModalOpcaoAberto("categoria")}
                className="text-xs text-accent hover:underline"
              >
                Gerenciar
              </button>
            </div>
            <SeletorOpcao
              opcoes={opcoesCategoria}
              valor={categoria}
              onChange={setCategoria}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Vencimento (dia do mês)
            </span>
            <input
              type="number"
              min="1"
              max="31"
              placeholder="Ex.: 10"
              value={vencimento}
              onChange={(event) => setVencimento(event.target.value)}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          <div className="relative">
            <span className="mb-1 block text-xs font-medium text-muted">
              Responsável
            </span>
            <button
              type="button"
              onClick={() => setMenuResponsavelAberto((aberto) => !aberto)}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-background px-3 py-2 text-left text-sm text-ink"
            >
              <span className="truncate">
                {responsaveisSelecionados.length === 1
                  ? responsaveisSelecionados[0]
                  : `${responsaveisSelecionados.length} pessoas`}
              </span>
              <Ico icon={ChevronDown} size={16} className="text-muted" />
            </button>

            {menuResponsavelAberto && (
              <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-52 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-xl">
                {membros.length > 1 && (
                  <button
                    type="button"
                    onClick={selecionarTodos}
                    className="mb-1 w-full rounded-md px-2 py-2 text-left text-xs font-medium text-accent hover:bg-background"
                  >
                    {responsaveisSelecionados.length === membros.length
                      ? "Desmarcar todos"
                      : "Selecionar todos"}
                  </button>
                )}
                {membros.map((membro) => (
                  <label
                    key={membro}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-ink hover:bg-background"
                  >
                    <input
                      type="checkbox"
                      checked={responsaveisSelecionados.includes(membro)}
                      onChange={() => alternarResponsavel(membro)}
                    />
                    {membro}
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Quem pode ver?</span>
            <select value={visivelPara} onChange={(event) => setVisivelPara(event.target.value)} className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent">
              <option value="privado">Só eu</option>
              <option value="grupo" disabled={!grupoId}>Todo o grupo</option>
              {membrosCompartilhamento.map((membro) => <option key={membro.id} value={membro.id}>Só eu e {membro.nome}</option>)}
            </select>
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setNovoAberto(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-background"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
            >
              Salvar conta
            </button>
          </div>
        </form>
      </ModalFormulario>

      <MobileLista
        vazio="Nenhuma conta fixa cadastrada neste mês."
        resumo={{
          rotulo: "Falta pagar",
          valor: itens.filter((i: any) => !i.pago).reduce((t: number, i: any) => t + (Number(i.valor) || 0), 0),
          extra: `${itens.filter((i: any) => i.pago).length} de ${itens.length} pagas`,
        }}
        itens={[...itens].sort((x: any, y: any) => Number(x.pago) - Number(y.pago)).map((item: any) => ({
          id: item.id, titulo: item.nome || "Sem nome", subtitulo: [item.categoria, item.formaPagamento || item.forma_pagamento].filter(Boolean).join(" · "),
          valor: item.valor, icone: item.pago ? Check : ICONE_ABA.contas, tags: [item.formaPagamento || item.forma_pagamento, item.categoria, item.responsavel],
          status: item.pago ? { texto: "Paga", tom: "ok" as const } : { texto: "Pendente", tom: "alerta" as const },
          onAlternar: () => onTogglePago(item.id), rotuloAlternar: item.pago ? "Desmarcar" : "Marcar como paga",
          onEditar: () => setEditando(item), onRemover: () => onRemove(item.id),
        }))}
      />

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-3 pr-3">Status</th>
              <th className="py-3 pr-3">Conta</th>
              <th className="py-3 pr-3">Forma de pagamento</th>
              <th className="py-3 pr-3">Categoria</th>
              <th className="py-3 pr-3">Vencimento</th>
              <th className="py-3 pr-3">Responsável</th>
              <th className="py-3 pr-3 text-right">Valor</th>
              <th className="py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr
                key={item.id}
                className="border-b border-line/50 last:border-0 hover:bg-background/50"
              >
                <td className="py-3 pr-3">
                  <button
                    type="button"
                    onClick={() => onTogglePago(item.id)}
                    aria-label={item.pago ? "Marcar como pendente" : "Marcar como paga"}
                    aria-pressed={Boolean(item.pago)}
                    className={`inline-flex min-w-[112px] items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${item.pago
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                      }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${item.pago
                        ? "bg-emerald-500 text-white"
                        : "bg-amber-500 text-white"
                        }`}
                    >
                      <Ico icon={item.pago ? Check : TriangleAlert} size={10} />
                    </span>
                    {item.pago ? "Pago" : "Pendente"}
                  </button>
                </td>
                <td className="py-3 pr-3 font-medium">{item.nome}</td>
                <td className="py-3 pr-3">
                  {item.forma_pagamento ? (
                    <Selo
                      nome={item.forma_pagamento}
                      cor={corPagamento(item.forma_pagamento)}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 pr-3">
                  {item.categoria ? (
                    <Selo
                      nome={item.categoria}
                      cor={corCategoria(item.categoria)}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 pr-3 text-muted">
                  {item.vencimento ? `Dia ${item.vencimento}` : "—"}
                </td>
                <td className="py-3 pr-3">
                  <Selo
                    nome={item.responsavel || "Membro"}
                    cor={item.responsavelCor}
                  />
                </td>
                <td className="py-3 pr-3 text-right font-semibold tabular-nums">
                  {brl(item.valor)}
                </td>
                <td className="py-3 text-right">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => setEditando(item)}
                      className="mr-3 text-xs text-accent hover:underline"
                    >
                      <span className="inline-flex items-center gap-1"><Ico icon={Pencil} size={13} />Editar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    <span className="inline-flex items-center gap-1"><Ico icon={Trash2} size={13} />Excluir</span>
                  </button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-muted">
                  Nenhuma conta fixa cadastrada neste mês.
                </td>
              </tr>
            )}
          </tbody>
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
    </section>
  );
}
