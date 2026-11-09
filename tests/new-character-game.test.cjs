const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual component with a deterministic clock and Pointer Events.
function harness(id, muted = false, preparedMode = false, deferWarm = false) {
  let now = 0, cursor = 0, nextId = 0, tree, backCount = 0, discoveries = 0;
  const slots = [], effects = [], frames = new Map(), timers = new Map(), events = [];
  const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  const react = {
    useState(value) {const i=cursor++;slots[i] ??= {value};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},
    useRef(value) {const i=cursor++;return slots[i] ??= {current:value};},
    useCallback(fn,deps) {const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
    useEffect(fn,deps) {const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,setup:fn,cleanup:fn()};});},
  };
  function bus() {const handlers=new Map();return{hidden:false,addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},removeEventListener(type,fn){handlers.get(type)?.delete(fn);},emit(type,e){handlers.get(type)?.forEach(fn=>fn(e));}};}
  const window=bus(),document=bus();
  const audible=[],clips=[],warmResolvers=[];
  class Audio {
    constructor(src){this.src=src;this.paused=true;this.ended=false;this.muted=false;this.volume=1;this.currentTime=0;clips.push(this);}
    load(){}
    play(){this.plays=(this.plays||0)+1;this.paused=false;if(!this.muted&&this.volume>0)audible.push(this.src);return deferWarm&&this.volume===0?new Promise(resolve=>warmResolvers.push(resolve)):Promise.resolve();}
    pause(){this.paused=true;}
  }
  function load(path,imports={}) {
    const exports={};
    const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(code,{exports,require:name=>imports[name]??require(name),window,document,Audio,queueMicrotask,process:{env:{}},performance:{now:()=>now},
      requestAnimationFrame:fn=>{frames.set(++nextId,fn);return nextId;},cancelAnimationFrame:n=>frames.delete(n),
      setTimeout:(fn,delay)=>{timers.set(++nextId,{fn,time:now+delay});return nextId;},clearTimeout:n=>timers.delete(n),
    });return exports;
  }
  const rules=load('lib/new-interactions.ts');
  const paths=load('lib/site-path.ts'),data=load('lib/characters.ts');
  const core=load('lib/use-sound.ts',{react,'./characters':data,'./site-path':paths});
  const prepared=load('lib/prepare-stage-audio.ts',{'./site-path':paths});
  if(preparedMode)prepared.prepareStageAudio(data.CHARACTERS.find(c=>c.id===id),muted);
  const sounds=load('lib/use-stage-sound.ts',{react,'./characters':data,'./prepare-stage-audio':prepared,'./use-sound':core});
  const Game=load('components/new-character-game.tsx',{react,'@/lib/new-interactions':rules,
    '@/lib/character-image':{characterImage:(c,s)=>`/images/${c.imagePrefix||c.id}_${s}.png`},
    '@/lib/analytics':{trackCharacterEvent:(event,character)=>events.push({event,character})},
    '@/lib/use-stage-sound':sounds,
  }).default;
  let character={id,name:id==='kani'?'?':id==='k'?'쿠리만쥬':id==='r'?'랏코':'시사',color:'blue',imagePrefix:id==='kani'?'cc':undefined,imageScale:[1,1,1]};
  function find(predicate,node=tree) {
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){for(const child of node){const found=find(predicate,child);if(found)return found;}return;}
    if(node.props&&predicate(node.props))return node.props;
    return node.props?.children===undefined?undefined:find(predicate,node.props.children);
  }
  function findAll(predicate,node=tree) {
    if(!node||typeof node!=='object')return [];
    if(Array.isArray(node))return node.flatMap(child=>findAll(predicate,child));
    return [...(node.props&&predicate(node.props)?[node.props]:[]),...(node.props?.children===undefined?[]:findAll(predicate,node.props.children))];
  }
  function render(){cursor=0;tree=Game({character,muted,onBack(){backCount++;},onDiscover(){discoveries++;}});const ref=find(p=>p.className==='character-position')?.ref;if(ref)ref.current={getBoundingClientRect:()=>({left:100,top:70,width:280,height:260,right:380,bottom:330})};while(effects.length)effects.shift()();}
  function advance(ms){for(let i=0;i<ms;i+=16){now+=Math.min(16,ms-i);const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));for(const [key,timer] of [...timers])if(timer.time<=now){timers.delete(key);timer.fn();}render();}}
  render();
  return {window,document,events,advance,render,find,audible,clips,setMuted:value=>{muted=value;render();},
    resolveWarm:()=>warmResolvers.splice(0).forEach(resolve=>resolve()),rename:name=>{character={...character,name};render();},
    replayEffects:()=>{slots.forEach(slot=>slot?.cleanup?.());slots.forEach(slot=>{if(slot?.setup)slot.cleanup=slot.setup();});},
    control:(index=id==='kani'?3:0)=>id==='s'?find(p=>typeof p.className==='string'&&p.className.startsWith('distraction ')):find(p=>p.className==='interaction-surface')||findAll(p=>typeof p.className==='string'&&p.className.startsWith('drag-item'))[index],
    choices:()=>findAll(p=>typeof p.className==='string'&&p.className.startsWith('drag-item')),
    distraction:()=>find(p=>typeof p.className==='string'&&p.className.startsWith('distraction ')),
    stage:()=>find(p=>p.className==='visible')?.src,
    progress:()=>find(p=>p.role==='progressbar')['aria-valuenow'],
    reset:()=>{find(p=>p.children==='↻ 다시 하기').onClick();render();},
    dispose:()=>slots.forEach(slot=>slot?.cleanup?.()),pending:()=>timers.size,
    discoveries:()=>discoveries,
    back:()=>{find(p=>p.children==='다른 친구 선택 ↗').onClick();render();},backCount:()=>backCount,
  };
}
function pointer(id=1,fail=false,type='touch',x=240,y=200) {
  let captured=false;
  return {pointerId:id,isPrimary:true,pointerType:type,button:0,clientX:x,clientY:y,preventDefault(){},cancelable:true,
    currentTarget:{getBoundingClientRect:()=>({left:208,top:342,width:64,height:64}),setPointerCapture(){if(fail)throw Error('NotFoundError');captured=true;},hasPointerCapture(){return captured;},releasePointerCapture(){captured=false;}},
  };
}
function move(h,x,y,id=1,fallback=false){const e={pointerId:id,clientX:x,clientY:y,cancelable:true,preventDefault(){}};if(fallback)h.window.emit('pointermove',e);else h.control().onPointerMove(e);h.render();}
function end(h,x,y,id=1,fallback=false,type='pointerup'){const e={pointerId:id,clientX:x,clientY:y,type};if(fallback)h.window.emit(type,e);else h.control()[type==='pointerup'?'onPointerUp':'onPointerCancel'](e);h.render();}

