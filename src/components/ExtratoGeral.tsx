"use client";

import { brl } from "@/lib/finance";

type Props = {
    mes: string;
    extrato: any[];
    cartao: any[];
    contas: any[];
};

export default function ExtratoGeral({
    mes,
    extrato,
    cartao,
    contas,
}: Props) {
    const linhas = [
        ...extrato.map((item) => ({
            id: `extrato-${item.id}`,
            data: item.mes,
            tipo: "Lançamento",
            descricao: item.descricao || "—",
            categoria: item.categoria || "—",
            forma: item.pagamento || "—",
            responsavel: item.responsavel || "—",
            valor: Number(item.valor) || 0,
            status: "Registrado",
        })),
        ...cartao.map((item) => ({
            id: `cartao-${item.id}`,
            data: item.mes,
            tipo: "Parcelado",
            descricao: item.descricao || item.nome || "—",
            categoria: item.categoria || "—",
            forma: item.cartao || "—",
            responsavel: item.responsavel || "—",
            valor: Number(item.valor) || 0,
            status: `Parcela ${item.parcelaAtual ?? item.parcela_atual ?? 1}/${item.parcelaTotal ?? item.parcela_total ?? 1}`,
        })),
        ...contas.map((item) => ({
            id: `conta-${item.id}`,
            data: item.mes,
            tipo: "Conta fixa",
            descricao: item.nome || "—",
            categoria: item.categoria || "—",
            forma: item.forma_pagamento || "—",
            responsavel: item.responsavel || "—",
            valor: Number(item.valor) || 0,
            status: item.pago ? "Paga" : "Pendente",
        })),
    ]
        .filter((item) => item.data === mes)
        .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));

    const total = linhas.reduce((soma, item) => soma + item.valor, 0);

    return (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-lg md:p-6">
            <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Extrato do mês</h2>
                    <p className="text-sm text-muted">
                        Lançamentos normais, parcelas e contas fixas.
                    </p>
                </div>
                <p className="text-sm font-semibold">
                    Total: <span className="tabular-nums">{brl(total)}</span>
                </p>
            </header>

            {linhas.length === 0 ? (
                <p className="rounded-xl border border-line bg-background p-4 text-sm text-muted">
                    Não há movimentações neste mês.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-line text-xs text-muted">
                                <th className="py-3 pr-3">Tipo</th>
                                <th className="py-3 pr-3">Descrição</th>
                                <th className="py-3 pr-3">Categoria</th>
                                <th className="py-3 pr-3">Forma de pagamento</th>
                                <th className="py-3 pr-3">Responsável</th>
                                <th className="py-3 pr-3">Status</th>
                                <th className="py-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map((item) => (
                                <tr key={item.id} className="border-b border-line/50 last:border-0">
                                    <td className="py-3 pr-3">{item.tipo}</td>
                                    <td className="py-3 pr-3 font-medium">{item.descricao}</td>
                                    <td className="py-3 pr-3">{item.categoria}</td>
                                    <td className="py-3 pr-3">{item.forma}</td>
                                    <td className="py-3 pr-3">{item.responsavel}</td>
                                    <td className="py-3 pr-3 text-muted">{item.status}</td>
                                    <td className="py-3 text-right font-semibold tabular-nums">
                                        {brl(item.valor)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}