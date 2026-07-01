# Crypto Ticker Watch

`Crypto Ticker Watch`는 Chrome 브라우저에서 암호화폐 가격을 빠르게 확인하고, 원하는 조건의 가격 알림을 관리할 수 있는 Chrome Extension입니다.

현재 GitHub 저장소 이름은 `crypto-ticker-watch`를 추천합니다.

## 저장소 이름

| 후보 | 장점 | 단점 |
|---|---|---|
| `crypto-ticker-watch` | 현재 제품명과 일치하고, 가격 확인과 모니터링 성격을 모두 담고 있습니다. | Chrome Extension이라는 점이 이름만으로는 바로 드러나지 않을 수 있습니다. |
| `crypto-price-alert-extension` | 가격 알림 기능이 명확하게 드러납니다. | 이름이 길고, 티커 watch 기능보다 alert 기능에만 치우쳐 보일 수 있습니다. |
| `chrome-crypto-ticker` | Chrome Extension임이 명확합니다. | 알림 기능과 watch 성격이 덜 드러납니다. |
| `crypto-alert-watch` | 알림과 모니터링을 함께 표현합니다. | 티커 가격 확인 확장이라는 구체성이 약합니다. |

최종 추천: `crypto-ticker-watch`

## 주요 기능

현재 코드 기준으로 구현된 기능입니다.

- Chrome Extension popup 기반 UI
- `가격` 탭과 `알림` 탭 분리
- 관심 암호화폐 티커 목록 관리
- 가격 탭에서 `＋ 티커 추가` 버튼으로 티커 검색 및 추가
- OKX, Binance 거래소 검색
- 현물, 선물, 전체 시장 필터 검색
- 최대 10개 티커 표시
- 티커별 현재 가격 표시
- 가격 등락률 표시
- 등락률 기준 선택
  - 업데이트 주기 대비
  - 1분, 3분, 5분, 15분, 30분
  - 1시간, 4시간, 24시간
  - 추가 시점 대비
- 가격 업데이트 주기 선택
  - 1분, 3분, 5분, 15분, 30분
- Chrome toolbar badge에 표시할 티커 선택
- 표시 티커 순서 편집
- 알림 탭에서 `＋ 알림 추가` 버튼으로 가격 알림 추가
- 하나의 티커에 여러 가격 알림 조건 등록
- 알림 조건
  - 목표 가격 이상
  - 목표 가격 이하
- 알림 방식
  - 한 번만 알림
  - 조건 재도달 시 반복
- 등록된 알림 리스트 표시
- 알림별 켜기, 끄기, 삭제
- Chrome notification으로 가격 도달 알림 표시
- 새로고침 연타 시 API rate limit을 줄이기 위한 짧은 쿨다운 및 안내 토스트
- `chrome.storage.local`을 이용한 사용자 설정, 티커 목록, 알림 조건, 가격 캐시 저장

## 기술 스택

- HTML
- CSS
- JavaScript
- Chrome Extension Manifest V3
- Chrome Storage API
- Chrome Alarms API
- Chrome Notifications API
- Chrome Action API
- Chrome Runtime messaging
- OKX public market API
- Binance Spot public market API
- Binance USDⓈ-M Futures public market API

현재 프로젝트에는 React, Vite, TypeScript, npm 기반 빌드 도구가 사용되지 않습니다.

## 프로젝트 구조

```txt
crypto-ticker-watch/
├─ manifest.json
├─ background.js
├─ popup.html
├─ popup.css
├─ popup.js
├─ icons/
│  ├─ icon-16.png
│  ├─ icon-32.png
│  ├─ icon-48.png
│  └─ icon-128.png
├─ STORE_LISTING.md
├─ privacy-policy.md
├─ README.md
└─ .gitignore
```

## 주요 파일 설명

