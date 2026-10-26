'use client';
import { sairDaConta } from '@/lib/auth';
import { Check, Crown, LayoutDashboard, Palette, type LucideIcon } from 'lucide-react';
import { ICONES, Ico } from '@/components/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GerenciarOpcoesModal from './GerenciarOpcoesModal';
import PerfilConta from './PerfilConta';
import { PainelAparencia } from './ThemeToggle';
import { supabase } from '@/lib/supabase';
import type { PreferenciasDashboard } from '@/lib/dashboardPreferences';

export type SecaoAjustes = 'perfil' | 'plano' | 'aparencia' | 'cadastros' | 'dashboard';
type Cadastro = 'cartoes' | 'pagamentos' | 'categorias';

const SECOES: { id: SecaoAjustes; nome: string; desc: string; s: LucideIcon }[] = [
  { id: 'perfil', nome: 'Perfil e conta', desc: 'Foto, nome, e-mail e grupo', s: ICONES.perfil },
  { id: 'plano', nome: 'Assinatura e plano', desc: 'Seu plano atual', s: Crown },
  { id: 'aparencia', nome: 'Aparência', desc: 'Tema claro, escuro ou sistema', s: Palette },
  { id: 'cadastros', nome: 'Cadastros', desc: 'Cartões, contas e categorias', s: ICONES.cartoes },
  { id: 'dashboard', nome: 'Tela inicial', desc: 'O que aparece no painel', s: LayoutDashboard },
];

const ITENS_DASH: { id: keyof PreferenciasDashboard; nome: string; desc: string }[] = [
  { id: 'resumo', nome: 'Resumo do mês', desc: 'Saldo, salário e gastos' },
  { id: 'graficos', nome: 'Gráficos', desc: 'Divisão por responsável e categoria' },
  { id: 'faturas', nome: 'Faturas do mês', desc: 'Total de cada cartão' },
  { id: 'investimentos', nome: 'Investimentos e reserva', desc: 'Metas e aportes' },
];

function Switch({ ligado, onChange, desabilitado, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; desabilitado?: boolean; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado} onClick={() => onChange(!ligado)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${ligado ? 'bg-accent' : 'bg-line'}`}>
      <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${ligado ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function CentralAjustes({ preferencias, pronto, salvando, erro, onAlterar, onGrupo, secaoInicial = 'perfil' }: {
  preferencias: PreferenciasDashboard; pronto: boolean; salvando: boolean; erro: string;
  onAlterar: (chave: keyof PreferenciasDashboard, valor: boolean) => Promise<void>;
  onGrupo: () => void; secaoInicial?: SecaoAjustes;
}) {
  const router = useRouter();
  const [secao, setSecao] = useState<SecaoAjustes>(secaoInicial);
  const [cadastro, setCadastro] = useState<Cadastro>('cartoes');
  const atual = SECOES.find((s) => s.id === secao)!;

  const sair = async () => { await sairDaConta(supabase); router.push('/login'); };

  return (
    <section className="grid min-w-0 gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
      {/* Navegação: chips roláveis no celular, lista lateral no computador */}
      <nav aria-label="Seções de configurações" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {SECOES.map((s) => (
          <button key={s.id} type="button" aria-pressed={secao === s.id} onClick={() => setSecao(s.id)}
            className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition md:w-full ${secao === s.id ? 'bg-accent text-on-accent shadow-sm' : 'bg-surface text-ink ring-1 ring-line hover:bg-background md:bg-transparent md:ring-0'}`}>
            <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full ${secao === s.id ? 'bg-white/20' : 'bg-accent/10 text-accent'}`}><Ico icon={s.s} size={18} /></span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap">{s.nome}</span>
              <span className={`hidden truncate text-[11px] font-normal md:block ${secao === s.id ? 'opacity-80' : 'text-muted'}`}>{s.desc}</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={sair} className="hidden items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-rose-500 hover:bg-rose-500/10 md:mt-2 md:flex">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-rose-500/10"><Ico icon={ICONES.sair} size={18} /></span>Sair da conta
        </button>
      </nav>

      <div className="min-w-0 space-y-4">
        <header>
          <h2 className="text-lg font-semibold">{atual.nome}</h2>
          <p className="text-sm text-muted">{atual.desc}</p>
        </header>

        {secao === 'perfil' && (
          <>
            <PerfilConta />
            <div className="card-glass grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
              <div className="min-w-0">
                <p className="font-semibold">Grupo financeiro</p>
                <p className="text-sm text-muted">Convide pessoas e divida os gastos.</p>
              </div>
              <button type="button" onClick={onGrupo} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent">Gerenciar</button>
            </div>
            <button type="button" onClick={sair} className="w-full rounded-2xl border border-rose-500/30 py-3 text-sm font-medium text-rose-500 md:hidden">Sair da conta</button>
          </>
        )}

        {secao === 'plano' && (
          <div className="card-glass overflow-hidden">
            <div className="bg-gradient-to-br from-accent to-accent/60 p-6 text-on-accent">
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">Plano atual</p>
              <p className="mt-1 text-2xl font-bold">Beta Teste</p>
              <p className="mt-1 text-sm opacity-90">Todos os recursos liberados durante o acesso antecipado BETA.</p>
            </div>
            <ul className="divide-y divide-line p-2 text-sm">
              {['Lançamentos, parcelas e contas fixas ilimitados', 'Faturas de cartão com controle de limite', 'Grupo financeiro compartilhado', 'Temas e personalização'].map((t) => (
                <li key={t} className="flex items-center gap-3 px-3 py-3"><Ico icon={Check} size={18} className="text-accent" />{t}</li>
              ))}
            </ul>
          </div>
        )}

        {secao === 'aparencia' && <div className="card-glass p-5"><PainelAparencia /></div>}

        {secao === 'cadastros' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
              {([['cartoes', 'Cartões'], ['pagamentos', 'Contas / Pagamentos'], ['categorias', 'Categorias']] as [Cadastro, string][]).map(([id, nome]) => (
                <button key={id} type="button" aria-pressed={cadastro === id} onClick={() => setCadastro(id)}
                  className={`min-w-0 truncate rounded-xl px-2 py-2 text-xs font-medium sm:text-sm ${cadastro === id ? 'bg-accent text-on-accent' : 'text-ink'}`}>{nome}</button>
              ))}
            </div>
            <div className="card-glass p-4">
              <GerenciarOpcoesModal key={cadastro} modo="pagina" abaInicial={cadastro} tipo={cadastro === 'categorias' ? 'categoria' : 'pagamento'} onClose={() => {}} />
            </div>
          </div>
        )}

        {secao === 'dashboard' && (
          <div className="card-glass divide-y divide-line px-5">
            {erro && <p role="alert" className="py-3 text-sm text-rose-500">{erro}</p>}
            {!pronto && <p className="py-3 text-sm text-muted">Carregando preferências…</p>}
            {ITENS_DASH.map((i) => (
              <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
                <span className="min-w-0"><span className="block font-medium">{i.nome}</span><span className="block text-xs text-muted">{i.desc}</span></span>
                <Switch rotulo={i.nome} ligado={preferencias[i.id]} desabilitado={!pronto || salvando} onChange={(v) => void onAlterar(i.id, v)} />
              </div>
            ))}
            {salvando && <p role="status" className="py-3 text-sm text-muted">Salvando…</p>}
          </div>
        )}
      </div>
    </section>
  );
}
