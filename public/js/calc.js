// Calculs purs (aucun accès au DOM ni au stockage) : testés dans tests/calc.test.js.
// Tous les montants sont des entiers en centimes, pour éviter les erreurs d'arrondi des flottants.
import { datesBetween } from './recurrence.js';

/** "2026-11-02" -> "2026-11" */
export const monthOf = (isoDate) => isoDate.slice(0, 7);

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Décale un mois "YYYY-MM" de n mois (n peut être négatif). */
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Nombre de mois entiers entre deux mois "YYYY-MM" (b - a). */
export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/**
 * Lit un montant tapé par l'utilisateur : "12", "12,5", "12.50", "1 234,56".
 * Renvoie des centimes (> 0) ou null si la saisie est invalide.
 */
export function parseAmount(text) {
  if (typeof text !== 'string') return null;
  const clean = text.replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [ent, dec = ''] = clean.split('.');
  const cents = Number(ent) * 100 + Number(dec.padEnd(2, '0'));
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}

/** Totaux d'un mois : revenus, dépenses, solde, dépenses et revenus par catégorie. */
export function monthSummary(transactions, ym) {
  let income = 0;
  let expense = 0;
  const byCategory = {};
  for (const t of transactions) {
    if (monthOf(t.date) !== ym) continue;
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  }
  return { income, expense, balance: income - expense, byCategory };
}

/** État d'une enveloppe budgétaire. */
export function budgetStatus(budget, spent) {
  if (!budget) return null;
  const pct = spent / budget;
  return {
    pct,
    remaining: budget - spent,
    level: pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok',
  };
}

/**
 * Passages à venir dans le mois courant (après aujourd'hui, pas encore créés) pour un type.
 * Une récurrence hebdomadaire peut tomber plusieurs fois : chaque passage compte.
 */
export function upcomingRecurring(recurring, ym, today, type) {
  if (monthOf(today) !== ym) return [];
  const monthEnd = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const out = [];
  for (const r of recurring) {
    if (r.type !== type || r.active === false) continue;
    const after = r.lastDate && r.lastDate > today ? r.lastDate : today;
    for (const date of datesBetween(r, after, monthEnd)) out.push({ ...r, date });
  }
  return out;
}

/**
 * Prévisions pour le mois courant :
 * - projection des dépenses variables au rythme actuel ;
 * - « reste à dépenser par jour » = (revenus + revenus fixes à venir − dépenses − charges fixes à venir) / jours restants.
 */
export function forecast({ transactions, recurring, goals = [] }, ym, today) {
  const s = monthSummary(transactions, ym);
  // L'argent mis de côté dans un objectif ce mois-ci n'est plus disponible pour dépenser.
  const savedMonth = savedInMonth(goals, ym);
  const dim = daysInMonth(ym);
  const isCurrent = monthOf(today) === ym;
  const dayNow = isCurrent ? Number(today.slice(8, 10)) : dim;
  const daysLeft = isCurrent ? dim - dayNow + 1 : 0;
  const sum = (list) => list.reduce((acc, r) => acc + r.amount, 0);
  const fixedOut = sum(upcomingRecurring(recurring, ym, today, 'expense'));
  const fixedIn = sum(upcomingRecurring(recurring, ym, today, 'income'));

  // Projection : dépenses variables (hors récurrences) extrapolées, + charges fixes à venir.
  const variable = transactions
    .filter((t) => t.type === 'expense' && monthOf(t.date) === ym && !t.recurringId)
    .reduce((acc, t) => acc + t.amount, 0);
  const fixedDone = s.expense - variable;
  // En début de mois, extrapoler 2 ou 3 jours de dépenses exagère énormément : on mélange
  // l'extrapolation avec la moyenne des mois précédents, en donnant plus de poids au mois
  // en cours à mesure qu'il avance. Sans historique, pas de prévision avant le 7 du mois.
  const avg = averageVariable(transactions, ym, 3);
  let projectedVariable = null;
  if (isCurrent) {
    const extrapolated = (variable / dayNow) * dim;
    const w = dayNow / dim;
    if (avg !== null) projectedVariable = Math.max(variable, w * extrapolated + (1 - w) * avg);
    else if (dayNow >= 7) projectedVariable = extrapolated;
  }
  const projectedExpense = !isCurrent
    ? s.expense
    : projectedVariable === null ? null : Math.round(fixedDone + projectedVariable + fixedOut);

  const leftToSpend = s.income + fixedIn - s.expense - fixedOut - savedMonth;
  return {
    ...s,
    savedMonth,
    daysLeft,
    fixedOut,
    fixedIn,
    projectedExpense,
    projectedBalance: projectedExpense === null ? null : s.income + fixedIn - projectedExpense - savedMonth,
    leftToSpend,
    perDay: daysLeft > 0 ? Math.floor(leftToSpend / daysLeft) : 0,
    avgPerDay: Math.round(s.expense / dayNow),
  };
}

