const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const bestEl = document.getElementById('best');
const actionBtn = document.getElementById('action');

// 邏輯座標，實際像素依 devicePixelRatio 放大
const W = 640, H = 440;
const GROUND = 410;  // 右桶底部
const STAND = 250;   // 左桶底部（放在高台上）
const MAX_LIVES = 3;
const FLOW_SPEED = 60; // 放水時左桶水位每秒下降的 px

const dpr = window.devicePixelRatio || 1;
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.scale(dpr, dpr);

// 2D 畫面裡用「寬度」代表截面積：體積 = 寬 × 高
let level = 1, lives = MAX_LIVES, best = 0;
let phase, round, marker, leftLevel, rightLevel, overflow, message, pipeWet;
try { best = Number(localStorage.getItem('buckets-best')) || 0; } catch {}

const rand = (a, b) => a + Math.random() * (b - a);

function makeRound() {
  for (;;) {
    const lw = rand(70, 170), lh = rand(140, 200);
    const rw = rand(70, 200), rh = rand(90, 160);
    const w0 = lh * rand(0.65, 0.92);
    // 安全區間半寬，關卡越高越窄
    const tol = Math.max(4, rh * (0.09 - level * 0.006));
    const center = rh * rand(0.3, 0.75);
    const lo = center - tol, hi = center + tol;
    // 換算成左桶需要下降的高度
    const dropLo = lo * rw / lw, dropHi = hi * rw / lw;
    if (dropHi < w0 * 0.95 && dropLo > 8 && dropHi - dropLo >= 3) {
      return { lw, lh, rw, rh, w0, lo, hi, dropLo, dropHi, lx: 70, rx: W - 60 - rw };
    }
  }
}

function newRound() {
  round = makeRound();
  marker = leftLevel = round.w0;
  rightLevel = 0;
  overflow = false;
  pipeWet = false;
  phase = 'ready';
  message = '按「開始放水」，紅線會往下掉，覺得夠了就按「停」';
  updateHud();
}

function markerSpeed() {
  return Math.min(70, 32 + level * 3);
}

function act() {
  if (phase === 'ready') {
    phase = 'aiming';
    message = '紅線以上的水會流到右桶…';
  } else if (phase === 'aiming') {
    phase = 'flowing';
    pipeWet = true;
    message = '放水中…';
  } else if (phase === 'result') {
    newRound();
  } else if (phase === 'over') {
    level = 1;
    lives = MAX_LIVES;
    newRound();
  }
  updateHud();
}

function finish() {
  const ok = !overflow && rightLevel >= round.lo && rightLevel <= round.hi;
  if (ok) {
    message = '🎉 完美！剛好落在安全區間';
    level++;
    if (level - 1 > best) {
      best = level - 1;
      try { localStorage.setItem('buckets-best', best); } catch {}
    }
  } else {
    lives--;
    message = overflow ? '💦 溢出來了！'
      : rightLevel < round.lo ? '太少了，水位沒到綠色區間'
      : '太多了，水位超過綠色區間';
  }
  phase = lives > 0 ? 'result' : 'over';
  if (phase === 'over') message = `遊戲結束！你過了 ${level - 1} 關`;
  updateHud();
}

function update(dt) {
  if (phase === 'aiming') {
    marker -= markerSpeed() * dt;
    if (marker <= 0) {
      marker = 0;
      act();
    }
  } else if (phase === 'flowing') {
    leftLevel = Math.max(marker, leftLevel - FLOW_SPEED * dt);
    rightLevel = (round.w0 - leftLevel) * round.lw / round.rw;
    if (rightLevel >= round.rh) {
      rightLevel = round.rh;
      overflow = true;
      finish();
    } else if (leftLevel <= marker) {
      finish();
    }
  }
}

function updateHud() {
  levelEl.textContent = level;
  livesEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(MAX_LIVES - lives);
  bestEl.textContent = best;
  actionBtn.textContent = {
    ready: '開始放水 ▶',
    aiming: '停！⏸',
    flowing: '放水中…',
    result: lives > 0 && message.startsWith('🎉') ? '下一關 ▶' : '再試一次 ↻',
    over: '重新開始 ↻',
  }[phase];
  actionBtn.disabled = phase === 'flowing';
}

// ---------- 繪圖 ----------