| 파일 | 설명 |
|---|---|
| `manifest.json` | Chrome Extension Manifest V3 설정 파일입니다. |
| `background.js` | Service Worker입니다. 가격 조회, 알람 스케줄링, badge 업데이트, 알림 조건 평가, storage 처리를 담당합니다. |
| `popup.html` | 확장 프로그램 popup의 HTML 구조입니다. 가격 탭과 알림 탭 UI가 정의되어 있습니다. |
| `popup.css` | popup UI 스타일입니다. |
| `popup.js` | popup 이벤트, 티커 검색/추가, 탭 전환, 알림 추가/삭제, 설정 변경 UI 로직을 담당합니다. |
| `icons/` | 확장 프로그램 아이콘 파일입니다. |
| `STORE_LISTING.md` | Chrome Web Store 등록 정보 초안입니다. |
| `privacy-policy.md` | 개인정보 처리방침 초안입니다. |

## Manifest 정보

- Manifest version: 3
- Extension name: `Crypto Ticker Watch`
- Current version: `0.8.3`
- Popup: `popup.html`
- Background Service Worker: `background.js`

## 사용 중인 Chrome API

현재 코드 기준으로 사용 중인 Chrome Extension API입니다.

- `chrome.storage.local`
- `chrome.alarms`
- `chrome.notifications`
- `chrome.action`
- `chrome.runtime.sendMessage`
- `chrome.runtime.onMessage`
- `chrome.runtime.onInstalled`
- `chrome.runtime.onStartup`

## 권한

`manifest.json` 기준 권한입니다.

- `alarms`: 가격 업데이트 주기 실행
- `storage`: 티커 목록, 설정, 알림 조건, 가격 캐시 저장
- `notifications`: 가격 도달 알림 표시

Host permissions:

- `https://www.okx.com/*`
- `https://api.binance.com/*`
- `https://fapi.binance.com/*`

`<all_urls>` 권한은 사용하지 않습니다.

## 외부 API

현재 코드 기준으로 사용하는 외부 공개 API입니다.

- OKX
  - instrument 목록 조회
  - ticker 가격 조회
  - candle 데이터 조회
- Binance Spot
  - exchange info 조회
  - ticker 가격 조회
  - kline 데이터 조회
- Binance USDⓈ-M Futures
  - exchange info 조회
  - ticker 가격 조회
  - kline 데이터 조회

현재 코드에 API key, secret, token은 포함되어 있지 않습니다.

## 로컬 개발 방법

이 프로젝트는 별도 빌드 과정 없이 Chrome에서 직접 로드할 수 있습니다.

1. Chrome에서 `chrome://extensions`에 접속합니다.
2. 우측 상단의 `Developer mode`를 활성화합니다.
3. `Load unpacked`를 클릭합니다.
4. 이 프로젝트 폴더를 선택합니다.
5. 확장 프로그램 popup을 열어 동작을 확인합니다.
6. 코드 수정 후 extension card에서 `Reload`를 클릭합니다.
7. 오류는 extension card의 `Errors`, popup DevTools, Service Worker DevTools에서 확인합니다.

현재 `package.json`이 없으므로 `npm install`, `npm run dev`, `npm run build` 명령은 필요하지 않습니다.

## GitHub에 올리는 방법

아직 Git 저장소가 아니라면 아래 순서로 초기화합니다.

```bash
git init
git add .
git commit -m "Initial commit: add Crypto Ticker Watch extension"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/crypto-ticker-watch.git
git push -u origin main
```

이미 Git 저장소가 초기화되어 있다면 `git init`을 다시 실행하지 말고 현재 상태를 먼저 확인합니다.

```bash
git status
git remote -v
```

원격 저장소가 이미 있다면 `git remote add origin ...` 대신 기존 remote를 확인하거나 변경합니다.

## 커밋 메시지 제안

첫 커밋은 아래 메시지를 추천합니다.

```bash
git commit -m "Initial commit: add Crypto Ticker Watch extension"
```

