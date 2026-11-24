// Roteador pelo endereco depois do # (#inicio, #lancamentos, #gastos, #contas, #mais, #pendencias, #pessoas).
// Cada tela se registra com registrar(nome, desenhar, { aba, titulo, pai }). `desenhar(ctx)` recebe:
//   ctx.raiz         o <main> onde a tela se desenha
//   ctx.titulo(t)    o titulo do topo
//   ctx.aoLimpar(fn) roda quando a pessoa sai da tela (desligar ouvintes)
//   ctx.ir(nome)     vai para outra tela
// Camadas (folhas inferiores): cada folha aberta ganha uma entrada no historico, para o Voltar do celular FECHAR a folha em vez de sair da
// tela. A trava do aplicativo usa suspender() e ressincronizar() para o aplicativo nao trocar de tela por baixo dela.

const telas = new Map();
let raiz = null;
let casca = null;
let atual = null;            // { nome, limpezas }
let suspenso = false;
let pendente = false;
const camadas = [];          // [{ n, encerrar, aberta }]
let popsEsperados = [];      // quem espera o popstate de um history.back() pedido por nos
let popDoRoteador = false;

export function registrar(nome, desenhar, opcoes = {}) {
  telas.set(nome, { desenhar, aba: opcoes.aba || nome, pai: opcoes.pai || null });
}

function nomeDoEndereco() {
  const bruto = (window.location.hash || '').replace(/^#\/?/, '').split(/[?&/]/)[0];
  return telas.has(bruto) ? bruto : 'inicio';
}

function limparAtual() {
  if (!atual) return;
  for (const fn of atual.limpezas.splice(0)) {
    try { fn(); } catch { /* uma limpeza com defeito nao impede as outras */ }
  }
}

function desenharAtual({ rolarParaCima = true } = {}) {
  if (!raiz) return;
  const nome = nomeDoEndereco();
  const tela = telas.get(nome);
  limparAtual();
  const limpezas = [];
  atual = { nome, limpezas };
  const ctx = {
    raiz,
    titulo: (t) => casca && casca.definirTitulo(t),
    aoLimpar: (fn) => limpezas.push(fn),
    ir,
  };
  raiz.replaceChildren();
  if (casca) {
    casca.marcarAba(tela.aba);
  }
  tela.desenhar(ctx);
  if (rolarParaCima) window.scrollTo(0, 0);
}

/** Vai para a tela `nome`. Se ja estiver nela, desenha de novo (filtros novos, por exemplo). */
export function ir(nome) {
  const alvo = `#${nome}`;
  if (window.location.hash === alvo) desenharAtual();
  else window.location.hash = alvo;
}

/** Desenha de novo a tela atual sem rolar (usado quando os dados mudam). */
export function redesenhar() {
  if (suspenso) { pendente = true; return; }
  desenharAtual({ rolarParaCima: false });
}

export function rotaAtual() {
  return atual ? atual.nome : null;
}

export function iniciar({ raiz: elemento, casca: ganchos }) {
  raiz = elemento;
  casca = ganchos;
  window.addEventListener('hashchange', () => {
    if (suspenso) { pendente = true; return; }
    desenharAtual();
  });
  desenharAtual();
}

// ---------------------------------------------------------------- trava

/** Com a trava na tela o aplicativo por baixo nao troca de tela; a troca pedida espera a liberacao. */
export function suspender(sim) {
  suspenso = Boolean(sim);
}

/** Depois da trava: desenha a tela que o endereco pede, se ela mudou enquanto estava suspenso. */
export function ressincronizar() {
  if (pendente) {
    pendente = false;
    desenharAtual();
  }
}

/** O popstate que esta sendo tratado agora foi provocado pelo proprio roteador (fechando uma folha)? A trava ignora esses. */
export function ultimoPopDoRoteador() {
  return popDoRoteador;
}

// ---------------------------------------------------------------- camadas (folhas)

/**
 * Registra uma camada aberta: `encerrar()` fecha a folha sem mexer no historico (o Voltar do aparelho chama isto).
 * Devolve `liberar()`, que a folha chama quando fecha por conta propria: tira a entrada do historico e espera o navegador acertar.
 */
export function empilharCamada(encerrar) {
  const n = camadas.length + 1;
  const registro = { n, encerrar, aberta: true };
  camadas.push(registro);
  try {
    window.history.pushState({ ...(window.history.state || {}), camada: n }, '', window.location.href);
  } catch {
    /* sem historico gravavel: o Voltar sai da tela, como num site comum */
  }
  return function liberar() {
    if (!registro.aberta) return Promise.resolve();
    registro.aberta = false;
    const i = camadas.indexOf(registro);
    if (i >= 0) camadas.splice(i, 1);
    const estado = window.history.state;
    if (!estado || estado.camada !== n) return Promise.resolve();
    return new Promise((resolve) => {
      popsEsperados.push(resolve);
      window.history.back();
      window.setTimeout(() => {   // navegador que nao avisa: nao deixa ninguem esperando para sempre
        const j = popsEsperados.indexOf(resolve);
        if (j >= 0) { popsEsperados.splice(j, 1); resolve(); }
      }, 600);
    });
  };
}

window.addEventListener('popstate', (ev) => {
  if (popsEsperados.length) {
    const resolve = popsEsperados.shift();
    popDoRoteador = true;
    window.setTimeout(() => { popDoRoteador = false; }, 0);
    resolve();
    return;
  }
  if (suspenso) return;   // a trava cuida do Voltar enquanto esta na tela
  const nivel = (ev.state && Number(ev.state.camada)) || 0;
  while (camadas.length && camadas[camadas.length - 1].n > nivel) {
    const c = camadas.pop();
    c.aberta = false;
    try { c.encerrar(); } catch { /* segue fechando as outras */ }
  }
});