// 顏色來自 shared/style.css 的主題變數，切換主題時重新讀取
let C;
function loadColors() {
  C = {
    wall: cssVar('--wall'),
    water: cssVar('--water'),
    waterSoft: cssVar('--water-soft'),
    pipe: cssVar('--pipe'),
    stand: cssVar('--stand'),
    zone: cssVar('--zone'),
    zoneLine: cssVar('--zone-line'),
    marker: cssVar('--marker'),
    text: cssVar('--text'),
  };
}
loadColors();
document.addEventListener('themechange', loadColors);

function drawBucket(x, base, w, h) {
  ctx.strokeStyle = C.wall;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, base - h);
  ctx.lineTo(x, base);
  ctx.lineTo(x + w, base);
  ctx.lineTo(x + w, base - h);
  ctx.stroke();
  // 刻度，每 20px 一格
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.wall;
  ctx.globalAlpha = 0.5;
  for (let y = 20; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(x, base - y);
    ctx.lineTo(x + 7, base - y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function fillWater(x, base, w, from, to, color) {
  if (to <= from) return;
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, base - to, w - 4, to - from);
}

function band(x, base, w, lo, hi, fill, line) {
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, base - hi, w - 4, hi - lo);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  for (const y of [lo, hi]) {
    ctx.beginPath();
    ctx.moveTo(x + 2, base - y);
    ctx.lineTo(x + w - 2, base - y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawPipe() {
  const { lx, lw, rx } = round;
  const x1 = lx + lw, x2 = rx;
  const mid = (x1 + x2) / 2;
  const y1 = STAND - 9, y2 = GROUND - 9;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mid, y1);
    ctx.lineTo(mid, y2);
    ctx.lineTo(x2, y2);
  };
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = C.pipe;
  path();
  ctx.stroke();
  if (pipeWet) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = phase === 'flowing' ? C.water : C.waterSoft;
    path();
    ctx.stroke();
  }
  // 閥門
  const open = phase === 'flowing';
  const vx = (x1 + mid) / 2;
  ctx.fillStyle = open ? C.zoneLine : C.marker;
  ctx.beginPath();
  ctx.arc(vx, y1, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.stand;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (open) { ctx.moveTo(vx - 6, y1); ctx.lineTo(vx + 6, y1); }
  else { ctx.moveTo(vx, y1 - 6); ctx.lineTo(vx, y1 + 6); }
  ctx.stroke();
}

function draw() {
  const { lx, lw, lh, rx, rw, rh, w0 } = round;
  ctx.clearRect(0, 0, W, H);

  // 地面與高台
  ctx.fillStyle = C.stand;
  ctx.fillRect(lx + lw * 0.2, STAND + 2, lw * 0.6, GROUND - STAND);
  ctx.fillRect(0, GROUND + 2, W, H - GROUND);

  drawPipe();

  // 左桶的水；瞄準時把紅線以上「將放掉的水」畫淡一點
  if (phase === 'aiming') {
    fillWater(lx, STAND, lw, 0, marker, C.water);
    fillWater(lx, STAND, lw, marker, w0, C.waterSoft);
  } else {
    fillWater(lx, STAND, lw, 0, leftLevel, C.water);
  }

  // 右桶安全區間與水
  band(rx, GROUND, rw, round.lo, round.hi, C.zone, C.zoneLine);
  fillWater(rx, GROUND, rw, 0, rightLevel, C.water);

  // 結果出來後，在左桶標出正確的停止範圍
  if (phase === 'result' || phase === 'over') {
    band(lx, STAND, lw, w0 - round.dropHi, w0 - round.dropLo, C.zone, C.zoneLine);
  }

  drawBucket(lx, STAND, lw, lh);
  drawBucket(rx, GROUND, rw, rh);

  if (overflow) {
    ctx.fillStyle = C.water;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(rx + rw + 6 + i * 5, GROUND - rh + 10 + i * i * 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 紅色刻度線
  if (phase !== 'ready') {
    const y = STAND - marker;
    ctx.strokeStyle = C.marker;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lx - 14, y);
    ctx.lineTo(lx + lw + 6, y);
    ctx.stroke();
    ctx.fillStyle = C.marker;
    ctx.beginPath();
    ctx.moveTo(lx - 14, y - 7);
    ctx.lineTo(lx - 4, y);
    ctx.lineTo(lx - 14, y + 7);
    ctx.fill();
  }

  ctx.fillStyle = C.text;
  ctx.font = '600 17px system-ui, "PingFang TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, W / 2, 28);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

actionBtn.addEventListener('click', () => { act(); actionBtn.blur(); });
canvas.addEventListener('pointerdown', () => { if (phase !== 'flowing') act(); });
document.addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (phase !== 'flowing') act();
  }
});

newRound();
requestAnimationFrame(loop);
