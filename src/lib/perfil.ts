/**
 * Perfil do usuário (tabela "perfis"). Garante que a linha EXISTA antes de salvar:
 * antes, quem acabava de se cadastrar não tinha linha e o "Salvar" não gravava nada, sem avisar.
 */
import { reduzirImagem } from "./imagem";

type Usuario = { id: string; email?: string | null; user_metadata?: Record<string, any> | null };

// Interface mínima do cliente Supabase usada aqui (facilita testar com um falso).
type Cliente = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabela: string) => any;
  auth: { updateUser: (dados: any) => Promise<any> };
  storage: { from: (bucket: string) => any };
};

export type PerfilBasico = { id: string; nome_usuario: string | null; avatar_url: string | null };

export function nomePadrao(user: Usuario): string {
  const meta = user.user_metadata || {};
  const nome = String(meta.full_name || meta.name || "").trim();
  if (nome) return nome;
  const prefixo = String(user.email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return prefixo ? prefixo.charAt(0).toUpperCase() + prefixo.slice(1) : "Usuário";
}

export const avatarDoProvedor = (user: Usuario): string | null => user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

/** Busca o perfil; se ainda não existir, cria. Nunca sobrescreve um perfil existente. */
export async function garantirPerfil(client: Cliente, user: Usuario): Promise<PerfilBasico> {
  const buscar = async () => {
    const { data } = await client.from("perfis").select("id, nome_usuario, avatar_url").eq("id", user.id).maybeSingle();
    return data as PerfilBasico | null;
  };

  const existente = await buscar();
  if (existente) return existente;

  const { error } = await client.from("perfis").insert({
    id: user.id,
    user_id: user.id,
    nome_usuario: nomePadrao(user),
    avatar_url: avatarDoProvedor(user),
    cargo: "membro",
    cor: "#10B981",
  });
  // Se outra aba criou ao mesmo tempo, apenas lemos de novo.
  const criado = await buscar();
  if (!criado) throw new Error(error?.message || "Não foi possível criar o seu perfil.");
  return criado;
}

/** Salva nome e/ou foto e CONFIRMA que o banco gravou (linha devolvida). */
export async function salvarPerfil(client: Cliente, user: Usuario, dados: { nome?: string; avatar_url?: string | null }): Promise<PerfilBasico> {
  await garantirPerfil(client, user);

  const patch: Record<string, unknown> = {};
  if (dados.nome !== undefined) patch.nome_usuario = dados.nome.trim();
  if (dados.avatar_url !== undefined) patch.avatar_url = dados.avatar_url;

  const { data, error } = await client.from("perfis").update(patch).eq("id", user.id).select("id, nome_usuario, avatar_url").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("O servidor não confirmou o salvamento (permissão negada). Saia e entre novamente; se continuar, execute o script supabase-03-auth-perfil.sql.");

  // Cópia nos dados da conta: o nome e a foto continuam disponíveis mesmo se a tabela estiver indisponível.
  try {
    const meta: Record<string, unknown> = {};
    if (dados.nome !== undefined) meta.full_name = dados.nome.trim();
    if (dados.avatar_url !== undefined) meta.avatar_url = dados.avatar_url;
    await client.auth.updateUser({ data: meta });
  } catch {
    /* a tabela perfis é a fonte principal */
  }
  return data as PerfilBasico;
}

/** Reduz, envia ao Storage e grava a URL no perfil. */
export async function enviarFotoPerfil(client: Cliente, user: Usuario, arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha uma imagem (JPG, PNG ou WEBP).");
  if (arquivo.size > 15 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 15 MB.");

  const blob = await reduzirImagem(arquivo);
  // Mesmo limite do bucket avatars (supabase-21): só estoura se o navegador não conseguiu reduzir a foto.
  if (blob.size > 5 * 1024 * 1024) throw new Error("Não foi possível reduzir esta imagem. Use um JPG ou PNG menor que 5 MB.");
  const ext = blob.type === "image/jpeg" ? "jpg" : (arquivo.name.split(".").pop() || "jpg").toLowerCase();
  const caminho = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error } = await client.storage.from("avatars").upload(caminho, blob, { upsert: true, contentType: blob.type || arquivo.type });
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}. Verifique se o script supabase-03-auth-perfil.sql foi executado.`);

  const { data } = client.storage.from("avatars").getPublicUrl(caminho);
  await salvarPerfil(client, user, { avatar_url: data.publicUrl });
  return data.publicUrl as string;
}

export const avisarPerfilAtualizado = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("homecash:perfil"));
};

type ClienteGrupo = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabela: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
};

/**
 * Altera a cor de uma pessoa do grupo.
 * - A própria cor: update direto, confirmando que o banco gravou a linha.
 * - A cor de outra pessoa: só o gestor, pela função alterar_cor_membro_grupo (o RLS não deixa
 *   ninguém alterar o perfil de outra pessoa; antes o update voltava sem erro e a tela dizia "Cor atualizada").
 */
export async function alterarCorMembro(client: ClienteGrupo, meuId: string, membroId: string, cor: string): Promise<void> {
  if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) throw new Error("Cor inválida.");

  if (membroId === meuId) {
    const { data, error } = await client.from("perfis").update({ cor }).eq("id", meuId).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("O servidor não confirmou a alteração da cor.");
    return;
  }

  const { error } = await client.rpc("alterar_cor_membro_grupo", { p_perfil_id: membroId, p_cor: cor });
  if (error) throw new Error(error.message);
}
