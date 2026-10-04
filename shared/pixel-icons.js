// 像素風 icon：每個都是 12×12 點陣。
// '.' 為透明，其他字元對應調色盤；'c' 用 currentColor，會跟著文字顏色（按鈕、深色模式）變。
// HTML 裡寫 <i data-px="heart"></i> 會自動換成 SVG；JS 裡用 px('heart') 取得 SVG 字串，
// canvas 用 drawPixelIcon(ctx, 'heart', x, y, size)。

const PX_BASE = {
  k: '#2b2d42', // 外框
  w: '#ffffff',
  r: '#e5484d',
  y: '#f5b83d',
  b: '#3b9cf0',
  g: '#2fb36b',
  p: '#e84a8a',
  m: '#8a8fb3',
  l: '#c9cbe8',
  o: '#b07a4a',
  c: 'currentColor',
};

// 成績方塊：左上亮、右下暗，做出像素按鈕的立體感
function pxSquare(f, h, d) {
  return {
    rows: [
      '.kkkkkkkkkk.',
      'khhffffffffk',
      'khfffffffffk',
      'kffffffffffk',
      'kffffffffffk',
      'kffffffffffk',
      'kffffffffffk',
      'kffffffffffk',
      'kffffffffffk',
      'kfffffffffdk',
      'kffffffffddk',
      '.kkkkkkkkkk.',
    ],
    pal: { f, h, d },
  };
}

