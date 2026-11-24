// A casca do aplicativo: topo (titulo, selo "Só leitura", botao de baixar de novo e a linha com a data da copia) e a barra de baixo
// (Inicio, Lancamentos, Gastos, Contas, Mais). As telas nao mexem aqui: usam ctx.titulo() e o registro de rota (aba).

import { h, preencher, anunciar } from './ui.js';
import { icone } from './icones.js';
import * as dados from './dados.js';
import { quandoFoi, momentoPorExtenso } from './datas.js';

export const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'inicio' },
  { id: 'lancamentos', rotulo: 'Lançamentos', icone: 'lista' },
  { id: 'gastos', rotulo: 'Gastos', icone: 'gastos' },
  { id: 'contas', rotulo: 'Contas', icone: 'cartao' },
  { id: 'mais', rotulo: 'Mais', icone: 'mais' },
];

const TITULO_PADRAO = 'Finanças da casa';

/** A frase da linha de baixo do topo, sobre a copia: { texto, alerta }. */
export function fraseDaCopia(estado = dados.estado()) {
  const c = estado.computador;
  const doComputador = c.conhecido ? `Cópia do computador de ${quandoFoi(c.epoch)}` : 'Data da cópia do computador desconhecida';
  const prefixo = estado.demo ? 'Demonstração com dados inventados. ' : '';
  if (estado.atualizando && !estado.carregado) return { texto: `${prefixo}Baixando a cópia…`, alerta: false };
  if (estado.offline) {
    const baixada = estado.local ? ` Mostrando o que foi baixado ${quandoFoi(estado.local)}.` : '';
    return { texto: `${prefixo}Sem internet.${baixada} ${doComputador}.`, alerta: true };
  }
  if (estado.erro) return { texto: `${prefixo}${estado.erro} ${doComputador}.`, alerta: true };
  if (c.velho) return { texto: `${prefixo}${doComputador}, há mais de 2 dias.`, alerta: true };
  return { texto: `${prefixo}${doComputador}${estado.atualizando ? ' · baixando de novo…' : ''}`, alerta: false };
}

export function montarCasca() {
  const topo = document.getElementById('topo');
  const barra = document.getElementById('barra');
  const conteudo = document.getElementById('conteudo');
  const titulo = document.getElementById('titulo');
  const linhaDaCopia = document.getElementById('topo-copia');
  const botaoAtualizar = document.getElementById('atualizar');

  preencher(botaoAtualizar, icone('atualizar', { tamanho: 22 }));
  // Enquanto baixa o botao NAO fica `disabled` (o navegador tira o foco): fica aria-disabled com aria-busy, e o toque repetido para aqui.
  botaoAtualizar.addEventListener('click', () => {
    if (botaoAtualizar.getAttribute('aria-busy') === 'true') return;
    dados.atualizar();
  });

  const itens = new Map();
  for (const aba of ABAS) {
    const contador = h('span', { class: 'barra-contador', hidden: true });
    const item = h('a', { class: 'barra-item', href: `#${aba.id}` },
      icone(aba.icone, { tamanho: 24 }),
      h('span', { class: 'barra-rotulo' }, aba.rotulo),
      contador);
    itens.set(aba.id, { item, contador, aba });
  }
  preencher(barra, [...itens.values()].map((x) => x.item));

  topo.hidden = false;
  barra.hidden = false;
  conteudo.classList.remove('sem-barra', 'conteudo--entrada');

  function desenharTopo() {
    const estado = dados.estado();
    const frase = fraseDaCopia(estado);
    linhaDaCopia.textContent = frase.texto;
    linhaDaCopia.classList.toggle('topo-copia--alerta', frase.alerta);
    if (estado.computador.conhecido) linhaDaCopia.setAttribute('title', `Cópia do computador de ${momentoPorExtenso(estado.computador.epoch)}`);
    botaoAtualizar.classList.toggle('girando', estado.atualizando);
    if (estado.atualizando) {
      botaoAtualizar.setAttribute('aria-busy', 'true');
      botaoAtualizar.setAttribute('aria-disabled', 'true');
    } else {
      botaoAtualizar.removeAttribute('aria-busy');
      botaoAtualizar.removeAttribute('aria-disabled');
    }
    botaoAtualizar.setAttribute('aria-label', estado.atualizando ? 'Baixando a cópia…' : 'Baixar a cópia de novo');
    // a barra de Mais mostra quantas decisoes esperam no computador
    const n = dados.obter('pendencia').length;
    const { contador, item, aba } = itens.get('mais');
    contador.hidden = n === 0;
    contador.textContent = n > 99 ? '99+' : String(n);
    item.setAttribute('aria-label', n ? `${aba.rotulo}, ${n} ${n === 1 ? 'decisão espera' : 'decisões esperam'} no computador` : aba.rotulo);
  }

  let anunciou = false;
  const desligar = dados.aoMudar(() => {
    const estado = dados.estado();
    desenharTopo();
    if (estado.atualizando) anunciou = true;
    else if (anunciou) {
      anunciou = false;
      anunciar(estado.offline ? 'Sem internet. Mostrando a cópia guardada neste celular.' : estado.erro ? 'Não foi possível baixar a cópia.' : 'Cópia baixada.');
    }
  });
  const relogio = window.setInterval(desenharTopo, 60000);   // "hoje às" vira "ontem às" sozinho
  desenharTopo();

  return {
    parar() { desligar(); window.clearInterval(relogio); },
    ganchos: {
      definirTitulo(texto) {
        titulo.textContent = texto || TITULO_PADRAO;
        document.title = texto && texto !== TITULO_PADRAO ? `${texto} · ${TITULO_PADRAO}` : TITULO_PADRAO;
      },
      marcarAba(id) {
        for (const [chave, { item }] of itens) {
          if (chave === id) item.setAttribute('aria-current', 'page');
          else item.removeAttribute('aria-current');
        }
      },
    },
  };
}
