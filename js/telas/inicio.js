// Inicio: como esta o mes? Renda, consumo, quanto sobrou e a comparacao com o mes anterior; essencial x desejo; seis meses em grafico;
// para onde foi o dinheiro; de quem saiu; gastos com cada crianca; quantas decisoes esperam no computador; a data da copia.

import { registrar } from '../rotas.js';
import * as dados from '../dados.js';
import * as estado from '../estado.js';
import { h, svg, acrescentar } from '../ui.js';
import { icone } from '../icones.js';
import { cartao, selo, escolhaDeMes, listaDeBarras, semCopia } from '../pecas.js';
import { resumo, porCategoria, porQuemPagou, gastosCom, variacao } from '../calculos.js';
import { mesPorExtenso, mesCurto, mesAbrev, somarMeses, mesesAte, momentoPorExtenso } from '../datas.js';
import { moeda, moedaNoQuadro, porcento, nomeDaCategoria, plural } from '../formato.js';

function textoDaVariacao(v, mesAnterior, { subirEBom }) {
  if (v === null) return [`sem dados de ${mesCurto(mesAnterior)}`];
  const sinal = v > 0 ? '+' : '';
  let classe = null;
  if (v !== 0) classe = (v > 0) === subirEBom ? 'desce' : 'sobe';
  return [h('b', { class: classe }, `${sinal}${v}%`), ` sobre ${mesCurto(mesAnterior)}`];
}

function quadro(rotulo, valor, comp, classeDoValor = null) {
  return h('div', { class: 'numero' },
    h('div', { class: 'numero-rotulo' }, rotulo),
    h('div', { class: ['numero-valor', classeDoValor] }, valor),
    h('div', { class: 'numero-comp' }, comp));
}

function quadroDaConferencia(mes) {
  const doMes = dados.obter('conferencia').filter((c) => c.ano_mes === mes);
  const total = doMes.length;
  const fecham = doMes.filter((c) => c.status === 'fecha').length;
  const divergem = doMes.filter((c) => c.status === 'diverge').length;
  let comp;
  if (!total) comp = selo('neutro', 'sem conferência no mês');
  else if (divergem) comp = selo('erro', divergem === 1 ? '1 não bate' : `${divergem} não batem`);
  else if (fecham === total) comp = selo('ok', 'saldos batem');
  else comp = selo('alerta', 'conferência incompleta');
  return h('div', { class: 'numero' },
    h('div', { class: 'numero-rotulo' }, 'Saldos conferidos'),
    h('div', { class: 'numero-valor' }, total ? `${fecham} de ${total}` : '0'),
    h('div', { class: 'numero-comp' }, comp));
}

function cartaoNatureza(r, mes) {
  const partes = [
    { chave: 'essencial', nome: 'Essencial', valor: r.essencial, cor: 'cor-essencial' },
    { chave: 'desejo', nome: 'Desejo', valor: r.desejo, cor: 'cor-desejo' },
    { chave: 'poupanca', nome: 'Poupança ou investimento', valor: r.poupanca, cor: 'cor-poupanca' },
    { chave: 'sem', nome: 'Sem natureza ainda', valor: r.semNatureza, cor: 'cor-sem' },
  ].filter((p) => p.valor > 0 || p.chave === 'essencial' || p.chave === 'desejo');
  const barra = h('div', { class: 'empilhada', 'aria-hidden': 'true' }, partes.filter((p) => p.valor > 0).map((p) => {
    const i = h('i', { class: p.cor });
    i.style.setProperty('width', `${(p.valor / Math.max(1, r.consumo)) * 100}%`);
    return i;
  }));
  return cartao({ titulo: 'Essencial e desejo', sub: `Como se divide o consumo de ${mesPorExtenso(mes)}.` },
    barra,
    h('div', { class: 'legenda' }, partes.map((p) => h('div', { class: 'legenda-item' },
      h('i', { class: p.cor, 'aria-hidden': 'true' }),
      h('span', null, p.nome),
      h('b', null, `${moeda(p.valor)} · ${porcento(p.valor, r.consumo)}`)))));
}

function cartaoSeisMeses(mes) {
  const meses = mesesAte(mes, 6);
  const linhas = meses.map((am) => ({ am, ...resumo(dados.doMes(am)) }));
  const maior = Math.max(1, ...linhas.flatMap((d) => [d.renda, d.consumo]));
  const L = 320;
  const base = 118;
  const altura = 100;
  const largura = L / linhas.length;
  const grafico = svg('svg', {
    class: 'grafico', viewBox: `0 0 ${L} 146`, role: 'img',
    'aria-label': `Renda e consumo de ${mesPorExtenso(meses[0])} a ${mesPorExtenso(mes)}. Os valores estão em Ver em números, logo abaixo.`,
  },
  svg('line', { class: 'eixo', x1: 0, x2: L, y1: base, y2: base }),
  linhas.map((d, i) => {
    const x = i * largura + largura / 2;
    const hr = (d.renda / maior) * altura;
    const hc = (d.consumo / maior) * altura;
    const atual = d.am === mes;
    return svg('g', { class: atual ? null : 'apagado' },
      svg('rect', { class: 'renda', x: x - 15, y: base - hr, width: 13, height: Math.max(0, hr), rx: 3 }),
      svg('rect', { class: 'consumo', x: x + 2, y: base - hc, width: 13, height: Math.max(0, hc), rx: 3 }),
      svg('text', { class: atual ? 'atual' : null, x, y: base + 20, 'text-anchor': 'middle' }, mesAbrev(d.am)));
  }));
  const tabela = h('table', { class: 'tabela-numeros' },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Mês'), h('th', { scope: 'col' }, 'Renda'), h('th', { scope: 'col' }, 'Consumo'))),
    h('tbody', null, linhas.map((d) => h('tr', null, h('th', { scope: 'row' }, mesCurto(d.am)), h('td', null, moeda(d.renda)), h('td', null, moeda(d.consumo))))));
  return cartao({ titulo: 'Renda e consumo', sub: 'Últimos seis meses, pelo mês em que o dinheiro entrou ou saiu.' },
    grafico,
    h('div', { class: 'legenda legenda--linha' },
      h('div', { class: 'legenda-item' }, h('i', { class: 'cor-renda', 'aria-hidden': 'true' }), 'Renda'),
      h('div', { class: 'legenda-item' }, h('i', { class: 'cor-consumo', 'aria-hidden': 'true' }), 'Consumo')),
    h('details', { class: 'detalhes' }, h('summary', null, 'Ver em números'), tabela));
}

