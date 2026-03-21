# 旅のしおり PWA — 実装計画書

## 概要

家族旅行用のモバイルWebアプリ（PWA）。  
デザインHTMLは完成済み。本計画書はJSロジック・PWA対応・データ管理の実装指示書。

---

## ファイル構成（完成形）

```
/
├── home.html          # ホーム画面（デザイン済み）
├── schedule.html      # スケジュール画面（デザイン済み）
├── common.css         # 共通CSS（デザイン済み）
├── home.css           # ホーム専用CSS（デザイン済み）
├── schedule.css       # スケジュール専用CSS（デザイン済み）
├── app.js             # 共通JSロジック【新規作成】
├── data.json          # 旅程データ【新規作成】
├── manifest.json      # PWAマニフェスト【新規作成】
├── sw.js              # Service Worker【新規作成】
└── images/
    └── hero.jpg       # ヒーロー画像（旅全体のメイン写真・ユーザー用意）
```

---

## データ仕様

### data.json

```json
{
  "title": "家族で夏休み旅行 2026",
  "dates": "8月10日〜12日",
  "hero_image": "images/hero.jpg",
  "destination": {
    "name": "沖縄・離島めぐり",
    "lat": 26.2124,
    "lon": 127.6809
  },
  "days": [
    {
      "day": 1,
      "label": "1日目",
      "date": "2026-08-10",
      "events": [
        {
          "time": "09:00",
          "name": "出発",
          "icon": "directions_bus",
          "note": "中央駅改札口 • 出発の準備完了！",
          "lat": 35.6812,
          "lon": 139.7671
        }
      ]
    }
  ]
}
```

**フィールド説明**

| フィールド | 型 | 説明 |
|---|---|---|
| `title` | string | 旅のタイトル |
| `dates` | string | 日程テキスト表示用 |
| `hero_image` | string | ヒーロー画像のパス |
| `destination.lat/lon` | number | 天気API用の目的地座標 |
| `days[].date` | string | YYYY-MM-DD形式 |
| `events[].time` | string | HH:MM形式 |
| `events[].icon` | string | Material Symbolsのアイコン名 |
| `events[].lat/lon` | number | 各スポットの座標（GPS距離計算用） |

---

## 実装タスク一覧

### 1. data.json の作成

- 上記スキーマに従い旅程データを作成する
- `days`は3日分、各日に実際のイベントを入れる
- 各イベントの`lat/lon`は目的地の座標を入れる（GoogleマップのURL等から取得）

---

### 2. app.js の作成

以下の機能をすべて`app.js`1ファイルに実装する。  
`home.html`と`schedule.html`の両方が`<script src="app.js">`で読み込む。

#### 2-1. データ読み込みと初期化

```javascript
// ページ読み込み時にdata.jsonをfetchして全機能を初期化する
// どのページかはdocument.bodyのid属性で判定する
// home.html → <body id="page-home">
// schedule.html → <body id="page-schedule">
```

#### 2-2. ヘッダー情報の反映

- `data.title` → ヘッダーのタイトル要素に反映
- `data.dates` → 日程テキストに反映
- `data.hero_image` → ヒーロー画像の`background-image`に反映

#### 2-3. 天気情報のリアルタイム取得

**使用API: Open-Meteo（APIキー不要・無料）**

```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
  &timezone=Asia/Tokyo
```

- `destination.lat/lon`を使ってAPIを呼ぶ
- レスポンスの`current`から以下を取得してDOMに反映する

| データ | 反映先要素ID | 表示形式 |
|---|---|---|
| `temperature_2m` | `#weather-temp` | `31°C` |
| `weather_code` | `#weather-desc` | 下記コード変換表を使う |
| `weather_code` | `#weather-icon` | 下記コード変換表を使う |
| `relative_humidity_2m` | `#weather-humidity` | `45%` |
| `wind_speed_10m` | `#weather-wind` | `5m/s` |

**天気コード変換表（WMO weather code）**

