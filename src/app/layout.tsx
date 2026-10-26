
import type { Metadata, Viewport } from "next";
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

                const bg = localStorage.getItem('homecash-bg') || 'none';
                const img = localStorage.getItem('homecash-bg-img');

                root.dataset.bg = bg === 'image' && !img ? 'none' : bg;

                if (bg === 'image' && img) {
                  root.style.setProperty(
                    '--bg-img',
                    'url("' + img + '")'
                  );
                }
              } catch (e) {}
            `,
          }}
        />
      </head>

      <body className="bg-bg text-ink antialiased transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
