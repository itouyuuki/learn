// ===========================
// アニメーション時間設定（ミリ秒）
// ===========================
const ANIMATION_CONFIG = {
    SHAKE_DURATION: 500,      // くじ箱シェイク時間
    SCROLL_DURATION: 1500,     // スロットスクロール時間
    RESULT_DELAY: 700,        // 結果表示後の待ち時間
    SCROLL_INTERVAL: 50,      // スクロール更新間隔
};

// ===========================
// 座席の定義（固定4席）
// ===========================
const SEATS = [
    { id: 'seat-0', label: '運転席' },
    { id: 'seat-1', label: '助手席' },
    { id: 'seat-2', label: '後部左' },
    { id: 'seat-3', label: '後部右' },
];

// ローカルストレージのキー
const LS_DRAWN_SEATS = 'seat_drawn_seats';   // 引いた座席のID配列

// ===========================
// ローカルストレージ操作
// ===========================

// 引いた座席の取得
function getDrawnSeats() {
    return JSON.parse(localStorage.getItem(LS_DRAWN_SEATS) || '[]');
}

// 引いた座席の保存
function saveDrawnSeats(seatIds) {
    localStorage.setItem(LS_DRAWN_SEATS, JSON.stringify(seatIds));
}

// 未引の座席を取得
function getAvailableSeats() {
    const drawnIds = getDrawnSeats();
    return SEATS.filter(seat => !drawnIds.includes(seat.id));
}

// ===========================
// 初期化
// ===========================
function init() {
    renderResults();   // 結果一覧を描画
    updateDrawBtn();   // ボタンの活性・非活性を更新

    // イベントリスナーの登録
    document.getElementById('draw-btn').addEventListener('click', draw);
    document.getElementById('reset-btn').addEventListener('click', reset);
    document.getElementById('slot-overlay').addEventListener('click', closeSlotOverlay);
}

// ===========================
// 結果一覧描画
// ===========================
function renderResults() {
    const drawnIds = getDrawnSeats();
    const resultList = document.getElementById('result-list');
    const resultEmpty = document.getElementById('result-empty');

    // 中身をクリア
    resultList.innerHTML = '';

    if (drawnIds.length === 0) {
        // 結果がない場合
        resultEmpty.style.display = 'block';
    } else {
        // 結果がある場合
        resultEmpty.style.display = 'none';

        drawnIds.forEach((seatId, index) => {
            const seat = SEATS.find(s => s.id === seatId);
            if (!seat) return;

            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div class="result-item__number">${index + 1}</div>
                <span class="result-item__seat">${seat.label}</span>
            `;

            resultList.appendChild(item);
        });
    }
}

// ===========================
// ボタン活性制御
// ===========================
function updateDrawBtn() {
    const availableSeats = getAvailableSeats();
    const drawBtn = document.getElementById('draw-btn');

    // 未引の座席がない場合は disabled
    if (availableSeats.length === 0) {
        drawBtn.disabled = true;
    } else {
        drawBtn.disabled = false;
    }
}

// ===========================
// くじ引きロジック
// ===========================
async function draw() {
    const availableSeats = getAvailableSeats();

    if (availableSeats.length === 0) return;

    // ランダムに1つ選ぶ
    const selectedSeat = availableSeats[Math.floor(Math.random() * availableSeats.length)];

    // ボタンを無効化
    const drawBtn = document.getElementById('draw-btn');
    drawBtn.disabled = true;

    // アニメーションを実行
    await playDrawAnimation(selectedSeat.label, availableSeats);

    // 結果を保存
    const drawnIds = getDrawnSeats();
    drawnIds.push(selectedSeat.id);
    saveDrawnSeats(drawnIds);

    // 再描画
    renderResults();
    updateDrawBtn();
}

// ===========================
// くじ引きアニメーション
// ===========================
function playDrawAnimation(resultSeatLabel, availableSeats) {
    return new Promise((resolve) => {
        const lotteryBox = document.getElementById('lottery-box');
        const overlay = document.getElementById('slot-overlay');
        const slotText = document.getElementById('slot-text');
        const config = ANIMATION_CONFIG;

        // ステップ1: くじ箱をシェイク
        lotteryBox.classList.add('lottery-box--shaking');
        setTimeout(() => {
            lotteryBox.classList.remove('lottery-box--shaking');
        }, config.SHAKE_DURATION);

        // シェイク完了後にスロット表示
        setTimeout(() => {
            // ステップ2: スロットオーバーレイを表示
            overlay.classList.add('slot-overlay--visible');

            // ステップ3: スロット高速スクロール
            let scrollInterval = setInterval(() => {
                const randomSeat = availableSeats[Math.floor(Math.random() * availableSeats.length)];
                slotText.textContent = randomSeat.label;
            }, config.SCROLL_INTERVAL);

            // ステップ4: スロットを止めて結果表示（バウンスイン）
            setTimeout(() => {
                clearInterval(scrollInterval);
                slotText.textContent = resultSeatLabel;
                slotText.classList.add('slot-text--result');

                // アニメーション完了を通知
                setTimeout(() => {
                    resolve();
                }, config.RESULT_DELAY);
            }, config.SCROLL_DURATION);
        }, config.SHAKE_DURATION);
    });
}

// ===========================
// スロットオーバーレイを閉じる
// ===========================
function closeSlotOverlay() {
    const overlay = document.getElementById('slot-overlay');
    const slotText = document.getElementById('slot-text');

    overlay.classList.remove('slot-overlay--visible');
    slotText.classList.remove('slot-text--result');
}

// ===========================
// リセット
// ===========================
function reset() {
    // localStorage から引いた座席を削除
    localStorage.removeItem(LS_DRAWN_SEATS);

    // 再描画
    renderResults();
    updateDrawBtn();
}

// ===========================
// 初期化実行
// ===========================
init();
