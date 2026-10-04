// 打彈珠（Breakout）：240×320 的低解析度畫布，CSS 放大 + pixelated，每一格都是實心像素。
const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const scoreEl = $('score');
const levelEl = $('level');
const livesEl = $('lives');
const bestEl = $('best');
const overlay = $('overlay');
const pauseBtn = $('pause');
const muteBtn = $('mute');

const W = 240, H = 320;
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false;

// 磚塊格：11 欄，每塊 20×8
const COLS = 11, BW = 20, BH = 8, BX = 10, BY = 36;
const PADDLE_Y = 296, PADDLE_H = 6, PADDLE_W = 36, PADDLE_WIDE = 54;
const BALL = 4;
const MAX_LIVES = 5;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// [底色, 亮邊, 暗邊]
const BRICK_COLORS = {
  1: ['#e5484d', '#ff8a8d', '#b8323a'],
  2: ['#f58b3d', '#ffbb85', '#c26420'],
  3: ['#f5b83d', '#ffd98a', '#c98f1c'],
  4: ['#2fb36b', '#7ee0a6', '#1f7f4b'],
  5: ['#3b9cf0', '#8cc8ff', '#2476c4'],
  6: ['#7c6cf0', '#b3a8ff', '#5546c4'],
  H: ['#8a8fb3', '#c9cbe8', '#5b5e8c'], // 硬磚：要打兩下
  S: ['#c9cbe8', '#ffffff', '#8a8fb3'], // 鋼磚：打不破
};

// '.' 空、1–6 一般磚、H 硬磚、S 鋼磚；每列 11 格
const LEVELS = [
  ['66666666666', '11111111111', '22222222222', '33333333333', '44444444444', '55555555555'],
  ['.....H.....', '....H6H....', '...H666H...', '..H55555H..', '.H4444444H.', '33333333333'],
  ['..4.....4..', '...4...4...', '..4444444..', '.44.444.44.', '44444444444', '4.4444444.4', '4.4.....4.4', '...44.44...'],
  ['..11...11..', '.1111.1111.', '11111111111', '11111111111', '.111111111.', '..1111111..', '...11111...', '....111....', '.....1.....'],
  ['HHHHHHHHHHH', '6S6S6S6S6S6', '55555555555', 'S..SS.SS..S', '44444444444', '33333333333'],
];

// 道具：寬平板、多顆球、慢速、加一條命
const POWERS = {
  wide: { color: '#3b9cf0', glyph: ['#.#', '#.#', '#.#', '###', '#.#'] },
  multi: { color: '#7c6cf0', glyph: ['#.#', '###', '###', '#.#', '#.#'] },
  slow: { color: '#2fb36b', glyph: ['.##', '#..', '.#.', '..#', '##.'] },
  life: { color: '#e5484d', glyph: ['...', '.#.', '###', '.#.', '...'] },
};

// ---------- 音效（Web Audio 方波，像紅白機） ----------
const sound = {
  ac: null,
  muted: store.get('mini-games-muted') === '1',
  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!this.ac && AC) this.ac = new AC();
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },
  tone(freq, delay = 0, dur = 0.06, type = 'square', vol = 0.06) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay;
    const osc = this.ac.createOscillator();
    const g = this.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.ac.destination);
    osc.start(t);
    osc.stop(t + dur);
  },
  paddle() { this.tone(330, 0, 0.06); },
  wall() { this.tone(220, 0, 0.03, 'square', 0.03); },
  brick(row) { this.tone(520 + (8 - row) * 60, 0, 0.07); },
  steel() { this.tone(900, 0, 0.05, 'triangle', 0.08); },
  power() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.05, 0.08)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, i * 0.1, 0.12, 'triangle', 0.1)); },
  clear() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.1)); },
};

// ---------- 狀態 ----------
let level, score, lives, bricks, balls, powerups, particles;
let phase;            // serve | play | paused | clear | over
let combo = 0, shake = 0, baseSpeed = 130;
let wideT = 0, slowT = 0;
let best = Number(store.get('breakout-best')) || 0;
const paddle = { x: W / 2, target: W / 2, w: PADDLE_W };
const keys = { left: false, right: false };

// 背景星星（固定位置）
const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53 + 17) % H, c: i % 3 }));

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const breakable = () => bricks.filter(b => b.type !== 'S').length;

function newGame() {
  level = 1;
  score = 0;
  lives = 3;
  loadLevel();
}

