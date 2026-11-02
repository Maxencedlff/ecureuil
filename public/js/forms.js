// Formulaires (dans des feuilles) : opérations, catégories, objectifs, récurrences, réglages.
import { parseAmount, monthOf, goalPlan } from './calc.js';
import { eur, esc, centsToInput } from './format.js';
import { openSheet, closeSheet, toast, confirmSheet, icons } from './ui.js';
import { newId, COLORS } from './store.js';
import { exportJson, exportCsv, importJson } from './backup.js';

const EMOJIS = ['🛒', '🍔', '☕', '🚗', '⛽', '🚆', '🏠', '💡', '📱', '🎮', '🎬', '🎵', '🛍️', '👕', '💊', '🏋️', '✈️', '🎁', '🐶', '📚', '💼', '💶', '🤝', '📦', '🎯', '🏖️', '🚘', '💻', '🆘', '💍'];

const amountField = (value = '', label = 'Montant') => `
  <label class="amount-field"><span class="sr">${label}</span>
    <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(value)}" aria-label="${label}" enterkeyhint="done">
    <span class="cur">€</span></label>`;

const typeSwitch = (type) => `<div class="segmented" role="radiogroup" aria-label="Type">
  <button type="button" data-type="expense" class="${type === 'expense' ? 'on' : ''}" aria-pressed="${type === 'expense'}">Dépense</button>
  <button type="button" data-type="income" class="${type === 'income' ? 'on' : ''}" aria-pressed="${type === 'income'}">Revenu</button>
</div>`;

const toggle = (name, label, checked, hint = '') => `<label class="toggle-row"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
  <input type="checkbox" name="${name}" ${checked ? 'checked' : ''} role="switch"><i aria-hidden="true"></i></label>`;

function readAmount(form) {
  const cents = parseAmount(form.amount.value);
  if (!cents) {
    form.amount.classList.add('invalid');
    toast('Entre un montant valide, par exemple 12,50');
    form.amount.focus();
  }
  return cents;
}

/** Sélecteur de catégorie en pastilles, filtré par type. */
function catChips(state, type, selected) {
  return state.categories.filter((c) => c.type === type).map((c) => `
    <button type="button" class="chip ${c.id === selected ? 'on' : ''}" data-cat="${esc(c.id)}" style="--c:${esc(c.color)}" aria-pressed="${c.id === selected}">
      <span>${esc(c.emoji)}</span>${esc(c.name)}</button>`).join('');
}

