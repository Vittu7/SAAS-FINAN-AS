export const PREFERENCIAS_PADRAO = { resumo: true, graficos: true, faturas: true, investimentos: true };
export type PreferenciasDashboard = typeof PREFERENCIAS_PADRAO;
export function normalizarPreferencias(valor: unknown): PreferenciasDashboard {
  const fonte = valor && typeof valor === 'object' ? valor as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(PREFERENCIAS_PADRAO).map(([chave, padrao]) => [chave, typeof fonte[chave] === 'boolean' ? fonte[chave] : padrao])) as PreferenciasDashboard;
}
