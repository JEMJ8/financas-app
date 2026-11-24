// Escolhas da pessoa que valem entre as telas enquanto o aplicativo esta aberto (nada disto e gravado):
//  - o mes que o Inicio, os Gastos e as Pessoas mostram;
//  - o periodo dos Gastos (so o mes, 3 ou 6 meses terminando nele);
//  - os filtros da lista de Lancamentos.
// Tocar numa categoria, num estabelecimento ou numa pessoa em outra tela troca os filtros e leva a Lancamentos (verLancamentos).

import * as dados from './dados.js';
import * as rotas from './rotas.js';
import { mesesAte } from './datas.js';

export const PERIODOS = [
  { meses: 1, rotulo: 'Só o mês' },
  { meses: 3, rotulo: '3 meses' },
  { meses: 6, rotulo: '6 meses' },
];

const estado = {
  mes: null,
  periodo: 1,
  filtro: null,
  mostrarFiltros: false,
};

function filtroVazio(mes) {
  return { busca: '', tipo: '', pessoa: '', categoria: '', empresa: '', de: mes || '', ate: mes || '', pendente: false };
}

/** O mes em uso; volta ao ultimo mes com dados quando o escolhido nao existe mais (copia nova). */
export function mesAtual() {
  const meses = dados.meses();
  if (!estado.mes || !meses.includes(estado.mes)) estado.mes = dados.mesPadrao();
  return estado.mes;
}

/** Troca o mes do Inicio e dos Gastos. A lista de Lancamentos acompanha (a pessoa espera ver o mesmo mes ao trocar de aba). */
export function definirMes(am) {
  estado.mes = am;
  const f = filtro();
  f.de = am;
  f.ate = am;
}

export function periodo() {
  return estado.periodo;
}

export function definirPeriodo(meses) {
  estado.periodo = PERIODOS.some((p) => p.meses === meses) ? meses : 1;
}

/** [de, ate] do periodo dos Gastos (meses de calendario terminando no mes em uso). */
export function limitesDoPeriodo() {
  const ate = mesAtual();
  if (!ate) return [null, null];
  const lista = mesesAte(ate, estado.periodo);
  return [lista[0], ate];
}

/** Os filtros da lista de Lancamentos (objeto vivo: a tela muda os campos direto). */
export function filtro() {
  if (!estado.filtro) estado.filtro = filtroVazio(mesAtual());
  return estado.filtro;
}

export function limparFiltros({ manterPeriodo = true } = {}) {
  const f = filtro();
  const novo = filtroVazio(mesAtual());
  if (manterPeriodo) { novo.de = f.de; novo.ate = f.ate; }
  estado.filtro = novo;
}

export function filtrosAbertos(valor) {
  if (valor !== undefined) estado.mostrarFiltros = Boolean(valor);
  return estado.mostrarFiltros;
}

/** Vai para Lancamentos ja filtrada: `campos` troca so o que vier (categoria, empresa, pessoa, tipo, pendente) e o periodo [de, ate]. */
export function verLancamentos(campos = {}, { de = null, ate = null } = {}) {
  const novo = filtroVazio(mesAtual());
  Object.assign(novo, campos);
  novo.de = de === null ? mesAtual() || '' : de;
  novo.ate = ate === null ? mesAtual() || '' : ate;
  estado.filtro = novo;
  rotas.ir('lancamentos');
}
