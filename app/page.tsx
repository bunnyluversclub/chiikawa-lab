'use client';

import { useEffect, useState } from 'react';
import { CHARACTERS, type Character } from '@/lib/characters';
import Game from '@/components/game';
import { sitePath } from '@/lib/site-path';

export default function Home() {
  const [selected, setSelected] = useState<Character | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try { setMuted(localStorage.getItem('touch-lab-muted') === 'true'); }
    catch { /* Storage may be blocked in private browsing. */ }
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [selected]);

  function toggleMute() {
    setMuted(m => {
      try { localStorage.setItem('touch-lab-muted', String(!m)); }
      catch { /* In-memory mute still works. */ }
      return !m;
    });
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
        <Game key={selected.id} character={selected} muted={muted} onBack={() => setSelected(null)} />
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
                  disabled={!ch.available} onClick={() => setSelected(ch)}
                  aria-label={`${ch.name} ${ch.available ? '실험 시작' : '준비 중'}`}>
                  <div className="portrait">
                    <span className="portrait-doodle doodle-one" aria-hidden="true">{ch.id === 'c' || ch.id === 'h' ? '♡' : '✧'}</span>
                    <div className="portrait-sprite" style={{ transform: `scale(${ch.displayScale})` }}>
                      <img src={sitePath(`/images/${ch.id}_1.png`)} alt={ch.name} draggable={false} />
                    </div>
                    <span className="portrait-doodle doodle-two" aria-hidden="true">{ch.id === 'u' ? '〰' : '✧'}</span>
                    <div className="ground" />
                  </div>
                  <div className="card-details">
                    <h3>{ch.name}</h3>
                    {ch.available && <p>{ch.description}</p>}
                    <span className="card-cta">
                      {ch.available
                        ? `${ch.id === 'u' ? '↕ ' : ch.id === 'h' ? '↔ ' : ''}${ch.interaction}${ch.id === 'c' || ch.id === 'm' ? ' →' : ''}`
                        : '준비 중'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="upcoming-friends" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading">다음 연구 대상은...?</h2>
            <div className="upcoming-lineup">
              {[{id: 'k', name: '쿠리만쥬'}, {id: 'r', name: '랏코'}].map(friend => (
                <figure className="upcoming-friend" key={friend.id}>
                  <img src={sitePath(`/images/${friend.id}_1.png`)} alt={friend.name} width={140} height={140} loading="lazy" draggable={false} />
                  <figcaption>
                    <span className="upcoming-name">{friend.name}</span>
                    <span className="upcoming-status">준비 중</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        </main>
      )}

      <footer>비공식 팬 게임</footer>
    </div>
  );
}
