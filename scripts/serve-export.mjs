import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

// Preview the actual export, including a Pages-style subpath. No SPA fallback:
// missing assets and nonexistent routes must really return 404 during QA.
const root = resolve('out');
const prefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (prefix && pathname === prefix) { res.writeHead(301, { Location: `${prefix}/` }); res.end(); return; }
    if (!pathname.startsWith(`${prefix}/`)) throw new Error('Not found');
    let path = resolve(root, `.${pathname.slice(prefix.length)}`);
    if (!path.startsWith(root + sep) && path !== root) throw new Error('Not found');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const bytes = await readFile(path);
    res.setHeader('Content-Type', types[extname(path).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = Number(range[1]), end = Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1);
      if (start > end || start >= bytes.length) { res.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }); res.end(); return; }
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1 });
      res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1));
    } else {
      res.writeHead(200, { 'Content-Length': bytes.length });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    }
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Static preview: http://localhost:${port}${prefix}/`));
