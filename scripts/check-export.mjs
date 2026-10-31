import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const prefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
const html = await readFile('out/index.html', 'utf8');
let checked = 0;
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1].replaceAll('&amp;', '&');
  if (!url.startsWith('/')) continue;
  assert.ok(url.startsWith(`${prefix}/`), `URL is outside the deployment prefix: ${url}`);
  const relative = decodeURIComponent(url.slice(prefix.length)).split(/[?#]/)[0];
  const path = join('out', relative.endsWith('/') ? `${relative}index.html` : relative);
  assert.ok((await stat(path)).isFile(), `Missing exported asset: ${url}`);
  checked++;
}
assert.ok(checked > 6, 'Expected HTML to reference exported images, CSS and JavaScript.');
async function checkPublic(dir = '') {
  for (const item of await readdir(join('public', dir), { withFileTypes: true })) {
    const relative = join(dir, item.name);
    if (item.isDirectory()) await checkPublic(relative);
    else {
      const hash = bytes => createHash('sha256').update(bytes).digest('hex');
      assert.equal(hash(await readFile(join('out', relative))), hash(await readFile(join('public', relative))), relative);
      checked++;
    }
  }
}
await checkPublic();
assert.match(html, /다음 연구 대상은/);
assert.match(html, /쿠리만쥬/);
assert.match(html, /랏코/);
console.log(`Static export passed: ${checked} HTML references/public files, prefix "${prefix || '/'}".`);
