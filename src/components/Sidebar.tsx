"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { avatarDoProvedor, nomePadrao } from "@/lib/perfil";
import { sairDaConta } from "@/lib/auth";
import Avatar from "@/components/Avatar";
import { ICONES, ICONE_ABA, Ico } from "@/components/icons";

interface SidebarProps {
  onAbrirGrupo: () => void;
  onNova: () => void;
  /** Mantidos por compatibilidade: a escolha de visualização fica no cabeçalho da página. */
  membroSelecionado?: string;
  setMembroSelecionado?: (membro: string) => void;
  listaMembros?: string[];
  abaAtiva?: string;
  onSelecionarAba?: (id: string) => void;
  onAlterarExpandido?: (expandido: boolean) => void;
}

/** Navegação agrupada pelo que a pessoa quer fazer: ver, pagar/organizar e analisar. */
const SECOES: { titulo: string; itens: { id: string; rotulo: string }[] }[] = [
  {
    titulo: "Resumo",
    itens: [
      { id: "inicio", rotulo: "Início" },
      { id: "extrato", rotulo: "Extrato" },
    ],
  },
  {
    titulo: "Cartões e contas",
    itens: [
      { id: "fatura", rotulo: "Cartões e Faturas" },
      { id: "cartao", rotulo: "Contas parceladas" },
      { id: "contas", rotulo: "Contas fixas" },
      { id: "lancamentos", rotulo: "Tabela de lançamentos" },
    ],
  },
  {
    titulo: "Análises",
    itens: [
      { id: "graficos", rotulo: "Gráficos e relatórios" },
      { id: "investimentos", rotulo: "Investimentos" },
    ],
  },
  {
    titulo: "Suporte",
    itens: [{ id: "ajuda", rotulo: "Central de ajuda" }],
  },
];

export default function Sidebar({ onAbrirGrupo, onNova, abaAtiva, onSelecionarAba, onAlterarExpandido }: SidebarProps) {
  const [expandido, setExpandido] = useState(true);
  const [perfil, setPerfil] = useState<{ nome: string; avatar: string | null; email: string }>({ nome: "", avatar: null, email: "" });

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const carregarPerfil = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("perfis").select("nome_usuario, avatar_url").eq("id", user.id).maybeSingle();
      setPerfil({
        nome: data?.nome_usuario || nomePadrao(user),
        avatar: data?.avatar_url || avatarDoProvedor(user),
        email: user.email || "",
      });
    };
    carregarPerfil();
    // Atualiza nome/foto quando o perfil muda em Configurações.
    window.addEventListener("homecash:perfil", carregarPerfil);
    return () => window.removeEventListener("homecash:perfil", carregarPerfil);
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
    if (pathname !== "/") router.push("/");
  };

  const sair = async () => {
    await sairDaConta(supabase);
    router.push("/login");
  };

  const classeItem = (ativo: boolean) =>
    `group relative flex min-h-10 w-full items-center rounded-xl px-3 text-sm transition-all duration-200 ${expandido ? "gap-3" : "justify-center"} ${
      ativo ? "bg-accent/12 font-semibold text-accent" : "text-muted hover:bg-background hover:text-ink"
    }`;

  const Item = ({ id, rotulo, icone }: { id: string; rotulo: string; icone: Parameters<typeof Ico>[0]["icon"] }) => {
    const ativo = abaAtiva === id;
    return (
      <button type="button" onClick={() => selecionarAba(id)} aria-current={ativo ? "page" : undefined} title={!expandido ? rotulo : undefined} className={classeItem(ativo)}>
        <span aria-hidden className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-all duration-200 ${ativo ? "opacity-100" : "scale-y-0 opacity-0"}`} />
        <span className="grid w-5 shrink-0 place-items-center transition-transform duration-200 group-hover:scale-110">
          <Ico icon={icone} />
        </span>
        {expandido && <span className="truncate anim-fade">{rotulo}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface/85 backdrop-blur-xl transition-[width] duration-300 ease-out md:flex ${expandido ? "w-60" : "w-16"}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        {/* Marca + recolher */}
        <div className={`flex h-12 items-center ${expandido ? "justify-between" : "justify-center"}`}>
          {expandido && (
            <div className="flex items-center gap-2 anim-fade">
              <img src="/logo.png" alt="HomeCash" className="h-8 w-auto object-contain" />
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
            <Ico icon={expandido ? PanelLeftClose : PanelLeftOpen} />
          </button>
        </div>

        {/* Ação principal */}
        <div className="py-3">
          <button
            type="button"
            onClick={onNova}
            title={!expandido ? "Nova transação" : undefined}
            className={`flex h-11 w-full items-center justify-center rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent shadow-lg shadow-accent/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] ${expandido ? "gap-2" : ""}`}
          >
            <Ico icon={ICONES.novo} />
            {expandido && <span>Nova transação</span>}
          </button>
        </div>

        {/* Navegação */}
        <nav aria-label="Principal" className="space-y-4">
          {SECOES.map((secao) => (
            <section key={secao.titulo} className="space-y-0.5">
              {expandido ? (
                <h2 className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">{secao.titulo}</h2>
              ) : (
                <div aria-hidden className="mx-3 mb-1 h-px bg-line" />
              )}
              {secao.itens.map((item) => (
                <Item key={item.id} id={item.id} rotulo={item.rotulo} icone={ICONE_ABA[item.id]} />
              ))}
            </section>
          ))}
        </nav>
      </div>

      {/* Rodapé: perfil em destaque + ações rápidas */}
      <footer className="space-y-2 border-t border-line p-3">
        <button
          type="button"
          onClick={() => selecionarAba("ajustes")}
          title={!expandido ? `${perfil.nome} · Configurações` : undefined}
          aria-current={abaAtiva === "ajustes" ? "page" : undefined}
          className={`group flex w-full items-center rounded-xl p-2 text-left transition-all duration-200 hover:bg-background ${expandido ? "gap-3" : "justify-center"} ${abaAtiva === "ajustes" ? "bg-accent/12" : ""}`}
        >
          <Avatar src={perfil.avatar} nome={perfil.nome} cor="var(--accent)" tamanho="md" anel={abaAtiva === "ajustes"} />
          {expandido && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{perfil.nome}</span>
                <span className="block truncate text-[11px] text-muted">Configurações e perfil</span>
              </span>
              <Ico icon={ChevronRight} size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <div className={`grid gap-1 ${expandido ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={onAbrirGrupo} title={!expandido ? "Gerenciar grupo" : undefined} className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm text-muted transition hover:bg-background hover:text-ink">
            <Ico icon={ICONES.grupo} size={18} />
            {expandido && <span>Grupo</span>}
          </button>
          <button type="button" onClick={sair} title={!expandido ? "Sair da conta" : undefined} className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm text-muted transition hover:bg-rose-500/10 hover:text-rose-500">
            <Ico icon={ICONES.sair} size={18} />
            {expandido && <span>Sair</span>}
          </button>
        </div>
      </footer>
    </aside>
  );
}
