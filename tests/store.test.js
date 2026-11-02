import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, defaultState, validateState, STORAGE_KEY } from '../public/js/store.js';
import { toCsv } from '../public/js/backup.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m };
};

test('premier lancement : catégories par défaut, sauvegarde à chaque modification', () => {
  const storage = memory();
  const store = createStore(storage);
  assert.ok(store.get().categories.length > 5);
  store.update((s) => s.transactions.push({ id: 'a', type: 'expense', amount: 500, categoryId: 'courses', date: '2026-11-02', note: '' }));
  assert.equal(JSON.parse(storage.m.get(STORAGE_KEY)).transactions.length, 1);
  assert.equal(createStore(storage).get().transactions.length, 1);
});

test('une sauvegarde corrompue ne casse pas l’appli', () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY, '{pas du json');
  assert.deepEqual(createStore(storage).get().transactions, []);
});

test('validateState écarte les entrées invalides et refuse les fichiers étrangers', () => {
  const s = defaultState();
  s.transactions = [
    { id: 'ok', type: 'expense', amount: 100, categoryId: 'courses', date: '2026-11-02' },
    { id: 'neg', type: 'expense', amount: -1, categoryId: 'courses', date: '2026-11-02' },
    { id: 'cat', type: 'expense', amount: 1, categoryId: 'inconnue', date: '2026-11-02' },
    { id: 'date', type: 'expense', amount: 1, categoryId: 'courses', date: 'hier' },
  ];
  assert.deepEqual(validateState(s).transactions.map((t) => t.id), ['ok']);
  assert.throws(() => validateState({ foo: 1 }), /non reconnu/);
  assert.throws(() => validateState({ version: 1, categories: [] }), /Aucune catégorie/);
});

test('runRecurring ajoute les opérations dues une seule fois', () => {
  const store = createStore(memory());
  store.update((s) => s.recurring.push({ id: 'r', type: 'income', amount: 150000, startDate: '2026-10-01', unit: 'month', every: 1, day: 1, categoryId: 'salaire', active: true, lastDate: null }));
  assert.equal(store.runRecurring('2026-11-02'), 2);
  assert.equal(store.runRecurring('2026-11-02'), 0);
  assert.equal(store.get().recurring[0].lastDate, '2026-11-01');
});

test('les données version 1 (chaque mois, jour J) sont converties', () => {
  const s = defaultState();
  s.version = 1;
  s.recurring = [{ id: 'r', type: 'expense', amount: 62000, day: 31, start: '2026-09', lastGenerated: '2026-10', categoryId: 'logement', note: 'Loyer', active: true }];
  const [r] = validateState(s).recurring;
  assert.equal(validateState(s).version, 2);
  assert.deepEqual(
    { startDate: r.startDate, unit: r.unit, every: r.every, day: r.day, lastDate: r.lastDate, note: r.note },
    { startDate: '2026-09-30', unit: 'month', every: 1, day: 31, lastDate: '2026-10-31', note: 'Loyer' },
  );
  assert.equal('start' in r || 'lastGenerated' in r, false);
});

test('une règle de répétition invalide est écartée à l’import', () => {
  const s = defaultState();
  s.recurring = [{ id: 'r', type: 'expense', amount: 1, startDate: '2026-01-01', unit: 'siècle', every: 1, categoryId: 'courses' }];
  assert.equal(validateState(s).recurring.length, 0);
});

test('export CSV : point-virgule, virgule décimale, guillemets échappés', () => {
  const s = defaultState();
  s.transactions = [{ id: 'a', type: 'expense', amount: 1250, categoryId: 'courses', date: '2026-11-02', note: 'Lidl "promo"' }];
  const csv = toCsv(s);
  assert.match(csv, /"2026-11-02";"Dépense";"Courses";"Lidl ""promo""";"-12,50"/);
});
