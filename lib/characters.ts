export type CharacterId = 'c' | 'h' | 'u' | 'm';
export type Character = { id: CharacterId; name: string; english: string; interaction: string; description: string; available: boolean; color: string; displayScale: number; sound?: string; reaction?: string; imageScale: [number, number, number] };
export const CHARACTERS: Character[] = [
  { id: 'c', name: '치이카와', english: 'CHIIKAWA', interaction: '꾹 눌러보기', description: '작은 볼에 숨겨진 커다란 비밀', available: true, color: 'pink', displayScale: 1, sound: '/sounds/c_1.mp3', reaction: '/sounds/c_reaction.mp3.MP3', imageScale: [1, 1, 1] },
  { id: 'u', name: '우사기', english: 'USAGI', interaction: '흔들어보기', description: '통통, 어디까지 올라가는 거야?', available: true, color: 'yellow', displayScale: 1.28, sound: '/sounds/u_1.mp3', reaction: '/sounds/u_reaction.mp3.MP3', imageScale: [1.1, 1.1, 1.18] },
  { id: 'h', name: '하치와레', english: 'HACHIWARE', interaction: '쓰다듬어보기', description: '쓰다듬을수록 복슬복슬해져요', available: true, color: 'blue', displayScale: 0.98, sound: '/sounds/h_1.mp3', reaction: '/sounds/h_reaction.MP3', imageScale: [1, 1.04, 1.1] },
  { id: 'm', name: '모몽가', english: 'MOMONGA', interaction: '콕콕 눌러보기', description: '콕콕, 어디까지 부풀어 오를까?', available: true, color: 'lavender', displayScale: 0.88, sound: '/sounds/m_1.mp3', reaction: '/sounds/m_reaction.MP3', imageScale: [1, 1.1, 1.08] },
];
export const GAME = { holdMs: 3500, stageTwo: 0.43, shakeDistance: 1000, minimumStroke: 28, soundGapMs: 380, strokeDistance: 1800, strokeStep: 14, tapCount: 18, tapMaxMs: 350, tapSlop: 18 };
