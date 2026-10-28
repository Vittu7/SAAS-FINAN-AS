import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | HomeCash",
  description: "Como o HomeCash coleta, usa e protege os seus dados.",
  robots: { index: true, follow: true },
};

/* ============================================================
   PREENCHA ANTES DE PUBLICAR: estes dois dados aparecem na página.
   O Google exige um meio de contato real na política de privacidade.
   ============================================================ */
const RESPONSAVEL = "HomeCash";
const EMAIL_CONTATO = "homecashofc@gmail.com";

const ATUALIZADA_EM = "27 de outubro de 2026";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted [&_b]:font-semibold [&_b]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export default function PoliticaDePrivacidade() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-ink sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
            ← Voltar para o HomeCash
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="text-sm text-muted">Última atualização: {ATUALIZADA_EM}</p>
          <p className="text-[15px] leading-relaxed text-muted">
            O <b className="font-semibold text-ink">HomeCash</b> é um aplicativo para organizar as finanças pessoais e da família. Esta
            política explica, de forma direta, quais dados tratamos, para que servem e quais são os seus direitos, em linha com a Lei
            Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
          </p>
        </header>

        <Secao titulo="1. Quem é o responsável">
          <p>
            O HomeCash é mantido por <b>{RESPONSAVEL}</b>, responsável pelo tratamento dos dados descritos aqui. Para qualquer assunto
            sobre privacidade, fale conosco em <a className="font-medium text-accent hover:underline" href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados coletamos">
          <p>
            <b>Ao entrar com a sua conta Google</b>, recebemos apenas o seu <b>nome</b>, o seu <b>endereço de e-mail</b> e a sua <b>foto de
            perfil</b>. Não pedimos acesso a e-mails, contatos, arquivos, agenda ou qualquer outro dado da sua conta Google.
          </p>
          <p><b>Dados que você mesmo informa no aplicativo:</b></p>
          <ul>
            <li>lançamentos de entradas e saídas, contas fixas, cartões e faturas;</li>
            <li>caixinhas (metas de economia) e aportes de investimento;</li>
            <li>categorias, formas de pagamento e configurações que você personaliza;</li>
            <li>nome de exibição e foto de perfil (a do Google ou outra que você enviar);</li>
            <li>informações do grupo familiar, como o código de convite e quem participa.</li>
          </ul>
          <p>
            Esses dados financeiros são digitados por você. O HomeCash <b>não se conecta ao seu banco</b> e não coleta senhas,
            números completos de cartão ou dados de contas bancárias.
          </p>
        </Secao>

        <Secao titulo="3. Para que usamos os dados">
          <ul>
            <li>identificar você e manter a sua conta e o seu login seguros;</li>
            <li>mostrar o seu painel financeiro, relatórios e gráficos;</li>
            <li>permitir o controle em família, quando você participa de um grupo;</li>
            <li>lembrar as suas preferências (tema, cores, filtros) neste aparelho;</li>
            <li>corrigir erros e manter o serviço funcionando.</li>
          </ul>
          <p>
            A base legal é a execução do serviço que você solicitou ao criar a conta e, quando aplicável, o seu consentimento (por exemplo,
            ao entrar com o Google ou ao entrar em um grupo familiar).
          </p>
        </Secao>

        <Secao titulo="4. Dados recebidos do Google">
          <p>
            O uso e a transferência, para qualquer outro app, de informações recebidas das APIs do Google seguirão a{" "}
            <a className="font-medium text-accent hover:underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de Uso Limitado.
          </p>
          <p>
            Usamos o nome, o e-mail e a foto do Google <b>somente</b> para autenticar você e montar o seu perfil dentro do HomeCash. Não
            vendemos esses dados, não os usamos para publicidade e não os transferimos a terceiros, exceto aos provedores de infraestrutura
            necessários para operar o serviço (seção 6).
          </p>
        </Secao>

        <Secao titulo="5. Com quem os dados são compartilhados">
          <ul>
            <li>
              <b>Membros do seu grupo familiar:</b> se você entrar em um grupo, os outros participantes veem o seu nome, a sua foto e os
              lançamentos que você marcar como compartilhados ou que envolvam repasses entre vocês. Os demais dados continuam privados.
            </li>
            <li>
              <b>Provedores de infraestrutura</b> que armazenam e entregam o aplicativo em nosso nome (seção 6).
            </li>
            <li>
              <b>Autoridades</b>, apenas se houver obrigação legal ou ordem judicial.
            </li>
          </ul>
          <p>Não vendemos nem alugamos os seus dados e não exibimos anúncios.</p>
        </Secao>

        <Secao titulo="6. Onde os dados ficam e como os protegemos">
          <p>
            Usamos o <b>Supabase</b> (autenticação, banco de dados e armazenamento de fotos), a <b>Vercel</b> (hospedagem do aplicativo) e o{" "}
            <b>Google</b> (login). Esses provedores podem processar dados em servidores fora do Brasil; nesses casos, buscamos provedores
            que adotam medidas de segurança adequadas, conforme a LGPD.
          </p>
          <p>
            A comunicação com o aplicativo é feita por conexão criptografada (HTTPS) e o acesso aos dados é restrito à sua conta. Nenhum
            sistema é 100% invulnerável, mas trabalhamos para reduzir riscos e corrigir falhas rapidamente. Se ocorrer um incidente que
            possa causar dano relevante, avisaremos você e as autoridades competentes, como manda a lei.
          </p>
        </Secao>

        <Secao titulo="7. Cookies e armazenamento no aparelho">
          <p>
            O HomeCash <b>não usa cookies de publicidade nem ferramentas de análise ou rastreamento</b>. Usamos o armazenamento do seu
            navegador (localStorage) para manter você conectado e guardar preferências, como tema, cores e filtros. Você pode limpar esses
            dados a qualquer momento nas configurações do navegador, o que fará você sair da conta neste aparelho.
          </p>
        </Secao>

        <Secao titulo="8. Por quanto tempo guardamos os dados">
          <p>
            Mantemos os seus dados enquanto a sua conta existir. Ao pedir a exclusão da conta, apagamos os seus dados pessoais e financeiros
            em prazo razoável, salvo o que formos obrigados a guardar por lei.
          </p>
        </Secao>

        <Secao titulo="9. Seus direitos">
          <p>Pela LGPD, você pode, a qualquer momento:</p>
          <ul>
            <li>confirmar se tratamos dados seus e acessá-los;</li>
            <li>corrigir dados incompletos ou desatualizados (grande parte você edita direto no app);</li>
            <li>pedir a exclusão dos seus dados e da sua conta;</li>
            <li>pedir uma cópia dos seus dados;</li>
            <li>revogar o consentimento e saber com quem compartilhamos as informações.</li>
          </ul>
          <p>
            Para exercer qualquer direito, escreva para{" "}
            <a className="font-medium text-accent hover:underline" href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>. Você também pode
            retirar o acesso do HomeCash à sua conta Google em{" "}
            <a className="font-medium text-accent hover:underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              myaccount.google.com/permissions
            </a>
            . Se não ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Secao>

        <Secao titulo="10. Crianças e adolescentes">
          <p>
            O HomeCash não é direcionado a menores de 18 anos e não coletamos dados de crianças de propósito. Se você acredita que um menor
            criou uma conta, avise pelo e-mail acima para que possamos removê-la.
          </p>
        </Secao>

        <Secao titulo="11. Mudanças nesta política">
          <p>
            Podemos atualizar esta política quando o aplicativo mudar ou a lei exigir. A data no topo da página mostra a última revisão.
            Mudanças importantes serão avisadas dentro do aplicativo.
          </p>
        </Secao>

        <footer className="border-t border-line pt-6 text-sm text-muted">
          Dúvidas? <a className="font-medium text-accent hover:underline" href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>
        </footer>
      </article>
    </main>
  );
}
