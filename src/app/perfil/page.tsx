"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PerfilPage() {
  const router = useRouter();
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [grupoNome, setGrupoNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");

    setEmail(user.email || "");

    const { data: perfil } = await supabase
      .from("perfis")
      .select("*, grupos_familiares(nome)")
      .eq("id", user.id)
      .maybeSingle();

    if (perfil) {
      setNomeUsuario(perfil.nome_usuario || "");
      setGrupoNome(perfil.grupos_familiares?.nome || "Sem grupo vinculado");
    }
    setCarregando(false);
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("perfis")
      .update({ nome_usuario: nomeUsuario })
      .eq("id", user.id);

    if (error) {
      alert("Erro ao atualizar nome: " + error.message);
    } else {
      alert("Perfil atualizado com sucesso!");
    }
    setSalvando(false);
  };

  if (carregando) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted">Carregando perfil...</main>;
  }

  return (
    <main className="max-w-2xl mx-auto p-6 md:p-10 space-y-6">
      <button
        onClick={() => router.push("/")}
        className="text-sm text-muted hover:text-ink flex items-center gap-1 transition"
      >
        ← Voltar ao Painel Principal
      </button>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-4 border-b border-line pb-4">
          <div className="h-16 w-16 rounded-2xl bg-accent text-on-accent font-bold text-2xl flex items-center justify-center">
            {nomeUsuario ? nomeUsuario[0].toUpperCase() : "👤"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{nomeUsuario || "Meu Perfil"}</h1>
            <p className="text-xs text-muted">{email}</p>
          </div>
        </div>

        <form onSubmit={salvarPerfil} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Nome de Exibição no App</label>
            <input
              type="text"
              required
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm focus:ring-2 focus:ring-accent outline-none"
              placeholder="Ex: Vittor"
            />
            <p className="text-xs text-muted mt-1">
              Este é o nome que aparecerá no painel "Quem gastou quanto" e nas despesas da família.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">E-mail de Login</label>
            <input
              type="text"
              disabled
              value={email}
              className="w-full rounded-xl border border-line bg-background/50 px-4 py-2.5 text-sm text-muted cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Grupo Financeiro Atual</label>
            <input
              type="text"
              disabled
              value={grupoNome}
              className="w-full rounded-xl border border-line bg-background/50 px-4 py-2.5 text-sm text-muted cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-accent text-on-accent py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar Alterações"}
          </button>
        </form>
      </div>
    </main>
  );
}