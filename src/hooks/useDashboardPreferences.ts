'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizarPreferencias, PREFERENCIAS_PADRAO, type PreferenciasDashboard } from '@/lib/dashboardPreferences';
export function useDashboardPreferences(userId: string | null) {
  const [preferencias, setPreferencias] = useState(PREFERENCIAS_PADRAO);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    setPronto(false); setErro(''); setPreferencias(PREFERENCIAS_PADRAO);
    if (!userId) return;
    void supabase.from('preferencias_dashboard').select('preferencias').eq('user_id', userId).maybeSingle().then(({data, error}) => {
      if (!ativo) return;
      if (error) setErro('Não foi possível carregar as preferências. Confira se a atualização SQL foi aplicada.');
      else setPreferencias(normalizarPreferencias(data?.preferencias));
      setPronto(true);
    });
    return () => { ativo = false; };
  }, [userId]);
  const alterar = async (chave: keyof PreferenciasDashboard, valor: boolean) => {
    if (!userId || !pronto || salvando) return;
    setSalvando(true); setErro('');
    const nova = {...preferencias, [chave]: valor};
    try {
      const {error} = await supabase.from('preferencias_dashboard').upsert({user_id: userId, preferencias: nova}, {onConflict:'user_id'});
      if (error) throw error;
      setPreferencias(nova);
    } catch { setErro('Não foi possível salvar. Sua preferência anterior foi mantida.'); }
    finally { setSalvando(false); }
  };
  return {preferencias, pronto, salvando, erro, alterar};
}
