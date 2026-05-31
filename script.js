const canvas = document.getElementById('arenaCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const menuScreen = document.getElementById('menu-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const lbContent = document.getElementById('lb-content');
const playerScoreEl = document.getElementById('player-score');
const staminaBar = document.getElementById('stamina-bar');
const staminaText = document.getElementById('stamina-text');
const deathReasonEl = document.getElementById('death-reason');
const nickInput = document.getElementById('nickname');
const diffButtons = document.querySelectorAll('.diff-btn');
const rulesBox = document.getElementById('rules-box');
const devGuidePanel = document.getElementById('dev-guide-panel');

// Constants
const WORLD_WIDTH = 2500;
const WORLD_HEIGHT = 2500;
const FOOD_COUNT = 120;
const BOT_COUNT = 18;

// State Variables
let player = null;
let entities = []; 
let isRunning = false;
let selectedDifficulty = "easy";

let stamina = 100;
const STAMINA_DRAIN = 0.6; 
const STAMINA_RECHARGE = 0.35;
let isSprintSpunOut = false; 

const keys = { arrowup: false, arrowdown: false, arrowleft: false, arrowright: false, q: false };
const colors = {
    2: '#3b82f6', 4: '#6366f1', 8: '#8b5cf6', 16: '#ec4899',
    32: '#f43f5e', 64: '#e11d48', 128: '#f59e0b', 256: '#d97706',
    512: '#10b981', 1024: '#059669', 2048: '#06b6d4', 4096: '#475569'
};
const botNames = ["Alpha", "Shadow", "Wrecker", "Nexus", "Glitch", "Titan", "Vortex", "Frost", "Chrono", "Specter"];

const difficultyRules = {
    easy: "• **Easy Mode**: Most opponents start smaller than you.",
    medium: "• **Medium Mode**: Balanced. 50% are smaller, 50% are stronger.",
    hard: "• **Hard Mode**: Hostile. 75% spawn with higher values.",
    impossible: "• **Impossible Mode**: Cosmic Threat. Eat gray food cells exclusively to start."
};

// Toggle Side Guide Panel Layout
function toggleGuide() {
    devGuidePanel.classList.toggle('closed');
    setTimeout(resizeCanvas, 310);
}

// Menu Difficulty Switcher Layout
diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDifficulty = btn.getAttribute('data-diff');
        rulesBox.innerHTML = difficultyRules[selectedDifficulty];
    });
});

