// --- ゲーム設定 ---
const CANVAS = document.getElementById('game-canvas');
const CTX = CANVAS.getContext('2d');
const GAME_WIDTH = CANVAS.width;
const GAME_HEIGHT = CANVAS.height;

const BASE_SCORE_TO_UPGRADE = 10; 
let score = 0; 
let playerHealth = 5;
let gameRunning = true;
let isUpgrading = false;
let isMobileSession = false; 

const BASE_ENEMY_SIZE = 30; 
const MOBILE_ENEMY_SCALE = 1.5; 
const MAX_ENEMIES = 20; // 敵の最大出現数

// --- プレイヤーと弾丸の設定 ---
const PLAYER = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 50,
    size: 20,
    speed: 5
};
let bullets = [];
let lastShotTime = 0;

// --- 敵の設定 ---
let enemies = [];
let enemySpawnTimer = 0;
let enemiesKilled = 0; 
const ENEMY_HEALTH = 6;
const ENEMY_VALUE = 3; 

// --- 強化レベル管理 ---
const UPGRADES = {
    fireRate: { level: 1, baseInterval: 400, cost: 200, label: "連射速度" }, 
    bulletCount: { level: 1, baseCount: 1, cost: 200, label: "同時弾数" },
    bounce: { level: 0, baseChance: 0.1, cost: 200, label: "バウンド弾" }, 
    damage: { level: 1, baseDamage: 1, cost: 200, label: "ダメージアップ" },        
    speed: { level: 1, baseSpeed: 10, cost: 200, label: "弾丸速度" },             
    radius: { level: 1, baseRadius: 4, cost: 200, label: "当たり判定拡大" },
    autoAim: { level: 0, baseAimStrength: 0.005, cost: 200, label: "オートエイム" } 
};

// --- 入力処理 ---
let keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault(); 
});
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

let isTouching = false; 
let touchX = GAME_WIDTH / 2; 

CANVAS.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    isMobileSession = true; 
    isTouching = true;
    const rect = CANVAS.getBoundingClientRect();
    const scaleX = CANVAS.width / rect.width; 
    touchX = (e.touches[0].clientX - rect.left) * scaleX;
}, { passive: false });

CANVAS.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = CANVAS.getBoundingClientRect();
    const scaleX = CANVAS.width / rect.width;
    touchX = (e.touches[0].clientX - rect.left) * scaleX;
}, { passive: false });

CANVAS.addEventListener('touchend', () => { isTouching = false; }, { passive: false });

// --- ユーティリティ ---
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function getTotalUpgradeLevel() {
    let total = 0;
    for (const key in UPGRADES) { total += UPGRADES[key].level; }
    return total - 6; 
}

// --- 描画 ---
function draw() {
    CTX.fillStyle = '#000';
    CTX.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    CTX.fillStyle = 'lime';
    CTX.fillRect(PLAYER.x - PLAYER.size / 2, PLAYER.y - PLAYER.size / 2, PLAYER.size, PLAYER.size);

    bullets.forEach(bullet => {
        CTX.fillStyle = bullet.isBounce ? 'orange' : (bullet.isAim ? 'cyan' : 'yellow');
        CTX.beginPath();
        CTX.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        CTX.fill();
    });

    enemies.forEach(enemy => {
        CTX.fillStyle = 'red';
        CTX.fillRect(enemy.x - enemy.size / 2, enemy.y - enemy.size / 2, enemy.size, enemy.size);
        const healthRatio = enemy.health / ENEMY_HEALTH;
        CTX.fillStyle = 'green';
        CTX.fillRect(enemy.x - enemy.size / 2, enemy.y - enemy.size / 2 - 10, enemy.size * healthRatio, 5);
    });

    document.getElementById('score-display').textContent = Math.floor(score); 
    document.getElementById('health-display').textContent = playerHealth;
}

// --- 更新ロジック ---
function update(deltaTime) {
    if (!gameRunning || isUpgrading) return;

    // プレイヤー移動
    if (isTouching) {
        PLAYER.x += (touchX - PLAYER.x) * 0.25;
        PLAYER.x = Math.min(GAME_WIDTH - PLAYER.size / 2, Math.max(PLAYER.size / 2, PLAYER.x));
    } else {
        if (keys['ArrowLeft'] && PLAYER.x > PLAYER.size / 2) PLAYER.x -= PLAYER.speed;
        if (keys['ArrowRight'] && PLAYER.x < GAME_WIDTH - PLAYER.size / 2) PLAYER.x += PLAYER.speed;
    }

    // 発射
    const now = Date.now();
    const fireInterval = UPGRADES.fireRate.baseInterval / UPGRADES.fireRate.level; 
    if ((isMobileSession || keys['Space']) && (now - lastShotTime > fireInterval)) {
        shoot();
        lastShotTime = now;
    }

    // 弾丸更新
    bullets = bullets.filter(bullet => {
        bullet.x += (bullet.velX || 0) * (deltaTime / 16);
        bullet.y += (bullet.velY || -bullet.speed) * (deltaTime / 16);
        return bullet.y > 0 && bullet.x > 0 && bullet.x < GAME_WIDTH; 
    });

    // --- 敵の出現ロジック (修正版) ---
    enemySpawnTimer += deltaTime;
    const difficultyFactor = (getTotalUpgradeLevel() / 10) + (enemiesKilled / 100);
    const spawnInterval = Math.max(200, 3000 - difficultyFactor * 100); 

    if (enemySpawnTimer >= spawnInterval) {
        // 現在の敵の数が20体未満のときだけ新しく作る
        if (enemies.length < MAX_ENEMIES) {
            spawnEnemy();
        }
        enemySpawnTimer = 0; // タイマーをリセットして次を待つ
    }
    
    // 敵の移動と画面外判定
    enemies.forEach(enemy => { enemy.y += enemy.speed * (deltaTime / 16); });
    enemies = enemies.filter(enemy => {
        if (enemy.y < GAME_HEIGHT + enemy.size / 2) return true;
        playerHealth--;
        if (playerHealth <= 0) gameOver();
        return false;
    });

    checkCollisions();

    if (!isUpgrading && score >= BASE_SCORE_TO_UPGRADE) enterUpgradeScreen();
}