test('Kurimanju requires actual tilt plus a brief hold, then completes only on release',()=>{
  for(const type of ['mouse','touch']){
    const h=harness('k');h.control().onPointerDown(pointer(1,false,type));h.advance(2000);assert.match(h.stage(),/k_1/);end(h,240,200);assert.equal(h.progress(),0);
    h.control().onPointerDown(pointer(2,false,type));move(h,320,200,2);assert.match(h.stage(),/k_2/);h.advance(350);end(h,320,200,2);assert.match(h.stage(),/k_1/);
    h.control().onPointerDown(pointer(3,false,type));move(h,160,200,3);h.advance(720);assert.match(h.stage(),/k_2/);assert.equal(h.events.length,0);
    end(h,160,200,3);assert.match(h.stage(),/k_3/);assert.equal(h.progress(),100);assert.equal(h.find(p=>p.className?.startsWith('new-character-pose')).style.transform,'rotate(0deg)');
    assert.deepEqual(h.events,[{event:'reaction_complete',character:'k'}]);h.control().onPointerDown(pointer());h.advance(1000);assert.equal(h.events.length,1);h.dispose();
  }
});

test('Kurimanju tilt resets interrupted hold; capture fallback, secondary pointer and cancellation are safe',()=>{
  const h=harness('k');h.control().onPointerDown(pointer(1,true));move(h,450,200,1,true);h.advance(350);
  move(h,240,200,1,true);h.advance(400);move(h,450,200,1,true);h.advance(350);end(h,450,200,1,true);assert.equal(h.progress(),0);
  h.control().onPointerDown(pointer(2,true));move(h,450,200,2,true);h.advance(720);end(h,450,200,3,true);assert.equal(h.events.length,0);
  end(h,450,200,2,true,'pointercancel');assert.match(h.stage(),/k_1/);assert.equal(h.events.length,0);
  h.control().onPointerDown(pointer(4,true));move(h,450,200,4,true);h.advance(720);end(h,450,200,4,true);assert.match(h.stage(),/k_3/);h.dispose();
});

