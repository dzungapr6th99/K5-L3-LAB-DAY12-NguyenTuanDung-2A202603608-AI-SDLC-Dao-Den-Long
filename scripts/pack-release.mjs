// Packs the GitHub Release assets into release/ (not committed):
//   release/dao-den-long-v1.0.0-web.zip   static web folder: open it through any static web server (see RUN.txt inside)
// The Docker image is built from the Dockerfile at the repo root (see docs/RELEASE-v1.0.0.md).
import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'scripts/build-artifact.js'), '--release'], { stdio: 'inherit' });
const dir = join(root, 'release/dao-den-long-web');
writeFileSync(join(dir, 'RUN.txt'), `Đảo Đèn Lồng v1.0.0 (bản web tĩnh)

Chrome và Edge không chạy được trang này khi mở thẳng bằng file://. Mở thư mục này qua một máy chủ web tĩnh bất kỳ:

  python -m http.server 8080          (rồi mở http://localhost:8080)
  npx http-server -p 8080             (nếu có Node.js)

Bản này lưu bảng xếp hạng và cài đặt trong trình duyệt (localStorage). Muốn bảng xếp hạng ghi ra đĩa và có lệnh
xuất --export-leaderboard, dùng bản có máy chủ: xem README.md trong mã nguồn (npm install, npm start) hoặc Docker.
`);
const zip = join(root, 'release/dao-den-long-v1.0.0-web.zip');
if (existsSync(zip)) rmSync(zip);
if (platform() === 'win32') {
  const ps = join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  execFileSync(ps, ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}\*' -DestinationPath '${zip}'`], { stdio: 'inherit' });
} else {
  const r = spawnSync('zip', ['-r', zip, '.'], { cwd: dir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('zip failed (install zip)');
}
console.log(`packed ${zip}`);
