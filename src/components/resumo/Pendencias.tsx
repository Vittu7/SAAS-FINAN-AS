"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, HandCoins, Receipt } from "lucide-react";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import PagarFaturaModal from "@/components/PagarFaturaModal";
import { EscolherContaRepasse } from "@/components/TelaGrupo";
import { Ico } from "@/components/icons";
import { useMovimentosConta } from "@/hooks/useMovimentosConta";
import { usePagamentosFatura } from "@/hooks/usePagamentosFatura";
import { arred } from "@/lib/calculos";
import { calcularSaldoConta, tipoDaConta } from "@/lib/contas";
import { brl } from "@/lib/finance";
import { repasseValidoParaAcao, type LancGrupo, type ResumoRepasses } from "@/lib/grupo";
import type { FaturaAberta } from "@/lib/pagamentoFatura";
import { useOpcoes } from "@/lib/useOpcoes";

type Tabela = "extrato" | "cartao" | "contas";
type ItemRepasse = { origem: Tabela; id: string };
type AcaoRepasse = "informar" | "concluir";
type ContaPendente = { id: string | number; nome?: string; valor: number | string; vencimento?: number | string | null; owner_id?: string | null };

/**
 * Central de pendências: o que ainda precisa ser pago, pago ou confirmado, com a ação ao lado.
 * Não tem regra própria: contas fixas usam o mesmo "marcar como paga", faturas usam o mesmo modal de pagamento da tela
 * de cartões e repasses usam a mesma ação em lote da tela do grupo (com as travas do fechamento aplicadas pelo chamador).
 */
