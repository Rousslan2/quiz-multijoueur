# Skyline — Design & Protocole

> Jeu de Stack Tower multijoueur au tour par tour, 2–8 joueurs, 5 manches.

## Vue d'ensemble

**Skyline** reprend la mécanique de *stack-tower-game* : un bloc rebondit en haut
du canvas, le joueur appuie (clic ou <kbd>Espace</kbd>) pour le lâcher ; s'il est
mal aligné, la partie qui dépasse est coupée ; s'il rate complètement la pile,
la tour s'effondre et le tour se termine.

Le jeu est **multijoueur au tour par tour** : chaque joueur construit sa propre
tour pendant son tour (120 s max), puis la main passe au joueur suivant.

- **2 à 8 joueurs** par salle
- **5 manches** (`TOTAL_ROUNDS`)
- **Chaque joueur joue 1 tour par manche**
- **Tour de 120 s max** (`STACK_TURN_MS`)
- **Objectif par manche** : `3 + 2·(round-1)` étages, plafonné à **14**
- **Bonus objectif** : **+30 pts** (`ROUND_BONUS`) si l'étage atteint ≥ objectif
- **Difficulté progressive** : la vitesse horizontale de démarrage augmente de
  **×1.00** en manche 1 à **×1.56** en manche 5 (`1 + 0.14·(round-1)`)
- **Points** : `étages · 5` (`PTS_PER_FLOOR`) + bonus objectif éventuel
- **Vainqueur** : score cumulé le plus haut après 5 manches

## Architecture

```
public/skyline.html           — UI + binding WebSocket
public/skyline.css            — design system (cartes glass, scoreboard, podium, timer)
public/skyline-stack-canvas.js — moteur 2D canvas (bloc qui rebondit, chute, découpe)
public/skyline-tower-3d.js    — aperçu 3D WebGL (Three.js) de la tour empilée
server.js § SKYLINE           — handlers WS, timers, broadcasts
lib/skylineGame.js            — machine d'état pure (sans effet de bord)
tests/skyline.unit.test.js    — tests unitaires de lib/skylineGame.js
tests/skyline.assets.test.js  — cohérence HTML/CSS (hooks UI, fichier CSS présent)
tests/skyline.ws.test.js      — tests d'intégration WebSocket end-to-end
```

### Design (UI)

- **Fichier dédié** `skyline.css` : variables `--sky-*`, cartes en verre (`backdrop-filter`),
  grille **scoreboard** live pendant `TURNING`, labels « Prévisualisation 3D » / « Terrain »,
  compte à rebours, écran de fin avec **podium** (🥇🥈🥉).
- **Accessibilité** : `prefers-reduced-motion` pour la ville CSS en arrière-plan ;
  focus clavier sur la boîte de code (lobby).

L'état pur dans `lib/skylineGame.js` n'a **aucune** dépendance à `ws` / timers /
broadcasts. Le serveur se contente d'appeler ces fonctions puis de diffuser les
messages correspondants. Cela rend l'ensemble testable sans mocker le réseau.

## Machine d'état serveur

```
                    ┌─────────────┐
                    │   WAITING   │◄─────── player_left, restart_skyline
                    └──────┬──────┘
                           │ start_skyline (host, ≥2 players)
                           │ + 3s countdown
                           ▼
                    ┌─────────────┐
          ┌────────►│   TURNING   │──── timeout 120s ──┐
          │         └──────┬──────┘                    │
          │                │ skyline_stack_done        │
          │                ▼                           │
          │  skyline_turn_result (bcast)               │
          │                │                           │
          │     ┌──────────┴──────────┐                │
          │     │ next slot            │ wrap (slot=0) │
          │     │                      ▼               │
          │     │            skyline_round_result ◄────┘
          │     │                      │
          │     │               round < totalRounds ?
          │     │                     / \
          │     │                  yes│ │no
          │     └─────────────────────┘ │
          │                             ▼
          │                      ┌─────────────┐
          └──────── restart ─────┤  GAME_OVER  │
                                 └─────────────┘
```

### Phases

| Phase      | Description                                                                  |
|------------|------------------------------------------------------------------------------|
| `WAITING`  | Lobby ouvert, joueurs peuvent rejoindre. Hôte peut lancer si ≥ 2 joueurs.    |
| `TURNING`  | Un joueur joue, les autres regardent. `turnSlot`, `turnStart`, `turnEnd` set.|
| `GAME_OVER`| 5 manches terminées. Classement affiché. Hôte peut redémarrer.               |

## Protocole WebSocket

**Endpoint** : `ws://<host>/ws/skyline`

### Messages client → serveur

