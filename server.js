/**
 * MiamShop — serveur statique minimal pour Render / Railway / Node local.
 */
const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');

app.use(
  express.static(publicDir, {
    extensions: ['html'],
    etag: true,
    lastModified: true,
    maxAge:
      process.env.NODE_ENV === 'production'
        ? 7 * 24 * 60 * 60 * 1000
        : 0,
  })
);

/** Anciens liens du projet jeu → accueil boutique */
const legacyPaths = ['/MiamShop.html', '/MiamShop'];
legacyPaths.forEach((p) => {
  app.get(p, (_, res) => res.redirect(301, '/'));
});

/** SPA légère : routes sans extension servent index.html */
app.get('*', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('MiamShop prêt → http://0.0.0.0:%s/', PORT);
});
