# Store Listing Draft

## Name
Crypto Ticker Watch

## Summary
Chrome 툴바에서 OKX·Binance 현물/선물 암호화폐 가격을 확인하세요.

Track OKX and Binance spot/futures crypto prices from your Chrome toolbar.

## Description
Crypto Ticker Watch는 OKX와 Binance의 암호화폐 티커 가격을 Chrome에서 바로 확인할 수 있게 해줍니다.

최대 10개의 티커를 추가하고, 현물·선물 시장을 검색하며, 툴바 배지에 표시할 티커 하나를 선택하고, 티커별 목표 가격 알림을 설정할 수 있습니다. 별도 설정 패널에서 가격 업데이트 주기와 등락폭 계산 기준을 각각 설정할 수 있습니다.

기능:

- OKX, Binance 티커 검색
- 전체/현물/선물 시장 필터 검색
- 팝업에서 최대 10개 티커 추적
- 툴바 배지에 표시할 티커 하나 선택
- 특정 티커에 대해 이상/이하 조건의 목표 가격 알림 설정
- 조건 충족 시 일회성 또는 반복 알림 선택
- 가격 업데이트 주기 선택: 1, 3, 5, 15, 30분
- 등락폭 계산 기준 선택: 24시간, 선택한 시간대, 추가 이후
- 등락폭 시간대 별도 선택: 업데이트 주기와 동일, 1분, 3분, 5분, 15분, 30분
- 설정 및 캐시된 가격 기록은 로컬 저장만 사용

지원 시장:

- OKX 현물
- OKX 스왑(선물로 표시)
- Binance 현물
- Binance USDⓈ-M 무기한 선물

이 확장 프로그램은 빠른 가격 모니터링만을 위한 것입니다. 거래, 재무, 또는 투자 조언이 아닙니다.

---

Crypto Ticker Watch helps you monitor crypto ticker prices from OKX and Binance directly in Chrome.

You can add up to 10 tickers, search spot and futures markets, choose one ticker to display in the toolbar badge, and set per-ticker price target alerts. A dedicated settings panel lets you configure the price update interval and the change calculation basis separately.

Features:

- Search OKX and Binance tickers.
- Filter search by all markets, spot, or futures.
- Track up to 10 tickers in the popup.
- Choose one ticker for the toolbar badge price.
- Set price target alerts for specific tickers using above/below conditions.
- Choose one-time alerts or repeat alerts when the condition is reached again.
- Select a price update interval: 1, 3, 5, 15, or 30 minutes.
- Select change calculation basis: 24h, selected timeframe, or since-added.
- Select change timeframe separately: same as update interval, 1m, 3m, 5m, 15m, or 30m.
- Local storage only for settings and cached price history.

Supported markets:

- OKX Spot
- OKX Swap, displayed as futures
- Binance Spot
- Binance USDⓈ-M Perpetual Futures

This extension is for quick price monitoring only. It is not trading, financial, or investment advice.

## Single purpose
Display selected OKX/Binance crypto ticker prices and one selected ticker price in the Chrome toolbar badge.

## Store URLs
- Homepage URL: https://github.com/geunsu-son/crypto-ticker-watch
- Support URL: https://github.com/geunsu-son/crypto-ticker-watch
- Privacy policy URL: https://raw.githubusercontent.com/geunsu-son/crypto-ticker-watch/main/privacy-policy.md

## Privacy practices (Chrome Web Store)

### Single purpose description
Display selected OKX and Binance crypto ticker prices in the extension popup and show one selected ticker price in the Chrome toolbar badge.

### alarms
Schedules background price updates at the user's chosen interval (1, 3, 5, 15, or 30 minutes) so ticker prices, toolbar badge text, and price alerts stay current.

### storage
Stores user settings locally in chrome.storage.local, including selected tickers, badge ticker, update interval, change settings, alert rules, cached search results, and recent price history.

### notifications
Shows locally configured price target alerts when a tracked ticker's price meets the user's above/below condition.

### Host permissions
Fetches public market data only from OKX and Binance APIs to search instruments and retrieve spot/futures prices. No account access, trading, wallet, or personal data is requested.

### Remote code
Select: **No, this extension does not use remote code.**

### User data collected
Leave all data-type checkboxes **unchecked** (the extension does not collect personal data).

### Data use certification
Check all three certification boxes at the bottom of the privacy form.

## Category
Productivity or Finance

## Troubleshooting notifications

If price alerts do not appear on screen, check both Chrome and your operating system notification settings.

**Windows 10 / 11**

1. Open **Settings** (Win + I) → **System** → **Notifications**.
2. Make sure notifications are turned on and **Google Chrome** is allowed.
3. Turn off **Focus assist** / **Do not disturb** from the notification center.
4. In Chrome, open `chrome://settings/content/notifications` and make sure notifications are not blocked globally.
5. Restart Chrome after changing OS notification settings.

Alerts are checked when prices update on your selected interval (1–30 minutes), not in real time.

## Data disclosure note
The extension stores selected tickers, badge settings, update interval, change settings, alert rules, and cached price history locally in the browser. It does not collect, sell, or transmit personal information to the developer.


## Version 0.8.3

상승·하락폭 집계 기준에서 분봉 기준을 직접 선택할 수 있습니다.


### Update

- Minute-based change rates are initialized with the previous candle close when local history is not available yet.


### 업데이트 v0.8.3

- 등락폭 옆에 기준 가격을 함께 표시하여 현재 가격이 어떤 이전 가격 대비로 계산됐는지 확인할 수 있습니다.
