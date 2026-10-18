"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";


interface SidebarProps {
  onAbrirGrupo: () => void;
  membroSelecionado?: string;
  setMembroSelecionado?: (membro: string) => void;
  listaMembros?: string[];
  abaAtiva?: string;
  onSelecionarAba?: (id: string) => void;
  onAlterarExpandido?: (expandido: boolean) => void;
}

const SECOES = [
  {
    titulo: "Visão geral",
    itens: [{ id: "inicio", rotulo: "Início", simbolo: "⌂" }],
  },
  {
    titulo: "Movimentações",
    itens: [
      { id: "extrato", rotulo: "Extrato", simbolo: "≡" },
      { id: "lancamentos", rotulo: "Lançamentos do mês", simbolo: "+" },
    ],
  },
  {
    titulo: "Contas",
    itens: [
      { id: "fatura", rotulo: "Fatura do cartão", simbolo: "▭" },
      { id: "cartao", rotulo: "Contas parceladas", simbolo: "▤" },
      { id: "contas", rotulo: "Contas fixas", simbolo: "▣" },
    ],
  },
];

const TIPOS_NOVO_LANCAMENTO = [
  { id: "lancamentos", rotulo: "Lançamento normal" },
  { id: "cartao", rotulo: "Conta parcelada" },
  { id: "contas", rotulo: "Conta fixa" },
];

