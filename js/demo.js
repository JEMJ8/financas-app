// Dados INVENTADOS para a demonstracao (so em 127.0.0.1 ou localhost com ?demo=1, ver js/ensaio.js). Nada aqui e de ninguem:
// pessoas Ana, Bruno e a crianca Clara; tres contas de bancos ficticios; uns 400 lancamentos de junho a novembro de 2026; algumas
// decisoes pendentes. O sorteio usa semente fixa: toda abertura gera exatamente os mesmos numeros.
// Um lancamento traz < > & e aspas de proposito, para conferir que a tela mostra o texto como texto.

const MESES = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
const ULTIMO_DIA = { '2026-06': 30, '2026-07': 31, '2026-08': 31, '2026-09': 30, '2026-10': 31, '2026-11': 23 };

function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PESSOAS = [
  { id: 'p-ana', nome: 'Ana', crianca: false, tem_renda: true, cor: '#1F5FAD', ordem: 1 },
  { id: 'p-bruno', nome: 'Bruno', crianca: false, tem_renda: true, cor: '#0F7A55', ordem: 2 },
  { id: 'p-clara', nome: 'Clara', crianca: true, tem_renda: false, cor: '#8A5A00', ordem: 3 },
];

const CONTAS = [
  { id: 'casa', apelido: 'Conta da casa', instituicao: 'Banco Exemplo', tipo: 'corrente', final: '1234', titular: 'Ana', conta_pai: null },
  { id: 'bruno', apelido: 'Conta do Bruno', instituicao: 'Banco Modelo', tipo: 'corrente', final: '5678', titular: 'Bruno', conta_pai: null },
  { id: 'cartao', apelido: 'Cartão da família', instituicao: 'Banco Exemplo', tipo: 'cartao', final: '9012', titular: 'Ana', conta_pai: null },
];

// [categoria, subcategoria, empresa, natureza, valor base em centavos, variacao, peso no sorteio, destinatario]
const VARIAVEIS = [
  ['Alimentacao', 'Supermercado', 'MERCADO EXEMPLO', 'essencial', 32000, 0.8, 9],
  ['Alimentacao', 'Supermercado', 'PADARIA MODELO', 'essencial', 3500, 0.7, 7],
  ['Alimentacao', 'Restaurante', 'RESTAURANTE FICTICIO', 'desejo', 9500, 0.8, 5],
  ['Alimentacao', 'Delivery', 'APP DE ENTREGA EXEMPLO', 'desejo', 6800, 0.6, 5],
  ['Transporte', 'Combustivel', 'POSTO EXEMPLO', 'essencial', 22000, 0.4, 4],
  ['Transporte', 'Aplicativo de corrida', 'APP DE CORRIDA MODELO', 'essencial', 2900, 0.7, 5],
  ['Transporte', 'Estacionamento e pedagio', 'ESTACIONAMENTO MODELO', 'essencial', 1800, 0.5, 2],
  ['Saude', 'Farmacia', 'FARMACIA MODELO', 'essencial', 7800, 0.9, 4],
  ['Saude', 'Consultas e exames', 'CLINICA EXEMPLO', 'essencial', 28000, 0.5, 1],
  ['Lazer e Pessoal', 'Cinema e passeios', 'CINEMA FICTICIO', 'desejo', 7400, 0.5, 2],
  ['Lazer e Pessoal', 'Beleza e cuidados', 'SALAO MODELO', 'desejo', 9000, 0.6, 2],
  ['Compras', 'Varejo online', 'LOJA ONLINE EXEMPLO', 'desejo', 12000, 0.9, 3],
  ['Compras', 'Vestuario', 'LOJA DE ROUPAS FICTICIA', 'desejo', 18000, 0.7, 2],
  ['Compras', 'Papelaria', 'PAPELARIA MODELO', 'desejo', 4200, 0.6, 1],
  ['Filhos', 'Brinquedos', 'LOJA DE BRINQUEDOS FICTICIA', 'essencial', 9000, 0.7, 2, 'Clara'],
  ['Filhos', 'Roupas e itens infantis', 'ROUPAS INFANTIS EXEMPLO', 'essencial', 11000, 0.6, 2, 'Clara'],
  ['Filhos', 'Saude', 'PEDIATRA EXEMPLO', 'essencial', 25000, 0.3, 1, 'Clara'],
  ['Diversos', null, null, null, 4500, 0.8, 2],
];

