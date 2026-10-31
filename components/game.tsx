'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { GAME, type Character } from '@/lib/characters';
import { useSound } from '@/lib/use-sound';
import { sitePath } from '@/lib/site-path';
export default function Game({character, muted, onBack}: {character: Character; muted: boolean; onBack: () => void}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [offset, setOffset] = useState(0);
  const [round, setRound] = useState(0);
  const [landed, setLanded] = useState(false);
  const [tapPulse, setTapPulse] = useState(0);
  const strokeStartY = useRef(0), extremeY = useRef(0);
  const visual = useRef<HTMLDivElement | null>(null);
  const lastY = useRef(0), originY = useRef(0), rubDistance = useRef(0);
  const tapStarted = useRef(0), tapMovement = useRef(0);
  const value = useRef(0), finished = useRef(false), active = useRef(false);
  const pointer = useRef<number | null>(null), lastX = useRef(0), originX = useRef(0);
  const captureTarget = useRef<HTMLButtonElement | null>(null);
  const captured = useRef(false);
  const direction = useRef(0), unlocked = useRef(false);
  const {play, stop, unlock} = useSound(character, muted);
  const isC = character.id === 'c';
  const isU = character.id === 'u', isH = character.id === 'h', isM = character.id === 'm';
  const stage = progress >= 1 ? 3 : progress >= GAME.stageTwo ? 2 : 1;
  const add = useCallback((amount: number) => {
    if (finished.current) return;
    value.current = Math.min(1, value.current + amount);
    if (value.current >= 1) { finished.current = true; active.current = false; setHolding(false); setOffset(0); play('reaction'); }
    setProgress(value.current);
  }, [play]);
  useEffect(() => {
    if (!isC) return;
    let frame: number, previous = 0;
    const tick = (now: number) => { if (previous && active.current && !finished.current) add(Math.min(now - previous, 50) / GAME.holdMs); previous = now; frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isC, add]);
  const release = useCallback(() => {
    const id = pointer.current;
    const target = captureTarget.current;
    active.current = false;
    pointer.current = null;
    captured.current = false;
    captureTarget.current = null;
    if (id !== null && target?.hasPointerCapture(id)) {
      try { target.releasePointerCapture(id); } catch { /* The OS may already have cancelled it. */ }
    }
    setHolding(false);
    setOffset(0);
  }, []);
  useEffect(() => {
    const visibility = () => { if (document.hidden) release(); };
    const blur = () => { if (pointer.current === null) release(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [release]);
  function prepareSound() { if (!unlocked.current && !muted) { unlock(); unlocked.current = true; } }
  function inHead(x: number, y: number, tracking = false) {
    const rect = visual.current?.getBoundingClientRect();
    if (!rect) return false;
    const margin = tracking ? .25 : 0;
    return x >= rect.left + rect.width * (.08 - margin) && x <= rect.right - rect.width * (.08 - margin)
      && y >= rect.top - rect.height * margin && y <= rect.top + rect.height * (tracking ? .74 : .64);
  }
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (finished.current || pointer.current !== null || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (isH && !inHead(e.clientX, e.clientY)) return;
    if (isU) {
      const rect = visual.current?.getBoundingClientRect();
      if (!rect || e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    }
    e.preventDefault();
    // Start the session before capture/audio. Neither a capture exception nor
    // mobile button focus changes should prevent the hold timer from running.
    pointer.current = e.pointerId;
    captureTarget.current = e.currentTarget;
    lastX.current = originX.current = e.clientX;
    lastY.current = originY.current = e.clientY;
    rubDistance.current = 0;
    if (isM) { tapStarted.current = Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now(); tapMovement.current = 0; setTapPulse(p => p + 1); }
    if (isU) { strokeStartY.current = extremeY.current = e.clientY; }
    direction.current = 0;
    active.current = true;
    setHolding(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); captured.current = true; }
    catch { captured.current = false; } // Window Pointer Events continue the same session.
    prepareSound();
    if (isC || isM) play('basic');
  }
  function move(e: Pick<PointerEvent<HTMLButtonElement>, 'pointerId' | 'clientX' | 'clientY'>) {
    if (isC || !active.current || finished.current || pointer.current !== e.pointerId) return;
    if (isM) {
      tapMovement.current = Math.max(tapMovement.current, Math.hypot(e.clientX - originX.current, e.clientY - originY.current));
      return;
    }
    if (isH) {
      const dx = e.clientX - lastX.current, dy = e.clientY - lastY.current;
      lastX.current = e.clientX; lastY.current = e.clientY;
      if (!inHead(e.clientX, e.clientY, true) || Math.abs(dx) < 3 || Math.abs(dx) < Math.abs(dy)) return;
      rubDistance.current += Math.min(Math.abs(dx), 45);
      if (rubDistance.current >= GAME.strokeStep) {
        const distance = rubDistance.current; rubDistance.current = 0;
        add(distance / GAME.strokeDistance);
        if (!finished.current) play('basic');
      }
      return;
    }
    if (isU) {
      const dx = e.clientX - lastX.current, dy = e.clientY - lastY.current;
      lastX.current = e.clientX; lastY.current = e.clientY;
      if (Math.abs(dy) < Math.abs(dx)) {
        // Horizontal strokes cannot accumulate hidden vertical credit.
        if (Math.abs(dx) > 8) { direction.current = 0; strokeStartY.current = extremeY.current = e.clientY; }
        return;
      }
      setOffset(Math.max(-60, Math.min(20, (e.clientY - originY.current) * (stage === 2 ? .64 : .48))));
      if (!direction.current) {
        const distance = e.clientY - strokeStartY.current;
        if (Math.abs(distance) >= GAME.minimumStroke) { direction.current = Math.sign(distance); extremeY.current = e.clientY; }
      } else if ((e.clientY - extremeY.current) * direction.current >= 0) {
        extremeY.current = e.clientY;
      } else if (Math.abs(e.clientY - extremeY.current) >= GAME.minimumStroke) {
        // Require a full reversal from the extremum, not tiny event-to-event jitter.
        const distance = Math.min(Math.abs(extremeY.current - strokeStartY.current), 180);
        strokeStartY.current = extremeY.current;
        extremeY.current = e.clientY;
        direction.current *= -1;
        add(distance / GAME.shakeDistance);
        if (!finished.current) play('basic');
      }
    }
  }
  const moveRef = useRef(move);
  moveRef.current = move;
  const endPointerRef = useRef(endPointer);
  endPointerRef.current = endPointer;
  useEffect(() => {
    const fallbackMove = (e: globalThis.PointerEvent) => {
      if (pointer.current !== e.pointerId || !active.current || captured.current) return;
      if (e.cancelable) e.preventDefault();
      moveRef.current(e);
    };
    const end = (e: globalThis.PointerEvent) => endPointerRef.current(e);
    window.addEventListener('pointermove', fallbackMove, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', fallbackMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [release]);
  function endPointer(e: Pick<PointerEvent<HTMLButtonElement>, 'pointerId' | 'type' | 'timeStamp' | 'clientX' | 'clientY'>) {
    if (pointer.current !== e.pointerId) return;
    if (isM && e.type === 'pointerup') {
      const endTime = Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
      const endMovement = typeof e.clientX === 'number' && typeof e.clientY === 'number'
        ? Math.hypot(e.clientX - originX.current, e.clientY - originY.current) : 0;
      if (endTime - tapStarted.current <= GAME.tapMaxMs && Math.max(tapMovement.current, endMovement) <= GAME.tapSlop) add(1 / GAME.tapCount);
    }
    release();
  }
  function reset() { release(); stop(); value.current = 0; finished.current = false; direction.current = 0; setProgress(0); setLanded(false); setTapPulse(0); strokeStartY.current = 0; extremeY.current = 0; rubDistance.current = 0; tapMovement.current = 0; setRound(r => r + 1); }
  function keyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (finished.current) return;
    if (isC && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!active.current) { prepareSound(); active.current = true; setHolding(true); play('basic'); } }
    if (isM && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      if (!e.repeat) { prepareSound(); setTapPulse(p => p + 1); play('basic'); add(1 / GAME.tapCount); }
    }
    if (isU && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (!e.repeat) {
        prepareSound(); const d = e.key === 'ArrowUp' ? -1 : 1;
        if (direction.current && d !== direction.current) { add(110 / GAME.shakeDistance); if (!finished.current) play('basic'); }
        direction.current = d; if (!finished.current) setOffset(d * 20);
      }
    }
    if (isH && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); prepareSound(); const d = e.key === 'ArrowLeft' ? -1 : 1; if (direction.current && d !== direction.current) { add(110 / GAME.strokeDistance); play('basic'); } direction.current = d; }
  }
  return <main className={`game-page ${character.color}`}>
    <div className="game-navigation"><button className="back-button" onClick={() => { stop(); onBack(); }}>← 다른 친구 만나기</button></div>
    <div className="game-title"><h1>{character.name}</h1><p>{isC ? '꾹 눌러보세요!' : isU ? '위아래로 흔들어보세요' : isH ? '머리를 좌우로 쓰다듬어보세요!' : '콕콕 눌러보세요!'}</p></div>
    <section className={`experiment-window ${progress >= 1 ? 'complete' : ''}`} data-landed={landed || undefined} aria-label={`${character.name} 실험실`}>
      <div className={`playground ${progress >= 1 && isC ? 'flooded' : ''}`} key={round}>
        <span className="play-doodle pd-one">✧</span><span className="play-doodle pd-two">♡</span>
        <div className="speech-bubble" aria-live="polite">{progress >= 1 ? (isC ? '으아아아앙—!' : isU ? '우라야하—!!' : isH ? '복슬복슬!' : '저리가!') : stage === 2 ? (isC ? '후에엥…' : isU ? '호… 호잇…' : isH ? '보송보송…' : '더?') : isC ? '…응?' : isU ? '얏하!' : isH ? '응?' : '흥!'}</div>
        <div ref={visual} className={`character-position ${progress >= 1 ? isC ? 'floating' : isU ? 'launch' : isH ? 'fur-finale' : 'momonga-finale' : ''}`} onAnimationEnd={e => { if (e.animationName === 'launch-drop') setLanded(true); }}>
          <div className={`character-touch ${holding ? 'held' : ''} ${stage === 2 ? 'nervous' : ''}`} style={{transform: isU ? `translateY(${offset}px) scale(${offset < 0 ? '.97,1.04' : offset > 0 ? '1.05,.94' : '1'})` : `translateX(${offset}px) rotate(${isC ? 0 : offset * 0.16}deg)`}}>
            {isH || isM ? <div key={isM ? `${round}-${tapPulse}` : stage} className={isM && tapPulse > 0 ? 'new-character-motion tap-bounce' : isH ? 'new-character-motion fur-step' : 'new-character-motion'}>
              <div className="character-motion">{[1,2,3].map(s => <img key={s} className={stage === s ? 'visible' : ''} src={sitePath(`/images/${character.id}_${s}.png`)} alt={stage === s ? `${character.name} ${s}단계` : ''} draggable={false} style={{transform: `scale(${character.imageScale[s - 1]})`}} />)}</div>
            </div> : <div className="character-motion">{[1,2,3].map(s => <img key={s} className={stage === s ? 'visible' : ''} src={sitePath(`/images/${character.id}_${s}.png`)} alt={stage === s ? `${character.name} ${s}단계` : ''} draggable={false} style={{transform: `scale(${character.imageScale[s - 1]})`}} />)}</div>}
          </div>
        </div>
        <button type="button" className="interaction-surface"
          aria-label={isC ? '치이카와를 길게 누르기. 키보드는 스페이스 또는 엔터.' : isU ? '우사기를 잡고 위아래로 계속 흔들기. 키보드는 위아래 화살표 번갈아 누르기.' : isH ? '하치와레 머리를 좌우로 쓰다듬기. 키보드는 좌우 화살표 번갈아 누르기.' : '모몽가를 콕콕 누르기. 키보드는 스페이스 또는 엔터.'}
          aria-disabled={progress >= 1}
          onPointerDown={down} onPointerMove={e => { if (captured.current) move(e); }} onPointerUp={endPointer} onPointerCancel={endPointer}
          onLostPointerCapture={e => { if (pointer.current === e.pointerId) captured.current = false; }}
          onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}
          onKeyDown={keyDown}
          onKeyUp={e => { if (isC && (e.key === ' ' || e.key === 'Enter')) release(); else if (!isC) setOffset(0); }}
          onBlur={() => { if (pointer.current === null) release(); }}
        />
        <div className="stage-ground" />
        {stage >= 2 && isC && <div className={`tears ${progress >= 1 ? 'many-tears' : ''}`} aria-hidden="true">{Array.from({length: progress >= 1 ? 18 : 4}, (_, i) => <i key={i} style={{left: `${10 + (i * 19) % 80}%`, animationDelay: `${(i * .17) % 1.5}s`, animationDuration: `${.7 + i % 3 * .2}s`}} />)}</div>}
        {progress >= 1 && isC && <div className="flood" aria-hidden="true"><span>○</span><span>◦</span><span>○</span><span>◦</span></div>}

      </div>
      <div className="experiment-report">
        <div className="progress-caption">만지작 지수</div>
        <div className="progress-track" role="progressbar" aria-label="실험 진행도" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{width: `${progress * 100}%`, transition: isC ? 'none' : undefined}} />
        </div>
      </div>
    </section>
    <div className="game-actions"><button className="reset-button" onClick={reset}>↻ 다시 하기</button><button className="other-button" onClick={() => { stop(); onBack(); }}>다른 친구 선택 ↗</button></div>
  </main>;
}
