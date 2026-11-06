"use client";

import { useCallback, useEffect, useState } from "react";
import { obterResumo, type CodigoErroAdmin, type ResumoAdmin } from "@/lib/admin";
import CartaoIndicador from "@/components/admin/CartaoIndicador";
import EstadoTela, { estadoDoErro } from "@/components/admin/EstadoTela";
import GraficoBarrasSvg from "@/components/admin/GraficoBarrasSvg";

type Estado = { tipo: "carregando" } | { tipo: "erro"; erro: CodigoErroAdmin } | { tipo: "ok"; resumo: ResumoAdmin };

export default function PaginaDashboard() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  const carregar = useCallback(async () => {
    const r = await obterResumo();
    setEstado(r.ok ? { tipo: "ok", resumo: r.dados } : { tipo: "erro", erro: r.erro });
  }, []);

  useEffect(() => {
    let vivo = true;
    obterResumo().then((r) => {
      if (vivo) setEstado(r.ok ? { tipo: "ok", resumo: r.dados } : { tipo: "erro", erro: r.erro });
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-ink">Visão geral</h1>
        <p className="text-sm text-muted">Contagens do sistema. Nenhum dado pessoal é exibido aqui.</p>
      </header>

      {estado.tipo === "carregando" && <EstadoTela estado="carregando" />}
      {estado.tipo === "erro" && (
        <EstadoTela
          estado={estadoDoErro(estado.erro)}
          erro={estado.erro}
          onTentarDeNovo={() => {
            setEstado({ tipo: "carregando" });
            void carregar();
          }}
        />
      )}

      {estado.tipo === "ok" && (
        <>
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CartaoIndicador titulo="Contas" valor={estado.resumo.usuarios} detalhe={`${estado.resumo.convidados} convidados sem conta`} />
            <CartaoIndicador titulo="Grupos" valor={estado.resumo.grupos} />
            <CartaoIndicador titulo="Cadastros hoje" valor={estado.resumo.cadastros_hoje} detalhe={`${estado.resumo.cadastros_7d} em 7 dias · ${estado.resumo.cadastros_30d} em 30`} />
            <CartaoIndicador titulo="Ativos em 7 dias" valor={estado.resumo.ativos_7d} detalhe={`${estado.resumo.ativos_30d} em 30 dias`} />
            <CartaoIndicador titulo="Erros novos (24 h)" valor={estado.resumo.erros_novos_24h} />
            <CartaoIndicador titulo="Solicitações abertas" valor={estado.resumo.solicitacoes_abertas} />
            <CartaoIndicador
              titulo="Acessos negados (24 h)"
              valor={estado.resumo.acessos_negados_24h}
              detalhe={`${estado.resumo.negados_repeticoes_24h} tentativas no total`}
            />
            <CartaoIndicador
              titulo="Linhas no banco"
              valor={Object.values(estado.resumo.linhas_por_tabela).reduce((s, n) => s + n, 0)}
              detalhe={Object.entries(estado.resumo.linhas_por_tabela).map(([t, n]) => `${t}: ${n}`).join(" · ")}
            />
          </section>

          <section aria-label="Gráficos" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <GraficoBarrasSvg titulo="Cadastros por dia (30 dias)" serie={estado.resumo.serie_cadastros} />
            <GraficoBarrasSvg titulo="Último acesso por dia (30 dias)" serie={estado.resumo.serie_ultimo_acesso} />
          </section>
        </>
      )}
    </div>
  );
}