// gastos fixos do mes: [dia, categoria, subcategoria, empresa, descricao, valor, conta, meio, natureza, destinatario]
const FIXOS = [
  [5, 'Moradia', 'Aluguel', 'LOCADORA EXEMPLO', 'ALUGUEL APTO', 280000, 'casa', 'boleto', 'essencial'],
  [8, 'Moradia', 'Energia', 'ENERGIA FICTICIA', 'CONTA DE ENERGIA', 31000, 'casa', 'debito_automatico', 'essencial'],
  [9, 'Moradia', 'Agua', 'AGUA MODELO', 'CONTA DE AGUA', 11500, 'casa', 'debito_automatico', 'essencial'],
  [12, 'Moradia', 'Telefone e internet', 'INTERNET MODELO', 'INTERNET E TELEFONE', 12990, 'casa', 'debito_automatico', 'essencial'],
  [6, 'Filhos', 'Escola', 'ESCOLA EXEMPLO', 'MENSALIDADE ESCOLAR', 180000, 'casa', 'boleto', 'essencial', 'Clara'],
  [7, 'Filhos', 'Ballet e danca', 'BALLET MODELO', 'AULA DE BALLET', 25000, 'cartao', 'cartao', 'essencial', 'Clara'],
  [15, 'Saude', 'Plano de saude', 'PLANO DE SAUDE EXEMPLO', 'PLANO DE SAUDE FAMILIA', 92000, 'casa', 'debito_automatico', 'essencial'],
  [18, 'Lazer e Pessoal', 'Academia', 'ACADEMIA MODELO', 'ACADEMIA MENSAL', 11900, 'cartao', 'cartao', 'desejo'],
  [20, 'Lazer e Pessoal', 'Assinatura de streaming', 'STREAMING EXEMPLO', 'ASSINATURA STREAMING', 5590, 'cartao', 'cartao', 'desejo'],
  [21, 'Assinaturas e Servicos', 'Servico digital', 'NUVEM DE FOTOS EXEMPLO', 'ARMAZENAMENTO DE FOTOS', 1990, 'cartao', 'cartao', 'desejo'],
  [10, 'Impostos e Seguros', 'Seguro', 'SEGURO DO CARRO EXEMPLO', 'SEGURO DO CARRO', 24500, 'casa', 'debito_automatico', 'essencial'],
  [25, 'Financeiro', 'Previdencia', 'PREVIDENCIA EXEMPLO', 'PREVIDENCIA PRIVADA', 50000, 'casa', 'debito_automatico', 'poupanca_investimento'],
];

const dois = (n) => String(n).padStart(2, '0');

