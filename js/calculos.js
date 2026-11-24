// As contas do aplicativo, com as MESMAS definicoes do programa do computador (app/api.py):
//   renda   = soma de `valor` dos lancamentos com renda = true
//   consumo = soma de `valor` dos lancamentos com consumo = true
//   sobra   = renda - consumo
//   essencial / desejo / poupanca = consumo separado pela natureza ('essencial', 'desejo', 'poupanca_investimento'); natureza vazia = "sem natureza ainda"
//   mes     = ano_mes (AAAA-MM, o mes em que o dinheiro pesou no caixa)
//   filtro por pessoa = pessoa (quem pagou) OU destinatario (para quem foi), como no computador
// Dinheiro e sempre inteiro em centavos: nenhuma conta aqui usa fracao.
// Modulo puro: sem tela, sem rede, sem armazenamento.

import { chaveDaCategoria, SEM_EMPRESA, paraBusca, nomeDaSubcategoria, nomeDaCategoria } from './formato.js';
import { mesValido } from './datas.js';

// ---------------------------------------------------------------- formato das linhas (o contrato do espelho, app/nuvem/espelho.py)

export const COLUNAS = {
  pessoa: ['id', 'nome', 'crianca', 'tem_renda', 'cor', 'ordem'],
  conta: ['id', 'apelido', 'instituicao', 'tipo', 'final', 'titular', 'conta_pai'],
  lancamento: ['id', 'ano_mes', 'data', 'data_compra', 'valor', 'sinal', 'fluxo', 'descricao', 'empresa', 'categoria', 'subcategoria', 'natureza',
    'previsibilidade', 'pessoa', 'destinatario', 'conta_id', 'meio', 'parcela_atual', 'parcela_total', 'renda', 'consumo', 'tipo_entrada',
    'tipo_saida', 'pendente'],
  conferencia: ['id', 'conta_id', 'ano_mes', 'saldo_inicial', 'entradas', 'saidas', 'saldo_calculado', 'saldo_documento', 'diferenca', 'status'],
  fatura: ['id', 'conta_id', 'competencia', 'vencimento', 'valor_fatura', 'valor_pago', 'diferenca', 'status'],
  pendencia: ['id', 'tipo', 'gravidade', 'titulo', 'valor', 'pergunta'],
  estado_espelho: ['id', 'atualizado_em', 'contagens', 'pc_versao', 'periodo_de', 'periodo_ate'],
};
const INTEIROS = new Set(['valor', 'ordem', 'parcela_atual', 'parcela_total', 'saldo_inicial', 'entradas', 'saidas', 'saldo_calculado', 'saldo_documento',
  'diferenca', 'valor_fatura', 'valor_pago']);
const LOGICOS = new Set(['crianca', 'tem_renda', 'renda', 'consumo', 'pendente']);
const OBRIGATORIOS_INTEIROS = new Set(['valor']);   // valor de lancamento nunca e vazio: lixo vira 0, e o resto continua nulo

function inteiro(v, obrigatorio) {
  if (v === null || v === undefined || v === '') return obrigatorio ? 0 : null;
  const n = Number(v);
  if (!Number.isFinite(n)) return obrigatorio ? 0 : null;
  return Math.round(n);
}

function logico(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 't';
}

function texto(v) {
  if (v === null || v === undefined) return null;
  return typeof v === 'string' ? v : String(v);
}

/** So as colunas do contrato, com o tipo certo. Coluna a mais e descartada; coluna faltando vira null. Devolve null se nao tiver id. */
export function normalizarLinha(tabela, bruta) {
  const colunas = COLUNAS[tabela];
  if (!colunas || !bruta || typeof bruta !== 'object') return null;
  if (bruta.id === null || bruta.id === undefined || bruta.id === '') return null;
  const linha = {};
  for (const c of colunas) {
    const v = bruta[c];
    if (c === 'id') linha.id = tabela === 'estado_espelho' ? v : String(v);
    else if (c === 'contagens') linha.contagens = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    else if (INTEIROS.has(c) && tabela !== 'pendencia') linha[c] = inteiro(v, tabela === 'lancamento' && OBRIGATORIOS_INTEIROS.has(c));
    else if (c === 'valor') linha[c] = inteiro(v, false);
    else if (LOGICOS.has(c)) linha[c] = logico(v);
    else linha[c] = texto(v);
  }
  return linha;
}

export function normalizarTabela(tabela, linhas) {
  const saida = [];
  for (const bruta of Array.isArray(linhas) ? linhas : []) {
    const l = normalizarLinha(tabela, bruta);
    if (l) saida.push(l);
  }
  return saida;
}

// ---------------------------------------------------------------- ordem e indices

