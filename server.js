/**
 * FoodPlug — auth, wallet, comptes premium, chat communautaire, admin.
 *
 * Persistance :
 *   - Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Upstash Redis
 *   - Sinon → fichiers locaux data/*.json
 */
const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const crypto = require('crypto');
const express = require('express');

const app = express();
const PORT        = Number(process.env.PORT) || 3000;
const NTFY_TOPIC  = process.env.NTFY_TOPIC  || '';
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'foodplug';
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';

const publicDir = path.join(__dirname, 'public');
const dataDir   = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

/* ================================================================
   PERSISTENCE (Redis Upstash si configuré, sinon fichiers locaux)
   ================================================================ */
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);
let redisHealthy = false;       // passe à true au 1er appel réussi
let redisLastError = '';

async function redisCmd(...args) {
  if (!USE_REDIS) return { ok: false };
  try {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const j = await r.json();
    if (j.error) { redisLastError = j.error; redisHealthy = false; return { ok: false, error: j.error }; }
    redisHealthy = true; redisLastError = '';
    return { ok: true, result: j.result };
  } catch (e) {
    redisLastError = String(e && e.message || e); redisHealthy = false;
    return { ok: false, error: redisLastError };
  }
}

async function dbRead(name, def) {
  if (USE_REDIS) {
    const r = await redisCmd('GET', 'fp_' + name);
    if (r.ok && r.result) { try { return JSON.parse(r.result); } catch {} }
    if (r.ok) return def; // clé absente → valeur par défaut (ne pas lire le fichier éphémère)
  }
  const f = path.join(dataDir, name + '.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch { return def; }
}

async function dbWrite(name, data) {
  if (USE_REDIS) {
    const r = await redisCmd('SET', 'fp_' + name, JSON.stringify(data));
    if (r.ok) return;
    console.error('[DB] Échec écriture Redis (%s) : %s', name, r.error || 'inconnu');
    // on tente quand même le fichier local pour ne rien perdre dans la session
  }
  try { fs.writeFileSync(path.join(dataDir, name + '.json'), JSON.stringify(data), 'utf8'); }
  catch (e) { console.error('[DB] Échec écriture fichier (%s) : %s', name, e.message); }
}

/* ================================================================
   SESSIONS (persistées — survivent aux redémarrages)
   Redis : une clé par token avec TTL. Sinon : fichier sessions.json.
   La Map sert de cache en mémoire (rapide), reconstruit au besoin.
   ================================================================ */
const sessions = new Map(); // cache : token → {userId, exp}
const SESSION_TTL = 30 * 86400; // secondes (30 jours)

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    if (k && k.trim()) out[k.trim()] = decodeURIComponent(v.join('=').trim());
  });
  return out;
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = Date.now() + SESSION_TTL * 1000;
  sessions.set(token, { userId, exp });
  if (USE_REDIS) {
    await redisCmd('SET', 'fp_session_' + token, userId, 'EX', String(SESSION_TTL));
  } else {
    const all = await dbRead('sessions', {});
    all[token] = { userId, exp };
    await dbWrite('sessions', all);
  }
  return token;
}

async function destroySession(token) {
  sessions.delete(token);
  if (USE_REDIS) { await redisCmd('DEL', 'fp_session_' + token); }
  else { const all = await dbRead('sessions', {}); delete all[token]; await dbWrite('sessions', all); }
}

async function sessionUserId(req) {
  const t = parseCookies(req).fp_sess;
  if (!t) return null;
  // cache en mémoire
  const cached = sessions.get(t);
  if (cached) {
    if (cached.exp < Date.now()) { await destroySession(t); return null; }
    return cached.userId;
  }
  // cache vide (ex. après redémarrage) → relire depuis le store persistant
  if (USE_REDIS) {
    const r = await redisCmd('GET', 'fp_session_' + t);
    if (r.ok && r.result) { sessions.set(t, { userId: r.result, exp: Date.now() + SESSION_TTL * 1000 }); return r.result; }
    return null;
  }
  const all = await dbRead('sessions', {});
  const s = all[t];
  if (s && s.exp > Date.now()) { sessions.set(t, s); return s.userId; }
  if (s) await destroySession(t);
  return null;
}

/* ================================================================
   PASSWORD
   ================================================================ */
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.pbkdf2Sync(pw, salt, 10000, 32, 'sha256').toString('hex');
}
function checkPw(pw, stored) {
  try { const [s] = stored.split(':'); return hashPw(pw, s) === stored; } catch { return false; }
}

