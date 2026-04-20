# Écran de chargement & accueil (ZapPlay)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `public/zp-loader.css` | Styles du **loader** (`#zp-loader`) et de l’**écran première visite** (`#zp-welcome`). Variables `--zp-*`, `prefers-reduced-motion`. |
| `public/theme.css` | `@import url('/zp-loader.css')` en tête — le loader est stylé **dès le parse du head** sur toutes les pages qui incluent `theme.css`, avant l’exécution de `shared.js`. |
| `public/shared.js` | `injectLoader()`, `hideLoader()`, `showWelcomeScreen()` — injection DOM + logique (messages cycliques, soumission pseudo). |

Le CSS n’est plus injecté en bloc dans `shared.js` : feuille dédiée + `ensureZPLoaderStylesheet()` (évite doublons si déjà chargé via `theme.css`).

## Comportement

### Loader (`#zp-loader`)

- Affiché sur **toutes les pages sauf l’accueil** (`index.html` / `/`) au chargement.
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
