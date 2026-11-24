// Tela de entrada: e-mail e senha, depois o codigo de 6 numeros do aplicativo autenticador. Veio do aplicativo do Gestao JEMJ.
// No primeiro acesso mostra o passo a passo para cadastrar o autenticador NO MESMO CELULAR: copiar a chave e colar no aplicativo (o QR so serve
// para quem esta no computador). Se a pagina recarregar no meio (a pessoa foi ao autenticador e voltou), a entrada continua de onde parou.
// Nao e uma rota: app.js a desenha no lugar do aplicativo enquanto nao houver sessao completa (senha + codigo).
// Diferenca para o Gestao: aqui nao ha oferta da trava depois do codigo. A trava comeca desligada e so e ligada em Mais.
// A tela de senha tambem e usada pela trava (daTrava): a pessoa tocou em "Entrar com senha e código" e pode voltar ao desbloqueio.

import { h, preencher, novoId, focar, copiarTexto, esperar, anunciar, linkExterno } from '../ui.js';
import { icone } from '../icones.js';
import * as auth from '../auth.js';
import { VERSAO_APP } from '../versao.js';

const NOME = 'Finanças da casa';

// 'ios', 'android', 'celular' (outro celular) ou 'outro' (computador). Serve so para escolher o texto certo, nunca para liberar nada.
export function plataforma() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  const toque = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
  return toque && Math.min(window.screen.width, window.screen.height) < 820 ? 'celular' : 'outro';
}

const LOJAS = {
  android: [
    { nome: 'Google Authenticator', url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2' },
    { nome: 'Microsoft Authenticator', url: 'https://play.google.com/store/apps/details?id=com.azure.authenticator' },
  ],
  ios: [
    { nome: 'Google Authenticator', url: 'https://apps.apple.com/br/app/google-authenticator/id388497605' },
    { nome: 'Microsoft Authenticator', url: 'https://apps.apple.com/br/app/microsoft-authenticator/id983156458' },
  ],
};

const AVISO_CHAVE_NOVA = `A chave anterior perdeu a validade e uma chave nova foi gerada. Se você já tinha adicionado "${NOME}" no autenticador, apague essa entrada antiga e adicione a nova.`;
const SENHA_INTERNET = 'Entrar com a senha precisa de internet.';
const VOLTAR_AO_DESBLOQUEIO = 'Voltar ao desbloqueio';
const CODIGO_OUTRA_CONTA = 'Se tocar em Usar outra conta, a trava do aplicativo é desligada neste celular e você entra de novo com senha e código.';

// Os nomes dos botoes dos aplicativos mudam de versao para versao: o texto descreve a funcao e traz o nome entre aspas como pista.
const GUIAS = [
  {
    id: 'google', nome: 'Google',
    passos: [
      'Abra o Google Authenticator e toque no botão +.',
      'Escolha a opção de inserir a chave à mão, que pode se chamar "Inserir uma chave de configuração".',
      `Em "Nome da conta", escreva ${NOME}.`,
      'Em "Sua chave", cole a chave que você copiou.',
      'Se pedir o tipo, deixe "Baseada no tempo" e toque em Adicionar.',
    ],
  },
  {
    id: 'microsoft', nome: 'Microsoft',
    passos: [
      'Abra o Microsoft Authenticator e toque no botão + (Adicionar conta).',
      'Escolha "Outra conta (Google, Facebook etc.)".',
      'Na tela da câmera, que você não precisa usar, toque em "Ou insira o código manualmente". Aqui, "código" quer dizer a chave que você copiou.',
      `No campo do nome, escreva ${NOME}. No campo da chave, cole a chave que você copiou.`,
      'Toque em Concluir.',
    ],
  },
  {
    id: 'outro', nome: 'Outro',
    passos: [
      'No seu autenticador, procure uma opção como "inserir chave" ou "adicionar manualmente".',
      'Se pedir o tipo, escolha "baseada no tempo" (em alguns aplicativos aparece como TOTP).',
      `Dê o nome ${NOME}, cole a chave e salve.`,
    ],
  },
];

/** O endereco otpauth:// que tenta abrir o autenticador no proprio aparelho. Qualquer outra coisa vira null (o atalho nem aparece). */
export function enderecoDoAutenticador(uri) {
  const texto = String(uri || '').trim();
  const prefixo = 'otpauth://totp/';
  const corpoLimpo = texto.length > prefixo.length && texto.startsWith(prefixo) && !/[\s\x22\x27<>]/.test(texto);
  return corpoLimpo && /[?&]secret=[A-Za-z2-7]+/.test(texto) ? texto : null;
}

let conviteDeInstalacao = null;
const ouvintesDoConvite = new Set();
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  conviteDeInstalacao = ev;
  for (const fn of [...ouvintesDoConvite]) fn();
});
window.addEventListener('appinstalled', () => {
  conviteDeInstalacao = null;
  for (const fn of [...ouvintesDoConvite]) fn();
});

