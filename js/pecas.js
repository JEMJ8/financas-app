// Pecas de tela usadas por mais de uma tela: cartao, selo, vazio, escolha do mes, lista de barras, linha de lancamento e o detalhe
// do lancamento (folha). Tudo montado com h(): o dado entra sempre como texto.

import { h, estilo } from './ui.js';
import { icone } from './icones.js';
import { abrirFolha } from './folha.js';
import * as dados from './dados.js';
import { mesPorExtenso, dataBR } from './datas.js';
import {
  moeda, moedaComSinal, porcento, nomeDaCategoria, nomeDaSubcategoria, nomeDaEmpresa, nomeDoFluxo, nomeDaNatureza, nomeDaPrevisibilidade,
  nomeDoMeio, nomeDoTipoDeEntrada, nomeDoTipoDeSaida, finalDaConta,
} from './formato.js';

export function cartao({ titulo = null, sub = null, tom = null, acao = null } = {}, ...filhos) {
  return h('section', { class: ['cartao', tom ? `cartao--${tom}` : null] },
    titulo ? h('div', { class: 'cartao-cabeca' }, h('h2', { class: 'cartao-titulo' }, titulo), acao) : null,
    sub ? h('p', { class: 'cartao-sub' }, sub) : null,
    ...filhos);
}

/** Selo com texto (a cor nunca e a unica pista). tom: ok | alerta | erro | info | neutro. */
export function selo(tom, texto) {
  return h('span', { class: ['selo', tom && tom !== 'neutro' ? `selo--${tom}` : null] }, texto);
}

export function vazio({ icone: nomeDoIcone = 'info', titulo, texto = null, acao = null }) {
  return h('div', { class: 'vazio' },
    h('span', { class: 'vazio-icone' }, icone(nomeDoIcone, { tamanho: 28 })),
    h('p', { class: 'vazio-titulo' }, titulo),
    texto ? h('p', { class: 'vazio-texto' }, texto) : null,
    acao);
}

/** Tela sem nenhuma copia ainda (primeiro acesso sem internet, ou o computador ainda nao mandou nada). */
export function semCopia() {
  const estado = dados.estado();
  if (estado.atualizando) return h('div', { class: 'carregando', role: 'status' }, icone('atualizar', { tamanho: 22 }), 'Baixando a cópia do computador…');
  if (estado.offline) return vazio({ icone: 'semRede', titulo: 'Sem internet e ainda sem cópia neste celular', texto: 'Conecte o celular à internet e toque no botão de baixar, no alto da tela.' });
  if (estado.erro) return vazio({ icone: 'alerta', titulo: 'Não foi possível baixar a cópia', texto: estado.erro });
  return vazio({ icone: 'computador', titulo: 'O computador ainda não mandou nada', texto: 'Quando o programa do computador mandar a primeira cópia, ela aparece aqui.' });
}

/**
 * Setas de mes anterior e seguinte, entre os meses que tem lancamento. `aoMudar(am)` recebe o mes escolhido.
 * `detalhe` (opcional): uma linha pequena embaixo do nome do mes (por exemplo o periodo dos Gastos).
 */
export function escolhaDeMes(mes, aoMudar, detalhe = null) {
  const meses = dados.meses();
  const i = meses.indexOf(mes);
  const anterior = h('button', { class: 'mes-botao', type: 'button', 'aria-label': 'Mês anterior', disabled: i <= 0 }, icone('anterior', { tamanho: 22 }));
  const seguinte = h('button', { class: 'mes-botao', type: 'button', 'aria-label': 'Mês seguinte', disabled: i < 0 || i >= meses.length - 1 }, icone('seguinte', { tamanho: 22 }));
  anterior.addEventListener('click', () => { if (i > 0) aoMudar(meses[i - 1]); });
  seguinte.addEventListener('click', () => { if (i >= 0 && i < meses.length - 1) aoMudar(meses[i + 1]); });
  return h('div', { class: 'mes-escolha' },
    anterior,
    h('div', { class: 'mes', 'aria-live': 'polite' }, mesPorExtenso(mes), detalhe ? h('small', null, detalhe) : null),
    seguinte);
}

/**
 * Lista de barras horizontais. `itens`: [{ nome, valor, n? }]. `total`: base da porcentagem. `aoTocar(item)`: torna cada linha um botao.
 * `frasePc`: o fim da frase da porcentagem ("do consumo do mês").
 */
export function listaDeBarras(itens, { total, aoTocar = null, frasePc = 'do consumo', classeTrilho = null, rotuloDoToque = null } = {}) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return h('div', { class: 'barras' }, itens.map((item) => {
    const preenchido = h('i');
    estilo(preenchido, { width: `${Math.max(2, (item.valor / maior) * 100)}%` });
    const filhos = [
      h('span', { class: 'barra-nome' }, item.nome),
      h('span', { class: 'barra-valor' }, moeda(item.valor)),
      h('span', { class: ['trilho', classeTrilho], 'aria-hidden': 'true' }, preenchido),
      h('span', { class: 'barra-pc' }, `${porcento(item.valor, total)} ${frasePc}${item.n ? ` · ${item.n} ${item.n === 1 ? 'lançamento' : 'lançamentos'}` : ''}`),
    ];
    if (!aoTocar) return h('div', { class: 'barra-linha' }, filhos);
    return h('button', {
      class: 'barra-linha', type: 'button',
      'aria-label': rotuloDoToque ? rotuloDoToque(item) : null,
      onclick: () => aoTocar(item),
    }, filhos);
  }));
}

