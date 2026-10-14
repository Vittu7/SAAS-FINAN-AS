import { createClient } from "@supabase/supabase-js";

// Chaves injetadas diretamente para garantir o funcionamento local do SaaS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iitgqormevgnxikwyvu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdGdxb3JtZXZnbnhpa3d5dnUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcyMzg1NjI5NSwiZXhwIjoyMDM5NDMyMjk1fQ.exemplo_chave_padrao";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);