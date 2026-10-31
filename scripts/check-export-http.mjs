import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const prefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
const origin = process.env.PREVIEW_ORIGIN || 'http://localhost:4173';
let count = 0;
async function walk(dir = '') {
  for (const item of await readdir(join('out', dir), { withFileTypes: true })) {
    const relative = join(dir, item.name);
    if (item.isDirectory()) await walk(relative);
    else {
      const response = await fetch(`${origin}${prefix}/${relative.split('/').map(encodeURIComponent).join('/')}`);
      assert.equal(response.status, 200, relative);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(join('out', relative)), relative);
      if (/\.mp3$/i.test(relative)) assert.match(response.headers.get('content-type'), /audio\/mpeg/, relative);
      count++;
    }
  }
}
await walk();
const home = await fetch(`${origin}${prefix}/`);
assert.equal(home.status, 200);
assert.match(await home.text(), /만지작 연구소/);
const range = await fetch(`${origin}${prefix}/sounds/u_reaction.mp3.MP3`, { headers: { Range: 'bytes=0-99' } });
assert.equal(range.status, 206);
assert.equal((await range.arrayBuffer()).byteLength, 100);
assert.equal((await fetch(`${origin}${prefix}/missing-asset.png`)).status, 404);
if (prefix) assert.equal((await fetch(`${origin}/images/c_1.png`)).status, 404);
console.log(`HTTP export passed: ${count} files (all PNG/MP3/JS/CSS), home, audio range, real 404s at ${origin}${prefix}/.`);