| Type                      | Payload                           | Effet                                                         |
|---------------------------|-----------------------------------|---------------------------------------------------------------|
| `create_skyline`          | `{ name }`                        | Crée une salle, le client devient slot 0 (hôte).              |
| `join_skyline`            | `{ name, code }`                  | Rejoint une salle en WAITING. Refus si pleine/en cours.       |
| `join_skyline_spectate`   | `{ name, code }`                  | Rejoint en spectateur (max 20). Pas de slot, pas d'actions.   |
| `start_skyline`           | —                                 | (Hôte) Démarre un compte à rebours 3 s puis la manche 1.      |
| `skyline_stack_done`      | `{ score: int }`                  | Envoie le score final du tour en cours (0–500).               |
| `restart_skyline`         | —                                 | (Hôte, après GAME_OVER) Reset → WAITING.                      |
| `lounge_chat`             | `{ text }`                        | Message dans le salon partagé.                                |

### Messages serveur → client

| Type                          | Payload                                                                                                                                                                      |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `created_skyline`             | `{ code, slot, name }` — confirme la création au créateur.                                                                                                                  |
| `welcome_skyline`             | `{ code, slot, name }` — confirme l'entrée au joueur.                                                                                                                       |
| `welcome_skyline_spectate`    | `{ code, name }` — confirme l'entrée en spectateur.                                                                                                                         |
| `skyline_state`               | Snapshot complet (voir ci-dessous).                                                                                                                                         |
| `countdown`                   | `{ seconds }` — déclenche l'affichage du countdown.                                                                                                                         |
| `skyline_turn_result`         | `{ slot, name, stackScore, success, reason, pointsDelta, floors, score, round, serverTime }` — résultat du tour qui vient de finir (normal, chute, ou timeout).             |
| `skyline_round_result`        | `{ round, targetFloors, bonuses: [{slot,name,bonus,floors}], scores: [{slot,name,score}], serverTime }` — résultat de la manche : qui touche le bonus, scores cumulés.     |
| `player_left`                 | `{ name }` — un joueur a quitté.                                                                                                                                            |
| `error`                       | `{ msg }` — erreur humainement lisible.                                                                                                                                     |
| `lounge_chat`                 | `{ name, slot, spectator, text, time, code }` — message de chat.                                                                                                            |

### Forme du snapshot `skyline_state`

```jsonc
{
  "type": "skyline_state",
  "phase": "WAITING" | "TURNING" | "GAME_OVER",
  "code": "ABCD",
  "serverTime": 1730000000000,
  "players": [
    { "name": "Alice", "slot": 0, "score": 45, "floors": 3 },
    { "name": "Bob",   "slot": 1, "score": 30, "floors": 0 }
  ],
  "round": 2,
  "totalRounds": 5,
  "targetFloors": 5,
  "turnSlot": 1,
  "turnStart": 1730000000000,
  "turnEnd": 1730000120000,
  "stackDifficulty": 1.14
}
```

Le client calcule le temps restant via `turnEnd - serverTime`, puis l'applique
localement. Cela évite la dérive d'horloge : le client n'utilise jamais sa propre
horloge pour la fin du tour.

## Scoring

Pour chaque tour :

- **Points de base** = `étages · 5`
- **Bonus** = `+30 pts` si `étages ≥ targetFloors(round)` à la fin de la manche

Exemple (manche 3, objectif 7) :

| étages | points de base | bonus | total manche |
|-------:|---------------:|------:|-------------:|
| 0      | 0              | 0     | 0            |
| 4      | 20             | 0     | 20           |
| 7      | 35             | 30    | 65           |
| 10     | 50             | 30    | 80           |

Le **bonus** n'est appliqué qu'au moment de `skyline_round_result` (fin de
manche) — il n'apparaît pas dans `skyline_turn_result`.

## Correction du bug critique « timeout = 0 étage »

Avant ce correctif, un joueur qui empilait proprement 8 étages puis laissait le
bloc rebondir sans jamais rater recevait **0 point** quand le timer serveur
(120 s) expirait, car le client n'envoyait `skyline_stack_done` que sur game-over
local (chute).

Corrections :

1. **Nouveau bouton « Valider »** qui appelle `submitCurrentScore()` — termine le
   tour avec le score courant à la demande du joueur.
2. **Auto-soumission** : le client track `turnEnd` côté serveur et à 300 ms de
   l'expiration, si le tour est toujours en cours, envoie automatiquement le
   score courant.
3. **Timer UI** : barre de progression + compteur en secondes, virant au
   jaune < 15 s et au rouge < 5 s.

Ainsi le client prend la décision d'envoyer avant le timeout serveur, garantissant
que la pile empilée est toujours comptabilisée.

## Lancer les tests

```bash
npm test
```

Exécute :

1. `node --check` sur tous les fichiers source (syntaxe)
2. **29 tests unitaires** de `lib/skylineGame.js` (machine d'état pure)
3. **14 tests d'intégration** lancés contre une vraie instance du serveur
   (spawned via `child_process.fork`) sur un port libre, avec de vrais clients
   WebSocket.

## Références

- Mécanique de base : [TrinitroToluen0/stack-tower-game](https://github.com/TrinitroToluen0/stack-tower-game)
- Rendu 3D : [Three.js 0.160](https://threejs.org/)
