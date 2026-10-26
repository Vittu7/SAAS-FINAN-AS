"use client";

import { useMemo, useState } from "react";
import { ArrowRight, HandCoins, Lock, Settings2, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Avatar, { AvatarPilha } from "@/components/Avatar";
import AutorTag from "@/components/AutorTag";
import EstadoVazio from "@/components/EstadoVazio";
import PessoaIcone from "@/components/PessoaIcone";
import { Ico, ICONE_ABA, ICONES } from "@/components/icons";
import { brl, rotuloMes } from "@/lib/finance";
import { avisarPerfilAtualizado } from "@/lib/perfil";
import { FILTRO_GRUPO_INICIAL, filtrarGrupo, lancamentosDoGrupo, resumoPorMembro, resumoRepasses, type FiltroGrupo, type LancGrupo, type PendenciaPessoa } from "@/lib/grupo";
import type { Membro } from "@/hooks/useFinanceStore";

type Sub = "resumo" | "lancamentos" | "repasses";
type Dados = { extrato: any[]; cartao: any[]; contas: any[]; config?: { salario?: number } };
type Marcar = (itens: { origem: "extrato" | "cartao" | "contas"; id: string }[], pago: boolean) => Promise<boolean>;

const ICONE_TIPO = { avista: ICONE_ABA.lancamentos, parcelada: ICONE_ABA.cartao, fixa: ICONE_ABA.contas } as const;
const sel = "h-11 w-full rounded-xl border border-line bg-background px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

/* ---------- Uma linha de lançamento do grupo ---------- */
function LinhaGrupo({ l, meuId, onMarcar }: { l: LancGrupo; meuId: string; onMarcar?: (l: LancGrupo, pago: boolean) => void }) {
  const souAutor = l.autorId === meuId;
  return (
    <li className="flex items-start gap-3 py-3">
      <PessoaIcone pessoa={{ nome: l.respNome, avatar: l.respAvatar, cor: l.respCor }} icone={ICONE_TIPO[l.tipo]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{l.descricao}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <b className="font-semibold text-ink">{l.respNome}</b>
          <Ico icon={ArrowRight} size={11} />
          <span>{l.autorNome}</span>
          <span aria-hidden>·</span>
          <span>{l.tipoRotulo}{l.parcela ? ` ${l.parcela}` : ""}</span>
          <span aria-hidden>·</span>
          <span>{rotuloMes(l.mes)}</span>
          {l.vencimento ? <><span aria-hidden>·</span><span>vence dia {l.vencimento}</span></> : null}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <AutorTag nome={l.autorNome} avatar={l.autorAvatar} cor={l.autorCor} />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.repassePago ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{l.repassePago ? "Repassado" : l.vencido ? "Repasse pendente" : "A vencer"}</span>
          {l.contaPaga !== null && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.contaPaga ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-background text-muted ring-1 ring-line"}`}>{l.contaPaga ? "Conta paga" : "Conta a pagar"}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold tabular-nums">{brl(l.valor)}</p>
        {onMarcar && (souAutor ? (
          <button type="button" onClick={() => onMarcar(l, !l.repassePago)} className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold transition active:scale-95 ${l.repassePago ? "text-muted ring-1 ring-line hover:bg-background" : "bg-accent text-on-accent"}`}>
            {l.repassePago ? <><Ico icon={Undo2} size={13} />Desfazer</> : <><Ico icon={HandCoins} size={13} />Recebi</>}
          </button>
        ) : !l.repassePago && <span className="text-[11px] text-muted">Aguardando {l.autorNome}</span>)}
      </div>
    </li>
  );
}

/* ---------- Valores a repassar ---------- */
function BlocoPessoa({ p, meuId, lado, onMarcar, onMarcarVarios }: { p: PendenciaPessoa; meuId: string; lado: "receber" | "repassar"; onMarcar: (l: LancGrupo, pago: boolean) => void; onMarcarVarios: (ls: LancGrupo[]) => void }) {
  const [verPagos, setVerPagos] = useState(false);
  const abertos = p.itens.filter((l) => !l.repassePago);
  const pagos = p.itens.filter((l) => l.repassePago);
  const vencidos = abertos.filter((l) => l.vencido);
  return (
    <section className="card-glass overflow-hidden">
      <header className="flex items-center gap-3 p-4">
        <Avatar src={p.avatar} nome={p.nome} cor={p.cor} tamanho="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{lado === "receber" ? `${p.nome} deve a você` : `Você deve a ${p.nome}`}</p>
          <p className="text-xs text-muted">Agora <b className="text-ink">{brl(p.agora)}</b>{p.aVencer > 0 && <> · A vencer {brl(p.aVencer)}</>}{p.recebido > 0 && <> · Repassado {brl(p.recebido)}</>}</p>
        </div>
        {lado === "receber" && vencidos.length > 1 && (
          <button type="button" onClick={() => onMarcarVarios(vencidos)} className="hidden h-9 shrink-0 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent sm:block">Receber tudo ({vencidos.length})</button>
        )}
      </header>
      {lado === "receber" && vencidos.length > 1 && (
        <div className="px-4 pb-2 sm:hidden"><button type="button" onClick={() => onMarcarVarios(vencidos)} className="h-10 w-full rounded-lg bg-accent text-xs font-semibold text-on-accent">Marcar tudo como recebido ({vencidos.length})</button></div>
      )}
      <ul className="divide-y divide-line border-t border-line px-4">
        {abertos.map((l) => <LinhaGrupo key={l.chave} l={l} meuId={meuId} onMarcar={onMarcar} />)}
        {verPagos && pagos.map((l) => <LinhaGrupo key={l.chave} l={l} meuId={meuId} onMarcar={onMarcar} />)}
      </ul>
      {pagos.length > 0 && (
        <button type="button" onClick={() => setVerPagos((v) => !v)} className="w-full border-t border-line py-2.5 text-xs font-medium text-accent hover:bg-background">{verPagos ? "Ocultar já repassados" : `Ver já repassados (${pagos.length})`}</button>
      )}
    </section>
  );
}

function AbaRepasses({ lista, meuId, onMarcar, onNova }: { lista: LancGrupo[]; meuId: string; onMarcar: Marcar; onNova: () => void }) {
  const r = useMemo(() => resumoRepasses(lista, meuId), [lista, meuId]);
  const marcar = (l: LancGrupo, pago: boolean) => void onMarcar([{ origem: l.origem, id: l.id }], pago);
  const marcarVarios = (ls: LancGrupo[]) => {
    if (window.confirm(`Marcar ${ls.length} valores como recebidos?`)) void onMarcar(ls.map((l) => ({ origem: l.origem, id: l.id })), true);
  };
  const nada = r.aReceber.pessoas.length === 0 && r.aRepassar.pessoas.length === 0;

  if (nada) {
    return <EstadoVazio icone={HandCoins} titulo="Nenhum valor a repassar" descricao="Quando você lança uma despesa e escolhe outra pessoa do grupo como responsável, o valor aparece aqui para ela repassar a você, e você acompanha e marca quando receber." passos={["Toque em Nova transação e escolha Saída", "Em Mais opções, marque a pessoa responsável pelo gasto", "Acompanhe aqui e marque quando receber"]} acao={{ rotulo: "Nova transação", onClick: onNova }} />;
  }

  const card = (titulo: string, valor: number, sub: string, cor = "") => (
    <div className="card-glass p-4"><p className="text-xs text-muted">{titulo}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${cor}`}>{brl(valor)}</p><p className="mt-0.5 text-[11px] text-muted">{sub}</p></div>
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {card("A receber", r.aReceber.agora, r.aReceber.aVencer > 0 ? `+ ${brl(r.aReceber.aVencer)} a vencer` : "Pendente agora", "text-emerald-700 dark:text-emerald-400")}
        {card("A repassar", r.aRepassar.agora, r.aRepassar.aVencer > 0 ? `+ ${brl(r.aRepassar.aVencer)} a vencer` : "Pendente agora", "text-amber-700 dark:text-amber-400")}
        {card("Já acertado", r.aReceber.recebido + r.aRepassar.recebido, "Recebido e repassado")}
      </div>
      {r.aReceber.pessoas.length > 0 && (
        <div className="space-y-3"><h3 className="px-1 text-sm font-bold">Valores a receber</h3>{r.aReceber.pessoas.map((p) => <BlocoPessoa key={p.pessoaId} p={p} meuId={meuId} lado="receber" onMarcar={marcar} onMarcarVarios={marcarVarios} />)}</div>
      )}
      {r.aRepassar.pessoas.length > 0 && (
        <div className="space-y-3"><h3 className="px-1 text-sm font-bold">Valores que você deve repassar</h3>{r.aRepassar.pessoas.map((p) => <BlocoPessoa key={p.pessoaId} p={p} meuId={meuId} lado="repassar" onMarcar={marcar} onMarcarVarios={marcarVarios} />)}
          <p className="px-1 text-xs text-muted">Depois de repassar, peça para quem lançou confirmar o recebimento. Só ele pode dar baixa.</p></div>
      )}
    </div>
  );
}

/* ---------- Lançamentos do grupo ---------- */
function AbaLancamentos({ lista, membros, meuId, onMarcar }: { lista: LancGrupo[]; membros: Membro[]; meuId: string; onMarcar: Marcar }) {
  const [f, setF] = useState<FiltroGrupo>(FILTRO_GRUPO_INICIAL);
  const filtrada = useMemo(() => filtrarGrupo(lista, f), [lista, f]);
  const total = filtrada.reduce((t, l) => t + l.valor, 0);
  const ativos = JSON.stringify(f) !== JSON.stringify(FILTRO_GRUPO_INICIAL);
  const marcar = (l: LancGrupo, pago: boolean) => void onMarcar([{ origem: l.origem, id: l.id }], pago);

  return (
    <div className="space-y-4">
      <section className="card-glass space-y-3 p-4 md:p-5" aria-label="Filtros dos lançamentos do grupo">
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold">Lançamentos do grupo</h3><p className="text-xs text-muted">O que uma pessoa lançou para outra ser a responsável.</p></div>
          {ativos && <button type="button" onClick={() => setF(FILTRO_GRUPO_INICIAL)} className="text-xs font-medium text-accent hover:underline">Limpar filtros</button>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select aria-label="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as FiltroGrupo["tipo"] })} className={sel}>
            <option value="todos">Todos os tipos</option><option value="avista">Despesas à vista</option><option value="parcelada">Compras parceladas</option><option value="fixa">Contas fixas</option>
          </select>
          <select aria-label="Responsável" value={f.responsavelId} onChange={(e) => setF({ ...f, responsavelId: e.target.value })} className={sel}>
            <option value="">Qualquer responsável</option>{membros.map((m) => <option key={m.id} value={m.id}>Responsável: {m.nome}</option>)}
          </select>
          <select aria-label="Quem lançou" value={f.autorId} onChange={(e) => setF({ ...f, autorId: e.target.value })} className={sel}>
            <option value="">Qualquer autor</option>{membros.map((m) => <option key={m.id} value={m.id}>Lançado por {m.nome}</option>)}
          </select>
          <select aria-label="Situação" value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value as FiltroGrupo["situacao"] })} className={sel}>
            <option value="todas">Todas as situações</option><option value="repasse-pendente">Repasse pendente</option><option value="repasse-recebido">Repasse recebido</option><option value="conta-a-pagar">Conta fixa a pagar</option><option value="conta-paga">Conta fixa paga</option>
          </select>
        </div>
      </section>
      {filtrada.length === 0 ? (
        <EstadoVazio compacto icone={ICONES.grupo} titulo={ativos ? "Nada encontrado com esses filtros" : "Nenhum lançamento entre membros"} descricao={ativos ? "Tente limpar os filtros." : "Quando alguém lançar uma despesa para outra pessoa ser a responsável, ela aparece aqui."} />
      ) : (
        <section className="card-glass px-4 py-1 md:px-5">
          <p className="border-b border-line py-3 text-xs text-muted">{filtrada.length} {filtrada.length === 1 ? "lançamento" : "lançamentos"} · total <b className="text-ink">{brl(total)}</b></p>
          <ul className="anim-stagger divide-y divide-line">{filtrada.map((l) => <LinhaGrupo key={l.chave} l={l} meuId={meuId} onMarcar={marcar} />)}</ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Resumo por membro ---------- */
function AbaResumo({ dados, membros, meuId, mes }: { dados: Dados; membros: Membro[]; meuId: string; mes: string }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const resumos = useMemo(() => resumoPorMembro(dados, membros, mes, { meuId, salarioConfig: dados.config?.salario ?? 0 }), [dados, membros, mes, meuId]);

  const alternarMeuResumo = async (visivel: boolean) => {
    setSalvando(true);
    setErro("");
    const { data, error } = await supabase.from("perfis").update({ resumo_visivel: visivel }).eq("id", meuId).select("id").maybeSingle();
    setSalvando(false);
    if (error || !data) return setErro(/resumo_visivel/.test(error?.message || "") ? "Execute o script supabase-04-grupo-repasses.sql no Supabase para habilitar esta opção." : "Não foi possível salvar sua preferência.");
    avisarPerfilAtualizado();
  };

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-muted">Resumo de {rotuloMes(mes)} por pessoa. Para os outros membros, considera os lançamentos que você tem permissão para ver.</p>
      <div className="anim-stagger grid gap-4 md:grid-cols-2">
        {membros.map((m) => {
          const eu = m.id === meuId;
          const r = resumos.find((x) => x.id === m.id)!;
          const oculto = !eu && !m.resumoVisivel;
          return (
            <article key={m.id} className="card-glass space-y-4 p-5">
              <header className="flex items-center gap-3">
                <Avatar src={m.avatar} nome={m.nome} cor={m.cor} tamanho="lg" anel />
                <div className="min-w-0"><p className="truncate text-base font-bold">{m.nome}{eu && <span className="ml-2 text-xs font-medium text-accent">você</span>}</p><p className="text-xs text-muted">{m.cargo === "admin" ? "Administrador" : "Membro"}</p></div>
              </header>
              {oculto ? (
                <p className="flex items-center gap-2 rounded-xl bg-background p-4 text-sm text-muted"><Ico icon={Lock} size={16} />{m.nome} escolheu não exibir o resumo financeiro.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-emerald-500/10 p-3"><dt className="text-xs text-muted">Entradas</dt><dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(r.entradas)}</dd></div>
                  <div className="rounded-xl bg-rose-500/10 p-3"><dt className="text-xs text-muted">Despesas</dt><dd className="font-semibold tabular-nums text-rose-700 dark:text-rose-400">{brl(r.saidas)}</dd></div>
                  <div className="rounded-xl bg-background p-3 ring-1 ring-line"><dt className="text-xs text-muted">Saldo restante</dt><dd className={`font-semibold tabular-nums ${r.saldo < 0 ? "text-rose-700 dark:text-rose-400" : ""}`}>{r.saldo < 0 ? "− " : ""}{brl(Math.abs(r.saldo))}</dd></div>
                  <div className="rounded-xl bg-amber-500/10 p-3"><dt className="text-xs text-muted">Repasses</dt><dd className="text-xs font-semibold tabular-nums">Receber {brl(r.aReceber)}<br />Repassar {brl(r.aRepassar)}</dd></div>
                </dl>
              )}
              {eu && (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <span><span className="block font-medium">Mostrar meu resumo ao grupo</span><span className="block text-xs text-muted">Desligado, os outros não veem suas entradas, despesas e saldo aqui.</span></span>
                  <input type="checkbox" role="switch" checked={m.resumoVisivel} disabled={salvando} onChange={(e) => alternarMeuResumo(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
                </label>
              )}
            </article>
          );
        })}
      </div>
      {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}
    </div>
  );
}

/* ---------- Tela ---------- */
export default function TelaGrupo({
  dados, membros, userId, mes, onMarcarRepasses, onGerenciar, onNova, abaInicial = "resumo",
}: { dados: Dados; membros: Membro[]; userId: string | null; mes: string; onMarcarRepasses: Marcar; onGerenciar: () => void; onNova: () => void; abaInicial?: Sub }) {
  const [sub, setSub] = useState<Sub>(abaInicial);
  const meuId = userId || "";
  const lista = useMemo(() => lancamentosDoGrupo(dados), [dados]);
  const pendentes = useMemo(() => lista.filter((l) => !l.repassePago && l.vencido && (l.autorId === meuId || l.respId === meuId)).length, [lista, meuId]);
  const chip = (a: boolean) => `relative h-10 flex-1 rounded-full text-sm font-semibold transition sm:flex-none sm:px-5 ${a ? "bg-accent text-on-accent shadow-sm" : "text-muted"}`;

  if (membros.length === 0) {
    return <EstadoVazio icone={ICONES.grupo} titulo="Você ainda não faz parte de um grupo" descricao="Crie um grupo para a sua família ou entre em um existente. Com o grupo, vocês dividem despesas, veem quem lançou cada gasto e acompanham valores a repassar." acao={{ rotulo: "Criar ou entrar em um grupo", onClick: onGerenciar }} />;
  }

  return (
    <div className="space-y-5">
      <section className="card-glass flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3"><AvatarPilha pessoas={membros.map((m) => ({ nome: m.nome, avatar: m.avatar, cor: m.cor }))} tamanho="md" /><p className="text-sm text-muted">{membros.length} {membros.length === 1 ? "pessoa" : "pessoas"} no grupo</p></div>
        <button type="button" onClick={onGerenciar} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-background"><Ico icon={Settings2} size={16} />Gerenciar grupo</button>
      </section>

      <div className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line sm:w-fit" role="tablist" aria-label="Seções do grupo">
        <button type="button" role="tab" aria-selected={sub === "resumo"} onClick={() => setSub("resumo")} className={chip(sub === "resumo")}>Resumo</button>
        <button type="button" role="tab" aria-selected={sub === "lancamentos"} onClick={() => setSub("lancamentos")} className={chip(sub === "lancamentos")}>Lançamentos</button>
        <button type="button" role="tab" aria-selected={sub === "repasses"} onClick={() => setSub("repasses")} className={chip(sub === "repasses")}>Repasses{pendentes > 0 && <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendentes}</span>}</button>
      </div>

      {sub === "resumo" && <AbaResumo dados={dados} membros={membros} meuId={meuId} mes={mes} />}
      {sub === "lancamentos" && <AbaLancamentos lista={lista} membros={membros} meuId={meuId} onMarcar={onMarcarRepasses} />}
      {sub === "repasses" && <AbaRepasses lista={lista} meuId={meuId} onMarcar={onMarcarRepasses} onNova={onNova} />}
    </div>
  );
}
