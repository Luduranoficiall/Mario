'use strict'

/* ===========================================================
   CAPITÃO SALTO — engine de runner turbinado (100% Canvas)
   - Mundo e herói (fundo, obstáculos, moedas, power-ups, chefe,
     partículas, personagem) desenhados num único <canvas>.
   - Física própria (gravidade, pulo variável, pulo duplo).
   - Vidas, mundos temáticos (4 estilos), chefes variados,
     inimigos, blocos "?" e fases com dificuldade crescente.
   - Personagem, cenário e trilha sonora são todos originais,
     gerados por código (sem imagens/áudio externos).
   =========================================================== */

// ---------- Canvas e contexto ----------
const canvas = document.getElementById('world')
const ctx = canvas.getContext('2d')
const game = document.getElementById('game')

let W = 0, H = 0, DPR = 1
let groundH = 64
let groundY = 0

function resize() {
    const r = game.getBoundingClientRect()
    W = r.width
    H = r.height
    DPR = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * DPR)
    canvas.height = Math.round(H * DPR)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    groundH = W < 600 ? 48 : 64
    groundY = H - groundH
    // dimensões do herói proporcionais à tela
    player.w = W < 600 ? 56 : 76
    player.h = Math.round(player.w * 1.3)
    player.x = Math.max(40, W * 0.14)
    if (state !== STATE.PLAYING && state !== STATE.BOSS) {
        player.y = groundY - player.h
    }
}

// ---------- Imagens do cenário (só o que é 100% genérico/original) ----------
const imgClouds = new Image(); imgClouds.src = 'img/clouds.png'

// ---------- Elementos de HUD / telas ----------
const hud = document.getElementById('hud')
const heartsEl = document.getElementById('hearts')
const coinsEl = document.getElementById('coins')
const faseLabel = document.getElementById('faseLabel')
const powerupsEl = document.getElementById('powerups')
const scoreEl = document.getElementById('score')
const highScoreEl = document.getElementById('highScore')
const muteBtn = document.getElementById('muteBtn')
const bossBar = document.getElementById('bossBar')
const bossHpFill = document.getElementById('bossHpFill')
const bossNameEl = document.getElementById('bossName')
const levelBannerEl = document.getElementById('levelBanner')
const bannerWorldEl = document.getElementById('bannerWorld')
const bannerThemeEl = document.getElementById('bannerTheme')

const startScreen = document.getElementById('startScreen')
const pauseScreen = document.getElementById('pauseScreen')
const levelClear = document.getElementById('levelClear')
const gameOverScreen = document.getElementById('gameOver')
const gameOverCanvas = document.getElementById('gameOverCanvas')
const gameOverCtx = gameOverCanvas.getContext('2d')
const victoryScreen = document.getElementById('victoryScreen')

const resumeBtn = document.getElementById('resumeBtn')
const quitBtn = document.getElementById('quitBtn')
const nextBtn = document.getElementById('nextBtn')
const restartBtn = document.getElementById('restartBtn')
const victoryAgainBtn = document.getElementById('victoryAgainBtn')
const victoryMenuBtn = document.getElementById('victoryMenuBtn')

const finalScoreEl = document.getElementById('finalScore')
const finalCoinsEl = document.getElementById('finalCoins')
const finalFaseEl = document.getElementById('finalFase')
const clearFaseEl = document.getElementById('clearFase')
const levelClearMsg = document.getElementById('levelClearMsg')
const recordMsg = document.getElementById('recordMsg')
const victoryDiffEl = document.getElementById('victoryDiff')
const victoryScoreEl = document.getElementById('victoryScore')
const victoryCoinsEl = document.getElementById('victoryCoins')

// ---------- Áudio 100% procedural (WebAudio) — trilha e efeitos originais, sem arquivos ----------
let muted = localStorage.getItem('mario-muted') === '1'
let actx = null

// beep procedural simples (sem arquivos extras)
function beep(freq, dur, type, vol) {
    if (muted) return
    try {
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)()
        const o = actx.createOscillator()
        const g = actx.createGain()
        o.type = type || 'square'
        o.frequency.value = freq
        g.gain.value = (vol == null ? 0.06 : vol)
        o.connect(g); g.connect(actx.destination)
        const t = actx.currentTime
        o.start(t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12))
        o.stop(t + (dur || 0.12))
    } catch (_) { /* ignora */ }
}
const sfx = {
    jump: () => beep(520, 0.12, 'square', 0.05),
    djump: () => beep(720, 0.12, 'square', 0.05),
    coin: () => { beep(880, 0.06, 'square', 0.05); setTimeout(() => beep(1180, 0.08, 'square', 0.05), 60) },
    power: () => { beep(600, 0.09, 'sawtooth', 0.05); setTimeout(() => beep(900, 0.12, 'sawtooth', 0.05), 80) },
    hit: () => beep(160, 0.22, 'sawtooth', 0.08),
    stomp: () => beep(300, 0.1, 'square', 0.07),
    block: () => beep(700, 0.07, 'square', 0.05),
    win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.06), i * 110)) },
    gameover: () => { [392, 349, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.4, 'sawtooth', 0.055), i * 190)) }
}

// Melodia original curta em loop (frequência Hz, duração em segundos; 0 = pausa)
const THEME_NOTES = [
    [523, 0.18], [523, 0.18], [659, 0.18], [784, 0.34],
    [659, 0.18], [784, 0.18], [880, 0.34], [0, 0.14],
    [784, 0.18], [659, 0.18], [523, 0.34], [440, 0.18],
    [523, 0.18], [659, 0.34], [0, 0.22]
]
let musicTimer = null
let themeStep = 0
function playThemeStep() {
    const [freq, dur] = THEME_NOTES[themeStep % THEME_NOTES.length]
    if (freq > 0 && !muted) beep(freq, dur * 0.9, 'triangle', 0.045)
    themeStep++
    musicTimer = setTimeout(playThemeStep, dur * 1000)
}
function startMusic() { stopMusic(); themeStep = 0; playThemeStep() }
function stopMusic() { clearTimeout(musicTimer); musicTimer = null }

// ---------- Mundos temáticos ----------
const THEMES = [
    { key: 'grass', name: 'Reino Verde', skyTop: '#87CEEB', skyBottom: '#E0F6FF', ground: '#5fae34', groundDark: '#3d7d1f', hill: '#8fd36a', hillShape: 'round', decoType: 'cloud' },
    { key: 'cave', name: 'Caverna Sombria', skyTop: '#1b1f3a', skyBottom: '#3a3465', ground: '#5a5a72', groundDark: '#33334a', hill: '#454560', hillShape: 'jagged', decoType: 'crystal' },
    { key: 'desert', name: 'Deserto Escaldante', skyTop: '#f6cf7e', skyBottom: '#ffe9c2', ground: '#d9a45c', groundDark: '#a97a3d', hill: '#e0bd7a', hillShape: 'dune', decoType: 'cactus' },
    { key: 'castle', name: 'Castelo de Lava', skyTop: '#2b0f0f', skyBottom: '#4a1a1a', ground: '#4a2323', groundDark: '#2b0f0f', hill: '#3d1f1f', hillShape: 'wall', decoType: 'ember' }
]
const currentTheme = () => THEMES[(level - 1) % 4]

// ---------- Chefes ----------
const BOSS_TYPES = [
    { key: 'goombaking', name: 'Rei Fungo', icon: '👹', hpDelta: 0 },
    { key: 'dragon', name: 'Dragão de Fogo', icon: '🐉', hpDelta: 1 },
    { key: 'spikeball', name: 'Bola de Espinhos', icon: '⚫', hpDelta: 2 },
    { key: 'skykoopa', name: 'Tartaruga Voadora', icon: '🐢', hpDelta: -1 }
]