```javascript
function wmoToText(code) {
  if (code === 0)  return '快晴';
  if (code <= 2)   return '晴れ';
  if (code <= 3)   return 'くもり';
  if (code <= 49)  return 'もや・霧';
  if (code <= 69)  return '雨';
  if (code <= 79)  return '雪';
  if (code <= 84)  return 'にわか雨';
  return '雷雨';
}

function wmoToIcon(code) {
  if (code === 0)  return 'wb_sunny';
  if (code <= 2)   return 'partly_cloudy_day';
  if (code <= 3)   return 'cloud';
  if (code <= 49)  return 'foggy';
  if (code <= 69)  return 'rainy';
  if (code <= 79)  return 'ac_unit';
  if (code <= 84)  return 'grain';
  return 'thunderstorm';
}
// アイコンはMaterial Symbolsのアイコン名を返す
// DOM反映: document.querySelector('#weather-icon').textContent = wmoToIcon(code)
```

- オフライン時はAPI呼び出しをtry/catchで捕捉し「オフライン中」と表示する

---

#### 2-4. カウントダウンタイマー

**ロジック**

```
1. data.daysの全イベントをフラットな配列に展開し日時順にソートする
2. 現在時刻と比較して以下のケースを判定する
   - 旅行前: 旅行初日の最初のイベントまでのカウントダウンを表示
   - イベント進行中: 「現在進行中」バナーと次のイベント名を表示
   - 次のイベント待ち: 次のイベントまでの残り時間を HH:MM:SS で表示
   - 旅行終了: 「旅が終わりました」と表示
3. setInterval(tick, 1000) で毎秒更新する
```

**反映先要素**

| 要素ID | 内容 |
|---|---|
| `#countdown-event` | 次のイベント名 |
| `#countdown-timer` | `HH:MM:SS` 形式の残り時間 |
| `#countdown-label` | 「開始まで」または「現在進行中」 |

---

#### 2-5. GPS・現在地情報

**取得方法**

```javascript
navigator.geolocation.watchPosition(
  (pos) => updateGPS(pos.coords),
  (err) => showGPSError(err),
  { enableHighAccuracy: true, maximumAge: 10000 }
);
```

**取得して反映するデータ**

| データ | 反映先要素ID | 表示形式 |
|---|---|---|
| `coords.latitude` | `#gps-coords` | `35.68, 139.76` |
| `coords.longitude` | `#gps-coords` | 同上（緯度と同じ要素） |
| `coords.altitude` | `#gps-altitude` | `50m`（nullの場合は国土地理院APIで取得） |
| 次目的地までの距離 | `#gps-distance` | `約 1.5km` |

**標高のフォールバック（国土地理院API）**

`coords.altitude`がnullの場合は以下APIを呼ぶ。

```
https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php
  ?lon={lon}&lat={lat}&outtype=JSON
```

**直線距離の計算（ハバーサイン公式）**

```javascript
function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径(m)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const dist = R * c;
  if (dist < 1000) return `約 ${Math.round(dist)}m`;
  return `約 ${(dist / 1000).toFixed(1)}km`;
}
```

- 「次の目的地」は現在時刻から直近の未来イベントの`lat/lon`を使う

---

#### 2-6. スケジュール画面のタイムライン描画

- `data.days`をループして日付タブとタイムラインをDOMに動的生成する
- 現在時刻と各イベントの日時を比較して以下のクラスを付与する

| 状態 | クラス |
|---|---|
| 過去のイベント | `timeline__item--past` |
| 現在進行中 | `timeline__item--active`（active-badge表示） |
| 未来のイベント | クラスなし |

- 日付タブのクリックで対応するDAYのタイムラインにスクロールする

---

### 3. PWA対応

#### 3-1. manifest.json の作成

```json
{
  "name": "旅のしおり",
  "short_name": "しおり",
  "start_url": "/home.html",
  "display": "standalone",
  "background_color": "#f8f6f5",
  "theme_color": "#ff8a70",
  "icons": [
    { "src": "images/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "images/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

アイコン画像（192px・512px）はユーザーが用意する。  
暫定的にSVGで代替する場合は以下を使う。

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✈️</text></svg>">
```

#### 3-2. sw.js（Service Worker）の作成

**キャッシュ戦略**

