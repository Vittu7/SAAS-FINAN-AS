"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";

type Membro = { id: string; nome: string };
type Opcao = { id: string; nome: string; cor?: string };

type ContaForm = {
  mes: string;
  nome: string;
  valor: number;
  vencimento: number | null;
  categoria: string;
  pago: boolean;
  responsavel: string;
  responsavelNome: string;
};

type Conta = {
  id: string;
  mes: string;
  nome: string;
  valor: number;
  pago: boolean;
  categoria?: string;
  vencimento?: number | null;
  responsavel?: string;
  responsavel_id?: string;
  responsavelNome?: string;
};

type Props = {
  mes: string;
  itens: Conta[];
  onAdd: (item: ContaForm) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onTogglePago: (id: string) => void | Promise<void>;
  onCopiarMesAnterior: () => void | Promise<void>;
};

export default function ContasFixasTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onTogglePago,
  onCopiarMesAnterior,
}: Props) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [perfilId, setPerfilId] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [modal, setModal] = useState<
    "pagamento" | "categoria" | "cartao" | null
  >(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      console.error("Erro ao identificar usuário:", authError?.message);
      return;
    }

    const { data: perfil, error } = await supabase
      .from("perfis")
      .select("id, grupo_id, nome_usuario")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error || !perfil) {
      console.error("Erro ao carregar perfil:", error?.message);
      return;
    }

    const id = String(perfil.id);
    setPerfilId(id);

    let listaMembros: Membro[] = [
      { id, nome: perfil.nome_usuario || "Usuário" },
    ];

    let consultaCategorias = supabase
      .from("opcoes_categoria")
      .select("*")
      .order("nome");

    if (perfil.grupo_id) {
      const [resMembros, resCategorias] = await Promise.all([
        supabase
          .from("perfis")
          .select("id, nome_usuario")
          .eq("grupo_id", perfil.grupo_id)
          .order("nome_usuario"),
        supabase
          .from("opcoes_categoria")
          .select("*")
          .eq("grupo_id", perfil.grupo_id)
          .order("nome"),
      ]);

      if (resMembros.error) {
        console.error("Erro ao carregar membros:", resMembros.error.message);
      } else if (resMembros.data) {
        listaMembros = resMembros.data.map((m) => ({
          id: String(m.id),
          nome: m.nome_usuario || "Usuário",
        }));
      }

      if (resCategorias.error) {
        console.error("Erro ao carregar categorias:", resCategorias.error.message);
      } else {
        setCategorias((resCategorias.data || []) as Opcao[]);
      }
    } else {
      const { data, error: categoriaError } = await consultaCategorias;
      if (categoriaError) {
        console.error("Erro ao carregar categorias:", categoriaError.message);
      } else {
        setCategorias((data || []) as Opcao[]);
      }
    }

    if (!listaMembros.some((m) => m.id === id)) {
      listaMembros.unshift({
        id,
        nome: perfil.nome_usuario || "Usuário",
      });
    }

    setMembros(listaMembros);
    setResponsaveis((anteriores) =>
      anteriores.length ? anteriores.filter((r) =>
        listaMembros.some((m) => m.id === r)
      ) : [id]
    );
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const nomeResponsavel = (id: string) =>
    membros.find((m) => m.id === id)?.nome || "Membro";

  const alternarResponsavel = (id: string) => {
    setResponsaveis((atuais) => {
      if (atuais.includes(id)) {
        return atuais.length > 1 ? atuais.filter((r) => r !== id) : atuais;
      }
      return [...atuais, id];
    });
  };

  const selecionarTodos = () => {
    setResponsaveis(
      responsaveis.length === membros.length
        ? [perfilId]
        : membros.map((m) => m.id)
    );
  };

  const adicionar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (salvando) return;

    if (!nome.trim()) {
      alert("Informe o nome da conta.");
      return;
    }

    const valorTotal = parseValor(valor);
    if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const dia = vencimento.trim() ? Number(vencimento) : null;
    if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) {
      alert("O vencimento deve ser um dia entre 1 e 31.");
      return;
    }

    const ids = responsaveis.length ? responsaveis : [perfilId];
    if (!ids[0]) {
      alert("Não foi possível identificar o responsável. Recarregue a página.");
      return;
    }

    setSalvando(true);

    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        await onAdd({
          mes,
          nome: ids.length > 1
            ? nome.trim() + " (" + (i + 1) + "/" + ids.length + ")"
            : nome.trim(),
          valor: valorTotal / ids.length,
          vencimento: dia,
          categoria: categoria || "Outros",
          pago: false,
          responsavel: id,
          responsavelNome: nomeResponsavel(id),
        });
      }

      setNome("");
      setValor("");
      setVencimento("");
      setCategoria("");
      setResponsaveis([perfilId]);
      setMenuAberto(false);
    } catch (erro) {
      console.error("Erro ao salvar conta:", erro);
      alert("Não foi possível salvar. Confira o console e o Supabase.");
    } finally {
      setSalvando(false);
    }
  };

  const classeInput =
    "w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-lg md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted">
          Contas Recorrentes do Mês
        </h3>
        <button
          type="button"
          onClick={() => void onCopiarMesAnterior()}
          className="rounded-xl border border-line px-3 py-2 text-xs text-ink hover:bg-background"
        >
          📋 Copiar mês anterior
        </button>
      </div>

      <form
        onSubmit={adicionar}
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12"
      >
        <div className="lg:col-span-3">
          <label className="mb-1 block text-xs text-muted">Nome da conta</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Energia, Internet"
            className={classeInput}
          />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 flex justify-between">
            <label className="text-xs text-muted">Categoria</label>
            <button
              type="button"
              onClick={() => setModal("categoria")}
              className="text-xs text-accent hover:underline"
            >
              Editar
            </button>
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={classeInput}
          >
            <option value="">Selecione...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
            {!categorias.some((c) => c.nome === "Outros") && (
              <option value="Outros">Outros</option>
            )}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs text-muted">Valor (R$)</label>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className={classeInput}
          />
        </div>

        <div className="lg:col-span-1">
          <label className="mb-1 block text-xs text-muted">Venc.</label>
          <input
            type="number"
            min="1"
            max="31"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            placeholder="Dia"
            className={classeInput}
          />
        </div>

        <div className="relative lg:col-span-1">
          <label className="mb-1 block text-xs text-muted">Resp.</label>
          <button
            type="button"
            onClick={() => setMenuAberto((aberto) => !aberto)}
            className={classeInput + " flex items-center justify-between gap-1"}
          >
            <span className="truncate">
              {responsaveis.length === 1
                ? nomeResponsavel(responsaveis[0])
                : responsaveis.length + " selecionados"}
            </span>
            <span>▾</span>
          </button>

          {menuAberto && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-line bg-surface p-2 shadow-2xl">
              {membros.length > 1 && (
                <button
                  type="button"
                  onClick={selecionarTodos}
                  className="mb-2 w-full border-b border-line px-2 py-2 text-left text-xs font-bold text-accent"
                >
                  {responsaveis.length === membros.length
                    ? "Desmarcar todos"
                    : "Marcar todos"}
                </button>
              )}
              {membros.map((m) => (
                <label key={m.id} className="flex items-center gap-2 p-2 text-xs">
                  <input
                    type="checkbox"
                    checked={responsaveis.includes(m.id)}
                    onChange={() => alternarResponsavel(m.id)}
                  />
                  {m.nome}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={salvando}
            className="h-[38px] w-full rounded-xl bg-accent text-sm font-medium text-on-accent disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2">Status</th>
              <th className="py-2">Conta</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Vencimento</th>
              <th className="py-2">Responsável</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const responsavelId =
                item.responsavel_id || item.responsavel || "";
              const responsavel =
                item.responsavelNome || nomeResponsavel(responsavelId);

              return (
                <tr key={item.id} className="border-b border-line/40">
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => void onTogglePago(item.id)}
                      className={
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold " +
                        (item.pago
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-400")
                      }
                    >
                      {item.pago ? "✓ Pago" : "Pendente"}
                    </button>
                  </td>
                  <td className="py-3 font-medium">{item.nome}</td>
                  <td className="py-3 text-muted">{item.categoria || "Outros"}</td>
                  <td className="py-3 text-xs text-muted">
                    {item.vencimento ? "Dia " + item.vencimento : "-"}
                  </td>
                  <td className="py-3">
                    <span className="rounded bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                      {responsavel}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold">{brl(item.valor)}</td>
                  <td className="py-3 text-center">
                    <button
                      type="button"
                      onClick={() => void onRemove(item.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted">
                  Nenhuma conta fixa cadastrada para este mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <GerenciarOpcoesModal
          tipo={modal}
          onClose={() => setModal(null)}
          onAtualizar={carregarDados}
        />
      )}
    </div>
  );
}