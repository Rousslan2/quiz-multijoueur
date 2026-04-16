# Débat Express — Design Spec

## Contexte
ZapPlay est une plateforme de jeux multijoueur Node.js + WebSockets. Le jeu "Débat express" est actuellement limité à 3 joueurs stricts, a des bugs de slots, un résultat de manche invisible, et seulement 15 sujets.

## Joueurs
- **3 à 6 joueurs** (lobby accepte 3-6, pas strictement 3)
- Toujours **2 débatteurs** (Pour / Contre) + **tous les autres sont juges**
- Les juges votent à la majorité — en cas d'égalité des votes, personne ne marque

## Rotation des rôles
- `forSlot = (round-1) % N`, `againstSlot = round % N`, tous les autres = juges
- `totalRounds = N × 2` → chaque joueur débat exactement 2 fois (1× Pour, 1× Contre)

## Scoring
- Débatteur gagnant : **+2 pts**
- Chaque juge ayant voté pour le gagnant : **+1 pt**
- Égalité des votes : +0 pour tout le monde

## Fix bug critique
- La déconnexion pendant une partie renumérote les slots (`p.slot = i`) et casse `forSlot`/`againstSlot`/`jurorSlot`
- Solution : ne plus renuméroter les slots après déconnexion pendant une partie active

## ROUND_RESULT
- Serveur inclut `roundWinner` (slot du gagnant ou null si égalité) + `votesSummary` ({for: N, against: N}) dans le snapshot
- UI : afficher "X a gagné cette manche !" + scores mis à jour 4 secondes

## Topics
- ~80 sujets variés (food, société, tech, lifestyle, pop culture)

## UI
- Carte de rôle mise en évidence en haut (grande, colorée, "C'EST TOI : POUR")
- Barre de progression + chrono pour le timer
- Lobby : affiche "3–6 joueurs" + liste dynamique avec indication juge/débatteur
- Résultat de manche : nom du gagnant en grand + tableau des scores
