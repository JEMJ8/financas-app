// Ponto de entrada. Faz tres coisas, nesta ordem:
//   1. aplica o tema e registra o service worker (a casca do aplicativo fica guardada para abrir sem internet);
//   2. confere a configuracao: com os marcadores de config.js ainda la, mostra que falta configurar e nao fala com ninguem;
//   3. sem sessao completa (senha + codigo), mostra a entrada; com sessao e SEM a trava ligada, abre o aplicativo; com sessao e a trava
//      ligada, pede o desbloqueio do celular ANTES de montar qualquer coisa (js/telas/trava.js).
// Abrir o aplicativo = montar a casca, abrir a copia guardada, ligar o roteador e baixar a copia nova em segundo plano.
//
// Modo de demonstracao (js/ensaio.js): so em 127.0.0.1 ou localhost com ?demo=1. Pula a entrada e usa dados inventados (js/demo.js), sem
// nuvem e sem gravar nada. #entrar, #cadastro, #codigo e #trava mostram essas telas para conferencia visual.

import * as auth from './auth.js';
import * as bio from './biometria.js';
import * as dados from './dados.js';
import * as rotas from './rotas.js';
import { configurado, politicaConfere } from './api.js';
import { montarCasca } from './casca.js';
import { aplicarTema } from './tema.js';
import { modoDemo, opcoesDoEnsaio } from './ensaio.js';
import { h, preencher } from './ui.js';
import { icone } from './icones.js';
import { VERSAO_APP } from './versao.js';

// ---- as telas (cada arquivo se registra no roteador ao ser importado) ----
import './telas/inicio.js';
import './telas/lancamentos.js';
import './telas/gastos.js';
import './telas/contas.js';
import './telas/mais.js';
import { montarEntrada } from './telas/entrada.js';
import * as trava from './telas/trava.js';

const conteudo = document.getElementById('conteudo');
let aberto = false;

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Versao nova publicada: o service worker novo assume sozinho. So recarrega na entrada, sem nada digitado e sem trava na tela.
  const tinhaControlador = Boolean(navigator.serviceWorker.controller);
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControlador || aberto || recarregou || bio.ocupado() || trava.emTela()) return;
    if ([...document.querySelectorAll('input')].some((campo) => campo.value)) return;
    recarregou = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem service worker o aplicativo funciona igual, so nao abre sem internet */ });
}

/** Tela de aviso sem casca (falta configurar, endereco que nao bate): mesma cabeca da entrada. */
function telaDeAviso(titulo, ...paragrafos) {
  conteudo.classList.add('sem-barra', 'conteudo--entrada');
  preencher(conteudo, h('div', { class: 'entrada-tela' }, h('div', { class: 'entrada-cartao' },
    h('header', { class: 'entrada-hero' },
      h('div', { class: 'entrada-icone', 'aria-hidden': 'true' }, icone('barras', { tamanho: 34 })),
      h('h1', { class: 'entrada-titulo' }, 'Finanças da casa'),
      h('p', { class: 'entrada-sub' }, 'Consulta pelo celular. Tudo se edita no computador.')),
    h('div', { class: 'entrada-folha' }, h('div', { class: 'aviso-tela' },
      h('div', { class: 'entrada-aviso entrada-aviso--atencao', role: 'alert' }, icone('alerta'), h('span', null, titulo)),
      ...paragrafos.map((p) => h('p', { class: 'entrada-passo-texto' }, p)),
      h('p', { class: 'entrada-rodape' }, icone('cadeado', { tamanho: 16 }), `Versão ${VERSAO_APP}`))))));
}