/** Dépenses variables (hors récurrences) moyennes des n mois précédents qui ont des opérations, ou null. */
export function averageVariable(transactions, ym, n) {
  const totals = [];
  for (let i = 1; i <= n; i++) {
    const m = addMonths(ym, -i);
    const inMonth = transactions.filter((t) => monthOf(t.date) === m);
    if (!inMonth.length) continue;
    totals.push(inMonth.filter((t) => t.type === 'expense' && !t.recurringId).reduce((a, t) => a + t.amount, 0));
  }
  return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
}

/** Somme versée (moins retirée) dans les objectifs pendant un mois, hors montant de départ. */
export function savedInMonth(goals, ym) {
  let total = 0;
  for (const g of goals) for (const c of g.contributions || []) if (!c.initial && monthOf(c.date) === ym) total += c.amount;
  return total;
}

/**
 * Crée les opérations des récurrences arrivées à échéance jusqu'à aujourd'hui (rattrape les jours manqués).
 * Chaque récurrence mémorise la date du dernier passage créé (lastDate) : supprimer une opération
 * générée ne la fait donc pas réapparaître. Renvoie les nouvelles opérations, sans rien modifier.
 */
export function pendingRecurring(recurring, today, makeId) {
  const out = [];
  const updates = {};
  for (const r of recurring) {
    if (r.active === false) continue;
    const dates = datesBetween(r, r.lastDate || null, today);
    for (const date of dates) {
      out.push({ id: makeId(), type: r.type, amount: r.amount, categoryId: r.categoryId, date, note: r.note || '', recurringId: r.id });
    }
    if (dates.length) updates[r.id] = dates[dates.length - 1];
  }
  return { transactions: out, lastDate: updates };
}

/** Plan d'un objectif d'épargne : reste, mois restants, montant à mettre de côté par mois. */
export function goalPlan(goal, today) {
  const saved = (goal.contributions || []).reduce((acc, c) => acc + c.amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const pct = goal.target > 0 ? Math.min(1, saved / goal.target) : 0;
  let monthsLeft = null;
  let perMonth = null;
  if (goal.deadline && remaining > 0) {
    // Mois restants, mois en cours compris tant que l'échéance n'est pas dépassée.
    monthsLeft = Math.max(1, monthsBetween(monthOf(today), monthOf(goal.deadline)) + 1);
    if (goal.deadline < today) monthsLeft = 0;
    perMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
  }
  return { saved, remaining, pct, monthsLeft, perMonth, done: remaining === 0 };
}

/** Revenus et dépenses des n derniers mois (le plus ancien en premier). */
export function history(transactions, endYm, n) {
  const months = Array.from({ length: n }, (_, i) => addMonths(endYm, i - n + 1));
  return months.map((ym) => {
    const s = monthSummary(transactions, ym);
    return { ym, income: s.income, expense: s.expense };
  });
}

/** Taux d'épargne du mois (part des revenus non dépensée), null sans revenu. */
export function savingsRate(income, expense) {
  return income > 0 ? (income - expense) / income : null;
}
