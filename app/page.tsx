'use client';

import { useEffect, useState } from 'react';
import { CHARACTERS, isNewCharacter, type Character } from '@/lib/characters';
import Game from '@/components/game';
import NewCharacterGame from '@/components/new-character-game';
import { characterImage } from '@/lib/character-image';
import { sitePath } from '@/lib/site-path';
import { trackCharacterEvent, trackEvent } from '@/lib/analytics';
import { prepareStageAudio } from '@/lib/prepare-stage-audio';

const KANI_DISCOVERY_KEY = 'touch-lab-kani-discovered';

export default function Home() {
  const [selected, setSelected] = useState<Character | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try { setMuted(localStorage.getItem('touch-lab-muted') === 'true'); }
    catch { /* Storage may be blocked in private browsing. */ }
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [selected]);

  function discoverKani() {
    try { localStorage.setItem(KANI_DISCOVERY_KEY, 'true'); }
    catch { /* Discovery storage is optional; the name is controlled by stage. */ }
  }

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    try { localStorage.setItem('touch-lab-muted', String(nextMuted)); }
    catch { /* In-memory mute still works. */ }
    // Keep event delivery outside state updaters, which React may replay.
    trackEvent('sound_toggle', { muted: nextMuted });
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a href={sitePath('/')} className="wordmark" aria-label="치이카와 만지작 연구소 홈">
          <span className="logo-flower" aria-hidden="true">✿</span> 만지작 연구소
        </a>
        <button className="sound-button" onClick={toggleMute}
          aria-label={muted ? '소리 켜기' : '소리 끄기'} aria-pressed={muted}>
          {muted ? '♪ 소리 꺼짐' : '♫ 소리 켜짐'}
        </button>
      </header>

      {selected ? (
        isNewCharacter(selected)
          ? <NewCharacterGame key={selected.id} character={selected} muted={muted} onBack={() => setSelected(null)} onDiscover={discoverKani} />
          : <Game key={selected.id} character={selected} muted={muted} onBack={() => setSelected(null)} />
      ) : (
        <main className="home">
          <section className="hero" aria-label="치이카와 만지작 연구소">
            <span className="hero-star star-left" aria-hidden="true">✧</span>
            <span className="hero-heart" aria-hidden="true">♡</span>
            <h1>치이카와<br /><span>만지작 연구소</span></h1>
            <div className="hero-note">
              너무 많이 만지지 마세요<span>!</span>
              <svg viewBox="0 0 170 10" aria-hidden="true"><path d="M3 7 Q80 -2 167 6" /></svg>
            </div>
            <span className="hero-star star-right" aria-hidden="true">✦</span>
          </section>

          <section className="selection" aria-labelledby="friend-heading">
            <div className="section-heading">
              <h2 id="friend-heading">오늘은 누구랑 놀까요<span aria-hidden="true">?</span></h2>
              
            </div>
            <div className="character-grid">
              {CHARACTERS.map(ch => (
                <button key={ch.id} className={`character-card ${ch.color} ${!ch.available ? 'coming' : ''}`}
                  disabled={!ch.available} onClick={() => { if (isNewCharacter(ch)) prepareStageAudio(ch, muted); setSelected(ch); trackCharacterEvent('character_select', ch.id); }}
                  aria-label={`${ch.name} ${ch.available ? '실험 시작' : '준비 중'}`}>
                  <div className="portrait">
                    <span className="portrait-doodle doodle-one" aria-hidden="true">{ch.id === 'c' || ch.id === 'h' ? '♡' : '✧'}</span>
                    <div className="portrait-sprite" style={{ transform: `scale(${ch.displayScale})` }}>
                      <img src={characterImage(ch, 1)} alt={ch.name} draggable={false} />
                    </div>
                    <span className="portrait-doodle doodle-two" aria-hidden="true">{ch.id === 'u' ? '〰' : '✧'}</span>
                    <div className="ground" />
                  </div>
                  <div className="card-details">
                    <h3>{ch.name}</h3>
                    {ch.available && <p>{ch.description}</p>}
                    <span className="card-cta">
                      {ch.available
                        ? `${ch.id === 'u' ? '↕ ' : ch.id === 'h' ? '↔ ' : ch.id === 'k' ? '↶ ' : ''}${ch.interaction}${ch.id === 'c' || ch.id === 'm' || ch.id === 'r' || ch.id === 's' || ch.id === 'kani' ? ' →' : ''}`
                        : '준비 중'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </main>
      )}

      <footer>비공식 팬 게임</footer>
    </div>
  );
}
