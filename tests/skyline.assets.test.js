/**
 * Vérifie que les assets Skyline (CSS + HTML) restent cohérents après refonte design.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'public', 'skyline.html');
const cssPath = path.join(root, 'public', 'skyline.css');

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

console.log('Skyline — assets (HTML + CSS)\n');

test('skyline.html référence skyline.css', () => {
  const html = read(htmlPath);
  assert.ok(/href="skyline\.css"/.test(html), 'link skyline.css manquant');
});

test('skyline.html contient les hooks UI (scoreboard, podium)', () => {
  const html = read(htmlPath);
  assert.ok(html.includes('id="sky-scoreboard"'), 'sky-scoreboard');
  assert.ok(html.includes('class="sky-podium"'), 'sky-podium');
  assert.ok(html.includes('class="skyline-page"'), 'body skyline-page');
});

test('skyline.css définit le design system (.sky-card, .sky-scoreboard)', () => {
  const css = read(cssPath);
  assert.ok(css.includes('.sky-card'), '.sky-card');
  assert.ok(css.includes('.sky-scoreboard'), '.sky-scoreboard');
  assert.ok(css.includes('.sky-podium'), '.sky-podium');
  assert.ok(css.includes('--sky-primary'), 'variables --sky-*');
});

console.log('\n  ' + passed + ' passed, 0 failed\n');
