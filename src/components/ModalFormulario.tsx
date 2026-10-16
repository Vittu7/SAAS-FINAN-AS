"use client";

import type { ReactNode } from "react";

type Props = {
    aberto: boolean;
    titulo: string;
    onFechar: () => void;
    children: ReactNode;
};

export default function ModalFormulario({
    aberto,
    titulo,
    onFechar,
    children,
}: Props) {
    if (!aberto) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onFechar();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label={titulo}
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl md:p-6"
            >
                <header className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
                    <button
                        type="button"
                        onClick={onFechar}
                        aria-label="Fechar formulário"
                        className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-background hover:text-ink"
                    >
                        ✕
                    </button>
                </header>

                {children}
            </section>
        </div>
    );
}