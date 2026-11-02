# Écureuil

Appli web (PWA) pour gérer son argent : opérations, catégories avec budgets mensuels,
récurrences (salaire, loyer, abonnements), objectifs d'épargne et prévisions automatiques.
S'installe sur l'écran d'accueil (iPhone et Android) et marche hors ligne.

## Ce qui est calculé tout seul
- **Reste à dépenser** du mois = revenus + revenus fixes à venir − dépenses − charges fixes à venir − épargne du mois, et le montant **par jour** jusqu'à la fin du mois.
- **Fin de mois prévue** : mélange du rythme du mois en cours et de la moyenne des 3 mois précédents (le poids du mois en cours grandit au fil des jours ; sans historique, pas de prévision avant le 7).
- **Budgets** par catégorie (alerte à 80 %, dépassement), **reste à attribuer** = revenus − budgets prévus.
- **Objectifs** : montant à mettre de côté par mois pour tenir l'échéance.
- **Récurrences** (revenus et dépenses) : chaque jour, du lundi au vendredi, chaque semaine (jours au choix), toutes les 2 ou 4 semaines, chaque mois (jour fixe ou dernier jour), tous les 2 mois, trimestre, 6 mois, chaque année, ou intervalle libre (tous les N jours, semaines, mois, ans) ; fin jamais, à une date ou après N fois. Créées automatiquement à l’ouverture de l’appli (rattrapage des passages manqués, jamais en double). Règles dans `recurrence.js`.

## Choix techniques
- **Sans framework ni build** : modules ES servis tels quels (`public/js`). L'appli est petite ; pas de dépendance = rien à mettre à jour.
- **Montants en centimes entiers** : pas d'erreurs d'arrondi des flottants.
- **Calculs purs** (`calc.js`) séparés de l'affichage (`views.js`), des formulaires (`forms.js`) et du stockage (`store.js`) : testables sans navigateur.
- **Données sur l'appareil** (localStorage), export/import JSON et export CSV dans Réglages. Rien n'est envoyé sur un serveur.
- **Verrou par code côté serveur** : `middleware.js` (Vercel Routing Middleware) bloque tout sans cookie de session signé (HMAC-SHA256, 1 an, HttpOnly). Le code et le secret sont des variables d'environnement Vercel (`ACCESS_CODE`, `SESSION_SECRET`), jamais dans le dépôt.
- **Hors ligne** : `sw.js` (pages réseau d'abord, fichiers depuis le cache puis mis à jour).

## Développement
```bash
npm test                     # tests unitaires (node:test)
vercel dev                   # local avec middleware et API (variables dans .env.local)
```
Après une modif des fichiers de l'appli, changer `CACHE` dans `public/sw.js` pour forcer la mise à jour sur les téléphones.
