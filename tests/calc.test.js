import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount, monthSummary, forecast, pendingRecurring, goalPlan, addMonths, daysInMonth, budgetStatus, history, savedInMonth,
} from '../public/js/calc.js';

test('parseAmount lit les saisies françaises en centimes', () => {
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('12,5'), 1250);
  assert.equal(parseAmount('12.05'), 1205);
  assert.equal(parseAmount('1 234,56 €'), 123456);
  assert.equal(parseAmount('0,1'), 10);
  for (const bad of ['', '0', 'abc', '12,345', '-5', '1,2,3', null]) assert.equal(parseAmount(bad), null, String(bad));
});

test('addMonths et daysInMonth gèrent les fins d’année et les années bissextiles', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-02'), 28);
});

const T = (date, amount, type = 'expense', categoryId = 'c', extra = {}) => ({ id: `${date}-${amount}`, date, amount, type, categoryId, ...extra });

test('monthSummary ne compte que le mois demandé', () => {
  const s = monthSummary([T('2026-11-01', 1000), T('2026-11-15', 200000, 'income', 'sal'), T('2026-10-31', 999)], '2026-11');
  assert.deepEqual([s.income, s.expense, s.balance], [200000, 1000, 199000]);
  assert.equal(s.byCategory.c, 1000);
});

test('forecast : reste à dépenser déduit charges fixes à venir et épargne du mois', () => {
  const state = {
    transactions: [T('2026-11-01', 200000, 'income', 'sal', { recurringId: 'r1' }), T('2026-11-02', 3000)],
    recurring: [
      { id: 'r1', type: 'income', amount: 200000, startDate: '2026-01-01', unit: 'month', every: 1, lastDate: '2026-11-01', categoryId: 'sal' },
      { id: 'r2', type: 'expense', amount: 70000, startDate: '2026-01-05', unit: 'month', every: 1, lastDate: '2026-10-05', categoryId: 'log' },
    ],
    goals: [{ contributions: [{ date: '2026-11-02', amount: 10000 }, { date: '2026-01-01', amount: 50000, initial: true }] }],
  };
  const f = forecast(state, '2026-11', '2026-11-02');
  assert.equal(f.fixedOut, 70000);
  assert.equal(f.savedMonth, 10000);
  assert.equal(f.leftToSpend, 200000 - 3000 - 70000 - 10000);
  assert.equal(f.daysLeft, 29);
  assert.equal(f.perDay, Math.floor(f.leftToSpend / 29));
  // Le 2 du mois sans historique : pas de prévision (2 jours extrapolés seraient trompeurs).
  assert.equal(f.projectedExpense, null);
  assert.equal(f.projectedBalance, null);
});

test('forecast : début de mois appuyé sur la moyenne des mois précédents', () => {
  const transactions = [T('2026-10-10', 60000), T('2026-09-10', 40000), T('2026-11-02', 3000)];
  const f = forecast({ transactions, recurring: [] }, '2026-11', '2026-11-02');
  // moyenne 50000 ; poids du mois en cours 2/30 ; extrapolation 3000/2*30 = 45000
  const w = 2 / 30;
  assert.equal(f.projectedExpense, Math.round(w * 45000 + (1 - w) * 50000));
  // sans historique, à partir du 7 : extrapolation simple
  const g = forecast({ transactions: [T('2026-11-03', 7000)], recurring: [] }, '2026-11', '2026-11-07');
  assert.equal(g.projectedExpense, 30000);
});

test('forecast d’un mois passé : pas de jours restants', () => {
  const f = forecast({ transactions: [T('2026-10-03', 500)], recurring: [] }, '2026-10', '2026-11-02');
  assert.equal(f.daysLeft, 0);
  assert.equal(f.perDay, 0);
  assert.equal(f.projectedExpense, 500);
});

test('pendingRecurring rattrape les passages manqués sans dupliquer', () => {
  let n = 0;
  const id = () => `id${n++}`;
  const r = { id: 'r', type: 'expense', amount: 1000, startDate: '2026-01-31', unit: 'month', every: 1, day: 31, lastDate: '2026-01-31', categoryId: 'c' };
  const { transactions, lastDate } = pendingRecurring([r], '2026-04-15', id);
  // février (28), mars (31) ; avril 30 pas encore passé
  assert.deepEqual(transactions.map((t) => t.date), ['2026-02-28', '2026-03-31']);
  assert.equal(lastDate.r, '2026-03-31');
  assert.equal(pendingRecurring([{ ...r, lastDate: '2026-03-31' }], '2026-04-15', id).transactions.length, 0);
});

test('pendingRecurring : toutes les 2 semaines, et récurrences désactivées ignorées', () => {
  const r = { id: 'r', type: 'income', amount: 5000, startDate: '2026-10-02', unit: 'week', every: 2, weekdays: [5], lastDate: '2026-10-02', categoryId: 'c' };
  assert.deepEqual(pendingRecurring([r], '2026-11-02', () => 'x').transactions.map((t) => t.date), ['2026-10-16', '2026-10-30']);
  assert.equal(pendingRecurring([{ ...r, active: false }], '2026-11-02', () => 'x').transactions.length, 0);
});

test('forecast compte chaque passage hebdomadaire à venir dans le mois', () => {
  const r = { id: 'r', type: 'expense', amount: 1000, startDate: '2026-11-02', unit: 'week', every: 1, weekdays: [1], lastDate: '2026-11-02', categoryId: 'c' };
  const f = forecast({ transactions: [], recurring: [r] }, '2026-11', '2026-11-02');
  assert.equal(f.fixedOut, 4000); // lundis 9, 16, 23 et 30 novembre
});

test('goalPlan calcule l’effort mensuel', () => {
  const g = { target: 120000, deadline: '2027-04-30', contributions: [{ date: '2026-11-01', amount: 20000 }] };
  const p = goalPlan(g, '2026-11-02');
  assert.equal(p.remaining, 100000);
  assert.equal(p.monthsLeft, 6); // nov., déc., janv., févr., mars, avr.
  assert.equal(p.perMonth, Math.ceil(100000 / 6));
  assert.equal(goalPlan({ ...g, contributions: [{ date: '2026-11-01', amount: 130000 }] }, '2026-11-02').done, true);
  assert.equal(goalPlan({ ...g, deadline: '2026-10-01' }, '2026-11-02').monthsLeft, 0);
  assert.equal(goalPlan({ ...g, deadline: null }, '2026-11-02').perMonth, null);
});

test('budgetStatus : niveaux ok / warn / over', () => {
  assert.equal(budgetStatus(null, 100), null);
  assert.equal(budgetStatus(1000, 500).level, 'ok');
  assert.equal(budgetStatus(1000, 850).level, 'warn');
  assert.equal(budgetStatus(1000, 1200).level, 'over');
  assert.equal(budgetStatus(1000, 1200).remaining, -200);
});

test('history renvoie n mois du plus ancien au plus récent', () => {
  const h = history([T('2026-11-01', 100), T('2026-09-01', 50)], '2026-11', 3);
  assert.deepEqual(h.map((x) => [x.ym, x.expense]), [['2026-09', 50], ['2026-10', 0], ['2026-11', 100]]);
});

test('savedInMonth exclut le montant de départ et compte les retraits', () => {
  const goals = [{ contributions: [{ date: '2026-11-01', amount: 5000 }, { date: '2026-11-03', amount: -2000 }, { date: '2026-11-01', amount: 9999, initial: true }] }];
  assert.equal(savedInMonth(goals, '2026-11'), 3000);
});
