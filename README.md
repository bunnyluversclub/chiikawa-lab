# 치이카와 만지작 연구소 ♡

Next.js App Router · TypeScript · Tailwind CSS로 만든 모바일/PC 미니게임입니다. 로그인이나 게임 서버 없이 제공된 로컬 이미지와 음성을 사용하며, production 사이트의 방문과 게임 행동은 GA4로 측정합니다.

## 실행

Node.js 20.9 이상이 필요합니다.

```sh
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 여세요. 같은 Wi-Fi의 휴대전화에서는 터미널의 Network 주소로 접속할 수 있습니다. 휴대전화 테스트를 할 때는 `--hostname 127.0.0.1` 옵션 없이 실행하세요.

```sh
npm run typecheck
npm run build
npm start
```

빌드는 Next.js의 공식 Webpack 옵션과 `output: 'export'`를 사용해 `out/`에 정적 결과물을 만듭니다. `npm start`는 이를 `http://localhost:4173/`에서 보여줍니다. GitHub Pages의 repository 경로는 workflow가 자동 설정합니다. 초기 저장소 연결과 Pages 설정은 [배포 안내](DEPLOYMENT.md)를 따라 주세요.

## 플레이

- **치이카와**: 얼굴을 누르고 있으면 누적 약 3.5초에 눈물 홍수 발생. 중간에 손을 떼어도 이어집니다.
- **우사기**: 캐릭터를 잡은 채 손을 떼지 않고 위아래로 계속 흔듭니다. 28px 이상의 세로 방향 전환에서 직전 이동량이 진행도에 반영되며, 완료 시 기존 발사 후 거꾸로 착지합니다. 탭·가만히 누르기·작은 떨림·좌우 이동은 진행되지 않습니다. 캐릭터 밖으로 나가도 pointer capture와 fallback으로 추적하며 손을 뗄 때 별도 점프 판정은 하지 않습니다.
- **하치와레**: 머리에서 시작해 좌우로 쓰다듬으면 털이 3단계로 부풀어 오릅니다. 가만히 누르거나 위아래로 움직이면 진행되지 않습니다.
- **모몽가**: 짧게 18번 탭/클릭하면 3단계로 반응합니다. 길게 누르기·드래그·취소 입력은 진행에 포함되지 않습니다.
- 다시 하기는 진행도, 이미지, 음성, 애니메이션을 초기화합니다. 음소거 선택은 브라우저에 저장됩니다.
- 키보드: 치이카와는 스페이스/엔터 길게 누르기, 우사기는 위아래 방향키 번갈아 누르기, 하치와레는 좌우 방향키 번갈아 누르기, 모몽가는 스페이스/엔터 반복 누르기.

## 조절과 확장

- `lib/characters.ts`: 캐릭터 데이터, 실제 에셋 경로, 단계별 이미지 크기, 시간/흔들기 임계치.
- `components/game.tsx`: Pointer Events, pointer capture, 입력/초기화 및 반전.
- `lib/use-sound.ts`: 사용자 입력 시 음성 활성화, 연속음 제한, 음소거, 정리.
- `app/globals.css`: 반응형 UI 및 눈물/홍수/발사 애니메이션.

우사기 `u_3.png`는 원본부터 거꾸로 그려져 있으므로 착지 회전을 추가하지 않았습니다. 이미지는 고정된 공통 영역에 object-fit: contain으로 배치해 비율과 투명도를 유지합니다.

## 직접 확인할 항목

1. iPhone Safari와 Android Chrome에서 누르는 동안 스크롤/이미지 메뉴가 뜨지 않는지.
2. 치이카와를 3초 누르고 떼었다가 다시 눌러 마지막 단계까지 도달하는지.
3. 우사기를 한 번 잡은 채 위아래로 반복해서 움직이면 진행되고, 탭·가만히 누르기·좌우 움직임·작은 떨림은 진행되지 않는지.
4. 발사 → 화면 밖 대기 → 재등장 → 착지 애니메이션과 눈물 홍수의 손맛.
5. 실제 기기의 음량/자동재생 정책에서 기본음과 반전 음성이 들리는지, 반전 음성이 한 번만 재생되는지.
6. 음소거 유지, 연속 다시 하기, 캐릭터 변경 직후 이전 음성이 멈추는지.

