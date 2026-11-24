// Icones do aplicativo: tracos simples em 24x24, desenhados com createElementNS (nenhum arquivo de imagem, nenhum HTML em texto).
// Herdam a cor do texto (currentColor). Sem `titulo` o icone e decorativo e fica escondido do leitor de tela.
//
//   icone('alerta')                       -> decorativo, 20 px
//   icone('ok', { tamanho: 24, titulo: 'Conferido' })

import { svg } from './ui.js';

const ICONES = {
  inicio: [['path', { d: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }]],
  lista: [['path', { d: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01' }]],
  gastos: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]],
  cartao: [['rect', { x: 2, y: 5, width: 20, height: 14, rx: 2 }], ['path', { d: 'M2 10h20M6 15h4' }]],
  banco: [['path', { d: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z' }]],
  mais: [['circle', { cx: 5, cy: 12, r: 1.6, fill: 'currentColor' }], ['circle', { cx: 12, cy: 12, r: 1.6, fill: 'currentColor' }], ['circle', { cx: 19, cy: 12, r: 1.6, fill: 'currentColor' }]],
  barras: [['path', { d: 'M7 17V11M12 17V7M17 17v-4' }]],
  voltar: [['path', { d: 'M19 12H5M12 19l-7-7 7-7' }]],
  anterior: [['path', { d: 'M15 18l-6-6 6-6' }]],
  seguinte: [['path', { d: 'M9 18l6-6-6-6' }]],
  atualizar: [['path', { d: 'M21 12a9 9 0 1 1-3-6.7' }], ['path', { d: 'M21 3v6h-6' }]],
  alerta: [['path', { d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' }], ['path', { d: 'M12 9v4M12 17h.01' }]],
  ok: [['path', { d: 'M22 11.1V12a10 10 0 1 1-5.9-9.1' }], ['path', { d: 'M22 4 12 14l-3-3' }]],
  info: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 16v-4M12 8h.01' }]],
  cadeado: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }], ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }]],
  sair: [['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' }]],
  olho: [['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
  olhoRisco: [['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z' }], ['path', { d: 'M3 3l18 18' }]],
  copiar: [['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2 }], ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }]],
  fechar: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
  semRede: [['path', { d: 'M2 8.8a15 15 0 0 1 4.2-2.6M5 12.9a10 10 0 0 1 5.2-2.7M10.7 16.4a5 5 0 0 1 2.6 0M12 20h.01M8.5 4.4A15 15 0 0 1 22 8.8M19 12.9a10 10 0 0 0-2.2-1.7M2 2l20 20' }]],
  computador: [['rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }], ['path', { d: 'M8 21h8M12 17v4' }]],
  pessoas: [['path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['path', { d: 'M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' }]],
  lua: [['path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }]],
  escudo: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }]],
  busca: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M21 21l-4.3-4.3' }]],
  email: [['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }], ['path', { d: 'M22 7l-10 6L2 7' }]],
  celular: [['rect', { x: 6, y: 2, width: 12, height: 20, rx: 3 }], ['path', { d: 'M11 18h2' }]],
  chave: [['circle', { cx: 7.5, cy: 15.5, r: 5.5 }], ['path', { d: 'M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3' }]],
  qr: [['rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }], ['rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }], ['rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }], ['path', { d: 'M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1' }]],
  baixar: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' }]],
  compartilhar: [['path', { d: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13' }]],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  avancar: [['path', { d: 'M5 12h14M12 5l7 7-7 7' }]],
  filtro: [['path', { d: 'M3 5h18M6 12h12M10 19h4' }]],
  relogio: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
};

export const NOMES_DE_ICONES = Object.keys(ICONES);

export function icone(nome, { tamanho = 20, titulo = null, classe = null } = {}) {
  const formas = ICONES[nome];
  if (!formas) throw new Error(`Icone desconhecido: ${nome}`);
  const atributos = {
    class: ['icone', classe],
    width: tamanho,
    height: tamanho,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': nome === 'barras' ? 3 : 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    focusable: 'false',
  };
  if (titulo) {
    atributos.role = 'img';
    atributos['aria-label'] = titulo;
  } else {
    atributos['aria-hidden'] = 'true';
  }
  return svg('svg', atributos, ...formas.map(([tag, attrs]) => svg(tag, attrs)));
}
