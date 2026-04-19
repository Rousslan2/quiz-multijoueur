'use strict';
/**
 * Skyline — état de jeu pur, sans effet de bord (pas de WS, pas de setTimeout).
 * Le serveur appelle ces fonctions puis gère ses propres broadcasts/timers.
 *
 * Modèle : chaque tour, un joueur empile des blocs (mécanique Stack Tower en local
 * côté client). Le serveur est l'autorité — il décide quand le tour est terminé
 * (score reçu ou timeout), accumule les scores, accorde un bonus par manche si
 * l'objectif d'étages est atteint, et arbitre la fin de partie.
 */

const TOTAL_ROUNDS = 5;
const STACK_TURN_MS = 120000;
const ROUND_BONUS = 30;
const PTS_PER_FLOOR = 5;
const MAX_PLAYERS = 8;
const MIN_PLAYERS_TO_START = 2;
const MAX_STACK_SCORE = 500;
const MAX_FLOORS_CAP = 14; // aligné sur l'objectif maximal

function targetFloorsForRound(r) {
  return Math.min(MAX_FLOORS_CAP, 3 + Math.max(0, (r | 0) - 1) * 2);
}

function stackDifficulty(r) {
  return 1 + Math.max(0, ((r | 0) || 1) - 1) * 0.14;
}

function applyDifficultyForRound(room) {
  room.stackDifficulty = stackDifficulty(room.round || 1);
}

function createRoom(code, host) {
  return {
    code,
    host,
    players: [],
    spectators: [],
    phase: 'WAITING',
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    scores: {},
    floors: {},
    turnSlot: 0,
    turnStart: 0,
    turnEnd: 0,
    stackDifficulty: 1,
    timer: null,
  };
}

/** Ajoute un joueur dans la salle.
 * @returns {number} slot attribué (-1 si refusé : salle pleine ou déjà en partie).
 */
function addPlayer(room, ws, rawName) {
  if (!room) return -1;
  if (room.phase !== 'WAITING') return -1;
  if (room.players.length >= MAX_PLAYERS) return -1;
  const name = sanitizeName(rawName);
  const slot = room.players.length;
  room.players.push({ ws, name, slot });
  room.scores[slot] = 0;
  room.floors[slot] = 0;
  return slot;
}

function sanitizeName(raw) {
  return String(raw || '').trim().slice(0, 20) || 'Joueur';
}

/** Retire le joueur associé à `ws`. Renumérote les slots restants.
 * Renvoie `{ name, wasActive }` ou null si aucun joueur trouvé.
 */
function removePlayerByWs(room, ws) {
  if (!room) return null;
  const idx = room.players.findIndex(p => p.ws === ws);
  if (idx < 0) return null;
  const leaver = room.players[idx];
  const wasActive = room.turnSlot === leaver.slot && room.phase === 'TURNING';
  room.players.splice(idx, 1);
  // Renumérotation des slots pour garder 0..n-1 continu
  const newScores = {};
  const newFloors = {};
  room.players.forEach((p, i) => {
    newScores[i] = room.scores[p.slot] || 0;
    newFloors[i] = room.floors[p.slot] || 0;
    p.slot = i;
  });
  room.scores = newScores;
  room.floors = newFloors;
  if (room.turnSlot >= room.players.length) room.turnSlot = 0;
  return { name: leaver.name, wasActive };
}

/** Prépare un début de partie. N'émet rien — le serveur enchaîne avec startTurn. */
function beginGame(room) {
  room.phase = 'TURNING';
  room.round = 1;
  room.turnSlot = 0;
  room.players.forEach(p => {
    room.scores[p.slot] = 0;
    room.floors[p.slot] = 0;
  });
  applyDifficultyForRound(room);
}

/** Démarre un nouveau tour — set phase/timestamps. Serveur : déclenche bcast + timer. */
function startTurn(room, now) {
  room.phase = 'TURNING';
  room.turnStart = now;
  room.turnEnd = now + STACK_TURN_MS;
}

/** Traite le score envoyé par le client qui termine son tour.
 * Renvoie `{ ok, slot, name, stackScore, success, pointsDelta, floors, score, round }`
 * prêt à être broadcast. Retourne null si l'appel est invalide.
 */
function processStackDone(room, slot, rawScore) {
  if (!room) return null;
  if (room.phase !== 'TURNING') return null;
  if (slot !== room.turnSlot) return null;
  const pl = room.players.find(p => p.slot === slot);
  if (!pl) return null;
  const sc = Math.max(0, Math.min(MAX_STACK_SCORE, Math.floor(Number(rawScore) || 0)));
  let pts = 0;
  if (sc < 1) {
    room.floors[slot] = 0;
  } else {
    room.floors[slot] = sc;
    pts = sc * PTS_PER_FLOOR;
    room.scores[slot] = (room.scores[slot] || 0) + pts;
  }
  return {
    ok: true,
    slot,
    name: pl.name,
    stackScore: sc,
    success: sc >= 1,
    reason: sc >= 1 ? 'done' : 'fall',
    pointsDelta: pts,
    floors: room.floors[slot] || 0,
    score: room.scores[slot] || 0,
    round: room.round,
  };
}