// ---------- Dificuldade e campanha ----------
const TOTAL_LEVELS = 16 // 4 mundos × 4 fases; a última fase troca o chefe normal pelo Chefe Final
const DIFFICULTIES = {
    facil: { key: 'facil', label: 'Fácil', hearts: 5, speedMult: 0.8, spawnMult: 0.8, bossHpMult: 0.75, bossRateMult: 0.8, dmgPerHit: 1, scoreMult: 0.75 },
    medio: { key: 'medio', label: 'Médio', hearts: 3, speedMult: 1, spawnMult: 1, bossHpMult: 1, bossRateMult: 1, dmgPerHit: 1, scoreMult: 1 },
    dificil: { key: 'dificil', label: 'Difícil', hearts: 3, speedMult: 1.18, spawnMult: 1.25, bossHpMult: 1.3, bossRateMult: 1.2, dmgPerHit: 1, scoreMult: 1.4 },
    expert: { key: 'expert', label: 'Expert', hearts: 3, speedMult: 1.35, spawnMult: 1.5, bossHpMult: 1.6, bossRateMult: 1.45, dmgPerHit: 2, scoreMult: 2 }
}
let difficulty = DIFFICULTIES.medio
let heartsMax = difficulty.hearts

// ---------- Recordes salvos (proteção leve contra adulteração) ----------
// Aviso importante: isto NÃO é "criptografia de ponta a ponta" — não existe
// segredo a proteger num jogo 100% local, sem servidor. É apenas ofuscação +
// checksum de integridade: dificulta edição casual do save no localStorage
// e descarta o registro se detectar adulteração/corrupção.
const SAVE_KEY = 'mario-runner-save-v1'
const OBFUSCATION_KEY = 'CapitaoSaltoFortalezaDeAventuras'

function xorCipher(str, key) {
    let out = ''
    for (let i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    return out
}
function simpleChecksum(str) {
    let h = 0
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return h.toString(36)
}
const defaultRecords = () => ({
    facil: { best: 0, completed: false },
    medio: { best: 0, completed: false },
    dificil: { best: 0, completed: false },
    expert: { best: 0, completed: false }
})
let records = defaultRecords()

function saveGameState() {
    try {
        const json = JSON.stringify(records)
        const scrambled = btoa(xorCipher(json, OBFUSCATION_KEY))
        localStorage.setItem(SAVE_KEY, simpleChecksum(scrambled) + '.' + scrambled)
    } catch (_) { /* localStorage indisponível */ }
}
function loadGameState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY)
        if (!raw) return
        const [check, scrambled] = raw.split('.')
        if (!scrambled || simpleChecksum(scrambled) !== check) return // adulterado/corrompido: ignora
        records = Object.assign(defaultRecords(), JSON.parse(xorCipher(atob(scrambled), OBFUSCATION_KEY)))
    } catch (_) { records = defaultRecords() }
}
function saveResult(finalScore, completed) {
    const rec = records[difficulty.key] || { best: 0, completed: false }
    rec.best = Math.max(rec.best, finalScore)
    rec.completed = rec.completed || completed
    records[difficulty.key] = rec
    saveGameState()
    renderRecords()
}
function renderRecords() {
    Object.keys(DIFFICULTIES).forEach(key => {
        const el = document.getElementById('rec-' + key)
        if (!el) return
        const rec = records[key] || { best: 0, completed: false }
        el.textContent = (rec.completed ? '🏆 ' : '') + 'Recorde: ' + rec.best
    })
}

// ---------- Estado global ----------
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', LEVELCLEAR: 'levelclear', BOSS: 'boss', OVER: 'over', VICTORY: 'victory' }
let state = STATE.MENU

const GRAVITY = 2600
const JUMP_V = 940

let highScore = Number(localStorage.getItem('mario-highscore')) || 0

const player = {
    x: 80, y: 0, w: 76, h: 100,
    vy: 0, onGround: true, jumps: 0, maxJumps: 1,
    invuln: 0, dead: false, runPhase: 0
}

let score = 0
let coins = 0
let hearts = heartsMax
let level = 1
let worldSpeed = 360
let timeScale = 1
let distanceInLevel = 0
let levelTarget = 3800

// coleções
let obstacles = []
let coinList = []
let powerups = []
let blocks = []
let particles = []
let projectiles = []
let clouds = []
let hills = []

// power-ups ativos: tipo -> tempo restante (s)
const active = { shield: 0, djump: 0, slow: 0, magnet: 0 }
const POWER_INFO = {
    shield: { icon: '🛡️', dur: 7, color: '#3aa0ff' },
    djump: { icon: '🦘', dur: 9, color: '#8a5cff' },
    slow: { icon: '🐢', dur: 6, color: '#2ecc71' },
    magnet: { icon: '🧲', dur: 8, color: '#ff6b6b' }
}

// spawners
let obstacleTimer = 1.2
let coinTimer = 0.7
let powerTimer = 9
let blockTimer = 3.5

// chefe
let boss = null

// ---------- Utilidades ----------
const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}
function playerBox(pad) {
    const p = pad || 0
    return { x: player.x + p, y: player.y + p, w: player.w - p * 2, h: player.h - p * 2 }
}
// ---------- Cenário parallax ----------
function initScenery() {
    clouds = []
    for (let i = 0; i < 6; i++) clouds.push({ x: rand(0, W), y: rand(20, H * 0.4), s: rand(0.5, 1.1) })
    hills = []
    for (let i = 0; i < 4; i++) hills.push({ x: i * (W / 3) + rand(-40, 40), r: rand(90, 180) })
}

// ---------- Spawns ----------
function spawnObstacle() {
    let pool = ['pipe', 'goomba', 'goomba']
    if (level >= 2) pool.push('spike')
    if (level >= 3) pool.push('flyer')
    if (level >= 4) pool.push('spike', 'flyer', 'goomba')
    const kind = pool[Math.floor(Math.random() * pool.length)]

    if (kind === 'pipe') {
        const h = rand(46, 78)
        obstacles.push({ kind, x: W + 20, y: groundY - h, w: 52, h, hitPad: 8 })
    } else if (kind === 'spike') {
        const w = rand(34, 60), h = 30
        obstacles.push({ kind, x: W + 20, y: groundY - h, w, h, hitPad: 6 })
    } else if (kind === 'goomba') {
        const h = clamp(player.h * 0.62, 38, 56)
        const w = h * 0.95
        obstacles.push({ kind, x: W + 20, y: groundY - h, w, h, hitPad: 6, bob: rand(0, 6.28), walk: rand(26, 44) })
    } else { // flyer
        const h = 34
        const y = groundY - rand(120, 175)
        obstacles.push({ kind, x: W + 20, y, w: 46, h, hitPad: 8, bob: rand(0, 6.28) })
    }
}

function spawnCoins() {
    const n = Math.floor(rand(4, 9))
    const baseY = groundY - rand(60, 170)
    const arc = Math.random() < 0.5
    const startX = W + 20
    for (let i = 0; i < n; i++) {
        const x = startX + i * 32
        const y = arc ? baseY - Math.sin((i / (n - 1)) * Math.PI) * 60 : baseY
        coinList.push({ x, y, r: 11, t: rand(0, 6.28) })
    }
}

function spawnPowerup() {
    const types = Object.keys(POWER_INFO)
    const type = types[Math.floor(Math.random() * types.length)]
    powerups.push({ type, x: W + 20, y: groundY - rand(70, 150), r: 16, t: 0 })
}

function spawnBlock() {
    const y = groundY - rand(150, 210)
    blocks.push({ x: W + 20, y, w: 36, h: 36, used: false, popT: 0 })
}

function addParticles(x, y, color, n, spread) {
    n = n || 10
    spread = spread || 240
    for (let i = 0; i < n; i++) {
        if (particles.length > 260) break
        const a = rand(0, 6.28)
        const sp = rand(40, spread)
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.4, 0.9), max: 0.9, color, size: rand(2, 5) })
    }
}

// ---------- Chefe ----------
function startBoss() {
    state = STATE.BOSS
    obstacles = []
    powerups = []
    blocks = []
    const info = BOSS_TYPES[(level - 1) % 4]
    boss = {
        type: info.key,
        x: W + 120, y: groundY - 190, w: 120, h: 120,
        tx: W * 0.68, vy: 0, bob: 0,
        hp: Math.max(2, Math.round((3 + level + info.hpDelta) * difficulty.bossHpMult)), maxHp: 0,
        shootTimer: 1.6, hitFlash: 0, entering: true
    }
    boss.maxHp = boss.hp
    bossNameEl.textContent = info.icon + ' ' + info.name
    bossBar.hidden = false
    updateBossBar()
}