/* ================================================================
   AUTH MIDDLEWARE
   ================================================================ */
async function requireAuth(req, res, next) {
  const uid = await sessionUserId(req);
  if (!uid) return res.status(401).json({ error: 'Non connecté' });
  const users = await dbRead('users', []);
  req.user = users.find(u => u.id === uid);
  if (!req.user) return res.status(401).json({ error: 'Compte introuvable' });
  next();
}

/* ================================================================
   STRIPE (API directe, sans dépendance npm)
   ================================================================ */
function stripeForm(obj, prefix, out) {
  out = out || [];
  for (const k in obj) {
    const key = prefix ? `${prefix}[${k}]` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object') stripeForm(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  }
  return out;
}

async function stripeApi(path, method = 'POST', params = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  };
  if (params) opts.body = stripeForm(params).join('&');
  const r = await fetch('https://api.stripe.com/v1' + path, opts);
  return r.json();
}

/* ================================================================
   FAKE ACCOUNT POOL (données de test — à remplacer par de vrais comptes)
   ================================================================ */
const FAKE_ACCOUNTS = {
  kfc: [
    { code: 'D8F5EB', name: 'Jacky',   phone: '0601231351' },
    { code: 'A3C7F2', name: 'Lucas',   phone: '0759874523' },
    { code: 'E1B9D4', name: 'Sophie',  phone: '0634568712' },
    { code: 'F5A2C8', name: 'Nathan',  phone: '0712345678' },
    { code: 'B7E3A1', name: 'Emma',    phone: '0698765432' },
    { code: 'C9D1E7', name: 'Mathis',  phone: '0623456789' },
    { code: 'H2F8G3', name: 'Julie',   phone: '0745678901' },
  ],
  mcdo: [
    { qr: 'MCDO-PREMIUM-2025-XK9F3M' },
    { qr: 'MCDO-ACCOUNT-7Y4P2N-2025' },
    { qr: 'MCDO-VIP-QX8L5R-ACTIVE'  },
    { qr: 'MCDO-GOLD-2M6K9T-2025'   },
    { qr: 'MCDO-PLUS-4H7W2E-VALID'  },
  ],
  otacos: [
    { qr: 'OTC-PREMIUM-2025-JK3N8P' },
    { qr: 'OTC-ACCOUNT-5T9R2M-2025' },
    { qr: 'OTC-VIP-BW4X7Y-ACTIVE'   },
    { qr: 'OTC-GOLD-6C2L8Q-2025'    },
    { qr: 'OTC-PLUS-3V9F5H-VALID'   },
  ],
};

/* ================================================================
   NTFY
   ================================================================ */
function sendNtfy(title, body) {
  if (!NTFY_TOPIC) return;
  const data = Buffer.from(body, 'utf8');
  const req = https.request({ hostname: 'ntfy.sh', path: '/' + NTFY_TOPIC, method: 'POST',
    headers: { Title: title, Priority: 'high', Tags: 'shopping,bell', 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': data.length } }, () => {});
  req.on('error', () => {}); req.write(data); req.end();
}

/* ================================================================
   MIDDLEWARE
   ================================================================ */
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

/* ================================================================
   AUTH ENDPOINTS
   ================================================================ */
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 car. min)' });
  const users = await dbRead('users', []);
  if (users.find(u => u.email === email.toLowerCase())) return res.status(409).json({ error: 'Email déjà utilisé' });
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const initials = name.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('').slice(0, 2) || 'FP';
  const user = { id, email: email.toLowerCase(), password: hashPw(password), name: name.trim(), initials, tier: 'STANDARD', points: 0, createdAt: new Date().toISOString() };
  users.push(user);
  await dbWrite('users', users);
  const wallets = await dbRead('wallets', {});
  wallets[id] = { balance: 0, cashback: 0, recharges: 0, saved: 0, transactions: [] };
  await dbWrite('wallets', wallets);
  const token = await createSession(id);
  res.cookie('fp_sess', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400 * 1000, path: '/' });
  res.json({ ok: true, user: pub(user, wallets[id]) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Champs manquants' });
  const users = await dbRead('users', []);
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user || !checkPw(password, user.password)) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const wallets = await dbRead('wallets', {});
  if (!wallets[user.id]) { wallets[user.id] = { balance: 0, cashback: 0, recharges: 0, saved: 0, transactions: [] }; await dbWrite('wallets', wallets); }
  const token = await createSession(user.id);
  res.cookie('fp_sess', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400 * 1000, path: '/' });
  res.json({ ok: true, user: pub(user, wallets[user.id]) });
});