/** Expire le tour en cours (score = 0). Même contrat que processStackDone. */
function timeoutCurrentTurn(room) {
  if (!room) return null;
  if (room.phase !== 'TURNING') return null;
  const slot = room.turnSlot;
  const pl = room.players.find(p => p.slot === slot);
  room.floors[slot] = 0;
  return {
    ok: true,
    slot,
    name: pl ? pl.name : '?',
    stackScore: 0,
    success: false,
    reason: 'timeout',
    pointsDelta: 0,
    floors: 0,
    score: room.scores[slot] || 0,
    round: room.round,
  };
}

/** Avance au tour suivant. Si tous les joueurs ont joué cette manche, évalue,
 * puis avance la manche. Retourne un résumé : { phase, roundResult?, gameOver? }.
 * Ne démarre pas le prochain tour — le serveur enchaîne avec startTurn.
 */
function advanceTurn(room) {
  const n = room.players.length;
  if (n === 0) {
    room.phase = 'WAITING';
    return { phase: 'WAITING' };
  }
  room.turnSlot = (room.turnSlot + 1) % n;
  let roundResult = null;
  let gameOver = false;
  if (room.turnSlot === 0) {
    roundResult = evaluateRound(room);
    room.round++;
    if (room.round > room.totalRounds) {
      room.phase = 'GAME_OVER';
      gameOver = true;
      return { phase: 'GAME_OVER', roundResult, gameOver };
    }
    resetFloorsForNewRound(room);
    applyDifficultyForRound(room);
  }
  return { phase: 'TURNING', roundResult, gameOver };
}

/** Évalue la manche écoulée, accorde les bonus d'objectif. */
function evaluateRound(room) {
  const R = room.round || 1;
  const target = targetFloorsForRound(R);
  const bonuses = [];
  room.players.forEach(p => {
    const f = room.floors[p.slot] || 0;
    if (f >= target) {
      room.scores[p.slot] = (room.scores[p.slot] || 0) + ROUND_BONUS;
      bonuses.push({ slot: p.slot, name: p.name, bonus: ROUND_BONUS, floors: f });
    }
  });
  return {
    round: R,
    targetFloors: target,
    bonuses,
    scores: room.players.map(p => ({
      slot: p.slot,
      name: p.name,
      score: room.scores[p.slot] || 0,
    })),
  };
}

function resetFloorsForNewRound(room) {
  room.players.forEach(p => { room.floors[p.slot] = 0; });
}

/** Remet la salle en WAITING — appelé après game over (restart) ou en cas de
 * déconnexion pendant un tour.
 */
function resetToWaiting(room) {
  room.phase = 'WAITING';
  room.round = 0;
  room.turnSlot = 0;
  room.turnStart = 0;
  room.turnEnd = 0;
  room.stackDifficulty = 1;
  room.players.forEach(p => {
    room.scores[p.slot] = 0;
    room.floors[p.slot] = 0;
  });
}

/** Construit l'état broadcast à envoyer aux clients. */
function snapshot(room, now, extra) {
  const tgt = targetFloorsForRound(room.round || 1);
  return Object.assign({
    type: 'skyline_state',
    phase: room.phase,
    code: room.code,
    serverTime: now,
    players: room.players.map(p => ({
      name: p.name,
      slot: p.slot,
      score: room.scores[p.slot] || 0,
      floors: room.floors[p.slot] || 0,
    })),
    round: room.round,
    totalRounds: room.totalRounds,
    targetFloors: tgt,
    turnSlot: room.turnSlot,
    turnStart: room.turnStart,
    turnEnd: room.turnEnd,
    stackDifficulty: room.stackDifficulty != null ? room.stackDifficulty : 1,
  }, extra || {});
}

module.exports = {
  TOTAL_ROUNDS,
  STACK_TURN_MS,
  ROUND_BONUS,
  PTS_PER_FLOOR,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MAX_STACK_SCORE,
  MAX_FLOORS_CAP,
  targetFloorsForRound,
  stackDifficulty,
  applyDifficultyForRound,
  createRoom,
  addPlayer,
  removePlayerByWs,
  sanitizeName,
  beginGame,
  startTurn,
  processStackDone,
  timeoutCurrentTurn,
  advanceTurn,
  evaluateRound,
  resetFloorsForNewRound,
  resetToWaiting,
  snapshot,
};
