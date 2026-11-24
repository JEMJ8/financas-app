// Modo de demonstracao (ensaio): abre o aplicativo com dados INVENTADOS (js/demo.js), sem login e sem nuvem, para conferir as telas.
//
// So liga quando as DUAS condicoes valem ao mesmo tempo:
//   - a pagina esta sendo servida pelo proprio computador: o nome do endereco e exatamente 127.0.0.1, localhost ou [::1];
//   - o endereco traz ?demo=1.
// Em qualquer outro endereco (o publicado, um IP da rede, um nome parecido como localhost.exemplo.com) a funcao devolve falso e o
// aplicativo segue o caminho normal: e-mail, senha e codigo. Nada aqui grava em lugar nenhum.

const LOCAIS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function parametros() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams('');
  }
}

/** O aplicativo esta no modo de demonstracao? */
export function modoDemo() {
  try {
    const protocolo = window.location.protocol;
    if (protocolo !== 'http:' && protocolo !== 'https:') return false;
    if (!LOCAIS.has(window.location.hostname)) return false;
    return parametros().get('demo') === '1';
  } catch {
    return false;
  }
}

/** Opcoes do ensaio lidas do endereco (so valem com modoDemo()): tema, copia velha, sem internet. */
export function opcoesDoEnsaio() {
  if (!modoDemo()) return { tema: null, velho: false, offline: false };
  const p = parametros();
  const tema = p.get('tema');
  return {
    tema: tema === 'claro' || tema === 'escuro' ? tema : null,
    velho: p.get('velho') === '1',
    offline: p.get('offline') === '1',
  };
}
