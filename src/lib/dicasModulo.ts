/** Dicas curtas exibidas no topo de cada módulo (uma vez por usuário). */
export const DICAS_MODULO: Record<string, { titulo: string; passos: string[]; tutorial: string }> = {
  extrato: { titulo: "Como usar o Extrato", tutorial: "extrato", passos: ["Escolha o mês no topo da tela.", "Use a busca e os filtros para achar um lançamento.", "Toque no lápis para editar ou na lixeira para remover."] },
  cartao: { titulo: "Como usar Contas parceladas", tutorial: "parceladas", passos: ["Lance uma compra em Nova transação > Saída > Parcelado.", "As próximas parcelas aparecem sozinhas nos meses seguintes.", "Aqui você consulta, edita e remove as parcelas."] },
  contas: { titulo: "Como usar Contas fixas", tutorial: "fixas", passos: ["Cadastre em Nova transação > Saída > Fixa.", "Todo mês a conta reaparece nesta lista.", "Marque como paga quando pagar: o “Falta pagar” se atualiza."] },
  fatura: { titulo: "Como usar Cartões e Faturas", tutorial: "cartoes", passos: ["Toque em um cartão para ver a fatura dele.", "Use as setas para mudar de mês.", "A barra mostra quanto do limite já foi usado."] },
  graficos: { titulo: "Como usar Gráficos e relatórios", tutorial: "graficos", passos: ["Em Gráficos, veja a evolução e a divisão dos gastos.", "Em Relatórios, escolha o período e os filtros.", "Exporte em Excel (CSV) ou PDF."] },
  lancamentos: { titulo: "Como usar o módulo de Lançamentos do mês", tutorial: "extrato", passos: ["Veja os lançamentos à vista em formato de tabela.", "Edite ou remova pela linha.", "Para criar um novo, use o botão Nova transação."] },
};
