/**
 * Cohérence loader / welcome ZapPlay (shared.js + zp-loader.css).
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const sharedPath = path.join(root, 'public', 'shared.js');
const cssPath = path.join(root, 'public', 'zp-loader.css');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    console.error('  \u2717 ' + name);
    throw e;
  }
}

console.log('ZapPlay — zp-loader assets\n');

test('zp-loader.css existe et cible #zp-loader et #zp-welcome', () => {
  const css = read(cssPath);
  assert.ok(css.includes('#zp-loader'), '#zp-loader');
  assert.ok(css.includes('#zp-welcome'), '#zp-welcome');
  assert.ok(css.includes('--zp-loader-z'), 'variable z-index');
});

test('pages jeu incluent zp-loader.css dans le head (après theme.css)', () => {
  const quiz = read(path.join(root, 'public', 'quiz.html'));
  assert.ok(/href="\/zp-loader\.css"/.test(quiz), 'quiz.html link zp-loader.css');
  assert.ok(quiz.indexOf('theme.css') < quiz.indexOf('zp-loader.css'), 'ordre theme puis zp-loader');
});

test('pages jeu incluent zp-page-loader.js avant </body>', () => {
  const quiz = read(path.join(root, 'public', 'quiz.html'));
  assert.ok(quiz.includes('zp-page-loader.js'), 'quiz.html inclut zp-page-loader.js');
  assert.ok(quiz.indexOf('zp-page-loader.js') < quiz.lastIndexOf('</body>'), 'script avant </body>');
});

test('shared.js charge zp-loader.css et ne réinjecte plus le gros bloc CSS inline loader', () => {
  const js = read(sharedPath);
  assert.ok(js.includes('zp-loader.css'), 'href zp-loader.css');
  assert.ok(js.includes('ensureZPLoaderStylesheet'), 'ensureZPLoaderStylesheet');
  assert.ok(!js.includes("css.textContent=[\n    /* ── overlay ── */"), 'ancien bloc CSS inline loader retiré');
});

test('showWelcomeScreen utilise les classes zpw-* (CSS externe)', () => {
  const js = read(sharedPath);
  assert.ok(js.includes('zpw-content'), 'zpw-content');
  assert.ok(js.includes('zpw-card-wrap'), 'zpw-card-wrap');
  assert.ok(js.includes('zpw-shake'), 'shake class');
});

console.log('\n  ' + passed + ' passed, 0 failed\n');
