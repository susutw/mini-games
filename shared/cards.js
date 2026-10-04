// 像素風撲克牌：牌面繪製 + 牌桌（版面、拖曳、點擊、發牌與勝利動畫）。
// 接龍和新接龍共用，遊戲本身只要提供規則。
//
// 牌的編號 id = 花色 × 13 + (點數 − 1)；花色順序 ♣ ♦ ♥ ♠（和微軟新接龍一樣）。
// 牌堆裡每張牌存成 { id, up }，up 表示正面朝上。

const cardOf = id => ({ id, suit: Math.floor(id / 13), rank: id % 13 + 1 });
const isRed = c => c.suit === 1 || c.suit === 2;

function shuffle(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- 點陣圖形 ----------

const CARD_INK = '#2b2d42';
const SUIT_COLORS = [CARD_INK, '#e5484d', '#e5484d', CARD_INK];

// 3×5 點數字型
const RANK_GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  K: ['#.#', '##.', '#..', '##.', '#.#'],
};

// 5×5 角落小花色，順序 ♣ ♦ ♥ ♠
const SUIT_MINI = [
  ['.###.', '.###.', '#####', '#####', '..#..'],
  ['..#..', '.###.', '#####', '.###.', '..#..'],
  ['.#.#.', '#####', '#####', '.###.', '..#..'],
  ['..#..', '.###.', '#####', '..#..', '.###.'],
];

// 9×9 中央大花色
const SUIT_BIG = [
  ['...###...', '..#####..', '..#####..', '##.###.##', '#########', '#########', '##..#..##', '....#....', '..#####..'],
  ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  ['.##...##.', '####.####', '#########', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  ['....#....', '...###...', '..#####..', '.#######.', '#########', '#########', '.##.#.##.', '....#....', '..#####..'],
];

const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

// 把點陣字串轉成 rect；同一列連續的格子合併
function pxRects(rows, x, y, color, s = 1) {
  let out = '';
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length;) {
      if (row[rx] !== '#') { rx++; continue; }
      let n = 1;
      while (row[rx + n] === '#') n++;
      out += rect(x + rx * s, y + ry * s, n * s, s, color);
      rx += n;
    }
  });
  return out;
}

const rankLabel = r => ({ 1: 'A', 10: '10', 11: 'J', 12: 'Q', 13: 'K' })[r] || String(r);

function rankRects(rank, x, y, color) {
  return [...rankLabel(rank)].map((ch, i) => pxRects(RANK_GLYPHS[ch], x + i * 4, y, color)).join('');
}

