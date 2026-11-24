// Contas: quanto tem em cada conta e se cada fatura foi paga.
// Contas: apelido, instituicao, final de 4 digitos, titular e o saldo conferido de cada mes (conferencia), com a situacao em palavras.
// Cartoes: as faturas (fatura) com valor, vencimento, quanto foi pago e a situacao em palavras.

import { registrar } from '../rotas.js';
import * as dados from '../dados.js';
import { h, acrescentar } from '../ui.js';
import { icone } from '../icones.js';
import { cartao, selo, semCopia, vazio } from '../pecas.js';
import { mesPorExtenso, mesCurto, dataBR } from '../datas.js';
import { moeda, finalDaConta, nomeDoTipoDeConta, situacaoDaConferencia, situacaoDaFatura } from '../formato.js';

function metaDaConta(c) {
  return [c.instituicao, finalDaConta(c.final), c.titular ? `de ${c.titular}` : null].filter(Boolean).join(' · ');
}

function cabecaDaConta(c, nomeDoIcone) {
  return h('div', { class: 'conta-cabeca' },
    h('span', { class: 'conta-icone', 'aria-hidden': 'true' }, icone(nomeDoIcone, { tamanho: 22 })),
    h('div', null,
      h('p', { class: 'conta-nome' }, c.apelido || c.instituicao || 'Conta'),
      h('p', { class: 'conta-meta' }, nomeDoTipoDeConta(c.tipo)),
      h('p', { class: 'conta-meta' }, metaDaConta(c))));
}

function saldoDe(conf) {
  if (conf.saldo_documento !== null && conf.saldo_documento !== undefined) return { valor: conf.saldo_documento, origem: 'saldo do extrato' };
  if (conf.saldo_calculado !== null && conf.saldo_calculado !== undefined) return { valor: conf.saldo_calculado, origem: 'saldo calculado' };
  return null;
}

function linhaDeConferencia(conf) {
  const s = situacaoDaConferencia(conf.status);
  const saldo = saldoDe(conf);
  const detalhes = [];
  if (conf.entradas) detalhes.push(`entrou ${moeda(conf.entradas)}`);
  if (conf.saidas) detalhes.push(`saiu ${moeda(conf.saidas)}`);
  if (conf.diferenca) detalhes.push(`diferença de ${moeda(Math.abs(conf.diferenca))}`);
  return h('div', { class: 'mini-linha' },
    h('span', { class: 't' }, mesPorExtenso(conf.ano_mes)),
    h('span', { class: 'v' }, saldo ? moeda(saldo.valor) : 'sem saldo'),
    detalhes.length ? h('span', { class: 'm' }, detalhes.join(' · ')) : null,
    h('span', { class: 'selos' }, selo(s.tom, s.texto)));
}

function cartaoDaConta(c) {
  const confs = dados.obter('conferencia').filter((x) => x.conta_id === c.id).sort((a, b) => String(b.ano_mes).localeCompare(String(a.ano_mes)));
  const ultima = confs[0] || null;
  const saldo = ultima ? saldoDe(ultima) : null;
  const s = ultima ? situacaoDaConferencia(ultima.status) : null;
  return cartao({},
    cabecaDaConta(c, 'banco'),
    ultima
      ? h('div', { class: 'conta-saldo' },
        h('p', { class: 'nota' }, `${saldo ? saldo.origem[0].toUpperCase() + saldo.origem.slice(1) : 'Saldo'} no fim de ${mesPorExtenso(ultima.ano_mes)}`),
        h('p', { class: 'conta-saldo-valor' }, saldo ? moeda(saldo.valor) : 'Sem saldo'),
        h('div', { class: 'selos' }, selo(s.tom, s.texto), ultima.diferenca ? selo('erro', `diferença de ${moeda(Math.abs(ultima.diferenca))}`) : null))
      : h('p', { class: 'nota conta-saldo' }, 'Ainda sem conferência de saldo para esta conta.'),
    confs.length > 1
      ? h('details', { class: 'detalhes' }, h('summary', null, `Mês a mês (${confs.length} meses)`), h('div', null, confs.map(linhaDeConferencia)))
      : null);
}

function linhaDeFatura(f) {
  const s = situacaoDaFatura(f.status);
  const partes = [];
  if (f.vencimento) partes.push(`vence ${dataBR(f.vencimento) || f.vencimento}`);
  if (f.valor_pago !== null && f.valor_pago !== undefined) partes.push(`pago ${moeda(f.valor_pago)}`);
  return h('div', { class: 'mini-linha' },
    h('span', { class: 't' }, `Fatura de ${mesCurto(String(f.competencia || '').slice(0, 7))}`),
    h('span', { class: 'v' }, f.valor_fatura === null || f.valor_fatura === undefined ? 'sem valor' : moeda(f.valor_fatura)),
    partes.length ? h('span', { class: 'm' }, partes.join(' · ')) : null,
    h('span', { class: 'selos' }, selo(s.tom, s.texto), f.diferenca ? selo('erro', `diferença de ${moeda(Math.abs(f.diferenca))}`) : null));
}

function cartaoDoCartao(c) {
  const faturas = dados.obter('fatura').filter((x) => x.conta_id === c.id).sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
  const pai = c.conta_pai ? dados.conta(c.conta_pai) : null;
  const visiveis = faturas.slice(0, 4);
  const resto = faturas.slice(4);
  return cartao({},
    cabecaDaConta(c, 'cartao'),
    pai ? h('p', { class: 'nota conta-saldo' }, `Cartão adicional. As compras dele vêm na fatura de ${pai.apelido || pai.instituicao || 'outro cartão'} e contam para quem usa o cartão.`) : null,
    faturas.length
      ? h('div', { class: 'conta-saldo' }, visiveis.map(linhaDeFatura),
        resto.length ? h('details', { class: 'detalhes' }, h('summary', null, `Faturas anteriores (${resto.length})`), h('div', null, resto.map(linhaDeFatura))) : null)
      : (pai ? null : h('p', { class: 'nota conta-saldo' }, 'Ainda sem fatura lida para este cartão.')));
}

function desenhar(ctx) {
  ctx.titulo('Contas e cartões');
  const contas = dados.obter('conta');
  if (!contas.length) {
    acrescentar(ctx.raiz, dados.mesPadrao() ? vazio({ icone: 'cartao', titulo: 'Nenhuma conta na cópia', texto: 'O computador ainda não mandou as contas.' }) : semCopia());
    return;
  }
  const ordenadas = [...contas].sort((a, b) => String(a.apelido || '').localeCompare(String(b.apelido || ''), 'pt-BR'));
  const correntes = ordenadas.filter((c) => c.tipo !== 'cartao');
  const cartoes = ordenadas.filter((c) => c.tipo === 'cartao');
  acrescentar(ctx.raiz,
    correntes.length ? h('h2', { class: 'secao-titulo' }, 'Contas') : null,
    correntes.length ? h('p', { class: 'nota' }, 'O saldo de cada mês e se ele bate com o que o extrato declara.') : null,
    correntes.map(cartaoDaConta),
    cartoes.length ? h('h2', { class: 'secao-titulo' }, 'Cartões') : null,
    cartoes.length ? h('p', { class: 'nota' }, 'Cada fatura e se o pagamento dela foi achado no extrato.') : null,
    cartoes.map(cartaoDoCartao));
}

registrar('contas', desenhar, { aba: 'contas' });
