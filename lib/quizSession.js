'use strict';
const crypto = require('crypto');

const sessions = new Map();
const TTL_MS = 45 * 60 * 1000;

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function issue({ code, name, slot }) {
  const c = String(code || '').trim().toUpperCase().slice(0, 4);
  const n = String(name || '').trim().slice(0, 20);
  const s = Number(slot);
  if (!c || !n || !Number.isInteger(s) || s < 0 || s > 3) return null;
  const token = randomToken();
  sessions.set(token, { code: c, name: n, slot: s, exp: Date.now() + TTL_MS });
  return token;
}

function consume(token) {
  if (!token || typeof token !== 'string') return null;
  const d = sessions.get(token);
  if (!d) return null;
  if (Date.now() > d.exp) {
    sessions.delete(token);
    return null;
  }
  sessions.delete(token);
  return d;
}

module.exports = { issue, consume };
