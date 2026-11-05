import { createClient } from "@supabase/supabase-js";

// As chaves vêm do .env.local (local) ou das variáveis de ambiente da Vercel (produção).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (veja o README).");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