app.post('/api/auth/logout', async (req, res) => {
  const t = parseCookies(req).fp_sess; if (t) await destroySession(t);
  res.clearCookie('fp_sess', { path: '/' });
  res.json({ ok: true });
});

function pub(user, w = {}) {
  return { id: user.id, email: user.email, name: user.name, initials: user.initials, tier: user.tier, points: user.points,
           balance: w.balance || 0, cashback: w.cashback || 0, recharges: w.recharges || 0, saved: w.saved || 0 };
}

/* ================================================================
   USER PROFILE
   ================================================================ */
app.get('/api/me', requireAuth, async (req, res) => {
  const wallets = await dbRead('wallets', {});
  res.json(pub(req.user, wallets[req.user.id] || {}));
});

app.patch('/api/me', requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
  const users = await dbRead('users', []);
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
  users[idx].name = name.trim();
  users[idx].initials = name.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('').slice(0, 2) || 'FP';
  await dbWrite('users', users);
  res.json({ ok: true, name: users[idx].name, initials: users[idx].initials });
});

/* ================================================================
   WALLET
   ================================================================ */
app.get('/api/me/wallet', requireAuth, async (req, res) => {
  const wallets = await dbRead('wallets', {});
  res.json(wallets[req.user.id] || { balance: 0, cashback: 0, recharges: 0, saved: 0, transactions: [] });
});

/* Crée une session de paiement Stripe Checkout. Le solde n'est PAS crédité ici :
   il le sera uniquement après confirmation du paiement (voir /confirm). */
app.post('/api/me/wallet/checkout', requireAuth, async (req, res) => {
  if (!STRIPE_SECRET) return res.status(503).json({ error: 'Paiement indisponible : Stripe non configuré sur le serveur.' });
  const { amount, bonus = 0 } = req.body || {};
  const amt = Math.round(Number(amount) * 100) / 100;
  const bon = Math.round(Number(bonus) * 100) / 100;
  if (!amt || amt <= 0 || amt > 10000) return res.status(400).json({ error: 'Montant invalide' });
  const credit = Math.round((amt + bon) * 100) / 100;
  const origin = req.headers.origin || (req.protocol + '://' + req.get('host'));
  const session = await stripeApi('/checkout/sessions', 'POST', {
    mode: 'payment',
    success_url: origin + '/wallet?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/wallet?canceled=1',
    line_items: { 0: {
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(amt * 100),
        product_data: { name: 'Recharge wallet FoodPlug' + (bon > 0 ? ` (+${bon} € bonus)` : '') },
      },
    } },
    metadata: { userId: req.user.id, credit: String(credit), base: String(amt), bonus: String(bon) },
  });
  if (!session || !session.url) return res.status(502).json({ error: (session && session.error && session.error.message) || 'Erreur Stripe' });
  res.json({ ok: true, url: session.url });
});

/* Vérifie le paiement auprès de Stripe et crédite le wallet (idempotent). */
app.post('/api/me/wallet/confirm', requireAuth, async (req, res) => {
  if (!STRIPE_SECRET) return res.status(503).json({ error: 'Stripe non configuré' });
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'Session manquante' });
  const session = await stripeApi('/checkout/sessions/' + encodeURIComponent(session_id), 'GET');
  if (!session || session.payment_status !== 'paid') return res.status(402).json({ error: 'Paiement non confirmé' });
  if (!session.metadata || session.metadata.userId !== req.user.id) return res.status(403).json({ error: 'Session invalide' });

  const processed = await dbRead('stripe_sessions', {});
  const wallets   = await dbRead('wallets', {});
  let w = wallets[req.user.id] || { balance: 0, cashback: 0, recharges: 0, saved: 0, transactions: [] };

  if (processed[session_id]) { wallets[req.user.id] = w; return res.json({ ok: true, wallet: w, already: true }); }

  const credit = Math.round((Number(session.metadata.credit) || 0) * 100) / 100;
  w.balance   = Math.round((w.balance  + credit)        * 100) / 100;
  w.cashback  = Math.round((w.cashback + credit * 0.08) * 100) / 100;
  w.recharges = (w.recharges || 0) + 1;
  w.transactions = [{ date: new Date().toISOString(), note: 'Recharge wallet · Carte', amount: credit, balance: w.balance }, ...(w.transactions || [])].slice(0, 80);
  wallets[req.user.id] = w;
  await dbWrite('wallets', wallets);

  processed[session_id] = { userId: req.user.id, credit, date: new Date().toISOString() };
  await dbWrite('stripe_sessions', processed);
  res.json({ ok: true, wallet: w });
});

