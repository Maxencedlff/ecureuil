// Export / import des données (fichiers locaux).
import { validateState } from './store.js';

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJson(state, today) {
  download(`ecureuil-${today}.json`, JSON.stringify(state, null, 2), 'application/json');
}

/** CSV au format français (point-virgule, virgule décimale) pour Excel et Numbers. */
export function toCsv(state) {
  const cats = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).map((t) => [
    t.date,
    t.type === 'income' ? 'Revenu' : 'Dépense',
    cats[t.categoryId] || '',
    t.note || '',
    ((t.type === 'income' ? 1 : -1) * t.amount / 100).toFixed(2).replace('.', ','),
  ].map(cell).join(';'));
  return `﻿${['Date;Type;Catégorie;Note;Montant (€)', ...rows].join('\r\n')}`;
}

export function exportCsv(state, today) {
  download(`ecureuil-${today}.csv`, toCsv(state), 'text/csv;charset=utf-8');
}

export async function importJson(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Fichier trop gros.');
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde lisible.");
  }
  return validateState(raw);
}
