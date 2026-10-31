const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real component's event handlers without a browser. Hook scheduling,
// the OS event bus and capture failures are controllable; game logic is not copied.
function harness(id) {
  const slots = [], frames = new Map(), effects = [];
  let cursor = 0, frameId = 0, now = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial };
      return [slots[i].value, v => { slots[i].value = typeof v === 'function' ? v(slots[i].value) : v; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  function bus() {
    const listeners = new Map();
    return {
      hidden: false,
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      emit(type, event) { listeners.get(type)?.forEach(fn => fn(event)); },
    };
  }
  const window = bus(), document = bus();
  const played = [];
  let stops = 0;
  const sound = { play(kind) { played.push(kind); }, stop() { stops++; }, unlock() {} };
  function load(path, imports) {
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const exports = {};
    vm.runInNewContext(code, {
      exports, require: name => imports[name] ?? require(name), window, document, process: {env: {}}, performance: { now: () => now },
      requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
      cancelAnimationFrame: n => frames.delete(n),
    });
    return exports;
  }
  const data = load('lib/characters.ts', {});
  const Game = load('components/game.tsx', { react, '@/lib/site-path': load('lib/site-path.ts', {}), '@/lib/characters': data, '@/lib/use-sound': { useSound: () => sound } }).default;
  let tree;
  function render() {
    cursor = 0;
    tree = Game({ character: data.CHARACTERS.find(c => c.id === id), muted: false, onBack() {} });
    const visual = find(p => typeof p.className === 'string' && p.className.startsWith('character-position'));
    if (visual?.props.ref) visual.props.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 280, bottom: 260, width: 280, height: 260 }) };
    while (effects.length) effects.shift()();
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) { const result = find(predicate, child); if (result) return result; } return; }
    if (node.props && predicate(node.props)) return node;
    return node.props?.children === undefined ? undefined : find(predicate, node.props.children);
  }
  function elapse(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      now += 16;
      const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now));
    }
    render();
  }
  render();
  return {
    window, elapse, render, played,
    reset: () => { find(p => p.children === '↻ 다시 하기').props.onClick(); render(); },
    stops: () => stops,
    stage: () => find(p => p.className === 'visible' && typeof p.src === 'string')?.props.src,
    speech: () => find(p => p.className === 'speech-bubble').props.children,
    position: () => find(p => typeof p.className === 'string' && p.className.startsWith('character-position')).props,
    motion: () => find(p => typeof p.className === 'string' && p.className.startsWith('character-touch')).props,
    dispose: () => slots.forEach(slot => slot?.cleanup?.()),
    surface: () => find(p => p.className === 'interaction-surface').props,
    progress: () => Number(find(p => p.role === 'progressbar').props['aria-valuenow']),
  };
}
function touch(pointerId = 1, captureFails = false) {
  let captured = false;
  return {
    pointerId, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 70, cancelable: true,
    preventDefault() {},
    currentTarget: {
      setPointerCapture() { if (captureFails) throw new Error('NotFoundError'); captured = true; },
      hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; },
    },
  };
}

test('touch hold progresses even if Safari capture throws; outside pointerup stops it', () => {
  const h = harness('c');
  h.surface().onPointerDown(touch(1, true));
  h.elapse(1750);
  assert.ok(h.progress() > 40 && h.progress() < 60);
  h.window.emit('pointerup', { pointerId: 1 });
  const saved = h.progress(); h.elapse(1000); assert.equal(h.progress(), saved);
  h.surface().onPointerDown(touch(2, true)); h.elapse(1850); assert.equal(h.progress(), 100);
  assert.equal(h.played.filter(s => s === 'reaction').length, 1);
});

test('Chiikawa continuous hold keeps three stages and finishes around 3.5 seconds', () => {
  const h = harness('c');
  h.surface().onPointerDown(touch());
  assert.equal(h.stage(), '/images/c_1.png');
  h.elapse(1700); assert.equal(h.stage(), '/images/c_2.png');
  h.elapse(1600); assert.ok(h.progress() < 100);
  h.elapse(300); assert.equal(h.progress(), 100); assert.equal(h.stage(), '/images/c_3.png');
  assert.equal(h.played.filter(s => s === 'reaction').length, 1);
  h.elapse(1000); assert.equal(h.played.filter(s => s === 'reaction').length, 1);
  h.reset(); assert.equal(h.progress(), 0); assert.equal(h.stage(), '/images/c_1.png');
  h.dispose();
});