test('Kurimanju reset and keyboard release start fresh rounds with one completion event each',()=>{
  const h=harness('k');h.control().onKeyDown({key:'ArrowLeft',preventDefault(){}});h.advance(720);h.control().onKeyUp({key:'ArrowLeft'});h.render();assert.equal(h.progress(),100);
  h.reset();assert.equal(h.progress(),0);assert.match(h.stage(),/k_1/);
  h.control().onKeyDown({key:'ArrowRight',preventDefault(){}});h.advance(720);h.control().onKeyUp({key:'ArrowRight'});h.render();assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,2);assert.equal(h.events.filter(e=>e.event==='reset').length,1);h.dispose();
});

test('Rakko needs two real feeds; time, failed drops and cancellation cannot finish r_2',()=>{
  for(const type of ['mouse','touch']){
    const h=harness('r');
    const feed=id=>{h.control().onPointerDown(pointer(id,false,type,240,374));move(h,240,203,id);end(h,240,203,id);};
    feed(1);assert.match(h.stage(),/r_2/);assert.equal(h.progress(),50);assert.equal(h.control(),undefined);assert.equal(h.events.length,0);
    h.advance(300);assert.equal(h.control(),undefined);h.advance(400);assert.ok(h.control());
    h.advance(5000);assert.match(h.stage(),/r_2/);assert.equal(h.events.length,0);
    h.control().onPointerDown(pointer(2,false,type,240,374));move(h,400,374,2);end(h,400,374,2);assert.equal(h.control().style.transform,'translate(0px, 0px)');assert.equal(h.progress(),50);
    h.control().onPointerDown(pointer(3,true,type,240,374));move(h,240,203,3,true);end(h,240,203,3,true,'pointercancel');assert.equal(h.progress(),50);
    feed(4);assert.match(h.stage(),/r_3/);assert.equal(h.progress(),100);assert.equal(h.control(),undefined);assert.deepEqual(h.events,[{event:'reaction_complete',character:'r'}]);
    h.advance(5000);assert.equal(h.events.length,1);h.reset();assert.match(h.stage(),/r_1/);assert.equal(h.progress(),0);assert.ok(h.control());h.dispose();
  }
});

test('Rakko respawn is cancelled on reset/unmount and lost capture still permits both feeds',()=>{
  const h=harness('r');
  h.control().onPointerDown(pointer(1,false,'touch',240,374));h.control().onLostPointerCapture({pointerId:1});move(h,240,203,1,true);end(h,240,203,1,true);assert.match(h.stage(),/r_2/);
  h.reset();h.advance(2000);assert.match(h.stage(),/r_1/);assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,0);
  h.control().onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();h.advance(700);
  h.control().onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();assert.match(h.stage(),/r_3/);assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,1);
  h.reset();h.control().onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();h.dispose();assert.equal(h.pending(),0);h.advance(2000);assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,1);
});