function desenhar(ctx) {
  ctx.titulo('Finanças da casa');
  const mes = estado.mesAtual();
  if (!mes) {
    acrescentar(ctx.raiz, semCopia());
    return;
  }
  const doMes = dados.doMes(mes);
  const r = resumo(doMes);
  const anterior = somarMeses(mes, -1);
  const temAnterior = dados.doMes(anterior).length > 0;
  const ra = temAnterior ? resumo(dados.doMes(anterior)) : null;
  const pendencias = dados.obter('pendencia').length;
  const st = dados.estado();
  const cats = porCategoria(doMes);
  const pessoasQuePagaram = porQuemPagou(doMes);

  const mudarMes = (am) => { estado.definirMes(am); ctx.ir('inicio'); };

  acrescentar(ctx.raiz,
    pendencias
      ? h('a', { class: 'faixa', href: '#pendencias' },
        icone('computador', { tamanho: 22 }),
        h('div', null,
          h('strong', null, pendencias === 1 ? '1 decisão espera você no computador' : `${pendencias} decisões esperam você no computador`),
          h('span', null, 'Enquanto não forem respondidas, alguns números podem mudar. Toque para ver a lista.')))
      : null,
    st.computador.velho
      ? h('div', { class: 'faixa faixa--erro', role: 'status' },
        icone('alerta', { tamanho: 22 }),
        h('div', null,
          h('strong', null, 'A cópia do computador tem mais de 2 dias'),
          h('span', null, 'Abra o programa no computador para mandar uma cópia nova.')))
      : null,
    escolhaDeMes(mes, mudarMes),
    h('div', { class: 'grade' },
      quadro('Renda', moedaNoQuadro(r.renda), temAnterior ? textoDaVariacao(variacao(r.renda, ra.renda), anterior, { subirEBom: true }) : textoDaVariacao(null, anterior, {}), 'positivo'),
      quadro('Consumo', moedaNoQuadro(r.consumo), temAnterior ? textoDaVariacao(variacao(r.consumo, ra.consumo), anterior, { subirEBom: false }) : textoDaVariacao(null, anterior, {})),
      quadro('Sobrou no mês', moedaNoQuadro(r.sobra), r.sobra >= 0 ? 'renda maior que o consumo' : 'consumo maior que a renda', r.sobra >= 0 ? 'positivo' : 'negativo'),
      quadroDaConferencia(mes)),
    cartaoNatureza(r, mes),
    cartaoSeisMeses(mes),
    cartao({ titulo: 'Para onde foi o dinheiro', sub: `${mesPorExtenso(mes)}, maiores categorias. Toque para ver os lançamentos.` },
      cats.length
        ? listaDeBarras(cats.slice(0, 5).map((c) => ({ ...c, nome: nomeDaCategoria(c.chave) })), {
          total: r.consumo,
          frasePc: 'do consumo do mês',
          aoTocar: (item) => estado.verLancamentos({ categoria: item.chave }),
        })
        : h('p', { class: 'nota' }, 'Nenhum consumo neste mês.'),
      cats.length > 5 ? h('a', { class: 'botao botao--discreto botao--cheio', href: '#gastos' }, `Ver todas as categorias (${cats.length})`) : null),
    cartao({ titulo: 'Por pessoa', sub: 'De quem saiu o dinheiro do consumo no mês. Toque para ver os lançamentos.' },
      pessoasQuePagaram.length
        ? listaDeBarras(pessoasQuePagaram.map((p) => ({ ...p, nome: p.chave || 'Sem pessoa marcada' })), {
          total: r.consumo,
          frasePc: 'do consumo do mês',
          aoTocar: (item) => estado.verLancamentos(item.chave ? { pessoa: item.chave } : {}),
        })
        : h('p', { class: 'nota' }, 'Nenhum consumo neste mês.')),
    dados.criancas().map((crianca) => {
      const g = gastosCom(doMes, crianca.nome);
      return cartao({ titulo: `Gastos com ${crianca.nome}`, sub: g.total ? `${moeda(g.total)} em ${mesPorExtenso(mes)}, por item.` : `Nenhum gasto com ${crianca.nome} em ${mesPorExtenso(mes)}.` },
        g.total
          ? listaDeBarras(g.itens.slice(0, 6), { total: g.total, frasePc: `do gasto com ${crianca.nome}` })
          : null,
        g.total ? h('button', { class: 'botao botao--discreto botao--cheio', type: 'button', onclick: () => estado.verLancamentos({ pessoa: crianca.nome }) }, `Ver os lançamentos de ${crianca.nome}`) : null);
    }),
    h('p', { class: 'nota nota--centro rodape-versao' },
      st.computador.conhecido ? `Cópia do computador de ${momentoPorExtenso(st.computador.epoch)}.` : 'O computador ainda não informou a data da cópia.',
      ' ', plural(doMes.length, 'lançamento', 'lançamentos'), ' neste mês.'),
  );
}

registrar('inicio', desenhar, { aba: 'inicio' });
