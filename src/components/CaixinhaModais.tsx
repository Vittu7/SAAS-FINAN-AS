"use client";

import { useState } from "react";
import DialogResponsivo from "./DialogResponsivo";
import { botaoPrimario, campo } from "./ui";
import { brl, parseValor } from "@/lib/finance";
import {
  CORES_CAIXINHA,
  ROTULO_MOVIMENTO,
  TIPOS_RENDIMENTO,
  dataBR,
  decimalTexto,
  hojeISO,
  type Caixinha,
  type DadosCaixinha,
  type Movimento,
  type NovoMovimento,
  type TipoMovimento,
  type TipoRendimento,
} from "@/lib/caixinhas";

const rotulo = "mb-1 block text-xs font-medium text-muted";
const botaoSecundario = "h-9 rounded-lg border border-line px-3 text-sm text-muted transition hover:text-ink";

function Segmentado<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T;
  opcoes: { id: T; nome: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-lg bg-background p-1" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }} role="group">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 rounded-md text-sm font-medium transition ${
            valor === o.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
          }`}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

function CampoReais({ valor, onChange, placeholder = "0,00" }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-line bg-background px-2.5 focus-within:ring-2 focus-within:ring-accent">
      <span className="mr-2 text-sm text-muted">R$</span>
      <input
        inputMode="decimal"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-ink outline-none"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cadastro / edição de caixinha                                       */
/* ------------------------------------------------------------------ */

export function FormularioCaixinha({
  inicial,
  comoReserva,
  onSalvar,
  onExcluir,
  onFechar,
}: {
  inicial?: Caixinha | null;
  /** Pré-preenche como Reserva de Emergência (onboarding). */
  comoReserva?: boolean;
  onSalvar: (d: DadosCaixinha) => Promise<string | null>;
  onExcluir?: () => Promise<string | null>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? (comoReserva ? "Reserva de Emergência" : ""));
  const [ehReserva, setEhReserva] = useState(inicial?.ehReserva ?? !!comoReserva);
  const [rendimento, setRendimento] = useState(inicial?.rendimento ?? "");
  const [banco, setBanco] = useState(inicial?.banco ?? "");
  const [tipoRend, setTipoRend] = useState<TipoRendimento | "">(inicial?.tipoRendimento ?? "");
  const [meta, setMeta] = useState(inicial ? decimalTexto(inicial.meta) : "");
  const [saldo, setSaldo] = useState(inicial ? decimalTexto(inicial.saldo) : "");
  const [autoAtivo, setAutoAtivo] = useState(inicial?.aporteAutoAtivo ?? false);
  const [autoValor, setAutoValor] = useState(inicial ? decimalTexto(inicial.aporteAutoValor) : "");
  const [exibirHome, setExibirHome] = useState(inicial?.exibirNaHome ?? !!comoReserva);
  const [cor, setCor] = useState(inicial?.cor ?? CORES_CAIXINHA[0]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Dê um nome para a caixinha.");
      return;
    }
    const valorAuto = parseValor(autoValor);
    if (autoAtivo && valorAuto <= 0) {
      setErro("Informe o valor do aporte mensal.");
      return;
    }
    setSalvando(true);
    setErro("");
    const msg = await onSalvar({
      nome,
      ehReserva,
      rendimento,
      meta: parseValor(meta),
      saldo: parseValor(saldo),
      aporteAutoAtivo: autoAtivo,
      aporteAutoValor: valorAuto,
      exibirNaHome: exibirHome,
      cor,
      banco,
      tipoRendimento: tipoRend || null,
    });
    setSalvando(false);
    if (msg) setErro(msg);
    else onFechar();
  };

  const excluir = async () => {
    if (!onExcluir) return;
    if (!confirm("Excluir esta caixinha e todo o histórico dela? Essa ação não pode ser desfeita.")) return;
    const msg = await onExcluir();
    if (msg) setErro(msg);
    else onFechar();
  };

  return (
    <DialogResponsivo titulo={inicial ? "Editar caixinha" : "Nova caixinha"} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className={rotulo}>Nome da caixinha</span>
          <input
            className={campo}
            placeholder="Ex.: Reserva de Emergência, Viagem, Carro Novo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={60}
            autoFocus
          />
        </label>

        <div>
          <span className={rotulo}>É a Reserva de Emergência?</span>
          <Segmentado
            valor={ehReserva ? "sim" : "nao"}
            opcoes={[
              { id: "sim", nome: "Sim" },
              { id: "nao", nome: "Não" },
            ]}
            onChange={(v) => setEhReserva(v === "sim")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={rotulo}>Onde está guardado</span>
            <input className={campo} placeholder="Ex.: Nubank, Caixa, Itaú" value={banco} onChange={(e) => setBanco(e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className={rotulo}>Tipo de rendimento</span>
            <select className={campo} value={tipoRend} onChange={(e) => setTipoRend(e.target.value as TipoRendimento | "")}>
              <option value="">Não informar</option>
              {TIPOS_RENDIMENTO.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={rotulo}>Taxa do rendimento (opcional)</span>
          <input
            className={campo}
            placeholder="Ex.: 100% do CDI, 12% a.a."
            value={rendimento}
            onChange={(e) => setRendimento(e.target.value)}
            maxLength={60}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={rotulo}>Meta de valor</span>
            <CampoReais valor={meta} onChange={setMeta} />
          </label>
          <label className="block">
            <span className={rotulo}>Saldo atual</span>
            <CampoReais valor={saldo} onChange={setSaldo} />
          </label>
        </div>
        {inicial && <p className="-mt-2 text-xs text-muted">Se você mudar o saldo, a diferença entra no histórico como “Ajuste de saldo”.</p>}

        <div className="space-y-3 rounded-xl bg-background p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Aporte automático mensal</span>
            <input type="checkbox" checked={autoAtivo} onChange={(e) => setAutoAtivo(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          </label>
          {autoAtivo && (
            <label className="block">
              <span className={rotulo}>Valor fixo planejado por mês</span>
              <CampoReais valor={autoValor} onChange={setAutoValor} />
              <span className="mt-1 block text-xs text-muted">No início de cada mês você recebe uma sugestão para confirmar este aporte.</span>
            </label>
          )}
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl bg-background p-3 text-sm">
          <span>Exibir esta caixinha no painel da Home</span>
          <input type="checkbox" checked={exibirHome} onChange={(e) => setExibirHome(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        </label>

        <div>
          <span className={rotulo}>Cor</span>
          <div className="flex flex-wrap gap-2">
            {CORES_CAIXINHA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                className={`size-7 rounded-full border-2 transition ${cor === c ? "scale-110 border-ink" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {erro && (
          <p className="text-sm text-red-400" role="alert">
            {erro}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {onExcluir && (
            <button type="button" onClick={excluir} className="h-9 rounded-lg px-3 text-sm text-red-400 hover:underline">
              Excluir
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onFechar} className={botaoSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className={`${botaoPrimario} disabled:opacity-60`}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </DialogResponsivo>
  );
}

/* ------------------------------------------------------------------ */
/* Registro de aporte / resgate                                        */
/* ------------------------------------------------------------------ */

export function MovimentoDialog({
  caixinhas,
  caixinhaId,
  tipoInicial = "aporte",
  onRegistrar,
  onFechar,
}: {
  caixinhas: Caixinha[];
  caixinhaId?: string;
  tipoInicial?: TipoMovimento;
  onRegistrar: (m: NovoMovimento) => Promise<string | null>;
  onFechar: () => void;
}) {
  const [destino, setDestino] = useState(caixinhaId ?? caixinhas[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoMovimento>(tipoInicial);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const atual = caixinhas.find((c) => c.id === destino);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseValor(valor);
    if (v <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    if (!data) {
      setErro("Informe a data.");
      return;
    }
    setSalvando(true);
    setErro("");
    const msg = await onRegistrar({ caixinhaId: destino, tipo, valor: v, data, descricao: descricao.trim() || undefined });
    setSalvando(false);
    if (msg) setErro(msg);
    else onFechar();
  };

  return (
    <DialogResponsivo titulo={tipo === "aporte" ? "Guardar na caixinha" : tipo === "rendimento" ? "Registrar rendimento" : "Resgatar da caixinha"} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Segmentado
          valor={tipo}
          opcoes={[
            { id: "aporte", nome: "Aporte" },
            { id: "rendimento", nome: "Rendimento" },
            { id: "resgate", nome: "Resgate" },
          ]}
          onChange={setTipo}
        />

        <label className="block">
          <span className={rotulo}>Caixinha de destino</span>
          <select className={campo} value={destino} onChange={(e) => setDestino(e.target.value)}>
            {caixinhas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {atual && <span className="mt-1 block text-xs text-muted">Saldo atual: {brl(atual.saldo)}</span>}
          {tipo === "rendimento" && <span className="mt-1 block text-xs text-muted">Informe quanto rendeu, como aparece no app do seu banco. O valor soma no saldo.</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={rotulo}>Valor</span>
            <CampoReais valor={valor} onChange={setValor} />
          </label>
          <label className="block">
            <span className={rotulo}>Data</span>
            <input type="date" className={campo} value={data} max="2100-12-31" onChange={(e) => setData(e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className={rotulo}>Observação (opcional)</span>
          <input className={campo} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={80} placeholder={tipo === "rendimento" ? "Ex.: Rendimento de setembro" : "Ex.: 13º salário"} />
        </label>

        {erro && (
          <p className="text-sm text-red-400" role="alert">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={botaoSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando || !destino} className={`${botaoPrimario} disabled:opacity-60`}>
            {salvando ? "Salvando..." : `Registrar ${ROTULO_MOVIMENTO[tipo].toLowerCase()}`}
          </button>
        </div>
      </form>
    </DialogResponsivo>
  );
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

export function HistoricoDialog({
  movimentos,
  caixinhas,
  caixinhaId,
  onExcluir,
  onFechar,
}: {
  movimentos: Movimento[];
  caixinhas: Caixinha[];
  caixinhaId?: string;
  onExcluir: (id: string) => Promise<string | null>;
  onFechar: () => void;
}) {
  const [filtro, setFiltro] = useState(caixinhaId ?? "");
  const [erro, setErro] = useState("");

  const nomes = new Map(caixinhas.map((c) => [c.id, c.nome]));
  const lista = filtro ? movimentos.filter((m) => m.caixinhaId === filtro) : movimentos;

  const excluir = async (m: Movimento) => {
    if (!confirm(`Excluir este ${ROTULO_MOVIMENTO[m.tipo].toLowerCase()} de ${brl(m.valor)}? O saldo da caixinha será recalculado.`)) return;
    setErro((await onExcluir(m.id)) ?? "");
  };

  return (
    <DialogResponsivo titulo="Histórico de aportes" onFechar={onFechar}>
      <div className="space-y-3">
        <select className={campo} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por caixinha">
          <option value="">Todas as caixinhas</option>
          {caixinhas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        {erro && (
          <p className="text-sm text-red-400" role="alert">
            {erro}
          </p>
        )}

        {lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {lista.map((m) => {
              const entrada = m.tipo !== "resgate";
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {nomes.get(m.caixinhaId) ?? "Caixinha removida"}
                      {m.origem === "automatico" && (
                        <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Automático</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {dataBR(m.data)} · {ROTULO_MOVIMENTO[m.tipo]}
                      {m.descricao ? ` · ${m.descricao}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-sm font-semibold tabular-nums ${entrada ? "text-emerald-500" : "text-red-400"}`}>
                      {entrada ? "+" : "−"} {brl(m.valor)}
                    </span>
                    <button type="button" onClick={() => excluir(m)} className="text-xs text-red-400 hover:underline">
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DialogResponsivo>
  );
}
