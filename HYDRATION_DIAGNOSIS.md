# LAN 접속 호환성 해결 기록

Next.js 16.4.3 개발 서버의 Origin 허용 목록에 Mac의 LAN IP가 없어, iPhone의 개발 리소스/HMR 요청이 차단되었습니다. 서버를 0.0.0.0에서 실행하는 것만으로 실제 LAN Origin이 자동 허용되는 것은 아닙니다.

같은 client chunk에 localhost Origin을 보내면 200, LAN IP Origin을 보내면 403인 것을 확인했습니다. 브라우저에서도 LAN URL의 React 초기화 실패를 재현한 후, next.config.mjs의 allowedDevOrigins 설정만 추가해 200 응답과 React 카드 선택·플레이 진입 복구를 확인했습니다. 이후 사용자가 실제 iPhone Safari의 정상 작동을 확인했습니다.

## 유지되는 설정

- next.config.mjs는 127.0.0.1과 이 Mac에 실제 배정된 IPv4 주소를 개발 Origin으로 허용합니다.
- 임의의 외부 Origin은 계속 차단합니다. wildcard는 사용하지 않습니다.
- Wi-Fi IP가 변경되면 개발 서버를 다시 시작하여 주소를 반영합니다.
- 원래의 React onClick → setSelected 방식과 모바일 Pointer Events 처리를 유지합니다.

임시 진단 UI·관찰 스크립트·실행 marker와 관련 전용 테스트는 모바일 정상 작동 확인 후 제거했습니다. 입력 영역 분리, capture 실패 시 추적, 게임 영역의 touch-action 및 선택 방지, 반응형 크기는 유지합니다.

현재 회귀 검증은 npm test(모바일 입력 4개 + 개발 Origin 1개) 및 npm run build로 실행합니다.

설정 문서: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
