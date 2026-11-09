export type NewCharacterId = 'k' | 'r' | 's' | 'kani';
export type CharacterId = 'c' | 'h' | 'u' | 'm' | NewCharacterId;
export type Character = { id: CharacterId; name: string; english: string; interaction: string; description: string; available: boolean; color: string; displayScale: number; sound?: string; reaction?: string; imagePrefix?: string; imageScale: [number, number, number] };
export function isNewCharacter(character: Character): character is Character & {id: NewCharacterId} {
  return character.id === 'k' || character.id === 'r' || character.id === 's' || character.id === 'kani';
}
export const CHARACTERS: Character[] = [
  { id: 'c', name: '치이카와', english: 'CHIIKAWA', interaction: '꾹 눌러보기', description: '작은 볼에 숨겨진 커다란 비밀', available: true, color: 'pink', displayScale: 1, sound: '/sounds/c_1.mp3', reaction: '/sounds/c_reaction.mp3.MP3', imageScale: [1, 1, 1] },
  { id: 'u', name: '우사기', english: 'USAGI', interaction: '흔들어보기', description: '통통, 어디까지 올라가는 거야?', available: true, color: 'yellow', displayScale: 1.28, sound: '/sounds/u_1.mp3', reaction: '/sounds/u_reaction.mp3.MP3', imageScale: [1.1, 1.1, 1.18] },
  { id: 'h', name: '하치와레', english: 'HACHIWARE', interaction: '쓰다듬어보기', description: '쓰다듬을수록 복슬복슬해져요', available: true, color: 'blue', displayScale: 0.98, sound: '/sounds/h_1.mp3', reaction: '/sounds/h_reaction.MP3', imageScale: [1, 1.04, 1.1] },
  { id: 'm', name: '모몽가', english: 'MOMONGA', interaction: '콕콕 눌러보기', description: '콕콕, 어디까지 부풀어 오를까?', available: true, color: 'lavender', displayScale: 0.88, sound: '/sounds/m_1.mp3', reaction: '/sounds/m_reaction.MP3', imageScale: [1, 1.1, 1.08] },
  { id: 'k', name: '쿠리만쥬', english: 'KURIMANJU', interaction: '기울여보기', description: '몸을 뒤로 기울여보세요!', available: true, color: 'custard', displayScale: .94, sound: '/sounds/k_1.MP3', reaction: '/sounds/k_2.MP3', imageScale: [.9, 1.8, 1.03] },
  { id: 'r', name: '랏코', english: 'RAKKO', interaction: '먹여보기', description: '디저트를 먹여보세요!', available: true, color: 'mist-blue', displayScale: .95, sound: '/sounds/r_1.MP3', reaction: '/sounds/r_2.MP3', imageScale: [.95, .9, .9] },
  { id: 's', name: '시사', english: 'SHISA', interaction: '집중 도와주기', description: '공부에 집중할 수 있도록', available: true, color: 'apricot', displayScale: 1.25, sound: '/sounds/s_1.MP3', reaction: '/sounds/s_2.MP3', imageScale: [1.22, .92, 1.4] },
  { id: 'kani', name: '?', english: '?', interaction: '가져다주기', description: '어울리는 걸 찾아주세요!', available: true, color: 'rose', displayScale: 1.45, imagePrefix: 'cc', sound: '/sounds/cc_1.MP3', reaction: '/sounds/cc_2.MP3', imageScale: [1.4, 1.85, 1.1] },
];
export const GAME = { holdMs: 3500, stageTwo: 0.43, shakeDistance: 1000, minimumStroke: 28, soundGapMs: 380, strokeDistance: 1800, strokeStep: 14, tapCount: 18, tapMaxMs: 350, tapSlop: 18 };
