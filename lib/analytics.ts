import type { CharacterId } from './characters';

export const GA_MEASUREMENT_ID = 'G-TR2E2GHRDQ';
export const analyticsEnabled = process.env.NODE_ENV === 'production';

const characterNames = { c: 'chiikawa', u: 'usagi', h: 'hachiware', m: 'momonga', k: 'kurimanju', r: 'rakko', s: 'shisa', kani: 'kani' } as const;
type CharacterName = typeof characterNames[CharacterId];
type CharacterEvent = 'character_select' | 'reaction_complete' | 'reset';
type EventParameters = {
  character_select: { character: CharacterName };
  reaction_complete: { character: CharacterName };
  reset: { character: CharacterName };
  sound_toggle: { muted: boolean };
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initializeAnalytics() {
  if (!analyticsEnabled || typeof window === 'undefined' || initialized) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    window.gtag('js', new Date());
    // GA sends the real page URL, including /chiikawa-lab/, automatically.
    // In-game screen changes do not navigate; do not send another page_view.
    window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: true });
    initialized = true;
  } catch { /* Analytics must never interrupt game input. */ }
}

export function trackEvent<Name extends keyof EventParameters>(name: Name, parameters: EventParameters[Name]) {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  try {
    // Queue early interactions even if the external Google script is still loading.
    initializeAnalytics();
    window.gtag?.('event', name, parameters);
  } catch { /* Blocked or unavailable analytics must leave the game playable. */ }
}

export function trackCharacterEvent(name: CharacterEvent, character: CharacterId) {
  trackEvent(name, { character: characterNames[character] });
}