// ---------- Chefe final (última fase da campanha) ----------
function startFinalBoss() {
    state = STATE.BOSS
    obstacles = []
    powerups = []
    blocks = []
    boss = {
        type: 'finalboss',
        x: W + 150, y: groundY - 230, w: 160, h: 160,
        tx: W * 0.66, vy: 0, bob: 0,
        hp: Math.max(6, Math.round((8 + Math.ceil(TOTAL_LEVELS / 4)) * difficulty.bossHpMult)), maxHp: 0,
        shootTimer: 1.4, hitFlash: 0, entering: true
    }
    boss.maxHp = boss.hp
    bossNameEl.textContent = '👑 Rei das Trevas'
    bossBar.hidden = false
    updateBossBar()
}
function updateBossBar() {
    if (!boss) return
    bossHpFill.style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + '%'
}

// ---------- Dano / vidas ----------
function takeHit(px, py) {
    if (player.invuln > 0 || active.shield > 0) return
    hearts = Math.max(0, hearts - difficulty.dmgPerHit)
    player.invuln = 1.3
    sfx.hit()
    addParticles(px || player.x + player.w / 2, py || player.y + player.h / 2, '#ff5252', 14)
    updateHearts()
    if (hearts <= 0) endGame()
}

// ---------- HUD ----------
let hudCache = { hearts: -1, coins: -1, fase: '', score: -1, high: -1, powers: '' }
function updateHearts() {
    if (hudCache.hearts === hearts) return
    hudCache.hearts = hearts
    let s = ''
    for (let i = 0; i < heartsMax; i++) s += i < hearts ? '❤️' : '🤍'
    heartsEl.textContent = s
}
function updateHud() {
    if (hudCache.coins !== coins) { coinsEl.textContent = coins; hudCache.coins = coins }
    const worldNumber = Math.floor((level - 1) / 4) + 1
    const stageNumber = ((level - 1) % 4) + 1
    const label = worldNumber + '-' + stageNumber + ' · ' + level + '/' + TOTAL_LEVELS
    if (hudCache.fase !== label) { faseLabel.textContent = label; hudCache.fase = label }
    const sc = Math.floor(score)
    if (hudCache.score !== sc) { scoreEl.textContent = sc; hudCache.score = sc }
    if (hudCache.high !== highScore) { highScoreEl.textContent = highScore; hudCache.high = highScore }
    // power-ups ativos
    let key = ''
    let html = ''
    for (const type in active) {
        if (active[type] > 0) {
            const info = POWER_INFO[type]
            const pct = clamp(active[type] / info.dur, 0, 1) * 100
            key += type + Math.ceil(active[type]) + ';'
            html += `<span class="pw" style="--pw:${info.color}">${info.icon}<i style="width:${pct}%"></i></span>`
        }
    }
    if (hudCache.powers !== key) { powerupsEl.innerHTML = html; hudCache.powers = key }
}

// ---------- Banner de fase/mundo ----------
let bannerTimer = null
function showLevelBanner() {
    const worldNumber = Math.floor((level - 1) / 4) + 1
    const stageNumber = ((level - 1) % 4) + 1
    const theme = THEMES[(level - 1) % 4]
    const info = BOSS_TYPES[(level - 1) % 4]
    bannerWorldEl.textContent = worldNumber + '-' + stageNumber
    bannerThemeEl.textContent = theme.name + ' — chefe: ' + info.icon + ' ' + info.name
    levelBannerEl.hidden = false
    requestAnimationFrame(() => levelBannerEl.classList.add('show'))
    clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => {
        levelBannerEl.classList.remove('show')
        setTimeout(() => { levelBannerEl.hidden = true }, 400)
    }, 1700)
}

// ---------- Controles ----------
function doJump() {
    if (state === STATE.MENU || state === STATE.OVER || state === STATE.LEVELCLEAR || state === STATE.VICTORY) { return }
    if (state === STATE.PAUSED) return
    if (player.jumps < player.maxJumps) {
        player.vy = -JUMP_V * (player.jumps === 0 ? 1 : 0.85)
        player.onGround = false
        player.jumps++
        if (player.jumps > 1) sfx.djump(); else sfx.jump()
        addParticles(player.x + player.w / 2, player.y + player.h, '#e8e0c0', 6, 120)
    }
}

function primaryAction() {
    // gesto único para iniciar/pular conforme o estado
    if (actx && actx.state === 'suspended') actx.resume()
    if (state === STATE.PLAYING || state === STATE.BOSS) doJump()
    else if (state === STATE.MENU) startGame()
    else if (state === STATE.OVER) startGame()
    else if (state === STATE.VICTORY) startGame()
    else if (state === STATE.LEVELCLEAR) nextLevel()
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        e.preventDefault(); primaryAction()
    } else if (e.code === 'Enter') {
        if (state === STATE.MENU || state === STATE.OVER) startGame()
        else if (state === STATE.LEVELCLEAR) nextLevel()
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause()
    } else if (e.code === 'KeyM') {
        toggleMute()
    }
})

game.addEventListener('touchstart', (e) => {
    e.preventDefault(); primaryAction()
}, { passive: false })
game.addEventListener('mousedown', (e) => {
    if (e.target.closest('.overlay') || e.target.closest('button') || e.target.closest('a')) return
    primaryAction()
})

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        difficulty = DIFFICULTIES[btn.dataset.diff]
        startGame()
    })
})
restartBtn.addEventListener('click', startGame)
resumeBtn.addEventListener('click', () => { if (state === STATE.PAUSED) togglePause() })
quitBtn.addEventListener('click', toMenu)
nextBtn.addEventListener('click', nextLevel)
victoryAgainBtn.addEventListener('click', startGame)
victoryMenuBtn.addEventListener('click', toMenu)
muteBtn.addEventListener('click', toggleMute)

function toggleMute() {
    muted = !muted
    localStorage.setItem('mario-muted', muted ? '1' : '0')
    muteBtn.textContent = muted ? '🔇' : '🔊'
    if (muted) stopMusic()
    else if (state === STATE.PLAYING || state === STATE.BOSS) startMusic()
}
muteBtn.textContent = muted ? '🔇' : '🔊'

function togglePause() {
    if (state === STATE.PLAYING || state === STATE.BOSS) {
        prevState = state
        state = STATE.PAUSED
        pauseScreen.hidden = false
        stopMusic()
    } else if (state === STATE.PAUSED) {
        state = prevState
        pauseScreen.hidden = true
        if (!muted) startMusic()
    }
}
let prevState = STATE.PLAYING

// ---------- Fluxo de jogo ----------
function resetPlayer() {
    player.vy = 0; player.jumps = 0; player.onGround = true
    player.maxJumps = 1; player.invuln = 0
    player.y = groundY - player.h
    player.dead = false
    player.runPhase = 0
}

function startGame() {
    heartsMax = difficulty.hearts
    score = 0; coins = 0; hearts = heartsMax; level = 1
    worldSpeed = 360 * difficulty.speedMult; timeScale = 1; distanceInLevel = 0; levelTarget = 3800
    obstacles = []; coinList = []; powerups = []; blocks = []; particles = []; projectiles = []; boss = null
    for (const k in active) active[k] = 0
    obstacleTimer = 1.2 / difficulty.spawnMult; coinTimer = 0.7 / difficulty.spawnMult
    powerTimer = 9 / difficulty.spawnMult; blockTimer = 3.5 / difficulty.spawnMult
    resetPlayer()
    initScenery()

    hud.hidden = false
    bossBar.hidden = true
    startScreen.hidden = true
    gameOverScreen.hidden = true
    levelClear.hidden = true
    victoryScreen.hidden = true
    pauseScreen.hidden = true
    recordMsg.hidden = true

    hudCache = { hearts: -1, coins: -1, fase: '', score: -1, high: -1, powers: '' }
    updateHearts(); updateHud()
    showLevelBanner()

    startMusic()

    state = STATE.PLAYING
}