function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function agrupar(segredo) {
  return segredo.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

// ---------------------------------------------------------------- pecas de tela

function botao(rotulo, { nome = null, classes = [], tipo = 'button', aoClicar = null } = {}) {
  const el = h('button', { class: ['botao', ...classes], type: tipo }, nome ? icone(nome) : null, rotulo);
  if (aoClicar) el.addEventListener('click', aoClicar);
  return el;
}

/** Troca o conteudo do botao por "girando + texto" enquanto trabalha e devolve o que havia depois. */
function ocupado(el, sim, rotulo) {
  if (sim) {
    el.guardado = [...el.childNodes];
    el.setAttribute('aria-busy', 'true');
    preencher(el, icone('atualizar', { classe: 'botao-giro' }), rotulo);
  } else if (el.guardado) {
    preencher(el, ...el.guardado);
    el.removeAttribute('aria-busy');
  }
}

/** Liga o envio do formulario: trava o botao, mostra a mensagem de erro e devolve o foco. */
function ligar(formulario, el, rotuloOcupado, areaDeErro, trabalho, tambem = []) {
  formulario.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (el.disabled) return;
    el.disabled = true;
    for (const outro of tambem) outro.disabled = true;
    ocupado(el, true, rotuloOcupado);
    areaDeErro.hidden = true;
    areaDeErro.textContent = '';
    try {
      await trabalho();
    } catch (erro) {
      if (erro && erro.codigo === 'cancelado') return;
      areaDeErro.textContent = erro && erro.mensagemParaTela ? erro.mensagemParaTela : 'Não foi possível continuar. Tente de novo.';
      areaDeErro.hidden = false;
    } finally {
      el.disabled = false;
      for (const outro of tambem) outro.disabled = false;
      ocupado(el, false);
      if (formulario.isConnected && (!document.activeElement || document.activeElement === document.body)) focar(el);
    }
  });
}

function campoComIcone(nomeDoIcone, entrada, ...extras) {
  return h('div', { class: ['entrada-com-icone', ...(extras.length ? ['entrada-com-botao'] : [])] }, icone(nomeDoIcone, { tamanho: 20 }), entrada, ...extras);
}

/**
 * As seis caixas do codigo. Por baixo existe UM campo de texto de verdade (teclado numerico, colar, leitor de tela), transparente; as caixas
 * so mostram o que foi digitado. `aoCompletar()` roda quando chegam os 6 numeros (o teclado numerico do iPhone nao tem Enter).
 */
