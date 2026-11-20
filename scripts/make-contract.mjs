// Regenerates game.contract.json from src/tuning.js, so the contract can never drift from the numbers the game uses.
//   npm run contract
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNING } from '../src/tuning.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contract = {
  contract_version: '1.3',
  team: '2A202603608-nguyen-tuan-dung',
  build_cmd: 'npm install',
  run_cmd: 'node server.js',
  headless_cmd: 'node src/headless.js',
  bench_cmd: 'node scripts/bench.mjs',
  soak_cmd: 'node --expose-gc scripts/soak.js',
  tuning: TUNING,
  score: TUNING.score,
};
writeFileSync(resolve(root, 'game.contract.json'), `${JSON.stringify(contract, null, 2)}\n`);
console.log('game.contract.json written');
