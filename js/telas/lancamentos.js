// Lancamentos: o que entrou e saiu? Lista por dia, busca (descricao e estabelecimento), filtros (tipo, pessoa, categoria, mes,
// estabelecimento, pendentes) e o detalhe de cada um (folha).
// Rapida com muitas linhas (o computador pode mandar uns 10 mil lancamentos): o filtro roda na memoria e a lista desenha de 80 em 80,
// mais 80 quando a pessoa chega perto do fim (ou toca em "Mostrar mais").

import { registrar } from '../rotas.js';
import * as dados from '../dados.js';
import * as estado from '../estado.js';
import { h, preencher, novoId, anunciar, acrescentar } from '../ui.js';
import { icone } from '../icones.js';
import { linhaDeLancamento, semCopia, vazio } from '../pecas.js';
import { filtrar } from '../calculos.js';
import { mesPorExtenso, mesCurto, diaDaLista } from '../datas.js';
import { moeda, nomeDaCategoria, chaveDaCategoria, nomeDaEmpresa, plural } from '../formato.js';

const LOTE = 80;
const TIPOS = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'saida', rotulo: 'Saídas' },
  { valor: 'entrada', rotulo: 'Entradas' },
  { valor: 'movimentacao', rotulo: 'Entre contas' },
];

function chip(rotulo, apertado, aoTocar, extra = {}) {
  return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(apertado), onclick: aoTocar, ...extra }, rotulo);
}

function chipDeTirar(rotulo, aoTocar) {
  return h('button', { class: 'chip chip--tirar', type: 'button', onclick: aoTocar, 'aria-label': `Tirar o filtro ${rotulo}` }, rotulo, icone('fechar', { tamanho: 16 }));
}

function categoriasExistentes() {
  const chaves = new Set();
  for (const l of dados.todosOrdenados()) chaves.add(chaveDaCategoria(l.categoria));
  return [...chaves].sort((a, b) => nomeDaCategoria(a).localeCompare(nomeDaCategoria(b), 'pt-BR'));
}

function descricaoDoPeriodo(f) {
  if (!f.de && !f.ate) return 'todos os meses';
  if (f.de === f.ate) return mesPorExtenso(f.de);
  return `${mesCurto(f.de)} a ${mesCurto(f.ate)}`;
}

