// Mais: decisoes pendentes (so leitura), pessoas, sobre a copia, tema, trava do aplicativo, sair e a versao.
// Tambem registra as telas #pendencias e #pessoas (aba Mais).

import { registrar } from '../rotas.js';
import * as dados from '../dados.js';
import * as estado from '../estado.js';
import * as auth from '../auth.js';
import { h, novoId, estilo, anunciar, acrescentar } from '../ui.js';
import { icone } from '../icones.js';
import { abrirFolha, confirmar } from '../folha.js';
import { confirmarComVerificacao } from '../verificada.js';
import { abrirTrava, rotuloDaTrava } from './trava-ajustes.js';
import { cartao, selo, escolhaDeMes, semCopia, vazio } from '../pecas.js';
import { resumo, gastosCom, filtrar } from '../calculos.js';
import { quandoFoi, momentoPorExtenso, mesPorExtenso, mesCurto } from '../datas.js';
import { moeda, plural, nomeDaGravidade, tomDaGravidade, ORDEM_DA_GRAVIDADE, corSegura } from '../formato.js';
import { OPCOES_DE_TEMA, definirTema, preferenciaDeTema, rotuloDoTema } from '../tema.js';
import { VERSAO_APP } from '../versao.js';
import { modoDemo } from '../ensaio.js';

function linhaDeMenu({ titulo, meta, direita = null, href = null, aoTocar = null }) {
  const filhos = [
    h('span', { class: 'linha-titulo' }, titulo),
    direita || h('span', { class: 'linha-seta', 'aria-hidden': 'true' }, '›'),
    h('span', { class: 'linha-meta linha-meta--quebra' }, meta),
  ];
  if (href) return h('a', { class: 'linha', href }, filhos);
  return h('button', { class: 'linha', type: 'button', onclick: aoTocar }, filhos);
}

function par(rotulo, valor) {
  return h('div', { class: 'dado-linha' }, h('span', null, rotulo), h('span', null, valor));
}

function cartaoDaCopia() {
  const st = dados.estado();
  const c = st.computador;
  const contagem = (t) => dados.obter(t).length;
  const periodo = c.periodoDe && c.periodoAte ? `${mesCurto(c.periodoDe)} a ${mesCurto(c.periodoAte)}` : null;
  return cartao({ titulo: 'Sobre a cópia', sub: 'O celular mostra a última cópia que o computador mandou. Tudo se edita no computador.' },
    par('Cópia do computador', c.conhecido ? momentoPorExtenso(c.epoch) : 'Data desconhecida'),
    par('Baixada neste celular', st.local ? quandoFoi(st.local) : 'Ainda não'),
    periodo ? par('Período', periodo) : null,
    par('Lançamentos', contagem('lancamento').toLocaleString('pt-BR')),
    par('Contas e cartões', String(contagem('conta'))),
    c.versao ? par('Programa do computador', `versão ${c.versao}`) : null,
    c.velho ? h('p', { class: 'leitura leitura--alerta' }, icone('alerta'), h('span', null, 'Esta cópia tem mais de 2 dias. Abra o programa no computador para mandar uma nova.')) : null,
    st.offline ? h('p', { class: 'leitura' }, icone('semRede'), h('span', null, 'Sem internet agora. O aplicativo mostra a cópia guardada neste celular.')) : null);
}

function abrirTema(aoMudar) {
  const nome = novoId('tema');
  const atual = preferenciaDeTema();
  abrirFolha({
    titulo: 'Tema',
    conteudo: h('fieldset', { class: 'opcoes' },
      h('legend', { class: 'so-leitor' }, 'Tema do aplicativo'),
      OPCOES_DE_TEMA.map((o) => h('label', { class: 'opcao' },
        h('input', { type: 'radio', name: nome, value: o.valor, checked: o.valor === atual, onchange: () => { definirTema(o.valor); anunciar(`Tema: ${o.rotulo}.`); aoMudar(); } }),
        h('span', null, h('strong', null, o.rotulo), h('small', null, o.ajuda))))),
  });
}