test('touch focus blur and lost capture do not terminate a held finger; pointercancel does', () => {
  const h = harness('c');
  h.surface().onPointerDown(touch());
  h.surface().onBlur();
  h.surface().onLostPointerCapture({ pointerId: 1 });
  h.window.emit('pointerup', { pointerId: 2 });
  h.elapse(1800); assert.ok(h.progress() > 20);
  h.window.emit('pointercancel', { pointerId: 1 });
  const saved = h.progress(); h.elapse(1000); assert.equal(h.progress(), saved);
});

test('secondary touches cannot steal the original pointer session', () => {
  const h = harness('c');
  h.surface().onPointerDown(touch(1));
  h.surface().onPointerDown({ ...touch(2), isPrimary: false });
  h.surface().onPointerCancel({ pointerId: 2 });
  h.elapse(1500); assert.ok(h.progress() > 15);
  h.surface().onPointerUp({ pointerId: 1 });
  const saved = h.progress(); h.elapse(1000); assert.equal(h.progress(), saved);
});


test('Hachiware requires a head start and horizontal movement, including capture fallback', () => {
  const h = harness('h');
  h.surface().onPointerDown({ ...touch(), clientY: 230 });
  h.window.emit('pointermove', { pointerId: 1, clientX: 200, clientY: 70 });
  h.render(); assert.equal(h.progress(), 0);
  h.surface().onPointerDown(touch(2, true)); h.elapse(3000); assert.equal(h.progress(), 0);
  h.window.emit('pointermove', { pointerId: 2, clientX: 100, clientY: 80, cancelable: true, preventDefault() {} });
  h.render(); assert.equal(h.progress(), 0);
  for (const x of [200, 320, 200, -10, 100]) h.window.emit('pointermove', { pointerId: 2, clientX: x, clientY: 70, cancelable: true, preventDefault() {} });
  h.render(); assert.ok(h.progress() > 0);
  h.window.emit('pointerup', { pointerId: 2, type: 'pointerup' });
  const saved = h.progress(); h.elapse(1000); assert.equal(h.progress(), saved);
  h.dispose();
});

test('Hachiware reaches all three images and plays its reaction once per round', () => {
  const h = harness('h');
  function rub(count) {
    for (let i = 0; i < count; i++) h.surface().onPointerMove({ pointerId: 1, clientX: i % 2 ? 100 : 180, clientY: 70 });
    h.render();
  }
  assert.equal(h.stage(), '/images/h_1.png');
  h.surface().onPointerDown(touch()); rub(20); assert.equal(h.stage(), '/images/h_2.png');
  rub(30); assert.equal(h.progress(), 100); assert.equal(h.stage(), '/images/h_3.png');
  rub(20); assert.equal(h.played.filter(s => s === 'reaction').length, 1);
  h.reset(); assert.equal(h.progress(), 0); assert.equal(h.stage(), '/images/h_1.png'); assert.equal(h.stops(), 1);
  h.surface().onPointerDown(touch()); rub(50); assert.equal(h.played.filter(s => s === 'reaction').length, 2);
  h.dispose();
});

test('Momonga rejects a long press, a drag and cancellation; a short tap is counted once', () => {
  const h = harness('m');
  h.surface().onPointerDown(touch()); h.elapse(1000); assert.equal(h.progress(), 0);
  h.surface().onPointerUp({ pointerId: 1, type: 'pointerup' }); h.render(); assert.equal(h.progress(), 0);
  h.surface().onPointerDown(touch(2)); h.surface().onPointerMove({ pointerId: 2, clientX: 150, clientY: 70 });
  h.surface().onPointerUp({ pointerId: 2, type: 'pointerup' }); h.render(); assert.equal(h.progress(), 0);
  h.surface().onPointerDown(touch(3)); h.surface().onPointerCancel({ pointerId: 3, type: 'pointercancel' }); h.render(); assert.equal(h.progress(), 0);
  h.surface().onPointerDown(touch(4, true)); h.elapse(32);
  h.window.emit('pointerup', { pointerId: 4, type: 'pointerup' }); h.render();
  const oneTap = h.progress(); assert.ok(oneTap > 0 && oneTap < 10);
  h.surface().onPointerUp({ pointerId: 4, type: 'pointerup' }); h.render(); assert.equal(h.progress(), oneTap);
  h.dispose();
});