// ---------- Opération ----------
export function txSheet(ctx, id, preset = {}) {
  const state = ctx.store.get();
  const tx = id ? state.transactions.find((t) => t.id === id) : null;
  if (id && !tx) return;
  let type = tx?.type || preset.type || 'expense';
  let cat = tx?.categoryId || state.categories.find((c) => c.type === type)?.id;
  const defaultDate = monthOf(ctx.ui.today) === ctx.ui.ym ? ctx.ui.today : `${ctx.ui.ym}-01`;

  openSheet({
    title: tx ? "Modifier l'opération" : 'Nouvelle opération',
    body: `<form class="form" novalidate>
      ${typeSwitch(type)}
      ${amountField(tx ? centsToInput(tx.amount) : '')}
      <div class="chips" aria-label="Catégorie">${catChips(state, type, cat)}</div>
      <div class="field-group">
        <label class="field"><span>Note</span><input name="note" maxlength="60" placeholder="Facultatif" value="${esc(tx?.note || '')}" autocomplete="off"></label>
        <label class="field"><span>Date</span><input name="date" type="date" required value="${esc(tx?.date || defaultDate)}"></label>
        ${tx ? '' : toggle('repeat', 'Répéter chaque mois', false, 'Loyer, salaire, abonnement…')}
      </div>
      <button class="btn primary block" type="submit">${tx ? 'Enregistrer' : 'Ajouter'}</button>
      ${tx ? `${tx.recurringId ? `<p class="tiny center">${icons.repeat} Créée par une récurrence (modifiable dans Réglages)</p>` : ''}
        <button class="btn danger-text block" type="button" data-delete>Supprimer</button>` : ''}
    </form>`,
    onMount(sheet) {
      const form = sheet.querySelector('form');
      if (!tx) form.amount.focus();
      form.amount.addEventListener('input', () => form.amount.classList.remove('invalid'));
      sheet.querySelector('.segmented').addEventListener('click', (e) => {
        const b = e.target.closest('[data-type]');
        if (!b || b.dataset.type === type) return;
        type = b.dataset.type;
        cat = state.categories.find((c) => c.type === type)?.id;
        sheet.querySelectorAll('.segmented button').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', x === b);
        });
        sheet.querySelector('.chips').innerHTML = catChips(state, type, cat);
      });
      sheet.querySelector('.chips').addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        cat = b.dataset.cat;
        sheet.querySelectorAll('.chip').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', x === b);
        });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = readAmount(form);
        if (!amount) return;
        if (!cat) return toast('Choisis une catégorie');
        const date = form.date.value || ctx.ui.today;
        const note = form.note.value.trim();
        ctx.store.update((s) => {
          if (tx) {
            Object.assign(s.transactions.find((t) => t.id === tx.id), { type, amount, categoryId: cat, date, note });
            return;
          }
          const t = { id: newId(), type, amount, categoryId: cat, date, note, createdAt: Date.now() };
          if (form.repeat?.checked) {
            const r = { id: newId(), type, amount, categoryId: cat, day: Number(date.slice(8, 10)), note, start: monthOf(date), lastGenerated: monthOf(date), active: true };
            s.recurring.push(r);
            t.recurringId = r.id;
          }
          s.transactions.push(t);
        });
        if (form.repeat?.checked) ctx.store.runRecurring(ctx.ui.today);
        closeSheet();
        toast(tx ? 'Opération modifiée' : `${type === 'income' ? 'Revenu' : 'Dépense'} de ${eur(amount)} ajouté${type === 'income' ? '' : 'e'}`);
      });
      sheet.querySelector('[data-delete]')?.addEventListener('click', () => {
        const before = ctx.store.get();
        ctx.store.update((s) => { s.transactions = s.transactions.filter((t) => t.id !== tx.id); });
        closeSheet();
        toast('Opération supprimée', { label: 'Annuler', run: () => ctx.store.replace(before) });
      });
    },
  });
}

