// 接龍（Klondike）：7 列牌、4 個回收區，從 A 依花色收到 K。
const $ = id => document.getElementById(id);
const movesEl = $('moves');
const timeEl = $('time');
const bestEl = $('best');
const newBtn = $('new');
const undoBtn = $('undo');
const autoBtn = $('auto');
const drawBtns = document.querySelectorAll('[data-draw]');

const SAVE_KEY = 'solitaire-state';
const BEST_KEY = 'solitaire-best';
const F = ['f0', 'f1', 'f2', 'f3'];
const T = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let st;            // { piles, draw, moves, elapsed, won }
let history = [];  // 復原用的快照
let timer = null;

const table = new CardTable($('table'), {
  cols: 7,
  piles: [
    { id: 'stock', col: 0, row: 0, slot: 'stock' },
    { id: 'waste', col: 1, row: 0, fan: 'waste', slot: 'none' },
    ...F.map((id, i) => ({ id, col: 3 + i, row: 0, slot: 'foundation' })),
    ...T.map((id, i) => ({ id, col: i, row: 1, fan: 'down', slot: 'king' })),
  ],
  rules: {
    pick: canPick,
    drop: canDrop,
    move: (from, i, to) => { snapshot(); moveCards(from, i, to); afterMove(); },
    tap,
    wasteShown: () => st.draw,
  },
});

const topOf = pid => st.piles[pid][st.piles[pid].length - 1];

function newGame(draw = st ? st.draw : 1) {
  const deck = shuffle([...Array(52).keys()]);
  const piles = { stock: [], waste: [] };
  [...F, ...T].forEach(id => { piles[id] = []; });
  T.forEach((id, i) => {
    for (let j = 0; j <= i; j++) piles[id].push({ id: deck.pop(), up: j === i });
  });
  piles.stock = deck.map(id => ({ id, up: false }));
  st = { piles, draw, moves: 0, elapsed: 0, won: false };
  history = [];
  stopTimer();
  save();
  table.deal(st);
  updateHud();
}

function canPick(pid, i) {
  const pile = st.piles[pid];
  if (st.won || !pile[i] || !pile[i].up) return false;
  if (pid.startsWith('t')) return true;
  return (pid === 'waste' || pid.startsWith('f')) && i === pile.length - 1;
}

function canDrop(from, i, to) {
  if (!canPick(from, i)) return false;
  const moving = st.piles[from].slice(i);
  const c = cardOf(moving[0].id);
  const t = topOf(to) && cardOf(topOf(to).id);
  if (to.startsWith('f')) {
    return moving.length === 1 && (t ? t.suit === c.suit && c.rank === t.rank + 1 : c.rank === 1);
  }
  if (to.startsWith('t')) {
    return t ? isRed(t) !== isRed(c) && c.rank === t.rank - 1 : c.rank === 13;
  }
  return false;
}

function snapshot() {
  history.push(JSON.stringify({ piles: st.piles, moves: st.moves }));
  if (history.length > 300) history.shift();
}

function moveCards(from, i, to) {
  st.piles[to].push(...st.piles[from].splice(i));
  // 翻開牌列新露出來的牌
  const t = topOf(from);
  if (from.startsWith('t') && t && !t.up) t.up = true;
}

function afterMove(count = true) {
  if (count) st.moves++;
  startTimer();
  if (F.every(id => st.piles[id].length === 13)) win();
  save();
  table.render(st);
  updateHud();
}

function tap(pid, i) {
  if (st.won || table.locked) return;
  if (pid === 'stock') return drawCards();
  if (i < 0) return;
  if (!canPick(pid, i)) return;
  // 點一下：先試回收區，再試有牌的列，最後才放空列
  const targets = [
    ...F,
    ...T.filter(id => st.piles[id].length),
    ...T.filter(id => !st.piles[id].length),
  ];
  const to = targets.find(id => id !== pid && canDrop(pid, i, id));
  if (to) table.rules.move(pid, i, to);
  else table.nope(pid, i);
}

