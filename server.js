/**
 * MiamShop — serveur statique + API commandes partagées.
 */
const path = require('path');
const fs   = require('fs');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir  = path.join(__dirname, 'public');
const dataDir    = path.join(__dirname, 'data');
const ordersFile = path.join(dataDir, 'orders.json');

/* ---- persistence helpers ---- */
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, '[]', 'utf8');

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ordersFile, 'utf8')); }
  catch { return []; }
}
function writeOrders(arr) {
  fs.writeFileSync(ordersFile, JSON.stringify(arr), 'utf8');
}

/* ---- middleware ---- */
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' })); // 4 MB pour les photos base64

/* ---- API orders ---- */
app.get('/api/orders', (req, res) => {
  res.json(readOrders());
});

app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order || !order.id) return res.status(400).json({ error: 'invalid order' });
  const arr = readOrders();
  const exists = arr.findIndex(o => o.id === order.id);
  if (exists !== -1) arr[exists] = order; // idempotent
  else arr.unshift(order);
  writeOrders(arr);
  res.json({ ok: true });
});

app.patch('/api/orders/:id', (req, res) => {
  const arr = readOrders();
  const o = arr.find(o => o.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  Object.assign(o, req.body);
  writeOrders(arr);
  res.json({ ok: true });
});

app.delete('/api/orders', (req, res) => {
  writeOrders([]);
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

const legacyPaths = ['/MiamShop.html', '/MiamShop'];
legacyPaths.forEach((p) => app.get(p, (_, res) => res.redirect(301, '/')));

app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => { if (err) next(err); });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('MiamShop prêt → http://0.0.0.0:%s/', PORT);
});
