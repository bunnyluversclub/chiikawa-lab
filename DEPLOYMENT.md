# GitHub Pages 공개 배포

현재 폴더는 Git 저장소가 아니며 remote가 없습니다. 저장소 생성, Git 초기화, commit, push, 공개 배포는 아직 수행하지 않았습니다. 실제 저장소 이름과 사이트 URL은 연결 후 확정됩니다.

## 처음 한 번

1. GitHub에서 빈 **Public repository**를 만드세요. README 등을 자동 생성하지 않으면 아래 명령을 그대로 사용할 수 있습니다. 저장소 이름은 자유롭게 정하되 project site를 사용하므로 `사용자명.github.io` 형태의 이름은 피하세요.
2. 프로젝트 폴더의 터미널에서 아래 명령을 실행하세요. `YOUR_USERNAME`과 `YOUR_REPOSITORY`를 실제 값으로 바꾸세요.

```sh
git init -b main
git add .
git commit -m "Prepare game for GitHub Pages"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

3. GitHub 저장소 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택하세요. branch의 `docs`나 `gh-pages`를 선택하는 방식이 아닙니다.
4. **Actions → Deploy game to GitHub Pages → Run workflow → main**으로 실행하세요. 첫 push가 Pages 설정 전에 실행되어 실패했다면 실패한 실행의 **Re-run all jobs**를 눌러도 됩니다.
5. `build`와 `deploy`가 모두 초록색이면 `deploy` 실행의 사이트 링크 또는 **Settings → Pages → Visit site**를 여세요.

최종 URL 형식: `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`

workflow가 실제 GitHub repository 이름으로 `NEXT_PUBLIC_BASE_PATH`를 설정하므로 코드에 저장소 이름을 직접 입력할 필요가 없습니다. Pages 설정은 한 번만 하면 됩니다. 이후 변경 사항을 commit하고 `main`에 push하면 자동 배포됩니다.

## 설정과 제한

- Next.js 16.4.3의 `output: 'export'`를 사용합니다. `next build`가 `out/`을 만들며 `next export` 명령은 사용하지 않습니다.
- `basePath`를 빌드 시 설정합니다. Next의 JS/CSS에는 자동 반영되므로 `assetPrefix`는 별도로 설정하지 않았습니다.
- 기본 `<img>`, `Audio`, 홈 `<a>`는 `lib/site-path.ts`로 public 경로에 같은 prefix를 적용합니다. MP3 파일명의 대소문자를 그대로 유지합니다.
- 실행 중 서버가 필요한 API, Server Actions, 쿠키, 동적 라우트, 이미지 최적화 서버가 없습니다. 게임 화면 전환은 같은 `/` 페이지의 React 상태 전환이므로 사이트 URL을 새로고침하면 메인 화면으로 정상 진입합니다. 캐릭터별 별도 URL은 없습니다.
- `allowedDevOrigins`와 LAN 주소 자동 탐색은 유지합니다. `npm run dev`는 basePath 없이 `http://localhost:3000/`에서 동작합니다.
- artifact는 `out/`만 업로드합니다. Actions 배포를 사용하므로 별도 `gh-pages` 브랜치나 Jekyll 빌드는 필요하지 않습니다.
- `npm start`는 정적 결과물 미리보기 서버입니다. `next start`는 static export에 사용하지 않습니다.

## 로컬에서 Pages와 같은 경로로 확인

아래 `example-repo`는 검증용 이름입니다. 실제 저장소 이름으로 바꿔도 됩니다.

```sh
npm ci
npm test
NEXT_PUBLIC_BASE_PATH=/example-repo npm run build
NEXT_PUBLIC_BASE_PATH=/example-repo npm run check:export
NEXT_PUBLIC_BASE_PATH=/example-repo npm start
```

`http://localhost:4173/example-repo/`를 여세요. 서버를 켜 둔 채 별도 터미널에서 전체 파일의 HTTP 응답과 내용, MP3 MIME/부분 요청을 검사할 수 있습니다.

```sh
NEXT_PUBLIC_BASE_PATH=/example-repo npm run check:export:http
```

basePath는 빌드에 포함되므로 이름을 바꾸면 다시 빌드해야 합니다. 로컬 루트 정적 미리보기는 prefix 없이 `npm run build` 후 `npm start`를 사용하세요. LAN 개발 테스트는 기존처럼 `npm run dev`를 사용합니다.

## 이번 검증

- 예시 `/chiikawa-lab/` 하위 경로로 production static export 성공, 정적 파일 56개 HTTP/바이트 일치 확인. PNG 14개와 MP3 8개, Next JS/CSS 모두 정상.
- PC 1280×900, 모바일 390×844 / 393×852 / 430×932에서 네 캐릭터 시작/완료 화면 총 32개 검증: 진행도·이미지 로딩·버튼 접근·잘림·가로 overflow 정상.
- 다시 하기, 다른 친구 선택, 음소거 및 새로고침 후 저장, 홈 링크와 직접 URL 새로고침, 쿠리만쥬/랏코 티저 정상.
- 마우스/터치 입력 회귀 및 경로 설정 테스트 21개 통과. 실제 iPhone의 최종 소리/터치 확인은 배포 URL에서 한 번 더 진행하세요.
- GitHub 원격 배포와 Actions 실행은 아직 수행하지 않았습니다. repository 연결 및 Pages 설정 후 위 절차를 따라야 합니다.

공식 참고: [Next.js static export](https://nextjs.org/docs/app/guides/static-exports), [basePath와 assetPrefix](https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix), [GitHub Pages Actions workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