function campoDoCodigo(idCodigo, idDica, idErro, { aoMudar = () => {}, aoCompletar = () => {} } = {}) {
  const campo = h('input', {
    id: idCodigo, class: 'otp-campo', type: 'text', name: 'otp', inputmode: 'numeric', pattern: '[0-9]*',
    autocomplete: 'one-time-code', required: true, autocapitalize: 'off', spellcheck: 'false',
    'aria-describedby': `${idDica} ${idErro}`,
  });
  const casas = Array.from({ length: 6 }, () => h('div', { class: 'otp-casa', 'aria-hidden': 'true' }));
  const caixa = h('div', { class: 'otp' }, ...casas, campo);
  const pintar = () => {
    const valor = campo.value;
    casas.forEach((casa, i) => {
      casa.textContent = valor[i] || '';
      casa.classList.toggle('otp-casa--ativa', document.activeElement === campo && i === Math.min(valor.length, 5));
    });
  };
  const fimDoTexto = () => {
    try { campo.setSelectionRange(campo.value.length, campo.value.length); } catch { /* alguns teclados nao deixam */ }
    pintar();
  };
  campo.addEventListener('input', () => {
    campo.value = campo.value.replace(/\D/g, '').slice(0, 6);
    caixa.classList.remove('otp--erro');
    pintar();
    aoMudar();
    if (campo.value.length === 6) aoCompletar();
  });
  campo.addEventListener('paste', (ev) => {
    const digitos = String((ev.clipboardData && ev.clipboardData.getData('text')) || '').replace(/\D/g, '');
    if (digitos.length < 6) return;
    ev.preventDefault();
    campo.value = digitos.slice(0, 6);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (const nome of ['focus', 'blur', 'click', 'select', 'keyup']) campo.addEventListener(nome, fimDoTexto);
  return {
    caixa,
    campo,
    limpar() { campo.value = ''; pintar(); },
    marcarErro() {
      caixa.classList.remove('otp--erro');
      void caixa.offsetWidth;
      caixa.classList.add('otp--erro');
    },
  };
}

function esqueleto(raiz) {
  const hero = h('header', { class: 'entrada-hero' },
    h('div', { class: 'entrada-icone', 'aria-hidden': 'true' }, icone('barras', { tamanho: 34 })),
    h('h1', { class: 'entrada-titulo' }, NOME),
    h('p', { class: 'entrada-sub' }, 'Consulta pelo celular. Tudo se edita no computador.'));
  const folha = h('div', { class: 'entrada-folha' });
  preencher(raiz, h('div', { class: 'entrada-tela' }, h('div', { class: 'entrada-cartao' }, hero, folha)));
  return folha;
}

function rodape() {
  return h('p', { class: 'entrada-rodape' }, icone('cadeado', { tamanho: 16 }), `Acesso restrito · Versão ${VERSAO_APP}`);
}

function cartaoDePasso(numero, titulo, ...filhos) {
  return h('section', { class: 'passo-cartao' },
    h('div', { class: 'passo-cartao-cabeca' }, h('span', { class: 'passo-numero', 'aria-hidden': 'true' }, String(numero)), h('h2', { class: 'passo-titulo' }, titulo)),
    ...filhos);
}

function guiaDoAutenticador() {
  const lista = h('ol', { class: 'entrada-lista-passos', 'aria-live': 'polite' });
  const botoes = GUIAS.map((guia) => h('button', { class: 'entrada-aba', type: 'button', 'aria-pressed': 'false' }, guia.nome));
  const escolher = (id) => {
    GUIAS.forEach((guia, i) => botoes[i].setAttribute('aria-pressed', String(guia.id === id)));
    preencher(lista, ...GUIAS.find((guia) => guia.id === id).passos.map((passo) => h('li', null, passo)));
  };
  botoes.forEach((b, i) => b.addEventListener('click', () => escolher(GUIAS[i].id)));
  escolher(GUIAS[0].id);
  return h('div', { class: 'entrada-guia' },
    h('div', { class: 'entrada-abas', role: 'group', 'aria-label': 'Qual aplicativo autenticador você usa' }, ...botoes),
    lista,
    h('p', { class: 'passo-texto' }, 'Os nomes dos botões podem ser um pouco diferentes no seu celular. Se não achar o nome igual, procure a opção parecida.'),
    h('p', { class: 'passo-texto' }, 'Quando terminar, o autenticador mostra um código de 6 números. Volte para esta tela e digite esse código no passo 4.'));
}

/** Como colocar o aplicativo na tela inicial: botao de instalar quando o navegador oferece, passo a passo quando nao. */
function blocoDeInstalacao() {
  const onde = plataforma();
  if (onde === 'outro' || jaInstalado()) return null;
  const caixa = h('div', { class: 'entrada-instalar' });
  const desenhar = () => {
    if (!caixa.isConnected && caixa.dataset.pronto) { ouvintesDoConvite.delete(desenhar); return; }
    caixa.dataset.pronto = '1';
    if (jaInstalado()) { preencher(caixa); return; }
    if (caixa.querySelector('details[open]')) return;
    if (conviteDeInstalacao) {
      const instalar = botao('Instalar na tela inicial', { nome: 'baixar', classes: ['botao--cheio'] });
      instalar.addEventListener('click', async () => {
        const convite = conviteDeInstalacao;
        conviteDeInstalacao = null;
        try { await convite.prompt(); } catch { /* o navegador pode recusar */ }
        desenhar();
      });
      preencher(caixa, instalar);
      return;
    }
    const passos = onde === 'ios'
      ? [h('li', null, 'Toque em Compartilhar ', icone('compartilhar', { tamanho: 16 }), ', na barra do Safari.'), h('li', null, 'Escolha "Adicionar à Tela de Início".'), h('li', null, 'Toque em Adicionar.')]
      : [h('li', null, 'Toque nos três pontinhos do navegador, no canto de cima.'), h('li', null, 'Escolha "Instalar aplicativo" ou "Adicionar à tela inicial".'), h('li', null, 'Confirme em Instalar.')];
    preencher(caixa,
      h('details', { class: 'entrada-detalhes' },
        h('summary', { class: 'botao botao--cheio' }, icone('celular'), 'Colocar na tela inicial'),
        h('ol', { class: 'entrada-lista-passos' }, ...passos),
        h('p', { class: 'passo-texto' }, `Assim o ${NOME} ganha um ícone na tela inicial e abre como um aplicativo, sem a barra do navegador.`)));
  };
  ouvintesDoConvite.add(desenhar);
  desenhar();
  return caixa;
}

// ---------------------------------------------------------------- a tela

/**
 * Desenha a entrada em `raiz`. `aoConcluir()` e chamada quando a sessao completa (aal2) estiver guardada.
 * `daTrava` ({ aoVoltar }): a pessoa veio da trava e pode voltar ao desbloqueio.
 * `demonstracao` ('senha' | 'cadastro' | 'codigo'): so no modo de demonstracao, desenha o passo pedido sem falar com a nuvem.
 */
export function montarEntrada(raiz, { aoConcluir, daTrava = null, demonstracao = null }) {
  document.title = `Entrar · ${NOME}`;
  const folha = esqueleto(raiz);
  const noCelular = plataforma() !== 'outro';

  function mostrar(aviso, ...filhos) {
    const passo = h('div', { class: 'entrada-passo' }, ...filhos, rodape());
    preencher(folha, passo);
    window.scrollTo(0, 0);
    const titulo = folha.querySelector('.entrada-passo-titulo');
    if (titulo) {
      titulo.setAttribute('tabindex', '-1');
      if (!demonstracao) focar(titulo);
    }
    if (aviso) anunciar(aviso);
    return passo;
  }

  async function sucesso(primeiraVez) {
    for (const filho of [...raiz.children]) {
      filho.inert = true;
      filho.setAttribute('aria-hidden', 'true');
    }
    raiz.appendChild(h('div', { class: 'entrada-sucesso', role: 'status' },
      h('div', { class: 'entrada-sucesso-bola' }, icone('check', { tamanho: 44 })),
      h('span', null, 'Tudo certo. Abrindo…'),
      primeiraVez ? h('p', { class: 'entrada-sucesso-nota' }, `Da próxima vez, depois da senha, o ${NOME} vai pedir o código do seu autenticador.`) : null));
    anunciar('Tudo certo. Abrindo.');
    await esperar(primeiraVez ? 1800 : 650);
    aoConcluir();
  }

  // ---------------------------------------------------------------- passo 1: e-mail e senha
  function telaDeSenha(avisoInicial = '', { daTrava: vindoDaTrava = null } = {}) {
    const idEmail = novoId('email');
    const idSenha = novoId('senha');
    const idErro = novoId('erro');
    const email = h('input', { id: idEmail, class: 'entrada', type: 'email', name: 'email', autocomplete: 'username', inputmode: 'email', required: true, autocapitalize: 'none', spellcheck: 'false', 'aria-describedby': idErro });
    const senha = h('input', { id: idSenha, class: 'entrada', type: 'password', name: 'password', autocomplete: 'current-password', required: true, autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', 'aria-describedby': idErro });
    const olho = h('button', { class: 'entrada-botao', type: 'button', 'aria-label': 'Mostrar a senha', 'aria-pressed': 'false' }, icone('olho', { tamanho: 22 }));
    const mostrarOuEsconder = (mostrar) => {
      senha.type = mostrar ? 'text' : 'password';
      olho.setAttribute('aria-pressed', String(mostrar));
      preencher(olho, icone(mostrar ? 'olhoRisco' : 'olho', { tamanho: 22 }));
    };
    const esconderSenha = () => { if (senha.type !== 'password') mostrarOuEsconder(false); };
    olho.addEventListener('click', () => mostrarOuEsconder(senha.type === 'password'));
    const aoMudarDeAba = () => {
      if (!formulario.isConnected) document.removeEventListener('visibilitychange', aoMudarDeAba);
      else if (document.visibilityState === 'hidden') esconderSenha();
    };
    const erro = h('p', { class: 'campo-erro', id: idErro, role: 'alert', hidden: true });
    if (avisoInicial) { erro.textContent = avisoInicial; erro.hidden = false; }
    const entrar = botao('Entrar', { classes: ['botao--primario', 'botao--grande', 'botao--cheio'], tipo: 'submit' });
    entrar.append(icone('avancar'));
    const voltarAoDesbloqueio = vindoDaTrava && typeof vindoDaTrava.aoVoltar === 'function'
      ? botao(VOLTAR_AO_DESBLOQUEIO, { classes: ['botao--discreto', 'botao--cheio'], aoClicar: () => vindoDaTrava.aoVoltar() })
      : null;
    const formulario = h('form', { class: 'entrada-formulario', novalidate: true },
      h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo', for: idEmail }, 'E-mail'), campoComIcone('email', email)),
      h('div', { class: 'campo' }, h('label', { class: 'campo-rotulo', for: idSenha }, 'Senha'), campoComIcone('cadeado', senha, olho)),
      erro,
      entrar,
      voltarAoDesbloqueio ? h('p', { class: 'entrada-nota' }, SENHA_INTERNET) : null,
      voltarAoDesbloqueio);
    formulario.addEventListener('submit', esconderSenha);
    document.addEventListener('visibilitychange', aoMudarDeAba);
    ligar(formulario, entrar, 'Entrando…', erro, async () => {
      if (demonstracao) throw Object.assign(new Error('demonstracao'), { mensagemParaTela: 'Esta é uma demonstração com dados inventados: não há conta para entrar.' });
      if (!email.value.trim() || !senha.value) {
        throw Object.assign(new Error('faltam dados'), { mensagemParaTela: 'Preencha o e-mail e a senha.' });
      }
      let proximo;
      try {
        proximo = await auth.entrar(email.value, senha.value);
      } catch (e) {
        throw Object.assign(e, { mensagemParaTela: auth.mensagemDeEntrada(e, 'senha') });
      }
      if (proximo.passo === 'codigo') {
        senha.value = '';
        telaDeCodigo({ cadastro: null });
      } else {
        await telaDeCadastro();
        senha.value = '';
      }
    }, voltarAoDesbloqueio ? [voltarAoDesbloqueio] : []);
    mostrar('',
      h('div', null, h('h2', { class: 'entrada-passo-titulo' }, 'Entrar'), h('p', { class: 'entrada-passo-texto' }, 'Use o e-mail e a senha do seu acesso.')),
      formulario,
      h('div', { class: 'entrada-aviso' }, icone('escudo'), h('span', null, `Acesso protegido. Depois da senha, o ${NOME} pede um código de 6 números, gerado por um aplicativo autenticador no seu celular.`)),
      blocoDeInstalacao());
    if (!noCelular && !demonstracao) focar(email);
  }

  // ---------------------------------------------------------------- passo 2a: primeiro acesso, cadastrar o autenticador
  async function telaDeCadastro(aviso = '') {
    let dadosDoFator;
    try {
      dadosDoFator = await auth.iniciarCadastro();
    } catch (e) {
      if (e && e.codigo === 'cancelado') throw e;
      const semConexaoOuMuitasTentativas = e && (e.rede || e.status === 429);
      throw Object.assign(e, {
        mensagemParaTela: semConexaoOuMuitasTentativas
          ? auth.mensagemDeEntrada(e, 'senha')
          : 'Sua senha está certa, mas não foi possível preparar o código de segurança agora. Espere um instante e toque em Entrar de novo.',
      });
    }
    telaDeCodigo({ cadastro: dadosDoFator, aviso: aviso || (dadosDoFator.substituiu ? AVISO_CHAVE_NOVA : '') });
  }

  function cartoesDoCadastro(cadastro) {
    const onde = plataforma();
    const lojas = (LOJAS[onde] || []).map((loja) => linkExterno(loja.url, [icone('baixar'), loja.nome], { class: 'botao botao--cheio' })).filter(Boolean);
    const cartaoUm = cartaoDePasso(1, 'Tenha um aplicativo autenticador',
      h('p', { class: 'passo-texto' }, onde === 'outro'
        ? 'No seu celular, instale o Google Authenticator ou o Microsoft Authenticator. É um aplicativo que mostra um código de 6 números, e o código muda sozinho. Se você já tem um autenticador no celular, vá para o passo 2.'
        : 'É um aplicativo que mostra um código de 6 números, e o código muda sozinho. É a segunda proteção da sua conta, depois da senha. Se você já tem um autenticador, vá para o passo 2.'
          + (lojas.length ? ' Se não tem, toque em um dos botões abaixo para abrir a loja.' : ' Se não tem, procure o Google Authenticator ou o Microsoft Authenticator na loja do seu celular.')),
      lojas.length ? h('div', { class: 'passo-acoes' }, ...lojas) : null);

    const botaoDeCopiar = botao('Copiar chave', { nome: 'copiar', classes: ['botao--cheio'] });
    botaoDeCopiar.addEventListener('click', async () => {
      const ok = await copiarTexto(cadastro.segredo);
      preencher(botaoDeCopiar, icone(ok ? 'check' : 'info'), ok ? 'Chave copiada' : 'Selecione a chave abaixo e copie');
      anunciar(ok ? 'Chave copiada' : 'Não foi possível copiar. Selecione a chave e copie.');
    });
    const chave = h('div', { class: 'entrada-chave-caixa' },
      h('p', { class: 'campo-rotulo' }, 'Chave para o autenticador'),
      h('p', { class: 'entrada-chave' }, agrupar(cadastro.segredo)));
    const imagem = cadastro.qrSvg
      ? h('div', { class: 'entrada-qr-bloco' },
        h('div', { class: 'entrada-qr-caixa' }, h('img', { class: 'entrada-qr', alt: 'QR code para cadastrar o aplicativo autenticador', width: 200, height: 200, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cadastro.qrSvg)}` })),
        h('p', { class: 'passo-texto' }, 'No autenticador, toque em + e escolha a opção de ler ou escanear o código QR. Depois aponte a câmera para o quadrado acima.'))
      : null;
    const avisoDaChave = h('p', { class: 'passo-texto' }, 'Esta chave é só sua: não envie a ninguém. Depois de colar no autenticador, apague a cópia do histórico do teclado, se houver.');

    if (onde === 'outro') {
      const cartaoDois = cartaoDePasso(2, 'Escaneie o QR com o celular',
        imagem || h('p', { class: 'passo-texto' }, 'O QR não carregou. Abra "Mostrar a chave", logo abaixo.'),
        h('details', { class: 'entrada-detalhes' },
          h('summary', { class: 'botao botao--discreto botao--cheio' }, icone('chave'), 'Não consegue ler? Mostrar a chave'),
          h('div', { class: 'passo-acoes' }, chave, avisoDaChave, botaoDeCopiar)));
      return [cartaoUm, cartaoDois];
    }
    const enderecoAbrir = onde === 'android' ? enderecoDoAutenticador(cadastro.uri) : null;
    botaoDeCopiar.classList.add('botao--primario', 'botao--grande');
    const cartaoDois = cartaoDePasso(2, 'Copie a chave',
      h('p', { class: 'passo-texto' }, 'Toque em "Copiar chave". Depois, leia o passo 3 e abra o autenticador. Você pode sair desta tela e voltar em até 15 minutos; depois disso será preciso copiar uma chave nova.'),
      botaoDeCopiar,
      chave,
      avisoDaChave,
      enderecoAbrir
        ? h('div', { class: 'passo-acoes' },
          h('a', { class: 'botao botao--discreto botao--cheio', href: enderecoAbrir }, icone('celular'), 'Tentar abrir direto no autenticador'),
          h('p', { class: 'passo-texto' }, 'Se nada acontecer, ou o aplicativo abrir e não adicionar a conta, use a chave acima.'))
        : null,
      imagem
        ? h('details', { class: 'entrada-detalhes' },
          h('summary', { class: 'botao botao--discreto botao--cheio' }, icone('qr'), 'Escanear QR com outro aparelho'),
          imagem)
        : null);
    const cartaoTres = cartaoDePasso(3, 'Cole a chave no autenticador', guiaDoAutenticador());
    return [cartaoUm, cartaoDois, cartaoTres];
  }

  // ---------------------------------------------------------------- passo 2b / 3: o codigo de 6 numeros
  function telaDeCodigo({ cadastro, aviso = '' }) {
    const idCodigo = novoId('codigo');
    const idDica = novoId('dica');
    const idErro = novoId('erro');
    const erro = h('p', { class: 'campo-erro', id: idErro, role: 'alert', hidden: true });
    const codigo = campoDoCodigo(idCodigo, idDica, idErro, {
      aoMudar: () => { erro.hidden = true; },
      aoCompletar: () => formulario.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    });
    const confirmar = botao(cadastro ? 'Confirmar e entrar' : 'Entrar', { classes: ['botao--primario', 'botao--grande', 'botao--cheio'], tipo: 'submit' });
    confirmar.append(icone('avancar'));
    const voltar = botao('Usar outra conta', { nome: 'voltar', classes: ['botao--discreto', 'botao--cheio'], aoClicar: () => { if (!demonstracao) auth.cancelarEntrada(); telaDeSenha(); } });
    const numeroDoCartao = cadastro ? (plataforma() === 'outro' ? 3 : 4) : null;
    const formulario = h('form', { class: 'entrada-formulario', novalidate: true },
      h('div', { class: 'campo' },
        h('label', { class: 'campo-rotulo', for: idCodigo }, cadastro ? `${numeroDoCartao}. Digite o código que o autenticador mostra para ${NOME}` : 'Código do autenticador'),
        codigo.caixa,
        h('span', { class: 'otp-dica', id: idDica }, 'São 6 números e eles mudam sozinhos. Se mudarem enquanto você digita, use os novos. Se der erro, confira se a data e a hora do celular estão no automático.')),
      erro,
      confirmar);
    ligar(formulario, confirmar, 'Conferindo…', erro, async () => {
      if (codigo.campo.value.length !== 6) {
        codigo.marcarErro();
        focar(codigo.campo);
        throw Object.assign(new Error('codigo curto'), { mensagemParaTela: 'Digite os 6 números do código.' });
      }
      if (demonstracao) throw Object.assign(new Error('demonstracao'), { mensagemParaTela: 'Esta é uma demonstração com dados inventados: o código não é conferido.' });
      try {
        await auth.verificarCodigo(codigo.campo.value);
      } catch (e) {
        if (e && e.codigo === 'cancelado') throw e;
        if (!auth.nivelAtual()) {
          telaDeSenha('Sua sessão acabou. Entre de novo com o e-mail e a senha.');
          return;
        }
        if (e && e.codigo === 'fator_sumiu') {
          if (cadastro) {
            await telaDeCadastro(AVISO_CHAVE_NOVA);
          } else {
            auth.cancelarEntrada();
            telaDeSenha('Não encontramos o seu autenticador na conta. Entre de novo com a senha para cadastrar outro.');
          }
          return;
        }
        if (e && !e.rede && (e.status === 400 || e.status === 422)) codigo.limpar();
        codigo.marcarErro();
        focar(codigo.campo);
        throw Object.assign(e, { mensagemParaTela: auth.mensagemDeEntrada(e, cadastro ? 'cadastro' : 'codigo') });
      }
      await sucesso(Boolean(cadastro));
    }, [voltar]);

    const notaDaOutraConta = !demonstracao && auth.biometriaLigada() ? h('p', { class: 'entrada-nota' }, CODIGO_OUTRA_CONTA) : null;

    if (cadastro) {
      mostrar(aviso,
        h('div', { class: 'entrada-aviso entrada-aviso--ok' }, icone('check'), h('span', null, `Senha confirmada. Falta uma etapa de segurança: ligar o ${NOME} a um aplicativo autenticador.`)),
        h('div', null, h('h2', { class: 'entrada-passo-titulo' }, 'Proteja seu acesso'), h('p', { class: 'entrada-passo-texto' }, 'Você faz isso só na primeira vez. Nas próximas entradas, depois da senha, você digita o código do autenticador.')),
        aviso ? h('div', { class: 'entrada-aviso entrada-aviso--atencao', role: 'status' }, icone('alerta'), h('span', null, aviso)) : null,
        ...cartoesDoCadastro(cadastro),
        h('section', { class: 'passo-cartao' }, formulario),
        notaDaOutraConta,
        voltar);
    } else {
      mostrar('',
        h('div', null, h('h2', { class: 'entrada-passo-titulo' }, 'Código de segurança'), h('p', { class: 'entrada-passo-texto' }, `Abra o seu autenticador e digite o código que ele mostra para ${NOME}.`)),
        formulario,
        notaDaOutraConta,
        voltar);
      if (!demonstracao) focar(codigo.campo);
    }
  }

  if (demonstracao === 'cadastro') {
    // chave de exemplo publica (nao e de ninguem) so para mostrar a tela
    telaDeCodigo({ cadastro: { segredo: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', qrSvg: '', uri: '' } });
    return;
  }
  if (demonstracao === 'codigo') {
    telaDeCodigo({ cadastro: null });
    return;
  }
  if (demonstracao) {
    telaDeSenha();
    return;
  }
  // Pagina recarregada no meio da entrada (a pessoa foi ao autenticador e voltou): continua de onde parou, sem pedir a senha de novo.
  const retomada = auth.retomarEntrada();
  if (retomada) telaDeCodigo({ cadastro: retomada.passo === 'cadastro' ? retomada.cadastro : null });
  else telaDeSenha('', { daTrava });
}
