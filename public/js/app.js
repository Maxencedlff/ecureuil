// Point d'entrée : état de l'interface, navigation entre onglets, délégation des clics.
import { createStore } from './store.js';
import { todayIso, addMonths, monthOf } from './calc.js';
import { homeView, txView, txList, budgetsView, goalsView } from './views.js';
import { txSheet, categorySheet, goalSheet, contributeSheet, settingsSheet } from './forms.js';
import { toast, icons } from './ui.js';

const store = createStore();
const ui = { tab: 'home', ym: monthOf(todayIso()), today: todayIso(), query: '', filter: 'all' };
const VIEWS = { home: homeView, tx: txView, budgets: budgetsView, goals: goalsView };

const ctx = {
  store,
  ui,
  async logout() {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    location.replace('/login');
  },
};

const view = document.getElementById('view');

function render() {
  view.innerHTML = VIEWS[ui.tab](store.get(), ui);
  document.querySelectorAll('.tabbar [data-tab]').forEach((b) => {
    const on = b.dataset.tab === ui.tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function setTab(tab) {
  if (!VIEWS[tab]) return;
  const changed = ui.tab !== tab;
  ui.tab = tab;
  render();
  if (changed) window.scrollTo({ top: 0 });
}

store.subscribe(render);
if (store.saveError()) toast("Impossible d'enregistrer sur cet appareil (stockage plein ou navigation privée).");

// ---------- Clics ----------
const actions = {
  tab: (el) => setTab(el.dataset.tab),
  add: () => txSheet(ctx, null, { type: ui.filter === 'income' ? 'income' : 'expense' }),
  'edit-tx': (el) => txSheet(ctx, el.dataset.id),
  'edit-cat': (el) => categorySheet(ctx, el.dataset.id),
  'new-cat': (el) => categorySheet(ctx, null, el.dataset.type),
  'edit-goal': (el) => goalSheet(ctx, el.dataset.id),
  'new-goal': () => goalSheet(ctx, null),
  contribute: (el) => contributeSheet(ctx, el.dataset.id, Number(el.dataset.sign)),
  settings: () => settingsSheet(ctx),
  month: (el) => { ui.ym = addMonths(ui.ym, Number(el.dataset.delta)); render(); },
  'month-today': () => { ui.ym = monthOf(ui.today); render(); },
  filter: (el) => { ui.filter = el.dataset.filter; render(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.closest('#sheet-root')) return;
  actions[el.dataset.action]?.(el);
});

view.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    ui.query = e.target.value;
    document.getElementById('tx-list').innerHTML = txList(store.get(), ui);
  }
});

// ---------- Barre d'onglets ----------
document.querySelector('.tabbar').innerHTML = `
  <button data-action="tab" data-tab="home">${icons.home}<span>Accueil</span></button>
  <button data-action="tab" data-tab="tx">${icons.list}<span>Opérations</span></button>
  <button data-action="add" class="add-btn" aria-label="Ajouter une opération">${icons.plus}</button>
  <button data-action="tab" data-tab="budgets">${icons.pie}<span>Budgets</span></button>
  <button data-action="tab" data-tab="goals">${icons.target}<span>Objectifs</span></button>`;

// ---------- Jour qui change, retour dans l'appli ----------
function refreshDay() {
  const t = todayIso();
  if (t !== ui.today) {
    if (ui.ym === monthOf(ui.today)) ui.ym = monthOf(t);
    ui.today = t;
  }
  const added = store.runRecurring(ui.today);
  render();
  if (added) toast(`${added} opération${added > 1 ? 's' : ''} récurrente${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}`);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshDay();
});
refreshDay();

// ---------- Hors ligne ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
