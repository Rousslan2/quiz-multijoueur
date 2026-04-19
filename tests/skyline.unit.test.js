'use strict';
const { test, run, assert } = require('./harness');
const sky = require('../lib/skylineGame');

console.log('Skyline — unit (state machine pur, lib/skylineGame.js)');

function fakeWs(id) { return { _id: id, readyState: 1 }; }
function mkRoom(nPlayers = 2) {
  const room = sky.createRoom('ABCD', 'Host');
  for (let i = 0; i < nPlayers; i++) {
    sky.addPlayer(room, fakeWs('ws' + i), 'P' + i);
  }
  return room;
}

test('targetFloorsForRound : progression 3→5→7→9→11', () => {
  assert.strictEqual(sky.targetFloorsForRound(1), 3);
  assert.strictEqual(sky.targetFloorsForRound(2), 5);
  assert.strictEqual(sky.targetFloorsForRound(3), 7);
  assert.strictEqual(sky.targetFloorsForRound(4), 9);
  assert.strictEqual(sky.targetFloorsForRound(5), 11);
});

test('targetFloorsForRound : plafonné à MAX_FLOORS_CAP', () => {
  assert.strictEqual(sky.targetFloorsForRound(99), sky.MAX_FLOORS_CAP);
});

test('stackDifficulty : 1.0 en manche 1, +0.14 par manche', () => {
  assert.strictEqual(sky.stackDifficulty(1), 1);
  assert.ok(Math.abs(sky.stackDifficulty(2) - 1.14) < 1e-9);
  assert.ok(Math.abs(sky.stackDifficulty(5) - 1.56) < 1e-9);
});

test('createRoom : état initial WAITING, scores/floors vides', () => {
  const room = sky.createRoom('WXYZ', 'Alice');
  assert.strictEqual(room.code, 'WXYZ');
  assert.strictEqual(room.host, 'Alice');
  assert.strictEqual(room.phase, 'WAITING');
  assert.strictEqual(room.round, 0);
  assert.strictEqual(room.totalRounds, sky.TOTAL_ROUNDS);
  assert.deepStrictEqual(room.players, []);
  assert.deepStrictEqual(room.spectators, []);
});

test('addPlayer : ajoute au premier slot libre et initialise score/floors', () => {
  const room = sky.createRoom('CODE', 'H');
  const s0 = sky.addPlayer(room, fakeWs('a'), 'Alice');
  const s1 = sky.addPlayer(room, fakeWs('b'), 'Bob');
  assert.strictEqual(s0, 0);
  assert.strictEqual(s1, 1);
  assert.strictEqual(room.players.length, 2);
  assert.strictEqual(room.scores[0], 0);
  assert.strictEqual(room.scores[1], 0);
  assert.strictEqual(room.floors[0], 0);
  assert.strictEqual(room.floors[1], 0);
});

test('addPlayer : refuse si salle pleine', () => {
  const room = sky.createRoom('CODE', 'H');
  for (let i = 0; i < sky.MAX_PLAYERS; i++) {
    assert.strictEqual(sky.addPlayer(room, fakeWs('p' + i), 'P' + i), i);
  }
  assert.strictEqual(sky.addPlayer(room, fakeWs('x'), 'X'), -1);
});

test('addPlayer : refuse si phase != WAITING', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  assert.strictEqual(sky.addPlayer(room, fakeWs('late'), 'Late'), -1);
});

test('sanitizeName : coupe à 20 et remplace vide par "Joueur"', () => {
  assert.strictEqual(sky.sanitizeName('  '), 'Joueur');
  assert.strictEqual(sky.sanitizeName(null), 'Joueur');
  const long = 'abcdefghij'.repeat(5);
  assert.strictEqual(sky.sanitizeName(long).length, 20);
});

test('beginGame : phase TURNING, round 1, turnSlot 0', () => {
  const room = mkRoom(3);
  sky.beginGame(room);
  assert.strictEqual(room.phase, 'TURNING');
  assert.strictEqual(room.round, 1);
  assert.strictEqual(room.turnSlot, 0);
  room.players.forEach(p => {
    assert.strictEqual(room.scores[p.slot], 0);
    assert.strictEqual(room.floors[p.slot], 0);
  });
  assert.strictEqual(room.stackDifficulty, 1);
});

test('startTurn : fixe turnStart et turnEnd = start + STACK_TURN_MS', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  sky.startTurn(room, 10000);
  assert.strictEqual(room.turnStart, 10000);
  assert.strictEqual(room.turnEnd, 10000 + sky.STACK_TURN_MS);
});

test('processStackDone : accepte score valide, accumule pts * PTS_PER_FLOOR', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  const r = sky.processStackDone(room, 0, 7);
  assert.ok(r && r.ok);
  assert.strictEqual(r.stackScore, 7);
  assert.strictEqual(r.pointsDelta, 7 * sky.PTS_PER_FLOOR);
  assert.strictEqual(r.success, true);
  assert.strictEqual(room.floors[0], 7);
  assert.strictEqual(room.scores[0], 7 * sky.PTS_PER_FLOOR);
});

