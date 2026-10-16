"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const TUTORIAIS = [
  {
    titulo: "Acompanhe sua visão geral",
    texto: "Na Home, veja salário, gastos do mês, sobra e a divisão das despesas por pessoa. Use o seletor lateral para visualizar todo o grupo ou apenas alguém.",
    simbolo: "⌂",
  },
  {
    titulo: "Registre uma movimentação",
    texto: "Use Novo lançamento para cadastrar uma compra normal, uma conta parcelada ou uma conta fixa. Os módulos também permitem editar e acompanhar os registros.",
    simbolo: "+",
  },
  {
    titulo: "Consulte e filtre o extrato",
    texto: "O Extrato reúne os lançamentos normais, parcelas e contas fixas. Pesquise pela descrição ou filtre por pessoa, categoria, forma de pagamento, tipo e status.",
    simbolo: "≡",
  },
  {
    titulo: "Organize em família",
    texto: "Gerencie os membros do grupo e identifique quem é responsável por cada despesa. Os filtros ajudam a consultar os dados de cada pessoa.",
    simbolo: "♧",
  },
];

export default function AjudaEInstalacao({ mostrarConvite = false }: { mostrarConvite?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [secao, setSecao] = useState<"guia" | "instalar">("guia");
  const [passo, setPasso] = useState(0);
  const [instalacao, setInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [conviteDispensado, setConviteDispensado] = useState(false);
  const [dispositivo, setDispositivo] = useState<"ios" | "android" | "outro">("outro");
  const [jaInstalado, setJaInstalado] = useState(false);

  useEffect(() => {
    const navegador = navigator as Navigator & { standalone?: boolean };
    const agente = navigator.userAgent.toLowerCase();
    setDispositivo(/iphone|ipad|ipod/.test(agente) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : /android/.test(agente) ? "android" : "outro");
    setJaInstalado(window.matchMedia("(display-mode: standalone)").matches || Boolean(navegador.standalone));
    setConviteDispensado(localStorage.getItem("homecash-install-invite-dismissed") === "true");
    const capturar = (evento: Event) => {
      evento.preventDefault();
      setInstalacao(evento as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capturar);
    return () => window.removeEventListener("beforeinstallprompt", capturar);
  }, []);

  const abrirGuia = () => {
    setSecao("guia");
    setPasso(0);
    setMensagem("");
    setAberto(true);
  };

  const abrirInstalacao = () => {
    setSecao("instalar");
    setMensagem("");
    setAberto(true);
  };

  const instalar = async () => {
    if (!instalacao) return;
    await instalacao.prompt();
    const resultado = await instalacao.userChoice;
    setMensagem(resultado.outcome === "accepted" ? "O HomeCash foi adicionado ao dispositivo." : "Tudo bem. Você pode instalar quando quiser pelo menu do navegador.");
    setInstalacao(null);
  };

  return (
    <>
      <button type="button" onClick={abrirGuia} className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm transition hover:border-accent/50 hover:bg-background">
        <span aria-hidden="true">?</span><span className="hidden sm:inline">Ajuda</span>
      </button>

      {mostrarConvite && !conviteDispensado && !jaInstalado && (
        <section className="flex flex-col gap-4 rounded-2xl border border-accent/20 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">✦</span>
            <div>
              <h2 className="font-semibold text-ink">Seu dinheiro, mais organizado.</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">Comece pelo resumo do mês. Veja o guia rápido ou leve o HomeCash para a tela inicial do celular.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <button type="button" onClick={abrirGuia} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-background">Ver tutorial</button>
            <button type="button" onClick={abrirInstalacao} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:opacity-90">{dispositivo === "outro" ? "Usar como app" : "Adicionar à tela inicial"}</button>
            <button type="button" onClick={() => { setConviteDispensado(true); localStorage.setItem("homecash-install-invite-dismissed", "true"); }} aria-label="Dispensar dica de instalação" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background">×</button>
          </div>
        </section>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setAberto(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ajuda-titulo" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <header className="flex items-start justify-between border-b border-line p-5 md:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">Central de ajuda</p>
                <h2 id="ajuda-titulo" className="mt-1 text-xl font-semibold text-ink">Conheça o HomeCash</h2>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar ajuda" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background">×</button>
            </header>

            <div className="flex gap-2 border-b border-line px-5 pt-3 md:px-6">
              <button type="button" onClick={() => setSecao("guia")} className={`border-b-2 px-2 pb-3 text-sm ${secao === "guia" ? "border-accent font-medium text-accent" : "border-transparent text-muted"}`}>Tutorial</button>
              <button type="button" onClick={() => setSecao("instalar")} className={`border-b-2 px-2 pb-3 text-sm ${secao === "instalar" ? "border-accent font-medium text-accent" : "border-transparent text-muted"}`}>Instalar no celular</button>
            </div>

            {secao === "guia" ? (
              <div className="p-5 md:p-6">
                <div className="flex min-h-40 items-start gap-4 rounded-xl bg-background p-4 md:p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-xl font-semibold text-accent">{TUTORIAIS[passo].simbolo}</span>
                  <div>
                    <p className="text-xs font-medium text-muted">PASSO {passo + 1} DE {TUTORIAIS.length}</p>
                    <h3 className="mt-2 text-lg font-semibold text-ink">{TUTORIAIS[passo].titulo}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{TUTORIAIS[passo].texto}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex gap-1.5" aria-label={`Passo ${passo + 1} de ${TUTORIAIS.length}`}>
                    {TUTORIAIS.map((item, indice) => <span key={item.titulo} className={`h-1.5 w-6 rounded-full ${indice === passo ? "bg-accent" : "bg-line"}`} />)}
                  </div>
                  <div className="flex gap-2">
                    {passo > 0 && <button type="button" onClick={() => setPasso((atual) => atual - 1)} className="rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-background">Voltar</button>}
                    {passo < TUTORIAIS.length - 1 ? <button type="button" onClick={() => setPasso((atual) => atual + 1)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent">Próximo</button> : <button type="button" onClick={() => setAberto(false)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent">Concluir</button>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-5 md:p-6">
                <div className="rounded-xl bg-background p-4">
                  <h3 className="font-semibold text-ink">Adicione à tela inicial</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">Abra o HomeCash no navegador do celular e siga os passos para criar um atalho com ícone, como um app.</p>
                </div>
                {instalacao && <button type="button" onClick={instalar} className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent">Instalar HomeCash agora</button>}
                <div className={`grid gap-3 ${dispositivo === "outro" ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                  {dispositivo !== "android" && <article className="rounded-xl border border-line p-4">
                    <p className="font-semibold text-ink">iPhone / iPad</p>
                    <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-5 text-muted">
                      <li>Abra o site no Safari.</li>
                      <li>Toque em Compartilhar (ícone de seta para cima).</li>
                      <li>Deslize a lista e toque em “Adicionar à Tela de Início”.</li>
                    </ol>
                  </article>}
                  {dispositivo !== "ios" && <article className="rounded-xl border border-line p-4">
                    <p className="font-semibold text-ink">Android</p>
                    <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-5 text-muted">
                      <li>Abra o site no Chrome.</li>
                      <li>Toque no menu ⋮ no alto da tela.</li>
                      <li>Toque em “Instalar app” ou “Adicionar à tela inicial”.</li>
                    </ol>
                  </article>}
                </div>
                <p className="text-xs leading-5 text-muted">Depois de adicionar, o ícone do HomeCash ficará junto dos outros aplicativos. No iPhone, faça isso pelo Safari.</p>
                {mensagem && <p role="status" className="text-sm text-accent">{mensagem}</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
