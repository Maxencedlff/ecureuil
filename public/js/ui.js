// Briques d'interface : feuilles (bottom sheets), toast, icônes.
import { esc } from './format.js';

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
export const icons = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/>'),
  pie: svg('<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 2.5A9 9 0 0 1 21.5 9H15z"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  left: svg('<path d="m15 5-7 7 7 7"/>'),
  right: svg('<path d="m9 5 7 7-7 7"/>'),
  chevron: svg('<path d="m9 6 6 6-6 6"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  repeat: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
};

// ---------- Feuilles ----------
let current = null; // { el, onClose }

/**
 * Ouvre une feuille modale qui monte du bas de l'écran.
 * Le bouton Retour d'Android (et le geste retour) la ferme grâce à une entrée d'historique.
 */
export function openSheet({ title, body, onMount, onClose, wide = false }) {
  const root = document.getElementById('sheet-root');
  const replacing = Boolean(current);
  if (current) current.el.remove();
  const el = document.createElement('div');
  el.className = 'sheet-layer' + (replacing ? ' instant' : '');
  el.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grabber" aria-hidden="true"></div>
      <header class="sheet-head">
        <button class="text-btn" data-close type="button">Fermer</button>
        <h2>${esc(title)}</h2>
        <span class="sheet-head-spacer"></span>
      </header>
      <div class="sheet-body">${body}</div>
    </section>`;
  root.appendChild(el);
  current = { el, onClose };
  if (!replacing) history.pushState({ sheet: true }, '');
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.body.classList.add('sheet-open');
  onMount?.(el.querySelector('.sheet'));
  return el;
}

/** Ferme la feuille ouverte (passe par l'historique pour rester cohérent avec le bouton Retour). */
export function closeSheet() {
  if (!current) return;
  // On ferme tout de suite à l'écran ; le popstate qui suit history.back() sera ignoré,
  // ce qui permet d'ouvrir une autre feuille juste après sans qu'elle se referme.
  if (history.state?.sheet) {
    pendingBack = true;
    history.back();
  }
  dismiss();
}
let pendingBack = false;

function dismiss() {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  el.classList.add('closing');
  document.body.classList.remove('sheet-open');
  setTimeout(() => el.remove(), 220);
  onClose?.();
}

window.addEventListener('popstate', () => {
  if (pendingBack) {
    pendingBack = false;
    return;
  }
  dismiss();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

// ---------- Toast ----------
let toastTimer;
/** Petit message en bas de l'écran, avec une action facultative (ex. « Annuler »). */
export function toast(message, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${message}</span>${action ? `<button type="button">${action.label}</button>` : ''}`;
  el.classList.add('show');
  if (action) {
    el.querySelector('button').onclick = () => {
      action.run();
      el.classList.remove('show');
    };
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 5000 : 2500);
}

/** Demande de confirmation sobre (feuille d'action iOS). */
export function confirmSheet({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      body: `<p class="muted center">${message}</p>
        <button class="btn ${danger ? 'danger' : 'primary'} block" data-yes type="button">${confirmLabel}</button>`,
      onMount: (s) => s.querySelector('[data-yes]').addEventListener('click', () => {
        answered = true;
        resolve(true);
        closeSheet();
      }),
      onClose: () => !answered && resolve(false),
    });
  });
}