function drawCards() {
  const { stock, waste } = st.piles;
  if (stock.length) {
    snapshot();
    for (let k = 0; k < st.draw && stock.length; k++) {
      const c = stock.pop();
      c.up = true;
      waste.push(c);
    }
  } else if (waste.length) {
    // 牌庫抽完：廢牌堆翻回去重新抽
    snapshot();
    st.piles.stock = waste.reverse().map(c => ({ id: c.id, up: false }));
    st.piles.waste = [];
  } else {
    return;
  }
  afterMove();
}

function undo() {
  if (!history.length || st.won || table.locked) return;
  const prev = JSON.parse(history.pop());
  st.piles = prev.piles;
  st.moves = prev.moves;
  save();
  table.render(st);
  updateHud();
}

// 所有牌都翻開、牌庫也用完時，可以一鍵收完
const canAuto = () => !st.won && !st.piles.stock.length && !st.piles.waste.length
  && T.every(id => st.piles[id].every(c => c.up));

async function autoComplete() {
  if (!canAuto() || table.locked) return;
  snapshot();
  table.locked = true;
  for (;;) {
    let best = null;
    for (const from of T) {
      const t = topOf(from);
      if (!t) continue;
      const to = F.find(f => canDrop(from, st.piles[from].length - 1, f));
      if (to && (!best || cardOf(t.id).rank < best.rank)) best = { from, to, rank: cardOf(t.id).rank };
    }
    if (!best) break;
    moveCards(best.from, st.piles[best.from].length - 1, best.to);
    st.moves++;
    table.render(st);
    updateHud();
    await new Promise(r => setTimeout(r, 70));
  }
  table.locked = false;
  afterMove(false);
}

async function win() {
  st.won = true;
  stopTimer();
  const best = Number(store.get(BEST_KEY)) || 0;
  const record = !best || st.elapsed < best;
  if (record) store.set(BEST_KEY, st.elapsed);
  save();
  updateHud();
  await new Promise(r => setTimeout(r, 300));
  await table.celebrate();
  table.showMessage(`
    <h2>${px('star')} 你贏了！</h2>
    <p>${st.moves} 步・${formatTime(st.elapsed)}${record ? '・新紀錄！' : ''}</p>
    <button id="again">再來一局 ${px('retry')}</button>`);
  $('again').addEventListener('click', () => newGame());
}

function startTimer() {
  if (timer || st.won) return;
  timer = setInterval(() => {
    st.elapsed++;
    timeEl.textContent = formatTime(st.elapsed);
    if (st.elapsed % 5 === 0) save();
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function save() {
  store.set(SAVE_KEY, JSON.stringify(st));
}

function updateHud() {
  movesEl.textContent = st.moves;
  timeEl.textContent = formatTime(st.elapsed);
  const best = Number(store.get(BEST_KEY)) || 0;
  bestEl.textContent = best ? formatTime(best) : '—';
  drawBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.draw) === st.draw));
  undoBtn.disabled = !history.length || st.won;
  autoBtn.hidden = !canAuto();
}

const confirmLeave = () => st.won || st.moves === 0 || confirm('目前這局還沒完成，確定要開新局嗎？');

newBtn.addEventListener('click', () => { if (confirmLeave()) newGame(); newBtn.blur(); });
undoBtn.addEventListener('click', () => { undo(); undoBtn.blur(); });
autoBtn.addEventListener('click', () => { autoComplete(); autoBtn.blur(); });
drawBtns.forEach(b => b.addEventListener('click', () => {
  const draw = Number(b.dataset.draw);
  if (draw !== st.draw && confirmLeave()) newGame(draw);
  b.blur();
}));
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }
});

// 接續上次沒玩完的牌局
try {
  const saved = JSON.parse(store.get(SAVE_KEY));
  if (saved && saved.piles && !saved.won) {
    st = saved;
    table.render(st);
    updateHud();
  }
} catch {}
if (!st) newGame();
