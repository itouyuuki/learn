// 旅のしおり PWA - メインアプリケーション
// ====================================

// グローバル変数
let appData = null;
let currentEvent = null;
let countdownTimerId = null;
let currentCoords = null;  // 現在地の座標
let weatherFetched = false;  // 天気を既に取得したか
let gpsTimeoutId = null;  // GPSタイムアウト用
let gpsTimeout = 10000;  // GPSタイムアウト（10秒）

// ====================================
// 初期化
// ====================================

async function initApp() {
    try {
        // データ読み込み
        const response = await fetch('data.json');
        appData = await response.json();

        // ページ判定
        const pageId = document.body.id;

        // 共通初期化
        initHeader();

        // ページ別初期化
        if (pageId === 'page-home') {
            initHomePage();
        } else if (pageId === 'page-schedule') {
            initSchedulePage();
        }

        // 通知許可リクエスト
        await requestNotificationPermission();

        // 通知スケジューリング
        scheduleNotifications();

    } catch (error) {
        console.error('初期化エラー:', error);
    }
}

// ====================================
// ヘッダー情報の反映
// ====================================

function initHeader() {
    const tripTitle = document.getElementById('trip-title');
    const tripDates = document.getElementById('trip-dates');
    const heroImage = document.getElementById('hero-image');
    const heroDestination = document.getElementById('hero-destination');
    const mapBtn = document.getElementById('map-btn');

    if (tripTitle) tripTitle.textContent = appData.title;

    if (tripDates) {
        const icon = tripDates.querySelector('.material-symbols-outlined');
        tripDates.innerHTML = '';
        if (icon) tripDates.appendChild(icon);
        tripDates.appendChild(document.createTextNode(' ' + appData.dates));
    }

    if (heroImage) {
        heroImage.style.backgroundImage = `url('${appData.hero_image}')`;
    }

    if (heroDestination) {
        heroDestination.textContent = appData.destination.name;
    }

    // 地図ボタンにGoogle Mapsのリンクを設定
    if (mapBtn && appData.destination.lat && appData.destination.lon) {
        const { lat, lon, name } = appData.destination;
        mapBtn.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    }
}

// ====================================
// ホームページ初期化
// ====================================

async function initHomePage() {
    // GPSタイムアウト設定：指定時間内にGPSが取得できない場合は旅行先の天気を表示
    gpsTimeoutId = setTimeout(() => {
        if (!currentCoords && !weatherFetched) {
            // GPS取得できなかった場合は旅行先の天気を表示
            fetchWeather(appData.destination.lat, appData.destination.lon, appData.destination.name);
        }
    }, gpsTimeout);

    initGPS();  // GPSを初期化
    initCountdown();
}

// ====================================
// 天気情報
// ====================================

