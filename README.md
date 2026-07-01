# Crypto Ticker Watch

> OKX·Binance 현물·선물 가격을 툴바 배지와 팝업에서 확인하고, 원하는 가격에 맞춰 알림을 받는 Chrome 확장 프로그램입니다.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-0.8.3-22c55e?style=flat-square)](manifest.json)
[![Vanilla JS](https://img.shields.io/badge/stack-vanilla%20JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](popup.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

## 목차

- [소개](#소개)
- [주요 기능](#주요-기능)
- [시작하기](#시작하기)
- [개발](#개발)
- [프로젝트 구조](#프로젝트-구조)
- [권한 및 개인정보](#권한-및-개인정보)
- [로드맵](#로드맵)
- [License](#license)

## 소개

브라우저를 떠나지 않고 관심 암호화폐 티커의 현재가·등락률을 확인하고, 목표 가격 도달 시 Chrome 알림을 받을 수 있습니다.

빌드 도구 없이 HTML·CSS·JavaScript만으로 동작하는 **Manifest V3** 확장 프로그램이며, OKX·Binance 공개 API만 사용합니다. API 키는 필요하지 않습니다.

## 주요 기능

### 가격 모니터링

- OKX, Binance **현물·선물** 티커 검색 및 추가 (최대 10개)
- 팝업 `가격` 탭에서 실시간 가격·등락률 확인
- 등락률 기준 선택 — 업데이트 주기 대비, 1분~24시간, 추가 시점 대비
- 가격 갱신 주기 설정 — 1·3·5·15·30분
- Chrome 툴바 **badge**에 선택한 티커 가격 표시 및 순서 편집

### 가격 알림

- 티커별 **여러 알림 조건** 등록 (목표가 이상 / 이하)
- 알림 방식 — 한 번만, 조건 재도달 시 반복
- 알림별 켜기·끄기·삭제
- Chrome **notification**으로 가격 도달 알림

### 사용성

- `가격` / `알림` 탭 분리 UI
- `chrome.storage.local`에 설정·티커·알림·가격 캐시 저장
- 새로고침 연타 시 rate limit 완화를 위한 쿨다운 및 안내 토스트

## 시작하기

Chrome Web Store 배포 전에는 아래 방법으로 로컬에서 바로 사용할 수 있습니다.

1. 저장소를 클론하거나 ZIP을 받아 압축을 풉니다.
2. Chrome 주소창에 `chrome://extensions` 를 입력합니다.
3. 우측 상단 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다** 를 클릭하고 이 프로젝트 폴더를 선택합니다.
5. 툴바 아이콘을 눌러 팝업에서 티커를 추가해 동작을 확인합니다.

코드를 수정한 뒤에는 확장 프로그램 카드의 **새로고침** 버튼을 누르면 됩니다. 오류는 카드의 **오류**, 팝업 DevTools, Service Worker DevTools에서 확인할 수 있습니다.

## 개발

### 로컬 실행

`package.json`이 없으므로 `npm install`이나 빌드 단계는 필요하지 않습니다. 프로젝트 루트를 그대로 로드하면 됩니다.

| 파일 | 역할 |
|---|---|
| `manifest.json` | Manifest V3 설정 |
| `background.js` | Service Worker — 가격 조회, 알람, badge, 알림 평가 |
| `popup.html` / `popup.css` / `popup.js` | 팝업 UI 및 사용자 상호작용 |
| `icons/` | 확장 프로그램 아이콘 (16·32·48·128px) |
| `STORE_LISTING.md` | Chrome Web Store 등록 정보 초안 |
| `privacy-policy.md` | 개인정보 처리방침 초안 |

### Release ZIP 만들기

Chrome Web Store 또는 GitHub Release용 ZIP은 **루트에 `manifest.json`이 바로 오도록** 압축해야 합니다.

**macOS / Linux**

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

**Windows (PowerShell)**

```powershell
Compress-Archive -Path manifest.json, background.js, popup.html, popup.css, popup.js, icons, STORE_LISTING.md, privacy-policy.md, README.md -DestinationPath crypto-ticker-watch-v0.8.3.zip
```

### 스토어 배포 전 체크리스트

- [ ] `manifest.json` 문법 및 Manifest V3 확인
- [ ] 불필요한 permissions·`<all_urls>` 미사용 확인
- [ ] `privacy-policy.md` 최신화
- [ ] 스토어용 스크린샷·설명·단일 목적 문구 준비
- [ ] ZIP 루트에 `manifest.json` 포함 여부 확인
- [ ] rate limit 상황에서 popup·Service Worker 정상 동작 확인

## 프로젝트 구조

```
crypto-ticker-watch/
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── STORE_LISTING.md
├── privacy-policy.md
└── README.md
```

## 권한 및 개인정보

### 요청 권한

| 권한 | 용도 |
|---|---|
| `alarms` | 가격 업데이트 주기 실행 |
| `storage` | 티커 목록, 설정, 알림, 가격 캐시 저장 |
| `notifications` | 목표 가격 도달 알림 표시 |

**Host permissions:** `okx.com`, `api.binance.com`, `fapi.binance.com` — 가격 조회에만 사용합니다.

### 데이터

- 외부 서버로 사용자 데이터를 전송하거나 수집하지 않습니다.
- 설정은 기기 로컬(`chrome.storage.local`)에만 저장됩니다.
- API key, secret, token은 코드에 포함되어 있지 않습니다.

### 사용 API

Chrome Extension API — `storage`, `alarms`, `notifications`, `action`, `runtime` messaging

외부 공개 API — OKX·Binance Spot·Binance USDⓈ-M Futures (instrument/ticker/candle·kline 조회)

## 로드맵

- [ ] 티커 검색·알림 추가 UX 개선
- [ ] 알림 조건 편집
- [ ] 알림 히스토리
- [ ] API 장애·rate limit 대응 강화
- [ ] Chrome Web Store 등록
- [ ] GitHub Actions release ZIP 자동화

## License

[MIT License](LICENSE) — Copyright (c) 2026 geunsu-son