function findClosestEnemy() {
    let closestEnemy = null;
    let minDistance = Infinity;
    enemies.forEach(enemy => {
        const dist = distance(PLAYER.x, PLAYER.y, enemy.x, enemy.y);
        if (dist < minDistance) {
            minDistance = dist;
            closestEnemy = enemy;
        }
    });
    return (closestEnemy && closestEnemy.y > GAME_HEIGHT * 0.8) ? null : closestEnemy;
}

function shoot() {
    const count = UPGRADES.bulletCount.level;
    const spreadAngle = 10; 
    const currentSpeed = UPGRADES.speed.baseSpeed * UPGRADES.speed.level;
    const currentDamage = UPGRADES.damage.baseDamage * UPGRADES.damage.level;
    const currentRadius = UPGRADES.radius.baseRadius * UPGRADES.radius.level;
    
    let aimCorrection = 0;
    const closestEnemy = findClosestEnemy();
    if (closestEnemy && UPGRADES.autoAim.level > 0) {
        const targetAngle = Math.atan2(closestEnemy.x - PLAYER.x, PLAYER.y - closestEnemy.y);
        aimCorrection = targetAngle * (UPGRADES.autoAim.baseAimStrength * UPGRADES.autoAim.level);
    }

    for (let i = 0; i < count; i++) {
        let angleOffset = (count > 1) ? (i - (count - 1) / 2) * spreadAngle : 0;
        const angleRad = (angleOffset * (Math.PI / 180)) - aimCorrection; 

        bullets.push({
            x: PLAYER.x, y: PLAYER.y, radius: currentRadius, speed: currentSpeed,
            damage: currentDamage, velX: Math.sin(angleRad) * currentSpeed,
            velY: -Math.cos(angleRad) * currentSpeed, isBounce: false,
            isAim: UPGRADES.autoAim.level > 0 && count === 1 
        });
    }
}

function spawnEnemy() {
    const enemySize = isMobileSession ? BASE_ENEMY_SIZE * MOBILE_ENEMY_SCALE : BASE_ENEMY_SIZE;
    enemies.push({
        x: Math.random() * (GAME_WIDTH - 60) + 30,
        y: -30, size: enemySize, speed: 1.2, health: ENEMY_HEALTH
    });
}

function checkCollisions() {
    let newBullets = [];
    const totalLevel = getTotalUpgradeLevel();
    const finalEnemyValue = Math.max(0.1, ENEMY_VALUE - (totalLevel * 0.02)); 

    enemies.forEach(enemy => {
        bullets.forEach(bullet => {
            if (!bullet.hit && distance(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.size / 2 + bullet.radius) {
                enemy.health -= bullet.damage;
                bullet.hit = true; 
                
                if (Math.random() < UPGRADES.bounce.level * 0.1) {
                    const bounceAngle = Math.random() * Math.PI * 2; 
                    newBullets.push({
                        x: bullet.x, y: bullet.y, radius: 3, speed: bullet.speed * 0.7,
                        damage: bullet.damage / 2, velX: Math.sin(bounceAngle) * (bullet.speed * 0.7),
                        velY: Math.cos(bounceAngle) * (bullet.speed * 0.7), isBounce: true 
                    });
                }
            }
        });
    });

    enemies = enemies.filter(enemy => {
        if (enemy.health <= 0) {
            score += finalEnemyValue; 
            enemiesKilled++; 
            return false;
        }
        return true;
    });
    bullets = bullets.filter(bullet => !bullet.hit).concat(newBullets);
}

function gameOver() {
    gameRunning = false;
    document.getElementById('final-score').textContent = Math.floor(score); 
    document.getElementById('game-over-screen').style.display = 'flex';
}

function enterUpgradeScreen() {
    isUpgrading = true;
    const keys = Object.keys(UPGRADES);
    keys.forEach(key => {
        const el = document.getElementById(`lv-${key}`);
        if (el) el.textContent = UPGRADES[key].level;
    });
    document.getElementById('upgrade-score').textContent = Math.floor(score);
    document.getElementById('upgrade-screen').style.display = 'flex';
}

window.applyUpgrade = function(type) {
    if (score < BASE_SCORE_TO_UPGRADE) {
        document.getElementById('upgrade-message').textContent = 'スコア不足！';
        return;
    }
    UPGRADES[type].level++;
    score -= BASE_SCORE_TO_UPGRADE; 
    document.getElementById('lv-' + type).textContent = UPGRADES[type].level;
    document.getElementById('upgrade-score').textContent = Math.floor(score);
    document.getElementById('score-display').textContent = Math.floor(score);

    if (score < BASE_SCORE_TO_UPGRADE) {
        isUpgrading = false;
        document.getElementById('upgrade-screen').style.display = 'none';
    }
};

let lastTime = 0;
function gameLoop(currentTime) {
    let deltaTime = lastTime === 0 ? 0 : Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;
    update(deltaTime);
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop(0);