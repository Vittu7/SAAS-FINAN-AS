'use client';
import type {ReactNode} from 'react';
import DialogResponsivo from './DialogResponsivo';
export default function ModalFormulario({aberto, titulo, onFechar, children}: {aberto: boolean; titulo: string; onFechar: () => void; children: ReactNode}) {
  return aberto ? <DialogResponsivo titulo={titulo} onFechar={onFechar}>{children}</DialogResponsivo> : null;
}