// ---------------------------------------------------------------- lancamento

function nomeDaConta(id) {
  const c = dados.conta(id);
  if (!c) return id ? 'Conta que não está mais na lista' : '';
  const final = finalDaConta(c.final);
  return [c.apelido || c.instituicao || 'Conta', final].filter(Boolean).join(', ');
}

function classeDoValor(l) {
  if (l.fluxo === 'movimentacao') return null;
  return l.sinal === 'entrada' ? 'positivo' : null;
}

/** Linha da lista de lancamentos (botao que abre o detalhe). */
export function linhaDeLancamento(l) {
  let tipo = nomeDaCategoria(l.categoria);
  if (l.fluxo === 'movimentacao') tipo = nomeDoTipoDeSaida(l.tipo_saida) || nomeDoTipoDeEntrada(l.tipo_entrada) || 'Entre contas';
  else if (l.sinal === 'entrada' && !l.categoria) tipo = nomeDoTipoDeEntrada(l.tipo_entrada) || 'Entrada';
  const meta = [tipo];
  if (l.pessoa) meta.push(l.pessoa);
  const selos = [];
  if (l.pendente) selos.push(selo('alerta', 'pendente de decisão no computador'));
  if (l.parcela_atual && l.parcela_total) selos.push(selo('neutro', `parcela ${l.parcela_atual} de ${l.parcela_total}`));
  if (l.fluxo === 'movimentacao') selos.push(selo('neutro', 'entre contas'));
  if (l.destinatario && l.destinatario !== l.pessoa) selos.push(selo('info', `para ${l.destinatario}`));
  return h('button', { class: 'linha', type: 'button', onclick: () => abrirLancamento(l) },
    h('span', { class: 'linha-titulo' }, l.descricao || nomeDaEmpresa(l.empresa)),
    h('span', { class: ['linha-valor', classeDoValor(l)] }, moedaComSinal(l)),
    h('span', { class: 'linha-meta' }, meta.join(' · ')),
    h('span', null),
    selos.length ? h('span', { class: 'selos' }, selos) : null);
}

function par(rotulo, valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  return h('div', { class: 'par' }, h('dt', null, rotulo), h('dd', null, valor));
}

function fraseDoLancamento(l) {
  if (l.fluxo === 'movimentacao') return 'Dinheiro que mudou de lugar entre contas: não é renda nem gasto.';
  if (l.renda) return 'Conta como renda.';
  if (l.consumo) return 'Conta como consumo.';
  if (l.sinal === 'entrada') return 'Entrada que não conta como renda.';
  return 'Saída que não conta como consumo.';
}

/** O detalhe do lancamento, com todas as colunas em palavras simples. Nada se edita aqui. */
export function abrirLancamento(l) {
  const parcela = l.parcela_atual && l.parcela_total ? `${l.parcela_atual} de ${l.parcela_total}` : (l.parcela_atual ? String(l.parcela_atual) : null);
  const conteudo = [
    h('p', { class: ['detalhe-valor', classeDoValor(l)] }, moedaComSinal(l)),
    h('p', { class: 'nota detalhe-frase' }, fraseDoLancamento(l)),
    l.pendente ? h('div', { class: 'leitura leitura--alerta' }, icone('alerta'), h('span', null, 'Pendente de decisão no computador. Responda lá; a mudança aparece aqui na próxima cópia.')) : null,
    h('dl', { class: 'pares' },
      par('Descrição', l.descricao),
      par('Estabelecimento', l.empresa ? l.empresa : null),
      par('Data', dataBR(l.data) || l.data),
      l.data_compra && l.data_compra !== l.data ? par('Data da compra', dataBR(l.data_compra) || l.data_compra) : null,
      par('Mês', mesPorExtenso(l.ano_mes)),
      par('Tipo', nomeDoFluxo(l.fluxo)),
      par('Categoria', nomeDaCategoria(l.categoria)),
      par('Subcategoria', nomeDaSubcategoria(l.subcategoria)),
      l.consumo || l.natureza ? par('Natureza', nomeDaNatureza(l.natureza)) : null,
      par('Previsibilidade', nomeDaPrevisibilidade(l.previsibilidade)),
      par('Quem pagou', l.pessoa),
      par('Para quem foi', l.destinatario),
      par('Conta', nomeDaConta(l.conta_id)),
      par('Meio de pagamento', nomeDoMeio(l.meio)),
      par('Parcela', parcela),
      par('Tipo de entrada', nomeDoTipoDeEntrada(l.tipo_entrada)),
      par('Tipo de saída', nomeDoTipoDeSaida(l.tipo_saida)),
      par('Conta como renda', l.renda ? 'Sim' : 'Não'),
      par('Conta como consumo', l.consumo ? 'Sim' : 'Não')),
    h('p', { class: 'nota' }, 'Só leitura. Para mudar algo, use o programa no computador.'),
  ];
  abrirFolha({ titulo: l.descricao || 'Lançamento', conteudo });
}