test('processStackDone : score 0 → success false, pas de points', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  const r = sky.processStackDone(room, 0, 0);
  assert.ok(r && r.ok);
  assert.strictEqual(r.stackScore, 0);
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.pointsDelta, 0);
  assert.strictEqual(room.floors[0], 0);
  assert.strictEqual(room.scores[0], 0);
});

test('processStackDone : clampé à MAX_STACK_SCORE', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  const r = sky.processStackDone(room, 0, 99999);
  assert.strictEqual(r.stackScore, sky.MAX_STACK_SCORE);
});

test('processStackDone : refuse score négatif (clampé à 0)', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  const r = sky.processStackDone(room, 0, -10);
  assert.strictEqual(r.stackScore, 0);
});

test('processStackDone : refuse si slot != turnSlot (retour null)', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  assert.strictEqual(sky.processStackDone(room, 1, 5), null);
});

test('processStackDone : refuse si phase != TURNING (retour null)', () => {
  const room = mkRoom(2);
  assert.strictEqual(sky.processStackDone(room, 0, 5), null); // WAITING
});

test('timeoutCurrentTurn : met score à 0 et signale timeout', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  room.floors[0] = 5; // simulé : le joueur avait empilé 5 étages en local
  const r = sky.timeoutCurrentTurn(room);
  assert.ok(r && r.ok);
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.reason, 'timeout');
  assert.strictEqual(r.stackScore, 0);
  assert.strictEqual(room.floors[0], 0);
});

test('advanceTurn : tour 0 → tour 1, phase TURNING', () => {
  const room = mkRoom(3);
  sky.beginGame(room);
  const out = sky.advanceTurn(room);
  assert.strictEqual(out.phase, 'TURNING');
  assert.strictEqual(room.turnSlot, 1);
});

test('advanceTurn : wrap sur slot 0 → évalue la manche', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  sky.processStackDone(room, 0, 3);   // floors=3 → atteint target=3
  sky.advanceTurn(room);
  sky.processStackDone(room, 1, 2);   // floors=2 → rate target
  const out = sky.advanceTurn(room);
  assert.strictEqual(out.phase, 'TURNING');
  assert.ok(out.roundResult);
  assert.strictEqual(out.roundResult.round, 1);
  assert.strictEqual(out.roundResult.targetFloors, 3);
  assert.strictEqual(out.roundResult.bonuses.length, 1);
  assert.strictEqual(out.roundResult.bonuses[0].slot, 0);
  assert.strictEqual(out.roundResult.bonuses[0].bonus, sky.ROUND_BONUS);
  assert.strictEqual(room.round, 2);
  assert.strictEqual(room.turnSlot, 0);
  /** Floors réinitialisés en début de manche */
  assert.strictEqual(room.floors[0], 0);
  assert.strictEqual(room.floors[1], 0);
  /** Bonus ajouté au score de P0 : 3 × PTS_PER_FLOOR + ROUND_BONUS */
  assert.strictEqual(room.scores[0], 3 * sky.PTS_PER_FLOOR + sky.ROUND_BONUS);
  assert.strictEqual(room.scores[1], 2 * sky.PTS_PER_FLOOR);
});

test('evaluateRound : aucun joueur n\'atteint l\'objectif → aucun bonus', () => {
  const room = mkRoom(3);
  sky.beginGame(room);
  room.floors = { 0: 1, 1: 2, 2: 0 }; // target round 1 = 3, aucun ne l'a
  const res = sky.evaluateRound(room);
  assert.strictEqual(res.bonuses.length, 0);
  room.players.forEach(p => { assert.strictEqual(room.scores[p.slot], 0); });
});

test('evaluateRound : tous atteignent → tous reçoivent le bonus', () => {
  const room = mkRoom(3);
  sky.beginGame(room);
  room.floors = { 0: 3, 1: 4, 2: 10 };
  const res = sky.evaluateRound(room);
  assert.strictEqual(res.bonuses.length, 3);
  assert.strictEqual(room.scores[0], sky.ROUND_BONUS);
  assert.strictEqual(room.scores[1], sky.ROUND_BONUS);
  assert.strictEqual(room.scores[2], sky.ROUND_BONUS);
});

test('advanceTurn : après la dernière manche → GAME_OVER', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  for (let r = 1; r <= sky.TOTAL_ROUNDS; r++) {
    sky.processStackDone(room, 0, 1);
    sky.advanceTurn(room);
    sky.processStackDone(room, 1, 1);
    const out = sky.advanceTurn(room);
    if (r < sky.TOTAL_ROUNDS) {
      assert.strictEqual(out.phase, 'TURNING');
    } else {
      assert.strictEqual(out.phase, 'GAME_OVER');
      assert.strictEqual(out.gameOver, true);
    }
  }
  assert.strictEqual(room.phase, 'GAME_OVER');
});

