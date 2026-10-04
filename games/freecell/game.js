// 新接龍（FreeCell）：4 個暫存格、4 個回收區、8 列全部翻開的牌。
const $ = id => document.getElementById(id);
const movesEl = $('moves');
const timeEl = $('time');
const winsEl = $('wins');
const gameNoEl = $('game-no');

const SAVE_KEY = 'freecell-state';
const WINS_KEY = 'freecell-wins';
const C = ['c0', 'c1', 'c2', 'c3'];
const F = ['f0', 'f1', 'f2', 'f3'];
const T = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
const MAX_GAME = 32000;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let st;            // { no, piles, moves, elapsed, won }
let history = [];
let timer = null;

const table = new CardTable($('table'), {
  cols: 8,
  piles: [
    ...C.map((id, i) => ({ id, col: i, row: 0, slot: 'cell' })),
    ...F.map((id, i) => ({ id, col: 4 + i, row: 0, slot: 'foundation' })),
    ...T.map((id, i) => ({ id, col: i, row: 1, fan: 'down', slot: 'empty' })),
  ],
  rules: {
    pick: canPick,
    drop: canDrop,
    move: (from, i, to) => userMove(from, i, to),
    tap,
  },
});

// 微軟新接龍的發牌演算法：同一個編號發出來的牌和 Windows 版完全相同
function msDeal(no) {
  let seed = no;
  const rand = () => {
    seed = (seed * 214013 + 2531011) % 2147483648;
    return Math.floor(seed / 65536) & 0x7fff;
  };
  // 微軟的牌編號：點數 = floor(n / 4)，花色 = n % 4（♣♦♥♠）
  const deck = [...Array(52).keys()];
  const cols = T.map(() => []);
  for (let i = 0; i < 52; i++) {
    const left = 52 - i;
    const j = rand() % left;
    const n = deck[j];
    deck[j] = deck[left - 1];
    cols[i % 8].push({ id: (n % 4) * 13 + Math.floor(n / 4), up: true });
  }
  return cols;
}

const topOf = pid => st.piles[pid][st.piles[pid].length - 1];
const empty = ids => ids.filter(id => !st.piles[id].length).length;

function newGame(no = 1 + Math.floor(Math.random() * MAX_GAME)) {
  const piles = {};
  [...C, ...F].forEach(id => { piles[id] = []; });
  msDeal(no).forEach((col, i) => { piles[T[i]] = col; });
  st = { no, piles, moves: 0, elapsed: 0, won: false };
  history = [];
  stopTimer();
  save();
  table.deal(st);
  updateHud();
}

// 一次能搬幾張：(空暫存格 + 1) × 2^空列數；搬到空列時那一列不算
function maxMove(toEmpty) {
  return (empty(C) + 1) * 2 ** Math.max(0, empty(T) - (toEmpty ? 1 : 0));
}

function isRun(cards) {
  for (let k = 0; k < cards.length - 1; k++) {
    const a = cardOf(cards[k].id), b = cardOf(cards[k + 1].id);
    if (isRed(a) === isRed(b) || b.rank !== a.rank - 1) return false;
  }
  return true;
}

function canPick(pid, i) {
  const pile = st.piles[pid];
  if (st.won || !pile[i] || pid.startsWith('f')) return false;
  if (pid.startsWith('c')) return true;
  const run = pile.slice(i);
  return isRun(run) && run.length <= maxMove(false);
}

function canDrop(from, i, to) {
  if (!canPick(from, i)) return false;
  const moving = st.piles[from].slice(i);
  const c = cardOf(moving[0].id);
  const t = topOf(to) && cardOf(topOf(to).id);
  if (to.startsWith('c')) return moving.length === 1 && !t;
  if (to.startsWith('f')) {
    return moving.length === 1 && (t ? t.suit === c.suit && c.rank === t.rank + 1 : c.rank === 1);
  }
  if (!t) return moving.length <= maxMove(true);
  return isRed(t) !== isRed(c) && c.rank === t.rank - 1 && moving.length <= maxMove(false);
}