test('Secret scene presents five equal choices; all four wrong choices return without revealing anything',()=>{
  for(const type of ['mouse','touch']){
    const h=harness('kani');assert.equal(h.choices().length,5);
    assert.equal(new Set(h.choices().map(p=>p.className)).size,1);
    for(const index of [0,1,2,4]){
      h.control(index).onPointerDown(pointer(1,false,type,240,374));h.render();move(h,240,127);end(h,240,127);
      assert.match(h.stage(),/cc_1/);assert.equal(h.progress(),0);assert.equal(h.choices().length,5);assert.equal(h.control(index).style.transform,'translate(0px, 0px)');assert.equal(h.events.length,0);
      h.control(index).onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();assert.equal(h.progress(),0);assert.equal(h.discoveries(),0);
    }
    h.control(3).onPointerDown(pointer(2,false,type,240,374));move(h,410,374,2);end(h,410,374,2);assert.equal(h.progress(),0);
    h.control(3).onPointerDown(pointer(3,true,type,240,374));move(h,240,127,3,true);end(h,240,127,3,true);
    assert.match(h.stage(),/cc_2/);assert.equal(h.choices().length,0);assert.equal(h.events.length,0);assert.equal(h.discoveries(),0);
    h.advance(800);assert.match(h.stage(),/cc_2/);assert.equal(h.discoveries(),0);h.advance(400);assert.match(h.stage(),/cc_3/);assert.equal(h.discoveries(),1);assert.deepEqual(h.events,[{event:'reaction_complete',character:'kani'}]);h.advance(3000);assert.equal(h.events.length,1);assert.equal(h.discoveries(),1);h.reset();assert.equal(h.discoveries(),1);h.dispose();
  }
});

test('Secret reset/unmount cancels reveal; no visible or accessible text leaks the name before discovery',()=>{
  const h=harness('kani');
  h.rename('카니'); // Even an old discovered name supplied by a caller stays hidden.
  h.control(3).onPointerDown(pointer(1,true,'touch',240,374));move(h,240,127,1,true);end(h,240,127,1,true,'pointercancel');assert.equal(h.choices().length,5);assert.equal(h.progress(),0);
  h.control(3).onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();h.reset();h.advance(2000);assert.match(h.stage(),/cc_1/);assert.equal(h.choices().length,5);assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,0);
  assert.equal(h.find(p=>typeof p['aria-label']==='string'&&/카니|kani/i.test(p['aria-label'])),undefined);
  assert.equal(h.find(p=>typeof p.alt==='string'&&/카니|kani/i.test(p.alt)),undefined);
  assert.equal(h.find(p=>typeof p.children==='string'&&/카니|kani|틀렸/i.test(p.children)),undefined);
  h.control(3).onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();assert.equal(h.find(p=>p.children==='?').children,'?');h.advance(1200);assert.match(h.stage(),/cc_3/);assert.equal(h.discoveries(),1);
  assert.equal(h.find(p=>p.children==='카니').children,'카니');
  h.reset();assert.equal(h.find(p=>p.children==='?').children,'?');h.control(3).onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();h.dispose();assert.equal(h.pending(),0);
});

test('Shisa accepts throws in all four directions for mouse and touch, but never a tap or a tiny drag',()=>{
  for(const type of ['mouse','touch'])for(const [dx,dy]of [[100,0],[-100,0],[0,100],[0,-100]]){
    const h=harness('s');h.advance(750);
    h.control().onPointerDown(pointer(1,false,type));end(h,240,200);assert.ok(h.distraction());assert.equal(h.progress(),0);
    h.control().onPointerDown(pointer(2,false,type));move(h,248,200,2);end(h,248,200,2);assert.ok(h.distraction());assert.equal(h.distraction().style.transform,'translate(0px, 0px)');
    h.control().onPointerDown(pointer(3,false,type));move(h,240+dx,200+dy,3);end(h,240+dx,200+dy,3);assert.match(h.distraction().className,/flying/);assert.equal(h.progress(),0);
    h.advance(150);assert.ok(h.distraction());h.advance(150);assert.equal(h.distraction(),undefined);assert.equal(h.progress(),33);
    h.advance(300);assert.equal(h.distraction(),undefined);h.advance(350);assert.match(h.distraction().className,/distraction-1/);h.dispose();
  }
});