test('Momonga rapid taps traverse stages; repeated final input does not repeat the reaction', () => {
  const h = harness('m');
  function taps(count) {
    for (let i = 0; i < count; i++) {
      const id = i + 1;
      h.surface().onPointerDown(touch(id)); h.elapse(16);
      h.surface().onPointerUp({ pointerId: id, type: 'pointerup' }); h.render();
    }
  }
  assert.equal(h.stage(), '/images/m_1.png');
  taps(9); assert.equal(h.stage(), '/images/m_2.png');
  taps(9); assert.equal(h.progress(), 100); assert.equal(h.stage(), '/images/m_3.png'); assert.equal(h.speech(), '저리가!');
  taps(5); assert.equal(h.played.filter(s => s === 'reaction').length, 1);
  h.reset(); assert.equal(h.progress(), 0); assert.equal(h.stage(), '/images/m_1.png'); assert.equal(h.stops(), 1);
  taps(18); assert.equal(h.played.filter(s => s === 'reaction').length, 2);
  h.dispose();
});

test('Hachiware and Momonga keyboard access does not use Chiikawa hold or Usagi launch input', () => {
  const h = harness('h');
  h.surface().onKeyDown({ key: ' ', preventDefault() {} }); h.elapse(2000); assert.equal(h.progress(), 0);
  for (const key of ['ArrowLeft','ArrowRight','ArrowLeft']) h.surface().onKeyDown({ key, preventDefault() {} });
  h.render(); assert.ok(h.progress() > 0); h.dispose();
  const m = harness('m');
  m.surface().onKeyDown({ key: 'ArrowLeft', preventDefault() {} }); m.render(); assert.equal(m.progress(), 0);
  m.surface().onKeyDown({ key: ' ', repeat: true, preventDefault() {} }); m.render(); assert.equal(m.progress(), 0);
  m.surface().onKeyDown({ key: ' ', repeat: false, preventDefault() {} }); m.render(); assert.ok(m.progress() > 0);
  m.dispose();
});

test('all four playable characters reference actual images and sound files', () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/characters.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  assert.equal(exports.CHARACTERS.length, 4);
  for (const c of exports.CHARACTERS) {
    assert.equal(c.available, true);
    for (const stage of [1,2,3]) assert.ok(fs.existsSync(`public/images/${c.id}_${stage}.png`));
    assert.ok(fs.existsSync(`public${c.sound}`), c.sound);
    assert.ok(fs.existsSync(`public${c.reaction}`), c.reaction);
  }
});


test('Momonga uses physical event timestamps for delayed short taps and rejects movement visible only at release', () => {
  const h = harness('m');
  h.surface().onPointerDown({ ...touch(), timeStamp: 100 });
  h.elapse(1000);
  h.surface().onPointerUp({ pointerId: 1, type: 'pointerup', timeStamp: 160, clientX: 100, clientY: 70 });
  h.render(); assert.ok(h.progress() > 0);
  const saved = h.progress();
  h.surface().onPointerDown({ ...touch(2), timeStamp: 1200 });
  h.surface().onPointerUp({ pointerId: 2, type: 'pointerup', timeStamp: 1260, clientX: 200, clientY: 70 });
  h.render(); assert.equal(h.progress(), saved);
  h.dispose();
});

function verticalMove(h, y, x = 100, fallback = false, id = 1) {
  const e = { pointerId: id, clientX: x, clientY: y, cancelable: true, preventDefault() {} };
  if (fallback) h.window.emit('pointermove', e); else h.surface().onPointerMove(e);
  h.render();
}

test('Usagi ignores hold, tap, horizontal strokes, jitter and release-only upward flicks', () => {
  const h = harness('u');
  h.surface().onPointerDown(touch()); h.elapse(2000); assert.equal(h.progress(), 0);
  for (const x of [150,200,100,200,100]) verticalMove(h,70,x);
  for (let i = 0; i < 200; i++) verticalMove(h,i % 2 ? 73 : 67);
  assert.equal(h.progress(), 0); assert.equal(h.played.length, 0);
  h.surface().onPointerUp({ pointerId: 1, type: 'pointerup', clientX: 100, clientY: -100 });
  h.render(); assert.equal(h.progress(), 0);
  h.surface().onPointerDown(touch()); verticalMove(h,-40);
  for (let i = 0; i < 100; i++) verticalMove(h,i % 2 ? -38 : -40);
  assert.equal(h.progress(), 0); // A long stroke followed by tiny reversal noise is not a shake.
  h.surface().onPointerUp({ pointerId: 1, type: 'pointerup' }); h.render(); assert.equal(h.progress(), 0);
  h.dispose();
});

