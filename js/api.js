// Conversa com o Supabase por fetch, sem biblioteca. Camada de baixo: nao sabe de sessao nem de tela.
// Quem tem a sessao e renova o login e js/auth.js; quem guarda os dados e js/dados.js. As telas NAO chamam este arquivo.
//
// SO LEITURA: este arquivo so faz GET em /rest/v1 (os dados) e as chamadas de login em /auth/v1. Nao existe funcao de gravar dado.
// Endereco e chave publica vem so de ../config.js. Nada aqui le endereco de parametro de URL, de armazenamento ou da tela.

import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA } from '../config.js';
import { epochDeDataHttp, definirDesvioDoRelogio } from './datas.js';

const TEMPO_LIMITE_MS = 25000;
export const TAMANHO_DA_PAGINA = 1000;   // o servidor costuma cortar em 1000 linhas por resposta
const PADRAO_NOME = /^[a-z_][a-z0-9_]{0,60}$/;

/** Falha de uma chamada. `rede` = nem chegou ao servidor (sem internet, tempo esgotado). `status` = codigo HTTP (0 se rede). */
export class ErroApi extends Error {
  constructor(mensagem, { status = 0, codigo = '', rede = false } = {}) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.rede = rede;
  }
}

/** A configuracao ainda tem os marcadores? Enquanto tiver, o aplicativo nao fala com ninguem. */
export function configurado() {
  const url = String(SUPABASE_URL || '');
  const chave = String(SUPABASE_CHAVE_PUBLICA || '');
  if (!url || !chave || url.includes('__') || chave.includes('__')) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

/**
 * O endereco de config.js e o mesmo que a politica de seguranca do index.html deixa chamar? Se nao for, o navegador bloqueia toda chamada
 * e o erro pareceria "sem internet": melhor dizer a verdade na tela.
 */
export function politicaConfere() {
  try {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) return true;
    const regra = (meta.getAttribute('content') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('connect-src'));
    if (!regra) return false;
    const origem = new URL(SUPABASE_URL).origin;
    return regra.split(/\s+/).slice(1).some((fonte) => fonte.replace(/\/+$/, '') === origem);
  } catch {
    return false;
  }
}

/** Frase simples para mostrar a quem usa. Nunca repete o texto tecnico do servidor. */
export function mensagemDeErro(erro) {
  if (!(erro instanceof ErroApi)) return 'Não foi possível baixar a cópia agora. Tente de novo.';
  if (erro.rede) return 'Sem conexão com a internet.';
  if (erro.status === 401) return 'Sua sessão terminou. Entre de novo.';
  if (erro.status === 403) return 'Este acesso não tem permissão para ver os dados.';
  if (erro.status === 429) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (erro.status >= 500) return 'A nuvem está com problema agora. Tente de novo em instantes.';
  if (erro.codigo === 'leitura_incompleta') return 'A cópia mudou enquanto era baixada. Tente de novo em instantes.';
  return 'Não foi possível baixar a cópia agora. Tente de novo.';
}

async function requisitar(url, { metodo = 'GET', corpo, token, cabecalhos = {} } = {}) {
  const controle = new AbortController();
  const relogio = window.setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  const cab = { apikey: SUPABASE_CHAVE_PUBLICA, Accept: 'application/json', ...cabecalhos };
  if (token) cab.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) cab['Content-Type'] = 'application/json';
  let resposta;
  let texto = '';
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: cab,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controle.signal,
    });
    // a hora do servidor corrige o relogio do aparelho (token e aviso de copia antiga contam pelo relogio certo)
    const horaDoServidor = epochDeDataHttp(resposta.headers.get('date') || '');
    if (Number.isFinite(horaDoServidor)) definirDesvioDoRelogio(horaDoServidor - Date.now());
    texto = await resposta.text();
  } catch {
    throw new ErroApi('sem rede', { rede: true });
  } finally {
    window.clearTimeout(relogio);
  }
  let dados = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = null;
    }
  }
  if (!resposta.ok) {
    const corpoErro = dados && typeof dados === 'object' ? dados : {};
    throw new ErroApi(String(corpoErro.msg || corpoErro.message || corpoErro.error_description || 'falha'), {
      status: resposta.status,
      codigo: String(corpoErro.error_code || corpoErro.code || corpoErro.error || ''),
    });
  }
  return { status: resposta.status, cabecalhos: resposta.headers, dados };
}

