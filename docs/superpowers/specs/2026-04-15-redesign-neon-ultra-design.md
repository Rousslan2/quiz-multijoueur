# ZapPlay — Redesign Neon Ultra

**Date:** 2026-04-15  
**Scope:** Menu principal (index.html) + Lobby + tous les jeux (17 fichiers)  
**Direction:** Neon Ultra + Scanlines/Glitch  
**Approche:** Hybrid — `theme.css` partagé + refonte majeure index.html + application systématique aux jeux

---

## 1. Direction visuelle validée

- **Style:** Neon Ultra — ambiance cyberpunk intense, glows amplifiés
- **Animations hover cartes:** Scanlines + Glitch (overlay scanline au hover, glitch chromatic aberration sur les icônes)
- **Overlay global:** Scanlines fixes sur toute la page (repeating-linear-gradient)
- **Logo:** Glitch chromatic aberration (rouge + bleu) toutes les 6s
- **Fond — C Deep Space (menu + tous les jeux):**
  - Background radial-gradient `#0a0520` → `#03030A`
  - 60 étoiles scintillantes générées en JS (`@keyframes twinkle`)
  - 2 nébuleuses flous : violet `rgba(168,85,247,.15)` + rose `rgba(255,56,100,.1)` (filter:blur)
  - Grille légère animée `rgba(168,85,247,.025)` 40px
  - Comète traversante (`@keyframes comet-fly`) hauteur 1px
  - Sur les pages jeu : couleur nébuleuse suit la couleur primaire du jeu (`--primary`)

---

## 2. Architecture — `public/theme.css`

Fichier CSS partagé importé par tous les jeux. Contient :

### 2.1 Variables
```css
:root {
  --bg: #06060F;  --bg2: #0D0D1F;  --card: #0E0E22;
  --teal: #00F5D4;  --orange: #FF6B35;  --pink: #FF3864;
  --gold: #FFE234;  --blue: #3B82F6;  --green: #22C55E;  --purple: #A855F7;
  --text: #E8E8F0;  --muted: #5A5A78;
  --border: rgba(0,245,212,.10);
}
```

### 2.2 Composants partagés

| Composant | Description |
|-----------|-------------|
| `.scanlines` | Overlay scanlines fixe sur `body::before` |
| `.bg-grid` | Grille animée en fond |
| `.glow-orb` | Orbe de glow flottant |
| `.neon-card` | Carte de base avec border-top coloré, hover shimmer + scanlines + corner glow |
| `.code-box` | Boîte code d'invitation pulsante |
| `.player-chip` | Chip joueur avec dot animé |
| `.start-btn` | Bouton lancer avec glow neon |
| `.score-chip` | Chip score avec glow sur joueur actif |
| `.timer-bar` | Barre timer gradient neon |
| `.choice-btn` | Bouton réponse avec états correct/wrong neon |
| `.back-btn` | Bouton retour style monospace |
| `.glitch-icon` | Animation glitch sur icône au hover |

### 2.3 Animations keyframes partagées
- `@keyframes scanline-slide` — scan lumineux qui descend
- `@keyframes logo-glitch` — glitch chromatic aberration
- `@keyframes card-in` — entrée staggerée des cartes
- `@keyframes glow-drift` — dérive des orbes
- `@keyframes blink` — clignotement dot joueur
- `@keyframes code-pulse` — pulsation du code salle
- `@keyframes grid-drift` — dérive grille fond
- `@keyframes particle-rise` — montée des particules
- `@keyframes glitch-icon` — glitch icône au hover

---

## 3. Menu principal — `index.html`

### Changements CSS
- Overlay scanlines global sur `body::before`
- Logo : animation `logo-glitch` amplifiée (ChromAb rouge + bleu)
- Cartes : `.neon-card` avec shimmer + overlay scanlines au hover + corner glow
- Icônes : `@keyframes glitch-icon` au hover (translateX + drop-shadow chromatique)
- Particules : 30 au lieu de 20, couleurs mixtes (teal, pink, blue)
- Cartes : animation `card-in` staggerée conservée