async function abrirAplicativo() {
  if (aberto) return;
  aberto = true;
  const demo = dados.estado().demo;
  if (!demo) {
    trava.vigiar();                       // PRIMEIRA coisa: o vigia da trava precisa existir antes de qualquer espera
    auth.pedirArmazenamentoDuravel();
  }
  conteudo.replaceChildren();
  conteudo.classList.remove('conteudo--entrada', 'sem-barra');
  const casca = montarCasca();
  await dados.iniciar();
  if (!demo) auth.iniciarRenovacao();
  rotas.iniciar({ raiz: conteudo, casca: casca.ganchos });
  let versaoVista = dados.versao();
  dados.aoMudar(() => {
    const v = dados.versao();
    if (v !== versaoVista || !dados.estado().carregado) {
      versaoVista = v;
      rotas.redesenhar();
    }
  });
  if (demo) return;
  dados.atualizar();   // em segundo plano: a tela ja abriu com a copia guardada
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') dados.atualizarSeVelho();
  });
  window.addEventListener('online', () => { dados.atualizar(); });
  // sessao que acabou de verdade (login recusado na renovacao, Sair em outra janela): volta ao login
  auth.aoMudar(({ tipo, motivo }) => {
    if (tipo === 'perdida' && motivo !== 'saiu' && motivo !== 'cancelou') window.location.replace(window.location.pathname);
  });
}

function mostrarEntrada(opcoes = {}) {
  aplicarTema();
  conteudo.classList.add('sem-barra', 'conteudo--entrada');
  montarEntrada(conteudo, { aoConcluir: abrirAplicativo, ...opcoes });
}

function pedirTrava() {
  trava.pedir({ modo: 'frio', aoLiberar: abrirAplicativo, aoSenha: irParaSenha });
}

function irParaSenha() {
  trava.fechar();
  mostrarEntrada({ daTrava: { aoVoltar: voltarAoDesbloqueio } });
}

function voltarAoDesbloqueio() {
  conteudo.replaceChildren();
  pedirTrava();
}

// ---------------------------------------------------------------- demonstracao

const TELAS_DA_DEMONSTRACAO = { entrar: 'senha', cadastro: 'cadastro', codigo: 'codigo' };

async function iniciarDemonstracao() {
  const pedido = (window.location.hash || '').replace(/^#\/?/, '');
  if (TELAS_DA_DEMONSTRACAO[pedido]) {
    mostrarEntrada({ demonstracao: TELAS_DA_DEMONSTRACAO[pedido] });
    return;
  }
  if (pedido === 'trava') {
    trava.pedir({
      modo: 'frio',
      ensaio: true,
      aoLiberar: () => {},
      aoSenha: () => { trava.fechar(); mostrarEntrada({ demonstracao: 'senha' }); },
    });
    return;
  }
  const { criarDemonstracao } = await import('./demo.js');
  const opcoes = opcoesDoEnsaio();
  dados.usarDemonstracao(criarDemonstracao({ velho: opcoes.velho }), { offline: opcoes.offline });
  await abrirAplicativo();
}

// ---------------------------------------------------------------- inicio

async function iniciar() {
  window.__financasIniciou = true;   // js/inicio.js confere: se isto nao chegar a rodar, ele mostra o aviso com o botao Recarregar
  aplicarTema();
  if (modoDemo()) {
    await iniciarDemonstracao();
    return;
  }
  registrarServiceWorker();
  if (!configurado()) {
    telaDeAviso('Falta ligar o aplicativo à nuvem.',
      'O arquivo config.js ainda está com os marcadores no lugar do endereço do projeto e da chave pública.',
      'Quem instalou o aplicativo precisa preencher esses dois valores e pôr o mesmo endereço na política de segurança do index.html.',
      'Enquanto isso, o aplicativo não lê nenhum dado e não envia nada.');
    return;
  }
  if (!politicaConfere()) {
    telaDeAviso('O endereço da nuvem não confere.',
      'O endereço que está em config.js não é o mesmo que a política de segurança do index.html deixa o aplicativo chamar.',
      'Quem instalou o aplicativo precisa pôr o mesmo endereço nos dois lugares. Sem isso, toda tentativa pareceria falta de internet.');
    return;
  }
  if (!auth.temSessaoCompleta()) {
    trava.consumirPedidoDeSenha();
    mostrarEntrada();
    return;
  }
  if (!auth.biometriaLigada()) {
    trava.consumirPedidoDeSenha();
    await abrirAplicativo();
    return;
  }
  if (trava.consumirPedidoDeSenha()) irParaSenha();
  else pedirTrava();
}

iniciar();
