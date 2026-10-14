"use client";

import { useEffect, useState } from "react";
import { parseValor } from "@/lib/finance";
import { supabase } from "@/lib/supabase";

export const campo =
  "h-9 w-full rounded-lg border border-line bg-background px-2.5 text-sm text-ink outline-none placeholder:text-muted/70 focus-visible:ring-2 focus-visible:ring-accent";

export const botaoPrimario =
  "h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function BadgeResponsavel({ r }: { r: string }) {
  const [cor, setCor] = useState("#10b981");

  useEffect(() => {
    async function buscarCor() {
      const { data } = await supabase
        .from("perfis")
        .select("cor")
        .eq("nome_usuario", r)
        .maybeSingle();
      if (data?.cor) setCor(data.cor);
    }
    buscarCor();
  }, [r]);

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      {r}
    </span>
  );
}

export function SelectResponsavel({
  value,
  onChange,
  form,
}: {
  value: string;
  onChange: (r: string) => void;
  form?: string;
}) {
  const [membros, setMembros] = useState<string[]>([]);

  useEffect(() => {
    async function carregarMembros() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await supabase
        .from("perfis")
        .select("grupo_id, nome_usuario")
        .eq("user_id", user.id)
        .maybeSingle();

      if (perfil?.grupo_id) {
        const { data } = await supabase
          .from("perfis")
          .select("nome_usuario")
          .eq("grupo_id", perfil.grupo_id);

        if (data && data.length > 0) {
          setMembros(data.map((m) => m.nome_usuario).filter(Boolean));
          return;
        }
      }
      if (perfil?.nome_usuario) {
        setMembros([perfil.nome_usuario]);
      }
    }
    carregarMembros();
  }, []);

  return (
    <select
      form={form}
      aria-label="Responsável"
      className={campo}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {membros.map((m) => (
        <option key={m} value={m} className="bg-surface text-ink">
          {m}
        </option>
      ))}
    </select>
  );
}

export function BotaoRemover({ onClick, rotulo }: { onClick: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remover ${rotulo}`}
      className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-rose-500/10 hover:text-rose-500 focus-visible:ring-2 focus-visible:ring-rose-500"
    >
      Remover
    </button>
  );
}

/** Campo de valor em R$ que só grava ao sair do campo (blur). */
export function ValorEditavel({
  valor,
  onChange,
  rotulo,
}: {
  valor: number;
  onChange: (n: number) => void;
  rotulo: string;
}) {
  const [txt, setTxt] = useState(valor ? String(valor).replace(".", ",") : "");

  useEffect(() => {
    setTxt(valor ? String(valor).replace(".", ",") : "");
  }, [valor]);

  return (
    <input
      aria-label={rotulo}
      inputMode="decimal"
      placeholder="0,00"
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => onChange(parseValor(txt))}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-sm tabular-nums outline-none hover:border-line focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
    />
  );
}