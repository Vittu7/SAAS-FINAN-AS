import { createClient } from "@supabase/supabase-js";

// URL e chave pública (anon) do projeto, definidas em .env.local e nas variáveis de ambiente da Vercel:
//   NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (login com o Google não funciona sem elas).");
}

// Valores provisórios só evitam que o build quebre; o login só funciona com as variáveis reais.
export const supabase = createClient(supabaseUrl || "https://projeto-nao-configurado.supabase.co", supabaseAnonKey || "chave-nao-configurada");