// 天気を取得する関数（座標を指定）
async function fetchWeather(lat, lon, locationName = '現在地') {
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia/Tokyo`
        );
        const data = await response.json();
        const current = data.current;

        // DOM更新
        const weatherIcon = document.getElementById('weather-icon');
        const weatherTemp = document.getElementById('weather-temp');
        const weatherHumidity = document.getElementById('weather-humidity');
        const weatherWind = document.getElementById('weather-wind');

        if (weatherIcon) weatherIcon.src = wmoToIcon(current.weather_code);
        if (weatherTemp) {
            const descSpan = document.getElementById('weather-desc');
            if (descSpan) {
                weatherTemp.innerHTML = `${Math.round(current.temperature_2m)}°C <span id="weather-desc">${wmoToText(current.weather_code)}</span>`;
            } else {
                weatherTemp.innerHTML = `${Math.round(current.temperature_2m)}°C <span id="weather-desc">${wmoToText(current.weather_code)}</span>`;
            }
        }
        if (weatherHumidity) weatherHumidity.textContent = `${current.relative_humidity_2m}%`;
        if (weatherWind) weatherWind.textContent = `${current.wind_speed_10m}m/s`;

        // 見出しを更新
        updateWeatherLabel(locationName);

        weatherFetched = true;

    } catch (error) {
        console.error('天気取得エラー:', error);
        const weatherDesc = document.getElementById('weather-desc');
        if (weatherDesc) weatherDesc.textContent = '— オフライン中';
    }
}

// 天気カードの見出しを更新
function updateWeatherLabel(locationName) {
    const weatherLabel = document.querySelector('.weather-card .card__label');
    if (weatherLabel) {
        weatherLabel.textContent = `${locationName}の天気`;
    }
}

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
    // Amcharts アニメーションSVG天気アイコン
    const baseUrl = 'https://cdn.amcharts.com/lib/4/images/weather/animated/';

    if (code === 0)  return baseUrl + 'day.svg';           // 快晴
    if (code <= 2)   return baseUrl + 'cloudy-day-1.svg';  // 晴れ
    if (code <= 3)   return baseUrl + 'cloudy-day-3.svg';  // くもり
    if (code <= 49)  return baseUrl + 'fog.svg';            // もや・霧
    if (code <= 69)  return baseUrl + 'rainy-1.svg';        // 雨
    if (code <= 79)  return baseUrl + 'snowy-1.svg';        // 雪
    if (code <= 84)  return baseUrl + 'rainy-3.svg';        // にわか雨
    return baseUrl + 'thunder.svg';                          // 雷雨
}

// ====================================
// カウントダウンタイマー
// ====================================

function initCountdown() {
    // 全イベントをフラット化して日時順にソート
    const allEvents = [];
    appData.days.forEach(day => {
        day.events.forEach(ev => {
            allEvents.push({
                ...ev,
                date: day.date,
                dayLabel: day.label
            });
        });
    });

    // 日時でソート
    allEvents.sort((a, b) => {
        const dtA = new Date(`${a.date}T${a.time}`);
        const dtB = new Date(`${b.date}T${b.time}`);
        return dtA - dtB;
    });

    // 各イベントに日時オブジェクトを追加
    allEvents.forEach(ev => {
        ev.dt = new Date(`${ev.date}T${ev.time}`);
    });

    updateCountdown(allEvents);

    // 1秒ごとに更新
    countdownTimerId = setInterval(() => {
        updateCountdown(allEvents);
    }, 1000);
}

function updateCountdown(events) {
    const now = new Date();

    // 旅行開始前
    const firstEvent = events[0];
    if (now < firstEvent.dt) {
        currentEvent = firstEvent;
        const diff = firstEvent.dt - now;
        updateCountdownUI(firstEvent.name, formatTime(diff), '開始まで');
        return;
    }

    // 旅行終了後
    const lastEvent = events[events.length - 1];
    if (now > lastEvent.dt) {
        currentEvent = null;
        updateCountdownUI('旅が終わりました', '', '');
        return;
    }

    // 進行中または次のイベント
    let nextEvent = null;
    for (let i = 0; i < events.length; i++) {
        if (now < events[i].dt) {
            nextEvent = events[i];
            break;
        }
    }

    if (nextEvent) {
        const diff = nextEvent.dt - now;
        updateCountdownUI(nextEvent.name, formatTime(diff), '開始まで');
        currentEvent = nextEvent;
    } else {
        updateCountdownUI('旅が終わりました', '', '');
    }
}

function updateCountdownUI(eventName, timer, label) {
    const countdownEvent = document.getElementById('countdown-event');
    const countdownTimer = document.getElementById('countdown-timer');
    const countdownLabel = document.getElementById('countdown-label');

    if (countdownEvent) countdownEvent.textContent = eventName;
    if (countdownTimer) countdownTimer.textContent = timer;
    if (countdownLabel) countdownLabel.textContent = label;
}

function formatTime(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ====================================
// GPS・現在地情報
// ====================================

function initGPS() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => updateGPS(pos.coords),
            (err) => showGPSError(err),
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
    }
}

function updateGPS(coords) {
    const gpsCoords = document.getElementById('gps-coords');
    const gpsAltitude = document.getElementById('gps-altitude');

    // 座標を保存
    currentCoords = coords;

    // タイムアウトをクリア
    if (gpsTimeoutId) {
        clearTimeout(gpsTimeoutId);
        gpsTimeoutId = null;
    }

    // 座標表示
    if (gpsCoords) {
        gpsCoords.textContent = `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;
    }

    // 標高表示
    if (gpsAltitude) {
        if (coords.altitude !== null) {
            gpsAltitude.textContent = `${Math.round(coords.altitude)}m`;
        } else {
            // 国土地理院APIで標高取得
            fetchElevation(coords.latitude, coords.longitude);
        }
    }

    // 現在地の天気を取得（初回のみ）
    if (!weatherFetched && currentCoords) {
        // 地名を取得してから天気を表示
        fetchLocationName(currentCoords.latitude, currentCoords.longitude)
            .then(locationName => {
                fetchWeather(currentCoords.latitude, currentCoords.longitude, locationName);
            })
            .catch(() => {
                // 地名取得失敗時は「現在地」を表示
                fetchWeather(currentCoords.latitude, currentCoords.longitude, '現在地');
            });
    }

    // 次目的地までの距離
    if (currentEvent && currentEvent.lat !== undefined) {
        const distance = calcDistance(
            coords.latitude,
            coords.longitude,
            currentEvent.lat,
            currentEvent.lon
        );

        const destName = document.getElementById('gps-dest-name');
        const destDist = document.getElementById('gps-distance');
        const mapBtn = document.getElementById('map-btn');

        if (destName) destName.textContent = currentEvent.name;
        if (destDist) destDist.textContent = distance;

        // 地図ボタンを次の目的地に更新
        if (mapBtn) {
            if (currentEvent.googleMapsUrl) {
                // Google Maps URLが直接指定されている場合はそれを使用
                mapBtn.href = currentEvent.googleMapsUrl;
            } else if (currentEvent.lat && currentEvent.lon) {
                // 座標からGoogle Maps URLを生成
                mapBtn.href = `https://www.google.com/maps/search/?api=1&query=${currentEvent.lat},${currentEvent.lon}`;
            }
        }
    }
}

