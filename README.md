# 🎮 Mini Games

一些有趣的網頁小遊戲，純 HTML / CSS / JavaScript，不需要任何建置工具。

## 遊戲列表

| 遊戲 | 說明 |
| --- | --- |
| 🐍 [貪食蛇](games/snake/) | 方向鍵或滑動操控，吃越多越長 |

## 本機執行

```sh
python3 -m http.server 8000
# 打開 http://localhost:8000
```

也可以直接用瀏覽器打開 `index.html`。

## 新增一款遊戲

1. 建立 `games/<slug>/index.html`（可引用 `../../shared/style.css` 共用樣式）
2. 在根目錄 `index.html` 的 `games` 陣列加一筆 `{ slug, emoji, name, desc }`
3. 在上方的遊戲列表補上一行

## 結構

```
index.html          遊戲大廳
shared/style.css    共用樣式
games/<slug>/       每款遊戲一個資料夾
```

## 部署

可直接用 GitHub Pages（Settings → Pages → Deploy from branch `main` / root）。
