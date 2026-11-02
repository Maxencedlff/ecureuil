// Rendu des 4 onglets. Fonctions (état, ui) -> HTML ; aucun écouteur ici :
// les clics passent par les attributs data-action, traités dans app.js.
import { forecast, budgetStatus, goalPlan, history, savingsRate, monthOf } from './calc.js';
import { eur, esc, monthLabel, dayLabel, pct } from './format.js';
import { icons } from './ui.js';
import { ring, donut, bars } from './charts.js';

const catMap = (state) => Object.fromEntries(state.categories.map((c) => [c.id, c]));

function header(title, ui, { month = true } = {}) {
  return `<header class="top">
    <div class="top-row">
      <h1>${title}</h1>
      <button class="icon-btn" data-action="settings" aria-label="Réglages">${icons.gear}</button>
    </div>
    ${month ? `<div class="month-switch">
      <button class="icon-btn small" data-action="month" data-delta="-1" aria-label="Mois précédent">${icons.left}</button>
      <button class="month-label" data-action="month-today" type="button">${monthLabel(ui.ym)}</button>
      <button class="icon-btn small" data-action="month" data-delta="1" aria-label="Mois suivant">${icons.right}</button>
    </div>` : ''}
  </header>`;
}

function txRow(t, cats, { showDate = false, today } = {}) {
  const c = cats[t.categoryId];
  const sign = t.type === 'income' ? '+' : '−';
  return `<button class="row" data-action="edit-tx" data-id="${esc(t.id)}">
    <span class="emoji" style="--c:${esc(c?.color)}">${esc(c?.emoji || '•')}</span>
    <span class="row-main">
      <span class="row-title">${esc(t.note || c?.name || 'Opération')}${t.recurringId ? `<i class="rec" aria-label="récurrente">${icons.repeat}</i>` : ''}</span>
      <span class="row-sub">${esc(c?.name || '')}${showDate ? ` · ${dayLabel(t.date, today)}` : ''}</span>
    </span>
    <span class="amount ${t.type}">${sign}${eur(t.amount)}</span>
  </button>`;
}

function emptyState(text, cta) {
  return `<div class="empty"><div class="empty-emoji">🐿️</div><p>${text}</p>${cta || ''}</div>`;
}

