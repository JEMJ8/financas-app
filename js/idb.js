// Copia local do aparelho (IndexedDB), em volta de uma interface pequena e de promessas. Veio do aplicativo do Gestao JEMJ.
// Guarda: uma "loja" por tabela do espelho e a loja `meta` (a hora em que este celular baixou, o estado da copia do computador e de quem e
// a copia). So dados que a nuvem ja entregou a este usuario; nada de senha nem de chave.
//
// Se o navegador nao deixar usar o IndexedDB (janela privada, dados bloqueados), `disponivel()` fica falso e o aplicativo funciona so com a
// memoria: perde apenas a copia para ver sem internet. Nenhuma funcao daqui lanca por causa disso.

const NOME_DO_BANCO = 'financas-casa';
const VERSAO_DO_BANCO = 1;
const TEMPO_PARA_ABRIR_MS = 6000;

export const TABELAS_DO_ESPELHO = ['pessoa', 'conta', 'lancamento', 'conferencia', 'fatura', 'pendencia'];
export const LOJA_META = 'meta';

let promessa = null;
let funcionando = true;

export function disponivel() {
  return funcionando && typeof indexedDB !== 'undefined';
}

function abrir() {
  if (!disponivel()) return Promise.reject(new Error('IndexedDB indisponivel'));
  if (promessa) return promessa;
  promessa = new Promise((resolve, reject) => {
    let pedido;
    let esgotou = false;
    const relogio = window.setTimeout(() => {
      esgotou = true;
      funcionando = false;
      promessa = null;
      reject(new Error('IndexedDB nao respondeu'));
    }, TEMPO_PARA_ABRIR_MS);
    try {
      pedido = indexedDB.open(NOME_DO_BANCO, VERSAO_DO_BANCO);
    } catch (erro) {
      window.clearTimeout(relogio);
      funcionando = false;
      reject(erro);
      return;
    }
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      for (const loja of TABELAS_DO_ESPELHO) {
        if (!banco.objectStoreNames.contains(loja)) banco.createObjectStore(loja, { keyPath: 'id' });
      }
      if (!banco.objectStoreNames.contains(LOJA_META)) banco.createObjectStore(LOJA_META, { keyPath: 'chave' });
    };
    pedido.onsuccess = () => {
      const banco = pedido.result;
      window.clearTimeout(relogio);
      if (esgotou) { banco.close(); return; }
      banco.onversionchange = () => { banco.close(); promessa = null; };
      resolve(banco);
    };
    pedido.onerror = () => { window.clearTimeout(relogio); funcionando = false; promessa = null; reject(pedido.error); };
    pedido.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  });
  return promessa;
}

function pedidoParaPromessa(pedido) {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

/** Todas as linhas de uma loja (lista vazia se algo falhar). */
export async function lerTudo(loja) {
  try {
    const banco = await abrir();
    return await pedidoParaPromessa(banco.transaction(loja, 'readonly').objectStore(loja).getAll());
  } catch {
    return [];
  }
}

/**
 * Troca TODO o conteudo das lojas de uma vez, numa transacao so: ou a copia nova inteira fica guardada (com a hora e o estado em `meta`),
 * ou nada muda. Nunca fica meia copia nova misturada com a velha.
 */
export async function substituirTudo(tabelas, meta) {
  try {
    const banco = await abrir();
    const lojas = [...TABELAS_DO_ESPELHO, LOJA_META];
    await new Promise((resolve, reject) => {
      const tx = banco.transaction(lojas, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transacao cancelada'));
      for (const nome of TABELAS_DO_ESPELHO) {
        const loja = tx.objectStore(nome);
        loja.clear();
        for (const linha of tabelas[nome] || []) loja.put(linha);
      }
      const lojaMeta = tx.objectStore(LOJA_META);
      for (const [chave, valor] of Object.entries(meta)) lojaMeta.put({ chave, valor });
    });
    return true;
  } catch {
    return false;
  }
}

export async function lerMeta(chave) {
  try {
    const banco = await abrir();
    const linha = await pedidoParaPromessa(banco.transaction(LOJA_META, 'readonly').objectStore(LOJA_META).get(chave));
    return linha ? linha.valor : null;
  } catch {
    return null;
  }
}

/** Apaga o banco inteiro (usado ao sair e quando a copia guardada e de outra conta). Devolve true se nao sobrou nada. */
export async function apagarTudo() {
  try {
    if (promessa) {
      const banco = await promessa.catch(() => null);
      if (banco) banco.close();
      promessa = null;
    }
    if (typeof indexedDB === 'undefined') return true;
    return await new Promise((resolve) => {
      const pedido = indexedDB.deleteDatabase(NOME_DO_BANCO);
      pedido.onsuccess = () => resolve(true);
      pedido.onerror = () => resolve(false);
      pedido.onblocked = () => resolve(false);
    });
  } catch {
    return false;
  }
}
