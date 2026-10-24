"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Ico } from "@/components/icons";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Avatar from "./Avatar";

const PALETA_CORES = [
  "#10B981", // Verde
  "#6366F1", // Azul / Roxo
  "#F59E0B", // Amarelo / Laranja
  "#EC4899", // Rosa
  "#8B5CF6", // Roxo
  "#3B82F6", // Azul
  "#14B8A6", // Ciano
  "#EF4444", // Vermelho
];

export default function GrupoModal({ onClose }: { onClose: () => void }) {
  const [meuPerfil, setMeuPerfil] = useState<any>(null);
  const [membros, setMembros] = useState<any[]>([]);
  const [modo, setModo] = useState<"menu" | "criar" | "entrar">("menu");
  const [inputValor, setInputValor] = useState("");
  const [nomeConvidado, setNomeConvidado] = useState("");
  const [corConvidado, setCorConvidado] = useState("#10B981");
  const [adicionandoConvidado, setAdicionandoConvidado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarPerfilEMembros();

    // Atualiza a lista na hora quando a foto/nome é alterado em Configurações.
    const aoAtualizarPerfil = () => {
      carregarPerfilEMembros();
    };
    window.addEventListener("homecash:perfil", aoAtualizarPerfil);
    return () => window.removeEventListener("homecash:perfil", aoAtualizarPerfil);
  }, []);

  const carregarPerfilEMembros = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let { data: perfil } = await supabase
      .from("perfis")
      .select("*, grupos_familiares(nome, convite_codigo)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) {
      const nomePadrao = user.user_metadata?.full_name || user.email || "Usuário";
      const { error: erroCriacaoPerfil } = await supabase.rpc("garantir_meu_perfil", {
        p_nome_usuario: nomePadrao,
      });
      if (erroCriacaoPerfil) {
        console.error("Erro ao criar perfil:", erroCriacaoPerfil);
        return;
      }

      const { data: perfilCriado } = await supabase
        .from("perfis")
        .select("*, grupos_familiares(nome)")
        .eq("user_id", user.id)
        .maybeSingle();
      perfil = perfilCriado;
    }

    if (perfil) {
      setMeuPerfil(perfil);

      if (perfil.grupo_id) {
        const { data: listaMembros } = await supabase
          .from("perfis")
          .select("id, nome_usuario, cargo, eh_convidado, cor, avatar_url")
          .eq("grupo_id", perfil.grupo_id);

        if (listaMembros) setMembros(listaMembros);
      }
    }
  };

  const alterarCorMembro = async (membroId: string, novaCor: string) => {
    const { error } = await supabase.rpc("alterar_cor_perfil_grupo", {
      p_perfil_id: membroId,
      p_cor: novaCor,
    });

    if (error) {
      alert("Não foi possível alterar a cor: " + error.message);
      await carregarPerfilEMembros();
      return;
    }

    await carregarPerfilEMembros();
  };

  const gerenciarGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (modo === "criar") {
        const nomePadrao = user?.user_metadata?.full_name || user?.email || "Usuário";
        if (!user) throw new Error("Faça login novamente para criar um grupo.");

        const { error: erroGrupo } = await supabase.rpc("criar_grupo_familiar", {
          p_nome: inputValor.trim(),
          p_nome_usuario: nomePadrao,
        });
        if (erroGrupo) throw erroGrupo;

        alert("Grupo criado com sucesso!");
      }

      if (modo === "entrar") {
        const nomePadrao = user?.user_metadata?.full_name || user?.email || "Usuário";
        if (!user) throw new Error("Faça login novamente para entrar em um grupo.");

        const codigoConvite = inputValor.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(codigoConvite)) {
          throw new Error("Código do grupo inválido. Confira o código e tente novamente.");
        }

        const { error: erroEntrada } = await supabase.rpc("entrar_grupo_por_convite", {
          p_codigo_convite: codigoConvite,
          p_nome_usuario: nomePadrao,
        });

        if (erroEntrada) throw erroEntrada;

        alert("Você entrou no grupo!");
      }

      await carregarPerfilEMembros();
      setModo("menu");
    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setCarregando(false);
      setInputValor("");
    }
  };

  const adicionarConvidado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeConvidado.trim() || !meuPerfil?.grupo_id) return;
    setCarregando(true);

    const { error } = await supabase.rpc("adicionar_convidado_grupo", {
      p_nome: nomeConvidado.trim(),
      p_cor: corConvidado,
    });

    if (error) {
      alert("Erro ao adicionar convidado: " + error.message);
    } else {
      setNomeConvidado("");
      setAdicionandoConvidado(false);
      await carregarPerfilEMembros();
    }
    setCarregando(false);
  };

  const removerMembro = async (membroId: string) => {
    if (!confirm("Deseja remover esta pessoa do grupo?")) return;

    const { error } = await supabase.rpc("remover_perfil_grupo", {
      p_perfil_id: membroId,
    });

    if (error) {
      alert("Não foi possível remover esta pessoa. Verifique se você tem permissão para gerenciar o grupo.");
      console.error("Erro ao remover perfil do grupo:", error);
      return;
    }

    await carregarPerfilEMembros();
  };

  return (
    <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl border border-line relative">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 text-muted hover:text-ink">
          <Ico icon={X} />
        </button>

        <h2 className="text-2xl font-bold mb-6">Gerenciar Grupo</h2>

        {meuPerfil?.grupo_id ? (
          <div className="space-y-4">
            {/* Informações do Grupo */}
            <div className="p-4 bg-surface rounded-xl border border-line">
              <p className="text-xs text-muted">Grupo Atual</p>
              <p className="text-lg font-bold text-accent">{meuPerfil.grupos_familiares?.nome}</p>
            </div>

            {/* Código de Convite */}
            <div className="p-4 bg-slate-900/50 rounded-xl border border-line">
              <p className="text-sm mb-1 font-medium">Código para novos usuários</p>
              <code className="block p-2 bg-black/40 rounded text-xs select-all text-center text-emerald-400 font-mono">
                {meuPerfil.grupos_familiares?.convite_codigo}
              </code>
            </div>

            {/* Adicionar Convidado sem Conta */}
            {meuPerfil?.cargo === "gestor" && (
            <div className="border-t border-line pt-3">
              {!adicionandoConvidado ? (
                <button
                  onClick={() => setAdicionandoConvidado(true)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-accent text-accent hover:bg-accent/10 text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Ico icon={Plus} size={16} />Adicionar Convidado sem Conta
                </button>
              ) : (
                <form onSubmit={adicionarConvidado} className="space-y-3 bg-surface p-3 rounded-xl border border-line">
                  <label className="text-xs font-medium text-muted block">Nome do Convidado</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Vovô, Pai..."
                    value={nomeConvidado}
                    onChange={(e) => setNomeConvidado(e.target.value)}
                    className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />

                  {/* Seletor de Cor no Cadastro do Convidado */}
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Cor da Posição</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PALETA_CORES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCorConvidado(c)}
                          className={`h-6 w-6 rounded-full border-2 transition ${
                            corConvidado === c ? "border-ink scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAdicionandoConvidado(false)}
                      className="flex-1 text-xs py-2 rounded-lg border border-line hover:bg-muted/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={carregando}
                      className="flex-1 text-xs py-2 rounded-lg bg-accent text-on-accent font-medium hover:opacity-90"
                    >
                      {carregando ? "Salvando..." : "Salvar Convidado"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            )}

            {/* Lista de Membros e Seleção de Cor em Círculo */}
            <div>
              <p className="text-sm font-semibold mb-2">Pessoas no Grupo ({membros.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {membros.map((m) => (
                  <div key={m.id} className="flex justify-between items-center p-2.5 bg-surface rounded-xl border border-line text-sm">
                    <div className="flex items-center gap-3">
                      {/* Foto do perfil ou inicial do nome */}
                      <Avatar src={m.avatar_url} nome={m.nome_usuario} cor={m.cor} tamanho={36} />

                      {/* Seletor de cor circular */}
                      {meuPerfil?.cargo === "gestor" && (
                      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-line shadow-sm cursor-pointer">
                        <input
                          type="color"
                          value={m.cor || "#10B981"}
                          onChange={(e) => alterarCorMembro(m.id, e.target.value)}
                          className="absolute -inset-2 h-10 w-10 cursor-pointer border-0 bg-transparent p-0 outline-none"
                          title="Mudar cor desta pessoa"
                        />
                      </div>
                      )}

                      <div>
                        <p className="font-medium text-xs flex items-center gap-1.5">
                          {m.nome_usuario}
                          {m.eh_convidado && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded">
                              Convidado
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {meuPerfil?.cargo === "gestor" && m.id !== meuPerfil.id && (
                      <button
                        onClick={() => removerMembro(m.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
                      >
                        <Ico icon={Trash2} size={13} />Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : modo === "menu" ? (
          <div className="space-y-3">
            <button onClick={() => setModo("criar")} className="w-full p-4 rounded-xl bg-accent text-on-accent font-medium hover:opacity-90 transition">
              Criar Novo Grupo
            </button>
            <button onClick={() => setModo("entrar")} className="w-full p-4 rounded-xl bg-surface border border-line font-medium hover:bg-muted/10 transition">
              Entrar em um Grupo
            </button>
          </div>
        ) : (
          <form onSubmit={gerenciarGrupo} className="space-y-4">
            <label className="text-sm font-medium text-muted">
              {modo === "criar" ? "Nome do Grupo (ex: Casa Araguaína)" : "Cole o Código do Grupo"}
            </label>
            <input
              type="text"
              required
              value={inputValor}
              onChange={(e) => setInputValor(e.target.value)}
              placeholder={modo === "criar" ? "Nome do grupo..." : "Cole o ID aqui..."}
              className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm focus:ring-2 focus:ring-accent outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setModo("menu")} className="flex-1 p-3 rounded-xl bg-surface border border-line hover:bg-muted/10">
                Voltar
              </button>
              <button type="submit" disabled={carregando} className="flex-1 p-3 rounded-xl bg-accent text-on-accent font-medium hover:opacity-90 disabled:opacity-50">
                {carregando ? "Aguarde..." : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}