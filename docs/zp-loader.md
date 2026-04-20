# Écran de chargement & accueil (ZapPlay)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `public/zp-loader.css` | Styles du **loader** (`#zp-loader`) et de l’**écran première visite** (`#zp-welcome`). Variables `--zp-*`, `prefers-reduced-motion`. |
| `public/theme.css` | Feuille partagée ; le loader **n’y est pas importé** (évite `@import` async). Les pages jeu incluent `<link href="/zp-loader.css">` **juste après** `theme.css`. L’**accueil** (`index.html`) charge aussi `theme.css`, `zp-loader.css` et `zp-shell.css` avant `styles.css`, avec `data-zp-home-loader="1"` pour le même `#zp-loader` que le lobby. |
| `public/shared.js` | `injectLoader()`, `hideLoader()`, `showWelcomeScreen()` — injection DOM + logique (messages cycliques, soumission pseudo). |

Le CSS n’est plus injecté en bloc dans `shared.js` : feuille dédiée + `ensureZPLoaderStylesheet()` (évite doublons si déjà chargé via `theme.css`).

## Comportement

### Loader (`#zp-loader`)

- Affiché au chargement sur **toutes les pages**, y compris l’accueil (même composant que lobby / jeux). Sur l’accueil, masquage automatique après ~2,2 s ; sur les autres pages, plafond 8 s.
- **Plein écran** : `position: fixed`, `inset: 0`, `min-height: 100dvh`, `z-index: 2147483646`, attaché à `document.documentElement`.
- **Durée minimale** d’affichage : 1,5 s (`MIN_LOADER_MS`) avant fondu.
- **Sécurité** : si le loader reste trop longtemps, masquage automatique après 9 s (`LOADER_SAFETY_MS`) pour ne pas bloquer clavier / clic.
- Messages cycliques : Initialisation → Chargement → Connexion → Préparation (toutes les ~900 ms).

### Accueil première visite (`#zp-welcome`)

- Uniquement sur **l’accueil**, si aucun pseudo enregistré (`localStorage`).
- Même pile z-index que le loader.
- Après validation du pseudo : animation de sortie, suppression du nœud, pas de feuille `<style>` orpheline (styles dans `zp-loader.css`).

## Accessibilité

- `prefers-reduced-motion: reduce` : animations du loader / welcome réduites ou désactivées dans `zp-loader.css` (grille figée, barre de progression à ~92 %, faisceaux atténués).

## Tests

`tests/zp-loader.assets.test.js` vérifie la présence des hooks (IDs, lien CSS) et évite les régressions de structure.