export default function Sidebar({
  onAbrirGrupo,
  membroSelecionado = "TODOS",
  setMembroSelecionado,
  listaMembros = [],
  abaAtiva,
  onSelecionarAba,
  onAlterarExpandido,
}: SidebarProps) {
  const [expandido, setExpandido] = useState(true);
  const [menuNovoAberto, setMenuNovoAberto] = useState(false);

  const [perfil, setPerfil] = useState<{ nome: string; avatar: string | null; email: string }>({
    nome: "",
    avatar: null,
    email: "",
  });

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("perfis")
        .select("nome_usuario, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setPerfil({
        nome: data?.nome_usuario || "Você",
        avatar: data?.avatar_url || null,
        email: user.email || "",
      });
    })();
  }, []);

  const alterarExpandido = (valor: boolean) => {
    setExpandido(valor);
    onAlterarExpandido?.(valor);
  };

  useEffect(() => {
    if (window.innerWidth < 768) alterarExpandido(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selecionarAba = (id: string) => {
    onSelecionarAba?.(id);
    setMenuNovoAberto(false);

    if (pathname !== "/") router.push("/");
  };

  const sair = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const classeItem = (ativo: boolean) =>
    `flex min-h-10 w-full items-center rounded-xl px-3 text-sm transition ${
      expandido ? "gap-3" : "justify-center"
    } ${
      ativo
        ? "bg-accent/12 font-semibold text-accent ring-1 ring-accent/20"
        : "text-muted hover:bg-background hover:text-ink"
    }`;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col md:flex border-r border-line bg-surface/80 backdrop-blur-xl transition-[width] duration-200 ${
        expandido ? "w-60" : "w-16"
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* CABEÇALHO DA SIDEBAR */}
        <div
          className={`flex h-12 items-center border-b border-line pb-3 ${
            expandido ? "justify-between" : "justify-center"
          }`}
        >
          {expandido && (
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="HomeCash"
                className="h-8 w-auto object-contain"
              />
              <span className="text-base font-semibold text-ink">
                Home<span className="text-accent">Cash</span>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => alterarExpandido(!expandido)}
            aria-label={expandido ? "Recolher menu" : "Expandir menu"}
            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-background hover:text-ink"
          >
            {expandido ? "‹" : "›"}
          </button>
        </div>

        {/* FILTRO DE MEMBROS */}
        {expandido && setMembroSelecionado && abaAtiva !== "ajustes" && (
          <div className="border-b border-line py-4">
            <label
              htmlFor="filtro-membro"
              className="mb-1.5 block text-xs text-muted"
            >
              Visualização
            </label>
            <select
              id="filtro-membro"
              value={membroSelecionado}
              onChange={(event) => setMembroSelecionado(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-background px-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="EU">Somente eu</option>
              <option value="TODOS">Todo o grupo</option>
              {listaMembros.map((membro) => (
                <option key={membro} value={membro}>
                  {membro}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* BOTÃO NOVO LANÇAMENTO */}
        <div className="relative py-4">
          <button
            type="button"
            onClick={() => setMenuNovoAberto((aberto) => !aberto)}
            aria-expanded={menuNovoAberto}
            title={!expandido ? "Novo lançamento" : undefined}
            className={`flex h-11 w-full items-center justify-center rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent shadow-lg shadow-accent/25 transition hover:-translate-y-0.5 hover:opacity-95 ${
              expandido ? "gap-2" : ""
            }`}
          >
            <span aria-hidden>＋</span>
            {expandido && <span>Novo lançamento</span>}
          </button>

          {menuNovoAberto && (
            <div className="absolute left-0 right-0 top-[calc(100%-8px)] z-50 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
              <p className="px-2 py-1.5 text-[11px] font-medium text-muted">
                Escolha o tipo
              </p>
              {TIPOS_NOVO_LANCAMENTO.map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => selecionarAba(tipo.id)}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm text-ink transition hover:bg-background"
                >
                  {tipo.rotulo}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* NAVEGAÇÃO */}
        <nav className="space-y-5">
          {SECOES.map((secao) => (
            <section key={secao.titulo} className="space-y-1">
              {expandido && (
                <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                  {secao.titulo}
                </h2>
              )}

              {secao.itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selecionarAba(item.id)}
                  aria-current={abaAtiva === item.id ? "page" : undefined}
                  title={!expandido ? item.rotulo : undefined}
                  className={classeItem(abaAtiva === item.id)}
                >
                  <span className="grid w-5 place-items-center text-base" aria-hidden>
                    {item.simbolo}
                  </span>
                  {expandido && <span>{item.rotulo}</span>}
                </button>
              ))}
            </section>
          ))}

          {/* ANÁLISES */}
          <section className="space-y-1">
            {expandido && (
              <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                Análises
              </h2>
            )}
            <button
              type="button"
              onClick={() => {
                selecionarAba("inicio");
                window.setTimeout(
                  () =>
                    document
                      .getElementById("graficos")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  50
                );
              }}
              className={classeItem(false)}
              title={!expandido ? "Gráficos" : undefined}
            >
              <span className="grid w-5 place-items-center text-base" aria-hidden>
                ◷
              </span>
              {expandido && <span>Gráficos</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                selecionarAba("inicio");
                window.setTimeout(
                  () =>
                    document
                      .getElementById("investimentos")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  50
                );
              }}
              className={classeItem(false)}
              title={!expandido ? "Investimentos" : undefined}
            >
              <span className="grid w-5 place-items-center text-base" aria-hidden>
                $
              </span>
              {expandido && <span>Investimentos</span>}
            </button>
          </section>

          <section className="space-y-1">
            {expandido && <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">AJUSTES</h2>}
            <button type="button" onClick={() => selecionarAba("ajustes")} className={classeItem(abaAtiva === "ajustes")} title="Configurações">
              <span className="grid w-5 place-items-center" aria-hidden>⚙</span>{expandido && <span>Configurações</span>}
            </button>
          </section>
        </nav>
      </div>

      {/* RODAPÉ E PERFIL DO UTILIZADOR */}
      <footer className="space-y-1 border-t border-line p-3">
        <button
          type="button"
          onClick={() => onSelecionarAba?.("ajustes")}
          title={!expandido ? perfil.nome : undefined}
          className={`mb-1 flex w-full items-center rounded-xl p-2 text-left transition hover:bg-background ${
            expandido ? "gap-3" : "justify-center"
          }`}
        >
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-bold text-on-accent">
            {perfil.avatar ? (
              <img src={perfil.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              (perfil.nome[0] || "?").toUpperCase()
            )}
          </span>
          {expandido && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                {perfil.nome}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {perfil.email}
              </span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onAbrirGrupo}
          className={classeItem(false)}
          title={!expandido ? "Gerenciar grupo" : undefined}
        >
          <span className="grid w-5 place-items-center" aria-hidden>
            ◉
          </span>
          {expandido && <span>Gerenciar grupo</span>}
        </button>


        <button
          type="button"
          onClick={sair}
          className={`flex min-h-10 w-full items-center rounded-lg px-3 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-400 ${
            expandido ? "gap-3" : "justify-center"
          }`}
          title={!expandido ? "Sair da conta" : undefined}
        >
          <span className="grid w-5 place-items-center" aria-hidden>
            ↪
          </span>
          {expandido && <span>Sair da conta</span>}
        </button>
      </footer>

    </aside>
  );
}