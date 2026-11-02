// Graphiques en SVG (sans bibliothèque).
import { eur, shortMonth, esc } from './format.js';

/** Anneau de progression (objectifs). */
export function ring(pct, color, size = 56, stroke = 6) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct)) * c;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

/** Donut de répartition des dépenses ; segments = [{ value, color, label }]. */
export function donut(segments, centerTop, centerBottom, size = 200, stroke = 22) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = segments.length > 1 ? 2 : 0;
  let offset = 0;
  const arcs = total
    ? segments.map((s) => {
      const len = (s.value / total) * c;
      const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
        stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      offset += len;
      return arc;
    }).join('')
    : '';
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="Répartition des dépenses">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    ${arcs}
    <text x="50%" y="47%" text-anchor="middle" class="donut-top">${esc(centerTop)}</text>
    <text x="50%" y="60%" text-anchor="middle" class="donut-bottom">${esc(centerBottom)}</text>
  </svg>`;
}

/** Barres revenus / dépenses sur plusieurs mois. */
export function bars(rows, currentYm) {
  const w = 320;
  const h = 150;
  const pad = 22;
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const slot = w / rows.length;
  const bw = Math.min(14, slot / 3.2);
  const y = (v) => h - pad - (v / max) * (h - pad - 8);
  const body = rows.map((r, i) => {
    const x = i * slot + slot / 2;
    const cur = r.ym === currentYm;
    return `<g class="${cur ? 'cur' : ''}">
      <rect x="${x - bw - 1}" y="${y(r.income)}" width="${bw}" height="${h - pad - y(r.income)}" rx="3" fill="var(--income)"/>
      <rect x="${x + 1}" y="${y(r.expense)}" width="${bw}" height="${h - pad - y(r.expense)}" rx="3" fill="var(--expense)"/>
      <text x="${x}" y="${h - 6}" text-anchor="middle" class="bar-label">${shortMonth(r.ym)}</text>
    </g>`;
  }).join('');
  const label = rows.map((r) => `${shortMonth(r.ym)} : revenus ${eur(r.income, { round: true })}, dépenses ${eur(r.expense, { round: true })}`).join(' ; ');
  return `<svg class="bars" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
