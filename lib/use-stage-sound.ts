'use client';
import { useCallback, useEffect, useRef } from 'react';
import { CHARACTERS, type NewCharacterId } from './characters';
import { takeStageAudio, primeStageAudio, type StageAudio } from './prepare-stage-audio';
import { useSound } from './use-sound';

export function useStageSound(id: NewCharacterId, muted: boolean) {
  // Display names can change on discovery. Keep the audio definition stable.
  const definition = CHARACTERS.find(character => character.id === id)!;
  const bank = useRef<StageAudio | null>(null);
  const supply = useCallback(() => { bank.current ??= takeStageAudio(definition); return bank.current.sounds; }, [definition]);
  const {play, stop} = useSound(definition, muted, supply);
  const middle = useRef(false), final = useRef(false), generation = useRef(0);
  const mute = useRef(muted); mute.current = muted;

  function request(kind: 'basic' | 'reaction') {
    if (mute.current) return;
    const round = generation.current;
    const deliver = () => { if (round === generation.current && !mute.current && (kind === 'reaction' || !final.current)) play(kind); };
    if (bank.current?.settled) deliver();
    else void bank.current?.ready.then(deliver);
  }
  function enterMiddle() { if (!middle.current) { middle.current = true; request('basic'); } }
  function complete() { if (!final.current) { final.current = true; request('reaction'); } }
  function reset() { generation.current++; middle.current = false; final.current = false; stop(); }
  function unlockInput() {
    if (!mute.current && bank.current) primeStageAudio(bank.current);
  }
  useEffect(() => () => {
    generation.current++;
    if (bank.current?.settled) Object.values(bank.current.sounds).forEach(clip => clip.pause());
  }, []);
  return {enterMiddle, complete, reset, unlock: unlockInput};
}
