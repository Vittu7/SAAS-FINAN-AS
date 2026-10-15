"use client";

import { useState } from "react";
import { parseValor } from "@/lib/finance";
import { useOpcoes } from "@/lib/useOpcoes";
import { SeletorOpcao } from "@/components/SeletorOpcao";

type TipoLancamento = "extrato" | "cartao" | "contas_fixas";

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

  const [forma, setForma] = useState<string>(
    tipo === "extrato" ? item.pagamento || "" : tipo === "cartao" ? item.cartao || "" : item.forma_pagamento || ""
  );
  const [categoria, setCategoria] = useState<string>(item.categoria || "");
  const [descricao, setDescricao] = useState<string>(
    tipo === "contas_fixas" ? item.nome || "" : item.descricao || item.nome || ""
  );
  const [valorTexto, setValorTexto] = useState<string>(String(item.valor ?? "").replace(".", ","));
  const [parcelaAtual, setParcelaAtual] = useState<number>(Number(item.parcelaAtual ?? item.parcela_atual ?? 1));
  const [parcelaTotal, setParcelaTotal] = useState<number>(Number(item.parcelaTotal ?? item.parcela_total ?? 1));
  const [vencimento, setVencimento] = useState<string>(String(item.vencimento ?? ""));
  const [responsavel, setResponsavel] = useState<string>(item.responsavel || membros[0] || "");
  const [salvando, setSalvando] = useState(false);

  const listaResponsaveis = Array.from(new Set([responsavel, ...membros].filter(Boolean)));

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();

    const valor = parseValor(valorTexto);
    if (!descricao.trim()) {
      alert(tipo === "contas_fixas" ? "Por favor, insira o nome da conta." : "Por favor, insira a descrição.");
      return;
    }
    if (isNaN(valor) || valor <= 0) {
      alert("Por favor, insira um valor válido (ex: 50,00).");
      return;
    }

    let patch: Record<string, any>;
    if (tipo === "extrato") {
      patch = { pagamento: forma || "Geral", categoria: categoria || "Outros", descricao: descricao.trim(), valor, responsavel };
    } else if (tipo === "cartao") {
      patch = {
        cartao: forma || "Forma de Pagamento",
        categoria: categoria || "Outros",
        nome: descricao.trim(),
        valor,
        parcela_atual: Number(parcelaAtual) || 1,
        parcela_total: Number(parcelaTotal) || 1,
        responsavel,
      };
    } else {
      patch = {
        nome: descricao.trim(),
        forma_pagamento: forma || null,
        categoria: categoria || null,
        valor,
        vencimento: vencimento ? Number(vencimento) : null,
        responsavel,
      };
    }

    setSalvando(true);
    const ok = await onSalvar(patch);
    setSalvando(false);
    if (ok !== false) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSalvar}
        className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl border border-line relative space-y-4"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-ink">
          ✕
        </button>

        <h3 className="text-xl font-bold">Editar lançamento</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted block mb-1">
              {tipo === "contas_fixas" ? "Nome da Conta" : "Descrição"}
            </label>
            <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={CLASSE_CAMPO} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1">Forma de Pagamento</label>
            <SeletorOpcao opcoes={opcoesPagamento} valor={forma} onChange={setForma} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1">Categoria</label>
            <SeletorOpcao opcoes={opcoesCategoria} valor={categoria} onChange={setCategoria} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1">Valor (R$)</label>
            <input type="text" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} className={CLASSE_CAMPO} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1">Responsável</label>
            <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={CLASSE_CAMPO}>
              {listaResponsaveis.map((nome) => (
                <option key={nome} value={nome} className="bg-surface text-ink">
                  {nome}
                </option>
              ))}
            </select>
          </div>

          {tipo === "cartao" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Parcela atual</label>
                <input
                  type="number"
                  min="1"
                  value={parcelaAtual}
                  onChange={(e) => setParcelaAtual(Number(e.target.value))}
                  className={CLASSE_CAMPO}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Total de parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={parcelaTotal}
                  onChange={(e) => setParcelaTotal(Number(e.target.value))}
                  className={CLASSE_CAMPO}
                />
              </div>
            </>
          )}

          {tipo === "contas_fixas" && (
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Vencimento (dia)</label>
              <input type="text" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={CLASSE_CAMPO} />
            </div>
          )}
        </div>

        {tipo === "cartao" && (
          <p className="text-xs text-muted">
            A alteração vale só para esta parcela. As outras parcelas do mesmo parcelamento não mudam.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90 transition disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}