// 牌面 24×34，外框圓角
function svgWrap(body, w = '100%', h = '100%') {
  return `<svg viewBox="0 0 24 34" width="${w}" height="${h}" shape-rendering="crispEdges" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
function cardFrame(fill) {
  return rect(1, 0, 22, 34, CARD_INK) + rect(0, 1, 24, 32, CARD_INK) + rect(1, 1, 22, 32, fill) + rect(1, 32, 22, 1, '#dcdfee');
}

const faceCache = new Map();
function cardBody(id) {
  if (faceCache.has(id)) return faceCache.get(id);
  const c = cardOf(id);
  const color = SUIT_COLORS[c.suit];
  const rankW = rankLabel(c.rank).length * 4 - 1;
  // 點數和小花色排在同一行，牌疊起來只露出上緣時也看得到
  let b = cardFrame('#fffdf7');
  b += rankRects(c.rank, 2, 2, color);
  b += pxRects(SUIT_MINI[c.suit], rankW + 3, 2, color);
  b += pxRects(SUIT_MINI[c.suit], 22 - rankW - 6, 27, color);
  b += rankRects(c.rank, 22 - rankW, 27, color);
  if (c.rank > 10) {
    // J / Q / K：金色畫框
    b += rect(6, 11, 11, 11, '#f5b83d') + rect(7, 12, 9, 9, '#fff1cc');
    b += pxRects(SUIT_BIG[c.suit], 7, 12, color);
  } else {
    b += pxRects(SUIT_BIG[c.suit], 7, 12, color);
  }
  faceCache.set(id, b);
  return b;
}

let backBody = null;
function cardBack() {
  if (backBody) return backBody;
  let b = cardFrame('#ffffff') + rect(2, 2, 20, 30, '#3b9cf0');
  for (let y = 3; y < 31; y += 2) {
    for (let x = 3 + (y % 4 === 1 ? 2 : 0); x < 21; x += 4) b += rect(x, y, 1, 1, '#8cc8ff');
  }
  b += pxRects(SUIT_MINI[1], 9.5, 14.5, '#ffffff');
  return (backBody = b);
}

const cardSvg = (id, w, h) => svgWrap(cardBody(id), w, h);
const backSvg = () => svgWrap(cardBack());

// 空位：虛線框 + 淡淡的提示字
function slotSvg(kind) {
  if (kind === 'none') return '';
  const line = 'rgba(255, 255, 255, 0.5)', hint = 'rgba(255, 255, 255, 0.32)';
  let b = '';
  for (let x = 2; x < 22; x += 2) b += rect(x, 0, 1, 1, line) + rect(x, 33, 1, 1, line);
  for (let y = 2; y < 32; y += 2) b += rect(0, y, 1, 1, line) + rect(23, y, 1, 1, line);
  const glyph = { foundation: 'A', king: 'K', stock: '0' }[kind];
  if (glyph) b += pxRects(RANK_GLYPHS[glyph], 9, 12, hint, 2);
  return svgWrap(b);
}

// ---------- 牌桌 ----------
// piles: [{ id, col, row, fan: 'down' | 'waste' | undefined, slot }]
// rules:
//   pick(pile, index)      → 能不能拿起這張（和上面的牌）
//   drop(from, index, to)  → 能不能放到 to
//   move(from, index, to)  → 執行移動（遊戲自己更新狀態並呼叫 render）
//   tap(pile, index)       → 點一下；點空位時 index 為 -1
//   wasteShown()           → 廢牌堆要攤開幾張（接龍抽 3 張時用）

class CardTable {
  constructor(root, { cols, piles, rules, maxCard = 96 }) {
    this.root = root;
    this.cols = cols;
    this.piles = piles;
    this.rules = rules;
    this.maxCard = maxCard;
    this.state = null;
    this.locked = false;
    this.where = new Map();
    this.pos = new Map();
    this.areas = {};
    this.slotEls = new Map();
    this.cardEls = [];

    root.classList.add('card-table');
    for (const p of piles) {
      const el = document.createElement('div');
      el.className = 'card-slot';
      el.dataset.pile = p.id;
      el.innerHTML = slotSvg(p.slot);
      root.append(el);
      this.slotEls.set(p.id, el);
    }
    for (let id = 0; id < 52; id++) {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = id;
      root.append(el);
      this.cardEls.push(el);
    }
    this.msg = document.createElement('div');
    this.msg.className = 'table-msg';
    this.msg.hidden = true;
    root.append(this.msg);

    root.addEventListener('pointerdown', e => this.onDown(e));
    root.addEventListener('pointermove', e => this.onMove(e));
    root.addEventListener('pointerup', e => this.onUp(e));
    root.addEventListener('pointercancel', () => this.onCancel());
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  layout() {
    const width = this.root.clientWidth;
    const gap = Math.max(4, Math.round(width * 0.012));
    let cw = Math.min(this.maxCard, (width - gap * (this.cols + 1)) / this.cols);
    // 卡片夠大時對齊 12 的倍數，像素格才會整齊
    if (cw >= 48) cw = Math.floor(cw / 12) * 12;
    this.cw = cw;
    this.ch = Math.round(cw * 34 / 24);
    this.gap = gap;
    this.left = (width - (this.cols * cw + (this.cols - 1) * gap)) / 2;
    this.root.style.setProperty('--cw', `${cw}px`);
    this.root.style.setProperty('--ch', `${this.ch}px`);
    // 牌列太長時壓縮間距，盡量不超出畫面
    const top = this.root.getBoundingClientRect().top + window.scrollY;
    this.avail = Math.max(this.ch * 4, window.innerHeight - top - 110);
    if (this.state) this.render();
  }

  pileXY(p) {
    return {
      x: this.left + p.col * (this.cw + this.gap),
      y: this.gap + p.row * (this.ch + this.gap * 2),
    };
  }

  offsets(p, cards, baseY) {
    const n = cards.length;
    if (p.fan === 'down') {
      const down = this.ch * 0.11, up = this.ch * 0.27;
      let need = 0;
      for (let i = 0; i < n - 1; i++) need += cards[i].up ? up : down;
      const room = this.avail - baseY - this.ch;
      const k = need > room ? Math.max(0.35, room / need) : 1;
      let y = 0;
      return cards.map(c => {
        const o = { x: 0, y: Math.round(y) };
        y += (c.up ? up : down) * k;
        return o;
      });
    }
    if (p.fan === 'waste') {
      const shown = Math.min(n, this.rules.wasteShown ? this.rules.wasteShown() : 1);
      return cards.map((c, i) => {
        const j = i - (n - shown);
        return { x: j > 0 ? Math.round(j * this.cw * 0.3) : 0, y: 0 };
      });
    }
    return cards.map(() => ({ x: 0, y: 0 }));
  }

  render(state = this.state) {
    this.state = state;
    this.where.clear();
    let z = 1, bottom = 0;
    for (const p of this.piles) {
      const { x, y } = this.pileXY(p);
      this.slotEls.get(p.id).style.transform = `translate(${x}px, ${y}px)`;
      const cards = state.piles[p.id];
      const offs = this.offsets(p, cards, y);
      let lastY = y, lastX = x;
      cards.forEach((c, i) => {
        const el = this.cardEls[c.id];
        const face = c.up ? 'up' : 'down';
        if (el.dataset.face !== face) {
          el.dataset.face = face;
          el.innerHTML = c.up ? cardSvg(c.id) : backSvg();
        }
        const cx = x + offs[i].x, cy = y + offs[i].y;
        el.style.transform = `translate(${cx}px, ${cy}px)`;
        el.style.zIndex = z++;
        el.style.visibility = '';
        this.where.set(c.id, { pile: p.id, index: i });
        this.pos.set(c.id, { x: cx, y: cy });
        lastX = cx;
        lastY = cy;
      });
      // 拖放判定範圍：整列（牌列）或最上面那張
      this.areas[p.id] = p.fan === 'down'
        ? { x, y, w: this.cw, h: lastY - y + this.ch }
        : { x: lastX, y: lastY, w: this.cw, h: this.ch };
      bottom = Math.max(bottom, lastY + this.ch);
    }
    this.root.style.height = `${bottom + this.gap * 2}px`;
  }

  // 發牌動畫：所有牌從第一個牌堆的位置飛到定位
  deal(state) {
    this.hideMessage();
    const from = this.pileXY(this.piles[0]);
    for (const el of this.cardEls) {
      el.style.transition = 'none';
      el.style.transitionDelay = '';
      el.style.transform = `translate(${from.x}px, ${from.y}px)`;
      el.style.visibility = '';
      el.dataset.face = 'down';
      el.innerHTML = backSvg();
    }
    void this.root.offsetHeight;
    let k = 0;
    for (const p of this.piles) {
      for (const c of state.piles[p.id]) {
        const el = this.cardEls[c.id];
        el.style.transition = '';
        el.style.transitionDelay = `${k++ * 16}ms`;
      }
    }
    this.render(state);
    setTimeout(() => this.cardEls.forEach(el => { el.style.transitionDelay = ''; }), k * 16 + 400);
  }

  // 不能移動時讓牌抖一下
  nope(pile, index) {
    const ids = this.state.piles[pile].slice(index).map(c => c.id);
    for (const id of ids) {
      const el = this.cardEls[id];
      el.classList.remove('nope');
      void el.offsetWidth;
      el.classList.add('nope');
    }
  }

  showMessage(html) {
    this.msg.innerHTML = html;
    this.msg.hidden = false;
  }

  hideMessage() {
    this.msg.hidden = true;
  }

  // ---------- 拖曳 ----------

  onDown(e) {
    if (this.locked || e.button > 0 || !this.state) return;
    const cardEl = e.target.closest('.card');
    const slotEl = e.target.closest('.card-slot');
    if (cardEl) {
      const w = this.where.get(+cardEl.dataset.id);
      if (!w) return;
      this.press = { pile: w.pile, index: w.index, x: e.clientX, y: e.clientY, dragging: false };
      try { this.root.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    } else if (slotEl) {
      this.press = { pile: slotEl.dataset.pile, index: -1, x: e.clientX, y: e.clientY, dragging: false };
    }
  }

  onMove(e) {
    const p = this.press;
    if (!p || p.index < 0) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.dragging) {
      if (Math.hypot(dx, dy) < 6) return;
      if (!this.rules.pick(p.pile, p.index)) {
        this.press = null;
        return;
      }
      p.dragging = true;
      p.ids = this.state.piles[p.pile].slice(p.index).map(c => c.id);
      p.ids.forEach((id, k) => {
        const el = this.cardEls[id];
        el.classList.add('dragging');
        el.style.zIndex = 1000 + k;
      });
    }
    p.dx = dx;
    p.dy = dy;
    for (const id of p.ids) {
      const s = this.pos.get(id);
      this.cardEls[id].style.transform = `translate(${s.x + dx}px, ${s.y + dy}px)`;
    }
  }

  onUp() {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (!p.dragging) {
      this.rules.tap(p.pile, p.index);
      return;
    }
    p.ids.forEach(id => this.cardEls[id].classList.remove('dragging'));
    // 落點：和拖曳中第一張牌重疊面積最大、而且規則允許的牌堆
    const s = this.pos.get(p.ids[0]);
    const r = { x: s.x + p.dx, y: s.y + p.dy, w: this.cw, h: this.ch };
    let best = null, bestArea = 0;
    for (const pile of this.piles) {
      if (pile.id === p.pile) continue;
      const a = this.areas[pile.id];
      const ox = Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x);
      const oy = Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y);
      const area = ox > 0 && oy > 0 ? ox * oy : 0;
      if (area > bestArea && this.rules.drop(p.pile, p.index, pile.id)) {
        best = pile.id;
        bestArea = area;
      }
    }
    if (best) this.rules.move(p.pile, p.index, best);
    else this.render();
  }

  onCancel() {
    if (this.press && this.press.dragging) {
      this.press.ids.forEach(id => this.cardEls[id].classList.remove('dragging'));
      this.render();
    }
    this.press = null;
  }

  // ---------- 勝利動畫：經典的彈跳牌 ----------

  async celebrate() {
    this.locked = true;
    const founds = this.piles.filter(p => p.slot === 'foundation').map(p => [...this.state.piles[p.id]]);
    const ids = [];
    while (founds.some(f => f.length)) for (const f of founds) if (f.length) ids.push(f.pop().id);

    const W = this.root.clientWidth, H = this.root.clientHeight;
    const { cw, ch } = this;
    const dpr = window.devicePixelRatio || 1;
    const cv = document.createElement('canvas');
    cv.className = 'card-fx';
    cv.width = W * dpr;
    cv.height = H * dpr;
    this.root.append(cv);
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.imageSmoothingEnabled = false;

    const imgs = new Map();
    await Promise.all(ids.map(id => new Promise(res => {
      const img = new Image();
      img.onload = img.onerror = res;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        cardSvg(id, Math.round(cw * dpr), Math.round(ch * dpr)).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
      imgs.set(id, img);
    })));

    return new Promise(resolve => {
      const active = [];
      let next = 0, wait = 0, last = performance.now(), done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cv.remove();
        this.locked = false;
        resolve();
      };
      cv.addEventListener('pointerdown', finish);
      const step = now => {
        if (done) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        wait -= dt;
        if (wait <= 0 && next < ids.length) {
          const id = ids[next++];
          const s = this.pos.get(id);
          this.cardEls[id].style.visibility = 'hidden';
          const dir = Math.random() < 0.5 ? -1 : 1;
          active.push({ id, x: s.x, y: s.y, vx: dir * ch * (1.5 + Math.random() * 2.5), vy: -ch * Math.random() * 4 });
          wait = 0.14;
        }
        for (let i = active.length - 1; i >= 0; i--) {
          const a = active[i];
          a.vy += ch * 22 * dt;
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          if (a.y + ch > H) {
            a.y = H - ch;
            a.vy = -a.vy * 0.78;
          }
          g.drawImage(imgs.get(a.id), a.x, a.y, cw, ch);
          if (a.x + cw < 0 || a.x > W) active.splice(i, 1);
        }
        if (next >= ids.length && !active.length) setTimeout(finish, 500);
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}

function formatTime(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