function loadLevel() {
  const rows = LEVELS[(level - 1) % LEVELS.length];
  bricks = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      bricks.push({ x: BX + c * BW, y: BY + r * BH, row: r, type: ch, hp: ch === 'H' ? 2 : 1 });
    });
  });
  baseSpeed = Math.min(230, 130 + (level - 1) * 10);
  powerups = [];
  particles = [];
  wideT = slowT = 0;
  serve();
}

function serve() {
  balls = [{ x: paddle.x - BALL / 2, y: PADDLE_Y - BALL, vx: 0, vy: 0, stuck: true }];
  combo = 0;
  phase = 'serve';
  showTip('點一下發射');
  updateHud();
}

function launch() {
  sound.init();
  const a = rand(-0.35, 0.35);
  for (const b of balls) {
    if (!b.stuck) continue;
    b.stuck = false;
    b.vx = baseSpeed * Math.sin(a);
    b.vy = -baseSpeed * Math.cos(a);
  }
  phase = 'play';
  hideOverlay();
}

function act() {
  sound.init();
  if (phase === 'serve') launch();
  else if (phase === 'paused') resume();
  else if (phase === 'clear') { level++; loadLevel(); }
  else if (phase === 'over') newGame();
}

function pause() {
  if (phase !== 'play') return;
  phase = 'paused';
  showBox('暫停中', '準備好就繼續吧', '繼續', 'play');
}

function resume() {
  phase = balls.some(b => b.stuck) ? 'serve' : 'play';
  if (phase === 'serve') showTip('點一下發射');
  else hideOverlay();
}

// ---------- 物理 ----------
function speedOf(b) {
  return Math.hypot(b.vx, b.vy);
}

function setVelocity(b, speed, angle) {
  b.vx = speed * Math.sin(angle);
  b.vy = -speed * Math.cos(angle);
}

function overlaps(b, r) {
  return b.x < r.x + r.w && b.x + BALL > r.x && b.y < r.y + r.h && b.y + BALL > r.y;
}

function brickAt(b) {
  return bricks.find(br => overlaps(b, { x: br.x, y: br.y, w: BW, h: BH }));
}

function moveBall(b, dt) {
  const k = slowT > 0 ? 0.65 : 1;
  const dist = speedOf(b) * k * dt;
  const steps = Math.max(1, Math.ceil(dist / 2));
  const dx = b.vx * k * dt / steps, dy = b.vy * k * dt / steps;
  for (let s = 0; s < steps; s++) {
    // 先動 x 再動 y，分開判斷撞到磚塊的哪一邊
    b.x += dx;
    let hit = brickAt(b);
    if (hit) {
      b.x -= dx;
      b.vx = -b.vx;
      hitBrick(hit);
      break;
    }
    b.y += dy;
    hit = brickAt(b);
    if (hit) {
      b.y -= dy;
      b.vy = -b.vy;
      hitBrick(hit);
      break;
    }
    if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); sound.wall(); }
    if (b.x + BALL > W) { b.x = W - BALL; b.vx = -Math.abs(b.vx); sound.wall(); }
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); sound.wall(); }
    // 平板：依打到的位置決定反彈角度（中間直上、邊緣最斜 60°）
    if (b.vy > 0 && b.y + BALL >= PADDLE_Y && b.y + BALL <= PADDLE_Y + PADDLE_H + 3
      && b.x + BALL >= paddle.x - paddle.w / 2 && b.x <= paddle.x + paddle.w / 2) {
      const rel = clamp((b.x + BALL / 2 - paddle.x) / (paddle.w / 2), -1, 1);
      setVelocity(b, Math.min(260, Math.max(baseSpeed, speedOf(b))), rel * Math.PI / 3);
      b.y = PADDLE_Y - BALL;
      combo = 0;
      sound.paddle();
      break;
    }
  }
  // 避免球幾乎水平來回彈個不停
  const sp = speedOf(b);
  if (Math.abs(b.vy) < sp * 0.28) {
    b.vy = Math.sign(b.vy || -1) * sp * 0.28;
    b.vx = Math.sign(b.vx || 1) * Math.sqrt(sp * sp - b.vy * b.vy);
  }
}

