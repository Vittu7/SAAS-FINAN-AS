import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CSP e cabeçalhos só para /admin (spec §11). O resto do app não passa por aqui.
// Referência: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
//
// DESVIO DO SPEC (§11 pedia nonce, sem 'unsafe-inline' em script) — decisão pendente do responsável:
// este projeto usa `cacheComponents: true`, então as páginas saem pré-renderizadas e os <script> do
// HTML estático não recebem nonce. Testado com `next build` + `next start`: a resposta de /admin vem
// com `x-nextjs-prerender: 1` e nenhum script com nonce; uma CSP com 'nonce-…' + 'strict-dynamic'
// bloquearia o painel inteiro. O guia do Next diz o mesmo: "Partial Prerendering (PPR) is incompatible
// with nonce-based CSP". `experimental.sri` também NÃO resolve (provado em 2026-11-05 numa cópia descartável:
// o HTML mantém 11 <script> inline e `script-src 'self'` os bloqueia, o painel não hidrata).
// TEMPORÁRIA (fases 1 e 2). A solução definitiva é OBRIGATÓRIA antes da fase 3: portão G-CSP (spec §11),
// único caminho viável = /admin em aplicação Next separada, sem cacheComponents, com nonce.
//
// O que esta política ainda garante: nenhum script de origem externa, `connect-src` só para o próprio
// site e o Supabase (um XSS não consegue enviar o JWT para outro domínio por fetch/WebSocket),
// nenhum <object>/<embed>, nenhum iframe do painel nem em frame de terceiros, `base` e `form` travados.
// O que NÃO garante: bloquear um script inline injetado. As defesas contra isso continuam sendo
// renderizar conteúdo de terceiros só como texto (teste estático) e o MFA aal2 exigido no banco.
export function proxy(request: NextRequest) {
  const dev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // data: só para o QR do autenticador (imagem de dados)
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const response = NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
