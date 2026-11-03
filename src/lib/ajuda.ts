/** Conteúdo da Central de Ajuda (textos simples, pensados para quem está começando). */
export type Tutorial = { id: string; aba: string; /** essencial = o básico, na frente; complementar = depois */ prioridade: "essencial" | "complementar"; titulo: string; resumo: string; passos: string[]; dicas?: string[] };
export type Pergunta = { id: string; pergunta: string; resposta: string; aba?: string };

export const TUTORIAIS: Tutorial[] = [
  {
    id: "cartoes", aba: "fatura", prioridade: "essencial", titulo: "1º passo: cadastre seu cartão ou conta",
    resumo: "Faça isto ANTES de lançar: assim crédito, débito, limite e saldo já funcionam desde o primeiro lançamento.",
    passos: [
      "Abra Cartões e Faturas e toque em “Cadastrar primeiro cartão” (ou use Configurações > Cadastros).",
      "Escolha Crédito, Débito ou Crédito e débito: um mesmo cartão pode ter os dois, e você escolhe qual usar a cada lançamento.",
      "Informe o nome (ex.: Nubank), o limite do crédito e/ou o saldo atual da conta de débito, e escolha uma cor.",
      "Pix e Dinheiro já vêm prontos e não precisam de cadastro.",
      "Pronto: agora é só lançar. Em Cartões e Faturas você acompanha a fatura e o limite de cada mês.",
    ],
    dicas: ["Ao lançar uma saída, escolha o cartão e, logo abaixo, Crédito ou Débito.", "Os cartões com a maior fatura aparecem primeiro."],
  },
  {
    id: "lancar", aba: "inicio", prioridade: "essencial", titulo: "Como lançar entradas e saídas",
    resumo: "Tudo é lançado em um só lugar: o botão Nova transação (+).",
    passos: [
      "Toque em Nova transação (o botão + no celular ou o botão colorido da barra lateral).",
      "Escolha Entrada (dinheiro que você recebeu) ou Saída (dinheiro que você gastou).",
      "Digite o valor e uma descrição curta, como “Mercado” ou “Salário de outubro”.",
      "Em saídas, escolha como foi: À vista, Parcelado no cartão ou Conta fixa.",
      "Escolha o cartão ou a forma de pagamento (em cartões com crédito e débito, escolha qual usar), confira a categoria e toque em Salvar.",
    ],
    dicas: ["Para dividir uma despesa entre pessoas do grupo, abra “Mais opções” e marque quem paga.", "Em “Quem pode ver” você escolhe se o lançamento é do grupo, só seu ou compartilhado com uma pessoa."],
  },
  {
    id: "parceladas", prioridade: "essencial", aba: "cartao", titulo: "Compras parceladas",
    resumo: "Registre uma compra uma vez e as próximas parcelas são criadas nos meses seguintes.",
    passos: [
      "Toque em Nova transação, escolha Saída e depois Parcelado.",
      "Informe o valor de CADA parcela, o cartão, a parcela atual e o total de parcelas.",
      "Salve. As parcelas seguintes aparecem automaticamente nos próximos meses.",
      "Acompanhe em Contas parceladas, onde você também pode editar ou remover.",
    ],
  },
  {
    id: "fixas", prioridade: "essencial", aba: "contas", titulo: "Contas fixas (aluguel, internet, assinaturas)",
    resumo: "Contas que se repetem todo mês e que você marca como pagas.",
    passos: [
      "Toque em Nova transação, escolha Saída e depois Fixa.",
      "Informe o nome, o valor e, se quiser, o dia do vencimento.",
      "Todo mês a conta aparece em Contas fixas. Marque como paga quando pagar.",
      "O valor de “Falta pagar” mostra as contas ainda não marcadas como pagas.",
    ],
  },
  {
    id: "inicio", prioridade: "essencial", aba: "inicio", titulo: "Entendendo a tela Início",
    resumo: "O resumo do mês: quanto entrou, quanto saiu e quanto sobrou.",
    passos: [
      "No topo, veja Entradas (verde), Saídas (vermelho) e Saldo restante.",
      "Use as setas ao lado do mês para ver outros meses.",
      "Toque em um dos três cartões para ver os lançamentos que formam aquele valor.",
      "Mais abaixo estão seus cartões de crédito, os gráficos e as últimas movimentações.",
    ],
    dicas: ["O botão do olho oculta todos os valores do sistema, útil quando outras pessoas estão por perto."],
  },
  {
    id: "extrato", prioridade: "essencial", aba: "extrato", titulo: "Usando o Extrato",
    resumo: "Todas as movimentações do mês em uma lista só, com busca e filtros.",
    passos: [
      "Abra Extrato e escolha o mês no topo.",
      "Use a busca e os filtros (responsáveis, categoria, forma de pagamento, tipo e status).",
      "Para editar ou apagar, use o lápis ou a lixeira na linha do lançamento.",
      "Selecione mais de um responsável para comparar pessoas.",
    ],
  },
  {
    id: "grupo", prioridade: "complementar", aba: "grupo", titulo: "Grupo familiar, repasses e resumo por pessoa",
    resumo: "Veja quem lançou cada gasto, o que cada pessoa deve repassar e o resumo de cada membro.",
    passos: [
      "Abra Grupo familiar. Sem grupo ainda? Toque em Gerenciar grupo para criar um ou entrar com o ID.",
      "Ao lançar uma despesa, abra Mais opções e escolha a pessoa responsável: o valor vai para Repasses dela.",
      "Na aba Repasses, quem deve marca “Repassei”: o valor fica aguardando confirmação.",
      "Quem recebeu o dinheiro marca “Concluir”. O repasse só é concluído depois dessa confirmação, e nada disso altera entradas ou saídas.",
      "Na aba Lançamentos, filtre por tipo, responsável, autor e situação.",
      "Na aba Resumo, veja entradas, despesas e saldo de cada pessoa. Você pode ocultar o seu resumo.",
    ],
    dicas: ["Lançamentos feitos por outras pessoas aparecem com o selo “Lançado por …” em Extrato, Parceladas e Contas fixas.", "Use os filtros “Lançados por mim” e “Lançados pelo grupo” nesses módulos."],
  },
  {
    id: "investimentos", prioridade: "complementar", aba: "investimentos", titulo: "Investimentos e caixinhas",
    resumo: "Guarde dinheiro para objetivos e acompanhe aportes, resgates e rendimentos.",
    passos: [
      "Abra Investimentos e crie uma caixinha (por exemplo, “Reserva de emergência”).",
      "Registre aportes quando guardar dinheiro e resgates quando retirar.",
      "Registre rendimentos para acompanhar o quanto a caixinha cresceu.",
    ],
    dicas: ["Aportes e resgates não entram em Entradas nem em Saídas do mês."],
  },
  {
    id: "graficos", prioridade: "complementar", aba: "graficos", titulo: "Gráficos e relatórios",
    resumo: "Descubra para onde o dinheiro vai e exporte relatórios por período.",
    passos: [
      "Abra Gráficos e relatórios. Na aba Gráficos veja a evolução e a divisão dos gastos.",
      "Na aba Relatórios escolha o período e, se quiser, responsáveis e categoria.",
      "Confira totais, mês a mês e as movimentações detalhadas.",
      "Toque em Exportar Excel (CSV) ou Exportar PDF.",
    ],
    dicas: ["No PDF, na janela de impressão escolha “Salvar como PDF”."],
  },
  {
    id: "config", prioridade: "complementar", aba: "ajustes", titulo: "Configurações e aparência",
    resumo: "Foto, nome, tema claro/escuro e cores do sistema.",
    passos: [
      "Abra Configurações (toque na sua foto no menu).",
      "Troque sua foto e seu nome em Perfil.",
      "Em Aparência, escolha o tema, a cor de destaque e o fundo.",
      "Em Cadastros, gerencie categorias e formas de pagamento.",
    ],
  },
];