class CubeEntity {
    constructor(x, y, value, name, isBot = false, isFood = false) {
        this.x = x; this.y = y; this.value = value; this.name = name; this.isBot = isBot; this.isFood = isFood;
        this.baseSize = 40; this.size = this.calculateSize();
        this.angle = Math.random() * Math.PI * 2;
        this.speed = isFood ? 0 : 3.5;
        this.scaleAnimation = 1;
    }
    calculateSize() { return this.baseSize + Math.log2(this.value) * 4; }
    update() {
        if (this.isFood) return;
        if (this.isBot) {
            if (Math.random() < 0.015) {
                this.angle = Math.random() * Math.PI * 2;
                let target = entities.find(e => e.value < this.value && Math.hypot(e.x - this.x, e.y - this.y) < 350);
                if(target) this.angle = Math.atan2(target.y - this.y, target.x - this.x);
            }
            this.x += Math.cos(this.angle) * this.speed; this.y += Math.sin(this.angle) * this.speed;
        } else {
            let dx = 0; let dy = 0;
            if (keys.arrowup) dy -= 1; if (keys.arrowdown) dy += 1;
            if (keys.arrowleft) dx -= 1; if (keys.arrowright) dx += 1;

            if (dx !== 0 || dy !== 0) {
                this.angle = Math.atan2(dy, dx);
                let currentMoveSpeed = this.speed;
                if (keys.q && stamina > 0 && !isSprintSpunOut) {
                    currentMoveSpeed *= 1.8; stamina -= STAMINA_DRAIN;
                    if(stamina <= 0) { stamina = 0; isSprintSpunOut = true; }
                } else {
                    if(stamina < 100) {
                        stamina += STAMINA_RECHARGE;
                        if(stamina >= 20) isSprintSpunOut = false;
                        if(stamina > 100) stamina = 100;
                    }
                }
                this.x += Math.cos(this.angle) * currentMoveSpeed; this.y += Math.sin(this.angle) * currentMoveSpeed;
            } else {
                if(stamina < 100) {
                    stamina += STAMINA_RECHARGE;
                    if(stamina >= 20) isSprintSpunOut = false;
                    if(stamina > 100) stamina = 100;
                }
            }
            updateStaminaMeter();
        }
        this.x = Math.max(this.size/2, Math.min(WORLD_WIDTH - this.size/2, this.x));
        this.y = Math.max(this.size/2, Math.min(WORLD_HEIGHT - this.size/2, this.y));
        let targetSize = this.calculateSize();
        if (Math.abs(this.size - targetSize) > 0.1) this.size += (targetSize - this.size) * 0.1;
        this.scaleAnimation += (1 - this.scaleAnimation) * 0.1;
    }
    draw(camX, camY) {
        let screenX = this.x - camX + canvas.width / 2;
        let screenY = this.y - camY + canvas.height / 2;
        if (screenX + this.size < 0 || screenX - this.size > canvas.width || screenY + this.size < 0 || screenY - this.size > canvas.height) return;
        ctx.save(); ctx.translate(screenX, screenY); ctx.rotate(this.angle); ctx.scale(this.scaleAnimation, this.scaleAnimation);
        ctx.fillStyle = this.isFood ? '#282835' : (colors[this.value] || '#c026d3');
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-this.size/2, -this.size/2, this.size, this.size, this.isFood ? 5 : 10);
        else ctx.rect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.fill(); ctx.strokeStyle = this.isFood ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        if (!this.isFood) {
            ctx.save(); ctx.translate(screenX, screenY); ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(11, this.size * 0.28)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(this.value, 0, 0); ctx.fillStyle = this.isBot ? '#94a3b8' : '#00f2fe'; ctx.font = 'bold 11px sans-serif';
            ctx.fillText(this.name, 0, -this.size / 2 - 10); ctx.restore();
        }
    }
}

function updateStaminaMeter() {
    let offset = 88 - (88 * (stamina / 100));
    staminaBar.style.strokeDashoffset = offset;
    staminaText.innerText = Math.round(stamina) + "%";
    if(isSprintSpunOut || stamina < 20) { staminaBar.classList.add('low'); staminaText.style.color = "#ef4444"; }
    else { staminaBar.classList.remove('low'); staminaText.style.color = "#fff"; }
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);

window.addEventListener('keydown', (e) => { const key = e.key.toLowerCase(); if (key in keys) keys[key] = true; });
window.addEventListener('keyup', (e) => { const key = e.key.toLowerCase(); if (key in keys) keys[key] = false; });

function spawnFood(count = 1) {
    for(let i=0; i<count; i++) entities.push(new CubeEntity(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, Math.random() > 0.85 ? 4 : 2, "", false, true));
}

function generateBotValue(index, totalCount, userVal) {
    if (selectedDifficulty === "easy") return Math.random() > 0.75 ? userVal * 2 : 2;
    if (selectedDifficulty === "medium") return index < totalCount / 2 ? 2 : userVal * 4;
    if (selectedDifficulty === "hard") return index < totalCount * 0.25 ? 2 : userVal * 8;
    if (selectedDifficulty === "impossible") return userVal * (Math.floor(Math.random() * 8) + 4);
    return 2;
}

function spawnBot(count = 1) {
    for(let i=0; i<count; i++){
        let name = botNames[Math.floor(Math.random() * botNames.length)] + " " + Math.floor(Math.random()*90 + 10);
        let currentTargetValue = player ? player.value : 2;
        entities.push(new CubeEntity(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, generateBotValue(i, count, currentTargetValue), name, true, false));
    }
}

function setupArena() {
    entities = []; stamina = 100; isSprintSpunOut = false;
    let nick = nickInput.value.trim() || "Player";
    player = new CubeEntity(WORLD_WIDTH/2, WORLD_HEIGHT/2, 2, nick, false, false);
    for (let k in keys) keys[k] = false;
    playerScoreEl.innerText = player.value;
    spawnFood(FOOD_COUNT); spawnBot(BOT_COUNT);
}

