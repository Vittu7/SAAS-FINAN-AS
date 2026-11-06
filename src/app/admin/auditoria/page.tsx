"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  listarAuditoria, verificarAuditoria,
  type CodigoErroAdmin, type ItemAuditoriaAcao, type ItemAuditoriaNegado, type PaginaAuditoria,
} from "@/lib/admin";
import EstadoTela, { estadoDoErro } from "@/components/admin/EstadoTela";
import TabelaPaginada, { type Coluna } from "@/components/admin/TabelaPaginada";

type Aba = "acoes" | "negados";
const LIMITE = 25;

const dh = (iso: string) => new Date(iso).toLocaleString("pt-BR");

// Todo conteúdo abaixo vem de usuários: é renderizado só como texto.
const COLUNAS_ACOES: Coluna<ItemAuditoriaAcao>[] = [
  { chave: "ordem", titulo: "#", render: (l) => l.ordem, className: "w-16" },
  { chave: "quando", titulo: "Quando", render: (l) => dh(l.criado_em), className: "w-40" },
  { chave: "admin", titulo: "Quem", render: (l) => l.admin_email ?? "SQL Editor" },
  { chave: "acao", titulo: "Ação", render: (l) => l.acao },
  { chave: "alvo", titulo: "Alvo", render: (l) => l.alvo_email ?? "—" },
  { chave: "detalhe", titulo: "Detalhe", render: (l) => (l.parametros ? <code className="text-xs">{JSON.stringify(l.parametros)}</code> : "—") },
];

const COLUNAS_NEGADOS: Coluna<ItemAuditoriaNegado>[] = [
  { chave: "ordem", titulo: "#", render: (l) => l.ordem, className: "w-16" },
  { chave: "quando", titulo: "Quando", render: (l) => dh(l.criado_em), className: "w-40" },
  { chave: "email", titulo: "Conta", render: (l) => l.email ?? "—" },
  { chave: "funcao", titulo: "Função", render: (l) => l.funcao },
  { chave: "motivo", titulo: "Motivo", render: (l) => l.motivo },
  { chave: "rota", titulo: "Rota", render: (l) => l.rota ?? "—" },
  { chave: "vezes", titulo: "Na hora", render: (l) => `${l.ocorrencias_na_hora}×`, className: "w-20" },
];

type Resultado = { tipo: "integra"; verificadas: number; cabeca: string | null } | { tipo: "quebra"; ordem: number; tabela: "acoes" | "negados" } | { tipo: "erro"; erro: CodigoErroAdmin };

export default function PaginaAuditoria() {
  const [aba, setAba] = useState<Aba>("acoes");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaAuditoria<ItemAuditoriaAcao | ItemAuditoriaNegado> | null>(null);
  const [erro, setErro] = useState<CodigoErroAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const carregar = useCallback(async (a: Aba, p: number) => {
    setCarregando(true);
    const r = await listarAuditoria(a, p, LIMITE);
    if (r.ok) {
      setDados(r.dados);
      setErro(null);
    } else {
      setErro(r.erro);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    listarAuditoria(aba, pagina, LIMITE).then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setDados(r.dados);
        setErro(null);
      } else {
        setErro(r.erro);
      }
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [aba, pagina]);

  const trocarAba = (a: Aba) => {
    setCarregando(true);
    setDados(null);
    setPagina(1);
    setAba(a);
  };

  const verificar = async () => {
    setVerificando(true);
    setResultado(null);
    let total = 0;
    let cabeca: string | null = null;
    // verifica as duas cadeias: ações e acessos negados
    for (const tabela of ["acoes", "negados"] as const) {
      let desde = 1;
      for (;;) {
        const r = await verificarAuditoria(tabela, desde);
        if (!r.ok) {
          setResultado({ tipo: "erro", erro: r.erro });
          setVerificando(false);
          return;
        }
        total += r.dados.verificadas;
        if (tabela === "acoes") cabeca = r.dados.cabeca;
        if (r.dados.primeira_quebra !== null) {
          setResultado({ tipo: "quebra", ordem: r.dados.primeira_quebra, tabela });
          setVerificando(false);
          return;
        }
        if (r.dados.proxima === null) break;
        desde = r.dados.proxima;
      }
    }
    setResultado({ tipo: "integra", verificadas: total, cabeca });
    setVerificando(false);
  };

  const abaBtn = (a: Aba, texto: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={aba === a}
      onClick={() => trocarAba(a)}
      className={`h-11 rounded-lg px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-accent ${
        aba === a ? "bg-accent text-on-accent" : "border border-line text-ink hover:bg-background"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Auditoria</h1>
          <p className="text-sm text-muted">Registro imutável do que foi feito no painel e das tentativas negadas.</p>
        </div>
        <button
          type="button"
          onClick={() => void verificar()}
          disabled={verificando}
          className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:bg-background disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
        >
          {verificando ? "Verificando…" : "Verificar integridade"}
        </button>
      </header>

      {resultado && (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${resultado.tipo === "integra" ? "border-pos-borda bg-pos-bg text-pos-ink" : "border-neg-borda bg-neg-bg text-neg-ink"}`}>
          {resultado.tipo === "integra" ? <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden /> : <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />}
          <div className="min-w-0">
            {resultado.tipo === "integra" && (
              <>
                <p className="font-semibold">Cadeias íntegras (ações e acessos negados): {resultado.verificadas} registros verificados.</p>
                <p className="break-all text-xs">Cabeça atual: <span className="font-mono">{resultado.cabeca}</span></p>
                <p className="text-xs">Anote a cabeça e o total fora do banco de tempos em tempos: apagar as últimas linhas não quebra a cadeia.</p>
              </>
            )}
            {resultado.tipo === "quebra" && <p className="font-semibold">Quebra na cadeia de {resultado.tabela === "acoes" ? "ações" : "acessos negados"} a partir do registro #{resultado.ordem}.</p>}
            {resultado.tipo === "erro" && <p>Não foi possível verificar. Tente de novo.</p>}
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Tipo de registro" className="flex gap-2">
        {abaBtn("acoes", "Ações")}
        {abaBtn("negados", "Acessos negados")}
      </div>

      {erro ? (
        <EstadoTela estado={estadoDoErro(erro)} erro={erro} onTentarDeNovo={() => void carregar(aba, pagina)} />
      ) : aba === "acoes" ? (
        <TabelaPaginada<ItemAuditoriaAcao>
          colunas={COLUNAS_ACOES}
          linhas={(dados?.aba === "acoes" ? dados.itens : []) as ItemAuditoriaAcao[]}
          total={dados?.total ?? 0}
          pagina={pagina}
          limite={LIMITE}
          onPagina={(p) => { setCarregando(true); setPagina(p); }}
          chaveLinha={(l) => l.ordem}
          carregando={carregando}
          vazio="Nenhuma ação registrada ainda."
        />
      ) : (
        <TabelaPaginada<ItemAuditoriaNegado>
          colunas={COLUNAS_NEGADOS}
          linhas={(dados?.aba === "negados" ? dados.itens : []) as ItemAuditoriaNegado[]}
          total={dados?.total ?? 0}
          pagina={pagina}
          limite={LIMITE}
          onPagina={(p) => { setCarregando(true); setPagina(p); }}
          chaveLinha={(l) => l.ordem}
          carregando={carregando}
          vazio="Nenhuma tentativa negada registrada."
        />
      )}
    </div>
  );
}