function nextLevel() {
    level++
    worldSpeed = Math.min(720, 360 + (level - 1) * 42) * difficulty.speedMult
    distanceInLevel = 0
    levelTarget = 3800 + level * 900
    obstacles = []; coinList = []; powerups = []; blocks = []; projectiles = []; boss = null
    obstacleTimer = 1.0 / difficulty.spawnMult; coinTimer = 0.7 / difficulty.spawnMult
    powerTimer = 8 / difficulty.spawnMult; blockTimer = 3 / difficulty.spawnMult
    resetPlayer()
    bossBar.hidden = true
    levelClear.hidden = true
    showLevelBanner()
    if (!muted) startMusic()
    state = STATE.PLAYING
}

function winLevel() {
    boss = null
    bossBar.hidden = true
    state = STATE.LEVELCLEAR
    const worldNumber = Math.floor((level - 1) / 4) + 1
    const stageNumber = ((level - 1) % 4) + 1
    clearFaseEl.textContent = worldNumber + '-' + stageNumber
    levelClearMsg.textContent = (level + 1 === TOTAL_LEVELS) ? '⚠️ Prepare-se: o CHEFE FINAL se aproxima!' : 'Prepare-se para a próxima...'
    levelClear.hidden = false
    sfx.win()
    score += 200 * level * difficulty.scoreMult
}

function winGame() {
    boss = null
    bossBar.hidden = true
    hud.hidden = true
    state = STATE.VICTORY
    sfx.win()
    score += 1000 * difficulty.scoreMult
    stopMusic()

    const finalScore = Math.floor(score)
    victoryDiffEl.textContent = difficulty.label
    victoryScoreEl.textContent = finalScore
    victoryCoinsEl.textContent = coins
    saveResult(finalScore, true)
    gameOverScreen.hidden = true
    victoryScreen.hidden = false
}

function endGame() {
    state = STATE.OVER
    player.dead = true
    stopMusic()
    sfx.gameover()
    addParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffd54a', 24, 320)
    drawGameOverPortrait()

    const finalScore = Math.floor(score)
    finalScoreEl.textContent = finalScore
    finalCoinsEl.textContent = coins
    const worldNumber = Math.floor((level - 1) / 4) + 1
    const stageNumber = ((level - 1) % 4) + 1
    finalFaseEl.textContent = worldNumber + '-' + stageNumber
    saveResult(finalScore, false)
    if (finalScore > highScore) {
        highScore = finalScore
        localStorage.setItem('mario-highscore', String(highScore))
        recordMsg.hidden = false
    }
    bossBar.hidden = true
    victoryScreen.hidden = true
    gameOverScreen.hidden = false
}

function toMenu() {
    state = STATE.MENU
    stopMusic()
    hud.hidden = true
    bossBar.hidden = true
    pauseScreen.hidden = true
    gameOverScreen.hidden = true
    levelClear.hidden = true
    victoryScreen.hidden = true
    startScreen.hidden = false
    resetPlayer()
}

// ---------- Update ----------
function update(dt) {
    if (state !== STATE.PLAYING && state !== STATE.BOSS) return

    const ts = timeScale * (active.slow > 0 ? 0.55 : 1)
    const spd = worldSpeed * ts

    // timers de power-up
    for (const k in active) if (active[k] > 0) active[k] = Math.max(0, active[k] - dt)
    player.maxJumps = active.djump > 0 ? 2 : 1
    if (player.invuln > 0) player.invuln -= dt

    // física do herói
    player.vy += GRAVITY * dt
    player.y += player.vy * dt
    if (player.y >= groundY - player.h) {
        player.y = groundY - player.h
        player.vy = 0
        player.onGround = true
        player.jumps = 0
    } else {
        player.onGround = false
    }
    if (player.onGround && (state === STATE.PLAYING || state === STATE.BOSS)) player.runPhase += dt * 10

    // cenário
    clouds.forEach(c => { c.x -= spd * 0.15 * c.s * dt; if (c.x < -160) { c.x = W + rand(0, 120); c.y = rand(20, H * 0.4) } })
    hills.forEach(h => { h.x -= spd * 0.3 * dt; if (h.x < -h.r * 2) h.x = W + h.r })

    if (state === STATE.PLAYING) {
        distanceInLevel += spd * dt
        score += spd * dt * 0.02 * difficulty.scoreMult

        // spawns
        obstacleTimer -= dt
        if (obstacleTimer <= 0) {
            spawnObstacle()
            const min = clamp(1.15 - level * 0.06, 0.62, 1.15)
            const max = clamp(1.9 - level * 0.08, 1.0, 1.9)
            obstacleTimer = rand(min, max) / difficulty.spawnMult
        }
        coinTimer -= dt
        if (coinTimer <= 0) { spawnCoins(); coinTimer = rand(0.9, 1.8) / difficulty.spawnMult }
        powerTimer -= dt
        if (powerTimer <= 0) { spawnPowerup(); powerTimer = rand(9, 15) / difficulty.spawnMult }
        blockTimer -= dt
        if (blockTimer <= 0) { spawnBlock(); blockTimer = rand(3.5, 6.5) / difficulty.spawnMult }

        // fim da fase -> chefe (ou chefe final na última fase)
        if (distanceInLevel >= levelTarget) {
            if (level >= TOTAL_LEVELS) startFinalBoss()
            else startBoss()
        }
    }

    // mover e checar obstáculos (canos/espinhos/voadores/goombas)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i]
        const extraWalk = o.kind === 'goomba' ? (o.walk || 0) : 0
        o.x -= (spd + extraWalk) * dt
        if (o.kind === 'flyer' || o.kind === 'goomba') o.bob += dt * (o.kind === 'goomba' ? 7 : 4)
        if (o.x + o.w < -20) { obstacles.splice(i, 1); continue }
        const oy = o.kind === 'flyer' ? o.y + Math.sin(o.bob) * 8 : o.y

        if (o.kind === 'goomba') {
            const stomping = player.vy > 0 && (player.y + player.h) < (oy + o.h * 0.55) &&
                overlap(player.x, player.y, player.w, player.h, o.x + 4, oy + 4, o.w - 8, o.h - 8)
            if (stomping) {
                player.vy = -JUMP_V * 0.8
                player.jumps = 1
                score += 50 * difficulty.scoreMult
                sfx.stomp()
                addParticles(o.x + o.w / 2, oy + o.h / 2, '#8b5a2b', 10)
                obstacles.splice(i, 1)
                continue
            }
            const b = playerBox(o.hitPad)
            if (overlap(b.x, b.y, b.w, b.h, o.x + o.hitPad, oy + o.hitPad, o.w - o.hitPad * 2, o.h - o.hitPad * 2)) {
                takeHit(o.x, oy)
                obstacles.splice(i, 1)
                addParticles(o.x + o.w / 2, oy + o.h / 2, '#8b5a2b', 10)
            }
            continue
        }

        const b = playerBox(o.hitPad)
        if (overlap(b.x, b.y, b.w, b.h, o.x + o.hitPad, oy + o.hitPad, o.w - o.hitPad * 2, o.h - o.hitPad * 2)) {
            takeHit(o.x, oy)
            obstacles.splice(i, 1)
            addParticles(o.x + o.w / 2, oy + o.h / 2, '#c0392b', 10)
        }
    }

    // moedas (com ímã e física para moedas ejetadas de blocos)
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2
    for (let i = coinList.length - 1; i >= 0; i--) {
        const c = coinList[i]
        c.x -= spd * dt
        c.t += dt * 6
        if (c.grav) {
            c.vy += 900 * dt * ts
            c.y += c.vy * dt * ts
            if (c.y > groundY - 18) { c.y = groundY - 18; c.grav = false; c.vy = 0 }
        }
        if (active.magnet > 0) {
            const dx = pcx - c.x, dy = pcy - c.y
            const d = Math.hypot(dx, dy)
            if (d < 220) { c.x += (dx / d) * 320 * dt; c.y += (dy / d) * 320 * dt }
        }
        if (c.x < -30) { coinList.splice(i, 1); continue }
        if (overlap(player.x, player.y, player.w, player.h, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2)) {
            coins++; score += 15 * difficulty.scoreMult
            sfx.coin()
            addParticles(c.x, c.y, '#ffd54a', 8, 160)
            coinList.splice(i, 1)
        }
    }

    // blocos "?"
    for (let i = blocks.length - 1; i >= 0; i--) {
        const bl = blocks[i]
        bl.x -= spd * dt
        if (bl.popT > 0) bl.popT = Math.max(0, bl.popT - dt)
        if (bl.x + bl.w < -20) { blocks.splice(i, 1); continue }
        if (!bl.used) {
            const hitting = player.vy < 0 &&
                (player.y) <= (bl.y + bl.h) && (player.y) >= (bl.y + bl.h - 26) &&
                player.x + player.w > bl.x + 4 && player.x < bl.x + bl.w - 4
            if (hitting) {
                bl.used = true
                bl.popT = 0.35
                player.vy = Math.max(player.vy, -40)
                sfx.block()
                if (Math.random() < 0.18) {
                    const ptypes = Object.keys(POWER_INFO)
                    powerups.push({ type: ptypes[Math.floor(Math.random() * ptypes.length)], x: bl.x + bl.w / 2, y: bl.y - 14, r: 16, t: 0 })
                } else {
                    coinList.push({ x: bl.x + bl.w / 2, y: bl.y, r: 11, t: 0, vy: -260, grav: true })
                    score += 5 * difficulty.scoreMult
                }
                addParticles(bl.x + bl.w / 2, bl.y, '#f5b83d', 8, 160)
            }
        }
    }

    // power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i]
        p.x -= spd * dt
        p.t += dt * 4
        if (p.x < -40) { powerups.splice(i, 1); continue }
        if (overlap(player.x, player.y, player.w, player.h, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)) {
            active[p.type] = POWER_INFO[p.type].dur
            sfx.power()
            addParticles(p.x, p.y, POWER_INFO[p.type].color, 16, 260)
            powerups.splice(i, 1)
        }
    }

    // chefe
    if (state === STATE.BOSS && boss) updateBoss(dt, ts)

    // projéteis do chefe
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i]
        if (pr.grav) pr.vy += 900 * dt * ts
        pr.x += pr.vx * dt * ts
        pr.y += pr.vy * dt * ts
        if (pr.x < -30 || pr.y > H + 30) { projectiles.splice(i, 1); continue }
        if (overlap(playerBox(6).x, playerBox(6).y, playerBox(6).w, playerBox(6).h, pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) {
            takeHit(pr.x, pr.y)
            projectiles.splice(i, 1)
        }
    }

    // partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vy += 640 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
        if (p.life <= 0) particles.splice(i, 1)
    }

    updateHud()
}