function tap(pid, i) {
  if (st.won || table.locked || i < 0) return;
  if (!canPick(pid, i)) {
    table.nope(pid, i);
    return;
  }
  // 點一下：回收區 → 有牌的列 → 空列 → 暫存格
  const targets = [
    ...F,
    ...T.filter(id => st.piles[id].length),
    ...T.filter(id => !st.piles[id].length),
    ...C,
  ];
  const to = targets.find(id => id !== pid && canDrop(pid, i, id));
  if (to) userMove(pid, i, to);
  else table.nope(pid, i);
}

function userMove(from, i, to) {
  history.push(JSON.stringify({ piles: st.piles, moves: st.moves }));
  if (history.length > 300) history.shift();
  st.piles[to].push(...st.piles[from].splice(i));
  st.moves++;
  startTimer();
  table.render(st);
  updateHud();
  autoPlay();
}

// 已經「安全」的牌自動收走：比它小一號的異色牌都收完了，留著也用不到
function findSafe() {
  const fr = [0, 0, 0, 0];
  for (const f of F) {
    const t = topOf(f);
    if (t) fr[cardOf(t.id).suit] = cardOf(t.id).rank;
  }
  for (const from of [...C, ...T]) {
    const t = topOf(from);
    if (!t) continue;
    const c = cardOf(t.id);
    if (c.rank !== fr[c.suit] + 1) continue;
    const opp = isRed(c) ? [0, 3] : [1, 2];
    if (c.rank > 2 && opp.some(s => fr[s] < c.rank - 1)) continue;
    const to = F.find(f => (topOf(f) ? cardOf(topOf(f).id).suit === c.suit : c.rank === 1));
    if (to) return { from, to };
  }
  return null;
}

async function autoPlay() {
  table.locked = true;
  for (let m = findSafe(); m; m = findSafe()) {
    await new Promise(r => setTimeout(r, 120));
    st.piles[m.to].push(st.piles[m.from].pop());
    table.render(st);
  }
  table.locked = false;
  if (F.every(id => st.piles[id].length === 13)) await win();
  save();
  updateHud();
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

async function win() {
  st.won = true;
  stopTimer();
  const wins = (Number(store.get(WINS_KEY)) || 0) + 1;
  store.set(WINS_KEY, wins);
  save();
  updateHud();
  await new Promise(r => setTimeout(r, 300));
  await table.celebrate();
  table.showMessage(`
    <h2>${px('star')} 你贏了！</h2>
    <p>牌局 #${st.no}・${st.moves} 步・${formatTime(st.elapsed)}</p>
    <button id="again">下一局 ${px('retry')}</button>`);
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
  gameNoEl.textContent = `#${st.no}`;
  movesEl.textContent = st.moves;
  timeEl.textContent = formatTime(st.elapsed);
  winsEl.textContent = Number(store.get(WINS_KEY)) || 0;
  $('undo').disabled = !history.length || st.won;
}

const confirmLeave = () => st.won || st.moves === 0 || confirm('目前這局還沒完成，確定要離開嗎？');

$('new').addEventListener('click', e => { if (confirmLeave()) newGame(); e.currentTarget.blur(); });
$('undo').addEventListener('click', e => { undo(); e.currentTarget.blur(); });
$('restart').addEventListener('click', e => { if (confirmLeave()) newGame(st.no); e.currentTarget.blur(); });
$('pick').addEventListener('click', e => {
  e.currentTarget.blur();
  const input = prompt(`輸入牌局編號（1–${MAX_GAME}）`, st.no);
  if (input === null) return;
  const no = Number(input);
  if (Number.isInteger(no) && no >= 1 && no <= MAX_GAME) {
    if (confirmLeave()) newGame(no);
  } else {
    alert(`請輸入 1 到 ${MAX_GAME} 之間的整數`);
  }
});
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
