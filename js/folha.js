// Folha inferior (bottom sheet): painel que sobe da borda de baixo, em cima da tela. Usa o <dialog> nativo (foco preso dentro, Esc fecha,
// fundo escurecido). O Voltar do celular FECHA A FOLHA e nao sai da tela (rotas.empilharCamada).
//
//   const folha = abrirFolha({ titulo: 'Detalhe', conteudo: h('p', null, 'texto'), rodape: [botao] });
//   await folha.fechar();              // fecha e espera o historico acertar; para navegar de dentro da folha: await folha.fechar(); ir(...)
//
// `conteudo` e `rodape` sao elementos ou listas de elementos (montados com h()). Nunca HTML em texto.

import { h, novoId, focar } from './ui.js';
import { icone } from './icones.js';
import { empilharCamada } from './rotas.js';

export function abrirFolha({ titulo, conteudo = null, rodape = null, aoFechar = null, focoInicial = null } = {}) {
  const idTitulo = novoId('folha-titulo');
  const anterior = document.activeElement;
  let aberta = true;
  const botaoFechar = h('button', { class: 'botao-fechar', type: 'button', 'aria-label': 'Fechar', onclick: () => folha.fechar() }, icone('fechar', { tamanho: 22 }));
  const corpo = h('div', { class: 'folha-corpo' }, conteudo);
  const dialogo = h('dialog', { class: 'folha', 'aria-labelledby': idTitulo },
    h('header', { class: 'folha-cabeca' }, h('h2', { class: 'folha-titulo', id: idTitulo }, titulo), botaoFechar),
    corpo,
    rodape ? h('footer', { class: 'folha-rodape' }, rodape) : null);

  function encerrar() {
    if (!aberta) return;
    aberta = false;
    try { dialogo.close(); } catch { /* ja fechado */ }
    dialogo.remove();
    if (anterior && anterior.isConnected) focar(anterior);
    if (aoFechar) {
      try { aoFechar(); } catch { /* quem pediu o aviso nao derruba o fechamento */ }
    }
  }

  const liberar = empilharCamada(encerrar);
  const folha = {
    elemento: dialogo,
    corpo,
    aberta: () => aberta,
    fechar() {
      if (!aberta) return Promise.resolve();
      encerrar();
      return liberar();
    },
  };

  dialogo.addEventListener('cancel', (ev) => { ev.preventDefault(); folha.fechar(); });
  dialogo.addEventListener('click', (ev) => { if (ev.target === dialogo) folha.fechar(); });
  document.body.appendChild(dialogo);
  dialogo.showModal();
  focar(focoInicial || botaoFechar);
  return folha;
}

/** Pergunta simples em folha: { confirmado }. */
export function confirmar({ titulo, texto, rotuloConfirmar = 'Confirmar', rotuloCancelar = 'Cancelar', perigo = false } = {}) {
  return new Promise((resolve) => {
    let resultado = false;
    const sim = h('button', { class: ['botao', perigo ? 'botao--perigo' : 'botao--primario'], type: 'button' }, rotuloConfirmar);
    const nao = h('button', { class: 'botao', type: 'button' }, rotuloCancelar);
    const folha = abrirFolha({
      titulo,
      conteudo: texto ? h('p', null, texto) : null,
      rodape: [nao, sim],
      aoFechar: () => resolve({ confirmado: resultado }),
      focoInicial: nao,
    });
    sim.addEventListener('click', () => { resultado = true; folha.fechar(); });
    nao.addEventListener('click', () => folha.fechar());
  });
}