// ---------- Accueil ----------
export function homeView(state, ui) {
  const f = forecast(state, ui.ym, ui.today);
  const cats = catMap(state);
  const isCurrent = monthOf(ui.today) === ui.ym;
  const rate = savingsRate(f.income, f.expense);
  const recent = state.transactions.filter((t) => monthOf(t.date) === ui.ym)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const budgets = state.categories
    .filter((c) => c.type === 'expense' && c.budget)
    .map((c) => ({ c, spent: f.byCategory[c.id] || 0, st: budgetStatus(c.budget, f.byCategory[c.id] || 0) }))
    .sort((a, b) => b.st.pct - a.st.pct).slice(0, 4);

  const hero = `<section class="card hero ${f.leftToSpend < 0 ? 'neg' : ''}">
    <p class="eyebrow">${isCurrent ? 'Reste à dépenser ce mois' : 'Solde du mois'}</p>
    <p class="big">${eur(isCurrent ? f.leftToSpend : f.balance - f.savedMonth)}</p>
    ${isCurrent && f.daysLeft > 0 ? `<p class="sub">${f.leftToSpend > 0
    ? `soit <b>${eur(f.perDay)}</b> par jour pendant ${f.daysLeft} jour${f.daysLeft > 1 ? 's' : ''}`
    : 'Tu as dépassé ce que tu avais ce mois-ci.'}</p>` : ''}
    <div class="hero-stats">
      <div><span>Revenus</span><b class="income">${eur(f.income, { round: true })}</b></div>
      <div><span>Dépenses</span><b class="expense">${eur(f.expense, { round: true })}</b></div>
      <div><span>Épargné</span><b class="saving">${eur(f.savedMonth, { round: true })}</b></div>
    </div>
  </section>`;

  const forecastCard = f.projectedBalance === null ? `<div class="card mini">
      <p class="eyebrow">Taux d'épargne</p>
      <p class="mid">${rate === null ? '—' : pct(rate)}</p>
      <p class="tiny">prévision dès le 7 du mois</p>
    </div>` : `<div class="card mini">
      <p class="eyebrow">Fin de mois prévue</p>
      <p class="mid ${f.projectedBalance < 0 ? 'expense' : ''}">${eur(f.projectedBalance, { round: true })}</p>
      <p class="tiny">selon ton rythme habituel</p>
    </div>`;
  const insights = isCurrent && (f.expense || f.fixedOut) ? `<section class="grid2">
    ${forecastCard}
    <div class="card mini">
      <p class="eyebrow">Charges à venir</p>
      <p class="mid">${eur(f.fixedOut, { round: true })}</p>
      <p class="tiny">${f.fixedOut ? 'déjà déduites' : 'rien de prévu ce mois'}</p>
    </div>
  </section>` : '';

  const budgetBlock = budgets.length ? `<section>
    <div class="section-head"><h3>Budgets</h3><button class="text-btn" data-action="tab" data-tab="budgets">Tout voir</button></div>
    <div class="card list">${budgets.map(({ c, spent, st }) => budgetRow(c, spent, st)).join('')}</div>
  </section>` : '';

  const goals = state.goals.length ? `<section>
    <div class="section-head"><h3>Objectifs</h3><button class="text-btn" data-action="tab" data-tab="goals">Tout voir</button></div>
    <div class="h-scroll">${state.goals.map((g) => {
    const p = goalPlan(g, ui.today);
    return `<button class="card goal-mini" data-action="edit-goal" data-id="${esc(g.id)}">
        <div class="ring-wrap">${ring(p.pct, g.color || 'var(--accent)')}<span>${esc(g.emoji || '🎯')}</span></div>
        <b>${esc(g.name)}</b><span class="tiny">${pct(p.pct)} · ${eur(p.saved, { round: true })}</span>
      </button>`;
  }).join('')}</div>
  </section>` : '';

  const recentBlock = `<section>
    <div class="section-head"><h3>Dernières opérations</h3>${recent.length ? '<button class="text-btn" data-action="tab" data-tab="tx">Tout voir</button>' : ''}</div>
    ${recent.length ? `<div class="card list">${recent.map((t) => txRow(t, cats, { showDate: true, today: ui.today })).join('')}</div>`
    : emptyState('Aucune opération ce mois-ci.', '<button class="btn primary" data-action="add">Ajouter une opération</button>')}
  </section>`;

  const onboarding = !state.transactions.length && !state.recurring.length ? `<section class="card tip">
    <b>Bien démarrer</b>
    <p>1. Ajoute ton salaire et ton loyer en <b>répétant chaque mois</b> : ils seront comptés tout seuls.</p>
    <p>2. Note tes dépenses au fil de l'eau avec le bouton <b>+</b>.</p>
    <p>3. Fixe un budget par catégorie et un objectif d'épargne.</p>
  </section>` : '';

  return header('Écureuil', ui) + hero + onboarding + insights + budgetBlock + goals + recentBlock;
}

function budgetRow(c, spent, st) {
  return `<button class="row budget-row" data-action="edit-cat" data-id="${esc(c.id)}">
    <span class="emoji" style="--c:${esc(c.color)}">${esc(c.emoji)}</span>
    <span class="row-main">
      <span class="row-title">${esc(c.name)}</span>
      ${st ? `<span class="bar"><span class="fill ${st.level}" style="width:${Math.min(100, st.pct * 100)}%;--c:${esc(c.color)}"></span></span>
      <span class="row-sub">${st.remaining >= 0 ? `${eur(st.remaining, { round: true })} restants` : `${eur(-st.remaining, { round: true })} de trop`}</span>`
    : '<span class="row-sub">Pas de budget · touche pour en fixer un</span>'}
    </span>
    <span class="amount">${eur(spent, { round: true })}${st ? `<small> / ${eur(c.budget, { round: true })}</small>` : ''}</span>
  </button>`;
}

