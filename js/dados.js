// CAMADA UNICA DE DADOS. As telas leem so por aqui: nenhuma tela chama fetch, IndexedDB ou js/api.js.
//
// O que ela faz:
//  - baixa a copia que o computador mandou para a nuvem (pessoa, conta, lancamento, conferencia, fatura, pendencia e estado_espelho) e
//    guarda no IndexedDB, para o aplicativo abrir na hora e funcionar sem internet;
//  - mantem tudo em memoria: `obter('lancamento')` devolve a lista na hora (depois de `iniciar()`);
//  - sabe quando o COMPUTADOR mandou a copia (estado_espelho.atualizado_em) e quando ESTE celular baixou;
//  - SO LEITURA: nada daqui escreve na nuvem. O celular nunca muda um dado; o computador e a fonte.

import * as api from './api.js';
import * as auth from './auth.js';
import * as armazenamento from './idb.js';
import { normalizarTabela, normalizarLinha, indexar } from './calculos.js';
import { agoraCerto, epochDe, mesValido } from './datas.js';

const TABELAS = armazenamento.TABELAS_DO_ESPELHO;
export const COPIA_VELHA_MS = 2 * 24 * 60 * 60 * 1000;   // mais de 2 dias sem copia nova do computador: aviso
export const INTERVALO_MINIMO_AO_VOLTAR_MS = 5 * 60 * 1000;

let memoria = Object.fromEntries(TABELAS.map((t) => [t, []]));
let espelho = null;               // a linha de estado_espelho (normalizada) ou null
let atualizadoLocalEm = null;     // quando ESTE aparelho baixou com sucesso (ms)
let ultimaTentativaEm = 0;
let indice = null;
let iniciado = null;
let atualizando = null;
const estadoInterno = { carregado: false, atualizando: false, offline: false, erro: null, demo: false };
const ouvintes = new Set();

function notificar() {
  for (const fn of [...ouvintes]) {
    try { fn(); } catch { /* um ouvinte com defeito nao derruba os outros */ }
  }
}

/** `fn()` roda sempre que algo mudar (dados novos ou estado do download). Devolve a funcao que desliga. */
export function aoMudar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

let versaoDosDados = 0;

function trocarMemoria(novas, novoEspelho) {
  memoria = { ...memoria, ...novas };
  espelho = novoEspelho;
  indice = null;
  versaoDosDados += 1;
}

/** Sobe a cada copia nova em memoria: as telas so se redesenham quando os dados mudaram de verdade. */
export function versao() {
  return versaoDosDados;
}

// ---------------------------------------------------------------- leitura (da memoria)

/** Lista de linhas da tabela (nao altere a lista devolvida). */
export function obter(tabela) {
  return memoria[tabela] || [];
}

function indices() {
  if (!indice) indice = indexar(memoria.lancamento);
  return indice;
}

/** Meses com lancamento (AAAA-MM), do mais antigo ao mais novo. */
export function meses() {
  return indices().meses;
}

/** O mes que o aplicativo mostra ao abrir: o ultimo mes com dados. */
export function mesPadrao() {
  const lista = meses();
  return lista.length ? lista[lista.length - 1] : null;
}

/** Lancamentos de um mes, do mais recente ao mais antigo. */
export function doMes(am) {
  return indices().porMes.get(am) || [];
}

/** Lancamentos de `de` a `ate` (meses inclusive; vazio = sem limite), do mais recente ao mais antigo. */
export function doPeriodo(de, ate) {
  if (!de && !ate) return indices().ordenados;
  const lista = [];
  for (const am of [...indices().meses].reverse()) {
    if ((de && am < de) || (ate && am > ate)) continue;
    lista.push(...doMes(am));
  }
  return lista;
}

export function todosOrdenados() {
  return indices().ordenados;
}

export function conta(id) {
  return memoria.conta.find((c) => c.id === id) || null;
}

/** Pessoas pela ordem do computador (ordem, depois nome). */
export function pessoas() {
  return [...memoria.pessoa].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.nome).localeCompare(String(b.nome)));
}

export function criancas() {
  return pessoas().filter((p) => p.crianca);
}

/**
 * Fotografia do estado da copia:
 * { carregado, atualizando, offline, erro, demo, local: ms|null,
 *   computador: { conhecido, epoch, versao, contagens, periodoDe, periodoAte, idadeMs, velho } }
 */
export function estado() {
  const epoch = espelho ? epochDe(espelho.atualizado_em || '') : NaN;
  const conhecido = Number.isFinite(epoch);
  const idadeMs = conhecido ? Math.max(0, agoraCerto() - epoch) : null;
  return {
    ...estadoInterno,
    local: atualizadoLocalEm,
    computador: {
      conhecido,
      epoch: conhecido ? epoch : null,
      versao: espelho && espelho.pc_versao ? espelho.pc_versao : null,
      contagens: espelho && espelho.contagens ? espelho.contagens : {},
      periodoDe: espelho && mesValido(String(espelho.periodo_de || '').slice(0, 7)) ? String(espelho.periodo_de).slice(0, 7) : null,
      periodoAte: espelho && mesValido(String(espelho.periodo_ate || '').slice(0, 7)) ? String(espelho.periodo_ate).slice(0, 7) : null,
      idadeMs,
      velho: idadeMs !== null && idadeMs > COPIA_VELHA_MS,
    },
  };
}

// ---------------------------------------------------------------- iniciar e atualizar