async function aoToqueSair(botao) {
  if (modoDemo()) {
    await confirmar({ titulo: 'Demonstração', texto: 'Esta é uma demonstração com dados inventados: não há conta para sair.', rotuloConfirmar: 'Entendi', rotuloCancelar: 'Fechar' });
    return;
  }
  const comTrava = auth.biometriaLigada() && auth.biometriaDados().valido;
  const texto = 'Isso apaga a cópia guardada neste celular. Para entrar de novo você vai precisar da senha e do código do autenticador.';
  const r = comTrava
    ? await confirmarComVerificacao({
      titulo: 'Sair deste celular?', texto: `${texto} A trava do aplicativo também é desligada.`, rotuloConfirmar: 'Sair e apagar', perigo: true,
      textoFalha: 'Não foi confirmado. Toque em Sair e apagar para tentar de novo.',
      escape: { rotulo: 'Sair mesmo sem confirmar', texto: 'Isso só apaga os dados deste celular; nada fica à vista.' },
    })
    : await confirmar({ titulo: 'Sair deste celular?', texto, rotuloConfirmar: 'Sair e apagar', perigo: true });
  if (!r.confirmado) return;
  botao.disabled = true;
  try {
    await auth.sair();
    window.location.replace(window.location.pathname);
  } catch {
    botao.disabled = false;
  }
}

function desenharMais(ctx) {
  ctx.titulo('Mais');
  const n = dados.obter('pendencia').length;
  const usuario = auth.usuarioAtual();
  const redesenhar = () => ctx.ir('mais');
  const sair = linhaDeMenu({
    titulo: 'Sair deste celular',
    meta: modoDemo() ? 'Demonstração: não há conta' : `Apaga a cópia guardada aqui${usuario && usuario.email ? `. Você entrou como ${usuario.email}` : ''}`,
    direita: icone('sair'),
  });
  sair.addEventListener('click', () => aoToqueSair(sair));
  const trava = rotuloDaTrava();
  acrescentar(ctx.raiz,
    h('div', { class: 'lista' },
      linhaDeMenu({ titulo: 'Decisões pendentes', meta: n ? `${plural(n, 'decisão espera', 'decisões esperam')} no computador` : 'Nenhuma decisão esperando no computador', href: '#pendencias' }),
      linhaDeMenu({ titulo: 'Pessoas', meta: 'Quanto entrou e saiu de cada um no mês', href: '#pessoas' })),
    h('h2', { class: 'secao-titulo' }, 'A cópia'),
    cartaoDaCopia(),
    h('h2', { class: 'secao-titulo' }, 'Este celular'),
    h('div', { class: 'lista' },
      linhaDeMenu({ titulo: 'Tema', meta: rotuloDoTema(), aoTocar: () => abrirTema(redesenhar) }),
      linhaDeMenu({
        titulo: 'Trava do aplicativo',
        meta: 'Pede o desbloqueio do celular (digital, rosto, PIN ou padrão) para abrir',
        direita: selo(trava.tom, trava.texto),
        aoTocar: () => abrirTrava(redesenhar),
      }),
      sair),
    h('p', { class: 'nota nota--centro rodape-versao' }, `Finanças da casa · versão ${VERSAO_APP} · só leitura`));
}