test('Usagi mouse and touch progress during one continuous session on deliberate Y reversals', () => {
  for (const pointerType of ['mouse','touch']) {
    const h = harness('u');
    h.surface().onPointerDown({ ...touch(), pointerType });
    verticalMove(h,-30); assert.equal(h.progress(), 0);
    verticalMove(h,-5); assert.equal(h.progress(), 0); // Reversal under 28px.
    verticalMove(h,70); assert.ok(h.progress() > 0);
    assert.match(h.motion().style.transform, /translateY/);
    const saved = h.progress();
    verticalMove(h,-30); verticalMove(h,70); assert.ok(h.progress() > saved);
    assert.ok(h.played.includes('basic'));
    h.surface().onPointerUp({ pointerId: 1, type: 'pointerup' }); h.render();
    const released = h.progress(); verticalMove(h,-30); assert.equal(h.progress(), released);
    assert.match(h.motion().style.transform, /translateY\(0px\) scale\(1\)/);
    h.dispose();
  }
});

test('Usagi capture fallback follows outside, ignores secondary touches, stops on cancel and resets strokes on regrab', () => {
  const h = harness('u');
  h.surface().onPointerDown(touch(1,true));
  h.surface().onPointerDown({ ...touch(2), isPrimary: false });
  verticalMove(h,-80,100,true,2); assert.equal(h.progress(), 0);
  verticalMove(h,-80,100,true); verticalMove(h,280,100,true); assert.ok(h.progress() > 0);
  h.window.emit('pointercancel', { pointerId: 1, type: 'pointercancel' });
  const saved = h.progress(); verticalMove(h,-80,100,true); assert.equal(h.progress(), saved);
  h.surface().onPointerDown(touch(3,true)); verticalMove(h,-30,100,true,3); assert.equal(h.progress(), saved);
  verticalMove(h,70,100,true,3); assert.ok(h.progress() > saved);
  h.dispose();
});

test('Usagi lost capture falls back without ending a held vertical shake', () => {
  const h = harness('u'); h.surface().onPointerDown(touch()); verticalMove(h,-40);
  h.surface().onLostPointerCapture({ pointerId: 1 });
  verticalMove(h,90,100,true); assert.ok(h.progress() > 0);
  h.window.emit('pointerup',{pointerId:1,type:'pointerup'});
  const saved=h.progress(); verticalMove(h,-40,100,true); assert.equal(h.progress(),saved); h.dispose();
});

test('Usagi continuous shaking keeps three stages, launch/landing, one reaction and reset', () => {
  const h = harness('u');
  function shake(n) { for(let i=0;i<n;i++) verticalMove(h,i%2 ? 170 : -30); }
  assert.equal(h.stage(),'/images/u_1.png');
  h.surface().onPointerDown(touch()); shake(4); assert.equal(h.stage(),'/images/u_2.png');
  shake(20); assert.equal(h.progress(),100); assert.equal(h.stage(),'/images/u_3.png');
  assert.match(h.position().className,/launch/); assert.equal(h.played.filter(s=>s==='reaction').length,1);
  assert.match(h.motion().style.transform,/translateY\(0px\) scale\(1\)/);
  h.position().onAnimationEnd({animationName:'launch-drop'}); h.render(); shake(20);
  assert.equal(h.played.filter(s=>s==='reaction').length,1);
  h.reset(); assert.equal(h.progress(),0); assert.equal(h.stage(),'/images/u_1.png');
  h.surface().onPointerDown(touch()); shake(30); assert.equal(h.played.filter(s=>s==='reaction').length,2); h.dispose();
});

test('Usagi keyboard requires alternating up/down; left/right, repeated direction and autorepeat do not progress', () => {
  const h=harness('u');
  for(const key of ['ArrowLeft','ArrowRight',' ','Enter']) h.surface().onKeyDown({key,preventDefault(){}});
  for(let i=0;i<10;i++) h.surface().onKeyDown({key:'ArrowUp',repeat:false,preventDefault(){}});
  h.surface().onKeyDown({key:'ArrowDown',repeat:true,preventDefault(){}});h.render();assert.equal(h.progress(),0);
  for(let i=0;i<30;i++)h.surface().onKeyDown({key:i%2?'ArrowUp':'ArrowDown',repeat:false,preventDefault(){}});
  h.render();assert.equal(h.progress(),100);assert.equal(h.played.filter(s=>s==='reaction').length,1);h.dispose();
});

test('Usagi normal 80px strokes finish in 3–5 seconds while retaining the existing squash ratios', () => {
  const h = harness('u'); h.surface().onPointerDown({...touch(),clientY:170});
  for(let i=0;i<14;i++) {
    h.elapse(300); verticalMove(h,i%2 ? 170 : 90);
    if(i===0) assert.match(h.motion().style.transform,/translateY\(-38\.4px\) scale\(\.97,1\.04\)/);
    if(i===7) assert.ok(h.progress()<100);
  }
  assert.equal(h.progress(),100); assert.equal(h.played.filter(s=>s==='reaction').length,1);
  h.dispose();
});

