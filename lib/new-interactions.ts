export const NEW_PLAY = { tiltThreshold: 24, tiltHoldMs: 650, revealMs: 1100, cakeRespawnMs: 650, studyStartMs: 700, distractionGapMs: 600, throwFlightMs: 280, throwDistance: 72, flickDistance: 24, flickSpeed: .3 };
export const SECRET_CHOICES = ['🐰', '🐱', '🐻', '🦀', '🐹'] as const;

export function throwDirection(dx: number, dy: number, vx: number, vy: number) {
  const distance = Math.hypot(dx, dy), speed = Math.hypot(vx, vy);
  if (distance < NEW_PLAY.flickDistance || (distance < NEW_PLAY.throwDistance && speed < NEW_PLAY.flickSpeed)) return null;
  const x = speed >= NEW_PLAY.flickSpeed ? vx : dx, y = speed >= NEW_PLAY.flickSpeed ? vy : dy;
  const length = Math.hypot(x, y);
  return {x: x / length, y: y / length};
}

export function tiltAngle(dx: number, dy: number) {
  return Math.max(-48, Math.min(48, dx * .55 - dy * .35));
}

type Bounds = { left: number; top: number; width: number; height: number };
export function insideCharacter(x: number, y: number, rect: Bounds) {
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}

export function onDropTarget(kind: 'mouth' | 'head', x: number, y: number, rect: Bounds) {
  const centerX = rect.left + rect.width * .5;
  const centerY = rect.top + rect.height * (kind === 'mouth' ? .51 : .22);
  return Math.abs(x - centerX) <= rect.width * .28 && Math.abs(y - centerY) <= rect.height * .2;
}
