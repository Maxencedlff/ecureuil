// Règles de répétition (calculs purs) : quand une opération récurrente tombe-t-elle ?
//
// Une règle : { startDate, unit: 'day'|'week'|'month'|'year', every: N,
//   weekdays?: [0..6] (0 = dimanche, pour 'week'), day?: 1..31 (pour 'month'/'year'),
//   monthMode?: 'day'|'last' (pour 'month'), end?: { type: 'never'|'date'|'count', date?, count? } }

export const UNITS = ['day', 'week', 'month', 'year'];
const MAX_STEPS = 20000; // garde-fou contre une boucle infinie (règle mal formée)

const pad = (n) => String(n).padStart(2, '0');
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (dt) => dt.toISOString().slice(0, 10);
export const addDays = (iso, n) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};
export const weekdayOf = (iso) => parse(iso).getUTCDay();
const mondayOf = (iso) => addDays(iso, -((weekdayOf(iso) + 6) % 7));
const daysIn = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

/** Toutes les dates de la règle, dans l'ordre, sans tenir compte de la fin. */
function* rawOccurrences(rule) {
  const s = rule.startDate;
  const every = Math.max(1, rule.every || 1);
  if (rule.unit === 'day') {
    for (let k = 0; ; k += every) yield addDays(s, k);
  } else if (rule.unit === 'week') {
    const days = rule.weekdays?.length ? rule.weekdays : [weekdayOf(s)];
    const monday = mondayOf(s);
    for (let w = 0; ; w += every) {
      for (let i = 0; i < 7; i++) {
        const d = addDays(monday, w * 7 + i);
        if (d >= s && days.includes(weekdayOf(d))) yield d;
      }
    }
  } else {
    const step = rule.unit === 'year' ? 12 * every : every;
    const day = rule.day || Number(s.slice(8, 10));
    for (let k = 0; ; k += step) {
      const ym = shiftMonth(s.slice(0, 7), k);
      const dd = rule.unit === 'month' && rule.monthMode === 'last' ? daysIn(ym) : Math.min(day, daysIn(ym));
      const d = `${ym}-${pad(dd)}`;
      if (d >= s) yield d;
    }
  }
}

/** Dates de la règle en respectant la fin (date ou nombre de fois). */
export function* schedule(rule) {
  let count = 0;
  let steps = 0;
  for (const d of rawOccurrences(rule)) {
    if (++steps > MAX_STEPS) return;
    if (rule.end?.type === 'date' && d > rule.end.date) return;
    if (rule.end?.type === 'count' && count >= rule.end.count) return;
    count++;
    yield d;
  }
}

/** Dates comprises dans ]after ; until] (after peut être null). */
export function datesBetween(rule, after, until) {
  const out = [];
  for (const d of schedule(rule)) {
    if (d > until) break;
    if (!after || d > after) out.push(d);
  }
  return out;
}

/** Les n prochaines dates strictement après `after`. */
export function nextDates(rule, after, n) {
  const out = [];
  for (const d of schedule(rule)) {
    if (d > after) out.push(d);
    if (out.length >= n) break;
  }
  return out;
}

// ---------- Raccourcis proposés dans le menu ----------
export const PRESETS = [
  { id: 'none', label: 'Jamais' },
  { id: 'day1', label: 'Chaque jour', unit: 'day', every: 1 },
  { id: 'workdays', label: 'Du lundi au vendredi', unit: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] },
  { id: 'week1', label: 'Chaque semaine', unit: 'week', every: 1 },
  { id: 'week2', label: 'Toutes les 2 semaines', unit: 'week', every: 2 },
  { id: 'week4', label: 'Toutes les 4 semaines', unit: 'week', every: 4 },
  { id: 'month1', label: 'Chaque mois', unit: 'month', every: 1 },
  { id: 'month2', label: 'Tous les 2 mois', unit: 'month', every: 2 },
  { id: 'month3', label: 'Chaque trimestre', unit: 'month', every: 3 },
  { id: 'month6', label: 'Tous les 6 mois', unit: 'month', every: 6 },
  { id: 'year1', label: 'Chaque année', unit: 'year', every: 1 },
  { id: 'custom', label: 'Personnalisé…' },
];

