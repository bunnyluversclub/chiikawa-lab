'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import type { Character, NewCharacterId } from '@/lib/characters';
import { characterImage } from '@/lib/character-image';
import { trackCharacterEvent } from '@/lib/analytics';
import { useStageSound } from '@/lib/use-stage-sound';
import { insideCharacter, NEW_PLAY, onDropTarget, SECRET_CHOICES, throwDirection, tiltAngle } from '@/lib/new-interactions';

type Session = { id: number; target: HTMLButtonElement; captured: boolean; x: number; y: number; centerX: number; centerY: number; itemIndex: number; lastX: number; lastY: number; lastTime: number; vx: number; vy: number };
type PointEvent = { pointerId: number; clientX: number; clientY: number; timeStamp?: number };
function eventTime(e: PointEvent) { return typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now(); }
function dropCapture(session: Session | null) {
  try { if (session?.target.hasPointerCapture(session.id)) session.target.releasePointerCapture(session.id); } catch { /* Safari may already have released it. */ }
}

export default function NewCharacterGame({character, muted = false, onBack, onDiscover}: {character: Character & {id: NewCharacterId}; muted?: boolean; onBack: () => void; onDiscover?: () => void}) {
  const [stage, setStage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [angle, setAngle] = useState(0);
  const [offset, setOffset] = useState({x: 0, y: 0});
  const [dragging, setDragging] = useState(false);
  const [activeItem, setActiveItem] = useState(0);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [flying, setFlying] = useState(false);
  const [distraction, setDistraction] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const visual = useRef<HTMLDivElement | null>(null);
  const session = useRef<Session | null>(null);
  const finished = useRef(false), consumed = useRef(false), ready = useRef(false);
  const meals = useRef(0), throwing = useRef(false);
  const eligible = useRef(false), heldMs = useRef(0), keyboardTilt = useRef(false);
  const removed = useRef(0), visibleDistraction = useRef<number | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const isTilt = character.id === 'k', isStudy = character.id === 's';
  const isSecret = character.id === 'kani';
  const displayName = isSecret ? (stage === 3 ? '카니' : '?') : character.name;
  const sound = useStageSound(character.id, muted);
  const instruction = isTilt ? '몸을 뒤로 기울여보세요!' : isStudy ? '공부에 집중할 수 있게 도와주세요!' : isSecret ? '어울리는 걸 찾아 가져다줘보세요!' : '디저트를 먹여보세요!';

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setStage(3); setProgress(1);
    sound.complete();
    if (character.id === 'kani') onDiscover?.();
    trackCharacterEvent('reaction_complete', character.id);
  }, [character.id, onDiscover]);
  function later(callback: () => void, ms: number) {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, ms);
    timers.current.add(timer);
  }
  function clearTimers() { timers.current.forEach(clearTimeout); timers.current.clear(); }
  function showDistraction(index: number | null) { visibleDistraction.current = index; setDistraction(index); }
  const releasePointer = useCallback(() => {
    const previous = session.current;
    session.current = null;
    dropCapture(previous);
    setDragging(false);
    return previous;
  }, []);
  function cancelInput() {
    releasePointer(); keyboardTilt.current = false; eligible.current = false;
    setAngle(0); if (!throwing.current) setOffset({x: 0, y: 0});
    if (isTilt && !finished.current) { heldMs.current = 0; ready.current = false; setStage(1); setProgress(0); }
  }
  useEffect(() => {
    if (isStudy) later(() => showDistraction(0), NEW_PLAY.studyStartMs);
    return () => {
      clearTimers(); dropCapture(session.current); session.current = null;
      keyboardTilt.current = false; eligible.current = false;
    };
  }, [character.id, round, isStudy]);
  useEffect(() => {
    if (!isTilt) return;
    let frame = 0, previous = 0;
    function tick(now: number) {
      if (previous && eligible.current && (session.current || keyboardTilt.current) && !ready.current && !finished.current) {
        heldMs.current += Math.min(now - previous, 50);
        setProgress(.4 + Math.min(1, heldMs.current / NEW_PLAY.tiltHoldMs) * .5);
        if (heldMs.current >= NEW_PLAY.tiltHoldMs) ready.current = true;
      }
      previous = now; frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isTilt]);

  function setTilt(nextAngle: number) {
    setAngle(nextAngle);
    if (ready.current) return;
    eligible.current = Math.abs(nextAngle) >= NEW_PLAY.tiltThreshold;
    if (eligible.current) { setStage(2); sound.enterMiddle(); }
    else { heldMs.current = 0; setStage(1); setProgress(0); }
  }
  function startStudy() {
    if (isStudy && !finished.current) { setStage(2); sound.enterMiddle(); }
  }
  function down(e: PointerEvent<HTMLButtonElement>, itemIndex = 0) {
    if (finished.current || consumed.current || throwing.current || session.current || keyboardTilt.current || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (isStudy && visibleDistraction.current !== itemIndex) return;
    const rect = visual.current?.getBoundingClientRect();
    if (isTilt && (!rect || !insideCharacter(e.clientX, e.clientY, rect))) return;
    e.preventDefault();
    const item = e.currentTarget.getBoundingClientRect();
    session.current = {id: e.pointerId, target: e.currentTarget, captured: false, x: e.clientX, y: e.clientY, centerX: item.left + item.width / 2, centerY: item.top + item.height / 2, itemIndex, lastX: e.clientX, lastY: e.clientY, lastTime: eventTime(e), vx: 0, vy: 0};
    setActiveItem(itemIndex); setDragging(true);
    sound.unlock();
    startStudy();
    try { e.currentTarget.setPointerCapture(e.pointerId); session.current.captured = true; } catch { /* Window events keep the session alive. */ }
  }
  function move(e: PointEvent) {
    const current = session.current;
    if (!current || current.id !== e.pointerId || finished.current || consumed.current) return;
    if (isTilt) setTilt(tiltAngle(e.clientX - current.x, e.clientY - current.y));
    else {
      if (isStudy) {
        const now = eventTime(e), dt = now - current.lastTime;
        const dx = e.clientX - current.lastX, dy = e.clientY - current.lastY;
        if (dt > 0 && (dx || dy)) { current.vx = dt <= 120 ? dx / dt : 0; current.vy = dt <= 120 ? dy / dt : 0; }
        else if (dt > 120) { current.vx = 0; current.vy = 0; }
        current.lastX = e.clientX; current.lastY = e.clientY; current.lastTime = now;
      }
      setOffset({x: e.clientX - current.x, y: e.clientY - current.y});
    }
  }
  function acceptItem(itemIndex = 0) {
    if (finished.current || consumed.current) return;
    if (isSecret && SECRET_CHOICES[itemIndex] !== '🦀') return;
    consumed.current = true;
    setItemAvailable(false);
    if (isSecret) { setStage(2); sound.enterMiddle(); setProgress(.6); later(finish, NEW_PLAY.revealMs); }
    else {
      meals.current += 1;
      if (meals.current === 2) finish();
      else {
        setStage(2); sound.enterMiddle(); setProgress(.5);
        later(() => { consumed.current = false; setItemAvailable(true); }, NEW_PLAY.cakeRespawnMs);
      }
    }
  }
  function tossDistraction(index: number, dx: number, dy: number, vx = 0, vy = 0) {
    if (finished.current || throwing.current || visibleDistraction.current !== index) return;
    const direction = throwDirection(dx, dy, vx, vy);
    if (!direction) { setOffset({x: 0, y: 0}); return; }
    const bounds = visual.current?.parentElement?.getBoundingClientRect();
    const distance = Math.max(bounds?.width || 760, bounds?.height || 365) * 1.5 + 100;
    throwing.current = true; setFlying(true);
    setOffset({x: dx + direction.x * distance, y: dy + direction.y * distance});
    later(() => {
      removeDistraction(index);
      throwing.current = false; setFlying(false); setOffset({x: 0, y: 0});
    }, NEW_PLAY.throwFlightMs);
  }
  function end(e: PointEvent & {type: string}) {
    const current = session.current;
    if (!current || current.id !== e.pointerId) return;
    if (e.type === 'pointercancel') { cancelInput(); return; }
    if (isTilt) {
      // A final movement away from the drinking pose must not count as a held pose.
      setTilt(tiltAngle(e.clientX - current.x, e.clientY - current.y));
      releasePointer(); eligible.current = false; setAngle(0);
      if (ready.current) finish();
      else { heldMs.current = 0; setStage(1); setProgress(0); }
    } else if (isStudy) {
      move(e);
      const dx = e.clientX - current.x, dy = e.clientY - current.y;
      releasePointer();
      tossDistraction(current.itemIndex, dx, dy, current.vx, current.vy);
    } else {
      const rect = visual.current?.getBoundingClientRect();
      const dx = e.clientX - current.x, dy = e.clientY - current.y;
      const hit = rect && Math.hypot(dx, dy) >= 10 && onDropTarget(isSecret ? 'head' : 'mouth', current.centerX + dx, current.centerY + dy, rect);
      releasePointer(); setOffset({x: 0, y: 0});
      if (hit) acceptItem(current.itemIndex);
    }
  }
  const moveRef = useRef(move), endRef = useRef(end), cancelRef = useRef(cancelInput);
  moveRef.current = move; endRef.current = end; cancelRef.current = cancelInput;
  useEffect(() => {
    const fallbackMove = (e: globalThis.PointerEvent) => {
      if (session.current?.id !== e.pointerId || session.current.captured) return;
      if (e.cancelable) e.preventDefault();
      moveRef.current(e);
    };
    const fallbackEnd = (e: globalThis.PointerEvent) => endRef.current(e);
    const hide = () => { if (document.hidden) cancelRef.current(); };
    window.addEventListener('pointermove', fallbackMove, {passive: false});
    window.addEventListener('pointerup', fallbackEnd); window.addEventListener('pointercancel', fallbackEnd);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pointermove', fallbackMove);
      window.removeEventListener('pointerup', fallbackEnd); window.removeEventListener('pointercancel', fallbackEnd);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  function removeDistraction(index: number) {
    if (finished.current || visibleDistraction.current !== index) return;
    showDistraction(null);
    removed.current += 1;
    setProgress(removed.current / 3);
    if (removed.current === 3) finish();
    else later(() => showDistraction(removed.current), NEW_PLAY.distractionGapMs);
  }
  function reset() {
    sound.reset();
    clearTimers(); releasePointer(); finished.current = false; consumed.current = false;
    ready.current = false; eligible.current = false; keyboardTilt.current = false; heldMs.current = 0; removed.current = 0;
    meals.current = 0; throwing.current = false; setFlying(false); setItemAvailable(true); setActiveItem(0);
    setStage(1); setProgress(0); setAngle(0); setOffset({x: 0, y: 0}); showDistraction(null); setRound(r => r + 1);
    trackCharacterEvent('reset', character.id);
  }
  function keyDown(e: KeyboardEvent<HTMLButtonElement>, itemIndex = 0) {
    if (finished.current || session.current) return;
    sound.unlock();
    if (isTilt && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); keyboardTilt.current = true; setDragging(true); setTilt(e.key === 'ArrowLeft' ? -35 : 35);
    } else if (!isTilt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) acceptItem(itemIndex); }
  }
  function keyUp(e: KeyboardEvent<HTMLButtonElement>) {
    if (!isTilt || !keyboardTilt.current || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    keyboardTilt.current = false; eligible.current = false; setDragging(false); setAngle(0);
    if (ready.current) finish(); else { heldMs.current = 0; setStage(1); setProgress(0); }
  }
  const pointerHandlers = {
    onPointerDown: down, onPointerMove: (e: PointerEvent<HTMLButtonElement>) => { if (session.current?.captured) move(e); },
    onPointerUp: end, onPointerCancel: end,
    onLostPointerCapture: (e: PointerEvent<HTMLButtonElement>) => { if (session.current?.id === e.pointerId) session.current.captured = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(), onDragStart: (e: React.DragEvent) => e.preventDefault(),
    onKeyDown: keyDown, onKeyUp: keyUp,
    onBlur: () => { if (keyboardTilt.current) cancelInput(); },
  };
  return <main className={`game-page new-game ${character.color}`}>
    <div className="game-navigation"><button className="back-button" onClick={onBack}>← 다른 친구 만나기</button></div>
    <div className="game-title"><h1>{displayName}</h1><p>{instruction}</p></div>
    <section className={`experiment-window ${stage === 3 ? 'complete' : ''}`} aria-label={`${displayName} 실험실`}>
      <div className="playground" key={round}>
        <span className="play-doodle pd-one" aria-hidden="true">✧</span><span className="play-doodle pd-two" aria-hidden="true">♡</span>
        <div className="speech-bubble" aria-live="polite">{isSecret ? '…' : isTilt ? stage === 3 ? '캬~' : stage === 2 ? '꿀꺽…' : '…' : isStudy ? stage === 3 ? '해냈다!' : stage === 2 ? '열공 중…' : '…' : stage === 3 ? '맛있다…!' : stage === 2 ? '냠…' : '…'}</div>
        <div ref={visual} className="character-position">
          <div className={`new-character-pose ${dragging ? 'dragging' : ''}`} style={{transform: `rotate(${angle}deg)`}}>
            <div className="character-motion">{[1,2,3].map(s => <img key={s} className={stage === s ? 'visible' : ''} src={characterImage(character, s)} alt={stage === s ? `${displayName} ${s}단계` : ''} draggable={false} style={{transform: `scale(${character.imageScale[s - 1]})`}} />)}</div>
          </div>
        </div>
        {isTilt && <button type="button" className="interaction-surface" aria-label="쿠리만쥬를 잡고 뒤로 기울여 잠시 유지한 뒤 놓기. 키보드는 좌우 화살표를 길게 누른 뒤 놓기." aria-disabled={stage === 3} {...pointerHandlers} />}
        {!isTilt && !isStudy && itemAvailable && (isSecret
          ? <div className="emoji-options" role="group" aria-label="가져다줄 이모지">{SECRET_CHOICES.map((choice, index) => <button type="button" key={choice} className={`drag-item choice-item ${dragging && activeItem === index ? 'dragging' : ''}`} style={{transform: `translate(${activeItem === index ? offset.x : 0}px, ${activeItem === index ? offset.y : 0}px)`}} aria-label={`${choice} 가져다주기. 키보드는 엔터.`} {...pointerHandlers} onPointerDown={e => down(e, index)} onKeyDown={e => keyDown(e, index)}><span aria-hidden="true">{choice}</span></button>)}</div>
          : <button type="button" className={`drag-item ${dragging ? 'dragging' : ''}`} style={{transform: `translate(${offset.x}px, ${offset.y}px)`}} aria-label="디저트 먹여주기. 키보드는 엔터." {...pointerHandlers}><span aria-hidden="true">🍰</span></button>)}
        {isStudy && distraction !== null && <button type="button" key={distraction} className={`distraction distraction-${distraction} ${dragging ? 'dragging' : ''} ${flying ? 'flying' : ''}`} style={{transform: `translate(${offset.x}px, ${offset.y}px)`}} aria-label={`방해 요소 ${['💤','📱','💭'][distraction]} 잡고 던지기. 키보드는 방향키.`} {...pointerHandlers} onPointerDown={e => down(e, distraction)} onKeyDown={e => {
          const direction = {ArrowLeft: [-120,0], ArrowRight: [120,0], ArrowUp: [0,-120], ArrowDown: [0,120]}[e.key];
          if (direction && !session.current) { e.preventDefault(); if (!e.repeat) { sound.unlock(); startStudy(); tossDistraction(distraction, direction[0], direction[1]); } }
        }}><span aria-hidden="true">{['💤','📱','💭'][distraction]}</span></button>}
        <div className="stage-ground" />
      </div>
      <div className="experiment-report"><div className="progress-caption">만지작 지수</div><div className="progress-track" role="progressbar" aria-label="실험 진행도" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{width: `${progress * 100}%`}} /></div></div>
    </section>
    <div className="game-actions"><button className="reset-button" onClick={reset}>↻ 다시 하기</button><button className="other-button" onClick={onBack}>다른 친구 선택 ↗</button></div>
  </main>;
}
