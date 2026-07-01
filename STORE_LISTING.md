# Store Listing Draft

## Name
Crypto Ticker Watch

## Summary
Track OKX and Binance spot/futures crypto prices from your Chrome toolbar.

## Description
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
