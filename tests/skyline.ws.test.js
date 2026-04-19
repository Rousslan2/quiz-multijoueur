'use strict';
/**
 * Skyline — tests d'intégration WebSocket.
 * Démarre un vrai serveur Node (server.js) sur un port libre, ouvre plusieurs
 * clients WS et vérifie le protocole complet (create/join/start/stack_done/…).
 * Objectif : s'assurer que les corrections (auto-submit, round_result.scores,
 * restart qui reset les horodatages) tiennent au passage des messages réels.
 */
const { test, run, assert } = require('./harness');
const { fork } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const net = require('net');

console.log('Skyline — intégration (serveur WebSocket réel)');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, '..', 'server.js'), [], {
      env: Object.assign({}, process.env, { PORT: String(port) }),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let ready = false;
    const to = setTimeout(() => {
      if (!ready) reject(new Error('serveur n\'a pas démarré en 5s'));
    }, 5000);
    child.stdout.on('data', buf => {
      const s = String(buf);
      if (!ready && s.includes(':' + port)) {
        ready = true;
        clearTimeout(to);
        resolve(child);
      }
    });
    child.stderr.on('data', buf => {
      process.stderr.write('[server stderr] ' + buf);
    });
    child.on('exit', (code, sig) => {
      if (!ready) {
        clearTimeout(to);
        reject(new Error('serveur a quitté code=' + code + ' sig=' + sig));
      }
    });
  });
}

function stopServer(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode != null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 1500);
  });
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws/skyline');
    const to = setTimeout(() => reject(new Error('ws connect timeout')), 3000);
    ws.on('open', () => { clearTimeout(to); resolve(ws); });
    ws.on('error', e => { clearTimeout(to); reject(e); });
  });
}

function collector(ws) {
  const msgs = [];
  const waiters = [];
  ws.on('message', raw => {
    let d;
    try { d = JSON.parse(raw); } catch { return; }
    msgs.push(d);
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (w.match(d)) {
        waiters.splice(i, 1);
        w.resolve(d);
      }
    }
  });
  return {
    all: msgs,
    waitFor(predicate, timeout = 3000) {
      const match = typeof predicate === 'string'
        ? d => d.type === predicate
        : predicate;
      const existing = msgs.find(match);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const to = setTimeout(() => {
          const idx = waiters.findIndex(w => w.resolve === resolve);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error('timeout waiting for ' + (typeof predicate === 'string' ? predicate : 'predicate')));
        }, timeout);
        waiters.push({
          match,
          resolve: v => { clearTimeout(to); resolve(v); },
        });
      });
    },
    clear() { msgs.length = 0; },
  };
}

function send(ws, data) { ws.send(JSON.stringify(data)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let PORT;
let CHILD;

test('setup : démarrer le serveur', async () => {
  PORT = await findFreePort();
  CHILD = await startServer(PORT);
  assert.ok(CHILD && CHILD.pid);
});

test('create_skyline + welcome : le créateur reçoit created_skyline + snap WAITING', async () => {
  const ws = await connect(PORT);
  const c = collector(ws);
  send(ws, { type: 'create_skyline', name: 'Alice' });
  const created = await c.waitFor('created_skyline');
  assert.strictEqual(created.slot, 0);
  assert.strictEqual(created.name, 'Alice');
  assert.match(created.code, /^[A-Z0-9]{4}$/);
  const snap = await c.waitFor('skyline_state');
  assert.strictEqual(snap.phase, 'WAITING');
  assert.strictEqual(snap.players.length, 1);
  ws.close();
});

test('join_skyline : second joueur rejoint, snap diffusé aux 2', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');
  const code = created.code;

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code });
  await cb.waitFor('welcome_skyline');
  const snapA = await ca.waitFor(d => d.type === 'skyline_state' && d.players.length === 2);
  assert.strictEqual(snapA.phase, 'WAITING');
  assert.deepStrictEqual(snapA.players.map(p => p.name), ['A', 'B']);
  a.close(); b.close();
});

test('join refusé : salle introuvable', async () => {
  const x = await connect(PORT);
  const cx = collector(x);
  send(x, { type: 'join_skyline', name: 'X', code: 'ZZZZ' });
  const err = await cx.waitFor('error');
  assert.match(err.msg, /introuvable/i);
  x.close();
});

test('start_skyline : countdown puis snap TURNING avec turnEnd ≈ serverTime + STACK_TURN_MS', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  const cd = await ca.waitFor('countdown');
  assert.strictEqual(cd.seconds, 3);

  const turn = await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);
  assert.strictEqual(turn.turnSlot, 0);
  assert.strictEqual(turn.round, 1);
  assert.strictEqual(turn.targetFloors, 3);
  assert.ok(turn.turnEnd > turn.serverTime, 'turnEnd > serverTime');
  const diff = turn.turnEnd - turn.serverTime;
  assert.ok(diff > 100000 && diff <= 120000, 'turn duration ~120s (got ' + diff + ')');
  a.close(); b.close();
});

test('skyline_stack_done : accepte le score, broadcast turn_result + snap tour suivant', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);

  ca.clear(); cb.clear();
  send(a, { type: 'skyline_stack_done', score: 5 });
  const tr = await cb.waitFor('skyline_turn_result', 2000);
  assert.strictEqual(tr.slot, 0);
  assert.strictEqual(tr.stackScore, 5);
  assert.strictEqual(tr.success, true);
  assert.strictEqual(tr.pointsDelta, 25);
  /** Snap du tour suivant : turnSlot = 1 (B), round inchangé */
  const nextTurn = await cb.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING' && d.turnSlot === 1, 2000);
  assert.strictEqual(nextTurn.round, 1);
  /** Scores mis à jour dans le snap */
  const pA = nextTurn.players.find(p => p.slot === 0);
  assert.strictEqual(pA.score, 25);
  assert.strictEqual(pA.floors, 5);
  a.close(); b.close();
});

