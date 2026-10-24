import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  ChartPie,
  CreditCard,
  House,
  ListFilter,
  ListPlus,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Tags,
  Trash2,
  UserRound,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícones do app (Lucide). Ponto único de padronização:
 * traço de 1.75 px, tamanhos de 16 a 24 px e cor herdada via currentColor,
 * para respeitar os temas claro e escuro.
 */
export const ICONE_TRACO = 1.75;

export function Ico({
  icon: Icone,
  size = 20,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return <Icone aria-hidden="true" focusable="false" size={size} strokeWidth={ICONE_TRACO} className={className} />;
}

/** Ícone de cada aba/módulo (mesmos ids usados em Sidebar e MobileShell). */
export const ICONE_ABA: Record<string, LucideIcon> = {
  inicio: House,
  extrato: ArrowLeftRight,
  lancamentos: ListPlus,
  fatura: WalletCards,
  cartao: CalendarDays, // contas parceladas
  contas: CalendarClock, // contas fixas
  ajustes: Settings,
  graficos: ChartPie,
  investimentos: ChartNoAxesCombined,
};

/** Ícone por origem da linha no extrato (lançamento, parcela, conta fixa). */
export const ICONE_ORIGEM_LINHA: Record<"extrato" | "cartao" | "contas", LucideIcon> = {
  extrato: ListPlus,
  cartao: CalendarDays,
  contas: CalendarClock,
};

/** Ícones de ações e módulos avulsos. */
export const ICONES = {
  graficos: ChartPie,
  investimentos: ChartNoAxesCombined,
  grupo: Users,
  perfil: UserRound,
  cartoes: CreditCard,
  pagamentos: Wallet,
  categorias: Tags,
  entrada: ArrowDownLeft,
  saida: ArrowUpRight,
  notificacoes: Bell,
  novo: Plus,
  buscar: Search,
  editar: Pencil,
  excluir: Trash2,
  filtrar: ListFilter,
  calendario: CalendarDays,
  sair: LogOut,
} satisfies Record<string, LucideIcon>;
