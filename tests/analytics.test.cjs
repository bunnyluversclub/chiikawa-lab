const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, globals = {}, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name] || require(name), process: { env: { NODE_ENV: 'production' } }, ...globals });
  return exports;
}

test('GA initialization queues one config/page_view, including when an early event precedes the effect', () => {
  const window = {};
  const ga = load('lib/analytics.ts', { window });
  ga.trackCharacterEvent('character_select', 'c');
  ga.initializeAnalytics(); ga.initializeAnalytics();
  const entries = window.dataLayer.map(args => Array.from(args));
  assert.equal(entries.filter(args => args[0] === 'js').length, 1);
  assert.equal(entries.filter(args => args[0] === 'config').length, 1);
  assert.equal(entries[1][1], 'G-TR2E2GHRDQ');
  assert.equal(entries[1][2].send_page_view, true);
  assert.equal(entries[2][1], 'character_select');
  assert.equal(entries[2][2].character, 'chiikawa');
  // No manual page_view event that would double-count the config's page_view.
  assert.equal(entries.filter(args => args[0] === 'event' && args[1] === 'page_view').length, 0);
});

test('GA maps all eight character IDs and keeps sound_toggle muted as a boolean', () => {
  const window = {}, ga = load('lib/analytics.ts', { window });
  for (const [id, name] of [['c','chiikawa'],['u','usagi'],['h','hachiware'],['m','momonga'],['k','kurimanju'],['r','rakko'],['s','shisa'],['kani','kani']]) {
    for (const event of ['character_select','reaction_complete','reset']) {
      ga.trackCharacterEvent(event, id);
      const last = window.dataLayer.at(-1);
      assert.equal(last[1], event); assert.equal(last[2].character, name);
    }
  }
  for (const muted of [true,false]) {
    ga.trackEvent('sound_toggle', { muted });
    assert.equal(window.dataLayer.at(-1)[2].muted, muted);
    assert.equal(typeof window.dataLayer.at(-1)[2].muted, 'boolean');
  }
});

test('GA is safe for static prerendering, disabled in development, and cannot throw into game input', () => {
  const server = load('lib/analytics.ts');
  assert.doesNotThrow(() => { server.initializeAnalytics(); server.trackCharacterEvent('reset','c'); });
  const window = {};
  const dev = load('lib/analytics.ts', { window, process: { env: { NODE_ENV: 'development' } } });
  dev.initializeAnalytics(); dev.trackEvent('sound_toggle', { muted: true });
  assert.equal(window.dataLayer, undefined);
  const blocked = load('lib/analytics.ts', { window: { gtag() { throw new Error('Blocked'); } } });
  assert.doesNotThrow(() => blocked.trackCharacterEvent('reaction_complete','u'));
});

test('real home handlers send one select/toggle event; loading saved mute sends none', () => {
  const events = [], slots = [], effects = [];
  let cursor = 0, tree;
  const storage = { 'touch-lab-muted': 'true' };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(fn) { effects.push(fn); },
  };
  const { CHARACTERS, isNewCharacter } = load('lib/characters.ts');
  const { default: Home } = load('app/page.tsx', { window: { scrollTo() {} }, localStorage: {
    getItem: key => storage[key], setItem: (key, value) => { storage[key] = value; },
  } }, {
    react, '@/lib/characters': { CHARACTERS, isNewCharacter }, '@/components/game': () => null, '@/components/new-character-game': () => null,
    '@/lib/character-image': { characterImage: (c,s) => `/images/${c.imagePrefix || c.id}_${s}.png` },
    '@/lib/site-path': { sitePath: path => path },
    '@/lib/prepare-stage-audio': { prepareStageAudio() {} },
    '@/lib/analytics': {
      trackCharacterEvent: (event, character) => events.push({event, character}),
      trackEvent: (event, parameters) => events.push({event, ...parameters}),
    },
  });
  function render() { cursor = 0; tree = Home(); }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) { const result = find(predicate, child); if (result) return result; } return; }
    if (node.props && predicate(node.props)) return node.props;
    return node.props?.children === undefined ? undefined : find(predicate, node.props.children);
  }
  render(); effects.splice(0).forEach(fn => fn()); render(); assert.equal(events.length, 0);
  find(p => p.className === 'sound-button').onClick(); render();
  assert.deepEqual(events, [{event:'sound_toggle',muted:false}]); assert.equal(storage['touch-lab-muted'],'false');
  find(p => p.className === 'sound-button').onClick(); render();
  assert.equal(events.length,2); assert.equal(events[1].muted,true);
  find(p => p['aria-label'] === '우사기 실험 시작').onClick(); render();
  assert.deepEqual(events[2],{event:'character_select',character:'u'});
  assert.equal(events.length,3);
  for(const id of ['k','r','s','kani']) {
    slots[0]=null;render();const character=CHARACTERS.find(c=>c.id===id);
    find(p=>p['aria-label']===`${character.name} 실험 시작`).onClick();render();
    assert.equal(find(p=>p.character?.id===id).character.name,character.name);
    assert.deepEqual(events.at(-1),{event:'character_select',character:id});
  }
  const discoveryKey='touch-lab-kani-discovered';
  assert.equal(storage[discoveryKey],undefined);
  find(p=>p.character?.id==='kani').onDiscover();render();
  assert.equal(storage[discoveryKey],'true');
  assert.equal(find(p=>p.character?.id==='kani').character.name,'?');
  find(p=>p.character?.id==='kani').onBack();render();
  find(p=>p['aria-label']==='? 실험 시작').onClick();render();
  assert.equal(find(p=>p.character?.id==='kani').character.name,'?');
  assert.deepEqual(events.at(-1),{event:'character_select',character:'kani'});
  // Remount with a fresh React state store, as after a full page reload.
  slots.length=0;effects.length=0;render();effects.splice(0).forEach(fn=>fn());render();
  assert.ok(find(p=>p['aria-label']==='? 실험 시작'));
  assert.equal(find(p=>p['aria-label']==='카니 실험 시작'),undefined);
});