실기기 터치와 Safari 자동재생 정책은 데스크탑 화면 크기 검증만으로 보장할 수 없으므로 휴대전화에서 최종 확인이 필요합니다.

## 현재 검증 및 모바일 호환성

```sh
npm test
npm run typecheck
npm run build
```

- 마우스/터치 입력, 단계 전환, 초기화, 실제 에셋 경로, 개발 Origin, GA 초기화/이벤트 및 완료 중복 방지를 포함한 26개 테스트를 유지합니다.
- PC 및 390×844 / 393×852 / 430×932에서 네 캐릭터의 초기/최종 화면, 버튼 접근, 이미지 잘림과 가로 overflow를 확인했습니다.
- 사용자가 실제 iPhone Safari의 정상 동작을 확인했으며, 테스트용 패널과 입력 outline, 이벤트/실행 marker 및 진단 로그는 제거했습니다.
- 선택 화면의 캐릭터별 `displayScale`(c 1 / u 1.28 / h 0.98 / m 0.88), 모바일 반응형 크기, 안정적인 입력 영역과 pointer capture fallback을 유지합니다.
- `next.config.mjs`의 `allowedDevOrigins`가 이 Mac의 LAN IP를 허용합니다. Wi-Fi IP가 바뀌면 서버를 다시 시작하세요. 상세 원인은 [LAN 접속 해결 기록](HYDRATION_DIAGNOSIS.md)에 있습니다.
- 플레이 영역의 컬러 이모지로 렌더링되던 별표 장식은 제거했습니다.

## 연결된 사운드

실제 파일명의 대소문자를 유지합니다. 공통 음소거와 기본음 재생 간격 제한을 네 캐릭터에 적용합니다.

| 캐릭터 | 기본음 | 최종음 |
| --- | --- | --- |
| 치이카와 | c_1.mp3 | c_reaction.mp3.MP3 |
| 우사기 | u_1.mp3 | u_reaction.mp3.MP3 |
| 하치와레 | h_1.mp3 | h_reaction.MP3 |
| 모몽가 | m_1.mp3 | m_reaction.MP3 |

하치와레 머리 쓰다듬기, 모몽가 빠른 연속 탭, 최종음 1회 및 다시 하기 후 재생은 실제 iPhone Safari에서도 최종 확인하세요.

## Google Analytics 4

측정 ID: `G-TR2E2GHRDQ`. `components/google-analytics.tsx`가 Google tag를 hydration 이후 비동기로 로드하고, `lib/analytics.ts`가 초기화·이벤트 큐·캐릭터 이름 매핑을 관리합니다. 추가 패키지나 서버는 필요하지 않습니다.

- production에서만 수집합니다. `npm run dev`에서는 스크립트와 이벤트가 비활성화됩니다.
- `config`의 기본 `page_view`를 페이지 로드당 한 번 사용합니다. 실제 URL의 `/chiikawa-lab/`도 자동 포함됩니다. 게임 진입은 같은 URL의 상태 전환이므로 추가 page_view를 만들지 않습니다.
- Google script 로딩 전에 발생한 이벤트는 큐에 보관하고, 수집이 차단되어도 게임 기능에 예외가 전달되지 않습니다.

| 이벤트 | 시점 | 파라미터 |
| --- | --- | --- |
| `character_select` | 플레이 카드 선택으로 게임 진입 | `character` |
| `reaction_complete` | 최종 반응 최초 도달, 플레이당 한 번 | `character` |
| `reset` | 다시 하기 버튼 클릭 | `character` |
| `sound_toggle` | 사용자가 소리 버튼으로 상태 변경 | `muted`: boolean |

`character` 값은 `chiikawa` / `usagi` / `hachiware` / `momonga`입니다. 저장된 음소거 상태를 처음 불러올 때는 `sound_toggle`을 보내지 않습니다. 다시 하기 후 완료하면 새로운 `reaction_complete`를 보냅니다.

commit/push 후 GitHub Pages 배포가 끝나면 실제 사이트에서 플레이하고 GA4 실시간 보고서에서 이벤트를 확인하세요. 표준 보고서에서 캐릭터별·음소거 상태별 분석이 필요하면 GA4 관리의 맞춤 정의에 이벤트 범위 측정기준 `character`, `muted`를 등록하세요. [Google 공식 이벤트 파라미터 안내](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)
