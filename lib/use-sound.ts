'use client';
import { useCallback, useEffect, useRef } from 'react';
import { GAME, type Character } from './characters';
import { sitePath } from './site-path';

type SoundKind = 'basic' | 'reaction';
export type SoundBank = Partial<Record<SoundKind, HTMLAudioElement>>;
export function useSound(character: Character, muted: boolean, preparedSounds?: () => SoundBank) {
  const audio = useRef<Partial<Record<SoundKind, HTMLAudioElement>> | null>(null);
  const last = useRef(-Infinity);
  const muteRef = useRef(muted);
  muteRef.current = muted;

  useEffect(() => {
    const sounds: SoundBank = preparedSounds ? preparedSounds() : {};
    if (!preparedSounds) {
      if (character.sound) sounds.basic = new Audio(sitePath(character.sound));
      if (character.reaction) sounds.reaction = new Audio(sitePath(character.reaction));
      Object.values(sounds).forEach(a => { a.preload = 'auto'; a.load(); });
    }
    audio.current = sounds;
    return () => {
      if (preparedSounds) {
        audio.current = null;
        // A Strict Mode setup replay reuses the warmed elements immediately.
        // Do not abort their pending Safari priming during that replay.
        queueMicrotask(() => { if (audio.current !== sounds) Object.values(sounds).forEach(a => a.pause()); });
      } else { Object.values(sounds).forEach(a => a.pause()); audio.current = null; }
    };
  }, [character, preparedSounds]);

  useEffect(() => {
    if (audio.current) Object.values(audio.current).forEach(a => { a.muted = muted; });
  }, [muted]);

  const stop = useCallback(() => {
    if (audio.current) Object.values(audio.current).forEach(a => { a.pause(); a.currentTime = 0; });
    last.current = -Infinity;
  }, []);

  // Safari needs BOTH elements primed during pointerdown/keydown. Usagi's
  // first audible playback happens later, inside a pointermove event.
  const unlock = useCallback(() => {
    if (!audio.current || muteRef.current) return;
    Object.values(audio.current).forEach(a => {
      a.muted = true;
      void a.play().then(() => {
        // A real play() can already have started (Chiikawa on pointerdown).
        // Never pause or rewind that playback when the priming promise resolves.
        if (a.muted) { a.pause(); a.currentTime = 0; a.muted = muteRef.current; }
      }).catch(() => { a.muted = muteRef.current; });
    });
  }, []);

  const play = useCallback((kind: SoundKind) => {
    const sounds = audio.current;
    const a = sounds?.[kind];
    if (!sounds || !a || muteRef.current) return;
    if (kind === 'basic') {
      if (sounds.reaction && !sounds.reaction.paused && !sounds.reaction.muted) return;
      if (performance.now() - last.current < GAME.soundGapMs) return;
      // Let the existing clip speak: repeated shakes must not continually
      // rewind it before its audible portion. A single element prevents overlap.
      if (!a.paused && !a.ended && !a.muted) return;
      last.current = performance.now();
    } else {
      sounds.basic?.pause();
    }
    a.muted = false;
    a.currentTime = 0;
    void a.play().catch(() => {
      if (kind === 'basic') last.current = -Infinity;
    });
  }, []);

  return { play, stop, unlock };
}
