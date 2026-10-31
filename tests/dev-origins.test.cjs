const { test } = require('node:test');
const assert = require('node:assert/strict');
const { blockCrossSiteDEV } = require('next/dist/server/lib/router-utils/block-cross-site-dev');

test('development assets accept configured local hosts while unrelated origins stay blocked', async t => {
  const { default: config } = await import('../next.config.mjs');
  assert.ok(config.allowedDevOrigins.includes('127.0.0.1'));
  assert.ok(config.allowedDevOrigins.every(host => !host.includes('*')));
  function check(origin, path = '/_next/static/chunks/client.js') {
    const res = { statusCode: 200, body: '', end(body) { this.body = body; } };
    const blocked = blockCrossSiteDEV({ url: path, headers: { origin } }, res, config.allowedDevOrigins, '0.0.0.0');
    return { blocked, status: res.statusCode, body: res.body };
  }
  for (const host of ['localhost', ...config.allowedDevOrigins]) {
    assert.equal(check(`http://${host}:3000`).blocked, false, host);
  }
  t.mock.method(console, 'warn', () => {});
  assert.equal(check('https://unrelated.example').status, 403);
  assert.equal(check('https://unrelated.example', '/images/c_1.png').blocked, false);
});
