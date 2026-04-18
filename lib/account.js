'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT_PATH = path.join(__dirname, '..', 'data', 'accounts.json');

function ensureDataDir() {
  const dir = path.dirname(ACCOUNT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadStore() {
  try {
    ensureDataDir();
    if (!fs.existsSync(ACCOUNT_PATH)) return { accounts: {}, nextId: 1 };
    const raw = JSON.parse(fs.readFileSync(ACCOUNT_PATH, 'utf8'));
    if (!raw || typeof raw.accounts !== 'object') return { accounts: {}, nextId: 1 };
    if (typeof raw.nextId !== 'number') raw.nextId = Object.keys(raw.accounts).length + 1;
    return raw;
  } catch {
    return { accounts: {}, nextId: 1 };
  }
}

function saveStore(store) {
  ensureDataDir();
  fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeEmail(e) {
  return String(e || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  const hash = crypto.scryptSync(String(password), salt, 64);
  return hash.toString('hex');
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function newAccountId(store) {
  const n = store.nextId++;
  return 'a' + n.toString(36) + crypto.randomBytes(4).toString('hex');
}

const sessions = new Map();
const SESSION_MS = 100 * 24 * 60 * 60 * 1000;

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(accountId) {
  const token = randomToken();
  sessions.set(token, { accountId, exp: Date.now() + SESSION_MS });
  return token;
}

function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function registerAccount({ email, password, displayName }) {
  const em = normalizeEmail(email);
  if (!em || !em.includes('@')) throw new Error('Email invalide');
  if (String(password || '').length < 6) throw new Error('Mot de passe : 6 caractères minimum');
  const store = loadStore();
  for (const acc of Object.values(store.accounts)) {
    if (acc.email === em) throw new Error('Cet email est déjà utilisé');
  }
  const id = newAccountId(store);
  const salt = makeSalt();
  const acc = {
    id,
    email: em,
    salt,
    passwordHash: hashPassword(password, salt),
    displayName: String(displayName || '').trim().slice(0, 20) || em.split('@')[0],
    deviceIds: [],
    createdAt: Date.now(),
  };
  store.accounts[id] = acc;
  saveStore(store);
  const token = createSession(id);
  return { accountId: id, token, email: em, displayName: acc.displayName };
}

function loginAccount({ email, password }) {
  const em = normalizeEmail(email);
  const store = loadStore();
  let acc = null;
  for (const a of Object.values(store.accounts)) {
    if (a.email === em) {
      acc = a;
      break;
    }
  }
  if (!acc) throw new Error('Email ou mot de passe incorrect');
  const h = hashPassword(password, acc.salt);
  if (h !== acc.passwordHash) throw new Error('Email ou mot de passe incorrect');
  return {
    accountId: acc.id,
    token: createSession(acc.id),
    email: acc.email,
    displayName: acc.displayName,
  };
}

function getAccountById(id) {
  const store = loadStore();
  return store.accounts[id] || null;
}

function linkDeviceToAccount(accountId, deviceId) {
  const store = loadStore();
  const acc = store.accounts[accountId];
  if (!acc) throw new Error('Compte introuvable');
  const d = String(deviceId || '').trim();
  if (!d) throw new Error('deviceId requis');
  if (!acc.deviceIds.includes(d)) acc.deviceIds.push(d);
  saveStore(store);
  return acc.deviceIds;
}

function listAccountsSummary() {
  const store = loadStore();
  return Object.values(store.accounts).map(a => ({
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    devices: (a.deviceIds || []).length,
    createdAt: a.createdAt || 0,
  }));
}

function countAccounts() {
  return Object.keys(loadStore().accounts || {}).length;
}

module.exports = {
  ACCOUNT_PATH,
  loadStore,
  saveStore,
  registerAccount,
  loginAccount,
  getSession,
  createSession,
  getAccountById,
  linkDeviceToAccount,
  listAccountsSummary,
  countAccounts,
  normalizeEmail,
};