export function criarDemonstracao({ velho = false } = {}) {
  const sorte = sorteio(20261124);
  const lancamentos = [];
  let contador = 0;
  const novoId = () => {
    contador += 1;
    let t = '';
    for (let i = 0; i < 24; i += 1) t += Math.floor(sorte() * 16).toString(16);
    return `${t.slice(0, 20)}${dois(contador % 100)}${dois(Math.floor(contador / 100))}`;
  };
  const entre = (a, b) => a + Math.floor(sorte() * (b - a + 1));
  const valorPerto = (base, variacao) => Math.max(500, Math.round((base * (1 - variacao / 2 + sorte() * variacao)) / 10) * 10);

  function lancar(campos) {
    const l = {
      id: novoId(), ano_mes: campos.data.slice(0, 7), data_compra: campos.data, sinal: 'saida', fluxo: 'saida',
      empresa: null, categoria: null, subcategoria: null, natureza: null, previsibilidade: 'variavel', pessoa: null, destinatario: null,
      meio: null, parcela_atual: null, parcela_total: null, renda: false, consumo: false, tipo_entrada: null, tipo_saida: null, pendente: false,
      ...campos,
    };
    lancamentos.push(l);
    return l;
  }

  const pesoTotal = VARIAVEIS.reduce((s, v) => s + v[6], 0);
  const sortearVariavel = () => {
    let x = sorte() * pesoTotal;
    for (const v of VARIAVEIS) { x -= v[6]; if (x <= 0) return v; }
    return VARIAVEIS[0];
  };

  const cartaoPorMes = {};
  MESES.forEach((mes, i) => {
    const ultimo = ULTIMO_DIA[mes];
    const dia = (d) => `${mes}-${dois(Math.min(d, ultimo))}`;
    // renda
    lancar({ data: dia(5), valor: 820000 + (i === 4 ? 45000 : 0), sinal: 'entrada', fluxo: 'entrada', descricao: 'SALARIO EMPRESA EXEMPLO', empresa: 'EMPRESA EXEMPLO', pessoa: 'Ana', conta_id: 'casa', meio: 'conta', renda: true, tipo_entrada: 'salario', previsibilidade: 'fixo' });
    lancar({ data: dia(10), valor: 150000 + Math.round(sorte() * 25) * 10000, sinal: 'entrada', fluxo: 'entrada', descricao: 'HONORARIOS CLIENTE MODELO', empresa: 'CLIENTE MODELO LTDA', pessoa: 'Bruno', conta_id: 'bruno', meio: 'pix', renda: true, tipo_entrada: 'honorario_pj' });
    if (i % 2 === 1) lancar({ data: dia(entre(14, 22)), valor: 90000 + Math.round(sorte() * 8) * 10000, sinal: 'entrada', fluxo: 'entrada', descricao: 'HONORARIOS PESSOA FISICA', pessoa: 'Bruno', conta_id: 'bruno', meio: 'pix', renda: true, tipo_entrada: 'honorario_pf' });
    if (i === 2) lancar({ data: dia(17), valor: 12990, sinal: 'entrada', fluxo: 'entrada', descricao: 'ESTORNO COMPRA LOJA ONLINE', empresa: 'LOJA ONLINE EXEMPLO', pessoa: 'Ana', conta_id: 'cartao', meio: 'cartao', tipo_entrada: 'estorno' });
    if (i === 3) {
      lancar({ data: dia(19), valor: 150000, sinal: 'entrada', fluxo: 'entrada', descricao: 'TRANSFERENCIA RECEBIDA', pessoa: 'Bruno', conta_id: 'bruno', meio: 'pix', pendente: true });
    }
    // entre contas
    lancar({ data: dia(12), valor: 300000, sinal: 'saida', fluxo: 'movimentacao', descricao: 'TRANSFERENCIA PARA CONTA DA CASA', pessoa: 'Bruno', conta_id: 'bruno', meio: 'pix', tipo_saida: 'transferencia_financeira' });
    // gastos fixos
    for (const [d, categoria, subcategoria, empresa, descricao, valor, conta, meio, natureza, destinatario] of FIXOS) {
      lancar({
        data: dia(d), valor: categoria === 'Moradia' && subcategoria === 'Energia' ? valorPerto(valor, 0.3) : valor, descricao, empresa, categoria, subcategoria,
        natureza, previsibilidade: 'fixo', pessoa: conta === 'bruno' ? 'Bruno' : 'Ana', destinatario: destinatario || null, conta_id: conta, meio,
        consumo: true, tipo_saida: 'consumo',
      });
    }
    // parcelas
    lancar({ data: dia(14), data_compra: '2026-04-14', valor: 45000, descricao: 'MAGAZINE MODELO GELADEIRA', empresa: 'MAGAZINE MODELO', categoria: 'Compras', subcategoria: 'Casa e eletrodomesticos', natureza: 'desejo', pessoa: 'Ana', conta_id: 'cartao', meio: 'cartao', parcela_atual: i + 3, parcela_total: 10, consumo: true, tipo_saida: 'consumo' });
    if (i >= 3) lancar({ data: dia(16), data_compra: '2026-09-02', valor: 23330, descricao: 'LOJA ONLINE EXEMPLO NOTEBOOK', empresa: 'LOJA ONLINE EXEMPLO', categoria: 'Compras', subcategoria: 'Eletronicos', natureza: 'desejo', pessoa: 'Bruno', conta_id: 'cartao', meio: 'cartao', parcela_atual: i - 2, parcela_total: 6, consumo: true, tipo_saida: 'consumo' });
    // gastos que variam
    const quantos = 44 + entre(0, 6);
    for (let k = 0; k < quantos; k += 1) {
      const [categoria, subcategoria, empresa, natureza, base, variacao, , destinatario] = sortearVariavel();
      const noCartao = sorte() < 0.62;
      const pessoa = noCartao ? (sorte() < 0.7 ? 'Ana' : 'Bruno') : (sorte() < 0.5 ? 'Ana' : 'Bruno');
      const conta = noCartao ? 'cartao' : (pessoa === 'Bruno' ? 'bruno' : 'casa');
      const d = entre(1, ultimo);
      const diversos = categoria === 'Diversos';
      const descricao = diversos ? (k % 2 ? 'PIX RECEBEDOR NAO IDENTIFICADO' : 'COMPRA ESTABELECIMENTO NAO IDENTIFICADO') : `${empresa}${sorte() < 0.25 ? ' FILIAL 2' : ''}`;
      const l = lancar({
        data: dia(d), valor: valorPerto(base, variacao), descricao, empresa, categoria, subcategoria, natureza, pessoa, destinatario: destinatario || null,
        conta_id: diversos ? (pessoa === 'Bruno' ? 'bruno' : 'casa') : conta, meio: diversos ? 'pix' : (noCartao ? 'cartao' : 'pix'), consumo: true, tipo_saida: 'consumo',
        pendente: diversos,
      });
      if (l.conta_id === 'cartao') l.meio = 'cartao';
    }
    if (i === 5) {
      lancar({ data: dia(3), valor: 3890, descricao: 'COMPRA <b>LOJA TESTE</b> & "CIA" <script>', empresa: 'LOJA <TESTE> & "CIA"', categoria: 'Diversos', pessoa: 'Ana', conta_id: 'casa', meio: 'pix', consumo: true, tipo_saida: 'consumo', pendente: true });
    }
    cartaoPorMes[mes] = lancamentos.filter((l) => l.ano_mes === mes && l.conta_id === 'cartao' && l.sinal === 'saida').reduce((s, l) => s + l.valor, 0)
      - lancamentos.filter((l) => l.ano_mes === mes && l.conta_id === 'cartao' && l.sinal === 'entrada').reduce((s, l) => s + l.valor, 0);
  });

  // pagamento da fatura do mes anterior (sai da conta da casa no dia 10; e movimentacao, nao consumo)
  const faturas = [];
  MESES.forEach((mes, i) => {
    const anterior = i === 0 ? '2026-05' : MESES[i - 1];
    const valorDaFatura = i === 0 ? 512340 : cartaoPorMes[anterior];
    const pago = i === 2 ? valorDaFatura - 2000 : valorDaFatura;
    lancar({ data: `${mes}-10`, valor: pago, descricao: 'PAGAMENTO FATURA CARTAO', empresa: 'BANCO EXEMPLO', pessoa: 'Ana', conta_id: 'casa', meio: 'conta', sinal: 'saida', fluxo: 'movimentacao', tipo_saida: 'liquidacao_cartao' });
    faturas.push({
      id: `fat-${anterior}`, conta_id: 'cartao', competencia: anterior, vencimento: `${mes}-10`, valor_fatura: valorDaFatura, valor_pago: i === 4 ? null : pago,
      diferenca: pago - valorDaFatura, status: i === 2 ? 'divergente' : i === 4 ? 'sem_extrato' : 'conciliada',
    });
  });
  faturas.push({ id: 'fat-2026-11', conta_id: 'cartao', competencia: '2026-11', vencimento: '2026-12-10', valor_fatura: cartaoPorMes['2026-11'], valor_pago: null, diferenca: null, status: 'aberta' });

  // conferencia do saldo das duas contas correntes, mes a mes
  const conferencias = [];
  const saldoInicial = { casa: 1850000, bruno: 640000 };
  for (const contaId of ['casa', 'bruno']) {
    let saldo = saldoInicial[contaId];
    MESES.forEach((mes, i) => {
      const doMes = lancamentos.filter((l) => l.conta_id === contaId && l.ano_mes === mes);
      const entradas = doMes.filter((l) => l.sinal === 'entrada').reduce((s, l) => s + l.valor, 0)
        + (contaId === 'casa' ? lancamentos.filter((l) => l.ano_mes === mes && l.descricao === 'TRANSFERENCIA PARA CONTA DA CASA').reduce((s, l) => s + l.valor, 0) : 0);
      const saidas = doMes.filter((l) => l.sinal === 'saida').reduce((s, l) => s + l.valor, 0);
      const calculado = saldo + entradas - saidas;
      let status = 'fecha';
      let documento = calculado;
      if (contaId === 'bruno' && i === 0) { status = 'sem_documento'; documento = null; }
      if (contaId === 'bruno' && i === 3) { status = 'diverge'; documento = calculado + 1250; }
      if (contaId === 'casa' && i === 5) { status = 'parcial'; }
      conferencias.push({
        id: `conf-${contaId}-${mes}`, conta_id: contaId, ano_mes: mes, saldo_inicial: saldo, entradas, saidas, saldo_calculado: calculado,
        saldo_documento: documento, diferenca: documento === null ? null : documento - calculado, status,
      });
      saldo = documento === null ? calculado : documento;
    });
  }

  const semCategoria = lancamentos.filter((l) => l.pendente && l.categoria === 'Diversos');
  const pendencias = [
    { id: 'pend-1', tipo: 'fatura_divergente', gravidade: 'critica', titulo: 'Fatura de julho paga com R$ 20,00 a menos', valor: 2000, pergunta: 'A diferença foi paga depois, em outra data?' },
    { id: 'pend-2', tipo: 'entrada_sem_origem', gravidade: 'alta', titulo: 'Entrada sem origem na Conta do Bruno', valor: 150000, pergunta: 'Este dinheiro é renda ou só passou pela conta?' },
    { id: 'pend-3', tipo: 'perna_ausente', gravidade: 'alta', titulo: 'Transferência com um lado só', valor: 300000, pergunta: 'Falta o extrato da outra conta. Quer importar?' },
    { id: 'pend-4', tipo: 'sem_categoria', gravidade: 'media', titulo: `${semCategoria.length} gastos sem categoria`, valor: semCategoria.reduce((s, l) => s + l.valor, 0), pergunta: 'Em que categoria entra cada um deles?' },
    { id: 'pend-5', tipo: 'dinheiro_de_passagem', gravidade: 'media', titulo: 'Dinheiro que entrou e saiu no mesmo dia', valor: 56000, pergunta: 'Foi repasse de outra pessoa?' },
    { id: 'pend-6', tipo: 'fatura_sem_pagamento', gravidade: 'baixa', titulo: 'Fatura de setembro sem o extrato do pagamento', valor: null, pergunta: null },
  ];

  const agora = Date.now();
  const atualizado = new Date(agora - (velho ? 3 * 24 * 60 : 3 * 60) * 60000).toISOString();
  return {
    pessoa: PESSOAS,
    conta: CONTAS,
    lancamento: lancamentos,
    conferencia: conferencias,
    fatura: faturas,
    pendencia: pendencias,
    estado_espelho: {
      id: 1, atualizado_em: atualizado, pc_versao: '2.4.0', periodo_de: MESES[0], periodo_ate: MESES[MESES.length - 1],
      contagens: { pessoa: PESSOAS.length, conta: CONTAS.length, lancamento: lancamentos.length, conferencia: conferencias.length, fatura: faturas.length, pendencia: pendencias.length },
    },
    baixado_em: agora - 5 * 60000,
  };
}