function showGPSError(err) {
    console.error('GPSエラー:', err);
    // GPS取得失敗時は旅行先の天気を表示
    if (!weatherFetched) {
        fetchWeather(appData.destination.lat, appData.destination.lon, appData.destination.name);
    }
}

// 座標から地名を取得（逆ジオコーディング）
async function fetchLocationName(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ja`
        );
        const data = await response.json();

        // 地名を抽出（市区町村レベル）
        if (data.address) {
            const addr = data.address;
            // 優先順位: 市区町村 > 都道府県 > 地域名
            return addr.city || addr.town || addr.village || addr.county || addr.prefecture || addr.state || '現在地';
        }

        return '現在地';
    } catch (error) {
        console.error('地名取得エラー:', error);
        return '現在地';
    }
}

async function fetchElevation(lat, lon) {
    try {
        const response = await fetch(
            `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`
        );
        const data = await response.json();
        const gpsAltitude = document.getElementById('gps-altitude');
        if (gpsAltitude && data.elevation) {
            gpsAltitude.textContent = `${Math.round(data.elevation)}m`;
        }
    } catch (error) {
        console.error('標高取得エラー:', error);
    }
}

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

// ====================================
// スケジュールページ初期化
// ====================================

function initSchedulePage() {
    const dayTabs = document.getElementById('day-tabs');
    const timelineContainer = document.getElementById('timeline-container');

    if (!dayTabs || !timelineContainer) return;

    // 日付タブとタイムラインを生成
    timelineContainer.innerHTML = '';

    const now = new Date();

    appData.days.forEach((day, index) => {
        // 日付ヘッダー
        const dateObj = new Date(day.date);
        const dateStr = formatDate(dateObj);
        const eventCount = day.events.length;

        const headerHtml = `
            <div class="schedule-content__header" id="day-${day.day}">
                <h3 class="schedule-content__date">${dateStr}</h3>
                <span class="badge badge--primary">${eventCount}つの予定</span>
            </div>
        `;

        // タイムライン生成
        let timelineHtml = '<div class="timeline"><div class="timeline__line"></div>';

        day.events.forEach(ev => {
            const evDt = new Date(`${day.date}T${ev.time}`);
            let statusClass = '';
            let activeBadge = '';
            let upcomingHint = '';

            if (evDt < now) {
                statusClass = 'timeline__item--past';
            } else if (evDt >= now && evDt < new Date(now.getTime() + 2 * 60 * 60 * 1000)) {
                // 2時間以内を「現在進行中」とみなす
                statusClass = '';
                activeBadge = '<div class="timeline__active-badge">現在進行中</div>';
            } else {
                upcomingHint = '<p class="timeline__upcoming-hint">これからの予定</p>';
            }

            timelineHtml += `
                <div class="timeline__item ${statusClass}">
                    <div class="timeline__icon-col">
                        <div class="timeline__icon-wrap ${activeBadge ? 'timeline__icon-wrap--active' : ''}">
                            <span class="material-symbols-outlined">${ev.icon}</span>
                        </div>
                    </div>
                    <div class="timeline__card ${activeBadge ? 'timeline__card--active' : ''}">
                        ${activeBadge}
                        <div class="timeline__card-header">
                            <p class="timeline__event-title ${activeBadge ? 'timeline__event-title--active' : ''}">
                                ${ev.time} ${ev.name}
                            </p>
                            ${!activeBadge && evDt < now ? '<span class="timeline__status-badge">完了</span>' : ''}
                        </div>
                        <p class="timeline__event-note">${ev.note}</p>
                        ${upcomingHint}
                    </div>
                </div>
            `;
        });

        timelineHtml += '</div>';

        timelineContainer.innerHTML += headerHtml + timelineHtml;
    });

    // タブクリックイベント
    const tabs = dayTabs.querySelectorAll('.day-tab');
    tabs.forEach((tab, index) => {
        tab.href = `#day-${index + 1}`;
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(`#day-${index + 1}`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

function formatDate(date) {
    const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日 ${weekday}`;
}

// ====================================
// 通知
// ====================================

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function scheduleNotifications() {
    if (!appData) return;

    const now = Date.now();
    const allEvents = [];

    appData.days.forEach(day => {
        day.events.forEach(ev => {
            allEvents.push({
                ...ev,
                date: day.date,
                dt: new Date(`${day.date}T${ev.time}`)
            });
        });
    });

    allEvents.forEach(ev => {
        const eventTime = ev.dt.getTime();
        const notifyTime = eventTime - 15 * 60 * 1000; // 15分前
        const delay = notifyTime - now;

        if (delay > 0) {
            setTimeout(() => {
                if (Notification.permission === 'granted') {
                    new Notification('旅のしおり', {
                        body: `まもなく「${ev.name}」が始まります（15分前）`,
                        icon: 'images/pwa.jpg'
                    });
                }
            }, delay);
        }
    });
}

// ====================================
// アプリ起動
// ====================================

document.addEventListener('DOMContentLoaded', initApp);
