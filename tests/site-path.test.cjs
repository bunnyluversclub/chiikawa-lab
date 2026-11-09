const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');

test('native public assets and home links support root and repository subpaths', () => {
  const code = ts.transpileModule(fs.readFileSync('lib/site-path.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const prefix of ['', '/sample-repository']) {
    const exports = {};
    vm.runInNewContext(code, { exports, process: { env: { NEXT_PUBLIC_BASE_PATH: prefix } } });
    for (const path of ['/', '/images/c_1.png', '/images/k_1.png', '/images/r_1.png', '/sounds/u_reaction.mp3.MP3', '/sounds/h_reaction.MP3']) {
      assert.equal(exports.sitePath(path), prefix + path);
    }
    const imageExports = {};
    const imageCode = ts.transpileModule(fs.readFileSync('lib/character-image.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    vm.runInNewContext(imageCode,{exports:imageExports,require:()=>exports});
    for(const stage of [1,2,3]) {
      assert.equal(imageExports.characterImage({id:'c'},stage),`${prefix}/images/c_${stage}.png`);
      assert.equal(imageExports.characterImage({id:'kani',imagePrefix:'cc'},stage),`${prefix}/images/cc_${stage}.png`);
    }
  }
});

test('static configuration preserves root development and enables repository production', () => {
  for (const [mode, expected] of [['development', ''], ['production', '/sample-repository']]) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', "import c from './next.config.mjs'; console.log(JSON.stringify(c));"], {
      env: { ...process.env, NODE_ENV: mode, NEXT_PUBLIC_BASE_PATH: '/sample-repository' }, encoding: 'utf8',
    });
    const config = JSON.parse(output);
    assert.equal(config.output, 'export');
    assert.equal(config.trailingSlash, true);
    assert.equal(config.basePath, expected);
    assert.equal(config.env.NEXT_PUBLIC_BASE_PATH, expected);
    assert.ok(config.allowedDevOrigins.includes('127.0.0.1'));
  }
});
