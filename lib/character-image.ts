import type { Character } from './characters';
import { sitePath } from './site-path';

export function characterImage(character: Character, stage: number) {
  return sitePath(`/images/${character.imagePrefix || character.id}_${stage}.png`);
}