app.post('/api/me/wallet/deduct', requireAuth, async (req, res) => {
  const { amount, note } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Montant invalide' });
  const wallets = await dbRead('wallets', {});
  const w = wallets[req.user.id] || { balance: 0, cashback: 0, recharges: 0, saved: 0, transactions: [] };
  if (w.balance < amt) return res.status(400).json({ error: 'Solde insuffisant' });
  w.balance = Math.round((w.balance - amt) * 100) / 100;
  w.saved   = Math.round(((w.saved || 0) + amt) * 100) / 100;
  w.transactions = [{ date: new Date().toISOString(), note: note || 'Achat', amount: -amt, balance: w.balance }, ...(w.transactions || [])].slice(0, 80);
  wallets[req.user.id] = w;
  await dbWrite('wallets', wallets);
  res.json({ ok: true, wallet: w });
});

/* ================================================================
   USER ACCOUNTS (purchased)
   ================================================================ */
app.get('/api/me/accounts', requireAuth, async (req, res) => {
  const all = await dbRead('user_accounts', []);
  res.json(all.filter(a => a.userId === req.user.id));
});

app.post('/api/me/accounts', requireAuth, async (req, res) => {
  const { brand, pts, name: aname } = req.body || {};
  if (!brand || !pts) return res.status(400).json({ error: 'Données manquantes' });
  const pool = FAKE_ACCOUNTS[brand] || FAKE_ACCOUNTS.kfc;
  const delivery = pool[Math.floor(Math.random() * pool.length)];
  const all = await dbRead('user_accounts', []);
  all.unshift({ userId: req.user.id, brand, pts, name: aname || brand, date: new Date().toISOString(), delivery });
  await dbWrite('user_accounts', all);
  res.json({ ok: true, delivery });
});

/* ================================================================
   COMMUNITY MESSAGES
   ================================================================ */
const CHANNELS = ['les-bons-plans', 'drops', 'entraide', 'kfc', 'mcdo', 'otacos'];

/* État de verrouillage des salons (verrouillé par un admin) */
app.get('/api/chat/status', requireAuth, async (req, res) => {
  res.json(await dbRead('chat_locks', {}));
});

app.get('/api/messages/:channel', requireAuth, async (req, res) => {
  const ch = req.params.channel;
  if (!CHANNELS.includes(ch)) return res.status(400).json({ error: 'Canal invalide' });
  const all = await dbRead('messages', {});
  res.json((all[ch] || []).slice(0, 100));
});

app.post('/api/messages/:channel', requireAuth, async (req, res) => {
  const ch = req.params.channel;
  if (!CHANNELS.includes(ch)) return res.status(400).json({ error: 'Canal invalide' });
  const locks = await dbRead('chat_locks', {});
  if (locks[ch]) return res.status(423).json({ error: 'Salon verrouillé par un administrateur' });
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message vide' });
  const all = await dbRead('messages', {});
  if (!all[ch]) all[ch] = [];
  const msg = { id: crypto.randomBytes(8).toString('hex'), userId: req.user.id, name: req.user.name, initials: (req.user.initials || 'FP').slice(0, 2), text: text.trim().slice(0, 500), date: new Date().toISOString() };
  all[ch] = [msg, ...all[ch]].slice(0, 200);
  await dbWrite('messages', all);
  res.json({ ok: true, msg });
});

/* ================================================================
   ADMIN (read-only, token-based for admin panel)
   ================================================================ */
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-token'] === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Non autorisé' });
}

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  res.json(await dbRead('orders', []));
});

/* État de la base de données (persistance) */
app.get('/api/admin/health', requireAdmin, async (req, res) => {
  let mode = 'fichiers locaux (éphémère ⚠️)';
  if (USE_REDIS) {
    await redisCmd('PING'); // rafraîchit l'état
    mode = redisHealthy ? 'Redis Upstash (persistant ✅)' : 'Redis configuré mais INJOIGNABLE ⚠️';
  }
  const users = await dbRead('users', []);
  const accts = await dbRead('user_accounts', []);
  res.json({
    persistence: USE_REDIS ? (redisHealthy ? 'redis' : 'redis-error') : 'file',
    label: mode,
    redisError: redisLastError || null,
    users: users.length,
    accounts: accts.length,
  });
});