/** Mais recente primeiro (data, depois id), como a lista do computador. */
export function compararLancamentos(a, b) {
  const da = a.data || '';
  const db = b.data || '';
  if (da !== db) return da < db ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** { ordenados, porMes: Map(AAAA-MM -> linhas ordenadas), meses: [AAAA-MM do mais antigo ao mais novo] }. */
export function indexar(lancamentos) {
  const ordenados = [...lancamentos].sort(compararLancamentos);
  const porMes = new Map();
  for (const l of ordenados) {
    const chave = mesValido(l.ano_mes) ? l.ano_mes : '';
    if (!porMes.has(chave)) porMes.set(chave, []);
    porMes.get(chave).push(l);
  }
  const meses = [...porMes.keys()].filter(Boolean).sort();
  return { ordenados, porMes, meses };
}

// ---------------------------------------------------------------- somas

/** Renda, consumo, sobra e o consumo separado pela natureza. */
export function resumo(linhas) {
  const r = { renda: 0, consumo: 0, sobra: 0, essencial: 0, desejo: 0, poupanca: 0, semNatureza: 0, n: 0 };
  for (const l of linhas) {
    r.n += 1;
    if (l.renda) r.renda += l.valor;
    if (l.consumo) {
      r.consumo += l.valor;
      if (l.natureza === 'essencial') r.essencial += l.valor;
      else if (l.natureza === 'desejo') r.desejo += l.valor;
      else if (l.natureza === 'poupanca_investimento') r.poupanca += l.valor;
      else r.semNatureza += l.valor;
    }
  }
  r.sobra = r.renda - r.consumo;
  return r;
}

function agruparConsumo(linhas, chaveDe) {
  const mapa = new Map();
  for (const l of linhas) {
    if (!l.consumo) continue;
    const chave = chaveDe(l);
    if (chave === undefined) continue;
    const atual = mapa.get(chave) || { chave, valor: 0, n: 0 };
    atual.valor += l.valor;
    atual.n += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor || String(a.chave).localeCompare(String(b.chave)));
}

/** Consumo por categoria (vazio e Diversos juntos, como "Sem categoria"). */
export function porCategoria(linhas) {
  return agruparConsumo(linhas, (l) => chaveDaCategoria(l.categoria));
}

/** Consumo por estabelecimento (empresa); sem empresa fica num grupo proprio. */
export function porEmpresa(linhas) {
  return agruparConsumo(linhas, (l) => (l.empresa && l.empresa.trim() ? l.empresa : SEM_EMPRESA));
}

/** Consumo por quem pagou (pessoa). Sem pessoa fica num grupo proprio (chave ''). */
export function porQuemPagou(linhas) {
  return agruparConsumo(linhas, (l) => (l.pessoa && l.pessoa.trim() ? l.pessoa : ''));
}

/** Renda por quem recebeu (pessoa). */
export function rendaPorPessoa(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    if (!l.renda) continue;
    const chave = l.pessoa && l.pessoa.trim() ? l.pessoa : '';
    mapa.set(chave, (mapa.get(chave) || 0) + l.valor);
  }
  return mapa;
}

/** Gasto COM uma pessoa (destinatario = nome), por item: subcategoria, senao categoria, senao "Sem categoria" (igual a tela Pessoas do computador). */
export function gastosCom(linhas, nome) {
  const itens = agruparConsumo(linhas.filter((l) => l.destinatario === nome), (l) => {
    if (l.subcategoria && l.subcategoria.trim()) return `s:${l.subcategoria}`;
    return `c:${chaveDaCategoria(l.categoria)}`;
  }).map((g) => ({ ...g, nome: g.chave.startsWith('s:') ? nomeDaSubcategoria(g.chave.slice(2)) : nomeDaCategoria(g.chave.slice(2)) }));
  return { total: itens.reduce((s, i) => s + i.valor, 0), n: itens.reduce((s, i) => s + i.n, 0), itens };
}

/** Variacao em % de `agora` sobre `antes` (inteiro), ou null quando nao ha base para comparar. */
export function variacao(agora, antes) {
  if (!antes) return null;
  return Math.round(((agora - antes) / Math.abs(antes)) * 100);
}

// ---------------------------------------------------------------- filtro da lista de lancamentos

const textosDeBusca = new WeakMap();
function textoDeBusca(l) {
  let t = textosDeBusca.get(l);
  if (t === undefined) {
    t = paraBusca(`${l.descricao || ''} ${l.empresa || ''}`);
    textosDeBusca.set(l, t);
  }
  return t;
}

/**
 * Filtra a lista (ja ordenada). `filtro`: { busca, tipo ('entrada'|'saida'|'movimentacao'|''), pessoa, categoria (chave), empresa
 * (texto, SEM_EMPRESA ou null), pendente (bool) }. O periodo e escolhido antes, por quem chama (lista do mes ou de varios meses).
 */
export function filtrar(linhas, filtro) {
  const busca = paraBusca(filtro.busca || '').trim();
  const partes = busca ? busca.split(/\s+/) : [];
  return linhas.filter((l) => {
    if (filtro.tipo && l.fluxo !== filtro.tipo) return false;
    if (filtro.pessoa && l.pessoa !== filtro.pessoa && l.destinatario !== filtro.pessoa) return false;
    if (filtro.categoria && chaveDaCategoria(l.categoria) !== filtro.categoria) return false;
    if (filtro.empresa !== null && filtro.empresa !== undefined && filtro.empresa !== '') {
      const empresa = l.empresa && l.empresa.trim() ? l.empresa : SEM_EMPRESA;
      if (empresa !== filtro.empresa) return false;
    }
    if (filtro.pendente && !l.pendente) return false;
    if (partes.length) {
      const t = textoDeBusca(l);
      for (const p of partes) if (!t.includes(p)) return false;
    }
    return true;
  });
}
