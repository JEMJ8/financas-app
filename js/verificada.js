// Confirmacao em folha inferior COM a verificacao do celular no proprio toque de confirmar (veio do Gestao JEMJ).
// Devolve uma promessa com { confirmado, semVerificacao }.
//
//   confirmarComVerificacao({ titulo, texto, rotuloConfirmar, textoFalha, escape: { rotulo, texto } })
//
// Por que nao "confirmar() e depois verificar": a promessa de confirmar() so se resolve quando a folha FECHA, fora do toque. O iPhone so abre a
// janela do desbloqueio a partir do toque, entao a verificacao sai do clique do botao de confirmar (funcao comum, nao assincrona).
// Esta peca nao guarda nada, nao fala com a nuvem e nao mexe na sessao.

import { h } from './ui.js';
import { abrirFolha } from './folha.js';
import * as auth from './auth.js';
import * as bio from './biometria.js';
import * as trava from './telas/trava.js';

const FRASE_FIXA = 'O celular vai pedir o desbloqueio agora para confirmar.';
const ROTULO_AGUARDANDO = 'Aguardando o celular…';

export function confirmarComVerificacao({ titulo, texto = null, rotuloConfirmar, rotuloCancelar = 'Cancelar', perigo = false, textoFalha, escape = null } = {}) {
  return new Promise((resolve) => {
    let resultado = { confirmado: false, semVerificacao: false };
    let aguardando = false;
    let encerrada = false;
    const erro = h('p', { class: 'campo-erro', role: 'alert', hidden: true });
    const confirmarBotao = h('button', { class: ['botao', perigo ? 'botao--perigo' : 'botao--primario'], type: 'button' }, rotuloConfirmar);
    const cancelarBotao = h('button', { class: 'botao', type: 'button' }, rotuloCancelar);
    const escapeBotao = escape ? h('button', { class: ['botao', 'botao--discreto'], type: 'button', hidden: true }, escape.rotulo) : null;
    const escapeTexto = escape ? h('p', { class: 'nota', hidden: true }, escape.texto) : null;

    const folha = abrirFolha({
      titulo,
      conteudo: [h('p', null, texto ? `${texto} ${FRASE_FIXA}` : FRASE_FIXA), erro, escapeTexto],
      rodape: [cancelarBotao, confirmarBotao, escapeBotao],
      aoFechar: () => { encerrada = true; bio.abortar(); resolve(resultado); },
      focoInicial: cancelarBotao,
    });

    function mostrarErro(frase) {
      erro.textContent = frase;
      erro.hidden = false;
      try { erro.scrollIntoView({ block: 'nearest' }); } catch { /* sem rolagem */ }
    }

    function aoToqueConfirmar() {
      if (aguardando || encerrada) return;
      const { id, transports } = auth.biometriaDados();
      const pedido = bio.verificar({ id, transports });   // direto no toque: o iPhone so abre a janela do desbloqueio daqui
      aguardando = true;
      erro.hidden = true;
      confirmarBotao.textContent = ROTULO_AGUARDANDO;
      confirmarBotao.setAttribute('aria-busy', 'true');
      confirmarBotao.setAttribute('aria-disabled', 'true');
      pedido.then(() => {
        if (encerrada) return;
        trava.carimbarVerificacao();
        resultado = { confirmado: true, semVerificacao: false };
        folha.fechar();
      }, (e) => {
        if (encerrada) return;
        aguardando = false;
        confirmarBotao.textContent = rotuloConfirmar;
        confirmarBotao.removeAttribute('aria-busy');
        confirmarBotao.removeAttribute('aria-disabled');
        if (e && e.codigo === 'abortado') return;
        mostrarErro(textoFalha);
        if (escapeBotao) escapeBotao.hidden = false;
        if (escapeTexto) escapeTexto.hidden = false;
      });
    }

    cancelarBotao.addEventListener('click', () => { bio.abortar(); folha.fechar(); });
    confirmarBotao.addEventListener('click', aoToqueConfirmar);
    if (escapeBotao) {
      escapeBotao.addEventListener('click', () => {
        if (encerrada) return;
        bio.abortar();
        resultado = { confirmado: true, semVerificacao: true };
        folha.fechar();
      });
    }
  });
}