test('skyline_round_result : contient scores[] à jour après fin de manche', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);

  ca.clear(); cb.clear();
  send(a, { type: 'skyline_stack_done', score: 4 }); // A atteint l'objectif (3)
  await cb.waitFor(d => d.type === 'skyline_state' && d.turnSlot === 1, 2000);
  send(b, { type: 'skyline_stack_done', score: 2 }); // B n'atteint pas
  const rr = await cb.waitFor('skyline_round_result', 2000);
  assert.strictEqual(rr.round, 1);
  assert.strictEqual(rr.targetFloors, 3);
  assert.strictEqual(rr.bonuses.length, 1);
  assert.strictEqual(rr.bonuses[0].name, 'A');
  assert.ok(Array.isArray(rr.scores), 'scores inclus dans round_result');
  assert.strictEqual(rr.scores.length, 2);
  const sA = rr.scores.find(s => s.slot === 0);
  assert.strictEqual(sA.score, 4 * 5 + 30);
  a.close(); b.close();
});

test('restart_skyline : GAME_OVER → WAITING avec turnStart/turnEnd reset', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);
  /** Jouer les 5 manches en fast-forward (scores=1 suffisent) */
  for (let r = 1; r <= 5; r++) {
    send(a, { type: 'skyline_stack_done', score: 1 });
    await cb.waitFor(d => d.type === 'skyline_state' && d.turnSlot === 1, 2000);
    send(b, { type: 'skyline_stack_done', score: 1 });
    if (r < 5) {
      await cb.waitFor(d => d.type === 'skyline_state' && d.turnSlot === 0 && d.round === r + 1, 2000);
    }
  }
  const over = await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'GAME_OVER', 5000);
  assert.strictEqual(over.phase, 'GAME_OVER');

  ca.clear(); cb.clear();
  send(a, { type: 'restart_skyline' });
  const snap = await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'WAITING', 2000);
  assert.strictEqual(snap.turnStart, 0);
  assert.strictEqual(snap.turnEnd, 0);
  assert.strictEqual(snap.round, 0);
  snap.players.forEach(p => {
    assert.strictEqual(p.score, 0);
    assert.strictEqual(p.floors, 0);
  });
  a.close(); b.close();
});

test('join pendant TURNING : refusé', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);

  const c = await connect(PORT);
  const cc = collector(c);
  send(c, { type: 'join_skyline', name: 'Late', code: created.code });
  const err = await cc.waitFor('error', 2000);
  assert.match(err.msg, /déjà en cours/i);
  a.close(); b.close(); c.close();
});

test('start refusé avec < 2 joueurs', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'Solo' });
  await ca.waitFor('created_skyline');
  send(a, { type: 'start_skyline' });
  const err = await ca.waitFor('error', 1500);
  assert.match(err.msg, /2 joueurs/i);
  a.close();
});

test('spectateur : reçoit l\'état initial, ne peut pas bouger', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const sp = await connect(PORT);
  const csp = collector(sp);
  send(sp, { type: 'join_skyline_spectate', name: 'Eve', code: created.code });
  const welcome = await csp.waitFor('welcome_skyline_spectate');
  assert.strictEqual(welcome.name, 'Eve');
  const snap = await csp.waitFor('skyline_state');
  assert.strictEqual(snap.phase, 'WAITING');
  a.close(); sp.close();
});

test('déconnexion du joueur actif en TURNING : retour WAITING, scores reset', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);
  send(a, { type: 'skyline_stack_done', score: 3 });
  await cb.waitFor(d => d.type === 'skyline_state' && d.turnSlot === 1, 2000);

  cb.clear();
  a.close();
  /** B reçoit player_left puis snap WAITING */
  await cb.waitFor('player_left', 2000);
  const snap = await cb.waitFor(d => d.type === 'skyline_state' && d.phase === 'WAITING', 2000);
  /** Nouveau slot 0 car renumérotation, scores reset */
  assert.strictEqual(snap.players[0].name, 'B');
  assert.strictEqual(snap.players[0].slot, 0);
  assert.strictEqual(snap.players[0].score, 0);
  b.close();
});

test('score sans limite haute : cappé à 500 côté serveur', async () => {
  const a = await connect(PORT);
  const ca = collector(a);
  send(a, { type: 'create_skyline', name: 'A' });
  const created = await ca.waitFor('created_skyline');

  const b = await connect(PORT);
  const cb = collector(b);
  send(b, { type: 'join_skyline', name: 'B', code: created.code });
  await cb.waitFor('welcome_skyline');

  send(a, { type: 'start_skyline' });
  await ca.waitFor(d => d.type === 'skyline_state' && d.phase === 'TURNING', 5000);

  cb.clear();
  send(a, { type: 'skyline_stack_done', score: 99999 });
  const tr = await cb.waitFor('skyline_turn_result', 2000);
  assert.strictEqual(tr.stackScore, 500);
  a.close(); b.close();
});

test('teardown : arrêter le serveur', async () => {
  await stopServer(CHILD);
  assert.ok(CHILD.exitCode != null || CHILD.killed);
});

run();
