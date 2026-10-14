"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/finance";
import GerenciarOpcoesModal from "@/components/GerenciarOpcoesModal";

interface Opcao {
  id: string;
  nome: string;
  cor: string;
}

export default function ContasFixasTable({
  mes,
  itens,
  onAdd,
  onRemove,
  onTogglePago,
  onCopiarMesAnterior,
}: {
  mes: string;
  itens: any[];
  onAdd: (item: any) => void;
  onRemove: (id: string) => void;
  onTogglePago: (id: string) => void;
  onCopiarMesAnterior: () => void;
}) {
  const [nome, setNome] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");

  const [membros, setMembros] = useState<string[]>([]);
  const [meuNome, setMeuNome] = useState("");
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [menuResponsavelAberto, setMenuResponsavelAberto] = useState(false);

  const [opcoesCategoria, setOpcoesCategoria] = useState<Opcao[]>([]);
  const [modalOpcaoAberto, setModalOpcaoAberto] = useState<"pagamento" | "categoria" | "cartao" | null>(null);

  const carregarDadosIniciais = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
      .from("perfis")
      .select("grupo_id, nome_usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (perfil) {
      const nomeReal = perfil.nome_usuario || "Usuário";
      setMeuNome(nomeReal);
      setResponsaveisSelecionados([nomeReal]);

      if (perfil.grupo_id) {
        const [resMembros, resCat] = await Promise.all([
          supabase.from("perfis").select("nome_usuario").eq("grupo_id", perfil.grupo_id),
          supabase.from("opcoes_categoria").select("*").eq("grupo_id", perfil.grupo_id).order("nome"),
        ]);

        if (resMembros.data) {
          const nomes = resMembros.data.map((m) => m.nome_usuario).filter(Boolean);
          setMembros(nomes.length > 0 ? nomes : [nomeReal]);
        }

        if (resCat.data) setOpcoesCategoria(resCat.data);
      }
    }
  }, []);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  const alternarResponsavel = (n: string) => {
    setResponsaveisSelecionados((prev) =>
      prev.includes(n)
        ? prev.length > 1 ? prev.filter((item) => item !== n) : prev
        : [...prev, n]
    );
  };

  const selecionarTodos = () => {
    setResponsaveisSelecionados(
      responsaveisSelecionados.length === membros.length ? [meuNome || "Usuário"] : [...membros]
    );
  };

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = parseValor(valorTexto);

    if (!nome.trim()) {
      alert("Por favor, insira o nome da conta.");
      return;
    }

    if (isNaN(valorTotal) || valorTotal <= 0) {
      alert("Por favor, insira um valor válido (ex: 50,00).");
      return;
    }

    const qtd = responsaveisSelecionados.length;
    const valorIndividual = valorTotal / (qtd > 0 ? qtd : 1);

    responsaveisSelecionados.forEach((resp) => {
      onAdd({
        mes,
        nome: qtd > 1 ? `${nome} (1/${qtd})` : nome,
        valor: valorIndividual,
        vencimento,
        categoria: categoria || "Outros",
        pago: false,
        responsavel: resp,
      });
    });

    setNome("");
    setValorTexto("");
    setVencimento("");
    setCategoria("");
    setResponsaveisSelecionados([meuNome || "Usuário"]);
    setMenuResponsavelAberto(false);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 md:p-6 shadow-lg space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-muted">Contas Recorrentes do Mês</h3>
        <button
          type="button"
          onClick={onCopiarMesAnterior}
          className="text-xs bg-surface border border-line hover:bg-background px-3 py-1.5 rounded-xl transition text-ink"
        >
          📋 Copiar Contas do Mês Anterior
        </button>
      </div>

      <form onSubmit={handleAdicionar} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 items-end">
        
        {/* Nome da Conta */}
        <div className="lg:col-span-3">
          <label className="text-xs font-medium text-muted block mb-1">Nome da Conta</label>
          <input
            type="text"
            placeholder="Ex: Energia, Internet"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Categoria */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-muted">Categoria</label>
            <button
              type="button"
              onClick={() => setModalOpcaoAberto("categoria")}
              className="text-[10px] text-accent hover:underline font-medium"
            >
              ⚙️ Editar
            </button>
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-xl border border-line bg-background text-ink px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="" className="bg-surface text-ink">Selecione...</option>
            {opcoesCategoria.map((c) => (
              <option key={c.id} value={c.nome} className="bg-surface text-ink">
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Valor */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-muted block mb-1">Valor (R