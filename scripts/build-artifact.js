// Bundles the web game (web/index.html + web/main.js + src/*.js) into ONE self-contained HTML page
// for publishing as a Claude Code Artifact. Only three.js comes from a CDN (jsDelivr, pinned).
//   node scripts/build-artifact.js  ->  out/artifact.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export /gm, '');

const three = JSON.parse(read('package.json')).dependencies.three;
const html = read('web/index.html');
const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const bodyMarkup = /<body>([\s\S]*?)<script type="module"/.exec(html)[1];

const code = [
  strip(read('src/tuning.js')),
  'const T = TUNING, W = WORLD;',
  strip(read('src/rng.js')),
  strip(read('src/sim.js')),
  strip(read('web/main.js')),
].join('\n');

const page = `<title>Đảo Đèn Lồng</title>
<meta name="description" content="Game 3D: Mây gom đom đóm, thắp lại năm Đèn Lồng Lớn và né Bóng Mực.">
<style>
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: #0b0716; color: #ffe9c4; font: 14px "Segoe UI", system-ui, sans-serif; }
${css.replace(/html, body \{[^}]*\}/, '')}
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${three}/build/three.module.js"}}</script>
${bodyMarkup}
<script type="module">
import * as THREE from 'three';
${code}
</script>
`;
mkdirSync(resolve(root, 'out'), { recursive: true });
writeFileSync(resolve(root, 'out/artifact.html'), page);
console.log(`out/artifact.html  ${(page.length / 1024).toFixed(1)} KB, three@${three}`);