test('Shisa uses recent flick speed after a hold; old velocity or fast sub-threshold jitter is rejected',()=>{
  const h=harness('s');h.advance(750);
  function start(){h.control().onPointerDown({...pointer(),timeStamp:0});}
  function timedMove(x,timeStamp){h.control().onPointerMove({pointerId:1,clientX:x,clientY:200,timeStamp});h.render();}
  function timedEnd(x,timeStamp){h.control().onPointerUp({pointerId:1,type:'pointerup',clientX:x,clientY:200,timeStamp});h.render();}
  start();timedMove(248,1);timedEnd(248,2);assert.doesNotMatch(h.distraction().className,/flying/);
  start();timedMove(275,50);timedEnd(275,500);assert.doesNotMatch(h.distraction().className,/flying/);
  start();h.advance(2000);timedMove(245,2010);timedMove(275,2030);timedEnd(275,2040);assert.match(h.distraction().className,/flying/);h.dispose();
});

test('Shisa completes only after all three flights; reset, secondary touches and pointer cancellation are safe',()=>{
  const h=harness('s');assert.match(h.stage(),/s_1/);h.advance(750);assert.match(h.stage(),/s_2/);
  h.control().onPointerDown(pointer(1,true));move(h,340,200,2,true);end(h,340,200,2,true);assert.equal(h.progress(),0);
  move(h,340,200,1,true);end(h,340,200,1,true,'pointercancel');assert.equal(h.progress(),0);
  const positions=[];
  for(let i=0;i<3;i++){
    positions.push(h.distraction().className.split(' ')[1]);h.control().onPointerDown(pointer(i+2,true));move(h,340,200,i+2,true);end(h,340,200,i+2,true);
    assert.ok(h.progress()<100);assert.equal(h.events.length,0);h.advance(300);
    if(i<2){h.advance(650);assert.match(h.stage(),/s_2/);}
  }
  assert.equal(new Set(positions).size,3);assert.match(h.stage(),/s_3/);assert.equal(h.progress(),100);assert.equal(h.events.length,1);h.advance(5000);assert.equal(h.distraction(),undefined);
  assert.equal(h.find(p=>typeof p.children==='string'&&/[123]\/3/.test(p.children)),undefined);
  h.reset();h.advance(750);for(let i=0;i<3;i++){h.control().onKeyDown({key:'ArrowUp',repeat:false,preventDefault(){}});h.render();h.advance(300);if(i<2)h.advance(650);}
  assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,2);assert.equal(h.events.filter(e=>e.event==='reset').length,1);h.dispose();
});

test('Shisa flight and queued next distraction are cancelled on reset and unmount',()=>{
  const h=harness('s');h.advance(750);h.control().onPointerDown(pointer());move(h,340,200);end(h,340,200);h.reset();h.advance(750);
  assert.equal(h.progress(),0);assert.match(h.distraction().className,/distraction-0/);
  h.control().onPointerDown(pointer());move(h,340,200);end(h,340,200);h.dispose();assert.equal(h.pending(),0);h.advance(2000);assert.equal(h.events.filter(e=>e.event==='reaction_complete').length,0);
});

function completeSoundRound(h,id) {
  if(id==='k') {
    h.control().onKeyDown({key:'ArrowRight',preventDefault(){}});h.advance(720);
    for(let i=0;i<5;i++)h.control().onKeyDown({key:'ArrowRight',repeat:true,preventDefault(){}});
    h.control().onKeyUp({key:'ArrowRight'});h.render();
  } else if(id==='r') {
    h.control().onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();h.advance(1200);
    assert.match(h.stage(),/r_2/);h.control().onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();
  } else if(id==='s') {
    h.advance(750);for(let i=0;i<3;i++){h.control().onKeyDown({key:'ArrowUp',repeat:false,preventDefault(){}});h.render();h.advance(300);if(i<2)h.advance(650);}
  } else {
    h.control(0).onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();assert.equal(h.audible.length%2,0);
    h.control(3).onKeyDown({key:'Enter',repeat:false,preventDefault(){}});h.render();h.advance(1200);
  }
  assert.equal(h.progress(),100);
}