const sameDays = (a = [], b = []) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/** Retrouve le raccourci qui correspond à une règle (sinon « Personnalisé »). */
export function presetOf(rule) {
  if (!rule) return 'none';
  if (rule.unit === 'week' && rule.every === 1 && sameDays(rule.weekdays, [1, 2, 3, 4, 5])) return 'workdays';
  const p = PRESETS.find((x) => x.unit === rule.unit && x.every === rule.every && x.id !== 'workdays');
  return p ? p.id : 'custom';
}

// ---------- Description en français ----------
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const listFr = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`);
export const dateFr = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTH_NAMES[m - 1]} ${y}`;
};

/** « Toutes les 2 semaines, le vendredi », « Chaque mois, le dernier jour », etc. */
export function describeRule(rule) {
  const every = rule.every || 1;
  let s;
  if (rule.unit === 'day') s = every === 1 ? 'Chaque jour' : `Tous les ${every} jours`;
  else if (rule.unit === 'week') {
    const days = (rule.weekdays?.length ? rule.weekdays : [weekdayOf(rule.startDate)]);
    const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
    const names = sameDays(days, [1, 2, 3, 4, 5]) ? 'du lundi au vendredi' : ordered.length === 7 ? 'tous les jours' : `le ${listFr(ordered.map((d) => DAY_NAMES[d]))}`;
    s = every === 1 ? `Chaque semaine, ${names}` : `Toutes les ${every} semaines, ${names}`;
  } else if (rule.unit === 'month') {
    const day = rule.day || Number(rule.startDate.slice(8, 10));
    const when = rule.monthMode === 'last' ? 'le dernier jour' : `le ${day === 1 ? '1er' : day}`;
    s = every === 1 ? `Chaque mois, ${when}` : every === 3 ? `Chaque trimestre, ${when}` : `Tous les ${every} mois, ${when}`;
  } else {
    const [, m, d] = rule.startDate.split('-').map(Number);
    const when = `le ${(rule.day || d) === 1 ? '1er' : rule.day || d} ${MONTH_NAMES[m - 1]}`;
    s = every === 1 ? `Chaque année, ${when}` : `Tous les ${every} ans, ${when}`;
  }
  if (rule.end?.type === 'date') s += `, jusqu'au ${dateFr(rule.end.date)}`;
  if (rule.end?.type === 'count') s += `, ${rule.end.count} fois en tout`;
  return s;
}

// ---------- Validation et migration ----------
const isDate = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Règle bien formée ? (utilisé à l'import et au chargement) */
export function isValidRule(r) {
  if (!r || !isDate(r.startDate) || !UNITS.includes(r.unit)) return false;
  if (!Number.isInteger(r.every) || r.every < 1 || r.every > 999) return false;
  if (r.weekdays !== undefined && (!Array.isArray(r.weekdays) || !r.weekdays.length || !r.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) return false;
  if (r.day !== undefined && !(Number.isInteger(r.day) && r.day >= 1 && r.day <= 31)) return false;
  const e = r.end;
  if (e && !(e.type === 'never' || (e.type === 'date' && isDate(e.date)) || (e.type === 'count' && Number.isInteger(e.count) && e.count >= 1))) return false;
  return true;
}

/** Ancien format (« chaque mois le jour J », version 1 des données) -> règle complète. */
export function migrateV1(r) {
  const clamp = (ym) => `${ym}-${pad(Math.min(r.day, daysIn(ym)))}`;
  const { start, lastGenerated, ...rest } = r;
  return {
    ...rest,
    startDate: clamp(start),
    unit: 'month',
    every: 1,
    day: r.day,
    monthMode: 'day',
    end: { type: 'never' },
    lastDate: lastGenerated ? clamp(lastGenerated) : null,
  };
}