const PX_ICONS = {
  gamepad: {
    rows: [
      '............',
      '............',
      '..kkkkkkkk..',
      '.kggggggggk.',
      'kggwggggrggk',
      'kgwwwggrgrgk',
      'kggwggggrggk',
      'kgggkkkkgggk',
      'kggk....kggk',
      '.kk......kk.',
      '............',
      '............',
    ],
    pal: { g: '#7c6cf0' },
  },
  snake: {
    rows: [
      '............',
      '......kkkk..',
      '.....kggggk.',
      '.....kgkggk.',
      '.....kggggkr',
      '..kkkkgggk..',
      '.kgggggkk...',
      'kggkkkk.....',
      'kgggggkkkk..',
      '.kkgggggggk.',
      '...kkkkkkk..',
      '............',
    ],
  },
  bucket: {
    rows: [
      '...kkkkkk...',
      '..k......k..',
      '.kkkkkkkkkk.',
      '.kbbbbbbbbk.',
      '.kmlmmmmmmk.',
      '.kmlmmmmmmk.',
      '..kmlmmmmk..',
      '..kmlmmmmk..',
      '..kkkkkkkk..',
      '...kmmmmk...',
      '...kkkkkk...',
      '............',
    ],
  },
  heart: {
    rows: [
      '............',
      '..kkk..kkk..',
      '.krrrkkrrrk.',
      'krwrrrrrrrrk',
      'krwrrrrrrrrk',
      'krrrrrrrrrrk',
      '.krrrrrrrrk.',
      '..krrrrrrk..',
      '...krrrrk...',
      '....krrk....',
      '.....kk.....',
      '............',
    ],
  },
  'heart-empty': {
    rows: [
      '............',
      '..kkk..kkk..',
      '.klllkklllk.',
      'kllllllllllk',
      'kllllllllllk',
      'kllllllllllk',
      '.kllllllllk.',
      '..kllllllk..',
      '...kllllk...',
      '....kllk....',
      '.....kk.....',
      '............',
    ],
  },
  calendar: {
    rows: [
      '..k......k..',
      'kkkkkkkkkkkk',
      'kppppppppppk',
      'kppppppppppk',
      'kkkkkkkkkkkk',
      'kwwwwwwwwwwk',
      'kwkwkwkwkwwk',
      'kwwwwwwwwwwk',
      'kwkwkwkwkwwk',
      'kwwwwwwwwwwk',
      'kkkkkkkkkkkk',
      '............',
    ],
  },
  'sound-on': {
    rows: [
      '............',
      '............',
      '.....c....c.',
      '....cc.....c',
      'cccccc..c..c',
      'cccccc...c.c',
      'cccccc...c.c',
      'cccccc..c..c',
      '....cc.....c',
      '.....c....c.',
      '............',
      '............',
    ],
  },
  'sound-off': {
    rows: [
      '............',
      '............',
      '.....c......',
      '....cc......',
      'cccccc.c...c',
      'cccccc..c.c.',
      'cccccc...c..',
      'cccccc..c.c.',
      'cccccc.c...c',
      '....cc......',
      '.....c......',
      '............',
    ],
  },
  play: {
    rows: [
      '............',
      '...c........',
      '...cc.......',
      '...ccc......',
      '...cccc.....',
      '...ccccc....',
      '...ccccc....',
      '...cccc.....',
      '...ccc......',
      '...cc.......',
      '...c........',
      '............',
    ],
  },
  pause: {
    rows: [
      '............',
      '............',
      '...cc..cc...',
      '...cc..cc...',
      '...cc..cc...',
      '...cc..cc...',
      '...cc..cc...',
      '...cc..cc...',
      '...cc..cc...',
      '...cc..cc...',
      '............',
      '............',
    ],
  },
  retry: {
    rows: [
      '............',
      '....cccc....',
      '..cc....c.c.',
      '.c.......cc.',
      '.c......ccc.',
      'c...........',
      'c..........c',
      'c..........c',
      '.c........c.',
      '.c........c.',
      '..cc....cc..',
      '....cccc....',
    ],
  },
  'arrow-left': {
    rows: [
      '............',
      '............',
      '............',
      '...c........',
      '..cc........',
      '.cccccccccc.',
      '.cccccccccc.',
      '..cc........',
      '...c........',
      '............',
      '............',
      '............',
    ],
  },
  'arrow-down': {
    rows: [
      '....cccc....',
      '....cccc....',
      '....cccc....',
      '....cccc....',
      '....cccc....',
      '....cccc....',
      '.cccccccccc.',
      '..cccccccc..',
      '...cccccc...',
      '....cccc....',
      '.....cc.....',
      '............',
    ],
  },
  flag: {
    rows: [
      '.k..........',
      '.kkkkkkkkkkk',
      '.kwwkkwwkkwk',
      '.kwwkkwwkkwk',
      '.kkkwwkkwwkk',
      '.kkkwwkkwwkk',
      '.kwwkkwwkkwk',
      '.kkkkkkkkkkk',
      '.k..........',
      '.k..........',
      '.k..........',
      '.k..........',
    ],
  },
  clipboard: {
    rows: [
      '....kkkk....',
      '.kkkkwwkkkk.',
      '.kookkkkook.',
      '.kowwwwwwok.',
      '.kowkkkkwok.',
      '.kowwwwwwok.',
      '.kowkkkkwok.',
      '.kowwwwwwok.',
      '.kowkkkwwok.',
      '.kowwwwwwok.',
      '.kooooooook.',
      '.kkkkkkkkkk.',
    ],
  },
  camera: {
    rows: [
      '............',
      '............',
      '..kkkk...kk.',
      'kkkkkkkkkkkk',
      'kggggkkkgyyk',
      'kgggkllwkggk',
      'kggkllllwkgk',
      'kggkllllkggk',
      'kgggkllkgggk',
      'kggggkkggggk',
      'kkkkkkkkkkkk',
      '............',
    ],
    pal: { g: '#5b5e8c', l: '#3b9cf0' },
  },
  check: {
    rows: [
      '.kkkkkkkkkk.',
      'kggggggggggk',
      'kggggggggwgk',
      'kgggggggwwgk',
      'kggggggwwggk',
      'kgwgggwwgggk',
      'kgwwgwwggggk',
      'kggwwwgggggk',
      'kgggwggggggk',
      'kggggggggggk',
      'kggggggggggk',
      '.kkkkkkkkkk.',
    ],
  },
  star: {
    rows: [
      '.....kk.....',
      '....kyyk....',
      '....kyyk....',
      'kkkkywyykkkk',
      'kyyyywyyyyyk',
      '.kyyyyyyyyk.',
      '..kyyyyyyk..',
      '..kyyyyyyk..',
      '.kyyykkyyyk.',
      '.kyyk..kyyk.',
      'kyyk....kyyk',
      'kkk......kkk',
    ],
  },
  splash: {
    rows: [
      '...b........',
      '...b........',
      '..bbb.......',
      '.bbbbb...b..',
      '.bwbbb...b..',
      'bbwbbbb.bbb.',
      'bbwbbbb.bwb.',
      'bbbbbbb.bbb.',
      '.bbbbb......',
      '..bbb.......',
      '............',
      '............',
    ],
  },
  moon: {
    rows: [
      '............',
      '....yyyy....',
      '..yyyy......',
      '.yyyy.......',
      '.yyy........',
      'yyyy........',
      'yyyy........',
      '.yyy........',
      '.yyyy.......',
      '..yyyyy.....',
      '....yyyyy...',
      '............',
    ],
  },
  sun: {
    rows: [
      '.....y......',
      '.y...y...y..',
      '..y.....y...',
      '....yyy.....',
      '...yyyyy....',
      'yy.yyyyy.yy.',
      '...yyyyy....',
      '....yyy.....',
      '..y.....y...',
      '.y...y...y..',
      '.....y......',
      '............',
    ],
  },
  'sq-hit': pxSquare('#1f9d55', '#5fd08e', '#157a41'),
  'sq-low': pxSquare('#f5b83d', '#ffd98a', '#c98f1c'),
  'sq-high': pxSquare('#e5484d', '#ff8a8d', '#b8323a'),
  'sq-spill': pxSquare('#3b9cf0', '#8cc8ff', '#2476c4'),
  'sq-empty': pxSquare('#e3e5f0', '#ffffff', '#c9cbe8'),
};

function pxPalette(name) {
  const icon = PX_ICONS[name];
  return icon && { rows: icon.rows, pal: { ...PX_BASE, ...icon.pal } };
}

// 回傳 inline SVG 字串；同一列相同顏色的格子合併成一個 rect
function px(name, size = '1.25em') {
  const icon = pxPalette(name);
  if (!icon) return '';
  let rects = '';
  icon.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let n = 1;
      while (row[x + n] === ch) n++;
      if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${icon.pal[ch]}"/>`;
      x += n;
    }
  });
  return `<svg class="px-icon" width="${size}" height="${size}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// 在 canvas 上畫；current 是 'c' 格子的顏色
function drawPixelIcon(g, name, x, y, size, current = '#2b2d42') {
  const icon = pxPalette(name);
  if (!icon) return;
  const s = size / 12;
  icon.rows.forEach((row, ry) => {
    const y0 = Math.round(y + ry * s), y1 = Math.round(y + (ry + 1) * s);
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      const x0 = Math.round(x + rx * s), x1 = Math.round(x + (rx + 1) * s);
      g.fillStyle = ch === 'c' ? current : icon.pal[ch];
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-px]').forEach(el => {
    el.outerHTML = px(el.dataset.px, el.dataset.size);
  });
});