function handleCollisions() {
    if (!player) return;
    for (let i = 0; i < entities.length; i++) {
        let ent = entities[i]; let dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        if (dist < (player.size / 2 + ent.size / 2)) {
            if (ent.isFood) {
                player.value += ent.value; player.scaleAnimation = 1.25; playerScoreEl.innerText = player.value;
                entities.splice(i, 1); i--; spawnFood(1);
            } else {
                if (player.value > ent.value) {
                    player.value += ent.value; player.scaleAnimation = 1.3; playerScoreEl.innerText = player.value;
                    entities.splice(i, 1); i--; spawnBot(1);
                } else if (player.value < ent.value) {
                    ent.value += player.value; ent.scaleAnimation = 1.3; gameOver(ent.name); return;
                }
            }
        }
    }
    let botsOnly = entities.filter(e => e.isBot);
    for(let i=0; i<botsOnly.length; i++) {
        let b1 = botsOnly[i];
        for(let j=i+1; j<botsOnly.length; j++) {
            let b2 = botsOnly[j]; let dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            if(dist < (b1.size/2 + b2.size/2)) {
                if(b1.value > b2.value) { b1.value += b2.value; b1.scaleAnimation = 1.2; removeEntity(b2); spawnBot(1); }
                else if (b2.value > b1.value) { b2.value += b1.value; b2.scaleAnimation = 1.2; removeEntity(b1); spawnBot(1); }
            }
        }
        for(let f = 0; f < entities.length; f++) {
            let food = entities[f];
            if(food.isFood) {
                let dist = Math.hypot(b1.x - food.x, b1.y - food.y);
                if(dist < (b1.size/2 + food.size/2)) { b1.value += food.value; entities.splice(f, 1); f--; spawnFood(1); }
            }
        }
    }
}

function removeEntity(obj) { let idx = entities.indexOf(obj); if(idx !== -1) entities.splice(idx, 1); }

function updateLeaderboard() {
    if (!player) return;
    let list = [player, ...entities.filter(e => e.isBot)];
    list.sort((a, b) => b.value - a.value);
    let html = "";
    list.slice(0, 5).forEach((ent, idx) => {
        html += `<div class="lb-entry ${ent === player ? 'highlight' : ''}"><span>${idx+1}. ${ent.name}</span><span>${ent.value}</span></div>`;
    });
    lbContent.innerHTML = html;
}

function drawGrid(camX, camY) {
    ctx.strokeStyle = '#14141f'; ctx.lineWidth = 1;
    let startX = Math.floor((camX - canvas.width/2) / 60) * 60; let endX = Math.ceil((camX + canvas.width/2) / 60) * 60;
    let startY = Math.floor((camY - canvas.height/2) / 60) * 60; let endY = Math.ceil((camY + canvas.height/2) / 60) * 60;
    for(let x = startX; x < endX; x += 60) { ctx.beginPath(); ctx.moveTo(x - camX + canvas.width/2, 0); ctx.lineTo(x - camX + canvas.width/2, canvas.height); ctx.stroke(); }
    for(let y = startY; y < endY; y += 60) { ctx.beginPath(); ctx.moveTo(0, y - camY + canvas.height/2); ctx.lineTo(canvas.width, y - camY + canvas.height/2); ctx.stroke(); }
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 5; ctx.strokeRect(0 - camX + canvas.width/2, 0 - camY + canvas.height/2, WORLD_WIDTH, WORLD_HEIGHT);
}

function loop() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let camX = player.x; let camY = player.y;
    drawGrid(camX, camY);
    entities.forEach(ent => { ent.update(); ent.draw(camX, camY); });
    player.update(); player.draw(camX, camY);
    handleCollisions(); updateLeaderboard();
    requestAnimationFrame(loop);
}

function startGame() {
    menuScreen.classList.add('hidden'); gameOverScreen.classList.add('hidden');
    resizeCanvas(); setupArena(); isRunning = true; updateLeaderboard(); loop();
}

function gameOver(killerName) { isRunning = false; deathReasonEl.innerText = `Eaten by ${killerName} on ${selectedDifficulty.toUpperCase()}!`; gameOverScreen.classList.remove('hidden'); }
function showMenu() { gameOverScreen.classList.add('hidden'); menuScreen.classList.remove('hidden'); }

resizeCanvas();