function hitBrick(br) {
  if (br.type === 'S') {
    sound.steel();
    return;
  }
  br.hp--;
  if (br.hp > 0) {
    sound.steel();
    return;
  }
  bricks.splice(bricks.indexOf(br), 1);
  combo++;
  score += (br.type === 'H' ? 20 : 10) * level + (combo - 1) * 5;
  sound.brick(br.row);
  const [base, light] = BRICK_COLORS[br.type];
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: br.x + rand(0, BW), y: br.y + rand(0, BH),
      vx: rand(-60, 60), vy: rand(-80, 10),
      life: rand(0.4, 0.8), c: i % 3 ? base : light,
    });
  }
  // 一點點機率掉道具；每顆球都加速一點
  if (Math.random() < 0.12) {
    const types = Object.keys(POWERS);
    powerups.push({ x: br.x + BW / 2 - 6, y: br.y, type: types[Math.floor(Math.random() * types.length)] });
  }
  for (const b of balls) {
    const sp = speedOf(b);
    if (sp) {
      const k = Math.min(260, sp * 1.01) / sp;
      b.vx *= k;
      b.vy *= k;
    }
  }
  updateHud();
  if (!breakable()) levelClear();
}

function applyPower(type) {
  sound.power();
  if (type === 'wide') wideT = 12;
  else if (type === 'slow') slowT = 10;
  else if (type === 'life') lives = Math.min(MAX_LIVES, lives + 1);
  else if (type === 'multi') {
    const src = balls.find(b => !b.stuck) || balls[0];
    if (!src) return;
    const sp = Math.max(baseSpeed, speedOf(src));
    const a = Math.atan2(src.vx, -src.vy);
    for (const d of [-0.45, 0.45]) {
      const nb = { x: src.x, y: src.y, stuck: false };
      setVelocity(nb, sp, a + d);
      balls.push(nb);
    }
  }
  updateHud();
}

function loseLife() {
  lives--;
  shake = 0.35;
  sound.lose();
  powerups = [];
  wideT = slowT = 0;
  if (lives <= 0) {
    phase = 'over';
    if (score > best) {
      best = score;
      store.set('breakout-best', best);
    }
    updateHud();
    showBox('遊戲結束', `分數 ${score}・第 ${level} 關`, '再玩一次', 'retry');
    return;
  }
  serve();
}

function levelClear() {
  phase = 'clear';
  balls = [];
  sound.clear();
  showBox(`第 ${level} 關完成！`, `目前分數 ${score}`, '下一關', 'play', 'star');
}

function update(dt) {
  // 粒子和畫面搖晃在任何狀態都繼續
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vy += 300 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  shake = Math.max(0, shake - dt);
  if (phase !== 'play' && phase !== 'serve') return;

  if (keys.left) paddle.target -= 220 * dt;
  if (keys.right) paddle.target += 220 * dt;
  wideT = Math.max(0, wideT - dt);
  slowT = Math.max(0, slowT - dt);
  paddle.w = wideT > 0 ? PADDLE_WIDE : PADDLE_W;
  paddle.target = clamp(paddle.target, paddle.w / 2, W - paddle.w / 2);
  paddle.x = paddle.target;

  for (const b of balls) {
    if (b.stuck) {
      b.x = paddle.x - BALL / 2;
      b.y = PADDLE_Y - BALL;
    } else {
      moveBall(b, dt);
    }
    if (phase !== 'play' && phase !== 'serve') return; // 過關了
  }
  balls = balls.filter(b => b.y < H);
  if (phase === 'play' && !balls.length) {
    loseLife();
    return;
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += 45 * dt;
    if (p.y + 6 >= PADDLE_Y && p.y <= PADDLE_Y + PADDLE_H && p.x + 12 >= paddle.x - paddle.w / 2 && p.x <= paddle.x + paddle.w / 2) {
      powerups.splice(i, 1);
      applyPower(p.type);
    } else if (p.y > H) {
      powerups.splice(i, 1);
    }
  }
}

