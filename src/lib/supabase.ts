import { createClient } from "@supabase/supabase-js";

/*
 * SEGURANÇA — leia antes de alterar este arquivo:
 *
 * - Este módulo roda no NAVEGADOR. Só a chave pública `anon` pode ser usada aqui.
 *   Ela é pública por desenho: quem protege os dados é o RLS no banco.
 * - NUNCA use `service_role` (nem `sb_secret_...`) neste projeto no cliente, e nunca
 *   dê a ela um nome com prefixo `NEXT_PUBLIC_` (esse prefixo embute o valor no bundle).
 * - Não existe valor padrão (fallback) de propósito: se a variável faltar, falhamos
 *   alto em vez de apontar silenciosamente para outro projeto/banco.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Configuração ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "(local: copie .env.example para .env.local; produção: Vercel → Settings → Environment Variables).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
