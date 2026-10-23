"use client";

import { Pencil, Tags, Trash2, Wallet, X, CreditCard, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import DialogResponsivo from "./DialogResponsivo";
import { parseValor } from "@/lib/finance";
import { type Opcao, useOpcoes } from "@/lib/useOpcoes";
import { gradienteCartao } from "@/lib/cartao";

type Aba = "cartoes" | "pagamentos" | "categorias";

const CORES = ["#0EA5E9", "#10B981", "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#EF4444", "#64748B"];

const ABAS: { id: Aba; nome: string; icone: LucideIcon; singular: string }[] = [
  { id: "cartoes", nome: "Cartões", icone: CreditCard, singular: "cartão" },
  { id: "pagamentos", nome: "Formas de pagamento", icone: Wallet, singular: "forma de pagamento" },
  { id: "categorias", nome: "Categorias", icone: Tags, singular: "categoria" },
];

type Formulario = {
  id: string | null; // null = novo
  nome: string;
  cor: string;
  ehCartao: boolean;
  limite: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formularioVazio(aba: Aba): Formulario {
  return { id: null, nome: "", cor: aba === "cartoes" ? "#6366F1" : "#64748B", ehCartao: aba === "cartoes", limite: "" };
}

export default function GerenciarOpcoesModal({
  tipo = "pagamento",
  modo = "modal",
  abaInicial,
  onClose,
  onAtualizar,
}: {
  tipo?: "pagamento" | "categoria" | null;
  modo?: "modal" | "pagina";
  abaInicial?: Aba;
  onClose: () => void;
  onAtualizar?: () => void;
}) {
  const {
    pagamento,
    categoria,
    adicionarPagamento,
    atualizarPagamento,
    removerPagamento,
    adicionarCategoria,
    atualizarCategoria,
    removerCategoria,
  } = useOpcoes();

  const [montado, setMontado] = useState(false);
  const [aba, setAba] = useState<Aba>(abaInicial || (tipo === "categoria" ? "categorias" : "cartoes"));
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setMontado(true);
    if (modo === "pagina") return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose, modo]);

  const lista = useMemo(() => {
    const base =
      aba === "categorias"
        ? categoria
        : aba === "cartoes"
          ? pagamento.filter((i) => Boolean(i.eh_cartao))
          : pagamento.filter((i) => !i.eh_cartao);
    const termo = busca.trim().toLowerCase();
    return termo ? base.filter((i) => i.nome.toLowerCase().includes(termo)) : base;
  }, [aba, categoria, pagamento, busca]);

  const contagem: Record<Aba, number> = {
    cartoes: pagamento.filter((i) => i.eh_cartao).length,
    pagamentos: pagamento.filter((i) => !i.eh_cartao).length,
    categorias: categoria.length,
  };

  const abaAtual = ABAS.find((a) => a.id === aba) || ABAS[0];

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    setForm(null);
    setErro("");
    setBusca("");
  };

  const editar = (item: Opcao) => {
    setErro("");
    setForm({
      id: item.id,
      nome: item.nome,
      cor: item.cor || "#64748B",
      ehCartao: Boolean(item.eh_cartao),
      limite: item.limite ? String(item.limite).replace(".", ",") : "",
    });
  };

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    if (!form.nome.trim()) return setErro("Informe um nome.");

    const ehPagamento = aba !== "categorias";
    const limite = parseValor(form.limite);
    if (ehPagamento && form.ehCartao && limite <= 0) {
      return setErro("Informe um limite maior que zero para o cartão de crédito.");
    }

    try {
      setSalvando(true);
      setErro("");
      if (!ehPagamento) {
        if (form.id) await atualizarCategoria(form.id, { nome: form.nome, cor: form.cor });
        else await adicionarCategoria(form.nome, form.cor);
      } else if (form.id) {
        await atualizarPagamento(form.id, {
          nome: form.nome,
          cor: form.cor,
          eh_cartao: form.ehCartao,
          limite: form.ehCartao ? limite : 0,
        });
        // Se a conta virou (ou deixou de ser) cartão, acompanhe na aba certa
        const novaAba: Aba = form.ehCartao ? "cartoes" : "pagamentos";
        if (novaAba !== aba) setAba(novaAba);
      } else {
        await adicionarPagamento(form.nome, { isCartaoCredito: form.ehCartao, limiteTotal: limite, cor: form.cor });
      }
      setForm(null);
      onAtualizar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (item: Opcao) => {
    if (!window.confirm(`Deseja excluir “${item.nome}”? Lançamentos já existentes não serão apagados.`)) return;
    try {
      setSalvando(true);
      setErro("");
      if (aba === "categorias") await removerCategoria(item.id);
      else await removerPagamento(item.id);
      if (form?.id === item.id) setForm(null);
      onAtualizar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setSalvando(false);
    }
  };

  if (!montado) return null;

  const conteudo = (
    <div
      className={modo === "pagina" ? "min-w-0" : "fixed inset-0 z-[10000] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6"}
      onMouseDown={(e) => {
        if (modo !== "pagina" && e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role={modo === "pagina" ? undefined : "dialog"}
        aria-modal={modo === "pagina" ? undefined : true}
        aria-label="Cartões, formas de pagamento e categorias"
        className={modo === "pagina" ? "flex min-w-0 flex-col" : "flex h-[92dvh] max-h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl sm:h-[min(720px,90dvh)] sm:max-w-4xl"}
      >
        {/* Cabeçalho */}
        {modo !== "pagina" && <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Configurações</p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-ink">Cartões, pagamentos e categorias</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-background hover:text-ink"
          >
            <Ico icon={X} />
          </button>
        </header>}

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Abas: horizontais no celular, laterais no computador */}
          {modo !== "pagina" && <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-background/50 p-2 sm:w-56 sm:flex-col sm:border-b-0 sm:border-r sm:p-3">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => trocarAba(a.id)}
                aria-pressed={aba === a.id}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  aba === a.id ? "bg-accent text-on-accent shadow-sm" : "text-ink hover:bg-surface"
                }`}
              >
                <Ico icon={a.icone} size={18} />
                <span className="whitespace-nowrap">{a.nome}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
                    aba === a.id ? "bg-black/15" : "bg-background text-muted"
                  }`}
                >
                  {contagem[a.id]}
                </span>
              </button>
            ))}
          </nav>}

          {/* Conteúdo */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={`Buscar ${abaAtual.nome.toLowerCase()}…`}
                className="min-w-0 flex-1 rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => {
                  setErro("");
                  setForm(formularioVazio(aba));
                }}
                className="shrink-0 rounded-lg bg-accent px-3 py-2.5 text-xs font-semibold text-on-accent transition hover:opacity-90"
              >
                + Novo {abaAtual.singular}
              </button>
            </div>

            {erro && !form && (
              <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {erro}
              </p>
            )}

            {lista.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
                {busca ? "Nada encontrado para essa busca." : `Nenhum(a) ${abaAtual.singular} cadastrado(a) ainda.`}
              </div>
            ) : (
              <ul className={`grid gap-2 ${aba === "cartoes" ? "sm:grid-cols-2" : ""}`}>
                {lista.map((item) => (
                  <li key={item.id} className="min-w-0">
                    {aba === "cartoes" ? (
                      <CartaoItem item={item} bloqueado={salvando} onEditar={() => editar(item)} onExcluir={() => remover(item)} />
                    ) : (
                      <LinhaItem item={item} bloqueado={salvando} onEditar={() => editar(item)} onExcluir={() => remover(item)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {form && (
        <FormularioDialog
          form={form}
          setForm={setForm}
          aba={aba}
          erro={erro}
          salvando={salvando}
          onSalvar={salvar}
          onCancelar={() => {
            setForm(null);
            setErro("");
          }}
        />
      )}
    </div>
  );
  return modo === "pagina" ? conteudo : createPortal(conteudo, document.body);
}

function BotoesAcao({ nome, bloqueado, onEditar, onExcluir, claro }: { nome: string; bloqueado: boolean; onEditar: () => void; onExcluir: () => void; claro?: boolean }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-1.5">
      <button
        type="button"
        onClick={onEditar}
        disabled={bloqueado}
        aria-label={`Editar ${nome}`}
        className={`min-w-0 rounded-lg border px-2 py-2 text-xs font-medium transition disabled:opacity-50 ${
          claro ? "border-white/30 bg-white/10 text-white hover:bg-white/20" : "border-line text-ink hover:bg-surface"
        }`}
      >
        <span className="inline-flex items-center justify-center gap-1.5"><Ico icon={Pencil} size={14} />Editar</span>
      </button>
      <button
        type="button"
        onClick={onExcluir}
        disabled={bloqueado}
        aria-label={`Excluir ${nome}`}
        className={`min-w-0 rounded-lg border px-2 py-2 text-xs font-medium transition disabled:opacity-50 ${
          claro ? "border-white/30 bg-white/10 text-white hover:bg-red-500/60" : "border-red-500/30 text-red-500 hover:bg-red-500/10"
        }`}
      >
        <span className="inline-flex items-center justify-center gap-1.5"><Ico icon={Trash2} size={14} />Excluir</span>
      </button>
    </div>
  );
}

function CartaoItem({ item, bloqueado, onEditar, onExcluir }: { item: Opcao; bloqueado: boolean; onEditar: () => void; onExcluir: () => void }) {
  // Mesma aparência dos cartões da Home, das Contas parceladas e das Faturas: usa a cor cadastrada.
  return (
    <div
      className="flex h-full min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl p-4 text-white shadow-md"
      style={{ background: gradienteCartao(item.cor) }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-base font-semibold">{item.nome}</p>
        <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-semibold">Crédito</span>
      </div>
      <div className="grid min-w-0 gap-3">
        <div>
          <p className="text-[11px] text-white/70">Limite total</p>
          <p className="text-lg font-bold">{brl(Number(item.limite || 0))}</p>
        </div>
        <BotoesAcao claro nome={item.nome} bloqueado={bloqueado} onEditar={onEditar} onExcluir={onExcluir} />
      </div>
    </div>
  );
}

function LinhaItem({ item, bloqueado, onEditar, onExcluir }: { item: Opcao; bloqueado: boolean; onEditar: () => void; onExcluir: () => void }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-line bg-surface px-3 py-3">
      <span className="size-8 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: item.cor || "#64748B" }} />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.nome}</p>
      <div className="col-span-2"><BotoesAcao nome={item.nome} bloqueado={bloqueado} onEditar={onEditar} onExcluir={onExcluir} /></div>
    </div>
  );
}

function FormularioDialog({
  form,
  setForm,
  aba,
  erro,
  salvando,
  onSalvar,
  onCancelar,
}: {
  form: Formulario;
  setForm: (f: Formulario) => void;
  aba: Aba;
  erro: string;
  salvando: boolean;
  onSalvar: (e: React.FormEvent) => void;
  onCancelar: () => void;
}) {
  const ehPagamento = aba !== "categorias";
  const titulo = form.id
    ? `Editar ${form.nome || "item"}`
    : aba === "cartoes"
      ? "Novo cartão"
      : aba === "categorias"
        ? "Nova categoria"
        : "Nova forma de pagamento";
  const campo = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

  return (
    <DialogResponsivo titulo={titulo} onFechar={onCancelar}>
      <form onSubmit={onSalvar} className="min-w-0">
        {ehPagamento && form.ehCartao && (
          <div className="mb-4 overflow-hidden rounded-2xl p-4 text-white shadow-md" style={{ background: gradienteCartao(form.cor) }}>
            <p className="text-[11px] text-white/70">Prévia do cartão</p>
            <p className="mt-4 truncate font-semibold">{form.nome.trim() || "Nome do cartão"}</p>
            <p className="text-[11px] text-white/70 mt-3">Limite total</p>
            <p className="text-lg font-bold">{brl(parseValor(form.limite))}</p>
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Nome</span>
            <input
              autoFocus
              required
              maxLength={80}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder={aba === "cartoes" ? "Ex.: Nubank" : aba === "categorias" ? "Ex.: Alimentação" : "Ex.: Boleto"}
              className={campo}
            />
          </label>

          {ehPagamento && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-3">
              <span>
                <span className="block text-sm font-medium text-ink">É cartão de crédito</span>
                <span className="block text-xs text-muted">Tem limite e fatura mensal</span>
              </span>
              <input
                type="checkbox"
                checked={form.ehCartao}
                onChange={(e) => setForm({ ...form, ehCartao: e.target.checked })}
                className="size-5 accent-[var(--accent)]"
              />
            </label>
          )}

          {ehPagamento && form.ehCartao && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Limite total (R$)</span>
              <input
                inputMode="decimal"
                value={form.limite}
                onChange={(e) => setForm({ ...form, limite: e.target.value })}
                placeholder="0,00"
                className={campo}
              />
            </label>
          )}

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Cor</span>
            <div className="flex flex-wrap items-center gap-2">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, cor: c })}
                  aria-label={`Usar a cor ${c}`}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-background transition ${
                    form.cor.toLowerCase() === c.toLowerCase() ? "scale-110 ring-2 ring-accent" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                aria-label="Escolher outra cor"
                className="h-8 w-10 cursor-pointer rounded bg-transparent"
              />
            </div>
          </div>
        </div>

        {erro && (
          <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {erro}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : form.id ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </form>
    </DialogResponsivo>
  );
}
