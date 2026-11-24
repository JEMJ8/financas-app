// Gastos: onde o dinheiro foi? Consumo por categoria e por estabelecimento, no mes escolhido ou nos ultimos 3 ou 6 meses.
// Tocar numa linha abre os Lancamentos ja filtrados (mesma categoria ou estabelecimento, mesmo periodo).

import { registrar } from '../rotas.js';
import * as dados from '../dados.js';
import * as estado from '../estado.js';
import { h, acrescentar, preencher } from '../ui.js';
import { cartao, escolhaDeMes, listaDeBarras, semCopia } from '../pecas.js';
import { resumo, porCategoria, porEmpresa } from '../calculos.js';
import { mesCurto, mesPorExtenso } from '../datas.js';
import { moeda, nomeDaCategoria, nomeDaEmpresa } from '../formato.js';

const ESTABELECIMENTOS_DE_INICIO = 12;

function desenhar(ctx) {
  ctx.titulo('Gastos');
  const mes = estado.mesAtual();
  if (!mes) {
    acrescentar(ctx.raiz, semCopia());
    return;
  }
  const [de, ate] = estado.limitesDoPeriodo();
  const linhas = dados.doPeriodo(de, ate);
  const r = resumo(linhas);
  const cats = porCategoria(linhas);
  const lojas = porEmpresa(linhas);
  const umMes = de === ate;
  const nomeDoPeriodo = umMes ? mesPorExtenso(mes) : `${mesCurto(de)} a ${mesCurto(ate)}`;
  const frasePc = umMes ? 'do consumo do mês' : 'do consumo do período';

  const mudarMes = (am) => { estado.definirMes(am); ctx.ir('gastos'); };
  const periodos = h('div', { class: 'chips', role: 'group', 'aria-label': 'Período' },
    estado.PERIODOS.map((p) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(estado.periodo() === p.meses),
      onclick: () => { estado.definirPeriodo(p.meses); ctx.ir('gastos'); },
    }, p.rotulo)));

  let todasAsLojas = false;
  const caixaDasLojas = h('div');
  function desenharLojas() {
    const mostrar = todasAsLojas ? lojas : lojas.slice(0, ESTABELECIMENTOS_DE_INICIO);
    preencher(caixaDasLojas,
      listaDeBarras(mostrar.map((e) => ({ ...e, nome: nomeDaEmpresa(e.chave) })), {
        total: r.consumo,
        frasePc,
        aoTocar: (item) => estado.verLancamentos({ empresa: item.chave }, { de, ate }),
      }),
      !todasAsLojas && lojas.length > ESTABELECIMENTOS_DE_INICIO
        ? h('button', { class: 'botao botao--discreto botao--cheio', type: 'button', onclick: () => { todasAsLojas = true; desenharLojas(); } },
          `Mostrar todos (${lojas.length})`)
        : null);
  }
  desenharLojas();

  acrescentar(ctx.raiz,
    escolhaDeMes(mes, mudarMes, umMes ? null : `período de ${nomeDoPeriodo}`),
    periodos,
    h('p', { class: 'contagem' }, 'Consumo em ', nomeDoPeriodo, ': ', h('b', null, moeda(r.consumo))),
    cartao({ titulo: 'Por categoria', sub: 'Toque para ver os lançamentos.' },
      cats.length
        ? listaDeBarras(cats.map((c) => ({ ...c, nome: nomeDaCategoria(c.chave) })), {
          total: r.consumo,
          frasePc,
          aoTocar: (item) => estado.verLancamentos({ categoria: item.chave }, { de, ate }),
        })
        : h('p', { class: 'nota' }, 'Nenhum consumo neste período.')),
    cartao({ titulo: 'Onde mais se gastou', sub: 'Estabelecimentos, do maior para o menor. Toque para ver os lançamentos.' },
      lojas.length ? caixaDasLojas : h('p', { class: 'nota' }, 'Nenhum consumo neste período.')),
  );
}

registrar('gastos', desenhar, { aba: 'gastos' });