test('snapshot : inclut tous les champs protocole + phase/players/scores', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  sky.startTurn(room, 50000);
  const snap = sky.snapshot(room, 50001);
  assert.strictEqual(snap.type, 'skyline_state');
  assert.strictEqual(snap.phase, 'TURNING');
  assert.strictEqual(snap.code, 'ABCD');
  assert.strictEqual(snap.serverTime, 50001);
  assert.strictEqual(snap.players.length, 2);
  assert.strictEqual(snap.round, 1);
  assert.strictEqual(snap.totalRounds, sky.TOTAL_ROUNDS);
  assert.strictEqual(snap.targetFloors, 3);
  assert.strictEqual(snap.turnSlot, 0);
  assert.strictEqual(snap.turnStart, 50000);
  assert.strictEqual(snap.turnEnd, 50000 + sky.STACK_TURN_MS);
  assert.strictEqual(snap.stackDifficulty, 1);
});

test('snapshot : fusionne extra (ex: reason, bonus)', () => {
  const room = mkRoom(2);
  const snap = sky.snapshot(room, 1, { foo: 'bar' });
  assert.strictEqual(snap.foo, 'bar');
});

test('removePlayerByWs : renumérote les slots et préserve les scores par slot', () => {
  const wsA = fakeWs('a');
  const wsB = fakeWs('b');
  const wsC = fakeWs('c');
  const room = sky.createRoom('AAAA', 'host');
  sky.addPlayer(room, wsA, 'A');
  sky.addPlayer(room, wsB, 'B');
  sky.addPlayer(room, wsC, 'C');
  sky.beginGame(room);
  /** A : 3 étages, B : 5 étages, C n'a pas joué */
  room.scores[0] = 30;
  room.scores[1] = 50;
  room.floors[0] = 3;
  room.floors[1] = 5;
  /** Enlever B (slot 1) */
  const removed = sky.removePlayerByWs(room, wsB);
  assert.strictEqual(removed.name, 'B');
  assert.strictEqual(room.players.length, 2);
  /** A reste slot 0 (score préservé), C passe à slot 1 avec score 0 */
  assert.strictEqual(room.players[0].name, 'A');
  assert.strictEqual(room.players[0].slot, 0);
  assert.strictEqual(room.scores[0], 30);
  assert.strictEqual(room.players[1].name, 'C');
  assert.strictEqual(room.players[1].slot, 1);
  assert.strictEqual(room.scores[1], 0);
});

test('removePlayerByWs : ws inconnue → null', () => {
  const room = mkRoom(2);
  assert.strictEqual(sky.removePlayerByWs(room, fakeWs('other')), null);
});

test('removePlayerByWs : signale wasActive quand le joueur qui part était en train de jouer', () => {
  const wsA = fakeWs('a');
  const wsB = fakeWs('b');
  const room = sky.createRoom('AAAA', 'host');
  sky.addPlayer(room, wsA, 'A');
  sky.addPlayer(room, wsB, 'B');
  sky.beginGame(room);
  assert.strictEqual(room.turnSlot, 0);
  const out = sky.removePlayerByWs(room, wsA);
  assert.strictEqual(out.wasActive, true);
});

test('resetToWaiting : remet phase/round/scores à zéro, conserve les joueurs', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  sky.processStackDone(room, 0, 5);
  sky.advanceTurn(room);
  assert.strictEqual(room.scores[0], 25);
  sky.resetToWaiting(room);
  assert.strictEqual(room.phase, 'WAITING');
  assert.strictEqual(room.round, 0);
  assert.strictEqual(room.turnSlot, 0);
  assert.strictEqual(room.turnStart, 0);
  assert.strictEqual(room.turnEnd, 0);
  assert.strictEqual(room.scores[0], 0);
  assert.strictEqual(room.floors[0], 0);
  assert.strictEqual(room.players.length, 2);
});

test('partie complète 2 joueurs : cumul des points et vainqueur', () => {
  const room = mkRoom(2);
  sky.beginGame(room);
  const plan = [
    [5, 3], [4, 6], [7, 5], [8, 9], [10, 12],
  ];
  for (let i = 0; i < sky.TOTAL_ROUNDS; i++) {
    const [a, b] = plan[i];
    sky.processStackDone(room, 0, a);
    sky.advanceTurn(room);
    sky.processStackDone(room, 1, b);
    sky.advanceTurn(room);
  }
  assert.strictEqual(room.phase, 'GAME_OVER');
  /** Cumul des floors * PTS + bonus pour chaque manche où f >= target(r) */
  function expected(f, r) {
    let s = 0;
    for (let i = 0; i < f.length; i++) {
      s += f[i] * sky.PTS_PER_FLOOR;
      if (f[i] >= sky.targetFloorsForRound(i + 1)) s += sky.ROUND_BONUS;
    }
    return s;
  }
  const sA = expected(plan.map(p => p[0]));
  const sB = expected(plan.map(p => p[1]));
  assert.strictEqual(room.scores[0], sA);
  assert.strictEqual(room.scores[1], sB);
  assert.ok(sB > sA, 'joueur 1 doit gagner avec ce plan');
});

run();