// ---------- Catégorie ----------
export function categorySheet(ctx, id, type = 'expense') {
  const state = ctx.store.get();
  const c = id ? state.categories.find((x) => x.id === id) : null;
  if (id && !c) return;
  let emoji = c?.emoji || '📦';
  let color = c?.color || COLORS[state.categories.length % COLORS.length];
  const kind = c?.type || type;
  const used = c ? state.transactions.filter((t) => t.categoryId === c.id).length : 0;

  openSheet({
    title: c ? c.name : kind === 'income' ? 'Nouvelle source de revenu' : 'Nouvelle catégorie',
    body: `<form class="form" novalidate>
      <div class="cat-preview"><span class="emoji xl" style="--c:${esc(color)}">${esc(emoji)}</span></div>
      <div class="field-group">
        <label class="field"><span>Nom</span><input name="catName" maxlength="30" required value="${esc(c?.name || '')}" placeholder="Ex. Courses" autocomplete="off"></label>
        ${kind === 'expense' ? `<label class="field"><span>Budget mensuel</span><input name="budget" inputmode="decimal" placeholder="Aucun" value="${c?.budget ? esc(centsToInput(c.budget)) : ''}" autocomplete="off"><em>€</em></label>` : ''}
      </div>
      <p class="label">Icône</p>
      <div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === emoji ? 'on' : ''}" aria-label="Icône ${e}">${e}</button>`).join('')}</div>
      <p class="label">Couleur</p>
      <div class="color-grid">${COLORS.map((x) => `<button type="button" data-color="${x}" style="--c:${x}" class="${x === color ? 'on' : ''}" aria-label="Couleur ${x}"></button>`).join('')}</div>
      <button class="btn primary block" type="submit">${c ? 'Enregistrer' : 'Créer'}</button>
      ${c ? `<button class="btn danger-text block" type="button" data-delete>Supprimer la catégorie</button>` : ''}
    </form>`,
    onMount(sheet) {
      const form = sheet.querySelector('form');
      const preview = sheet.querySelector('.cat-preview .emoji');
      sheet.querySelector('.emoji-grid').addEventListener('click', (e) => {
        const b = e.target.closest('[data-emoji]');
        if (!b) return;
        emoji = b.dataset.emoji;
        preview.textContent = emoji;
        sheet.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('.color-grid').addEventListener('click', (e) => {
        const b = e.target.closest('[data-color]');
        if (!b) return;
        color = b.dataset.color;
        preview.style.setProperty('--c', color);
        sheet.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b));
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.catName.value.trim();
        if (!name) return toast('Donne un nom à la catégorie');
        let budget = null;
        if (form.budget && form.budget.value.trim()) {
          budget = parseAmount(form.budget.value);
          if (!budget) return toast('Budget invalide');
        }
        ctx.store.update((s) => {
          if (c) Object.assign(s.categories.find((x) => x.id === c.id), { name, emoji, color, budget });
          else s.categories.push({ id: newId(), name, emoji, color, type: kind, budget });
        });
        closeSheet();
        toast(c ? 'Catégorie enregistrée' : 'Catégorie créée');
      });
      sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const sameType = state.categories.filter((x) => x.type === c.type);
        if (sameType.length <= 1) return toast('Garde au moins une catégorie de ce type');
        const fallback = sameType.find((x) => x.id !== c.id && /autre/i.test(x.name)) || sameType.find((x) => x.id !== c.id);
        const ok = await confirmSheet({
          title: `Supprimer « ${c.name} » ?`,
          message: used ? `Ses ${used} opération${used > 1 ? 's' : ''} et récurrences passeront dans « ${esc(fallback.name)} ».` : 'Aucune opération ne l’utilise.',
          confirmLabel: 'Supprimer',
        });
        if (!ok) return;
        ctx.store.update((s) => {
          s.categories = s.categories.filter((x) => x.id !== c.id);
          for (const t of s.transactions) if (t.categoryId === c.id) t.categoryId = fallback.id;
          for (const r of s.recurring) if (r.categoryId === c.id) r.categoryId = fallback.id;
        });
        toast('Catégorie supprimée');
      });
    },
  });
}

// ---------- Objectif ----------
export function goalSheet(ctx, id) {
  const state = ctx.store.get();
  const g = id ? state.goals.find((x) => x.id === id) : null;
  if (id && !g) return;
  let emoji = g?.emoji || '🎯';
  let color = g?.color || COLORS[(state.goals.length + 3) % COLORS.length];
  const p = g ? goalPlan(g, ctx.ui.today) : null;
  const history = g ? [...g.contributions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8) : [];

  openSheet({
    title: g ? g.name : 'Nouvel objectif',
    body: `<form class="form" novalidate>
      <div class="cat-preview"><span class="emoji xl" style="--c:${esc(color)}">${esc(emoji)}</span></div>
      <div class="field-group">
        <label class="field"><span>Nom</span><input name="goalName" maxlength="30" required value="${esc(g?.name || '')}" placeholder="Ex. Voyage au Japon" autocomplete="off"></label>
        <label class="field"><span>Montant visé</span><input name="goalTarget" inputmode="decimal" placeholder="0" value="${g ? esc(centsToInput(g.target)) : ''}" autocomplete="off"><em>€</em></label>
        <label class="field"><span>Pour quand</span><input name="deadline" type="date" value="${esc(g?.deadline || '')}"></label>
        ${g ? '' : `<label class="field"><span>Déjà de côté</span><input name="initial" inputmode="decimal" placeholder="0" autocomplete="off"><em>€</em></label>`}
      </div>
      <p class="label">Icône</p>
      <div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === emoji ? 'on' : ''}" aria-label="Icône ${e}">${e}</button>`).join('')}</div>
      <p class="label">Couleur</p>
      <div class="color-grid">${COLORS.map((x) => `<button type="button" data-color="${x}" style="--c:${x}" class="${x === color ? 'on' : ''}" aria-label="Couleur ${x}"></button>`).join('')}</div>
      <button class="btn primary block" type="submit">${g ? 'Enregistrer' : "Créer l'objectif"}</button>
      ${history.length ? `<p class="label">Derniers mouvements</p><div class="card list flat">${history.map((c) => `<div class="row static"><span class="row-main"><span class="row-title">${new Date(`${c.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span><span class="amount ${c.amount < 0 ? 'expense' : 'saving'}">${c.amount > 0 ? '+' : '−'}${eur(Math.abs(c.amount))}</span></div>`).join('')}</div>` : ''}
      ${g ? `<button class="btn danger-text block" type="button" data-delete>Supprimer l'objectif</button>` : ''}
    </form>`,
    onMount(sheet) {
      const form = sheet.querySelector('form');
      const preview = sheet.querySelector('.cat-preview .emoji');
      sheet.querySelector('.emoji-grid').addEventListener('click', (e) => {
        const b = e.target.closest('[data-emoji]');
        if (!b) return;
        emoji = b.dataset.emoji;
        preview.textContent = emoji;
        sheet.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('.color-grid').addEventListener('click', (e) => {
        const b = e.target.closest('[data-color]');
        if (!b) return;
        color = b.dataset.color;
        preview.style.setProperty('--c', color);
        sheet.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b));
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.goalName.value.trim();
        const target = parseAmount(form.goalTarget.value);
        if (!name) return toast("Donne un nom à l'objectif");
        if (!target) return toast('Entre le montant visé');
        const initial = form.initial?.value.trim() ? parseAmount(form.initial.value) : 0;
        if (initial === null) return toast('Montant déjà de côté invalide');
        const deadline = form.deadline.value || null;
        ctx.store.update((s) => {
          if (g) Object.assign(s.goals.find((x) => x.id === g.id), { name, target, deadline, emoji, color });
          else {
            s.goals.push({
              id: newId(), name, target, deadline, emoji, color, createdAt: ctx.ui.today,
              // « Déjà de côté » : marqué initial pour ne pas compter dans l'épargne du mois.
              contributions: initial ? [{ date: ctx.ui.today, amount: initial, initial: true }] : [],
            });
          }
        });
        closeSheet();
        toast(g ? 'Objectif enregistré' : 'Objectif créé');
      });
      sheet.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmSheet({ title: `Supprimer « ${g.name} » ?`, message: `Les ${eur(p.saved)} mis de côté ne seront plus suivis.`, confirmLabel: 'Supprimer' });
        if (!ok) return;
        const before = ctx.store.get();
        ctx.store.update((s) => { s.goals = s.goals.filter((x) => x.id !== g.id); });
        toast('Objectif supprimé', { label: 'Annuler', run: () => ctx.store.replace(before) });
      });
    },
  });
}

/** Verser ou retirer de l'argent d'un objectif. */
export function contributeSheet(ctx, id, sign) {
  const g = ctx.store.get().goals.find((x) => x.id === id);
  if (!g) return;
  const p = goalPlan(g, ctx.ui.today);
  const suggestion = sign > 0 && p.perMonth ? centsToInput(Math.min(p.perMonth, p.remaining)) : '';
  openSheet({
    title: sign > 0 ? `Ajouter à ${g.name}` : `Retirer de ${g.name}`,
    body: `<form class="form" novalidate>
      ${amountField(suggestion)}
      <p class="muted center">${sign > 0 ? (p.perMonth ? `Conseillé : ${eur(p.perMonth, { round: true })} par mois` : `Il manque ${eur(p.remaining)}`) : `Disponible : ${eur(p.saved)}`}</p>
      <button class="btn primary block" type="submit">${sign > 0 ? 'Mettre de côté' : 'Retirer'}</button>
    </form>`,
    onMount(sheet) {
      const form = sheet.querySelector('form');
      form.amount.focus();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = readAmount(form);
        if (!amount) return;
        if (sign < 0 && amount > p.saved) return toast(`Tu ne peux retirer que ${eur(p.saved)}`);
        ctx.store.update((s) => {
          s.goals.find((x) => x.id === g.id).contributions.push({ date: ctx.ui.today, amount: sign * amount });
        });
        closeSheet();
        const after = goalPlan(ctx.store.get().goals.find((x) => x.id === g.id), ctx.ui.today);
        toast(after.done ? `🎉 Objectif « ${esc(g.name)} » atteint !` : sign > 0 ? `${eur(amount)} mis de côté` : `${eur(amount)} retirés`);
      });
    },
  });
}

// ---------- Récurrences ----------
export function recurringSheet(ctx, id) {
  const state = ctx.store.get();
  const r = state.recurring.find((x) => x.id === id);
  if (!r) return;
  let cat = r.categoryId;
  openSheet({
    title: 'Récurrence',
    body: `<form class="form" novalidate>
      ${amountField(centsToInput(r.amount))}
      <div class="chips">${catChips(state, r.type, cat)}</div>
      <div class="field-group">
        <label class="field"><span>Note</span><input name="note" maxlength="60" value="${esc(r.note || '')}" placeholder="Facultatif" autocomplete="off"></label>
        <label class="field"><span>Jour du mois</span><input name="day" type="number" inputmode="numeric" min="1" max="31" value="${r.day}"></label>
        ${toggle('active', 'Active', r.active !== false, 'Désactivée, elle ne crée plus d’opération')}
      </div>
      <p class="tiny center">Les changements valent pour les prochains mois ; les opérations déjà créées ne bougent pas.</p>
      <button class="btn primary block" type="submit">Enregistrer</button>
      <button class="btn danger-text block" type="button" data-delete>Supprimer la récurrence</button>
    </form>`,
    onMount(sheet) {
      const form = sheet.querySelector('form');
      sheet.querySelector('.chips').addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        cat = b.dataset.cat;
        sheet.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = readAmount(form);
        if (!amount) return;
        const day = Number(form.day.value);
        if (!Number.isInteger(day) || day < 1 || day > 31) return toast('Jour entre 1 et 31');
        ctx.store.update((s) => {
          Object.assign(s.recurring.find((x) => x.id === r.id), { amount, categoryId: cat, note: form.note.value.trim(), day, active: form.active.checked });
        });
        ctx.store.runRecurring(ctx.ui.today);
        closeSheet();
        toast('Récurrence enregistrée');
      });
      sheet.querySelector('[data-delete]').addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'Supprimer la récurrence ?', message: 'Les opérations déjà créées sont gardées.', confirmLabel: 'Supprimer' });
        if (!ok) return;
        ctx.store.update((s) => {
          s.recurring = s.recurring.filter((x) => x.id !== r.id);
          for (const t of s.transactions) if (t.recurringId === r.id) delete t.recurringId;
        });
        toast('Récurrence supprimée');
      });
    },
  });
}

// ---------- Réglages ----------
export function settingsSheet(ctx) {
  const state = ctx.store.get();
  const cats = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  const recurring = [...state.recurring].sort((a, b) => a.day - b.day);
  const catRow = (c) => `<button class="row" data-go="cat" data-id="${esc(c.id)}">
    <span class="emoji" style="--c:${esc(c.color)}">${esc(c.emoji)}</span>
    <span class="row-main"><span class="row-title">${esc(c.name)}</span>${c.budget ? `<span class="row-sub">Budget ${eur(c.budget, { round: true })}/mois</span>` : ''}</span>
    <span class="chev">${icons.chevron}</span></button>`;

  openSheet({
    title: 'Réglages',
    wide: true,
    body: `
      <p class="label">Récurrences (chaque mois)</p>
      <div class="card list flat">${recurring.length ? recurring.map((r) => `<button class="row" data-go="rec" data-id="${esc(r.id)}">
        <span class="emoji" style="--c:${esc(cats[r.categoryId]?.color)}">${esc(cats[r.categoryId]?.emoji || '•')}</span>
        <span class="row-main"><span class="row-title">${esc(r.note || cats[r.categoryId]?.name || '')}</span><span class="row-sub">le ${r.day} du mois${r.active === false ? ' · désactivée' : ''}</span></span>
        <span class="amount ${r.type}">${r.type === 'income' ? '+' : '−'}${eur(r.amount)}</span></button>`).join('')
    : '<p class="muted pad">Aucune. Coche « Répéter chaque mois » en ajoutant une opération.</p>'}</div>
      <p class="label">Catégories de dépenses</p>
      <div class="card list flat">${state.categories.filter((c) => c.type === 'expense').map(catRow).join('')}
        <button class="row add" data-go="new-cat" data-type="expense"><span class="row-main"><span class="row-title accent">Ajouter une catégorie</span></span></button></div>
      <p class="label">Sources de revenus</p>
      <div class="card list flat">${state.categories.filter((c) => c.type === 'income').map(catRow).join('')}
        <button class="row add" data-go="new-cat" data-type="income"><span class="row-main"><span class="row-title accent">Ajouter une source</span></span></button></div>
      <p class="label">Sauvegarde</p>
      <div class="card list flat">
        <button class="row" data-go="export"><span class="row-main"><span class="row-title">Exporter une sauvegarde</span><span class="row-sub">Fichier .json à garder (iCloud, Drive…)</span></span></button>
        <button class="row" data-go="csv"><span class="row-main"><span class="row-title">Exporter en tableur</span><span class="row-sub">Fichier .csv pour Excel ou Numbers</span></span></button>
        <label class="row"><span class="row-main"><span class="row-title">Restaurer une sauvegarde</span><span class="row-sub">Remplace les données de cet appareil</span></span>
          <input type="file" accept="application/json,.json" data-import class="sr"></label>
      </div>
      <p class="tiny pad">Tes données restent sur cet appareil, rien n'est envoyé sur internet. Pense à exporter une sauvegarde de temps en temps.</p>
      <div class="card list flat">
        <button class="row" data-go="logout"><span class="row-main"><span class="row-title danger">Verrouiller l'appli</span><span class="row-sub">Redemande le code d'entrée</span></span></button>
      </div>`,
    onMount(sheet) {
      sheet.addEventListener('click', (e) => {
        const b = e.target.closest('[data-go]');
        if (!b) return;
        const go = b.dataset.go;
        if (go === 'cat') categorySheet(ctx, b.dataset.id);
        else if (go === 'new-cat') categorySheet(ctx, null, b.dataset.type);
        else if (go === 'rec') recurringSheet(ctx, b.dataset.id);
        else if (go === 'export') exportJson(ctx.store.get(), ctx.ui.today);
        else if (go === 'csv') exportCsv(ctx.store.get(), ctx.ui.today);
        else if (go === 'logout') ctx.logout();
      });
      sheet.querySelector('[data-import]').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const next = await importJson(file);
          const ok = await confirmSheet({
            title: 'Restaurer cette sauvegarde ?',
            message: `${next.transactions.length} opérations et ${next.goals.length} objectifs remplaceront les données actuelles.`,
            confirmLabel: 'Restaurer',
          });
          if (!ok) return;
          ctx.store.replace(next);
          toast('Sauvegarde restaurée');
        } catch (err) {
          toast(esc(err.message));
        }
      });
    },
  });
}