function updateBoss(dt, ts) {
    if (boss.hitFlash > 0) boss.hitFlash -= dt
    if (boss.entering) {
        boss.x -= (worldSpeed * ts) * dt
        if (boss.x <= boss.tx) { boss.x = boss.tx; boss.entering = false }
    } else {
        boss.bob += dt * 2
        boss.y = groundY - 190 + Math.sin(boss.bob) * 26
        boss.shootTimer -= dt
        if (boss.shootTimer <= 0) {
            fireBossAttack()
        }
    }
    // colisão jogador x chefe: pisão (stomp) x dano
    if (overlap(player.x, player.y, player.w, player.h, boss.x, boss.y, boss.w, boss.h)) {
        const stomping = player.vy > 0 && (player.y + player.h) < (boss.y + boss.h * 0.5)
        if (stomping) {
            boss.hp--
            boss.hitFlash = 0.25
            player.vy = -JUMP_V * 0.8
            player.jumps = 1
            sfx.stomp()
            addParticles(player.x + player.w / 2, boss.y, '#ffd54a', 14, 240)
            updateBossBar()
            if (boss.hp <= 0) { if (boss.type === 'finalboss') winGame(); else winLevel() }
        } else {
            takeHit(boss.x + boss.w / 2, boss.y + boss.h / 2)
            player.vy = -JUMP_V * 0.4
        }
    }
}

function fireBossAttack() {
    const bx = boss.x, by = boss.y + boss.h / 2
    const baseSp = (300 + level * 10) * difficulty.speedMult
    switch (boss.type) {
        case 'dragon': {
            const dx = player.x - bx
            const t = Math.max(0.5, Math.abs(dx) / (baseSp * 0.8))
            projectiles.push({ x: bx, y: by, vx: dx / t, vy: -520, r: 13, color: '#ff5252', grav: true })
            boss.shootTimer = clamp(2.1 - level * 0.1, 0.9, 2.1) / difficulty.bossRateMult
            break
        }
        case 'spikeball': {
            const angBase = Math.atan2((player.y + player.h / 2) - by, player.x - bx)
            ;[-0.28, 0, 0.28].forEach(off => {
                const a = angBase + off
                projectiles.push({ x: bx, y: by, vx: Math.cos(a) * baseSp * 0.9, vy: Math.sin(a) * baseSp * 0.9, r: 9, color: '#616161' })
            })
            boss.shootTimer = clamp(2.4 - level * 0.1, 1.2, 2.4) / difficulty.bossRateMult
            break
        }
        case 'skykoopa': {
            const ang = Math.atan2((player.y + player.h / 2) - by, player.x - bx)
            projectiles.push({ x: bx, y: by, vx: Math.cos(ang) * baseSp * 1.15, vy: Math.sin(ang) * baseSp * 1.15, r: 10, color: '#4fc3f7' })
            boss.shootTimer = clamp(1.3 - level * 0.08, 0.5, 1.3) / difficulty.bossRateMult
            break
        }
        case 'finalboss': {
            const phase2 = boss.hp <= boss.maxHp / 2
            if (phase2) {
                const angBase = Math.atan2((player.y + player.h / 2) - by, player.x - bx)
                ;[-0.3, 0, 0.3].forEach(off => {
                    const a = angBase + off
                    projectiles.push({ x: bx, y: by, vx: Math.cos(a) * baseSp * 1.1, vy: Math.sin(a) * baseSp * 1.1, r: 11, color: '#8e44ad' })
                })
                boss.shootTimer = clamp(1.1 - level * 0.03, 0.45, 1.1) / difficulty.bossRateMult
            } else {
                const dx = player.x - bx
                const t = Math.max(0.5, Math.abs(dx) / (baseSp * 0.85))
                projectiles.push({ x: bx, y: by, vx: dx / t, vy: -540, r: 13, color: '#8e44ad', grav: true })
                boss.shootTimer = clamp(1.7 - level * 0.05, 0.7, 1.7) / difficulty.bossRateMult
            }
            break
        }
        default: { // goombaking
            const ang = Math.atan2((player.y + player.h / 2) - by, player.x - bx)
            projectiles.push({ x: bx, y: by, vx: Math.cos(ang) * baseSp, vy: Math.sin(ang) * baseSp, r: 12, color: '#ff7043' })
            boss.shootTimer = clamp(1.9 - level * 0.12, 0.75, 1.9) / difficulty.bossRateMult
        }
    }
}

// ---------- Render ----------
function drawHill(h, theme) {
    if (theme.hillShape === 'jagged') {
        ctx.beginPath()
        ctx.moveTo(h.x - h.r, groundY)
        ctx.lineTo(h.x - h.r * 0.4, groundY - h.r * 0.9)
        ctx.lineTo(h.x, groundY - h.r * 0.5)
        ctx.lineTo(h.x + h.r * 0.5, groundY - h.r)
        ctx.lineTo(h.x + h.r, groundY)
        ctx.closePath(); ctx.fill()
    } else if (theme.hillShape === 'dune') {
        ctx.beginPath()
        ctx.ellipse(h.x, groundY + 10, h.r * 1.1, h.r * 0.55, 0, Math.PI, 0, true)
        ctx.fill()
    } else if (theme.hillShape === 'wall') {
        const bw = h.r * 1.6, bh = h.r * 0.9
        ctx.fillRect(h.x - bw / 2, groundY - bh, bw, bh)
        for (let i = 0; i < 4; i++) ctx.fillRect(h.x - bw / 2 + i * (bw / 4) + 4, groundY - bh - 10, bw / 4 - 8, 12)
    } else {
        ctx.beginPath()
        ctx.arc(h.x, groundY, h.r, Math.PI, 0)
        ctx.fill()
    }
}

