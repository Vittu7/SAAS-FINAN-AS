import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeCash",
  description: "O seu painel financeiro na nuvem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            try {
              let t = localStorage.getItem('theme');
              if (!t) t = 'dark';
              document.documentElement.classList.toggle('dark', t === 'dark');
            } catch (e) {}
          `}
        </Script>
      </head>
      {/* Aqui aplicamos as cores corretas: cinza muito escuro no modo escuro, e cinza claro no modo claro */}
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50 antialiased transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}