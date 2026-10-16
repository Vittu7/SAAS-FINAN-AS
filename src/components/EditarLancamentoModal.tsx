"use client";

import { useState } from "react";
import { parseValor } from "@/lib/finance";
import { useOpcoes } from "@/lib/useOpcoes";
import { SeletorOpcao } from "@/components/SeletorOpcao";

type TipoLancamento = "extrato" | "cartao" | "contas";

const CLASSE_CAMPO =
  "w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

export default function EditarLancamentoModal({
  tipo,
  item,
  membros,
  onSalvar,
  onClose,
}: {
  tipo: TipoLancamento;
  item: any;
  membros: string[];
  onSalvar: (patch: Record<string, any>) => Promise<boolean | void>;
  onClose: () => void;
}) {
  const { pagamento: opcoesPagamento, categoria: opcoesCategoria } = useOpcoes();

  const [mes, setMes] = useState<string>(item.mes || "");
  const [forma, setForma] = useState<string>(
    tipo === "extrato"
      ? item.pagamento || ""
      : tipo === "cartao"
        ? item.cartao || ""
        : item.forma_pagamento || "",
  );
  const [categoria, setCategoria] = useState<string>(item.categoria || "");
  const [descricao, setDescricao] = useState<string>(
    tipo === "contas" ? item.nome || "" : item.descricao || item.nome || "",
  );
  const [valorTexto, setValorTexto] = useState<string>(
    String(item.valor ?? "").replace(".", ","),
  );
  const [parcelaAtual, setParcelaAtual] = useState<number>(
    Number(item.parcelaAtual ?? item.parcela_atual ?? 1),
  );
  const [parcelaTotal, setParcelaTotal] = useState<number>(
    Number(item.parcelaTotal ?? item.parcela_total ?? 1),
  );
  const [vencimento, setVencimento] = useState<string>(
    String(item.vencimento ?? ""),
  );
  const [pago, setPago] = useState<boolean>(Boolean(item.pago));
  const [responsavel, setResponsavel] = useState<string>(
    item.responsavel || membros[0] || "",
  );
  const [salvando, setSalvando] = useState(false);

  const listaResponsaveis = Array.from(
    new Set([responsavel, ...membros].filter(Boolean)),
  );

  const handleSalvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const valor = parseValor(valorTexto);

    if (!mes) {
      alert("Selecione o mês do lançamento.");
      return;
    }

    if (!descricao.trim()) {
      alert(
        tipo === "contas"
          ? "Por favor, insira o nome da conta."
          : "Por favor, insira a descrição.",
      );
      return;
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      alert("Por favor, insira um valor válido (ex: 50,00).");
      return;
    }

    if (
      tipo === "cartao" &&
      (parcelaAtual < 1 || parcelaTotal < parcelaAtual)
    ) {
      alert("Confira a parcela atual e o total de parcelas.");
      return;
    }

    if (
      tipo === "contas" &&
      vencimento &&
      (!Number.isInteger(Number(vencimento)) ||
        Number(vencimento) < 1 ||
        Number(vencimento) > 31)
    ) {
      alert("O vencimento deve ser um dia entre 1 e 31.");
      return;
    }

    let patch: Record<string, unknown>;

    if (tipo === "extrato") {
      patch = {
        mes,
        pagamento: forma || "Geral",
        categoria: categoria || "Outros",
        descricao: descricao.trim(),
        valor,
        responsavel,
      };
    } else if (tipo === "cartao") {
      patch = {
        mes,
        cartao: forma || "Forma de Pagamento",
        categoria: categoria || "Outros",
        nome: descricao.trim(),
        valor,
        parcela_atual: Number(parcelaAtual),
        parcela_total: Number(parcelaTotal),
        responsavel,
      };
    } else {
      patch = {
        mes,
        nome: descricao.trim(),
        forma_pagamento: forma || null,
        categoria: categoria || null,
        valor,
        vencimento: vencimento ? Number(vencimento) : null,
        pago,
        responsavel,
      };
    }

    setSalvando(true);
    try {
      const ok = await onSalvar(patch);
      if (ok !== false) onClose();
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      alert("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSalvar}
        className="relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-line bg-background p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancelar edição"
          className="absolute right-4 top-4 text-muted hover:text-ink"
        >
          ✕
        </button>

        <h3 className="pr-8 text-xl font-bold">Editar lançamento</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Mês
            </label>
            <input
              type="month"
              required
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">
              {tipo === "contas" ? "Nome da conta" : "Descrição"}
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Forma de pagamento
            </label>
            <SeletorOpcao
              opcoes={opcoesPagamento}
              valor={forma}
              onChange={setForma}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Categoria
            </label>
            <SeletorOpcao
              opcoes={opcoesCategoria}
              valor={categoria}
              onChange={setCategoria}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Valor (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Responsável
            </label>
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className={CLASSE_CAMPO}
            >
              {listaResponsaveis.map((nome) => (
                <option
                  key={nome}
                  value={nome}
                  className="bg-surface text-ink"
                >
                  {nome}
                </option>
              ))}
            </select>
          </div>

          {tipo === "cartao" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Parcela atual
                </label>
                <input
                  type="number"
                  min="1"
                  max={parcelaTotal}
                  required
                  value={parcelaAtual}
                  onChange={(e) => setParcelaAtual(Number(e.target.value))}
                  className={CLASSE_CAMPO}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Total de parcelas
                </label>
                <input
                  type="number"
                  min={parcelaAtual}
                  required
                  value={parcelaTotal}
                  onChange={(e) => setParcelaTotal(Number(e.target.value))}
                  className={CLASSE_CAMPO}
                />
              </div>
            </>
          )}

          {tipo === "contas" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Vencimento (dia)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </div>

              <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={pago}
                  onChange={(e) => setPago(e.target.checked)}
                  className="rounded border-line text-accent focus:ring-accent"
                />
                Conta paga
              </label>
            </>
          )}
        </div>

        {tipo === "cartao" && (
          <p className="text-xs text-muted">
            A alteração vale somente para esta parcela. As demais parcelas não
            serão modificadas.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-surface disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={salvando}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}