/** Abre o armazenamento local e carrega a copia guardada. Seguro chamar varias vezes. Devolve { temCopia }. */
export function iniciar() {
  if (iniciado) return iniciado;
  iniciado = (async () => {
    if (estadoInterno.demo) return { temCopia: estadoInterno.carregado };
    const lidas = await Promise.all(TABELAS.map((t) => armazenamento.lerTudo(t)));
    const quando = await armazenamento.lerMeta('atualizado_local_em');
    const estadoGuardado = await armazenamento.lerMeta('estado_espelho');
    const dono = await armazenamento.lerMeta('usuario_id');
    const atual = auth.usuarioAtual();
    if (dono && atual && atual.id && dono !== atual.id) {
      await esquecerTudo();   // copia de outra conta neste aparelho: nunca mostrar
      return { temCopia: false };
    }
    const temCopia = Number.isFinite(quando) && quando > 0;
    if (temCopia) {
      trocarMemoria(Object.fromEntries(TABELAS.map((t, i) => [t, normalizarTabela(t, lidas[i])])), estadoGuardado ? normalizarLinha('estado_espelho', estadoGuardado) : null);
      atualizadoLocalEm = quando;
      estadoInterno.carregado = true;
    }
    notificar();
    return { temCopia };
  })();
  return iniciado;
}

async function baixarTudo() {
  const trabalhos = TABELAS.map((tabela) => ({ tabela, rodar: () => auth.comSessao((token) => api.lerTudo(tabela, { token })) }));
  // O carimbo da copia do computador. Se so ele falhar (tabela ainda nao criada, por exemplo), o resto continua e a data fica "desconhecida".
  trabalhos.push({
    tabela: 'estado_espelho',
    rodar: () => auth.comSessao((token) => api.lerUma('estado_espelho', { token, filtros: [['id', 'eq.1']] })).catch((erro) => {
      if (erro instanceof api.ErroApi && (erro.rede || erro.status === 401)) throw erro;
      return null;
    }),
  });
  const resultados = {};
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < trabalhos.length) {
      const t = trabalhos[proximo];
      proximo += 1;
      resultados[t.tabela] = await t.rodar();
    }
  };
  await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
  return resultados;
}

/**
 * Baixa a copia inteira. Devolve { ok, offline, erro }. Se falhar, a copia que ja estava continua (nada e trocado pela metade).
 * Se ja houver um download andando, devolve a mesma promessa.
 */
export function atualizar() {
  if (estadoInterno.demo) return Promise.resolve({ ok: true, offline: estadoInterno.offline, erro: null });
  if (atualizando) return atualizando;
  atualizando = (async () => {
    await iniciar();
    estadoInterno.atualizando = true;
    estadoInterno.erro = null;
    ultimaTentativaEm = Date.now();
    notificar();
    try {
      const r = await baixarTudo();
      const novas = Object.fromEntries(TABELAS.map((t) => [t, normalizarTabela(t, r[t])]));
      const novoEspelho = r.estado_espelho ? normalizarLinha('estado_espelho', r.estado_espelho) : null;
      const quando = Date.now();
      const usuario = auth.usuarioAtual();
      trocarMemoria(novas, novoEspelho);
      atualizadoLocalEm = quando;
      estadoInterno.carregado = true;
      estadoInterno.offline = false;
      // A copia guardada so troca inteira, numa transacao so, junto com a hora: nunca meia copia com a hora nova.
      await armazenamento.substituirTudo(novas, {
        atualizado_local_em: quando,
        estado_espelho: novoEspelho,
        usuario_id: usuario && usuario.id ? usuario.id : null,
      });
      return { ok: true, offline: false, erro: null };
    } catch (erro) {
      const rede = erro instanceof api.ErroApi && erro.rede;
      estadoInterno.offline = rede;
      estadoInterno.erro = rede ? null : api.mensagemDeErro(erro);
      return { ok: false, offline: rede, erro: estadoInterno.erro };
    } finally {
      estadoInterno.atualizando = false;
      atualizando = null;
      notificar();
    }
  })();
  return atualizando;
}

/** Baixa de novo se a ultima tentativa foi ha mais de 5 minutos (usado ao voltar para o aplicativo). */
export function atualizarSeVelho() {
  if (Date.now() - ultimaTentativaEm < INTERVALO_MINIMO_AO_VOLTAR_MS) return Promise.resolve(null);
  return atualizar();
}

/** Apaga TUDO que o aplicativo guardou neste aparelho (memoria e IndexedDB). Chamado ao sair. */
export async function esquecerTudo() {
  trocarMemoria(Object.fromEntries(TABELAS.map((t) => [t, []])), null);
  atualizadoLocalEm = null;
  estadoInterno.carregado = false;
  estadoInterno.offline = false;
  estadoInterno.erro = null;
  iniciado = null;
  await armazenamento.apagarTudo();
  notificar();
}
auth.aoSair(esquecerTudo);

// ---------------------------------------------------------------- demonstracao (dados inventados, so em 127.0.0.1 com ?demo=1)

/** Carrega o conjunto inventado de js/demo.js so em memoria (nada vai para o IndexedDB nem para a nuvem). */
export function usarDemonstracao(conjunto, { offline = false } = {}) {
  estadoInterno.demo = true;
  trocarMemoria(
    Object.fromEntries(TABELAS.map((t) => [t, normalizarTabela(t, conjunto[t])])),
    conjunto.estado_espelho ? normalizarLinha('estado_espelho', conjunto.estado_espelho) : null,
  );
  atualizadoLocalEm = conjunto.baixado_em || Date.now();
  estadoInterno.carregado = true;
  estadoInterno.offline = offline;
  iniciado = Promise.resolve({ temCopia: true });
  notificar();
}
