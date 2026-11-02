// Mise en forme pour l'affichage (français).

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const moneyRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** 123456 -> "1 234,56 €" ; round: true -> "1 235 €" */
export const eur = (cents, { round = false } = {}) => (round ? moneyRound : money).format(cents / 100);

/** Centimes -> texte éditable "12,50" */
export const centsToInput = (cents) => (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

export function dayLabel(iso, today) {
  if (iso === today) return "Aujourd'hui";
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  if (Math.round((t - d) / 86400000) === 1) return 'Hier';
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const pct = (x) => `${Math.round(x * 100)} %`;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Échappe tout texte saisi par l'utilisateur avant de l'insérer dans le HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
