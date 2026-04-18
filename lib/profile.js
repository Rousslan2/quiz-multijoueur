'use strict';
const fs = require('fs');
const path = require('path');

const PROFILE_PATH = path.join(__dirname, '..', 'data', 'profiles.json');

function ensureDataDir() {
  const dir = path.dirname(PROFILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadProfilesStore() {
  try {
    ensureDataDir();
    if (!fs.existsSync(PROFILE_PATH)) return { profiles: {} };
    const raw = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
    if (!raw || typeof raw.profiles !== 'object' || raw.profiles === null) return { profiles: {} };
    return raw;
  } catch {
    return { profiles: {} };
  }
}

function saveProfilesStore(store) {
  ensureDataDir();
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

const MAX_HISTORY = 50;

function normalizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  return {
    game: String(e.game || '?'),
    gameName: String(e.gameName || e.game || '?'),
    date: Number(e.date) || 0,
    signature: String(e.signature || ''),
    players: Array.isArray(e.players) ? e.players : [],
    winner: e.winner == null ? null : String(e.winner),
    myName: String(e.myName || ''),
    myScore: Number(e.myScore) || 0,
    isWinner: !!e.isWinner,
    scores: e.scores && typeof e.scores === 'object' ? e.scores : {},
  };
}

function mergeHistories(a, b) {
  const map = new Map();
  [...(a || []), ...(b || [])].forEach(raw => {
    const e = normalizeEntry(raw);
    if (!e || !e.signature) return;
    const prev = map.get(e.signature);
    if (!prev || (e.date || 0) > (prev.date || 0)) map.set(e.signature, e);
  });
  const out = [...map.values()].sort((x, y) => (y.date || 0) - (x.date || 0));
  if (out.length > MAX_HISTORY) out.length = MAX_HISTORY;
  return out;
}

function computeStatsFromHistory(history) {
  const h = Array.isArray(history) ? history : [];
  let wins = 0;
  let losses = 0;
  const byGame = {};
  h.forEach(g => {
    if (g.isWinner) wins++;
    else losses++;
    const id = g.game || '?';
    if (!byGame[id]) {
      byGame[id] = {
        wins: 0,
        losses: 0,
        played: 0,
        name: g.gameName || g.game || id,
      };
    }
    byGame[id].played++;
    if (g.isWinner) byGame[id].wins++;
    else byGame[id].losses++;
  });
  const games = h.length;
  const xp = h.reduce((acc, g) => acc + (g.isWinner ? 3 : 1), 0);
  return { wins, losses, games, byGame, xp };
}

function sanitizeDeviceId(id) {
  const s = String(id || '').trim();
  if (!s || s.length > 80) return '';
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return '';
  return s;
}

function sanitizeDisplayName(name) {
  const s = String(name || '').trim().slice(0, 20);
  return s || 'Joueur';
}

function getProfile(deviceId) {
  const id = sanitizeDeviceId(deviceId);
  if (!id) return null;
  const store = loadProfilesStore();
  const p = store.profiles[id];
  if (!p) return null;
  const history = Array.isArray(p.history) ? p.history.map(normalizeEntry).filter(Boolean) : [];
  const stats = computeStatsFromHistory(history);
  return {
    deviceId: id,
    displayName: sanitizeDisplayName(p.displayName),
    history,
    stats,
    updatedAt: Number(p.updatedAt) || 0,
  };
}

function syncProfile({ deviceId, displayName, history: clientHistory }) {
  const id = sanitizeDeviceId(deviceId);
  if (!id) throw new Error('deviceId invalide');
  const store = loadProfilesStore();
  const prev = store.profiles[id] || {};
  const prevHistory = Array.isArray(prev.history) ? prev.history : [];
  const merged = mergeHistories(prevHistory, clientHistory);
  const stats = computeStatsFromHistory(merged);
  const now = Date.now();
  store.profiles[id] = {
    displayName: displayName != null ? sanitizeDisplayName(displayName) : sanitizeDisplayName(prev.displayName),
    history: merged,
    updatedAt: now,
    gamesPlayed: stats.games,
    wins: stats.wins,
    xp: stats.xp,
  };
  saveProfilesStore(store);
  return {
    deviceId: id,
    displayName: store.profiles[id].displayName,
    history: merged,
    stats,
    updatedAt: now,
  };
}

function countProfiles() {
  const store = loadProfilesStore();
  return Object.keys(store.profiles || {}).length;
}

function listProfilesSummary(limit = 30) {
  const store = loadProfilesStore();
  const rows = Object.entries(store.profiles).map(([id, p]) => {
    const h = Array.isArray(p.history) ? p.history : [];
    const st = computeStatsFromHistory(h);
    return {
      deviceId: id,
      displayName: sanitizeDisplayName(p.displayName),
      games: st.games,
      wins: st.wins,
      xp: st.xp,
      updatedAt: Number(p.updatedAt) || 0,
    };
  });
  rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return rows.slice(0, Math.max(1, Math.min(200, limit)));
}

module.exports = {
  loadProfilesStore,
  saveProfilesStore,
  getProfile,
  syncProfile,
  mergeHistories,
  computeStatsFromHistory,
  listProfilesSummary,
  countProfiles,
  PROFILE_PATH,
};
