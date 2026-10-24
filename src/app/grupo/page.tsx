"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type PerfilGrupo = {
  id: string;
  grupo_id: string | null;
  cargo: string | null;
  grupos_familiares: { nome: string; convite_codigo: string } | null;
};

export default function FamiliaPage() {
  const router = useRouter();
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [meuPerfil, setMeuPerfil] = useState<PerfilGrupo | null>(null);

  const carregarPerfil = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("perfis")
      .select("id, grupo_id, cargo, grupos_familiares(nome, convite_codigo)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) setMeuPerfil(data as unknown as PerfilGrupo);
  }, [router]);

  useEffect(() => {
    void carregarPerfil();
  }, [carregarPerfil]);

  const criarGrupo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCarregando(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login novamente para criar um grupo.");

      const nomePadrao = user.user_metadata?.full_name || user.email || "Usuário";
      const { error } = await supabase.rpc("criar_grupo_familiar", {
        p_nome: nomeGrupo.trim(),
        p_nome_usuario: nomePadrao,
      });

      if (error) throw error;

      alert("Grupo familiar criado com sucesso!");
      await carregarPerfil();
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : "Erro inesperado.";
      alert("Erro ao criar grupo: " + mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Gerenciamento Familiar</h1>

      {meuPerfil?.grupo_id ? (
        <div className="bg-surface p-6 rounded-xl border border-line">
          <h2 className="text-xl font-semibold mb-2">
            Seu Grupo: <span className="text-accent">{meuPerfil.grupos_familiares?.nome}</span>
          </h2>
          <p className="text-muted mb-4">Você é o <strong>{meuPerfil.cargo}</strong> deste grupo.</p>
          <div className="bg-background p-4 rounded-lg border border-line">
            <p className="text-sm">Para convidar sua mãe ou pai, peça para eles criarem uma conta e informe este código de convite para eles entrarem:</p>
            <code className="block mt-2 p-2 bg-surface rounded text-xs select-all">
              {meuPerfil.grupos_familiares?.convite_codigo}
            </code>
          </div>
        </div>
      ) : (
        <form onSubmit={criarGrupo} className="bg-surface p-6 rounded-xl border border-line space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Criar um Novo Grupo Familiar</h2>
            <p className="text-sm text-muted mb-4">Crie um grupo para compartilhar despesas com seus familiares.</p>
            <label className="text-xs font-medium text-muted block mb-1">Nome do Grupo (ex: Casa Araguaína)</label>
            <input
              type="text"
              required
              value={nomeGrupo}
              onChange={(e) => setNomeGrupo(e.target.value)}
              className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              placeholder="Digite o nome do grupo..."
            />
          </div>
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-accent text-on-accent py-2 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {carregando ? "Criando..." : "Criar Grupo"}
          </button>
        </form>
      )}
    </main>
  );
}
