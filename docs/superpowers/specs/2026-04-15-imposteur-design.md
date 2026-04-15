# ZapPlay — Jeu Imposteur (Mot Secret)

**Date:** 2026-04-15  
**Scope:** `server.js` + `public/imposteur.html` + `public/index.html`  
**Style:** Neon Ultra · Deep Space · couleur primaire `#FF3864` (pink)

---

## 1. Concept

Jeu de bluff par mots. Un mot secret est attribué à tous les joueurs **sauf l'imposteur** qui reçoit `null`. Chaque joueur décrit le mot en 1 phrase à son tour. Les joueurs votent ensuite pour éliminer celui qu'ils pensent être l'imposteur. Victoire civils si l'imposteur est éliminé, victoire imposteur sinon (+ bonus devinette).

- **Joueurs :** 3 à 8
- **Imposteurs :** 1 ou 2, choisi par l'hôte (max 1 si <5 joueurs)
- **Manches :** 3, 5 ou 7, choisies par l'hôte
- **Vote :** secret + révélation simultanée

---

## 2. Déroulement d'une manche

```
SETUP → DESCRIBE → VOTE → REVEAL → GUESS → SCORES
```

1. **Attribution** — serveur tire un mot aléatoire. Civils reçoivent le mot. Imposteur(s) reçoivent `null` (affiché "???").
2. **DESCRIBE** — tour par tour dans l'ordre de connexion. Timer 20s par joueur. Le joueur actif saisit sa description. Les descriptions précédentes s'affichent sans nom au fur et à mesure.
3. **VOTE** — toutes les descriptions affichées avec noms. Chaque joueur vote pour 1 suspect (pas lui-même). Timer 30s. Vote auto sur soi-même si inactif.
4. **REVEAL** — votes révélés simultanément. Le joueur le plus voté est éliminé. En cas d'ex-aequo : aucune élimination. Le rôle du joueur éliminé est révélé.
5. **GUESS** — si l'imposteur est éliminé ou survit : phase devinette. L'imposteur tente de deviner le mot (1 essai, 20s). Correct = +1 bonus.
6. **Scores manche :**
   - Imposteur éliminé → chaque civil +1 point
   - Civil éliminé → imposteur(s) +1 point
   - Imposteur devine le mot → +1 bonus (cumulable)
7. **SCORES** — classement intermédiaire. Hôte lance la manche suivante.
8. **GAME_OVER** — après toutes les manches, podium final.

---

## 3. Architecture serveur

### Nouveaux éléments dans `server.js`

```js
// WebSocket server
const wssImposteur = new WebSocket.Server({ noServer: true });

// Routing (dans le switch existant)
'/ws/imposteur': wssImposteur

// GAME_NAMES
imposteur: 'Imposteur'

// getRoomsSnapshot() — maps
imposteur: imposteurRooms

// maxPlayers dans snapshot
game==='imposteur' ? 8 : ...
```

### Structure de salle

```js
{
  code,           // string 4 chars
  host,           // string nom
  players: [{     // array
    ws, name, slot, score
  }],
  phase,          // 'WAITING'|'SETUP'|'DESCRIBE'|'VOTE'|'REVEAL'|'GUESS'|'SCORES'|'GAME_OVER'
  round,          // int, manche actuelle (1-based)
  totalRounds,    // 3|5|7
  nbImposteurs,   // 1|2
  word,           // string | null
  imposteurSlots, // int[] slots des imposteurs
  descOrder,      // int[] ordre des slots pour descriptions
  descIndex,      // int index du joueur actif dans descOrder
  descriptions,   // [{slot, name, text}]
  votes,          // {slot: votedSlot}
  scores,         // {slot: int}
  guessResult,    // null|'correct'|'wrong'
  timer           // Timeout handle
}
```

### Phases et messages WebSocket

| Phase | Déclencheur | Messages serveur |
|-------|-------------|-----------------|
| `WAITING` | connexion | `imposteur_state` |
| `SETUP` | hôte clique Démarrer | `imposteur_state` (host voit form) |
| `DESCRIBE` | hôte valide setup | `imposteur_state` (word pour civils, null pour imposteur) |
| `VOTE` | dernier joueur a décrit | `imposteur_state` (toutes descriptions + noms) |
| `REVEAL` | tous votes reçus ou timer | `imposteur_state` (votes + éliminé + rôle) |
| `GUESS` | après REVEAL | `imposteur_state` (imposteur voit input) |
| `SCORES` | après GUESS ou si skip | `imposteur_state` (scores cumulés) |
| `GAME_OVER` | dernière manche terminée | `imposteur_state` (classement final) |