// ---------- 繪圖 ----------
function dot(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawGlyph(rows, x, y, c) {
  rows.forEach((row, r) => [...row].forEach((ch, i) => { if (ch === '#') dot(x + i, y + r, 1, 1, c); }));
}

function drawBrick(b) {
  const [base, light, dark] = BRICK_COLORS[b.type];
  dot(b.x, b.y, BW, BH, dark);
  dot(b.x, b.y, BW - 1, BH - 1, light);
  dot(b.x + 1, b.y + 1, BW - 2, BH - 2, base);
  if (b.type === 'S') {
    // 鉚釘
    dot(b.x + 2, b.y + 2, 1, 1, dark);
    dot(b.x + BW - 3, b.y + 2, 1, 1, dark);
    dot(b.x + 2, b.y + BH - 3, 1, 1, dark);
    dot(b.x + BW - 3, b.y + BH - 3, 1, 1, dark);
  } else if (b.type === 'H' && b.hp === 1) {
    // 裂痕
    [[6, 2], [7, 3], [8, 3], [9, 4], [10, 5], [13, 2], [12, 3]].forEach(([dx, dy]) => dot(b.x + dx, b.y + dy, 1, 1, dark));
  }
}

function drawPaddle() {
  const x = Math.round(paddle.x - paddle.w / 2), y = PADDLE_Y;
  const cap = wideT > 0 ? '#3b9cf0' : '#e5484d';
  dot(x + 1, y, paddle.w - 2, PADDLE_H, '#c9cbe8');
  dot(x + 1, y, paddle.w - 2, 1, '#ffffff');
  dot(x + 1, y + PADDLE_H - 1, paddle.w - 2, 1, '#8a8fb3');
  dot(x, y + 1, 4, PADDLE_H - 2, cap);
  dot(x + paddle.w - 4, y + 1, 4, PADDLE_H - 2, cap);
}

function drawBall(b) {
  const x = Math.round(b.x), y = Math.round(b.y);
  dot(x + 1, y, 2, 4, '#ffffff');
  dot(x, y + 1, 4, 2, '#ffffff');
}

function drawPower(p) {
  const { color, glyph } = POWERS[p.type];
  dot(p.x + 1, p.y, 10, 7, color);
  dot(p.x, p.y + 1, 12, 5, color);
  dot(p.x + 1, p.y, 10, 1, '#ffffff55');
  drawGlyph(glyph, p.x + 5, p.y + 1, '#ffffff');
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
  dot(-4, -4, W + 8, H + 8, '#14152b');
  for (const s of stars) dot(s.x, s.y, 1, 1, ['#2b2d52', '#3a3c6a', '#55588c'][s.c]);
  bricks.forEach(drawBrick);
  powerups.forEach(drawPower);
  particles.forEach(p => dot(p.x, p.y, 2, 2, p.c));
  drawPaddle();
  balls.forEach(drawBall);
  // 道具剩餘時間條
  if (wideT > 0) dot(4, H - 4, Math.round(wideT / 12 * 40), 2, '#3b9cf0');
  if (slowT > 0) dot(W - 4 - Math.round(slowT / 10 * 40), H - 4, Math.round(slowT / 10 * 40), 2, '#2fb36b');
  ctx.restore();
}

// ---------- 畫面上的訊息 ----------
function showTip(text) {
  overlay.innerHTML = `<div class="tip">${text}</div>`;
  overlay.hidden = false;
}

function showBox(title, sub, label, icon, titleIcon) {
  overlay.innerHTML = `<div class="box">
    <h2>${titleIcon ? px(titleIcon) + ' ' : ''}${title}</h2>
    <p>${sub}</p>
    <button id="box-btn">${label} ${px(icon)}</button></div>`;
  overlay.hidden = false;
  $('box-btn').addEventListener('click', e => { e.stopPropagation(); act(); });
}

function hideOverlay() {
  overlay.hidden = true;
}

function updateHud() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  bestEl.textContent = Math.max(best, score);
  livesEl.innerHTML = px('heart').repeat(lives);
  muteBtn.innerHTML = px(sound.muted ? 'sound-off' : 'sound-on');
  pauseBtn.disabled = phase !== 'play' && phase !== 'paused';
}

// ---------- 操作 ----------
function pointerX(e) {
  const r = canvas.getBoundingClientRect();
  return (e.clientX - r.left) / r.width * W;
}

canvas.addEventListener('pointermove', e => { paddle.target = pointerX(e); });
canvas.addEventListener('pointerdown', e => {
  paddle.target = pointerX(e);
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  if (phase === 'serve' || phase === 'paused') act();
});
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  else if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    act();
  } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (phase === 'play') pause();
    else if (phase === 'paused') resume();
  } else return;
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
pauseBtn.addEventListener('click', () => {
  if (phase === 'play') pause();
  else if (phase === 'paused') resume();
  pauseBtn.blur();
});
$('restart').addEventListener('click', e => {
  if (phase === 'over' || score === 0 || confirm('確定要重新開始嗎？')) newGame();
  e.currentTarget.blur();
});
muteBtn.addEventListener('click', () => {
  sound.muted = !sound.muted;
  store.set('mini-games-muted', sound.muted ? '1' : '0');
  updateHud();
  muteBtn.blur();
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

newGame();
requestAnimationFrame(loop);
