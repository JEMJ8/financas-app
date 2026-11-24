// A folha "Trava do aplicativo" (aberta em Mais): liga, testa, tranca, muda o prazo e desliga a trava. Veio do cartao de Ajustes do
// Gestao JEMJ, com a mesma regra. A trava comeca DESLIGADA: so liga aqui, por escolha da pessoa.
// Ela so fecha a porta do aplicativo: nao protege a copia guardada no aparelho, nao mexe na sessao e nao fala com a nuvem (a regra mora em
// auth.js e biometria.js). Cinco estados:
//   A o navegador nao oferece a trava       B o celular nao confirmou ter bloqueio de tela que sirva
//   C desligada                              D ligada e completa          E ligada, porem incompleta (so Refazer)
// Toda funcao aoToque* que chama o celular (criar ou verificar) sai do proprio toque: nao e assincrona e continua pelo then da promessa.
// Desligar e trocar para um prazo MAIOR pedem a verificacao do celular (verificada.js).

import * as auth from '../auth.js';
import * as bio from '../biometria.js';
import * as trava from './trava.js';
import { h, novoId, anunciar, focar, preencher } from '../ui.js';
import { abrirFolha } from '../folha.js';
import { confirmarComVerificacao } from '../verificada.js';
import { selo } from '../pecas.js';
import { modoDemo } from '../ensaio.js';

const TX = {
  A: 'Este navegador não oferece a trava do aplicativo. Abra o aplicativo pelo ícone da tela inicial, ou pelo navegador que você costuma usar, e ligue por lá.',
  B: 'O celular não confirmou ter um bloqueio de tela que sirva para isso (digital, rosto, PIN ou padrão). Confira nas configurações do celular e toque em Conferir de novo.',
  B_AINDA_NAO: 'Conferido agora: o celular ainda não confirmou ter um bloqueio de tela.',
  C: 'Hoje o aplicativo abre sem pedir nada neste celular. Com a trava ligada, ele pede o desbloqueio do celular, normalmente o mesmo que você usa para abrir o próprio celular.',
  C_PEQUENO: 'Isto não deixa o acesso mais rápido, deixa mais protegido. Se o desbloqueio falhar, só se entra com senha e código, e isso precisa de internet.',
  C_IPHONE: 'No iPhone, ligue por onde você usa o aplicativo: o ícone da tela inicial guarda os dados à parte do Safari.',
  D: 'O aplicativo pede o desbloqueio do celular quando você o abre e quando volta a ele depois do prazo escolhido.',
  E: 'A trava guardada neste celular está incompleta. Toque em Refazer a trava.',
  DEMO: 'Na demonstração a trava não liga: não há conta nem sessão.',
  JANELA: 'O celular vai abrir uma janela própria. Ela pode falar em chave de acesso e mostrar o endereço deste aplicativo. É normal. Siga as instruções dela.',
  AGUARDANDO: 'Aguardando o celular…',
  ERRO_LIGAR: 'Não foi ligada. Toque em Ligar a trava para tentar de novo.',
  ERRO_GRAVAR: 'Não foi possível guardar a trava neste celular. Tente de novo.',
  LIGADA_OK: 'Trava ligada.',
  DESLIGADA_OK: 'Trava desligada.',
  TESTE_OK: 'A trava funcionou.',
  TESTE_FALHOU: 'Não funcionou. Toque em Testar agora para tentar de novo. Se continuar assim, toque em Refazer a trava.',
  REFEITA_OK: 'Trava refeita.',
  REFEITA_FALHOU: 'Não foi refeita. A trava antiga continua como estava.',
  PRAZO_LEGENDA: 'Pedir de novo quando eu voltar ao aplicativo',
  PEQUENO_1: 'O aplicativo tranca quando você sai dele e volta depois do prazo escolhido. Com ele aberto na sua mão, não tranca sozinho: toque em Trancar agora.',
  PEQUENO_2: 'Sem internet, se o desbloqueio falhar, você só volta a entrar quando o sinal voltar. Teste uma vez com sinal: toque em Testar agora.',
  MAIOR_TEXTO: 'Quem pegar o celular desbloqueado poderá abrir o aplicativo se voltar a ele nesse intervalo.',
  MAIOR_FALHA: 'Não foi confirmado. O prazo continua como estava.',
  DESLIGAR_TEXTO: 'O aplicativo volta a abrir direto neste celular, sem pedir nada. Quem pegar o celular desbloqueado poderá ver as finanças. Você continua conectado à sua conta.',
  DESLIGAR_FALHA: 'Continua ligada. Para desligar, confirme com o desbloqueio do celular. Se ele não funciona, use Sair deste celular, em Mais.',
};