### Messages client → serveur

```js
{ type: 'create', name }
{ type: 'join', name, code }
{ type: 'start_setup' }
{ type: 'configure', totalRounds, nbImposteurs }
{ type: 'describe', text }       // joueur actif uniquement
{ type: 'vote', targetSlot }
{ type: 'guess', word }          // imposteur uniquement
{ type: 'next_round' }           // hôte uniquement
{ type: 'lounge_chat', text }
```

### Snapshot envoyé au client

```js
{
  type: 'imposteur_state',
  phase, round, totalRounds, nbImposteurs,
  players: [{ name, slot, score, isImposteur? }], // isImposteur révélé après REVEAL
  word,             // null si imposteur, string si civil, null si WAITING/SETUP
  descOrder,        // slots ordonnés
  descIndex,        // index actif dans DESCRIBE
  descriptions,     // [{slot, name, text}] — texte vide avant que le joueur ait décrit
  votes,            // {} pendant VOTE, {slot:slot} après REVEAL
  eliminated,       // null|{slot,name,role}
  guessResult,      // null|'correct'|'wrong'
  scores,           // {slot:int}
  code, host
}
```

---

## 4. Banque de mots

~200 mots en 5 catégories intégrés dans `server.js` :

```js
const IMPOSTEUR_WORDS = {
  animaux: ['chien','chat','lion', ...],
  objets:  ['avion','guitare','parapluie', ...],
  lieux:   ['plage','montagne','bibliothèque', ...],
  actions: ['nager','cuisiner','danser', ...],
  aliments:['pizza','chocolat','pastèque', ...]
};
```

Tirage : catégorie aléatoire → mot aléatoire dans la catégorie.

---

## 5. Client `public/imposteur.html`

### Écrans CSS (`.screen`)

| ID | Visible pour | Contenu |
|----|-------------|---------|
| `s-home` | tous | Formulaire nom + créer/rejoindre |
| `s-wait` | tous | Code salle pulsant, liste joueurs, bouton start (hôte) |
| `s-setup` | hôte | Choix manches (3/5/7) + nb imposteurs (1/2) |
| `s-describe` | tous | Mot (ou ???), tour actif, descriptions précédentes, input si actif |
| `s-vote` | tous | Liste descriptions + noms, boutons vote, compteur votes |
| `s-reveal` | tous | Votes révélés, élimination animée, rôle révélé |
| `s-guess` | tous | Imposteur : input devinette / Civils : attente |
| `s-scores` | tous | Classement manche + cumul, bouton next (hôte) |
| `s-gameover` | tous | Podium, confettis, bouton rejouer |

### Design

- `theme.css` importé
- `--primary: #FF3864` (pink)
- Deep Space bg (nébuleuses tintées rose)
- Mot secret affiché dans une card neon-pink pulsante
- Timer : barre `zp-timer-fill` dégradée
- Descriptions : cards sombres apparaissant avec animation `card-in`
- Votes : boutons joueurs avec noms + avatar initiale colorée

---

## 6. `index.html` — nouvelle carte

```html
<a class="game-card neon-card c-pink" href="imposteur.html">
  <div class="zp-shine"></div>
  <span class="card-icon zp-glitch-icon">🕵️</span>
  <div class="card-name">Imposteur</div>
  <div class="card-desc">Un mot secret, un traître parmi vous. Décrivez, bluffez, démasquez !</div>
  <span class="card-badge">3–8 joueurs · Bluff</span>
</a>
```

---

## 7. Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `server.js` | Ajouter wssImposteur, imposteurRooms, logique complète |
| `public/imposteur.html` | **CRÉER** — nouveau jeu |
| `public/index.html` | Ajouter carte Imposteur dans la grille |

---

## 8. Contraintes

- Zéro changement JS dans les autres jeux
- Conserver les IDs WebSocket existants
- Compatible `shared.js` et `chat.js`
- Même pattern de salle que Loup-Garou (référence architecturale)
- Snap personnalisé par joueur (l'imposteur ne reçoit pas le mot)