/* Liste tous les utilisateurs avec leur solde + comptes achetés */
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users   = await dbRead('users', []);
  const wallets = await dbRead('wallets', {});
  const accts   = await dbRead('user_accounts', []);
  res.json(users.map(u => ({
    id: u.id, name: u.name, email: u.email, initials: u.initials,
    tier: u.tier, createdAt: u.createdAt,
    balance: (wallets[u.id] || {}).balance || 0,
    recharges: (wallets[u.id] || {}).recharges || 0,
    accounts: accts.filter(a => a.userId === u.id).map(a => ({ brand: a.brand, pts: a.pts, name: a.name, date: a.date })),
  })));
});

/* Crédite ou débite manuellement le wallet d'un utilisateur */
app.post('/api/admin/users/:id/credit', requireAdmin, async (req, res) => {
  const { amount, note } = req.body || {};
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!amt || amt === 0) return res.status(400).json({ error: 'Montant invalide' });
  const wallets = await dbRead('wallets', {});
  const w = wallets[req.params.id] || { balance: 0, cashback: 0, recharges: 0, saved: 0, transactions: [] };
  w.balance = Math.round((w.balance + amt) * 100) / 100;
  if (w.balance < 0) return res.status(400).json({ error: 'Solde insuffisant pour ce débit' });
  w.transactions = [{ date: new Date().toISOString(), note: note || (amt > 0 ? 'Crédit admin' : 'Débit admin'), amount: amt, balance: w.balance }, ...(w.transactions || [])].slice(0, 80);
  wallets[req.params.id] = w;
  await dbWrite('wallets', wallets);
  res.json({ ok: true, balance: w.balance });
});

/* Gestion du verrouillage des salons de la communauté */
app.get('/api/admin/chat/locks', requireAdmin, async (req, res) => {
  res.json(await dbRead('chat_locks', {}));
});

app.post('/api/admin/chat/lock', requireAdmin, async (req, res) => {
  const { channel, locked } = req.body || {};
  if (!CHANNELS.includes(channel)) return res.status(400).json({ error: 'Canal invalide' });
  const locks = await dbRead('chat_locks', {});
  locks[channel] = !!locked;
  await dbWrite('chat_locks', locks);
  res.json({ ok: true, locks });
});

/* ================================================================
   ORDERS (admin + purchases)
   ================================================================ */
app.get('/api/orders', requireAuth, async (req, res) => {
  res.json(await dbRead('orders', []));
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const order = req.body;
  if (!order || !order.id) return res.status(400).json({ error: 'Commande invalide' });
  const arr = await dbRead('orders', []);
  const idx = arr.findIndex(o => o.id === order.id);
  if (idx !== -1) { arr[idx] = order; }
  else {
    arr.unshift(order);
    const pts   = (order.items || []).map(i => `${i.pts} pts × ${i.qty}`).join(' · ');
    const total = typeof order.total === 'number' ? order.total.toFixed(2) + '€' : '';
    sendNtfy('Nouvelle commande FoodPlug', `${pts} — ${total} — ${req.user.name}`);
  }
  await dbWrite('orders', arr);
  res.json({ ok: true });
});

app.patch('/api/orders/:id', requireAuth, async (req, res) => {
  const arr = await dbRead('orders', []);
  const o = arr.find(o => o.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Introuvable' });
  Object.assign(o, req.body);
  await dbWrite('orders', arr);
  res.json({ ok: true });
});

app.delete('/api/orders', requireAuth, async (req, res) => {
  await dbWrite('orders', []);
  res.json({ ok: true });
});

/* ================================================================
   STATIC FILES
   ================================================================ */
app.use(express.static(publicDir, {
  extensions: ['html'], etag: true, lastModified: true, maxAge: 0,
  setHeaders(res, filePath) {
    // HTML, JS et CSS : toujours revalider pour que les mises à jour s'appliquent
    // immédiatement (sinon le navigateur sert une vieille version en cache).
    if (/\.(html|js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      // images, polices… : cache court
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));

app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), err => { if (err) next(err); });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('FoodPlug prêt → http://0.0.0.0:%s/', PORT);
  if (REDIS_URL) console.log('Persistance → Upstash Redis');
  else           console.log('Persistance → fichier local');
  if (NTFY_TOPIC) console.log('Notifications ntfy → ntfy.sh/%s', NTFY_TOPIC);
});
