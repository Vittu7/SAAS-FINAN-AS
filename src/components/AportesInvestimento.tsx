"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { brl, parseValor } from "@/lib/finance";
import { supabase } from "@/lib/supabase";

type Aporte = {
    id: string;
    user_id: string;
    valor: number;
};

type Props = {
    saldoAnterior: number;
};

export default function AportesInvestimento({ saldoAnterior }: Props) {
    const [aportes, setAportes] = useState<Aporte[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [valorTexto, setValorTexto] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");

    const carregarAportes = useCallback(async (id: string) => {
        const { data, error } = await supabase
            .from("aportes_investimento")
            .select("id, user_id, valor")
            .eq("user_id", id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Erro ao carregar aportes:", error);
            setMensagem(`Erro ao carregar aportes: ${error.message}`);
            return;
        }

        setAportes((data || []) as Aporte[]);
    }, []);

    useEffect(() => {
        let ativo = true;

        const iniciar = async () => {
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();

            if (!ativo) return;

            if (error || !user) {
                setMensagem("Entre na sua conta para ver os aportes.");
                setCarregando(false);
                return;
            }

            setUserId(user.id);
            await carregarAportes(user.id);

            if (ativo) setCarregando(false);
        };

        iniciar();

        return () => {
            ativo = false;
        };
    }, [carregarAportes]);

    const totalAportes = useMemo(
        () => aportes.reduce((total, aporte) => total + Number(aporte.valor || 0), 0),
        [aportes],
    );

    const saldoTotal = Number(saldoAnterior || 0) + totalAportes;

    const registrarAporte = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMensagem("");

        if (!userId) {
            setMensagem("Entre na sua conta antes de registrar um aporte.");
            return;
        }

        const valor = parseValor(valorTexto);

        if (!Number.isFinite(valor) || valor <= 0) {
            setMensagem("Informe um valor maior que zero.");
            return;
        }

        setSalvando(true);

        const { data, error } = await supabase
            .from("aportes_investimento")
            .insert({
                user_id: userId,
                valor,
            })
            .select("id, user_id, valor")
            .single();

        if (error) {
            console.error("Erro ao registrar aporte:", error);
            setMensagem(`Não foi possível salvar o aporte: ${error.message}`);
            setSalvando(false);
            return;
        }

        setAportes((lista) => [data as Aporte, ...lista]);
        setValorTexto("");
        setMensagem("Aporte registrado com sucesso.");
        setSalvando(false);
    };

    const excluirAporte = async (id: string) => {
        if (!confirm("Deseja excluir este aporte?")) return;

        setMensagem("");

        const { error } = await supabase
            .from("aportes_investimento")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) {
            console.error("Erro ao excluir aporte:", error);
            setMensagem(`Não foi possível excluir o aporte: ${error.message}`);
            return;
        }

        setAportes((lista) => lista.filter((aporte) => aporte.id !== id));
        setMensagem("Aporte excluído.");
    };

        return (
        <div>
            <div className="mb-4">
                <p className="text-sm text-muted">Investido</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{brl(saldoTotal)}</p>
                {saldoAnterior > 0 && (
                    <p className="mt-1 text-xs text-muted">
                        Saldo anterior: {brl(saldoAnterior)} · Novos aportes: {brl(totalAportes)}
                    </p>
                )}
            </div>

            <form onSubmit={registrarAporte} className="space-y-3">
                <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">
                        Valor do aporte
                    </span>
                    <div className="flex items-center rounded-xl border border-line bg-background px-3 focus-within:ring-2 focus-within:ring-accent">
                        <span className="mr-2 text-sm text-muted">R$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={valorTexto}
                            onChange={(e) => setValorTexto(e.target.value)}
                            className="w-full bg-transparent py-2 text-sm text-ink outline-none"
                        />
                    </div>
                </label>

                <button
                    type="submit"
                    disabled={salvando || carregando}
                    className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition hover:opacity-90 disabled:opacity-60"
                >
                    {salvando ? "Salvando..." : "Registrar aporte"}
                </button>
            </form>

            {mensagem && (
                <p className="mt-3 text-xs text-muted" role="status">
                    {mensagem}
                </p>
            )}

            <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Histórico de aportes
                </h3>

                {carregando ? (
                    <p className="text-sm text-muted">Carregando...</p>
                ) : aportes.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum aporte registrado ainda.</p>
                ) : (
                    <ul className="max-h-56 space-y-2 overflow-y-auto">
                        {aportes.map((aporte) => (
                            <li
                                key={aporte.id}
                                className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-ink">
                                        {brl(Number(aporte.valor))}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => excluirAporte(aporte.id)}
                                    className="shrink-0 text-xs text-red-400 hover:underline"
                                    aria-label={`Excluir aporte de ${brl(Number(aporte.valor))}`}
                                >
                                    Excluir
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
