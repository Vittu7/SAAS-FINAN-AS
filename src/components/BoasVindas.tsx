"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CircleHelp, HandCoins, PiggyBank, Plus, Scale, Sparkles, Users, Wallet } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";

type Passo = { icone: typeof Sparkles; titulo: string; texto: string; visual?: "numeros" | "resumo" | "repasse" | "aporte" };

const PASSOS: Passo[] = [
  { icone: Sparkles, titulo: "Bem-vindo ao HomeCash!", texto: "Aqui você organiza o dinheiro da casa em um só lugar: o que entra, o que sai e o que sobra. Vamos mostrar como tudo funciona em poucas telas rápidas." },
  { icone: Scale, titulo: "Três números importam", texto: "Entradas é o dinheiro que você recebeu. Saídas é o que você gastou. Saldo restante é a diferença: o que sobra no mês.", visual: "numeros" },
  { icone: Wallet, titulo: "Como funciona o resumo", texto: "Na tela Início, o resumo mostra o mês escolhido. “Saldo disponível” é o que veio acumulado dos meses anteriores. O seletor troca entre “Resultado do mês” (só entradas − saídas) e “Total disponível” (tudo o que você tem agora, somando o acumulado). Toque em qualquer cartão para ver os lançamentos que formam o valor.", visual: "resumo" },
  { icone: Plus, titulo: "Tudo começa no botão +", texto: "Primeiro cadastre seu cartão ou conta (um cartão pode ter crédito e débito). Depois, para registrar qualquer entrada ou saída, use Nova transação. Deixamos um guia de primeiros passos na tela inicial: você segue no seu ritmo e pode pular o que não quiser fazer agora." },
  { icone: Users, titulo: "Grupo e repasses", texto: "Se alguém da família pagou uma despesa que é de outra pessoa, o valor vira um repasse. Quem deve marca “Repassei” (fica aguardando confirmação) e quem recebeu toca em “Concluir”. Repasse é só um acerto entre vocês: não conta como receita nem como despesa.", visual: "repasse" },
  { icone: PiggyBank, titulo: "Investimentos e aportes", texto: "Em Investimentos você cria caixinhas (reserva de emergência, viagem...). Ao fazer um aporte “pagando com o saldo da conta”, o dinheiro sai do seu total disponível, mas não é uma despesa: continua sendo seu, só que guardado.", visual: "aporte" },
  { icone: CircleHelp, titulo: "Precisa de ajuda?", texto: "A Central de Ajuda tem tutoriais passo a passo e perguntas frequentes, e cada módulo mostra uma dica curta na primeira vez. O botão do olho oculta todos os valores quando houver gente por perto. Pronto, é só começar!" },
];

const etiqueta = "rounded-xl p-3 text-xs font-semibold";

function Visual({ tipo }: { tipo: NonNullable<Passo["visual"]> }) {
  if (tipo === "numeros") {
    return (
      <div className="mx-auto mt-4 grid max-w-sm grid-cols-3 gap-2">
        <span className={`${etiqueta} bg-emerald-500/12 text-emerald-700 dark:text-emerald-400`}><Ico icon={ArrowDownLeft} size={16} className="mx-auto mb-1" />Entradas</span>
        <span className={`${etiqueta} bg-rose-500/12 text-rose-700 dark:text-rose-400`}><Ico icon={ArrowUpRight} size={16} className="mx-auto mb-1" />Saídas</span>
        <span className={`${etiqueta} bg-accent/12 text-accent`}><Ico icon={Scale} size={16} className="mx-auto mb-1" />Saldo</span>
      </div>
    );
  }
  if (tipo === "resumo") {
    return (
      <dl className="mx-auto mt-4 grid max-w-sm gap-2 text-left text-xs">
        <div className={`${etiqueta} bg-sky-500/12`}><dt className="text-sky-700 dark:text-sky-400">Saldo disponível</dt><dd className="mt-0.5 font-normal text-muted">Acumulado até o mês passado</dd></div>
        <div className={`${etiqueta} bg-background ring-1 ring-line`}><dt>Resultado do mês</dt><dd className="mt-0.5 font-normal text-muted">Entradas − saídas, só deste mês</dd></div>
        <div className={`${etiqueta} bg-accent/12`}><dt className="text-accent">Total disponível</dt><dd className="mt-0.5 font-normal text-muted">Saldo acumulado + resultado do mês</dd></div>
      </dl>
    );
  }
  if (tipo === "repasse") {
    return (
      <div className="mx-auto mt-4 flex max-w-sm items-center justify-between gap-1 text-[11px] font-semibold">
        <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-400">Pendente</span>
        <Ico icon={ArrowRight} size={14} className="text-muted" />
        <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-700 dark:text-sky-400">Repassado · aguardando</span>
        <Ico icon={ArrowRight} size={14} className="text-muted" />
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">Concluído</span>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-4 flex max-w-sm items-center justify-between gap-2 text-xs font-semibold">
      <span className={`${etiqueta} flex-1 bg-background ring-1 ring-line`}><Ico icon={Wallet} size={16} className="mx-auto mb-1" />Conta</span>
      <Ico icon={HandCoins} size={16} className="text-muted" />
      <span className={`${etiqueta} flex-1 bg-accent/12 text-accent`}><Ico icon={PiggyBank} size={16} className="mx-auto mb-1" />Caixinha</span>
    </div>
  );
}

export default function BoasVindas({ nome, onConcluir }: { nome?: string; onConcluir: () => void }) {
  const [i, setI] = useState(0);
  const p = PASSOS[i];
  const ultimo = i === PASSOS.length - 1;
  return (
    <DialogResponsivo titulo="Boas-vindas" onFechar={onConcluir}>
      <div className="space-y-5 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent/12 text-accent"><Ico icon={p.icone} size={30} /></span>
        <div key={i} className="anim-fade">
          <h3 className="text-xl font-bold">{i === 0 && nome ? `Olá, ${nome}! ` : ""}{p.titulo}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{p.texto}</p>
          {p.visual && <Visual tipo={p.visual} />}
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden>{PASSOS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-1.5 bg-line"}`} />)}</div>
        <div className="flex gap-2">
          {i > 0 ? <button type="button" onClick={() => setI(i - 1)} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Voltar</button> : <button type="button" onClick={onConcluir} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Pular</button>}
          <button type="button" onClick={() => (ultimo ? onConcluir() : setI(i + 1))} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">{ultimo ? "Começar" : "Próximo"}</button>
        </div>
        {i > 0 && !ultimo && <button type="button" onClick={onConcluir} className="text-xs font-medium text-muted hover:text-ink">Pular tour</button>}
      </div>
    </DialogResponsivo>
  );
}
