// Bundles the web game (web/index.html + web/*.js + src/*.js) into ONE self-contained HTML page
// for publishing as a Claude Code Artifact. Only three.js comes from a CDN (jsDelivr, pinned).
//   node scripts/build-artifact.js  ->  out/artifact.html
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export /gm, '');

const three = JSON.parse(read('package.json')).dependencies.three;
// --release: a self-contained static folder (three.js copied next to the page, no CDN) for the GitHub Release.
const release = process.argv.includes('--release');
const html = read('web/index.html');
const css = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
const bodyMarkup = /<body>([\s\S]*?)<script type="module"/.exec(html)[1];

const code = [
  strip(read('src/tuning.js')),
  'const T = TUNING, R = RULES;',
  ...['src/rng.js', 'src/maps.js', 'src/sim.js', 'src/leaderboard.js', 'src/keybinds.js', 'web/audio.js', 'web/world.js', 'web/main.js'].map((f) => strip(read(f))),
].join('\n');

const page = `<title>Đảo Đèn Lồng</title>
<link rel="icon" href="data:,">
<meta name="description" content="Game 3D: Mây thắp và giữ sáng các Đèn Lồng Lớn tới bình minh, né Bóng Mực.">
<style>
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: #0e1430; color: #f5f1e6; font: 14px "Segoe UI", system-ui, sans-serif; }
${css.replace(/html, body \{[^}]*\}/, '')}
</style>
<script type="importmap">{"imports":{"three":"${release ? './vendor/three.module.js' : `https://cdn.jsdelivr.net/npm/three@${three}/build/three.module.js`}"}}</script>
${bodyMarkup}
<script type="module">
import * as THREE from 'three';
${code}
</script>
`;
if (release) {
  const dir = resolve(root, 'release/dao-den-long-web');
  mkdirSync(resolve(dir, 'vendor'), { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${page}`);
  copyFileSync(resolve(root, 'node_modules/three/build/three.module.js'), resolve(dir, 'vendor/three.module.js'));
  console.log(`release/dao-den-long-web/index.html  ${(page.length / 1024).toFixed(1)} KB + vendor/three.module.js (three@${three})`);
} else {
  mkdirSync(resolve(root, 'out'), { recursive: true });
  writeFileSync(resolve(root, 'out/artifact.html'), page);
  console.log(`out/artifact.html  ${(page.length / 1024).toFixed(1)} KB, three@${three}`);
}
