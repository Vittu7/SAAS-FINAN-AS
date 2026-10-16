import type { Metadata } from "next";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let t = localStorage.getItem('theme');
                if (!t) t = 'dark';
                document.documentElement.classList.toggle('dark', t === 'dark');
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