문서 작업과 소스 작업을 나누고 싶다면 다음처럼 분리할 수 있습니다.

```bash
git add README.md .gitignore
git commit -m "docs: add project README and gitignore"

git add .
git commit -m "Initial commit: add extension source"
```

## GitHub Release용 ZIP 생성 가이드

Chrome Web Store 또는 GitHub Release에 올릴 ZIP 파일은 루트에 `manifest.json`이 있어야 합니다.

현재 프로젝트는 별도 빌드 결과 폴더가 없으므로 프로젝트 루트 기준으로 압축합니다.

macOS/Linux 예시:

```bash
zip -r crypto-ticker-watch-v0.8.3.zip . \
  -x ".git/*" \
  -x "node_modules/*" \
  -x "dist/*" \
  -x "build/*" \
  -x ".env" \
  -x ".env.*" \
  -x "*.log" \
  -x "*.zip" \
  -x ".DS_Store"
```

Windows PowerShell 예시:

```powershell
Compress-Archive -Path manifest.json, background.js, popup.html, popup.css, popup.js, icons, STORE_LISTING.md, privacy-policy.md, README.md -DestinationPath crypto-ticker-watch-v0.8.3.zip
```

압축 후 ZIP 내부 최상위에 `manifest.json`이 있는지 확인하세요. `crypto-ticker-watch/manifest.json`처럼 폴더 안에 들어가 있으면 Chrome Web Store 업로드용 구조가 아닙니다.

## Chrome Web Store 배포 준비 체크리스트

- `manifest.json` 문법 확인
- Manifest V3 사용 확인
- 불필요한 permissions 제거
- `<all_urls>` 미사용 확인
- API key, token, secret 하드코딩 여부 확인
- 개인정보 처리방침 필요 여부 확인
- `privacy-policy.md` 내용 최신화
- 아이콘 16, 48, 128px 준비 확인
- 스크린샷 준비
- Chrome Web Store용 짧은 설명, 긴 설명 작성
- 단일 목적 설명 작성
- ZIP 압축 시 루트에 `manifest.json` 포함
- popup에서 Service Worker 오류가 없는지 확인
- 가격 API rate limit 상황에서 UI가 안전하게 동작하는지 확인
- 알림 권한 사용 사유를 스토어 설명에 명확히 작성

## GitHub 업로드 전 점검

현재 점검 결과:

- 코드에서 API key, token, secret, password 패턴을 검색했으며 하드코딩된 민감 정보는 발견하지 못했습니다.
- `.env` 파일은 현재 프로젝트에 없습니다.
- `manifest.json`은 프로젝트 루트에 있습니다.
- 배포용 ZIP은 프로젝트 루트 기준으로 압축해야 합니다.
- `node_modules`, `dist`, `build` 폴더는 현재 없습니다.
- 별도 빌드 도구는 현재 없습니다.

업로드 전 직접 한 번 더 확인하세요.

```bash
git status
grep -RniE "api[_-]?key|secret|token|password|authorization|bearer" . --exclude-dir=.git --exclude="*.png"
```

## 향후 개선 예정

현재 코드 기준으로 자연스럽게 이어갈 수 있는 개선 항목입니다.

- 티커 검색 UX 개선
- 알림 추가 폼 UX 개선
- 알림 조건 편집 기능 추가
- 알림 히스토리 추가
- 티커별 상세 가격 정보 확장
- 가격 API 장애 및 rate limit 대응 강화
- Chrome Web Store 등록용 스크린샷 제작
- Chrome Web Store 배포 자동화
- GitHub Actions를 통한 release ZIP 생성
- 테스트 코드 또는 수동 테스트 체크리스트 추가

## License

라이선스는 아직 정하지 않았습니다.

오픈소스로 공개할 계획이라면 MIT License 추가를 추천합니다. 단, 라이선스를 확정하기 전까지는 별도의 `LICENSE` 파일을 만들지 않는 것이 좋습니다.
