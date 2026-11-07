
import type { Metadata, Viewport } from "next";
import Avisos from "@/components/Avisos";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeCash",
  description: "O seu painel financeiro na nuvem",
  applicationName: "HomeCash",

  verification: {
    google: "Vxlq8BUFMnqwZjwzg2UgdEvtSNf_7eOazWcsjRcJVEg",
  },

  appleWebApp: {
    capable: true,
    title: "HomeCash",
    statusBarStyle: "black-translucent",
  },

  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f5f7fa" />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const root = document.documentElement;
                const t =
                  localStorage.getItem('homecash-theme') ||
                  localStorage.getItem('tema') ||
                  'system';
                const a = localStorage.getItem('homecash-accent') || 'teal';
                const systemDark = window.matchMedia(
                  '(prefers-color-scheme: dark)'
                ).matches;

                root.dataset.theme = t;
                root.dataset.accent = a;

                const isDark =
                  t === 'dark' || (t === 'system' && systemDark);

                root.classList.toggle('dark', isDark);

                const metaTheme = document.querySelector(
                  'meta[name="theme-color"]'
                );

                if (metaTheme) {
                  metaTheme.setAttribute(
                    'content',
                    isDark ? '#101722' : '#f5f7fa'
                  );
                }

                const LEGADO = { dots: 'granulado', grid: 'ondas', none: 'ondas', glow: 'bolhas', cidade: 'bolhas', ecos: 'bolhas', prisma: 'picos', aurora: 'ondas', malha: 'ondas' };
                const VALIDOS = ['picos', 'bolhas', 'ondas', 'granulado'];
                let bg = localStorage.getItem('homecash-bg') || 'ondas';
                bg = LEGADO[bg] || bg;
                root.dataset.bg = VALIDOS.indexOf(bg) >= 0 ? bg : 'ondas';
              } catch (e) {}
            `,
          }}
        />
      </head>

      <body className="text-ink antialiased transition-colors duration-200">
        {children}
        <Avisos />
      </body>
    </html>
  );
}