### Changements HTML
- Ajouter `<link rel="stylesheet" href="theme.css">` dans `<head>`
- Remplacer les classes de couleur par les classes `.neon-card` + classes couleur existantes
- Conserver toute la structure HTML actuelle (aucun changement structural)

---

## 4. Lobby — `lobby.html`

### Changements
- Importer `theme.css`
- Header : style `.back-btn` unifié
- Cards de salle : `.neon-card` avec état hover amplifié
- Live dot : style `.live-dot` partagé
- Overlay scanlines sur `body::before`

---

## 5. Pages de jeu — 17 fichiers

Fichiers : `quiz.html`, `draw.html`, `p4.html`, `morpion.html`, `taboo.html`, `emoji.html`, `loup.html`, `uno.html`, `wordbomb.html`, `sumo.html`, `paint.html`, `naval.html`, `typer.html`, `anagramme.html`, `justeprix.html`, `timeline.html`, `memoire.html`

### Salle d'attente (scr-wait) — changements uniformes
- Code box : `.code-box` avec animation pulsante neon
- Player chips : `.player-chip` avec dot coloré animé + scanlines internes
- Bouton lancer : `.start-btn` avec aura neon + scanlines
- Back button : `.back-btn` unifié

### Écrans in-game — changements uniformes
- Score bar : `.score-chip` avec glow neon sur joueur actif (`.me`)
- Timer : `.timer-bar` gradient neon avec glow
- Boutons réponse/action : `.choice-btn` avec états correct (vert neon) / wrong (rouge neon)
- Overlay scanlines sur `body::before`
- Fond : grid animée légère

### Stratégie d'application
1. Chaque fichier jeu reçoit `<link rel="stylesheet" href="theme.css">` dans `<head>`
2. Les classes CSS locales incompatibles sont remplacées par les classes du thème
3. Les couleurs primaires (`--primary`) de chaque jeu restent inchangées (ex: teal pour typer, pink pour anagramme)
4. Aucun changement JS — uniquement CSS

---

## 6. Fichiers modifiés

| Fichier | Type de changement |
|---------|-------------------|
| `public/theme.css` | **CRÉER** — nouveau fichier CSS partagé |
| `public/index.html` | CSS inline amplifié + import theme.css |
| `public/lobby.html` | Import theme.css + classes unifiées |
| `public/quiz.html` | Import theme.css + classes waiting/ingame |
| `public/draw.html` | Import theme.css + classes waiting/ingame |
| `public/p4.html` | Import theme.css + classes waiting/ingame |
| `public/morpion.html` | Import theme.css + classes waiting/ingame |
| `public/taboo.html` | Import theme.css + classes waiting/ingame |
| `public/emoji.html` | Import theme.css + classes waiting/ingame |
| `public/loup.html` | Import theme.css + classes waiting/ingame |
| `public/uno.html` | Import theme.css + classes waiting/ingame |
| `public/wordbomb.html` | Import theme.css + classes waiting/ingame |
| `public/sumo.html` | Import theme.css + classes waiting/ingame |
| `public/paint.html` | Import theme.css + classes waiting/ingame |
| `public/naval.html` | Import theme.css + classes waiting/ingame |
| `public/typer.html` | Import theme.css + classes waiting/ingame |
| `public/anagramme.html` | Import theme.css + classes waiting/ingame |
| `public/justeprix.html` | Import theme.css + classes waiting/ingame |
| `public/timeline.html` | Import theme.css + classes waiting/ingame |
| `public/memoire.html` | Import theme.css + classes waiting/ingame |

**Total : 1 fichier créé + 19 fichiers modifiés**

---

## 7. Contraintes

- **Zéro changement JS** — uniquement CSS et structure HTML minimale
- **Conserver les IDs** utilisés par le JS (scr-wait, scr-play, w-code, etc.)
- **Pas de breaking change** sur la logique de jeu existante
- **Compatibilité** avec shared.js et chat.js déjà en place
- **Hook sécurité** : pas de innerHTML dynamique dans le CSS
