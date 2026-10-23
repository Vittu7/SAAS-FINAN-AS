
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Avatar from "./Avatar";

const PALETA_CORES = [
  "#10B981",
  "#6366F1",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#3B82F6",
  "#14B8A6",
  "#EF4444",
];

type Perfil = {
  id: string;
  user_id: string | null;
  nome_usuario: string | null;
  grupo_id: string | null;
  cargo: string | null;
  eh_convidado: boolean | null;
  cor: string | null;
  avatar_url: string | null;
  grupos_familiares?: { nome: string } | null;
};

export default function GrupoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [meuPerfil, setMeuPerfil] = useState<Perfil | null>(null);
  const [membros, setMembros] = useState<Perfil[]>([]);
  const [modo, setModo] = useState<"menu" | "criar" | "entrar">("menu");
  const [inputValor, setInputValor] = useState("");
  const [codigoConvite, setCodigoConvite] = useState("");
  const [nomeConvidado, setNomeConvidado] = useState("");
  const [corConvidado, setCorConvidado] = useState("#10B981");
  const [adicionandoConvidado, setAdicionandoConvidado] =
    useState(false);
  const [carregando, setCarregando] = useState(false);

  const souGestor = meuPerfil?.cargo === "gestor";

  const carregarPerfilEMembros = useCallback(async () => {
    const {
      data: { user },
      error: erroAuth,
    } = await supabase.auth.getUser();

    if (erroAuth || !user) {
      setMeuPerfil(null);
      setMembros([]);
      return;
    }

    const { data: perfil, error: erroPerfil } = await supabase
      .from("perfis")
      .select("*, grupos_familiares(nome)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (erroPerfil) {
      throw erroPerfil;
    }

    if (!perfil) {
      setMeuPerfil(null);
      setMembros([]);
      throw new Error(
        "Seu perfil não foi encontrado. Faça a configuração inicial da sua conta."
      );
    }

    setMeuPerfil(perfil as Perfil);

    if (!perfil.grupo_id) {
      setMembros([]);
      return;
    }

    const { data: listaMembros, error: erroMembros } = await supabase
      .from("perfis")
      .select(
        "id, user_id, nome_usuario, grupo_id, cargo, eh_convidado, cor, avatar_url"
      )
      .eq("grupo_id", perfil.grupo_id)
      .order("nome_usuario");

    if (erroMembros) {
      throw erroMembros;
    }

    setMembros((listaMembros ?? []) as Perfil[]);
  }, []);

  useEffect(() => {
    const carregar = async () => {
      try {
        await carregarPerfilEMembros();
      } catch (error) {
        console.error("Erro ao carregar grupo:", error);
      }
    };

    void carregar();

    const aoAtualizarPerfil = () => {
      void carregar();
    };

    window.addEventListener("homecash:perfil", aoAtualizarPerfil);

    return () => {
      window.removeEventListener("homecash:perfil", aoAtualizarPerfil);
    };
  }, [carregarPerfilEMembros]);

  const executarAcao = async (
    acao: () => Promise<void>,
    mensagemSucesso?: string
  ) => {
    setCarregando(true);

    try {
      await acao();
      await carregarPerfilEMembros();

      if (mensagemSucesso) {
        alert(mensagemSucesso);
      }
    } catch (error: unknown) {
      console.error("Erro detalhado na operação:", error);

      let mensagem = "Erro desconhecido.";

      if (error instanceof Error) {
        mensagem = error.message;
      } else if (typeof error === "object" && error !== null) {
        const erro = error as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        mensagem = [
          erro.message,
          erro.details,
          erro.hint,
          erro.code ? `Código: ${erro.code}` : undefined,
        ]
          .filter(Boolean)
          .join("\n");
      } else {
        mensagem = String(error);
      }

      alert("Não foi possível concluir a operação:\n" + mensagem);
    } finally {
      setCarregando(false);
    }
  };

  const gerenciarGrupo = async (e: React.FormEvent) => {
    e.preventDefault();

    const valor = inputValor.trim();

    if (!valor) {
      alert("Preencha o campo.");
      return;
    }

    await executarAcao(async () => {
      if (modo === "criar") {
        const { data, error } = await supabase.rpc(
          "criar_grupo_familiar",
          { p_nome: valor }
        );

        if (error) throw error;
        if (!data) throw new Error("O Supabase não retornou o ID do grupo.");

        setModo("menu");
        setInputValor("");
        return;
      }

      if (modo === "entrar") {
        const { error } = await supabase.rpc("entrar_grupo_por_convite", {
          p_codigo: valor.toUpperCase(),
        });

        if (error) throw error;

        setModo("menu");
        setInputValor("");
      }
    }, modo === "criar"
      ? "Grupo criado! Você é o gestor."
      : "Você entrou no grupo!");
  };

  const gerarConvite = async () => {
    if (!souGestor) {
      alert("Somente o gestor pode gerar convites.");
      return;
    }

    await executarAcao(async () => {
      const { data, error } = await supabase.rpc(
        "gerar_convite_grupo_familiar"
      );

      if (error) throw error;
      if (typeof data !== "string" || !data) {
        throw new Error("O Supabase não retornou o código do convite.");
      }

      setCodigoConvite(data);
    }, "Convite gerado! Compartilhe o código com a pessoa que deseja adicionar.");
  };

  const copiarConvite = async () => {
    if (!codigoConvite) return;

    try {
      await navigator.clipboard.writeText(codigoConvite);
      alert("Código copiado!");
    } catch {
      alert("Não foi possível copiar automaticamente. Selecione e copie o código.");
    }
  };

  const adicionarConvidado = async (e: React.FormEvent) => {
    e.preventDefault();

    const nome = nomeConvidado.trim();

    if (!nome) {
      alert("Informe o nome do convidado.");
      return;
    }

    if (!souGestor) {
      alert("Somente o gestor pode adicionar convidados.");
      return;
    }

    await executarAcao(async () => {
      const { error } = await supabase.rpc("adicionar_convidado_grupo", {
        p_nome: nome,
        p_cor: corConvidado,
      });

      if (error) throw error;

      setNomeConvidado("");
      setCorConvidado("#10B981");
      setAdicionandoConvidado(false);
    }, "Convidado adicionado com sucesso!");
  };

  const alterarCorMembro = async (
    membroId: string,
    novaCor: string
  ) => {
    if (!souGestor) return;

    await executarAcao(async () => {
      const { error } = await supabase.rpc("alterar_cor_membro_grupo", {
        p_perfil_id: membroId,
        p_cor: novaCor,
      });

      if (error) throw error;
    });
  };

  const removerMembro = async (membro: Perfil) => {
    if (!souGestor) {
      alert("Somente o gestor pode remover membros.");
      return;
    }

    if (membro.id === meuPerfil?.id) {
      alert("O gestor não pode remover o próprio perfil por esta opção.");
      return;
    }

    const nome = membro.nome_usuario || "este membro";

    if (!confirm(`Deseja remover ${nome} do grupo?`)) {
      return;
    }

    await executarAcao(async () => {
      const { error } = await supabase.rpc("remover_membro_grupo", {
        p_perfil_id: membro.id,
      });

      if (error) throw error;
    }, `${nome} foi removido do grupo.`);
  };

  return (
    <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-background p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted hover:text-ink"
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 className="mb-6 text-2xl font-bold">Gerenciar Grupo</h2>

        {meuPerfil?.grupo_id ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-muted">Grupo atual</p>
              <p className="text-lg font-bold text-accent">
                {meuPerfil.grupos_familiares?.nome ?? "Grupo familiar"}
              </p>
              <p className="mt-1 text-sm text-muted">
                Seu cargo: <strong>{meuPerfil.cargo ?? "membro"}</strong>
              </p>
              {souGestor && (
                <p className="mt-1 text-xs text-muted">
                  Você é o gestor deste grupo.
                </p>
              )}
            </div>

            {souGestor && (
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="mb-1 text-sm font-semibold">Convite para novos membros</p>
                <p className="mb-3 text-xs text-muted">
                  Gere um código de uso único, válido por 7 dias. A pessoa precisa ter uma conta no aplicativo.
                </p>
                <button
                  type="button"
                  onClick={() => void gerarConvite()}
                  disabled={carregando}
                  className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-medium text-on-accent disabled:opacity-50"
                >
                  {carregando ? "Gerando..." : "Gerar código de convite"}
                </button>

                {codigoConvite && (
                  <div className="mt-3 space-y-2">
                    <code className="block select-all break-all rounded-lg border border-line bg-background p-3 text-center font-mono text-sm text-accent">
                      {codigoConvite}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copiarConvite()}
                      className="w-full rounded-xl border border-line px-3 py-2 text-sm hover:bg-muted/10"
                    >
                      Copiar código
                    </button>
                  </div>
                )}
              </div>
            )}

            {souGestor && (
              <div className="border-t border-line pt-3">
                {!adicionandoConvidado ? (
                  <button
                    type="button"
                    onClick={() => setAdicionandoConvidado(true)}
                    className="w-full rounded-xl border border-dashed border-accent px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
                  >
                    ➕ Adicionar convidado sem conta
                  </button>
                ) : (
                  <form
                    onSubmit={adicionarConvidado}
                    className="space-y-3 rounded-xl border border-line bg-surface p-3"
                  >
                    <label className="block text-xs font-medium text-muted">
                      Nome do convidado
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={nomeConvidado}
                      onChange={(e) => setNomeConvidado(e.target.value)}
                      placeholder="Ex.: Pai, Mãe, Vovô"
                      className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                    />

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">
                        Cor do perfil
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PALETA_CORES.map((cor) => (
                          <button
                            key={cor}
                            type="button"
                            onClick={() => setCorConvidado(cor)}
                            aria-label={`Selecionar cor ${cor}`}
                            className={`h-6 w-6 rounded-full border-2 transition ${corConvidado === cor
                              ? "scale-110 border-ink"
                              : "border-transparent"
                              }`}
                            style={{ backgroundColor: cor }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAdicionandoConvidado(false)}
                        className="flex-1 rounded-lg border border-line py-2 text-xs hover:bg-muted/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={carregando}
                        className="flex-1 rounded-lg bg-accent py-2 text-xs font-medium text-on-accent disabled:opacity-50"
                      >
                        {carregando ? "Salvando..." : "Salvar convidado"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold">
                Pessoas no grupo ({membros.length})
              </p>

              {membros.length === 0 ? (
                <p className="text-sm text-muted">
                  Nenhum membro encontrado.
                </p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {membros.map((membro) => (
                    <div
                      key={membro.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-2.5 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          src={membro.avatar_url}
                          nome={membro.nome_usuario ?? "Membro"}
                          cor={membro.cor ?? "#10B981"}
                          tamanho={36}
                        />

                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                            <span>{membro.nome_usuario ?? "Sem nome"}</span>
                            {membro.id === meuPerfil.id && (
                              <span className="text-accent">(Você)</span>
                            )}
                            {membro.cargo === "gestor" && (
                              <span className="rounded border border-accent/30 px-1 text-[9px] text-accent">
                                Gestor
                              </span>
                            )}
                            {membro.eh_convidado && (
                              <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1 text-[9px] text-amber-400">
                                Convidado
                              </span>
                            )}
                          </p>

                          {souGestor && (
                            <div
                              className="relative mt-1 h-6 w-6 shrink-0 overflow-hidden rounded-full border border-line shadow-sm cursor-pointer"
                              style={{ backgroundColor: membro.cor ?? "#10B981" }}
                            >
                              <input
                                type="color"
                                value={membro.cor ?? "#10B981"}
                                onChange={(e) =>
                                  void alterarCorMembro(
                                    membro.id,
                                    e.target.value
                                  )
                                }
                                className="absolute -inset-2 h-10 w-10 cursor-pointer border-0 bg-transparent p-0 outline-none"
                                title="Alterar cor do perfil"
                                aria-label={`Alterar cor de ${membro.nome_usuario ?? "membro"}`}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {souGestor && membro.id !== meuPerfil.id && (
                        <button
                          type="button"
                          disabled={carregando}
                          onClick={() => void removerMembro(membro)}
                          className="shrink-0 text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : modo === "menu" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setModo("criar")}
              className="w-full rounded-xl bg-accent p-4 font-medium text-on-accent transition hover:opacity-90"
            >
              Criar novo grupo
            </button>
            <button
              type="button"
              onClick={() => setModo("entrar")}
              className="w-full rounded-xl border border-line bg-surface p-4 font-medium transition hover:bg-muted/10"
            >
              Entrar em um grupo
            </button>
          </div>
        ) : (
          <form onSubmit={gerenciarGrupo} className="space-y-4">
            <label className="text-sm font-medium text-muted">
              {modo === "criar"
                ? "Nome do grupo"
                : "Código de convite"}
            </label>
            <input
              type="text"
              required
              maxLength={modo === "criar" ? 80 : 20}
              value={inputValor}
              onChange={(e) => setInputValor(e.target.value)}
              placeholder={
                modo === "criar"
                  ? "Ex.: Casa Araguaína"
                  : "Cole o código de convite"
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setModo("menu");
                  setInputValor("");
                }}
                className="flex-1 rounded-xl border border-line bg-surface p-3 hover:bg-muted/10"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={carregando}
                className="flex-1 rounded-xl bg-accent p-3 font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                {carregando ? "Aguarde..." : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