export const PERGUNTAS: Pergunta[] = [
  { id: "saldo", pergunta: "Como o saldo restante é calculado?", resposta: "Saldo restante = entradas do mês menos saídas do mês. As saídas somam lançamentos à vista, parcelas do mês e contas fixas do mês.", aba: "inicio" },
  { id: "entrada-salario", pergunta: "Meu salário não aparece como entrada. O que faço?", resposta: "Lance seu salário manualmente todos os meses em Nova transação > Entrada, usando a categoria “Salário”. O sistema considera apenas o valor realmente lançado naquele mês; se não lançar, a entrada será R$ 0." },
  { id: "parcelada-fixa", pergunta: "Qual a diferença entre conta parcelada e conta fixa?", resposta: "Parcelada tem fim: uma compra dividida em X vezes no cartão. Fixa se repete todo mês sem data para acabar, como aluguel e internet." },
  { id: "falta-pagar", pergunta: "O que significa “Falta pagar”?", resposta: "É o total das contas fixas do mês que ainda não foram marcadas como pagas. É só um aviso: essas contas já contam nas saídas do mês.", aba: "contas" },
  { id: "dividir", pergunta: "Como divido uma despesa com outra pessoa?", resposta: "Em Nova transação, abra “Mais opções” e marque quem paga. O valor é dividido igualmente entre as pessoas marcadas." },
  { id: "editar", pergunta: "Como edito ou apago um lançamento?", resposta: "Abra o Extrato e use o lápis (editar) ou a lixeira (remover) na linha do lançamento.", aba: "extrato" },
  { id: "cartao-sem", pergunta: "Não consigo escolher um cartão ao parcelar. E agora?", resposta: "Você precisa cadastrar o cartão antes. Em Cartões e Faturas toque em “Cadastrar primeiro cartão” ou use o atalho que aparece na própria tela de Nova transação.", aba: "fatura" },
  { id: "ocultar", pergunta: "Como escondo os valores da tela?", resposta: "Toque no ícone de olho, no topo da tela. Todos os valores e porcentagens viram pontinhos. A escolha fica salva neste aparelho." },
  { id: "exportar", pergunta: "Como exporto um relatório?", resposta: "Vá em Gráficos e relatórios, aba Relatórios, escolha o período e toque em Exportar Excel (CSV) ou Exportar PDF.", aba: "graficos" },
  { id: "aporte", pergunta: "Um aporte em investimento conta como gasto?", resposta: "Não. Aportes, resgates e rendimentos ficam nas caixinhas e não entram em Entradas nem em Saídas.", aba: "investimentos" },
  { id: "repasse", pergunta: "O que é “Valores a repassar”?", resposta: "É o acerto entre membros. Se você lança uma compra e define outra pessoa como responsável, ela deve repassar esse valor a você. O acerto tem duas etapas: quem deve marca “Repassei” e quem recebeu confirma em “Concluir”. Só então fica concluído. Isso não cria entrada nem saída, então nada é contado duas vezes.", aba: "grupo" },
  { id: "resumo-oculto", pergunta: "Como oculto meu resumo financeiro do grupo?", resposta: "Em Grupo familiar > Resumo, no seu cartão, desligue “Mostrar meu resumo ao grupo”. Os outros deixam de ver suas entradas, despesas e saldo nessa tela.", aba: "grupo" },
  { id: "privado", pergunta: "Posso lançar algo que só eu veja?", resposta: "Sim. Em Nova transação, abra “Mais opções” e, em “Quem pode ver”, escolha “Só eu”." },
  { id: "instalar", pergunta: "Posso instalar o HomeCash no celular?", resposta: "Sim. Toque em Ajuda no topo da tela e abra a aba “Instalar no celular” para ver o passo a passo do seu aparelho." },
];

export const CONCEITOS: { titulo: string; texto: string; tom?: "entrada" | "saida" }[] = [
  { titulo: "Entradas", texto: "Dinheiro que você recebeu: salário, extras, reembolsos.", tom: "entrada" },
  { titulo: "Saídas", texto: "Dinheiro que você gastou: compras à vista, parcelas do mês e contas fixas.", tom: "saida" },
  { titulo: "Saldo restante", texto: "O que sobra no mês: entradas menos saídas." },
  { titulo: "Falta pagar", texto: "Contas fixas do mês que ainda não foram marcadas como pagas." },
  { titulo: "Conta parcelada", texto: "Compra dividida em parcelas no cartão. Cada parcela cai em um mês." },
  { titulo: "Conta fixa", texto: "Conta que se repete todo mês, como aluguel e internet." },
  { titulo: "Caixinha", texto: "Dinheiro guardado para um objetivo. Não entra em entradas nem saídas." },
];
