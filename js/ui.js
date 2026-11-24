// Montagem de elementos sem HTML em texto. REGRA DE OURO: tudo que vem da nuvem entra na tela como TEXTO (filho de h() ou textContent).
// Nenhum arquivo do aplicativo usa innerHTML, insertAdjacentHTML ou outerHTML: descricao de lancamento, nome de estabelecimento e
// titulo de pendencia podem ter < > & e aspas.
//
//   h('div', { class: 'cartao', onclick: fn }, h('strong', null, nome), ' ', texto)
//
// Atributos: `class` aceita lista; `dataset` aceita objeto; `onxxx` aceita funcao; true liga o atributo; false/null/undefined sao ignorados.
// Filhos: texto, numero, elemento, lista (achatada) ou null/false (ignorados).

const NS_SVG = 'http://www.w3.org/2000/svg';
// atributos que nunca passam: estilo inline (a politica de seguranca bloqueia) e o que carrega HTML cru
const PROIBIDO = /^(style|srcdoc)$|html$/i;
const COM_ENDERECO = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

function aplicar(el, atributos) {
  if (!atributos) return;
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (PROIBIDO.test(nome)) throw new Error(`Atributo nao permitido: ${nome}`);
    if (nome === 'class') {
      el.setAttribute('class', Array.isArray(valor) ? valor.filter(Boolean).join(' ') : String(valor));
    } else if (nome === 'dataset') {
      Object.assign(el.dataset, valor);
    } else if (nome.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(nome.slice(2), valor);
    } else if (valor === true) {
      el.setAttribute(nome, '');
    } else {
      const texto = String(valor);
      if (COM_ENDERECO.has(nome) && /^\s*(javascript|vbscript|data):/i.test(texto) && !/^\s*data:image[/]/i.test(texto)) {
        throw new Error('Endereco nao permitido');
      }
      el.setAttribute(nome, texto);
    }
  }
}

function anexar(pai, filhos) {
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false || filho === true) continue;
    if (Array.isArray(filho)) anexar(pai, filho);
    else if (filho instanceof Node) pai.appendChild(filho);
    else pai.appendChild(document.createTextNode(String(filho)));
  }
}

export function h(tag, atributos, ...filhos) {
  const el = document.createElement(tag);
  aplicar(el, atributos);
  anexar(el, filhos);
  return el;
}

export function svg(tag, atributos, ...filhos) {
  const el = document.createElementNS(NS_SVG, tag);
  aplicar(el, atributos);
  anexar(el, filhos);
  return el;
}

/** Acrescenta filhos no fim de `pai` com as mesmas regras de h(): listas sao achatadas e null/false sao ignorados.
 *  (Element.append escreveria "null" e "[object HTMLElement]" na tela.) */
export function acrescentar(pai, ...filhos) {
  anexar(pai, filhos);
  return pai;
}

/** Troca o conteudo de `pai` por estes filhos. */
export function preencher(pai, ...filhos) {
  pai.replaceChildren();
  anexar(pai, filhos);
  return pai;
}

/** Valor dinamico de estilo (largura de barra, cor da pessoa) sem atributo style: usa a CSSOM, que a politica de seguranca permite. */
export function estilo(el, propriedades) {
  for (const [nome, valor] of Object.entries(propriedades)) el.style.setProperty(nome, String(valor));
  return el;
}

let contador = 0;
/** Identificador unico para ligar rotulo e campo (id/for, aria-describedby). */
export function novoId(prefixo = 'id') {
  contador += 1;
  return `${prefixo}-${contador}`;
}

/** Link para fora do aplicativo: so https, abre em outra aba sem passar de onde veio. Senao devolve so o texto. */
export function linkExterno(endereco, rotulo, atributos = {}) {
  let seguro = null;
  try {
    const u = new URL(String(endereco));
    if (u.protocol === 'https:') seguro = u.href;
  } catch {
    seguro = null;
  }
  if (!seguro) return null;
  return h('a', { ...atributos, href: seguro, target: '_blank', rel: 'noopener noreferrer' }, rotulo);
}

/** Fala uma frase para o leitor de tela (regiao aria-live do index.html) sem mudar nada na tela. */
export function anunciar(frase) {
  const regiao = document.getElementById('anuncio');
  if (!regiao) return;
  regiao.textContent = '';
  window.setTimeout(() => { regiao.textContent = frase; }, 30);
}

export function esperar(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Foco sem rolar a pagina. */
export function focar(el) {
  if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
}

/** Copia texto para a area de transferencia. Devolve true/false (o navegador pode negar). */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