export default function Pendencias({
  mes, userId, estado, contas, faturas, repasses, onPagarConta, onRepasse,
}: {
  mes: string;
  userId: string;
  estado: { extrato: any[]; cartao: any[]; contas: any[] };
  contas: ContaPendente[];
  faturas: FaturaAberta[];
  repasses: ResumoRepasses;
  onPagarConta: (id: string) => Promise<void>;
  onRepasse: (itens: ItemRepasse[], acao: AcaoRepasse, conta?: string | null) => Promise<boolean>;
}) {
  const { pagamento } = useOpcoes();
  const caixinhaMovs = useMovimentosConta();
  const { pagamentos, registrar } = usePagamentosFatura();
  const debitos = useMemo(() => pagamento.filter((o) => tipoDaConta(o) === "debito"), [pagamento]);
  const [ocupado, setOcupado] = useState<string | null>(null); // uma ação por vez: evita clique duplo
  const [pagando, setPagando] = useState<FaturaAberta | null>(null);
  const [pedindoConta, setPedindoConta] = useState<{ acao: AcaoRepasse; lista: LancGrupo[] } | null>(null);

  const saldoDaConta = (c: (typeof debitos)[number]) => calcularSaldoConta(estado as any, c, { userId, ateMes: mes, caixinhaMovs, pagamentosFatura: pagamentos }).saldo;

  const executar = async (chave: string, tarefa: () => Promise<unknown>) => {
    if (ocupado) return;
    setOcupado(chave);
    try { await tarefa(); } finally { setOcupado(null); }
  };

  // Só o que já venceu / é do mês e depende de mim; a mesma validação do lote em Repasses.
  const receber = repasses.aReceber.pessoas
    .map((p) => ({ p, lista: p.itens.filter((l) => l.vencido && l.situacaoRepasse === "aguardando" && repasseValidoParaAcao(l, "concluir", userId)) }))
    .filter((x) => x.lista.length > 0);
  const repassar = repasses.aRepassar.pessoas
    .map((p) => ({ p, lista: p.itens.filter((l) => l.vencido && l.situacaoRepasse === "pendente" && repasseValidoParaAcao(l, "informar", userId)) }))
    .filter((x) => x.lista.length > 0);
  const contasAPagar = [...contas]
    .filter((c) => !c.owner_id || c.owner_id === userId) // só o dono da conta pode marcar como paga
    .sort((a, b) => (Number(a.vencimento) || 99) - (Number(b.vencimento) || 99));

  const total = contasAPagar.length + faturas.length + receber.length + repassar.length;

  const repassar_ = (acao: AcaoRepasse, lista: LancGrupo[], chave: string) => {
    // Uma só conta de débito: o sistema já sabe qual é, sem perguntar. Com várias (ou nenhuma), pergunta.
    if (debitos.length === 1) {
      const itens = lista.map((l) => ({ origem: l.origem as Tabela, id: l.id }));
      void executar(chave, () => onRepasse(itens, acao, debitos[0].nome));
    } else setPedindoConta({ acao, lista });
  };

  const linha = (chave: string, icone: typeof Receipt, tom: string, titulo: string, detalhe: string, valor: number, rotulo: string, onClick: () => void, positivo = false) => (
    <li key={chave} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tom}`}><Ico icon={icone} size={16} /></span>
      <span className="grid min-w-0 flex-1 basis-40">
        <b className="truncate text-sm font-semibold">{titulo}</b>
        <span className="truncate text-xs text-muted">{detalhe}</span>
      </span>
      <b className={`shrink-0 text-sm tabular-nums ${positivo ? "text-pos" : ""}`}>{brl(valor)}</b>
      <button type="button" disabled={ocupado !== null} onClick={onClick} className="min-h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60 md:min-h-9">
        {ocupado === chave ? "Aguarde…" : rotulo}
      </button>
    </li>
  );

  return (
    <>
      <CartaoSecao titulo="Pendências" descricao={total === 0 ? undefined : "Resolva aqui, sem abrir outras telas"}>
        {total === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted"><Ico icon={CheckCircle2} size={18} className="text-pos" />Tudo em dia: nada para pagar ou confirmar agora.</p>
        ) : (
          <ul className="grid divide-y divide-line">
            {contasAPagar.map((c) => linha(`c:${c.id}`, Receipt, "bg-warn-bg text-warn", c.nome || "Conta fixa", c.vencimento ? `Conta fixa · vence dia ${c.vencimento}` : "Conta fixa", Number(c.valor) || 0, "Marcar paga", () => void executar(`c:${c.id}`, () => onPagarConta(String(c.id)))))}
            {faturas.map((f) => linha(`f:${f.cartao}:${f.mes}`, CreditCard, "bg-warn-bg text-warn", `Fatura ${f.cartao}`, f.pago > 0 ? `Já pago ${brl(f.pago)} de ${brl(f.total)}` : "Fatura em aberto", f.restante, "Pagar", () => setPagando(f)))}
            {receber.map(({ p, lista }) => linha(`r:${p.pessoaId}`, HandCoins, "bg-pos-bg text-pos", `${p.nome} repassou`, `Confirme que recebeu${lista.length > 1 ? ` (${lista.length} lançamentos)` : ""}`, arred(lista.reduce((t, l) => t + l.valor, 0)), "Recebi", () => repassar_("concluir", lista, `r:${p.pessoaId}`), true))}
            {repassar.map(({ p, lista }) => linha(`p:${p.pessoaId}`, HandCoins, "bg-warn-bg text-warn", `Você deve a ${p.nome}`, `Despesas que ${p.nome.split(" ")[0]} pagou por você${lista.length > 1 ? ` (${lista.length})` : ""}`, arred(lista.reduce((t, l) => t + l.valor, 0)), "Já devolvi", () => repassar_("informar", lista, `p:${p.pessoaId}`)))}
          </ul>
        )}
      </CartaoSecao>
      {pagando && (
        <PagarFaturaModal
          cartao={pagando.cartao} mes={pagando.mes} total={pagando.total} pago={pagando.pago} restante={pagando.restante}
          contas={pagamento} saldoDaConta={saldoDaConta} existentes={pagamentos} onRegistrar={registrar} onFechar={() => setPagando(null)}
        />
      )}
      {pedindoConta && (
        <EscolherContaRepasse
          modo={pedindoConta.acao === "concluir" ? "receber" : "repassar"}
          lista={pedindoConta.lista}
          dados={estado}
          userId={userId}
          mes={mes}
          onFechar={() => setPedindoConta(null)}
          onConfirmar={(conta) => {
            const { acao, lista } = pedindoConta;
            setPedindoConta(null);
            // Revalida contra a lista atual antes de gravar (nunca concluído, nunca de outra pessoa)
            const itens = lista.filter((l) => repasseValidoParaAcao(l, acao, userId)).map((l) => ({ origem: l.origem as Tabela, id: l.id }));
            if (itens.length === 0) return;
            void executar("lote", () => onRepasse(itens, acao, conta));
          }}
        />
      )}
    </>
  );
}
