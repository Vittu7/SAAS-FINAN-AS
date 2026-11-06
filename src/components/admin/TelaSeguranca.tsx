"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  confirmarCadastro, decidirTela, iniciarCadastroTotp, listarFatores, obterNivel, verificarCodigo,
  type FatorTela, type TelaMfa,
} from "@/lib/adminMfa";
import { mensagemErroAdmin, type CodigoErroAdmin } from "@/lib/admin";
import EstadoTela from "./EstadoTela";

interface Props {
  /** Chamado depois de cadastrar ou verificar, para o painel reavaliar o acesso. */
  onMudou?: () => void;
  /** Erro de MFA devolvido pelo banco (por exemplo, fator ainda não aprovado). */
  erroBanco?: CodigoErroAdmin;
  onSair?: () => void;
}

const campo =
  "h-11 w-full rounded-lg border border-line bg-background px-3 text-center text-lg tracking-[0.4em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";
const botao =
  "h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const botaoSecundario =
  "h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink hover:bg-background focus-visible:ring-2 focus-visible:ring-accent";

interface Cadastro {
  fatorId: string;
  criadoEm: string;
  qrDataUri: string;
  segredo: string;
}

function dataHora(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

/**
 * Tela de segurança (spec §5.8 R4 e R9). Escolhe a tela pelo par (atual, próximo) do Supabase.
 * Não sabe quais fatores foram aprovados e não oferece remover fator: isso é feito por fora do app (R8).
 * O QR, o segredo e o código ficam só em memória deste componente.
 */
export default function TelaSeguranca({ onMudou, erroBanco, onSair }: Props) {
  const [tela, setTela] = useState<TelaMfa | null>(null);
  const [fatores, setFatores] = useState<FatorTela[]>([]);
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [adicionando, setAdicionando] = useState(false);

  const carregar = useCallback(async () => {
    const nivel = await obterNivel();
    setTela(nivel ? decidirTela(nivel.atual, nivel.proximo) : "bloqueado");
    setFatores(await listarFatores());
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const nivel = await obterNivel();
      const f = await listarFatores();
      if (!vivo) return;
      setTela(nivel ? decidirTela(nivel.atual, nivel.proximo) : "bloqueado");
      setFatores(f);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const gerar = async () => {
    setOcupado(true);
    setMsg(null);
    const r = await iniciarCadastroTotp();
    setOcupado(false);
    if (!r.ok) return setMsg(r.mensagem);
    setCadastro({ fatorId: r.fatorId, criadoEm: r.criadoEm, qrDataUri: r.qrDataUri, segredo: r.segredo });
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cadastro) return;
    setOcupado(true);
    const r = await confirmarCadastro(cadastro.fatorId, codigo);
    setCodigo("");
    setOcupado(false);
    if (!r.ok) return setMsg(r.mensagem);
    setMsg("Autenticador confirmado. Anote o id abaixo: ele é usado para a aprovação feita por você no banco.");
    setCadastro((c) => (c ? { ...c, segredo: "" } : c));
    await carregar();
    onMudou?.();
  };

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setMsg(null);
    const r = await verificarCodigo(codigo);
    setCodigo("");
    setOcupado(false);
    if (!r.ok) return setMsg(r.mensagem);
    await carregar();
    onMudou?.();
  };

  if (tela === null) return <EstadoTela estado="carregando" />;

  const painelCadastro = cadastro && (
    <form onSubmit={confirmar} className="flex flex-col gap-3" aria-label="Confirmar autenticador">
      {cadastro.segredo && (
        <>
          <p className="text-sm text-muted">Leia o QR no aplicativo autenticador ou digite o segredo abaixo. Ele aparece só agora.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cadastro.qrDataUri} alt="QR code do autenticador" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
          <p className="break-all rounded-lg bg-background p-3 text-center font-mono text-sm text-ink" aria-label="Segredo do autenticador">
            {cadastro.segredo}
          </p>
        </>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Id do autenticador</dt>
        <dd className="break-all font-mono text-ink">{cadastro.fatorId}</dd>
        <dt className="text-muted">Cadastrado em</dt>
        <dd className="text-ink">{dataHora(cadastro.criadoEm)}</dd>
      </dl>
      {cadastro.segredo && (
        <>
          <label className="text-sm font-medium text-ink" htmlFor="codigo-cadastro">Código de 6 dígitos</label>
          <input
            id="codigo-cadastro" className={campo} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
          <button type="submit" className={botao} disabled={ocupado || codigo.length !== 6}>Confirmar autenticador</button>
        </>
      )}
    </form>
  );

  const listaFatores = (
    <section aria-label="Autenticadores cadastrados" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink">Autenticadores cadastrados</h2>
      {fatores.length === 0 ? (
        <p className="text-sm text-muted">Nenhum autenticador cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fatores.map((f) => (
            <li key={f.id} className="rounded-lg border border-line p-3 text-xs">
              <p className="font-semibold text-ink">{f.nome ?? "Autenticador"} · {f.tipo} · {f.situacao}</p>
              <p className="break-all font-mono text-muted">{f.id}</p>
              <p className="text-muted">{dataHora(f.criadoEm)}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">A remoção de autenticador é feita por você fora do aplicativo.</p>
    </section>
  );

  const cabecalho = (Icone: typeof KeyRound, titulo: string, texto: string) => (
    <header className="flex items-start gap-3">
      <Icone className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden />
      <div>
        <h1 className="text-lg font-bold text-ink">{titulo}</h1>
        <p className="text-sm text-muted">{texto}</p>
      </div>
    </header>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      {erroBanco && (
        <p role="alert" className="rounded-lg border border-warn-borda bg-warn-bg p-3 text-sm text-warn-ink">
          {mensagemErroAdmin(erroBanco)}
        </p>
      )}

      {tela === "cadastro" && (
        <>
          {cabecalho(KeyRound, "Cadastrar autenticador", "O painel exige verificação em duas etapas com aplicativo autenticador.")}
          {cadastro ? painelCadastro : <button type="button" className={botao} onClick={gerar} disabled={ocupado}>Gerar QR code</button>}
          {listaFatores}
        </>
      )}

      {tela === "verificacao" && (
        <>
          {cabecalho(ShieldCheck, "Verificação em duas etapas", "Digite o código de 6 dígitos do aplicativo autenticador.")}
          <form onSubmit={verificar} className="flex flex-col gap-3">
            <label className="sr-only" htmlFor="codigo-verificacao">Código de 6 dígitos</label>
            <input
              id="codigo-verificacao" className={campo} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
            <button type="submit" className={botao} disabled={ocupado || codigo.length !== 6}>Verificar</button>
          </form>
        </>
      )}

      {tela === "liberado" && (
        <>
          {cabecalho(ShieldCheck, "Segurança", "Verificação em duas etapas ativa nesta sessão.")}
          {cadastro ? (
            painelCadastro
          ) : adicionando ? null : (
            <button type="button" className={botaoSecundario} onClick={() => { setAdicionando(true); void gerar(); }} disabled={ocupado}>
              Cadastrar outro autenticador
            </button>
          )}
          {listaFatores}
        </>
      )}

      {tela === "bloqueado" && (
        <>
          {cabecalho(ShieldAlert, "Entre de novo", "A verificação desta sessão não é mais válida. Saia e entre outra vez.")}
          {onSair && <button type="button" className={botao} onClick={onSair}>Sair</button>}
        </>
      )}

      {msg && (
        <p role="status" className="rounded-lg bg-background p-3 text-sm text-ink">
          {msg}
        </p>
      )}
    </div>
  );
}