const OPCOES_DE_PRAZO = [
  { minutos: 0, rotulo: 'Sempre', ajuda: 'Toda vez que você sair e voltar', quanto: null },
  { minutos: 1, rotulo: 'Depois de 1 minuto', ajuda: 'Recomendado', quanto: '1 minuto' },
  { minutos: 5, rotulo: 'Depois de 5 minutos', ajuda: 'Mais prático, menos protegido', quanto: '5 minutos' },
];

let ultimaDisponibilidade = 'desconhecido';   // 'sim' | 'nao' | 'desconhecido' (memoria desta pagina)

function estadoDaTrava() {
  if (!bio.suportado()) return 'A';
  if (auth.biometriaLigada()) return auth.biometriaDados().valido ? 'D' : 'E';
  return ultimaDisponibilidade === 'nao' ? 'B' : 'C';
}

/** O selo da linha em Mais: { texto, tom }. */
export function rotuloDaTrava() {
  const e = modoDemo() ? 'C' : estadoDaTrava();
  if (e === 'D' || e === 'E') return { texto: 'Ligada', tom: 'ok' };
  if (e === 'C') return { texto: 'Desligada', tom: 'neutro' };
  return { texto: 'Indisponível', tom: 'neutro' };
}

/** Abre a folha da trava. `aoFechar()` roda quando ela fecha (Mais redesenha o selo). */
export function abrirTrava(aoFechar = () => {}) {
  const t = { vivo: true, pendente: false, minhaMudanca: false, estado: null };
  const status = h('p', { role: 'status', class: 'nota' });
  const erro = h('p', { class: 'campo-erro', role: 'alert', hidden: true });
  const miolo = h('div', { class: 'pilha' });
  const folha = abrirFolha({
    titulo: 'Trava do aplicativo',
    conteudo: [miolo, status, erro],
    aoFechar: () => {
      t.vivo = false;
      desligarAuth();
      if (t.pendente) bio.abortar();
      aoFechar();
    },
  });

  function dizer(frase) {
    erro.hidden = true;
    status.textContent = frase;
  }
  function errar(frase) {
    status.textContent = '';
    erro.textContent = frase;
    erro.hidden = false;
    try { erro.scrollIntoView({ block: 'nearest' }); } catch { /* sem rolagem */ }
  }
  function calar() {
    status.textContent = '';
    erro.hidden = true;
  }

  function botao(acao, rotulo, classes, aoClicar) {
    const b = h('button', { class: ['botao', 'botao--cheio', ...classes], type: 'button', 'data-acao': acao }, rotulo);
    b.addEventListener('click', () => aoClicar(b));
    return b;
  }
  function ocupar(b) {
    t.pendente = true;
    b.setAttribute('aria-busy', 'true');
    b.setAttribute('aria-disabled', 'true');
    b.textContent = TX.AGUARDANDO;
  }
  function soltar(b, rotulo) {
    t.pendente = false;
    b.removeAttribute('aria-busy');
    b.removeAttribute('aria-disabled');
    b.textContent = rotulo;
  }
  function gravar(fazer) {
    t.minhaMudanca = true;
    try { return fazer(); } finally { t.minhaMudanca = false; }
  }

  // ---- toques

  function aoToqueLigar(b) {
    if (t.pendente) return;
    const pedido = bio.criar({ limiteMs: 60000 });
    ocupar(b);
    dizer(TX.JANELA);
    pedido.then((r) => {
      const ok = gravar(() => auth.ligarBiometria({ id: r.id, transports: r.transports, minutos: 1 }));
      if (!ok) {
        bio.esquecer(r.id);
        soltar(b, 'Ligar a trava');
        if (t.vivo) errar(TX.ERRO_GRAVAR);
        return;
      }
      t.pendente = false;
      trava.carimbarVerificacao();
      if (!t.vivo) return;
      desenhar({ foco: 'testar', frase: TX.LIGADA_OK });
      anunciar(TX.LIGADA_OK);
    }, (e) => {
      soltar(b, 'Ligar a trava');
      if (!t.vivo || (e && e.codigo === 'abortado')) { calar(); return; }
      errar(TX.ERRO_LIGAR);
    });
  }

  function aoToqueTestar(b) {
    if (t.pendente) return;
    const { id, transports } = auth.biometriaDados();
    const pedido = bio.verificar({ id, transports });
    ocupar(b);
    calar();
    pedido.then(() => {
      trava.carimbarVerificacao();
      soltar(b, 'Testar agora');
      if (t.vivo) dizer(TX.TESTE_OK);
    }, (e) => {
      soltar(b, 'Testar agora');
      if (!t.vivo || (e && e.codigo === 'abortado')) return;
      errar(TX.TESTE_FALHOU);
    });
  }

  function aoToqueRefazer(b) {
    if (t.pendente) return;
    const antigo = auth.biometriaDados().id;
    const pedido = bio.criar({ limiteMs: 60000 });
    ocupar(b);
    dizer(TX.JANELA);
    pedido.then((r) => {
      const minutos = auth.biometriaDados().minutos;
      const ok = gravar(() => auth.ligarBiometria({ id: r.id, transports: r.transports, minutos }));
      if (!ok) {
        bio.esquecer(r.id);
        soltar(b, 'Refazer a trava');
        if (t.vivo) errar(TX.ERRO_GRAVAR);
        return;
      }
      if (antigo) bio.esquecer(antigo);
      t.pendente = false;
      trava.carimbarVerificacao();
      if (!t.vivo) return;
      desenhar({ foco: 'testar', frase: TX.REFEITA_OK });
      anunciar(TX.REFEITA_OK);
    }, (e) => {
      soltar(b, 'Refazer a trava');
      if (!t.vivo || (e && e.codigo === 'abortado')) { calar(); return; }
      errar(TX.REFEITA_FALHOU);
    });
  }

  function aoToqueConferir(b) {
    if (t.pendente) return;
    ocupar(b);
    bio.disponivel().then((resposta) => {
      ultimaDisponibilidade = resposta;
      soltar(b, 'Conferir de novo');
      if (!t.vivo) return;
      if (resposta === 'nao') { dizer(TX.B_AINDA_NAO); return; }
      desenhar({ foco: 'ligar' });
    });
  }

  async function aoToqueTrancar() {
    if (t.pendente) return;
    await folha.fechar();
    trava.trancarAgora();
  }

  function aoToqueDesligar() {
    if (t.pendente) return;
    calar();
    confirmarComVerificacao({
      titulo: 'Desligar a trava?', texto: TX.DESLIGAR_TEXTO, rotuloConfirmar: 'Desligar a trava', rotuloCancelar: 'Manter ligada', textoFalha: TX.DESLIGAR_FALHA,
    }).then((r) => {
      if (!r.confirmado) return;
      const { id } = auth.biometriaDados();
      const ok = gravar(() => auth.desligarBiometria());
      if (ok && id) bio.esquecer(id);
      if (!t.vivo) return;
      if (!ok) { errar(TX.ERRO_GRAVAR); return; }
      desenhar({ foco: 'ligar', frase: TX.DESLIGADA_OK });
      anunciar(TX.DESLIGADA_OK);
    });
  }

  /** Prazo menor so protege mais: aplica direto. Prazo maior afrouxa: so vale depois da verificacao do celular. */
  function aoMudarPrazo(opcao, marcar) {
    const atual = auth.biometriaDados().minutos;
    if (opcao.minutos === atual) return;
    if (opcao.minutos < atual) {
      const ok = gravar(() => auth.trocarMinutosBiometria(opcao.minutos));
      if (ok) dizer('Prazo mudado.');
      else { marcar(atual); errar(TX.ERRO_GRAVAR); }
      return;
    }
    marcar(atual);
    calar();
    confirmarComVerificacao({
      titulo: `Pedir de novo só depois de ${opcao.quanto}?`, texto: TX.MAIOR_TEXTO, rotuloConfirmar: 'Mudar o prazo', textoFalha: TX.MAIOR_FALHA,
    }).then((r) => {
      if (!r.confirmado || !t.vivo) return;
      const ok = gravar(() => auth.trocarMinutosBiometria(opcao.minutos));
      if (ok) { marcar(opcao.minutos); dizer('Prazo mudado.'); } else errar(TX.ERRO_GRAVAR);
    });
  }

  // ---- desenho

  function prazos() {
    const nome = novoId('prazo');
    const atual = auth.biometriaDados().minutos;
    const radios = [];
    const marcar = (minutos) => { for (const r of radios) r.checked = Number(r.value) === minutos; };
    return h('fieldset', { class: 'opcoes' },
      h('legend', { class: 'campo-rotulo' }, TX.PRAZO_LEGENDA),
      OPCOES_DE_PRAZO.map((o) => {
        const radio = h('input', { type: 'radio', name: nome, value: String(o.minutos), checked: o.minutos === atual, onchange: () => aoMudarPrazo(o, marcar) });
        radios.push(radio);
        return h('label', { class: 'opcao' }, radio, h('span', null, h('strong', null, o.rotulo), h('small', null, o.ajuda)));
      }));
  }

  function desenhar({ foco = null, frase = null } = {}) {
    if (!t.vivo) return;
    const e = modoDemo() ? 'C' : estadoDaTrava();
    t.estado = e;
    const filhos = [];
    const rotulo = e === 'D' || e === 'E' ? ['ok', 'Ligada'] : e === 'C' ? ['neutro', 'Desligada'] : ['neutro', 'Indisponível'];
    filhos.push(h('p', null, selo(rotulo[0], rotulo[1])));
    if (e === 'A') filhos.push(h('p', null, TX.A));
    if (e === 'B') {
      filhos.push(h('p', null, TX.B), h('div', { class: 'cartao-acoes' }, botao('conferir', 'Conferir de novo', ['botao--primario'], aoToqueConferir)));
    }
    if (e === 'C') {
      filhos.push(h('p', null, TX.C), h('p', { class: 'nota' }, TX.C_PEQUENO));
      if (bio.aparelho().iphone) filhos.push(h('p', { class: 'nota' }, TX.C_IPHONE));
      const ligar = botao('ligar', 'Ligar a trava', ['botao--primario'], aoToqueLigar);
      if (modoDemo()) {
        ligar.disabled = true;
        filhos.push(h('p', { class: 'leitura' }, TX.DEMO));
      }
      filhos.push(h('div', { class: 'cartao-acoes' }, ligar));
    }
    if (e === 'D') {
      filhos.push(h('p', null, TX.D),
        h('div', { class: 'cartao-acoes' },
          botao('testar', 'Testar agora', ['botao--primario'], aoToqueTestar),
          botao('trancar', 'Trancar agora', [], aoToqueTrancar)),
        prazos(),
        h('p', { class: 'nota' }, TX.PEQUENO_1),
        h('p', { class: 'nota' }, TX.PEQUENO_2),
        h('div', { class: 'cartao-acoes' },
          botao('refazer', 'Refazer a trava', [], aoToqueRefazer),
          botao('desligar', 'Desligar a trava', ['botao--discreto'], aoToqueDesligar)));
    }
    if (e === 'E') {
      filhos.push(h('p', null, TX.E), h('div', { class: 'cartao-acoes' }, botao('refazer', 'Refazer a trava', ['botao--primario'], aoToqueRefazer)));
    }
    preencher(miolo, filhos);
    if (frase) dizer(frase); else calar();
    if (foco) focar(miolo.querySelector(`[data-acao="${foco}"]`));
  }

  const desligarAuth = auth.aoMudar((evento) => {
    if (!t.vivo || t.minhaMudanca || evento.tipo !== 'biometria') return;
    if (estadoDaTrava() !== t.estado) desenhar();
  });

  desenhar();
  // confirma se o celular tem bloqueio de tela (so muda o desenho se a resposta mudar o estado)
  if (bio.suportado() && !auth.biometriaLigada() && !modoDemo()) {
    bio.disponivel().then((resposta) => {
      ultimaDisponibilidade = resposta;
      if (t.vivo && !t.pendente && estadoDaTrava() !== t.estado) desenhar();
    });
  }
}
