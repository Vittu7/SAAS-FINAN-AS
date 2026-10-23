'use client';
import { X } from "lucide-react";
import { Ico } from "@/components/icons";
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export default function DialogResponsivo({titulo, onFechar, children}: {titulo: string; onFechar: () => void; children: ReactNode}) {
  const [montado, setMontado] = useState(false);
  const [viewport, setViewport] = useState<{height: number; top: number} | null>(null);
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef(onFechar); fechar.current = onFechar;
  useEffect(() => {
    setMontado(true);
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const ajustar = () => setViewport({height: window.visualViewport?.height || window.innerHeight, top: window.visualViewport?.offsetTop || 0});
    ajustar(); window.visualViewport?.addEventListener('resize', ajustar); window.visualViewport?.addEventListener('scroll', ajustar);
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); fechar.current(); }
      if (e.key !== 'Tab') return;
      const elementos = Array.from(painel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const primeiro = elementos[0], ultimo = elementos[elementos.length - 1];
      if (!primeiro || !ultimo) { e.preventDefault(); painel.current?.focus(); return; }
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', teclado, true);
    const id = requestAnimationFrame(() => painel.current?.focus());
    return () => { cancelAnimationFrame(id); document.body.style.overflow = overflow; document.removeEventListener('keydown', teclado, true); window.visualViewport?.removeEventListener('resize', ajustar); window.visualViewport?.removeEventListener('scroll', ajustar); anterior?.focus(); };
  }, []);
  if (!montado) return null;
  return createPortal(<div className="fixed inset-x-0 z-[10010] grid items-end justify-items-center bg-ink/40 p-2 sm:items-center sm:p-6" style={{top: viewport?.top || 0, height: viewport?.height || '100dvh'}} onMouseDown={e => {if(e.target === e.currentTarget) onFechar();}}>
    <section ref={painel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} className="flex max-h-full min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl outline-none">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line p-4"><h2 className="min-w-0 break-words text-lg font-semibold">{titulo}</h2><button type="button" onClick={onFechar} aria-label="Fechar formulário" className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-background"><Ico icon={X} /></button></header>
      <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4" style={{paddingBottom:'max(16px, env(safe-area-inset-bottom))'}}>{children}</div>
    </section>
  </div>, document.body);
}
