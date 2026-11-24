// Script comum (nao e modulo) que roda ANTES de tudo, ainda no <head>:
//  1. aplica o tema escolhido (claro ou escuro) antes da primeira pintura, para a tela nao piscar;
//     no modo de demonstracao (so em 127.0.0.1 ou localhost, com ?demo=1) aceita ?tema=claro|escuro sem gravar nada;
//  2. se o aplicativo for aberto dentro de outra pagina (moldura), esconde tudo (defesa possivel sem cabecalho do servidor);
//  3. se o aplicativo nao chegar a iniciar (um arquivo falhou), mostra um aviso com o botao Recarregar.
// Sem estilo nem script inline: este arquivo e carregado por <script src>.
(function () {
  var tema = null;
  try {
    tema = window.localStorage.getItem('financas.tema');
  } catch (erro) {
    tema = null;
  }
  try {
    var local = ['127.0.0.1', 'localhost', '[::1]', '::1'].indexOf(window.location.hostname) >= 0;
    var params = new URLSearchParams(window.location.search);
    if (local && params.get('demo') === '1') {
      var pedido = params.get('tema');
      if (pedido === 'claro' || pedido === 'escuro') tema = pedido;
    }
  } catch (erro) {
    /* sem URLSearchParams: vale o tema guardado */
  }
  if (tema === 'claro' || tema === 'escuro') document.documentElement.setAttribute('data-tema', tema);
  if (window.top !== window.self) document.documentElement.style.setProperty('display', 'none');
  window.setTimeout(function () {
    if (window.__financasIniciou) return;
    var aviso = document.createElement('div');
    aviso.className = 'aviso-visual';
    aviso.setAttribute('role', 'alert');
    var texto = document.createElement('p');
    texto.textContent = 'O aplicativo não carregou direito (sinal fraco ou bloqueio do navegador). Toque em Recarregar para tentar de novo.';
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = 'Recarregar';
    botao.addEventListener('click', function () { window.location.reload(); });
    aviso.appendChild(texto);
    aviso.appendChild(botao);
    document.body.insertBefore(aviso, document.body.firstChild);
  }, 8000);
})();