| リソース | 戦略 |
|---|---|
| HTML・CSS・JS・画像 | キャッシュファースト（初回fetch時にキャッシュ保存） |
| Open-Meteo API | ネットワークファースト（失敗時はキャッシュを使う） |
| 国土地理院API | ネットワークファースト（失敗時は「--m」表示） |

```javascript
const CACHE_NAME = 'travel-v1';
const STATIC_ASSETS = [
  '/home.html',
  '/schedule.html',
  '/common.css',
  '/home.css',
  '/schedule.css',
  '/app.js',
  '/data.json',
  '/manifest.json'
];

// install: 静的アセットを全てキャッシュ
// activate: 古いキャッシュを削除
// fetch: 上記戦略で振り分け
```

#### 3-3. 各HTMLへの追記

`home.html`と`schedule.html`の`<head>`に以下を追加する。

```html
<meta name="theme-color" content="#ff8a70">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.json">
```

`</body>`直前に以下を追加する。

```html
<script src="app.js"></script>
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
</script>
```

---

### 4. プッシュ通知（イベント15分前）

**実装方針**

PWAのプッシュ通知はサーバーが必要なため、  
本実装では**Notification API（ローカル通知）**で代替する。  
ページを開いている間のみ動作する仕様とする。

```javascript
// 通知許可のリクエスト（初回起動時）
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// 15分前通知のスケジューリング
function scheduleNotifications(events) {
  const now = Date.now();
  events.forEach(ev => {
    const eventTime = ev.dt.getTime();
    const notifyTime = eventTime - 15 * 60 * 1000; // 15分前
    const delay = notifyTime - now;
    if (delay > 0) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('旅のしおり', {
            body: `まもなく「${ev.name}」が始まります（15分前）`,
            icon: 'images/icon-192.png'
          });
        }
      }, delay);
    }
  });
}
```

- `requestNotificationPermission()`はページ初期化時に呼ぶ
- `scheduleNotifications()`はデータ読み込み後に全イベントを渡して呼ぶ

---

### 5. HTMLへのID付与（app.jsと接続するため）

デザイン済みHTMLの各要素に以下のIDを追加する。

**home.html**

| 要素 | 追加するID |
|---|---|
| 旅タイトル | `id="trip-title"` |
| 日程テキスト | `id="trip-dates"` |
| ヒーロー画像div | `id="hero-image"` |
| 天気アイコン | `id="weather-icon"` |
| 気温・天気概況 | `id="weather-temp"` |
| 天気説明 | `id="weather-desc"` |
| 湿度 | `id="weather-humidity"` |
| 風速 | `id="weather-wind"` |
| 次のイベント名 | `id="countdown-event"` |
| タイマー | `id="countdown-timer"` |
| タイマーラベル | `id="countdown-label"` |
| GPS座標 | `id="gps-coords"` |
| 標高 | `id="gps-altitude"` |
| 次目的地名 | `id="gps-dest-name"` |
| 次目的地距離 | `id="gps-distance"` |

**schedule.html**

| 要素 | 追加するID |
|---|---|
| 日付タブコンテナ | `id="day-tabs"` |
| タイムラインコンテナ | `id="timeline-container"` |

---

## 実装順序（推奨）

1. `data.json` を作成する
2. `home.html` と `schedule.html` に必要なIDを追加する
3. `app.js` を作成し以下の順で実装・動作確認する
   1. データ読み込み・ヘッダー反映
   2. カウントダウンタイマー
   3. スケジュール画面のタイムライン描画
   4. 天気API
   5. GPS・標高・距離
   6. 通知スケジューリング
4. `manifest.json` を作成する
5. `sw.js` を作成する
6. 動作確認（Chrome DevTools → ApplicationタブでPWA確認）

---

## 注意事項

- GPS（`navigator.geolocation`）は**HTTPSまたはlocalhost**でのみ動作する
- 通知許可はユーザーが手動で許可する必要がある
- Open-Meteo APIはレート制限あり（1分間に数回程度に抑える）
- `data.json`の`events[].lat/lon`が未設定の場合はGPS距離計算をスキップする