function drawSkyDecor(c, theme) {
    const w = 150 * c.s
    if (theme.decoType === 'cloud') {
        if (imgClouds.complete && imgClouds.naturalWidth) {
            ctx.globalAlpha = 0.9
            ctx.drawImage(imgClouds, c.x, c.y, w, w * (imgClouds.naturalHeight / imgClouds.naturalWidth))
            ctx.globalAlpha = 1
        }
    } else if (theme.decoType === 'crystal') {
        ctx.save()
        const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 18 * c.s)
        glow.addColorStop(0, 'rgba(140,180,255,0.9)'); glow.addColorStop(1, 'rgba(140,180,255,0)')
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(c.x, c.y, 18 * c.s, 0, 6.2832); ctx.fill()
        ctx.restore()
    } else if (theme.decoType === 'cactus') {
        ctx.save()
        ctx.fillStyle = '#3d8f3d'
        const cw = 14 * c.s, ch = 50 * c.s
        ctx.fillRect(c.x, groundY - ch, cw, ch)
        ctx.fillRect(c.x - 10 * c.s, groundY - ch * 0.6, 10 * c.s, cw)
        ctx.fillRect(c.x + cw, groundY - ch * 0.75, 10 * c.s, cw)
        ctx.restore()
    } else if (theme.decoType === 'ember') {
        ctx.save()
        ctx.globalAlpha = 0.7
        ctx.fillStyle = '#ff7043'
        ctx.beginPath(); ctx.arc(c.x, c.y, 3 * c.s, 0, 6.2832); ctx.fill()
        ctx.restore()
    }
}

function drawBackground() {
    const theme = currentTheme()
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, theme.skyTop); g.addColorStop(1, theme.skyBottom)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    clouds.forEach(c => drawSkyDecor(c, theme))

    ctx.fillStyle = theme.hill
    hills.forEach(h => drawHill(h, theme))

    ctx.fillStyle = theme.ground
    ctx.fillRect(0, groundY, W, groundH)
    ctx.fillStyle = theme.groundDark
    ctx.fillRect(0, groundY, W, 8)

    if (theme.key === 'castle') {
        ctx.save()
        ctx.globalAlpha = 0.55 + Math.sin(performanceNow / 200) * 0.15
        ctx.fillStyle = '#ff7043'
        ctx.fillRect(0, groundY + 8, W, 4)
        ctx.restore()
    }
}

function drawCoin(c) {
    const wob = Math.abs(Math.cos(c.t)) * 0.7 + 0.3
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(wob, 1)
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, 6.2832)
    ctx.fillStyle = '#ffd54a'; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = '#e0a500'; ctx.stroke()
    ctx.fillStyle = '#e0a500'; ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('$', 0, 1)
    ctx.restore()
}

function drawGoomba(o) {
    const oy = o.y + Math.sin(o.bob) * 8
    const legSwing = Math.sin(o.bob * 6) * 6
    ctx.save()
    ctx.translate(o.x + o.w / 2, oy + o.h / 2)
    ctx.fillStyle = '#3d2b1f'
    ctx.beginPath(); ctx.ellipse(-o.w / 4, o.h / 2 - 2 + Math.max(0, legSwing), o.w / 5, 6, 0, 0, 6.2832); ctx.fill()
    ctx.beginPath(); ctx.ellipse(o.w / 4, o.h / 2 - 2 + Math.max(0, -legSwing), o.w / 5, 6, 0, 0, 6.2832); ctx.fill()
    ctx.fillStyle = '#8b5a2b'
    ctx.beginPath(); ctx.ellipse(0, 0, o.w / 2, o.h / 2.2, 0, 0, 6.2832); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(-o.w / 5, -4, 7, 0, 6.2832); ctx.arc(o.w / 5, -4, 7, 0, 6.2832); ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath(); ctx.arc(-o.w / 5, -2, 3.5, 0, 6.2832); ctx.arc(o.w / 5, -2, 3.5, 0, 6.2832); ctx.fill()
    ctx.strokeStyle = '#3d2b1f'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-o.w / 3, -14); ctx.lineTo(-o.w / 8, -9); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(o.w / 3, -14); ctx.lineTo(o.w / 8, -9); ctx.stroke()
    ctx.restore()
}

function drawPillar(o) {
    const theme = currentTheme()
    ctx.save()
    if (theme.key === 'cave') {
        // pilar de pedra
        ctx.fillStyle = '#6b6b80'
        ctx.fillRect(o.x, o.y, o.w, o.h)
        ctx.fillStyle = '#54546a'
        for (let i = 0; i < 3; i++) ctx.fillRect(o.x + 3, o.y + o.h * (0.15 + i * 0.3), o.w - 6, 5)
        ctx.fillStyle = '#8a8aa0'
        ctx.beginPath()
        ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w * 0.5, o.y - 10); ctx.lineTo(o.x + o.w, o.y)
        ctx.closePath(); ctx.fill()
    } else if (theme.key === 'desert') {
        // totem de pedra-arenito
        ctx.fillStyle = '#c8985c'
        ctx.fillRect(o.x, o.y, o.w, o.h)
        ctx.fillStyle = '#a97a3d'
        for (let i = 0; i < 3; i++) ctx.fillRect(o.x, o.y + o.h * (0.22 * (i + 1)), o.w, 4)
        ctx.fillStyle = '#6b4a26'
        ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h * 0.28, o.w * 0.18, 0, 6.2832); ctx.fill()
    } else if (theme.key === 'castle') {
        // pilar de ferro com espinhos
        ctx.fillStyle = '#3a3a3a'
        ctx.fillRect(o.x, o.y, o.w, o.h)
        ctx.fillStyle = '#ff7043'
        ctx.fillRect(o.x + 3, o.y + 8, o.w - 6, 3)
        ctx.fillStyle = '#1f1f1f'
        const n = Math.max(2, Math.floor(o.w / 14))
        const sw = o.w / n
        for (let i = 0; i < n; i++) {
            ctx.beginPath()
            ctx.moveTo(o.x + i * sw, o.y)
            ctx.lineTo(o.x + i * sw + sw / 2, o.y - 9)
            ctx.lineTo(o.x + (i + 1) * sw, o.y)
            ctx.closePath(); ctx.fill()
        }
    } else {
        // caixotes de madeira (Reino Verde)
        ctx.fillStyle = '#9a6b3d'
        ctx.fillRect(o.x, o.y, o.w, o.h)
        ctx.strokeStyle = '#6b4a26'; ctx.lineWidth = 3
        ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4)
        ctx.beginPath()
        ctx.moveTo(o.x + 2, o.y + 2); ctx.lineTo(o.x + o.w - 2, o.y + o.h - 2)
        ctx.moveTo(o.x + o.w - 2, o.y + 2); ctx.lineTo(o.x + 2, o.y + o.h - 2)
        ctx.stroke()
        if (o.h > 60) ctx.strokeRect(o.x + 2, o.y + o.h / 2, o.w - 4, o.h / 2 - 2)
    }
    ctx.restore()
}

