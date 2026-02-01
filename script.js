const CANVAS = document.getElementById('game-canvas');
const CTX = CANVAS.getContext('2d');
const GAME_WIDTH = CANVAS.width;
const GAME_HEIGHT = CANVAS.height;

// --- ゲーム設定 ---
let score = 0;
let playerHealth = 5;
let totalPoints = parseInt(localStorage.getItem('totalPoints') || "0");
let gameRunning = false;
let isUpgrading = false;
let enemies = [];
let bullets = [];
let particles = []; // 爆発エフェクト用
let spawnTimer = 0;
let lastShotTime = 0;

// プレイヤー設定（慣性システム）
const PLAYER = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 60,
    size: 20,
    vx: 0,          // 現在の速度
    accel: 0.9,     // 加速度
    friction: 0.82, // 摩擦（操作感のキレ）
    maxSpeed: 9
};

let upgrades = {
    fireRate: { level: 1, label: "連射速度", baseCost: 20 },
    damage: { level: 1, label: "攻撃力", baseCost: 30 },
    bulletCount: { level: 1, label: "拡散数", baseCost: 100 },
    speed: { level: 1, label: "弾速", baseCost: 15 }
};

let keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// --- システム関数 ---

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

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 20,
            color: color
        });
    }
}

function update() {
    // 慣性移動
    if (keys['ArrowLeft']) PLAYER.vx -= PLAYER.accel;
    if (keys['ArrowRight']) PLAYER.vx += PLAYER.accel;
    PLAYER.vx *= PLAYER.friction;
    PLAYER.x += PLAYER.vx;

    // 画面端制限
    if (PLAYER.x < 20) { PLAYER.x = 20; PLAYER.vx = 0; }
    if (PLAYER.x > GAME_WIDTH - 20) { PLAYER.x = GAME_WIDTH - 20; PLAYER.vx = 0; }

    // 連射
    let fireInterval = 400 / upgrades.fireRate.level;
    if (keys['Space'] && Date.now() - lastShotTime > fireInterval) {
        shoot();
        lastShotTime = Date.now();
    }

    if (score >= 10) document.getElementById('upgrade-trigger').classList.remove('hidden');

    // 敵の生成（スピードを遅く調整）
    spawnTimer++;
    if (spawnTimer > 80) {
        enemies.push({
            x: Math.random() * (GAME_WIDTH - 40) + 20,
            y: -30,
            size: 30,
            health: 3 * (1 + score/200),
            speed: 1.0 + Math.random() * 0.5 // 以前よりゆっくり
        });
        spawnTimer = 0;
    }

    // パーティクル更新
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    });

    // 弾丸更新
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < 0) bullets.splice(i, 1);
    });

    // 敵更新
    enemies.forEach((e, i) => {
        e.y += e.speed;
        if (e.y > GAME_HEIGHT) {
            enemies.splice(i, 1);
            playerHealth--;
            if (playerHealth <= 0) endGame();
        }

        bullets.forEach((b, bi) => {
            if (Math.hypot(e.x - b.x, e.y - b.y) < 15 + b.r) {
                e.health -= b.dmg;
                bullets.splice(bi, bi + 1);
                createExplosion(b.x, b.y, "#fff"); // ヒット火花
                if (e.health <= 0) {
                    createExplosion(e.x, e.y, "#f00"); // 撃破爆発
                    enemies.splice(i, 1);
                    score += 5;
                }
            }
        });
    });

    document.getElementById('score-display').textContent = Math.floor(score);
    document.getElementById('health-display').textContent = playerHealth;
}

function shoot() {
    const count = upgrades.bulletCount.level;
    for (let i = 0; i < count; i++) {
        let offset = (i - (count - 1) / 2) * 15;
        bullets.push({
            x: PLAYER.x + offset,
            y: PLAYER.y - 10,
            r: 4,
            speed: 8 + upgrades.speed.level,
            dmg: upgrades.damage.level
        });
    }
}

function draw() {
    CTX.fillStyle = '#000';
    CTX.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // プレイヤー（ネオン風）
    CTX.shadowBlur = 10; CTX.shadowColor = '#0f0';
    CTX.fillStyle = '#0f0';
    CTX.fillRect(PLAYER.x - 10, PLAYER.y - 10, 20, 20);

    // 敵
    CTX.shadowColor = '#f00';
    enemies.forEach(e => {
        CTX.fillStyle = '#f33';
        CTX.fillRect(e.x - 15, e.y - 15, 30, 30);
    });

    // 弾
    CTX.shadowColor = '#ff0';
    CTX.fillStyle = '#ff0';
    bullets.forEach(b => {
        CTX.beginPath(); CTX.arc(b.x, b.y, b.r, 0, Math.PI*2); CTX.fill();
    });

    // パーティクル
    CTX.shadowBlur = 0;
    particles.forEach(p => {
        CTX.fillStyle = p.color;
        CTX.globalAlpha = p.life / 20;
        CTX.fillRect(p.x, p.y, 3, 3);
    });
    CTX.globalAlpha = 1;
}

function gameLoop() {
    if (!gameRunning) return;
    if (!isUpgrading) { update(); draw(); }
    requestAnimationFrame(gameLoop);
}

function openUpgrade() {
    isUpgrading = true;
    document.getElementById('upgrade-screen').classList.remove('hidden');
    document.getElementById('upgrade-score').textContent = Math.floor(score);
    renderUpgrades();
}

function renderUpgrades() {
    const container = document.getElementById('upgrade-list');
    container.innerHTML = '';
    for (let key in upgrades) {
        let up = upgrades[key];
        let cost = up.level * up.baseCost;
        let btn = document.createElement('button');
        btn.innerHTML = `${up.label} Lv.${up.level}<br>COST: ${cost}`;
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
}

function saveAndQuit() {
    localStorage.setItem('savedGame', JSON.stringify({ upgrades, score, health: playerHealth }));
    location.reload();
}

function endGame() {
    gameRunning = false;
    totalPoints += Math.floor(score);
    localStorage.setItem('totalPoints', totalPoints);
    localStorage.removeItem('savedGame');
    document.getElementById('final-score').textContent = Math.floor(score);
    document.getElementById('game-over-screen').classList.remove('hidden');
}

initTitle();