test('actual shared audio hook plays each new middle/final clip once per round and reset restores them',()=>{
  for(const [id,prefix]of [['k','k'],['r','r'],['s','s'],['kani','cc']]){
    const h=harness(id);completeSoundRound(h,id);
    const pair=[`/sounds/${prefix}_1.MP3`,`/sounds/${prefix}_2.MP3`];assert.deepEqual(h.audible,pair);
    assert.equal(h.clips[0].paused,true); // Finale stops the middle clip instead of overlapping it.
    if(id==='kani'){h.rename('카니');assert.equal(h.clips.length,2);assert.equal(h.clips[1].paused,false);}
    h.advance(3000);assert.deepEqual(h.audible,pair);
    h.reset();completeSoundRound(h,id);assert.deepEqual(h.audible,[...pair,...pair]);h.dispose();assert.ok(h.clips.every(a=>a.paused));
  }
});

test('all new clips obey global mute, do not replay skipped stages on unmute, and replay after reset',()=>{
  for(const id of ['k','r','s','kani']){
    const h=harness(id,true);completeSoundRound(h,id);assert.equal(h.audible.length,0);
    h.setMuted(false);h.advance(1000);assert.equal(h.audible.length,0);
    h.reset();completeSoundRound(h,id);assert.equal(h.audible.length,2);
    h.setMuted(true);assert.ok(h.clips.every(a=>a.muted));h.dispose();
  }
});

async function flushAudio(){for(let i=0;i<12;i++)await Promise.resolve();}

test('card priming remains silent through hook mount, and automatic study audio uses the same warmed elements',async()=>{
  const h=harness('s',false,true);assert.equal(h.clips.length,2);assert.ok(h.clips.every(a=>a.volume===0));assert.equal(h.audible.length,0);
  await flushAudio();assert.ok(h.clips.every(a=>a.volume===1&&a.paused));
  completeSoundRound(h,'s');assert.deepEqual(h.audible,['/sounds/s_1.MP3','/sounds/s_2.MP3']);
  assert.equal(h.clips[0].plays,2);assert.equal(h.clips[1].plays,2);h.dispose();
});

test('pending warm-up cannot replay a stale stage after reset, unmute or component cleanup',async()=>{
  const h=harness('s',false,true,true);h.advance(750);assert.equal(h.audible.length,0);
  h.reset();h.setMuted(true);h.resolveWarm();await flushAudio();assert.equal(h.audible.length,0);
  h.advance(750);h.setMuted(false);assert.equal(h.audible.length,0);
  h.reset();h.advance(750);assert.deepEqual(h.audible,['/sounds/s_1.MP3']);h.dispose();
  const leaving=harness('s',false,true,true);leaving.advance(750);leaving.dispose();leaving.resolveWarm();await flushAudio();assert.equal(leaving.audible.length,0);assert.ok(leaving.clips.every(a=>a.paused));
});

test('Strict Mode effect replay preserves pending Safari priming and the same audio pair',async()=>{
  const h=harness('s',false,true,true);h.replayEffects();await flushAudio();assert.equal(h.clips.length,2);
  assert.ok(h.clips.every(a=>!a.paused&&a.volume===0));h.resolveWarm();await flushAudio();
  completeSoundRound(h,'s');assert.deepEqual(h.audible,['/sounds/s_1.MP3','/sounds/s_2.MP3']);assert.equal(h.clips.length,2);
  h.dispose();await flushAudio();assert.ok(h.clips.every(a=>a.paused));
});
