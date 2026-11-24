// Service worker: guarda SO a casca do aplicativo (HTML, CSS, JS, icones) para ele abrir sem internet.
// Nao guarda nem intercepta nada que nao seja da casca: dados (/rest), login (/auth) e qualquer pedido para outro endereco passam direto,
// sem este arquivo ver o conteudo. A copia dos dados fica no IndexedDB (js/idb.js), nunca aqui.
//
// A cada publicacao: mude VERSAO aqui E em js/versao.js, e confira a lista ARQUIVOS (tem de ter todos os arquivos da pasta).

const VERSAO = '1.0.0';
const PREFIXO = 'financas-casa-casca-';
const CACHE = `${PREFIXO}${VERSAO}`;

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'config.js',
  'css/tokens.css',
  'css/base.css',
  'css/componentes.css',
  'css/entrada.css',
  'css/trava.css',
  'css/telas.css',
  'img/apple-touch-icon.png',
  'img/favicon-32.png',
  'img/icone-192.png',
  'img/icone-512.png',
  'img/icone-maskable-192.png',
  'img/icone-maskable-512.png',
  'js/inicio.js',
  'js/app.js',
  'js/api.js',
  'js/auth.js',
  'js/biometria.js',
  'js/calculos.js',
  'js/casca.js',
  'js/dados.js',
  'js/datas.js',
  'js/demo.js',
  'js/ensaio.js',
  'js/estado.js',
  'js/folha.js',
  'js/formato.js',
  'js/icones.js',
  'js/idb.js',
  'js/pecas.js',
  'js/rotas.js',
  'js/tema.js',
  'js/ui.js',
  'js/verificada.js',
  'js/versao.js',
  'js/telas/contas.js',
  'js/telas/entrada.js',
  'js/telas/gastos.js',
  'js/telas/inicio.js',
  'js/telas/lancamentos.js',
  'js/telas/mais.js',
  'js/telas/trava.js',
  'js/telas/trava-ajustes.js',
];

const BASE = new URL(self.registration.scope);
const emUrl = (relativo) => new URL(relativo, BASE).href;
const URLS_DA_CASCA = new Set(ARQUIVOS.map(emUrl));

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS.map((a) => new Request(emUrl(a), { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c.startsWith(PREFIXO) && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;                       // outro endereco (a nuvem): nunca toca
  if (/\/(rest|auth)\/v1(\/|$)/.test(url.pathname)) return;               // dados e login: nunca, mesmo se um dia vierem do mesmo endereco
  url.hash = '';
  url.search = '';
  if (!URLS_DA_CASCA.has(url.href)) return;                                // so a casca; qualquer outra coisa passa direto
  evento.respondWith(
    caches.open(CACHE)
      .then((cache) => cache.match(url.href))
      .then((guardado) => guardado || fetch(pedido)),
  );
});
