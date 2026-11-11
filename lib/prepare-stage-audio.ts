import type { Character } from './characters';
import { sitePath } from './site-path';
import type { SoundBank } from './use-sound';

export type StageAudio = { sounds: SoundBank; sources: SoundBankSources; ready: Promise<void>; settled: boolean; primed: boolean };
type SoundBankSources = Partial<Record<keyof SoundBank, string>>;
let pending: { id: string; audio: StageAudio } | undefined;

// 10ms of zero-valued PCM. Unlock the SAME media elements with actual silence,
// never a reaction MP3: iOS ignores volume=0, and React may update muted while
// play() is pending. Even an unmuted warm-up therefore cannot reveal a sound.
const SILENCE = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function primeStageAudio(audio: StageAudio) {
  if (!audio.settled || audio.primed) return;
  audio.settled = false; audio.primed = true;
  const warming = Object.entries(audio.sounds).map(([kind, clip]) => {
    clip.pause(); clip.src = SILENCE; clip.load(); clip.muted = false;
    let started: Promise<void>;
    try { started = clip.play(); }
    catch { audio.primed = false; started = Promise.resolve(); }
    return Promise.resolve(started).catch(() => { audio.primed = false; }).then(() => {
      clip.pause(); clip.muted = true;
      clip.src = audio.sources[kind as keyof SoundBank]!;
      clip.load();
    });
  });
  audio.ready = Promise.all(warming).then(() => { audio.settled = true; });
}

function createStageAudio(character: Character): StageAudio {
  const sounds: SoundBank = {}, sources: SoundBankSources = {};
  if (character.sound) sources.basic = sitePath(character.sound);
  if (character.reaction) sources.reaction = sitePath(character.reaction);
  for (const [kind, src] of Object.entries(sources)) {
    const clip = new Audio(src); clip.preload = 'auto'; clip.muted = true; clip.load();
    sounds[kind as keyof SoundBank] = clip;
  }
  return {sounds, sources, ready: Promise.resolve(), settled: true, primed: false};
}

export function prepareStageAudio(character: Character, muted: boolean) {
  if (typeof window === 'undefined') return;
  if (pending) Object.values(pending.audio.sounds).forEach(clip => clip.pause());
  const audio = createStageAudio(character);
  if (!muted) primeStageAudio(audio);
  pending = { id: character.id, audio };
}

export function takeStageAudio(character: Character): StageAudio {
  if (pending?.id === character.id) {
    const audio = pending.audio; pending = undefined; return audio;
  }
  return createStageAudio(character);
}