function drawObstacle(o) {
    if (o.kind === 'goomba') { drawGoomba(o); return }
    if (o.kind === 'pipe') {
        drawPillar(o)
    } else if (o.kind === 'spike') {
        ctx.fillStyle = '#7d5a3c'
        const n = Math.max(2, Math.floor(o.w / 16))
        const sw = o.w / n
        for (let i = 0; i < n; i++) {
            ctx.beginPath()
            ctx.moveTo(o.x + i * sw, o.y + o.h)
            ctx.lineTo(o.x + i * sw + sw / 2, o.y)
            ctx.lineTo(o.x + (i + 1) * sw, o.y + o.h)
            ctx.closePath(); ctx.fill()
        }
        ctx.fillStyle = '#a97c50'; ctx.fillRect(o.x, o.y + o.h - 4, o.w, 4)
    } else { // flyer
        const oy = o.y + Math.sin(o.bob) * 8
        ctx.save(); ctx.translate(o.x + o.w / 2, oy + o.h / 2)
        ctx.fillStyle = '#5a3e8c'
        ctx.beginPath(); ctx.ellipse(0, 0, o.w / 2, o.h / 2, 0, 0, 6.2832); ctx.fill()
        const flap = Math.sin(o.bob * 2) * 8
        ctx.fillStyle = '#7a5cbf'
        ctx.beginPath(); ctx.ellipse(-o.w / 2, flap, 12, 7, 0, 0, 6.2832); ctx.fill()
        ctx.beginPath(); ctx.ellipse(o.w / 2, flap, 12, 7, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -4, 4, 0, 6.2832); ctx.arc(6, -4, 4, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-6, -4, 2, 0, 6.2832); ctx.arc(6, -4, 2, 0, 6.2832); ctx.fill()
        ctx.restore()
    }
}

function drawBlock(bl) {
    ctx.save()
    const squash = bl.popT > 0 ? 1 - (bl.popT / 0.35) * 0.25 : 1
    ctx.translate(bl.x + bl.w / 2, bl.y + bl.h / 2)
    ctx.scale(1, squash)
    if (!bl.used) {
        ctx.fillStyle = '#f5b83d'
        ctx.fillRect(-bl.w / 2, -bl.h / 2, bl.w, bl.h)
        ctx.strokeStyle = '#a05a00'; ctx.lineWidth = 3
        ctx.strokeRect(-bl.w / 2, -bl.h / 2, bl.w, bl.h)
        ctx.fillStyle = '#a05a00'; ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('?', 0, 2)
    } else {
        ctx.fillStyle = '#b08968'
        ctx.fillRect(-bl.w / 2, -bl.h / 2, bl.w, bl.h)
        ctx.strokeStyle = '#7a5a3d'; ctx.lineWidth = 3
        ctx.strokeRect(-bl.w / 2, -bl.h / 2, bl.w, bl.h)
    }
    ctx.restore()
}

function drawPowerup(p) {
    const info = POWER_INFO[p.type]
    const yy = p.y + Math.sin(p.t) * 5
    ctx.save()
    ctx.beginPath(); ctx.arc(p.x, yy, p.r + 3, 0, 6.2832)
    ctx.fillStyle = info.color; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1
    ctx.beginPath(); ctx.arc(p.x, yy, p.r, 0, 6.2832)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.lineWidth = 3; ctx.strokeStyle = info.color; ctx.stroke()
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(info.icon, p.x, yy + 1)
    ctx.restore()
}

