import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeCash",
  description: "O seu painel financeiro na nuvem",
  applicationName: "HomeCash",
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
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#101722" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const root = document.documentElement;
                const t = localStorage.getItem('homecash-theme') || localStorage.getItem('tema') || 'system';
                const a = localStorage.getItem('homecash-accent') || 'teal';
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                root.dataset.theme = t;
                root.dataset.accent = a;
                root.classList.toggle('dark', t === 'dark' || (t === 'system' && systemDark));
              } catch (e) {}
            `,
          }}
        />
      </head>
      {/* Cores vindas das variáveis do tema (globals.css), iguais em todo o app nos modos claro e escuro */}
      <body className="bg-bg text-ink antialiased transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