// ---------- Opérations ----------
export function txView(state, ui) {
  const seg = (v, label) => `<button class="${ui.filter === v ? 'on' : ''}" data-action="filter" data-filter="${v}" aria-pressed="${ui.filter === v}">${label}</button>`;
  return `${header('Opérations', ui)}
    <div class="search"><span aria-hidden="true">${icons.search}</span>
      <input id="search" type="search" placeholder="Rechercher" value="${esc(ui.query)}" aria-label="Rechercher une opération" autocomplete="off" enterkeyhint="search"></div>
    <div class="segmented">${seg('all', 'Tout')}${seg('expense', 'Dépenses')}${seg('income', 'Revenus')}</div>
    <div id="tx-list">${txList(state, ui)}</div>`;
}

/** Liste seule : redessinée à chaque frappe dans la recherche sans toucher au champ (le clavier reste ouvert). */
export function txList(state, ui) {
  const cats = catMap(state);
  const q = ui.query.trim().toLowerCase();
  const list = state.transactions
    .filter((t) => monthOf(t.date) === ui.ym)
    .filter((t) => ui.filter === 'all' || t.type === ui.filter)
    .filter((t) => !q || `${t.note} ${cats[t.categoryId]?.name}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  if (!list.length) {
    return emptyState(q ? 'Aucun résultat.' : 'Rien pour ce mois.', q ? '' : '<button class="btn primary" data-action="add">Ajouter une opération</button>');
  }
  const days = new Map();
  for (const t of list) {
    if (!days.has(t.date)) days.set(t.date, []);
    days.get(t.date).push(t);
  }
  const net = (ts) => ts.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0);
  const total = net(list);
  return `<p class="list-total">${list.length} opération${list.length > 1 ? 's' : ''} · <b class="${total < 0 ? 'expense' : 'income'}">${total > 0 ? '+' : ''}${eur(total)}</b></p>
    ${[...days].map(([date, ts]) => `<section><div class="day-head"><span>${dayLabel(date, ui.today)}</span><span>${net(ts) > 0 ? '+' : ''}${eur(net(ts))}</span></div>
      <div class="card list">${ts.map((t) => txRow(t, cats)).join('')}</div></section>`).join('')}`;
}

// ---------- Budgets ----------
export function budgetsView(state, ui) {
  const f = forecast(state, ui.ym, ui.today);
  const expenseCats = state.categories.filter((c) => c.type === 'expense');
  const incomeCats = state.categories.filter((c) => c.type === 'income');
  const spentCats = expenseCats.filter((c) => f.byCategory[c.id]).sort((a, b) => f.byCategory[b.id] - f.byCategory[a.id]);
  const allotted = expenseCats.reduce((a, c) => a + (c.budget || 0), 0);
  const toAssign = f.income + f.fixedIn - allotted;

  const legend = spentCats.slice(0, 6).map((c) => `<li><i style="background:${esc(c.color)}"></i><span class="lg-name">${esc(c.name)}</span><b>${pct(f.byCategory[c.id] / f.expense)}</b></li>`).join('');
  const sorted = [...expenseCats].sort((a, b) => (b.budget ? 1 : 0) - (a.budget ? 1 : 0) || (f.byCategory[b.id] || 0) - (f.byCategory[a.id] || 0));

  return `${header('Budgets', ui)}
    <section class="card chart-card">
      ${donut(spentCats.map((c) => ({ value: f.byCategory[c.id], color: c.color })), eur(f.expense, { round: true }), 'dépensés')}
      ${legend ? `<ul class="legend">${legend}</ul>` : '<p class="muted center">Pas encore de dépense ce mois-ci.</p>'}
    </section>
    ${allotted ? `<section class="card assign ${toAssign < 0 ? 'neg' : ''}">
      <div><p class="eyebrow">Budgets prévus</p><p class="mid">${eur(allotted, { round: true })}</p></div>
      <div><p class="eyebrow">${toAssign >= 0 ? 'Reste à attribuer' : 'Budgets au-dessus des revenus'}</p><p class="mid">${eur(Math.abs(toAssign), { round: true })}</p></div>
    </section>` : ''}
    <section>
      <div class="section-head"><h3>Dépenses par catégorie</h3><button class="text-btn" data-action="new-cat" data-type="expense">Ajouter</button></div>
      <div class="card list">${sorted.map((c) => budgetRow(c, f.byCategory[c.id] || 0, budgetStatus(c.budget, f.byCategory[c.id] || 0))).join('')}</div>
    </section>
    <section>
      <div class="section-head"><h3>Revenus</h3><button class="text-btn" data-action="new-cat" data-type="income">Ajouter</button></div>
      <div class="card list">${incomeCats.map((c) => `<button class="row" data-action="edit-cat" data-id="${esc(c.id)}">
        <span class="emoji" style="--c:${esc(c.color)}">${esc(c.emoji)}</span>
        <span class="row-main"><span class="row-title">${esc(c.name)}</span></span>
        <span class="amount income">${eur(f.byCategory[c.id] || 0, { round: true })}</span></button>`).join('')}</div>
    </section>
    <section>
      <div class="section-head"><h3>6 derniers mois</h3></div>
      <div class="card chart-card">${bars(history(state.transactions, ui.ym, 6), ui.ym)}
        <ul class="legend inline"><li><i style="background:var(--income)"></i>Revenus</li><li><i style="background:var(--expense)"></i>Dépenses</li></ul>
      </div>
    </section>`;
}

// ---------- Objectifs ----------
export function goalsView(state, ui) {
  const totalSaved = state.goals.reduce((a, g) => a + goalPlan(g, ui.today).saved, 0);
  const totalPerMonth = state.goals.reduce((a, g) => a + (goalPlan(g, ui.today).perMonth || 0), 0);
  const cards = state.goals.map((g) => {
    const p = goalPlan(g, ui.today);
    const deadline = g.deadline ? new Date(`${g.deadline}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null;
    let plan = '';
    if (p.done) plan = 'Objectif atteint, bravo !';
    else if (p.perMonth && p.monthsLeft) plan = `Mets <b>${eur(p.perMonth, { round: true })}</b> de côté par mois pour y être en ${esc(deadline)}`;
    else if (p.monthsLeft === 0) plan = `Échéance passée, il manque ${eur(p.remaining, { round: true })}`;
    else plan = `Il manque ${eur(p.remaining, { round: true })}`;
    return `<article class="card goal">
      <button class="goal-main" data-action="edit-goal" data-id="${esc(g.id)}">
        <div class="ring-wrap big">${ring(p.pct, g.color || 'var(--accent)', 72, 7)}<span>${esc(g.emoji || '🎯')}</span></div>
        <div class="goal-text">
          <b>${esc(g.name)}</b>
          <span class="goal-amounts"><b>${eur(p.saved, { round: true })}</b> sur ${eur(g.target, { round: true })}</span>
          <span class="tiny">${plan}</span>
        </div>
      </button>
      <div class="goal-actions">
        <button class="btn soft" data-action="contribute" data-id="${esc(g.id)}" data-sign="1">Ajouter</button>
        <button class="btn soft" data-action="contribute" data-id="${esc(g.id)}" data-sign="-1">Retirer</button>
      </div>
    </article>`;
  }).join('');

  return `${header('Objectifs', ui, { month: false })}
    ${state.goals.length ? `<section class="card hero compact">
      <div class="hero-stats">
        <div><span>Total épargné</span><b class="saving">${eur(totalSaved, { round: true })}</b></div>
        <div><span>À mettre par mois</span><b>${eur(totalPerMonth, { round: true })}</b></div>
      </div></section>` : ''}
    ${cards || emptyState('Un voyage, un fonds de secours, une voiture ? Fixe un montant et une date : je calcule combien mettre de côté chaque mois.', '')}
    <button class="btn primary block" data-action="new-goal">Nouvel objectif</button>`;
}
