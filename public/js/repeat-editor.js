// Éditeur de répétition (dans les feuilles « opération » et « récurrence »).
// Menu de raccourcis + réglages fins : intervalle, jours de la semaine, dernier jour du mois, fin.
import { PRESETS, presetOf, describeRule, nextDates, weekdayOf, isValidRule, schedule } from './recurrence.js';
import { esc } from './format.js';

const UNIT_LABELS = { day: 'jour(s)', week: 'semaine(s)', month: 'mois', year: 'an(s)' };
const WEEK = [[1, 'L', 'lundi'], [2, 'M', 'mardi'], [3, 'M', 'mercredi'], [4, 'J', 'jeudi'], [5, 'V', 'vendredi'], [6, 'S', 'samedi'], [0, 'D', 'dimanche']];
const firstDates = (rule, n) => {
  const out = [];
  for (const d of schedule(rule)) {
    out.push(d);
    if (out.length >= n) break;
  }
  return out;
};
const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** HTML de l'éditeur. `rule` = règle existante ou null ; allowNone = proposer « Jamais ». */
export function repeatEditorHtml(rule, { allowNone = true } = {}) {
  const preset = presetOf(rule);
  const options = PRESETS.filter((p) => allowNone || p.id !== 'none')
    .map((p) => `<option value="${p.id}" ${p.id === preset ? 'selected' : ''}>${p.label}</option>`).join('');
  const end = rule?.end || { type: 'never' };
  return `<div class="field-group repeat">
    <label class="field"><span>Répéter</span><select name="rpPreset" aria-label="Répéter">${options}</select></label>
    <div class="field rp-custom" hidden><span>Tous les</span>
      <input name="rpEvery" type="number" inputmode="numeric" min="1" max="999" value="${rule?.every || 1}" aria-label="Intervalle">
      <select name="rpUnit" aria-label="Unité">${Object.entries(UNIT_LABELS).map(([u, l]) => `<option value="${u}" ${rule?.unit === u ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="rp-week" hidden role="group" aria-label="Jours de la semaine">${WEEK.map(([d, l, name]) => `<button type="button" data-wd="${d}" aria-label="${name}" aria-pressed="false">${l}</button>`).join('')}</div>
    <label class="toggle-row rp-month" hidden><span>Le dernier jour du mois<small class="rp-month-hint"></small></span>
      <input type="checkbox" name="rpLast" role="switch" ${rule?.monthMode === 'last' ? 'checked' : ''}><i aria-hidden="true"></i></label>
    <label class="field rp-endrow" hidden><span>Fin</span><select name="rpEnd" aria-label="Fin de la répétition">
      <option value="never" ${end.type === 'never' ? 'selected' : ''}>Jamais</option>
      <option value="date" ${end.type === 'date' ? 'selected' : ''}>À une date</option>
      <option value="count" ${end.type === 'count' ? 'selected' : ''}>Après N fois</option></select></label>
    <label class="field rp-enddate" hidden><span>Jusqu'au</span><input name="rpEndDate" type="date" value="${esc(end.date || '')}"></label>
    <label class="field rp-endcount" hidden><span>N (en tout)</span><input name="rpEndCount" type="number" inputmode="numeric" min="1" max="999" value="${end.count || 12}"></label>
    <p class="rp-preview" hidden></p>
  </div>`;
}

/**
 * Branche l'éditeur. getStart() renvoie la date de départ (champ date du formulaire).
 * previewAfter() : date après laquelle montrer les passages (null = depuis le départ, inclus).
 * Renvoie { read, refresh } : read() -> { rule } (rule null si « Jamais ») ou { error }.
 */
export function bindRepeatEditor(root, { rule, getStart, previewAfter = () => null }) {
  const q = (s) => root.querySelector(s);
  const form = root.closest('form');
  let weekdays = rule?.weekdays ? [...rule.weekdays] : null; // null = jour de la date de départ
  let weekdaysTouched = Boolean(rule?.weekdays);

  const state = () => {
    const presetId = form.rpPreset.value;
    if (presetId === 'none') return null;
    const p = PRESETS.find((x) => x.id === presetId);
    const unit = presetId === 'custom' ? form.rpUnit.value : p.unit;
    const every = presetId === 'custom' ? Number(form.rpEvery.value) : p.every;
    const start = getStart();
    const r = { startDate: start, unit, every, end: { type: form.rpEnd.value } };
    if (unit === 'week') r.weekdays = presetId === 'workdays' ? [1, 2, 3, 4, 5] : weekdays?.length ? weekdays : [weekdayOf(start)];
    if (unit === 'month' || unit === 'year') r.day = Number(start.slice(8, 10));
    if (unit === 'month') r.monthMode = form.rpLast.checked ? 'last' : 'day';
    if (r.end.type === 'date') r.end.date = form.rpEndDate.value;
    if (r.end.type === 'count') r.end.count = Number(form.rpEndCount.value);
    return r;
  };

  function refresh() {
    const r = state();
    const presetId = form.rpPreset.value;
    q('.rp-custom').hidden = presetId !== 'custom';
    q('.rp-week').hidden = !r || r.unit !== 'week' || presetId === 'workdays';
    q('.rp-month').hidden = !r || r.unit !== 'month';
    q('.rp-endrow').hidden = !r;
    q('.rp-enddate').hidden = !r || r.end.type !== 'date';
    q('.rp-endcount').hidden = !r || r.end.type !== 'count';
    const preview = q('.rp-preview');
    preview.hidden = !r;
    if (!r) return;
    if (r.unit === 'week') {
      root.querySelectorAll('[data-wd]').forEach((b) => {
        const on = r.weekdays.includes(Number(b.dataset.wd));
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on);
      });
    }
    const d = Number(r.startDate.slice(8, 10));
    q('.rp-month-hint').textContent = form.rpLast.checked ? 'Ex. 30 avril, 28 février' : `Sinon le ${d === 1 ? '1er' : d} de chaque mois`;
    const check = read();
    if (check.error) {
      preview.innerHTML = `<span class="expense">${esc(check.error)}</span>`;
      return;
    }
    const after = previewAfter();
    const dates = after ? nextDates(r, after, 3) : firstDates(r, 3);
    const label = after ? 'Prochains passages' : 'Passages';
    preview.innerHTML = `<b>${esc(describeRule(r))}</b><br>${dates.length ? `${label} : ${dates.map(shortDate).join(', ')}${dates.length === 3 ? '…' : ''}` : 'Plus aucun passage à venir.'}`;
  }

  function read() {
    const r = state();
    if (!r) return { rule: null };
    if (!Number.isInteger(r.every) || r.every < 1 || r.every > 999) return { error: "L'intervalle doit être un nombre entre 1 et 999." };
    if (r.end.type === 'date' && (!r.end.date || r.end.date < r.startDate)) return { error: 'Choisis une date de fin après la date de départ.' };
    if (r.end.type === 'count' && (!Number.isInteger(r.end.count) || r.end.count < 1 || r.end.count > 999)) return { error: 'Nombre de fois entre 1 et 999.' };
    if (!isValidRule(r)) return { error: 'Répétition invalide.' };
    if (!firstDates(r, 1).length) return { error: 'Aucun passage avec ces réglages.' };
    return { rule: r };
  }

  root.addEventListener('change', refresh);
  root.addEventListener('input', (e) => { if (e.target.type === 'number' || e.target.type === 'date') refresh(); });
  root.querySelector('.rp-week').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wd]');
    if (!b) return;
    const d = Number(b.dataset.wd);
    const current = state().weekdays;
    const nextDays = current.includes(d) ? current.filter((x) => x !== d) : [...current, d];
    if (!nextDays.length) return; // au moins un jour
    weekdays = nextDays;
    weekdaysTouched = true;
    refresh();
  });
  // Quand la date de départ change, le jour de semaine par défaut suit (si on n'a pas choisi les jours).
  const onStartChange = () => {
    if (!weekdaysTouched) weekdays = null;
    refresh();
  };
  refresh();
  return { read, refresh: onStartChange };
}