function desenharPendencias(ctx) {
  ctx.titulo('Decisões pendentes');
  const lista = [...dados.obter('pendencia')];
  const ordem = (g) => { const i = ORDEM_DA_GRAVIDADE.indexOf(g); return i < 0 ? 99 : i; };
  lista.sort((a, b) => ordem(a.gravidade) - ordem(b.gravidade) || (b.valor || 0) - (a.valor || 0) || String(a.titulo).localeCompare(String(b.titulo)));
  acrescentar(ctx.raiz,
    h('a', { class: 'botao botao--discreto', href: '#mais' }, icone('voltar'), 'Voltar para Mais'),
    h('div', { class: 'leitura' }, icone('computador'), h('span', null, 'Aqui você só vê. As respostas são dadas no programa do computador e aparecem aqui na próxima cópia.')));
  if (!lista.length) {
    acrescentar(ctx.raiz, vazio({ icone: 'ok', titulo: 'Nenhuma decisão esperando', texto: 'O computador não tem pergunta aberta agora.' }));
    return;
  }
  const total = lista.reduce((s, p) => s + (p.valor || 0), 0);
  acrescentar(ctx.raiz,
    h('p', { class: 'contagem' }, h('b', null, plural(lista.length, 'decisão', 'decisões')), total ? [' · valores envolvidos somam ', h('b', null, moeda(total))] : null),
    h('div', { class: 'lista' }, lista.map((p) => h('div', { class: 'linha' },
      h('span', { class: 'linha-titulo linha-titulo--quebra' }, p.titulo || 'Decisão sem título'),
      h('span', { class: 'linha-valor' }, p.valor === null || p.valor === undefined ? '' : moeda(p.valor)),
      p.pergunta ? h('span', { class: 'linha-meta linha-meta--quebra' }, p.pergunta) : null,
      h('span', { class: 'selos' }, selo(tomDaGravidade(p.gravidade), `Gravidade ${nomeDaGravidade(p.gravidade).toLowerCase()}`), selo('info', 'Resolva no computador'))))));
}

function desenharPessoas(ctx) {
  ctx.titulo('Pessoas');
  const mes = estado.mesAtual();
  acrescentar(ctx.raiz, h('a', { class: 'botao botao--discreto', href: '#mais' }, icone('voltar'), 'Voltar para Mais'));
  if (!mes) {
    acrescentar(ctx.raiz, semCopia());
    return;
  }
  const doMes = dados.doMes(mes);
  const pessoas = dados.pessoas();
  acrescentar(ctx.raiz, escolhaDeMes(mes, (am) => { estado.definirMes(am); ctx.ir('pessoas'); }));
  if (!pessoas.length) {
    acrescentar(ctx.raiz, vazio({ icone: 'pessoas', titulo: 'Nenhuma pessoa na cópia' }));
    return;
  }
  for (const p of pessoas) {
    const pagou = resumo(doMes.filter((l) => l.pessoa === p.nome));
    const com = gastosCom(doMes, p.nome);
    const todas = filtrar(doMes, { pessoa: p.nome });
    const ponto = h('span', { class: 'pessoa-ponto', 'aria-hidden': 'true' });
    const cor = corSegura(p.cor);
    if (cor) estilo(ponto, { background: cor });
    acrescentar(ctx.raiz, cartao({
      titulo: [ponto, p.nome],
      acao: p.crianca ? selo('info', 'criança') : null,
    },
    !p.crianca || pagou.renda ? par('Renda recebida', moeda(pagou.renda)) : null,
    !p.crianca || pagou.consumo ? par('Consumo que pagou', moeda(pagou.consumo)) : null,
    par(`Gasto com ${p.nome}`, moeda(com.total)),
    par('Lançamentos', String(todas.length)),
    todas.length ? h('button', { class: 'botao botao--discreto botao--cheio', type: 'button', onclick: () => estado.verLancamentos({ pessoa: p.nome }) }, `Ver os lançamentos de ${p.nome}`) : null));
  }
  acrescentar(ctx.raiz, h('p', { class: 'nota' }, `Em ${mesPorExtenso(mes)}. "Consumo que pagou" é o que saiu do dinheiro da pessoa; "Gasto com" é o que foi para a pessoa.`));
}

registrar('mais', desenharMais, { aba: 'mais' });
registrar('pendencias', desenharPendencias, { aba: 'mais' });
registrar('pessoas', desenharPessoas, { aba: 'mais' });
