import type { Character } from './characters';
import { sitePath } from './site-path';
import type { SoundBank } from './use-sound';

export type StageAudio = { sounds: SoundBank; ready: Promise<void>; settled: boolean; primed: boolean };
let pending: { id: string; audio: StageAudio } | undefined;

function createStageAudio(character: Character, prime: boolean, muted: boolean): StageAudio {
  const sounds: SoundBank = {};
  if (character.sound) sounds.basic = new Audio(sitePath(character.sound));
  if (character.reaction) sounds.reaction = new Audio(sitePath(character.reaction));
  const audio: StageAudio = {sounds, ready: Promise.resolve(), settled: !prime || muted, primed: prime && !muted};
  const warming = Object.values(sounds).map(clip => {
    clip.preload = 'auto'; clip.load(); clip.muted = muted;
    if (!prime || muted) return Promise.resolve();
    // Called inside the card's trusted click. Warm the SAME elements later
    // used by useSound, so Safari permits timer-driven study/reveal audio.
    // volume=0 stays silent even if the hook updates muted while loading.
    clip.volume = 0; clip.muted = true;
    let started: Promise<void>;
    try { started = clip.play(); } catch { audio.primed = false; started = Promise.resolve(); }
    return Promise.resolve(started).catch(() => { audio.primed = false; }).then(() => {
      clip.pause(); clip.currentTime = 0; clip.volume = 1; clip.muted = muted;
    });
  });
  audio.ready = Promise.all(warming).then(() => { audio.settled = true; });
  return audio;
}

export function prepareStageAudio(character: Character, muted: boolean) {
  if (typeof window === 'undefined') return;
  if (pending) Object.values(pending.audio.sounds).forEach(clip => clip.pause());
  pending = { id: character.id, audio: createStageAudio(character, true, muted) };
}

export function takeStageAudio(character: Character): StageAudio {
  if (pending?.id === character.id) {
    const audio = pending.audio; pending = undefined; return audio;
  }
  return createStageAudio(character, false, false);
}