function desenhar(ctx) {
  ctx.titulo('Lançamentos');
  if (!dados.mesPadrao()) {
    acrescentar(ctx.raiz, semCopia());
    return;
  }
  const f = estado.filtro();
  const idBusca = novoId('busca');
  const busca = h('input', {
    id: idBusca, class: 'entrada', type: 'search', value: f.busca, placeholder: 'Buscar por descrição ou loja',
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search',
  });
  const controles = h('div', { class: 'filtros' });
  const resumoDaLista = h('p', { class: 'contagem', role: 'status' });
  const lista = h('div');
  let observador = null;
  let tempoDaBusca = null;

  function trocar(campos) {
    Object.assign(f, campos);
    desenharControles();
    desenharLista();
  }

  function desenharControles() {
    const pessoas = dados.pessoas();
    const meses = [...dados.meses()].reverse();
    const idMes = novoId('mes');
    const idCat = novoId('cat');
    const valorDoMes = !f.de && !f.ate ? '' : f.de === f.ate ? f.de : 'periodo';
    const seletorDeMes = h('select', { id: idMes, class: 'entrada' },
      h('option', { value: '' }, 'Todos os meses'),
      valorDoMes === 'periodo' ? h('option', { value: 'periodo' }, descricaoDoPeriodo(f)) : null,
      meses.map((am) => h('option', { value: am }, mesPorExtenso(am))));
    seletorDeMes.value = valorDoMes;
    seletorDeMes.addEventListener('change', () => {
      const v = seletorDeMes.value;
      if (v === 'periodo') return;
      if (v) estado.definirMes(v);
      trocar(v ? { de: v, ate: v } : { de: '', ate: '' });
    });
    const seletorDeCategoria = h('select', { id: idCat, class: 'entrada' },
      h('option', { value: '' }, 'Todas as categorias'),
      categoriasExistentes().map((c) => h('option', { value: c }, nomeDaCategoria(c))));
    seletorDeCategoria.value = f.categoria;
    seletorDeCategoria.addEventListener('change', () => trocar({ categoria: seletorDeCategoria.value }));

    // Filtros que estao valendo, sempre a vista (cada um sai com um toque), mesmo com o painel fechado.
    const ativos = [];
    if (f.pessoa) ativos.push(chipDeTirar(`Pessoa: ${f.pessoa}`, () => trocar({ pessoa: '' })));
    if (f.categoria) ativos.push(chipDeTirar(nomeDaCategoria(f.categoria), () => trocar({ categoria: '' })));
    if (f.empresa) ativos.push(chipDeTirar(nomeDaEmpresa(f.empresa), () => trocar({ empresa: '' })));
    if (f.pendente) ativos.push(chipDeTirar('Só pendentes', () => trocar({ pendente: false })));
    const aberto = estado.filtrosAbertos();
    const idPainel = novoId('painel');
    const alternar = h('button', {
      class: 'chip', type: 'button', 'aria-expanded': String(aberto), 'aria-controls': idPainel,
      onclick: () => { estado.filtrosAbertos(!aberto); desenharControles(); },
    }, icone('filtro', { tamanho: 18 }), aberto ? 'Fechar filtros' : 'Mês, pessoa e categoria');
    const algumFiltro = f.busca || f.tipo || f.pessoa || f.categoria || f.empresa || f.pendente;

    preencher(controles,
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Tipo de lançamento' },
        TIPOS.map((t) => chip(t.rotulo, f.tipo === t.valor, () => trocar({ tipo: t.valor })))),
      h('div', { class: 'chips' }, alternar, ativos),
      aberto
        ? h('div', { class: 'painel-filtros', id: idPainel },
          h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo', for: idMes }, 'Mês'), seletorDeMes),
          pessoas.length
            ? h('div', { class: 'campo' },
              h('span', { class: 'campo-rotulo', id: `${idPainel}-p` }, 'Pessoa (quem pagou ou para quem foi)'),
              h('div', { class: 'chips', role: 'group', 'aria-labelledby': `${idPainel}-p` },
                chip('Todas', !f.pessoa, () => trocar({ pessoa: '' })),
                pessoas.map((p) => chip(p.nome, f.pessoa === p.nome, () => trocar({ pessoa: f.pessoa === p.nome ? '' : p.nome })))))
            : null,
          h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo', for: idCat }, 'Categoria'), seletorDeCategoria),
          h('div', { class: 'chips' },
            chip('Só pendentes de decisão', f.pendente, () => trocar({ pendente: !f.pendente })),
            algumFiltro
              ? h('button', { class: 'chip', type: 'button', onclick: () => { estado.limparFiltros(); busca.value = ''; ctx.ir('lancamentos'); } }, 'Limpar filtros')
              : null))
        : null);
  }

  function desenharLista() {
    if (observador) { observador.disconnect(); observador = null; }
    const linhas = filtrar(dados.doPeriodo(f.de, f.ate), f);
    let consumo = 0;
    let renda = 0;
    for (const l of linhas) {
      if (l.consumo) consumo += l.valor;
      if (l.renda) renda += l.valor;
    }
    const partes = [plural(linhas.length, 'lançamento', 'lançamentos'), `em ${descricaoDoPeriodo(f)}`];
    preencher(resumoDaLista,
      h('b', null, partes[0]), ` ${partes[1]}`,
      consumo ? [' · consumo ', h('b', null, moeda(consumo))] : null,
      renda ? [' · renda ', h('b', null, moeda(renda))] : null,
      f.pessoa ? `. Com ${f.pessoa}: quem pagou ou para quem foi.` : '');
    lista.replaceChildren();
    if (!linhas.length) {
      acrescentar(lista, vazio({ icone: 'busca', titulo: 'Nenhum lançamento com esses filtros', texto: 'Mude o mês, tire um filtro ou toque em Limpar filtros.' }));
      return;
    }
    let mostrados = 0;
    let diaAtual = null;
    let grupo = null;
    const comAno = !f.de || f.de.slice(0, 4) !== f.ate.slice(0, 4);
    const botaoMais = h('button', { class: 'botao botao--cheio mais-linhas', type: 'button' });
    const mostrarMais = () => {
      const fim = Math.min(linhas.length, mostrados + LOTE);
      const fragmento = document.createDocumentFragment();
      for (let i = mostrados; i < fim; i += 1) {
        const l = linhas[i];
        if (l.data !== diaAtual || !grupo) {
          diaAtual = l.data;
          fragmento.append(h('h3', { class: 'dia' }, diaDaLista(l.data, comAno)));
          grupo = h('div', { class: 'lista' });
          fragmento.append(grupo);
        }
        grupo.append(linhaDeLancamento(l));
      }
      mostrados = fim;
      botaoMais.before(fragmento);
      if (mostrados >= linhas.length) {
        botaoMais.remove();
        if (observador) { observador.disconnect(); observador = null; }
      } else {
        botaoMais.textContent = `Mostrar mais (faltam ${(linhas.length - mostrados).toLocaleString('pt-BR')})`;
      }
    };
    botaoMais.addEventListener('click', () => { mostrarMais(); anunciar(`${mostrados} de ${linhas.length} lançamentos na tela.`); });
    lista.append(botaoMais);
    mostrarMais();
    if (mostrados < linhas.length && 'IntersectionObserver' in window) {
      observador = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) mostrarMais();
      }, { rootMargin: '600px 0px' });
      observador.observe(botaoMais);
    }
  }

  busca.addEventListener('input', () => {
    window.clearTimeout(tempoDaBusca);
    tempoDaBusca = window.setTimeout(() => {
      f.busca = busca.value;
      desenharControles();
      desenharLista();
    }, 250);
  });
  ctx.aoLimpar(() => {
    window.clearTimeout(tempoDaBusca);
    if (observador) observador.disconnect();
  });

  desenharControles();
  desenharLista();
  acrescentar(ctx.raiz,
    h('div', { class: 'busca-caixa' }, icone('busca', { tamanho: 20 }), h('label', { class: 'so-leitor', for: idBusca }, 'Buscar lançamentos'), busca),
    controles,
    resumoDaLista,
    lista);
}

registrar('lancamentos', desenhar, { aba: 'lancamentos' });
