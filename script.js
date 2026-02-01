const CANVAS = document.getElementById('game-canvas');
const CTX = CANVAS.getContext('2d');
const GAME_WIDTH = CANVAS.width;
const GAME_HEIGHT = CANVAS.height;

// --- ゲーム状態 ---
let score = 0;
let playerHealth = 5;
let totalPoints = parseInt(localStorage.getItem('totalPoints') || "0");
let gameRunning = false;
let isUpgrading = false;
let lastShotTime = 0;
let enemies = [];
let bullets = [];
let spawnTimer = 0;

// --- 強化データ ---
let upgrades = {
    fireRate: { level: 1, label: "連射速度", baseCost: 10 },
    damage: { level: 1, label: "攻撃力", baseCost: 15 },
    bulletCount: { level: 1, label: "同時弾数", baseCost: 50 },
    speed: { level: 1, label: "弾速", baseCost: 10 }
};

const PLAYER = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 50, size: 20, speed: 6 };
let keys = {};

// --- イベントリスナー ---
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// --- 初期化 & タイトル ---
function initTitle() {
    document.getElementById('total-points-display').textContent = totalPoints;
    if (localStorage.getItem('savedGame')) {
        document.getElementById('btn-continue').classList.remove('hidden');
    }
}

function startGame(isContinue) {
    if (isContinue) {
        const data = JSON.parse(localStorage.getItem('savedGame'));
        upgrades = data.upgrades;
        score = data.score;
        playerHealth = data.health;
    }
    document.getElementById('title-screen').classList.add('hidden');
    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

// --- メインループ ---
function gameLoop(time) {
    if (!gameRunning) return;

    if (!isUpgrading) {
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function update() {
    // プレイヤー移動
    if (keys['ArrowLeft'] && PLAYER.x > 10) PLAYER.x -= PLAYER.speed;
    if (keys['ArrowRight'] && PLAYER.x < GAME_WIDTH - 10) PLAYER.x += PLAYER.speed;

    // 自動射撃 (スペース押下時)
    let fireInterval = 400 / upgrades.fireRate.level;
    if (keys['Space'] && Date.now() - lastShotTime > fireInterval) {
        shoot();
        lastShotTime = Date.now();
    }

    // 強化ボタンの表示チェック
    if (score >= 10) {
        document.getElementById('upgrade-trigger').classList.remove('hidden');
    }

    // 敵の生成
    spawnTimer++;
    if (spawnTimer > 100) {
        enemies.push({ x: Math.random() * (GAME_WIDTH - 30) + 15, y: -20, size: 30, health: 3 });
        spawnTimer = 0;
    }

    // 移動処理
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < 0) bullets.splice(i, 1);
    });

    enemies.forEach((e, i) => {
        e.y += 2;
        if (e.y > GAME_HEIGHT) {
            enemies.splice(i, 1);
            playerHealth--;
            if (playerHealth <= 0) endGame();
        }

        // 当たり判定
        bullets.forEach((b, bi) => {
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.size/2 + b.r) {
                e.health -= b.dmg;
                bullets.splice(bi, 1);
                if (e.health <= 0) {
                    enemies.splice(i, 1);
                    score += 1;
                }
            }
        });
    });

    document.getElementById('score-display').textContent = score;
    document.getElementById('health-display').textContent = playerHealth;
}

function shoot() {
    const count = upgrades.bulletCount.level;
    for (let i = 0; i < count; i++) {
        bullets.push({
            x: PLAYER.x + (i - (count-1)/2) * 10,
            y: PLAYER.y,
            r: 5,
            speed: 7 + upgrades.speed.level,
            dmg: upgrades.damage.level
        });
    }
}

function draw() {
    CTX.fillStyle = '#000';
    CTX.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // プレイヤー
    CTX.fillStyle = '#0f0';
    CTX.fillRect(PLAYER.x - 10, PLAYER.y - 10, 20, 20);

    // 敵
    CTX.fillStyle = '#f00';
    enemies.forEach(e => CTX.fillRect(e.x - 15, e.y - 15, 30, 30));

    // 弾
    CTX.fillStyle = '#ff0';
    bullets.forEach(b => {
        CTX.beginPath();
        CTX.arc(b.x, b.y, b.r, 0, Math.PI*2);
        CTX.fill();
    });
}

// --- 強化システム ---
function openUpgrade() {
    isUpgrading = true;
    document.getElementById('upgrade-screen').classList.remove('hidden');
    document.getElementById('upgrade-score').textContent = score;
    renderUpgrades();
}

function renderUpgrades() {
    const container = document.getElementById('upgrade-list');
    container.innerHTML = '';
    for (let key in upgrades) {
        let up = upgrades[key];
        let cost = up.level * up.baseCost;
        let btn = document.createElement('button');
        btn.innerHTML = `${up.label} Lv.${up.level}<br>(Cost: ${cost})`;
        btn.onclick = () => {
            if (score >= cost) {
                score -= cost;
                up.level++;
                openUpgrade();
            }
        };
        container.appendChild(btn);
    }
}

function closeUpgrade() {
    isUpgrading = false;
    document.getElementById('upgrade-screen').classList.add('hidden');
    if (score < 10) document.getElementById('upgrade-trigger').classList.add('hidden');
}

// --- セーブ & 終了 ---
function saveAndQuit() {
    const saveData = { upgrades, score, health: playerHealth };
    localStorage.setItem('savedGame', JSON.stringify(saveData));
    location.reload();
}

function endGame() {
    gameRunning = false;
    totalPoints += score;
    localStorage.setItem('totalPoints', totalPoints);
    localStorage.removeItem('savedGame'); // 死んだら続きからは消去
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

initTitle();
