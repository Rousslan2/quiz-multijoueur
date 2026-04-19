'use strict';
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'admin-config.json');

const DEFAULT_HIDDEN = [];

function ensureDataDir() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeGameId(id) {
  if (!id) return '';
  let s = String(id).trim().toLowerCase();
  if (s.endsWith('.html')) s = s.slice(0, -5);
  return s;
}

function loadAdminConfig() {
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_PATH)) {
      return { hiddenGames: [...DEFAULT_HIDDEN] };
    }
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const hidden = Array.isArray(raw.hiddenGames)
      ? raw.hiddenGames.map(normalizeGameId).filter(Boolean)
      : [];
    return { hiddenGames: hidden };
  } catch {
    return { hiddenGames: [...DEFAULT_HIDDEN] };
  }
}

function saveAdminConfig(cfg) {
  ensureDataDir();
  const hidden = Array.isArray(cfg.hiddenGames)
    ? [...new Set(cfg.hiddenGames.map(normalizeGameId).filter(Boolean))]
    : [];
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ hiddenGames: hidden }, null, 2), 'utf8');
  return { hiddenGames: hidden };
}

function getHiddenSet(cfg) {
  return new Set((cfg.hiddenGames || []).map(normalizeGameId));
}

function isHidden(cfg, gameId) {
  return getHiddenSet(cfg).has(normalizeGameId(gameId));
}

/** Connexion bot : envoie join_* selon le jeu. */
function spawnTestBots({ game, code, count, prefix, port, host }) {
  const g = normalizeGameId(game);
  const c = String(code || '').trim().toUpperCase().slice(0, 4);
  const n = Math.max(1, Math.min(12, Number(count) || 1));
  const pfx = String(prefix || 'Bot').trim().slice(0, 12) || 'Bot';
  const h = host || '127.0.0.1';
  const pr = Number(port) || 3001;

  const paths = {
    quiz: '/ws/quiz', draw: '/ws/draw', p4: '/ws/p4', morpion: '/ws/morpion',
    taboo: '/ws/taboo', emoji: '/ws/emoji', loup: '/ws/loup', uno: '/ws/uno',
    bomb: '/ws/bomb', sumo: '/ws/sumo', paint: '/ws/paint', naval: '/ws/naval',
    typer: '/ws/typer', anagramme: '/ws/anagramme', justeprix: '/ws/justeprix',
    timeline: '/ws/timeline', memo: '/ws/memo', imposteur: '/ws/imposteur', debat: '/ws/debat',
    skyline: '/ws/skyline',
  };
  const wsPath = paths[g];
  if (!wsPath) throw new Error('Jeu inconnu: ' + g);

  const joinTypes = {
    quiz: 'join_quiz', draw: 'join_draw', p4: 'join_p4', morpion: 'join_morpion',
    taboo: 'join_taboo', emoji: 'join_emoji', loup: 'join_loup', uno: 'join_uno',
    bomb: 'join_bomb', sumo: 'join_sumo', paint: 'join_paint', naval: 'join_naval',
    typer: 'join_typer', anagramme: 'join_anagramme', justeprix: 'join_justeprix',
    timeline: 'join_timeline', memo: 'join_memo', imposteur: 'join', debat: 'join_debat',
    skyline: 'join_skyline',
  };
  const joinType = joinTypes[g];
  if (!joinType) throw new Error('Pas de join pour: ' + g);

  let spawned = 0;
  const errors = [];

  for (let i = 0; i < n; i++) {
    const name = `${pfx}${i + 1}`;
    try {
      const ws = new WebSocket(`ws://${h}:${pr}${wsPath}`);
      ws.on('open', () => {
        const payload = g === 'imposteur'
          ? { type: 'join', name, code: c }
          : { type: joinType, name, code: c };
        try {
          ws.send(JSON.stringify(payload));
        } catch (e) {
          errors.push(String(e.message || e));
        }
        spawned++;
        setTimeout(() => {
          try { ws.close(); } catch {}
        }, 800);
      });
      ws.on('error', err => {
        errors.push(err.message || String(err));
      });
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }

  return { ok: true, game: g, code: c, requested: n, joinType, host: h, port: pr, errors: errors.slice(0, 5) };
}

module.exports = {
  CONFIG_PATH,
  loadAdminConfig,
  saveAdminConfig,
  getHiddenSet,
  isHidden,
  normalizeGameId,
  spawnTestBots,
};