function drawBoss() {
    if (!boss) return
    ctx.save()
    ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2)
    if (boss.hitFlash > 0) ctx.globalAlpha = 0.6

    if (boss.type === 'dragon') {
        ctx.fillStyle = '#3d8f3d'
        ctx.beginPath(); ctx.ellipse(0, 0, boss.w / 2, boss.h / 2, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#2f6e2f'
        ctx.beginPath(); ctx.moveTo(boss.w / 2 - 6, -8); ctx.lineTo(boss.w / 2 + 34, 0); ctx.lineTo(boss.w / 2 - 6, 18); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#ffb300'
        ctx.beginPath(); ctx.ellipse(0, 14, boss.w / 3, boss.h / 3.4, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#265c26'
        ctx.beginPath(); ctx.ellipse(-boss.w / 2 + 6, -boss.h / 2 + 10, 26, 14, -0.4, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(18, -20, 10, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(20, -20, 4, 0, 6.2832); ctx.fill()
    } else if (boss.type === 'spikeball') {
        ctx.fillStyle = '#4a4a4a'
        ctx.beginPath(); ctx.arc(0, 0, boss.w / 2, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#2e2e2e'
        for (let i = 0; i < 10; i++) {
            const a = i / 10 * 6.2832
            ctx.beginPath()
            ctx.moveTo(Math.cos(a) * (boss.w / 2 - 4), Math.sin(a) * (boss.w / 2 - 4))
            ctx.lineTo(Math.cos(a) * (boss.w / 2 + 16), Math.sin(a) * (boss.w / 2 + 16))
            ctx.lineTo(Math.cos(a + 0.12) * (boss.w / 2 - 4), Math.sin(a + 0.12) * (boss.w / 2 - 4))
            ctx.closePath(); ctx.fill()
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-16, -10, 9, 0, 6.2832); ctx.arc(16, -10, 9, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-16, -10, 4, 0, 6.2832); ctx.arc(16, -10, 4, 0, 6.2832); ctx.fill()
    } else if (boss.type === 'skykoopa') {
        const flap = Math.sin(boss.bob * 3) * 10
        ctx.fillStyle = '#2f7dd1'
        ctx.beginPath(); ctx.ellipse(0, 10, boss.w / 2.3, boss.h / 2.6, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#a5d6ff'
        ctx.beginPath(); ctx.ellipse(0, -14, boss.w / 3.2, boss.h / 3.2, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#1f5faa'
        ctx.beginPath(); ctx.ellipse(-boss.w / 2 + 4, flap, 28, 15, -0.3, 0, 6.2832); ctx.fill()
        ctx.beginPath(); ctx.ellipse(boss.w / 2 - 4, -flap, 28, 15, 0.3, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-14, -18, 9, 0, 6.2832); ctx.arc(14, -18, 9, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-14, -18, 4, 0, 6.2832); ctx.arc(14, -18, 4, 0, 6.2832); ctx.fill()
    } else if (boss.type === 'finalboss') {
        const phase2 = boss.hp <= boss.maxHp / 2
        ctx.fillStyle = phase2 ? '#3d2154' : '#2c1b3d'
        ctx.beginPath(); ctx.ellipse(0, 0, boss.w / 2, boss.h / 2, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#4a2f6b'
        ctx.beginPath(); ctx.ellipse(0, 16, boss.w / 3, boss.h / 3, 0, 0, 6.2832); ctx.fill()
        // coroa
        ctx.fillStyle = '#ffd54a'
        ctx.beginPath()
        ctx.moveTo(-30, -boss.h / 2 + 6); ctx.lineTo(-30, -boss.h / 2 - 18); ctx.lineTo(-14, -boss.h / 2 + 2)
        ctx.lineTo(0, -boss.h / 2 - 24); ctx.lineTo(14, -boss.h / 2 + 2); ctx.lineTo(30, -boss.h / 2 - 18)
        ctx.lineTo(30, -boss.h / 2 + 6); ctx.closePath(); ctx.fill()
        // olhos brilhantes (mais vermelhos na fase 2)
        ctx.fillStyle = phase2 ? '#ff1744' : '#ff5252'
        ctx.beginPath(); ctx.arc(-24, -14, 11, 0, 6.2832); ctx.arc(24, -14, 11, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(-24, -14, 4, 0, 6.2832); ctx.arc(24, -14, 4, 0, 6.2832); ctx.fill()
    } else { // goombaking
        ctx.fillStyle = '#b83b3b'
        ctx.beginPath(); ctx.ellipse(0, 0, boss.w / 2, boss.h / 2, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#e57373'
        ctx.beginPath(); ctx.ellipse(0, 12, boss.w / 3, boss.h / 3, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(-22, -20, 14, 0, 6.2832); ctx.arc(22, -20, 14, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#000'
        ctx.beginPath(); ctx.arc(-20, -18, 6, 0, 6.2832); ctx.arc(24, -18, 6, 0, 6.2832); ctx.fill()
        ctx.fillStyle = '#7a2323'
        ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(-54, -66); ctx.lineTo(-26, -46); ctx.fill()
        ctx.beginPath(); ctx.moveTo(40, -40); ctx.lineTo(54, -66); ctx.lineTo(26, -46); ctx.fill()
    }
    ctx.restore()
}

// ---------- Herói (Capitão Salto) — design 100% original, desenhado por código ----------
function roundedRect(c, x, y, w, h, r) {
    c.beginPath()
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
}

function drawHeroFigure(c, cx, cy, scale, opts) {
    opts = opts || {}
    const dead = !!opts.dead
    const legSwingA = opts.legSwingA || 0
    const legSwingB = opts.legSwingB || 0
    const armSwing = opts.armSwing || 0
    const bodyW = 46 * scale, bodyH = 40 * scale
    const headR = 24 * scale
    const legLen = 30 * scale

    c.save()
    c.translate(cx, cy)

    // pernas e botas
    c.strokeStyle = '#4a2f1a'
    c.lineWidth = 11 * scale
    c.lineCap = 'round'
    if (dead) {
        c.beginPath(); c.moveTo(-bodyW * 0.2, bodyH * 0.25); c.lineTo(bodyW * 0.05, bodyH * 0.55); c.stroke()
        c.beginPath(); c.moveTo(bodyW * 0.2, bodyH * 0.25); c.lineTo(bodyW * 0.42, bodyH * 0.5); c.stroke()
    } else {
        c.beginPath(); c.moveTo(-bodyW * 0.18, bodyH * 0.22); c.lineTo(-bodyW * 0.18 + legSwingA, bodyH * 0.22 + legLen); c.stroke()
        c.beginPath(); c.moveTo(bodyW * 0.18, bodyH * 0.22); c.lineTo(bodyW * 0.18 + legSwingB, bodyH * 0.22 + legLen); c.stroke()
        c.fillStyle = '#2e2118'
        c.beginPath(); c.ellipse(-bodyW * 0.18 + legSwingA, bodyH * 0.22 + legLen, 9 * scale, 6 * scale, 0, 0, 6.2832); c.fill()
        c.beginPath(); c.ellipse(bodyW * 0.18 + legSwingB, bodyH * 0.22 + legLen, 9 * scale, 6 * scale, 0, 0, 6.2832); c.fill()
    }

    // braço de trás
    c.strokeStyle = '#e0ab7a'
    c.lineWidth = 9 * scale
    c.beginPath(); c.moveTo(-bodyW * 0.32, -bodyH * 0.05); c.lineTo(-bodyW * 0.32 - armSwing * 0.6, bodyH * 0.28 - armSwing * 0.4); c.stroke()

    // camisa + colete
    c.fillStyle = '#f0d2a6'
    roundedRect(c, -bodyW / 2, -bodyH / 2, bodyW, bodyH, bodyW * 0.3)
    c.fill()
    c.fillStyle = dead ? '#6b8f6b' : '#2e7d32'
    c.beginPath()
    c.moveTo(-bodyW / 2, -bodyH * 0.35)
    c.lineTo(bodyW / 2, -bodyH * 0.35)
    c.lineTo(bodyW * 0.38, bodyH / 2)
    c.lineTo(-bodyW * 0.38, bodyH / 2)
    c.closePath(); c.fill()

    // cinto e fivela
    c.fillStyle = '#4a2f1a'
    c.fillRect(-bodyW * 0.4, bodyH * 0.22, bodyW * 0.8, bodyH * 0.16)
    c.fillStyle = '#e0b23d'
    c.fillRect(-bodyW * 0.09, bodyH * 0.2, bodyW * 0.18, bodyH * 0.2)

    // braço da frente
    c.strokeStyle = '#f0d2a6'
    c.lineWidth = 9 * scale
    c.beginPath(); c.moveTo(bodyW * 0.32, -bodyH * 0.05); c.lineTo(bodyW * 0.32 + armSwing, bodyH * 0.28 + armSwing * 0.5); c.stroke()

    // cabeça
    const headY = -bodyH / 2 - headR * 0.75
    c.fillStyle = '#f0d2a6'
    c.beginPath(); c.arc(0, headY, headR, 0, 6.2832); c.fill()

    if (dead) {
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.6 * scale
        ;[-headR * 0.32, headR * 0.32].forEach(dx => {
            c.beginPath(); c.arc(dx, headY, headR * 0.16, 0, 4.6); c.stroke()
        })
        c.beginPath(); c.arc(0, headY + headR * 0.35, headR * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke()
    } else {
        c.fillStyle = '#2b1c12'
        c.beginPath(); c.arc(headR * 0.22, headY - headR * 0.02, headR * 0.13, 0, 6.2832); c.fill()
        c.strokeStyle = '#8a5a34'; c.lineWidth = 1.6 * scale
        c.beginPath(); c.arc(headR * 0.05, headY + headR * 0.22, headR * 0.28, 0.05 * Math.PI, 0.55 * Math.PI); c.stroke()
    }

    // bandana + rabicho esvoaçante
    c.fillStyle = dead ? '#8a4a42' : '#c0392b'
    c.beginPath()
    c.moveTo(-headR * 1.02, headY - headR * 0.05)
    c.quadraticCurveTo(0, headY - headR * 1.35, headR * 1.02, headY - headR * 0.05)
    c.quadraticCurveTo(headR * 0.66, headY - headR * 0.42, 0, headY - headR * 0.48)
    c.quadraticCurveTo(-headR * 0.66, headY - headR * 0.42, -headR * 1.02, headY - headR * 0.05)
    c.closePath(); c.fill()
    const flapWiggle = dead ? 0 : Math.sin((opts.time || 0) * 5) * headR * 0.15
    c.beginPath()
    c.moveTo(headR * 0.55, headY - headR * 0.32)
    c.quadraticCurveTo(headR * 1.5 + flapWiggle, headY - headR * 0.1, headR * 1.15, headY + headR * 0.35)
    c.quadraticCurveTo(headR * 0.85, headY, headR * 0.55, headY - headR * 0.32)
    c.fill()

    c.restore()
}

function drawHero() {
    if (player.dead) return
    const airborne = !player.onGround
    const legSwingA = airborne ? -6 : Math.sin(player.runPhase) * 12
    const legSwingB = airborne ? 6 : Math.sin(player.runPhase + Math.PI) * 12
    const armSwing = airborne ? -8 : Math.sin(player.runPhase + Math.PI) * 10
    const scale = player.w / 76
    const invisFlicker = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0
    ctx.save()
    ctx.globalAlpha = invisFlicker ? 0.35 : 1
    drawHeroFigure(ctx, player.x + player.w / 2, player.y + player.h / 2, scale, {
        legSwingA, legSwingB, armSwing, dead: false, time: performanceNow / 1000
    })
    ctx.restore()
}

function drawGameOverPortrait() {
    gameOverCtx.clearRect(0, 0, 140, 140)
    drawHeroFigure(gameOverCtx, 70, 78, 1.05, { dead: true })
}

function draw() {
    ctx.clearRect(0, 0, W, H)
    drawBackground()

    blocks.forEach(drawBlock)
    coinList.forEach(drawCoin)
    powerups.forEach(drawPowerup)
    obstacles.forEach(drawObstacle)
    drawHero()
    if (state === STATE.BOSS) drawBoss()

    // projéteis
    projectiles.forEach(pr => {
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, 6.2832)
        ctx.fillStyle = pr.color || '#ff7043'; ctx.fill()
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke()
    })

    // partículas
    particles.forEach(p => {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
    })
    ctx.globalAlpha = 1

    // aura de escudo em volta do herói
    if (active.shield > 0) {
        ctx.save()
        ctx.globalAlpha = 0.35 + Math.sin(performanceNow / 120) * 0.12
        ctx.beginPath()
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w * 0.85, 0, 6.2832)
        ctx.fillStyle = '#3aa0ff'; ctx.fill()
        ctx.restore()
        ctx.globalAlpha = 1
    }
}

// ---------- Loop ----------
let lastTime = 0
let performanceNow = 0
function loop(time) {
    performanceNow = time
    let dt = lastTime ? (time - lastTime) / 1000 : 0
    lastTime = time
    if (dt > 0.05) dt = 0.05 // evita saltos após aba inativa

    update(dt)
    draw()
    requestAnimationFrame(loop)
}

// ---------- Boot ----------
window.addEventListener('resize', resize)
resize()
initScenery()
loadGameState()
renderRecords()
highScoreEl.textContent = highScore
updateHearts()
requestAnimationFrame(loop)