/** Chamada ao login (GoTrue): /auth/v1/<caminho>. `token` so quando o endpoint pede o usuario logado. */
export function chamarAuth(metodo, caminho, { corpo, token } = {}) {
  return requisitar(`${SUPABASE_URL}/auth/v1${caminho}`, { metodo, corpo, token });
}

function enderecoDaTabela(tabela, filtros = []) {
  if (!PADRAO_NOME.test(tabela)) throw new Error('nome de tabela invalido');
  const p = new URLSearchParams();
  p.set('select', '*');
  for (const [coluna, valor] of filtros) {
    if (!PADRAO_NOME.test(coluna)) throw new Error('nome de coluna invalido');
    p.append(coluna, valor);
  }
  p.set('order', 'id.asc');   // ordem estavel: as paginas nao repetem nem pulam linha
  return `${SUPABASE_URL}/rest/v1/${tabela}?${p.toString()}`;
}

/** "0-999/10234" -> { fim: 999, total: 10234 }; "*\/0" -> { fim: -1, total: 0 }. Partes ilegiveis viram null. */
function lerContentRange(texto) {
  const m = /^(?:(\d+)-(\d+)|\*)\/(\d+|\*)$/.exec(String(texto || '').trim());
  if (!m) return { fim: null, total: null };
  return { fim: m[2] === undefined ? -1 : Number(m[2]), total: m[3] === '*' ? null : Number(m[3]) };
}

/**
 * Todas as linhas de uma tabela, de pagina em pagina, pelo cabecalho Range (GET /rest/v1/<tabela>?select=*). Confere o total que o servidor
 * anunciou: se faltar linha (o computador mandou uma copia nova no meio da leitura), le tudo de novo, ate 3 vezes, e so entao desiste com
 * erro. Nunca devolve uma lista pela metade como se fosse inteira.
 */
export async function lerTudo(tabela, { token, filtros = [] } = {}) {
  const url = enderecoDaTabela(tabela, filtros);
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const porId = new Map();
    let total = null;
    let inicio = 0;
    for (let pagina = 0; pagina < 1000; pagina += 1) {
      const resposta = await requisitar(url, {
        token,
        cabecalhos: { 'Range-Unit': 'items', Range: `${inicio}-${inicio + TAMANHO_DA_PAGINA - 1}`, Prefer: 'count=exact' },
      });
      const linhas = Array.isArray(resposta.dados) ? resposta.dados : [];
      const faixa = lerContentRange(resposta.cabecalhos.get('content-range'));
      if (faixa.total !== null) total = faixa.total;
      for (const linha of linhas) {
        if (linha && typeof linha === 'object' && linha.id !== undefined && linha.id !== null) porId.set(String(linha.id), linha);
      }
      if (!linhas.length) break;
      inicio = faixa.fim !== null && faixa.fim >= inicio ? faixa.fim + 1 : inicio + linhas.length;
      if (total !== null && inicio >= total) break;
      if (total === null && linhas.length < TAMANHO_DA_PAGINA) break;
    }
    if (total === null || porId.size === total) return [...porId.values()];
  }
  throw new ErroApi('leitura incompleta', { status: 0, codigo: 'leitura_incompleta' });
}

/** Uma linha so (ou null): usado para o estado da copia (estado_espelho, id = 1). */
export async function lerUma(tabela, { token, filtros = [] } = {}) {
  const resposta = await requisitar(enderecoDaTabela(tabela, filtros), { token, cabecalhos: { 'Range-Unit': 'items', Range: '0-0' } });
  return Array.isArray(resposta.dados) && resposta.dados.length ? resposta.dados[0] : null;
}
