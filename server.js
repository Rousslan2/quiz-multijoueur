/**
 * FoodPlug — serveur statique + API commandes partagées.
 *
 * Persistance :
 *   - Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sont définis → Upstash Redis (survit aux redémarrages)
 *   - Sinon → fichier local data/orders.json (perdu au redémarrage sur Render free tier)
 */
const path  = require('path');
const fs    = require('fs');
const https = require('https');
const express = require('express');

const app = express();
const PORT        = Number(process.env.PORT) || 3000;
const NTFY_TOPIC  = process.env.NTFY_TOPIC  || '';
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_KEY   = 'fp_orders';

const publicDir  = path.join(__dirname, 'public');
const dataDir    = path.join(__dirname, 'data');
const ordersFile = path.join(dataDir, 'orders.json');

/* ---- file fallback init ---- */
if (!REDIS_URL) {
  if (!fs.existsSync(dataDir))    fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, '[]', 'utf8');
}

/* ---- persistence helpers ---- */
async function readOrders() {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const r = await fetch(REDIS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['GET', REDIS_KEY]),
      });
      const { result } = await r.json();
      return result ? JSON.parse(result) : [];
    } catch { return []; }
  }
  try { return JSON.parse(fs.readFileSync(ordersFile, 'utf8')); }
  catch { return []; }
}

async function writeOrders(arr) {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      await fetch(REDIS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', REDIS_KEY, JSON.stringify(arr)]),
      });
    } catch {}
    return;
  }
  fs.writeFileSync(ordersFile, JSON.stringify(arr), 'utf8');
}

/* ---- ntfy push notification ---- */
function sendNtfy(title, body) {
  if (!NTFY_TOPIC) return;
  const data = Buffer.from(body, 'utf8');
  const req = https.request(
    {
      hostname: 'ntfy.sh',
      path: '/' + NTFY_TOPIC,
      method: 'POST',
      headers: {
        'Title':          title,
        'Priority':       'high',
        'Tags':           'shopping,bell',
        'Content-Type':   'text/plain; charset=utf-8',
        'Content-Length': data.length,
      },
    },
    () => {}
  );
  req.on('error', () => {});
  req.write(data);
  req.end();
}

/* ---- middleware ---- */
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

/* ---- API orders ---- */
app.get('/api/orders', async (req, res) => {
  res.json(await readOrders());
});

app.post('/api/orders', async (req, res) => {
  const order = req.body;
  if (!order || !order.id) return res.status(400).json({ error: 'invalid order' });
  const arr = await readOrders();
  const exists = arr.findIndex(o => o.id === order.id);
  if (exists !== -1) {
    arr[exists] = order;
  } else {
    arr.unshift(order);
    const pts   = (order.items || []).map(i => `${i.pts} pts × ${i.qty}`).join(' · ');
    const who   = order.user || 'Anonyme';
    const total = typeof order.total === 'number' ? order.total.toFixed(2) + '€' : '';
    sendNtfy('Nouvelle commande FoodPlug', `${pts} — ${total} — ${who}`);
  }
  await writeOrders(arr);
  res.json({ ok: true });
});

app.patch('/api/orders/:id', async (req, res) => {
  const arr = await readOrders();
  const o = arr.find(o => o.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  Object.assign(o, req.body);
  await writeOrders(arr);
  res.json({ ok: true });
});

app.delete('/api/orders', async (req, res) => {
  await writeOrders([]);
  res.json({ ok: true });
});

/* ---- fichiers statiques ---- */
app.use(
  express.static(publicDir, {
    extensions: ['html'],
    etag: true,
    lastModified: true,
    maxAge: process.env.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 * 1000 : 0,
  })
);

app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => { if (err) next(err); });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('FoodPlug prêt → http://0.0.0.0:%s/', PORT);
  if (REDIS_URL)      console.log('Persistance → Upstash Redis (commandes sauvegardées)');
  else                console.log('Persistance → fichier local (perdu au redémarrage)');
  if (NTFY_TOPIC)     console.log('Notifications ntfy actives → ntfy.sh/%s', NTFY_TOPIC);
});
