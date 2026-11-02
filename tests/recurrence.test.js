import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, nextDates, datesBetween, describeRule, presetOf, isValidRule } from '../public/js/recurrence.js';

const take = (rule, n) => {
  const out = [];
  for (const d of schedule(rule)) {
    out.push(d);
    if (out.length >= n) break;
  }
  return out;
};

test('chaque jour et tous les 3 jours', () => {
  assert.deepEqual(take({ startDate: '2026-12-30', unit: 'day', every: 1 }, 3), ['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.deepEqual(take({ startDate: '2026-11-01', unit: 'day', every: 3 }, 3), ['2026-11-01', '2026-11-04', '2026-11-07']);
});

test('semaines : un jour, plusieurs jours, du lundi au vendredi, toutes les 2 semaines', () => {
  // 2026-11-02 est un lundi
  assert.deepEqual(take({ startDate: '2026-11-02', unit: 'week', every: 1 }, 2), ['2026-11-02', '2026-11-09']);
  assert.deepEqual(take({ startDate: '2026-11-02', unit: 'week', every: 1, weekdays: [2, 5] }, 4), ['2026-11-03', '2026-11-06', '2026-11-10', '2026-11-13']);
  assert.deepEqual(take({ startDate: '2026-11-06', unit: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] }, 3), ['2026-11-06', '2026-11-09', '2026-11-10']);
  assert.deepEqual(take({ startDate: '2026-11-06', unit: 'week', every: 2, weekdays: [5] }, 3), ['2026-11-06', '2026-11-20', '2026-12-04']);
});

test('mois : jour 31 ramené à la fin des mois courts, dernier jour, trimestre', () => {
  assert.deepEqual(take({ startDate: '2027-01-31', unit: 'month', every: 1, day: 31 }, 3), ['2027-01-31', '2027-02-28', '2027-03-31']);
  assert.deepEqual(take({ startDate: '2026-11-15', unit: 'month', every: 1, monthMode: 'last' }, 3), ['2026-11-30', '2026-12-31', '2027-01-31']);
  assert.deepEqual(take({ startDate: '2026-11-05', unit: 'month', every: 3 }, 3), ['2026-11-05', '2027-02-05', '2027-05-05']);
});

test('années, y compris le 29 février', () => {
  assert.deepEqual(take({ startDate: '2028-02-29', unit: 'year', every: 1, day: 29 }, 3), ['2028-02-29', '2029-02-28', '2030-02-28']);
  assert.deepEqual(take({ startDate: '2026-06-10', unit: 'year', every: 2 }, 2), ['2026-06-10', '2028-06-10']);
});

test('fin à une date ou après N fois', () => {
  const base = { startDate: '2026-11-01', unit: 'month', every: 1 };
  assert.deepEqual([...schedule({ ...base, end: { type: 'date', date: '2027-01-15' } })], ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepEqual([...schedule({ ...base, end: { type: 'count', count: 2 } })], ['2026-11-01', '2026-12-01']);
});

test('nextDates et datesBetween', () => {
  const r = { startDate: '2026-11-02', unit: 'week', every: 1 };
  assert.deepEqual(nextDates(r, '2026-11-02', 2), ['2026-11-09', '2026-11-16']);
  assert.deepEqual(datesBetween(r, '2026-11-02', '2026-11-20'), ['2026-11-09', '2026-11-16']);
  assert.deepEqual(datesBetween(r, null, '2026-11-02'), ['2026-11-02']);
});

test('descriptions en français', () => {
  assert.equal(describeRule({ startDate: '2026-11-06', unit: 'week', every: 2, weekdays: [5] }), 'Toutes les 2 semaines, le vendredi');
  assert.equal(describeRule({ startDate: '2026-11-02', unit: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] }), 'Chaque semaine, du lundi au vendredi');
  assert.equal(describeRule({ startDate: '2026-11-02', unit: 'week', every: 1, weekdays: [4, 1] }), 'Chaque semaine, le lundi et jeudi');
  assert.equal(describeRule({ startDate: '2026-11-15', unit: 'month', every: 1, monthMode: 'last' }), 'Chaque mois, le dernier jour');
  assert.equal(describeRule({ startDate: '2026-11-01', unit: 'month', every: 3, day: 1 }), 'Chaque trimestre, le 1er');
  assert.equal(describeRule({ startDate: '2026-03-15', unit: 'year', every: 1 }), 'Chaque année, le 15 mars');
  assert.equal(describeRule({ startDate: '2026-11-01', unit: 'day', every: 10, end: { type: 'count', count: 5 } }), 'Tous les 10 jours, 5 fois en tout');
  assert.equal(describeRule({ startDate: '2026-11-01', unit: 'day', every: 1, end: { type: 'date', date: '2027-01-01' } }), "Chaque jour, jusqu'au 1er janvier 2027");
});

test('presetOf retrouve le raccourci, sinon personnalisé', () => {
  assert.equal(presetOf(null), 'none');
  assert.equal(presetOf({ unit: 'week', every: 2 }), 'week2');
  assert.equal(presetOf({ unit: 'week', every: 1, weekdays: [5, 4, 3, 2, 1] }), 'workdays');
  assert.equal(presetOf({ unit: 'month', every: 3 }), 'month3');
  assert.equal(presetOf({ unit: 'day', every: 10 }), 'custom');
});

test('isValidRule refuse les règles mal formées', () => {
  const ok = { startDate: '2026-11-01', unit: 'week', every: 1, weekdays: [1] };
  assert.equal(isValidRule(ok), true);
  assert.equal(isValidRule({ ...ok, every: 0 }), false);
  assert.equal(isValidRule({ ...ok, weekdays: [] }), false);
  assert.equal(isValidRule({ ...ok, weekdays: [7] }), false);
  assert.equal(isValidRule({ ...ok, end: { type: 'count', count: 0 } }), false);
  assert.equal(isValidRule({ ...ok, startDate: 'demain' }), false);
});
