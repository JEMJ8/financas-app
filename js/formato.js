// Formatos e palavras: dinheiro, porcentagem, e a traducao dos codigos do computador para palavras simples.
// Tudo aqui devolve TEXTO (nunca HTML). Codigo desconhecido volta como veio (a tela o mostra como texto puro).

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DECIMAL_1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Centavos (inteiro) em "R$ 1.234,56". */
export function moeda(centavos) {
  const n = Number(centavos);
  return REAIS.format(Number.isFinite(n) ? n / 100 : 0);
}

/** Para os quadros do Inicio: valor exato ate R$ 99.999,99; acima disso "R$ 123,4 mil" (o exato aparece no detalhe). */
export function moedaNoQuadro(centavos) {
  const n = Number(centavos) || 0;
  if (Math.abs(n) < 10000000) return moeda(n);
  return `${n < 0 ? '-' : ''}R$ ${DECIMAL_1.format(Math.abs(n) / 100000)} mil`;
}

/** Valor com sinal para a lista: "+R$ 10,00" (entrada), "−R$ 10,00" (saida) ou sem sinal (entre contas). */
export function moedaComSinal(l) {
  if (l.fluxo === 'movimentacao') return moeda(l.valor);
  if (l.sinal === 'entrada') return `+${moeda(l.valor)}`;
  if (l.sinal === 'saida') return `−${moeda(l.valor)}`;
  return moeda(l.valor);
}

/** Parte de um todo em porcentagem inteira ("12%"); "0%" quando o todo e zero. */
export function porcento(parte, todo) {
  if (!todo) return '0%';
  const p = (parte / todo) * 100;
  if (p > 0 && p < 1) return 'menos de 1%';
  return `${Math.round(p)}%`;
}

