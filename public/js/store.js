// État de l'application et persistance locale (localStorage, sur l'appareil uniquement).
import { pendingRecurring } from './calc.js';

export const STORAGE_KEY = 'ecureuil:v1';
export const SCHEMA_VERSION = 1;

export const COLORS = ['#FF9F0A', '#FF453A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#64D2FF', '#FFD60A', '#AC8E68', '#8E8E93'];

export function defaultState() {
  const c = (id, name, emoji, color, type, budget = null) => ({ id, name, emoji, color, type, budget });
  return {
    version: SCHEMA_VERSION,
    categories: [
      c('courses', 'Courses', '🛒', '#30D158', 'expense', 30000),
      c('resto', 'Restos & sorties', '🍔', '#FF9F0A', 'expense', 15000),
      c('transport', 'Transport', '🚗', '#0A84FF', 'expense', 10000),
      c('logement', 'Logement', '🏠', '#AC8E68', 'expense'),
      c('abonnements', 'Abonnements', '📱', '#BF5AF2', 'expense', 5000),
      c('loisirs', 'Loisirs', '🎮', '#FF375F', 'expense', 8000),
      c('shopping', 'Shopping', '🛍️', '#64D2FF', 'expense'),
      c('sante', 'Santé', '💊', '#FF453A', 'expense'),
      c('autres', 'Autres', '📦', '#8E8E93', 'expense'),
      c('salaire', 'Salaire', '💼', '#30D158', 'income'),
      c('aides', 'Aides & remboursements', '🤝', '#64D2FF', 'income'),
      c('autres-revenus', 'Autres revenus', '💶', '#FFD60A', 'income'),
    ],
    transactions: [],
    recurring: [],
    goals: [],
  };
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const isCents = (x) => Number.isSafeInteger(x) && x > 0;
const isDate = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

/**
 * Vérifie une sauvegarde (localStorage ou fichier importé) et renvoie un état propre,
 * ou lève une erreur lisible. Les entrées invalides sont écartées plutôt que de casser l'appli.
 */
export function validateState(raw) {
  if (!isObj(raw) || raw.version !== SCHEMA_VERSION) throw new Error('Fichier non reconnu (pas une sauvegarde Écureuil).');
  const arr = (x) => (Array.isArray(x) ? x : []);
  const categories = arr(raw.categories).filter(
    (c) => isObj(c) && typeof c.id === 'string' && typeof c.name === 'string' && ['expense', 'income'].includes(c.type),
  ).map((c) => ({ ...c, budget: isCents(c.budget) ? c.budget : null }));
  if (!categories.length) throw new Error('Aucune catégorie dans la sauvegarde.');
  const catIds = new Set(categories.map((c) => c.id));
  const transactions = arr(raw.transactions).filter(
    (t) => isObj(t) && typeof t.id === 'string' && isCents(t.amount) && isDate(t.date) && catIds.has(t.categoryId),
  );
  const recurring = arr(raw.recurring).filter(
    (r) => isObj(r) && typeof r.id === 'string' && isCents(r.amount) && catIds.has(r.categoryId)
      && Number.isInteger(r.day) && r.day >= 1 && r.day <= 31 && /^\d{4}-\d{2}$/.test(r.start),
  );
  const goals = arr(raw.goals).filter((g) => isObj(g) && typeof g.id === 'string' && isCents(g.target))
    .map((g) => ({ ...g, contributions: arr(g.contributions).filter((c) => isObj(c) && Number.isSafeInteger(c.amount) && isDate(c.date)) }));
  return { version: SCHEMA_VERSION, categories, transactions, recurring, goals };
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** Crée le magasin : un état, des écouteurs, et une sauvegarde à chaque modification. */
export function createStore(storage = globalThis.localStorage) {
  let state;
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    state = saved ? validateState(JSON.parse(saved)) : defaultState();
  } catch {
    state = defaultState();
  }
  const listeners = new Set();
  let saveError = null;

  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
      saveError = null;
    } catch (e) {
      saveError = e;
    }
  };

  return {
    get: () => state,
    saveError: () => saveError,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    /** Applique une modification (fonction qui reçoit une copie de travail de l'état). */
    update(mutator) {
      const draft = structuredClone(state);
      mutator(draft);
      state = draft;
      persist();
      listeners.forEach((fn) => fn(state));
    },
    replace(next) {
      state = validateState(next);
      persist();
      listeners.forEach((fn) => fn(state));
    },
    /** Ajoute les opérations récurrentes arrivées à échéance (au lancement et au retour dans l'appli). */
    runRecurring(today) {
      const { transactions, lastGenerated } = pendingRecurring(state.recurring, today, newId);
      if (!transactions.length && !Object.keys(lastGenerated).length) return 0;
      this.update((s) => {
        s.transactions.push(...transactions);
        for (const r of s.recurring) if (r.id in lastGenerated) r.lastGenerated = lastGenerated[r.id];
      });
      return transactions.length;
    },
  };
}
