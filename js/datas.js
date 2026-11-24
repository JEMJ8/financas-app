// Datas e horas do aplicativo. Nenhuma tela calcula data por conta propria.
//
// Regras:
//  - Datas viajam como TEXTO "AAAA-MM-DD" e meses como "AAAA-MM" (o formato do computador). Sao lidas por expressao regular e a conta e feita
//    com Date.UTC: o fuso do aparelho nunca muda o dia de um lancamento.
//  - Momentos (a hora em que o computador mandou a copia, a hora em que este celular baixou) sao instantes: aparecem no relogio do celular.
//  - O relogio do aparelho pode estar errado: quando a nuvem responde, o cabecalho Date corrige a conta (agoraCerto), para o token nao
//    parecer vencido o tempo todo e para o aviso de "copia antiga" nao errar.

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const dois = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- dias "AAAA-MM-DD" e meses "AAAA-MM"

function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** [ano, mes, dia] de um texto AAAA-MM-DD que existe no calendario; senao null. */
export function partesDaData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === 'string' ? iso : '');
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes(ano, mes)) return null;
  return [ano, mes, dia];
}

export function mesValido(am) {
  const m = /^(\d{4})-(\d{2})$/.exec(typeof am === 'string' ? am : '');
  return Boolean(m) && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** 09/11/2026 */
export function dataBR(iso) {
  const p = partesDaData(iso);
  return p ? `${dois(p[2])}/${dois(p[1])}/${p[0]}` : '';
}

/** segunda-feira, 09/11 (o ano so aparece quando `comAno`) */
export function diaDaLista(iso, comAno = false) {
  const p = partesDaData(iso);
  if (!p) return 'Sem data';
  const semana = DIAS_SEMANA[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
  return `${semana}, ${dois(p[2])}/${dois(p[1])}${comAno ? `/${p[0]}` : ''}`;
}

/** "novembro de 2026" */
export function mesPorExtenso(am) {
  if (!mesValido(am)) return 'mês sem data';
  return `${MESES[Number(am.slice(5, 7)) - 1]} de ${am.slice(0, 4)}`;
}

/** "nov/26" */
export function mesCurto(am) {
  if (!mesValido(am)) return '?';
  return `${MESES_ABREV[Number(am.slice(5, 7)) - 1]}/${am.slice(2, 4)}`;
}

/** "nov" */
export function mesAbrev(am) {
  if (!mesValido(am)) return '?';
  return MESES_ABREV[Number(am.slice(5, 7)) - 1];
}

/** O mes `n` meses depois de `am` (n negativo volta). */
export function somarMeses(am, n) {
  const ano = Number(am.slice(0, 4));
  const mes = Number(am.slice(5, 7));
  const indice = ano * 12 + (mes - 1) + n;
  return `${String(Math.floor(indice / 12)).padStart(4, '0')}-${dois((indice % 12) + 1)}`;
}

/** Os `quantos` meses de calendario que terminam em `ate` (inclusive), do mais antigo para o mais novo. */
export function mesesAte(ate, quantos) {
  return Array.from({ length: quantos }, (_, i) => somarMeses(ate, i - quantos + 1));
}

// ---------------------------------------------------------------- relogio

let desvioDoRelogioMs = 0;

export function definirDesvioDoRelogio(ms) {
  desvioDoRelogioMs = Number.isFinite(ms) ? ms : 0;
}

/** O instante de agora (ms) pelo relogio do servidor, quando ja se conhece o desvio. */
export function agoraCerto() {
  return Date.now() + desvioDoRelogioMs;
}

const MESES_EM_INGLES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Instante de um cabecalho "Date" de resposta HTTP ("Mon, 09 Nov 2026 18:00:00 GMT"), ou NaN. */
export function epochDeDataHttp(texto) {
  const m = /^[A-Za-z]{3}, (\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(typeof texto === 'string' ? texto.trim() : '');
  if (!m) return NaN;
  const mes = MESES_EM_INGLES.indexOf(m[2].toLowerCase());
  if (mes < 0) return NaN;
  return Date.UTC(Number(m[3]), mes, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
}

const MOMENTO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/** Instante (ms) de um texto ISO ("2026-11-24T00:39:00-03:00", "...Z" ou sem fuso = hora do aparelho). NaN se nao entender. */
export function epochDe(texto) {
  const m = MOMENTO.exec(typeof texto === 'string' ? texto.trim() : '');
  if (!m) return NaN;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const hora = m[4] === undefined ? 0 : Number(m[4]);
  const minuto = m[5] === undefined ? 0 : Number(m[5]);
  const segundo = m[6] === undefined ? 0 : Number(m[6]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes(ano, mes) || hora > 23 || minuto > 59 || segundo > 59) return NaN;
  const ms = m[7] === undefined ? 0 : Math.floor(Number(`0.${m[7]}`) * 1000);
  if (m[8] === undefined) return new Date(ano, mes - 1, dia, hora, minuto, segundo, ms).getTime();
  let deslocamentoMin = 0;
  if (m[8].toUpperCase() !== 'Z') {
    const sinal = m[8][0] === '-' ? -1 : 1;
    const digitos = m[8].slice(1).replace(':', '');
    const hh = Number(digitos.slice(0, 2));
    const mm = digitos.length > 2 ? Number(digitos.slice(2)) : 0;
    if (hh > 14 || mm > 59) return NaN;
    deslocamentoMin = sinal * (hh * 60 + mm);
  }
  return Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, ms) - deslocamentoMin * 60000;
}

/** "24/11/2026 às 00:39" no relogio do celular. */
export function momentoPorExtenso(epoch) {
  if (!Number.isFinite(epoch)) return '';
  const d = new Date(epoch);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** "hoje às 00:39", "ontem às 18:10", "22/11 às 09:00" (com o ano quando for outro). */
export function quandoFoi(epoch, agora = agoraCerto()) {
  if (!Number.isFinite(epoch)) return '';
  const d = new Date(epoch);
  const hoje = new Date(agora);
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const diaDe = (x) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const dias = Math.round((diaDe(hoje) - diaDe(d)) / 86400000);
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  const data = d.getFullYear() === hoje.getFullYear() ? `${dois(d.getDate())}/${dois(d.getMonth() + 1)}` : `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${data} às ${hora}`;
}

/** "2 dias", "5 horas", "40 min". */
export function duracaoEmPalavras(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? '1 hora' : `${h} horas`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