export function plural(n, um, muitos) {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : muitos}`;
}

// ---------------------------------------------------------------- nomes de categoria e subcategoria
// O computador grava sem acento (Alimentacao, Saude...). Aqui so muda a forma de MOSTRAR; filtros e somas usam o nome original.

export const SEM_CATEGORIA = 'Diversos';
const CATEGORIAS = {
  Alimentacao: 'Alimentação',
  Saude: 'Saúde',
  Educacao: 'Educação',
  'Assinaturas e Servicos': 'Assinaturas e Serviços',
  'Impostos e Seguros': 'Impostos e Seguros',
  'Lazer e Pessoal': 'Lazer e Pessoal',
  Filhos: 'Filhos',
  Trabalho: 'Trabalho',
  Moradia: 'Moradia',
  Transporte: 'Transporte',
  Compras: 'Compras',
  Financeiro: 'Financeiro',
  Diversos: 'Sem categoria',
};

// Palavras que o computador grava sem acento nas subcategorias. So a palavra inteira muda.
const PALAVRAS = {
  alimentacao: 'alimentação', saude: 'saúde', educacao: 'educação', servico: 'serviço', servicos: 'serviços',
  eletrodomesticos: 'eletrodomésticos', eletronicos: 'eletrônicos', fisica: 'física', vestuario: 'vestuário',
  danca: 'dança', titulo: 'título', capitalizacao: 'capitalização', agua: 'água', gas: 'gás', farmacia: 'farmácia',
  escritorio: 'escritório', combustivel: 'combustível', pedagio: 'pedágio', manutencao: 'manutenção',
  credito: 'crédito', debito: 'débito', cartao: 'cartão', condominio: 'condomínio', medico: 'médico',
  medicos: 'médicos', onibus: 'ônibus', veiculo: 'veículo', imovel: 'imóvel', previdencia: 'previdência',
  musica: 'música', pao: 'pão', acougue: 'açougue', presentes: 'presentes', higiene: 'higiene',
};

function comAcentos(texto) {
  return String(texto).replace(/[A-Za-z]+/g, (palavra) => {
    const certo = PALAVRAS[palavra.toLowerCase()];
    if (!certo) return palavra;
    if (palavra === palavra.toUpperCase() && palavra.length > 1) return certo.toUpperCase();
    return palavra[0] === palavra[0].toUpperCase() ? certo[0].toUpperCase() + certo.slice(1) : certo;
  });
}

/** Nome da categoria para mostrar. Vazio ou Diversos = "Sem categoria". */
export function nomeDaCategoria(categoria) {
  if (categoria === null || categoria === undefined || String(categoria).trim() === '') return 'Sem categoria';
  const nome = String(categoria);
  return CATEGORIAS[nome] || comAcentos(nome);
}

/** A chave usada para agrupar por categoria: vazio vira Diversos (os dois aparecem como "Sem categoria"). */
export function chaveDaCategoria(categoria) {
  return categoria === null || categoria === undefined || String(categoria).trim() === '' ? SEM_CATEGORIA : String(categoria);
}

export function nomeDaSubcategoria(sub) {
  if (sub === null || sub === undefined || String(sub).trim() === '') return '';
  return comAcentos(sub);
}

export const SEM_EMPRESA = '\u0000sem-empresa';
export function nomeDaEmpresa(empresa) {
  if (empresa === null || empresa === undefined || String(empresa).trim() === '' || empresa === SEM_EMPRESA) return 'Estabelecimento não identificado';
  return String(empresa);
}

// ---------------------------------------------------------------- codigos em palavras

const FLUXO = { entrada: 'Entrada', saida: 'Saída', movimentacao: 'Entre contas' };
const NATUREZA = { essencial: 'Essencial', desejo: 'Desejo', poupanca_investimento: 'Poupança ou investimento' };
const PREVISIBILIDADE = { fixo: 'Gasto fixo', variavel: 'Gasto que varia' };
const MEIO = {
  conta: 'Débito em conta', cartao: 'Cartão de crédito', pix: 'Pix', dinheiro: 'Dinheiro', debito_automatico: 'Débito automático', boleto: 'Boleto',
};
const TIPO_ENTRADA = {
  salario: 'Salário', honorario_pf: 'Honorários de pessoa física', honorario_pj: 'Honorários de empresa', outra_renda: 'Outra renda',
  rateio_reembolso: 'Reembolso de despesa dividida', transferencia_propria: 'Transferência entre suas contas', emprestimo: 'Empréstimo recebido',
  estorno: 'Estorno', devolucao: 'Devolução', deposito_cliente: 'Dinheiro de cliente',
};
const TIPO_SAIDA = {
  consumo: 'Gasto', liquidacao_cartao: 'Pagamento da fatura do cartão', transferencia_financeira: 'Transferência',
  investimento: 'Investimento', emprestimo_concedido: 'Empréstimo feito a alguém', imposto: 'Imposto',
};
const TIPO_DE_CONTA = { corrente: 'Conta corrente', salario: 'Conta salário', poupanca: 'Poupança', cartao: 'Cartão de crédito', investimento: 'Investimento' };

const palavra = (mapa, valor) => (valor === null || valor === undefined || valor === '' ? '' : mapa[valor] || String(valor));

export const nomeDoFluxo = (v) => palavra(FLUXO, v);
export const nomeDaNatureza = (v) => (v === null || v === undefined || v === '' ? 'Sem natureza ainda' : palavra(NATUREZA, v));
export const nomeDaPrevisibilidade = (v) => palavra(PREVISIBILIDADE, v);
export const nomeDoMeio = (v) => palavra(MEIO, v);
export const nomeDoTipoDeEntrada = (v) => palavra(TIPO_ENTRADA, v);
export const nomeDoTipoDeSaida = (v) => palavra(TIPO_SAIDA, v);
export const nomeDoTipoDeConta = (v) => palavra(TIPO_DE_CONTA, v);

/** Situacao da conferencia do saldo de uma conta num mes: { texto, tom } (tom: ok | alerta | erro | neutro). */
export function situacaoDaConferencia(status) {
  switch (status) {
    case 'fecha': return { texto: 'Saldo confere com o extrato', tom: 'ok' };
    case 'diverge': return { texto: 'Não bate com o extrato', tom: 'erro' };
    case 'parcial': return { texto: 'Conferido só em parte', tom: 'alerta' };
    case 'sem_documento': return { texto: 'Sem extrato deste mês', tom: 'neutro' };
    default: return { texto: status ? String(status) : 'Sem conferência', tom: 'neutro' };
  }
}

/** Situacao de uma fatura de cartao: { texto, tom }. */
export function situacaoDaFatura(status) {
  switch (status) {
    case 'conciliada': return { texto: 'Paga e conferida', tom: 'ok' };
    case 'divergente': return { texto: 'Pagamento diferente da fatura', tom: 'erro' };
    case 'sem_extrato': return { texto: 'Falta o extrato do pagamento', tom: 'alerta' };
    case 'sem_ancora': return { texto: 'Total da fatura não foi lido', tom: 'alerta' };
    case 'aberta': return { texto: 'Ainda não paga', tom: 'neutro' };
    default: return { texto: status ? String(status) : 'Sem situação', tom: 'neutro' };
  }
}

const GRAVIDADE = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const ORDEM_DA_GRAVIDADE = ['critica', 'alta', 'media', 'baixa'];
export function nomeDaGravidade(v) {
  return palavra(GRAVIDADE, v) || 'Sem gravidade';
}
export function tomDaGravidade(v) {
  return v === 'critica' ? 'erro' : v === 'alta' ? 'alerta' : 'neutro';
}

/** Texto sem acento e em minusculas, para a busca ("Farmácia" acha "FARMACIA"). */
export function paraBusca(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "final 1234" so com os 4 ultimos digitos; vazio se nao houver. */
export function finalDaConta(final) {
  const digitos = String(final ?? '').replace(/\D/g, '');
  return digitos ? `final ${digitos.slice(-4)}` : '';
}

/** Cor da pessoa vinda do computador: so aceita #RRGGBB; qualquer outra coisa vira null. */
export function corSegura(cor) {
  return typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null;
}
