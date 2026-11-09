const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');

test('original four useSound callers retain their default paths, cooldown, no-overlap, reset and mute behavior',()=>{
  for(const id of ['c','u','h','m']){
    let cursor=0,now=0,muted=false;
    const slots=[],effects=[],clips=[],audible=[];
    const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
    const react={
      useRef(value){const i=cursor++;return slots[i]??={current:value};},
      useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
      useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
    };
    class Audio {
      constructor(src){this.src=src;this.paused=true;this.muted=false;this.currentTime=0;this.loads=0;clips.push(this);}
      load(){this.loads++;} pause(){this.paused=true;}
      play(){this.paused=false;if(!this.muted)audible.push(this.src);return Promise.resolve();}
    }
    function load(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n]??require(n),Audio,process:{env:{}},performance:{now:()=>now}});return exports;}
    const data=load('lib/characters.ts'),paths=load('lib/site-path.ts');
    const {useSound}=load('lib/use-sound.ts',{react,'./characters':data,'./site-path':paths});
    const character=data.CHARACTERS.find(c=>c.id===id);
    let sound;
    function render(){cursor=0;sound=useSound(character,muted);while(effects.length)effects.shift()();}
    render();assert.equal(clips.length,2);assert.ok(clips.every(a=>a.loads===1));
    sound.play('basic');sound.play('basic');now=1000;sound.play('basic');assert.deepEqual(audible,[character.sound]);
    sound.play('reaction');assert.equal(clips[0].paused,true);assert.equal(audible[1],character.reaction);
    sound.stop();assert.ok(clips.every(a=>a.paused&&a.currentTime===0));sound.play('basic');assert.equal(audible.length,3);
    muted=true;render();sound.play('reaction');assert.equal(audible.length,3);assert.ok(clips.every(a=>a.muted));assert.equal(clips.length,2);
    slots.forEach(slot=>slot?.cleanup?.());assert.ok(clips.every(a=>a.paused));
  }
});
