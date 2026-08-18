# vr-polygon-demo

基于 [krpano](https://krpano.com/) 的全景热点 Demo：在立方体贴图场景中编辑、预览**多边形**、**折线**和**图片**热点。热点数据存在 `data/tour.json`，运行时由 JavaScript 通过 krpano API 动态创建，而不是写死在 XML 里。

- 预览页：只读渲染，支持悬停变色、闪烁、标题
- 编辑页：点击加点、拖顶点、改样式、拖图片、抠像，保存回 `tour.json`

---

## 快速开始

```bash
npm install
npm start
```

- 预览：http://localhost:8888/preview
- 编辑：http://localhost:8888/editor

开发时可 `npm run dev`（nodemon 只监听 `server/`）。

---

## 1. 项目组织结构

```
vr-polygon-demo/
├── server/index.js              Express：静态资源 + /api/tour
├── data/tour.json               热点与场景数据（唯一业务数据源）
├── assets/hotspot-image.jpg     图片热点使用的固定素材
├── public/                      前端页面与脚本
│   ├── preview.html / editor.html
│   ├── css/app.css
│   └── js/
│       ├── config.js            路径前缀（本地为空，GitHub Pages 注入）
│       ├── api.js               读/写 tour 数据
│       ├── hotspots.js          热点数据 ↔ krpano 对象（核心）
│       ├── preview.js           预览：加载数据并 applyHotspots
│       └── editor.js            编辑：绘制、改点、图片交互、侧栏
├── krpano/
│   ├── tour.xml                 场景、视野、插件 include
│   ├── tour.js                  krpano 播放器
│   ├── pano/login/              立方体多分辨率瓦片
│   └── plugins/
│       ├── polygon-hotspots.xml 样式 + 悬停 / 闪烁 / 标题显隐
│       └── polygon-editor.xml   顶点拖拽、标题拖拽、图片拖拽、点击加点
└── scripts/build-pages.sh       打包静态站到 _site/
```

### 运行时分层

```
浏览器 UI（editor.html / preview.html）
        │
        ▼
  editor.js / preview.js     交互与生命周期
        │
        ▼
     hotspots.js             把 JSON 记录变成 krpano hotspot
        │
        ▼
  krpano JS API              addhotspot / set / call
        │
        ▼
  polygon-*.xml              style、action（悬停、闪烁、拖拽）
        │
        ▼
     tour.json               持久化
```

页面通过 `embedpano({ xml: tour.xml })` 启动播放器。`tour.xml` 的 `onloadcomplete` 回调 `js(onPanoLoaded())`，前端再把 JSON 里的热点灌进当前 scene。

### 后端与数据

`server/index.js` 职责很窄：

| 路径 | 作用 |
|------|------|
| `GET /preview`、`/` | 预览页 |
| `GET /editor` | 编辑页 |
| `GET /api/tour` | 读 `data/tour.json` |
| `PUT /api/tour` | 写回 JSON（校验必须有 `scenes` 数组） |
| `/krpano`、`/assets`、`/data`、`public/` | 静态文件 |

`TourAPI`（`public/js/api.js`）优先走 REST；GitHub Pages 没有写接口时，读静态 `/data/tour.json`，写 `localStorage`。

### 热点数据形状

业务数据在 `scenes[0].hotspot[]`。本 Demo 只用第一种场景，三种热点靠 `icon.type` 区分：

| `icon.type` | 含义 |
|-------------|------|
| `5` | 多边形（闭合填充） |
| `6` | 折线（不闭合、不填充） |
| `2` | 图片 |

公共字段：`id`、`zOrder`、`title`、`showTitle`、`titleSetting`、`visible`、`icon`。多边形/折线的顶点在 `icon.points[]`，每点是球面坐标 `{ ath, atv }`（水平角 / 垂直角，单位度）。`icon.ath/atv` 是顶点质心，用来放标题默认位置。

---

## 2. 多边形、折线绘制实现

多边形和折线共用同一套 krpano `type="poly"` 热点，差别只有 `polyline` 与填充。绘制、改点、样式都走同一条链路。

### 2.1 球面坐标与跨 ±180°

全景点不是平面像素，而是球面 `(ath, atv)`。相邻两点若跨越经度 ±180°，直接连线会绕远路。`unwrapPoints` 把后续点的 `ath` 展开到与前一点相差不超过 180°：

```javascript
while (ath - prev > 180) ath -= 360;
while (ath - prev < -180) ath += 360;
```

写入 krpano `point[i].ath/atv` 之前、编辑已有图形时都会做这一步。

### 2.2 krpano 侧：样式与行为

`krpano/plugins/polygon-hotspots.xml` 定义两种 style：

| style | 用途 |
|-------|------|
| `polygon_fill` | `polyline="false"`，半透明填充，对应多边形 |
| `polygon_line` | `polyline="true"`，`fillalpha=0`，对应折线 |

`hotspots.js` 的 `addPolyHotspot` 流程：

1. `addhotspot(name)`，`loadstyle(polygon_fill | polygon_line)`
2. 设 `type=poly`、`polyline`、`zorder`、`hittest`
3. `setPolyAppearance`：把 JSON 里的 `r,g,b,a` 转成 krpano 的 `fillcolor`（hex 数值）和 `fillalpha`
4. 写入 `point[i].ath/atv`
5. 预览模式绑 `on_polygon_over/out`；编辑模式绑 `js(onEditorSelectHotspot(...))`，并关掉闪烁

颜色同时存一份 `normal*` 和 `over*`，供悬停和闪烁来回切换。折线强制 `fillalpha=0`，只动边框。

**悬停**：`on_polygon_over` 把 `over*` 拷到当前 `fill*/border*`；`on_polygon_out` 拷回 `normal*`。若标题设了「仅移入显示」，同时开关附属标题热点。

**闪烁**：`polygon_blink_enable` 用 `tween` 在默认色和移入色之间线性插值，tween 结束再递归调用自己。多边形动填充+边框，折线只动边框。悬停时先 `stoptween`，避免和闪烁抢属性。

### 2.3 编辑器绘制状态机

`editor.js` 用 `drawing` + `draft` 表示进行中的图形。草稿热点名固定为 `_draft`，不进 `tour.json`。

```
选择类型
   │
   ▼
startDraw(type)
   │  清空顶点、禁用已有热点点击、打开 editor_draw_events
   ▼
全景 onclick → onEditorPanoClick
   │  screentosphere(mouse.x, mouse.y) → {ath, atv}
   ▼
addPoint → renderDraft
   │  点数 ≥ 2：创建 _draft poly
   │  每个点一个 vtx_* 顶点球
   │  末点两侧：完成 / 删点 按钮
   ▼
finishDraw（侧栏按钮、末点 ✓、双击、Enter）
   │  多边形 ≥ 3 点，折线 ≥ 2 点
   ▼
createHotspotRecord / syncRecordPoints → 正式热点
```

关键细节：

- **点击加点**：`editor_draw_events`（`polygon-editor.xml`）在绘制期间 `enabled=true`，`onclick` 调 `js(onEditorPanoClick())`。280ms 内第二次点击且点数已够，当作双击完成。
- **草稿外观**：点数不足 3 的多边形先按折线画（`asLine = type===POLYLINE || points.length < 3`），避免 krpano 对两点多边形强行闭合。
- **顶点球**：`poly_vertex` 是 css3d 文本热点，HTML 画成蓝/红圆点；最新一点红色。`ondown="drag_poly_vertex()"`：屏幕坐标 ↔ 球面，循环里 `js(onVertexDrag(name))`，把拖动写回 `_draft.point[i]` 和 `draft.points`。
- **末点按钮**：`poly_act_btn` 用 `ox=±20` 贴在最后一个顶点左右。完成走 `finishDraw`，删除走 `undoPoint`（pop 最后一个点）。
- **绘制期间**：已有多边形/图片 `enabled=false`，避免点到旧热点而加不上点。

完成时 `createHotspotRecord` 用顶点质心填 `icon.ath/atv` 和标题默认位置，再 `addPolyHotspot(..., { editable: true })`。

### 2.4 选中后改点

已保存的图形不会一选中就进入加点模式，避免误点：

1. `inspectShape`：只在最后一个顶点放一个不可拖的红点和「编辑」按钮
2. 点编辑 → `resumeDraw`：删掉正式热点，把已有 `points` 装进 `draft`（带 `existingId`），重新打开点击加点
3. 完成 → `syncRecordPoints` 写回同一条记录，不新建 id

顶点拖动中 `onVertexDrag` 直接改 krpano `point[i]` 和 JSON，拖完刷新列表。

### 2.5 样式编辑

侧栏「默认状态 / 移入状态」切 `styleTab`，改的是 `borderColor` vs `overBorderColor`（填充同理）。`replaceRgb` 只换 RGB，保留原 alpha。勾选「交替变化」即 `icon.blink=1`。编辑态关闭真实闪烁，切到「移入状态」时用 `previewHover` 把 over 色画到当前图形上预览。

---

## 3. 图片热点实现

图片热点是独立的 krpano `type="image"` 热点，不走 poly 顶点，而是一张贴在球面上的图，可缩放、旋转、抠像。

### 3.1 创建与默认值

选「图片」时不进入点击加点，而是立刻在当前视线中心放一张图：

```javascript
ath = view.hlookat
atv = view.vlookat
createImageHotspotRecord(ath, atv, nextZOrder)
addImageHotspot(..., { editable: true })
```

默认 `icon`（`defaultImageIcon`）：

- `type: 2`，素材固定 `assets/hotspot-image.jpg`（原图像素 5568×3712）
- `scaleX/scaleY: 0.037`（约 3.7% 原图宽高）
- `stick: 1` → krpano `distorted=true`，图贴在球面上随视角透视
- `zoom: true`，随 FOV 缩放
- `edge: center`，锚点在图片中心

Demo 不支持换图（侧栏「选择图片」禁用）。

### 3.2 映射到 krpano

`applyImageAppearance` 把 JSON 写到热点属性：

| JSON | krpano | 说明 |
|------|--------|------|
| `icon.ath/atv` | `ath/atv` | 球面位置 |
| `icon.edge` | `edge` | 锚点：center / lefttop / … |
| `icon.stick===1` | `distorted` | 贴球面 vs 始终正对屏幕 |
| `icon.zoom` | `zoom` | 是否跟视野缩放 |
| `icon.rx/ry/rz` | `rx/ry/rz`，`rotate=rz` | 三轴旋转 |
| `scaleX/Y × 原图像素` | `width/height`，`scale=1` | 用宽高表达缩放，避免和 zoom 叠乘 |
| `chromaColor` 等 | 1.24：`chromakey`；1.21：替换 `url` | 见下节 |
| `zOrder` | `zorder`，默认 10 | 叠在多边形之上 |

预览时 `handcursor=false`，悬停只控制标题；编辑选中后才能拖。

### 3.3 位置与姿态

**拖动**：选中后 `ondown="drag_image()"`（`polygon-editor.xml`）。逻辑与拖顶点相同：按下时记下鼠标相对热点中心的偏移，循环 `screentosphere` 更新 `ath/atv`，再 `js(onImageDrag)`。拖图片时标题按同一 `Δath/Δatv` 平移，相对位置不变。侧栏上/下/左/右按 1° 步进，同样带动标题。

**固定水平垂直**：`stick=0` → `distorted=false`，图片始终朝向相机，适合 UI 标牌；`stick=1` 则像贴在墙上。

**缩放**：滑条 1%–200% 对应 `scaleX/Y`。勾选锁定宽高比时，改一边按原比例推另一边。内部用 `width = 5568 * scaleX`，`height = 3712 * scaleY`。

**旋转**：`rx/ry/rz` 各 -180°～180°，对应 krpano 热点的欧拉角；`rotate` 与 `rz` 同步，兼容只认 `rotate` 的路径。

### 3.4 抠像（Chroma Key）

业务字段两端相同：`chromaColor`（`#rrggbb`）、`chromaThreshold`（界面叫「蒙板透明度」，默认 0.33）、`chromaSmoothing`（平滑度，默认 0.1）。差别在怎么把这三项变成屏幕上的透明像素。

当前 `main` 用 krpano **1.24 原生 `chromakey`**。1.21 没有该属性，分支 `feat/canvas-matting-krpano-1.21` 在 JS 里用 canvas 离线抠一张 PNG 再赋给热点 `url`。

#### 3.4.1 当前 main：krpano 1.24 原生 chromakey

`applyImageAppearance` 把三项拼成 krpano 认识的字符串后直接设到热点上：

```
0xRRGGBB|threshold|smoothing
```

有抠像时 `alphahittest=0.08`，透明区域点不中。播放器在 GPU 里按色差抠，改参数几乎零延迟。

取色两条路：

1. **EyeDropper API**（支持的浏览器）：系统取色器，拿到 `sRGBHex`
2. **场景取色**：关掉全景拖拽，点击画面。先暂时清掉当前图的 `chromakey`，避免吸到已抠过的色；优先 `webGL.makeScreenshot` 按鼠标舞台坐标读像素，失败再把 `#pano canvas` 画到 1×1 canvas 取样

调色盘是 HSV 面板，改色后立刻 `applyImageAppearance`，全景里实时看到抠像结果。

#### 3.4.2 krpano 1.21：Canvas 手动抠像（`feat/canvas-matting-krpano-1.21`）

1.21 的 image 热点没有 `chromakey`。该分支把查看器退回 1.21（`tour.xml` 的 `version="1.21"`，使用对应 `tour.js`），抠像完全在 `hotspots.js` 里做：按所选颜色生成带透明通道的 PNG，再把 blob URL 赋给 `hotspot.url`。JSON 字段不变，预览/编辑页行为与 1.24 对齐。

**为什么不能设 `chromakey`**：属性写了也会被忽略，图永远是原 JPG。所以 `applyImageAppearance` 改为调用 `applyImageUrl`，不再碰 `chromakey` / `alphahittest`。

**流水线**：

```
icon.chromaColor + threshold + smoothing
        │
        ▼
chromaKeyValue → "#rrggbb|0.33|0.1"   （只作缓存键，不传给 krpano）
        │
        ▼
ensureSourceImage                     原图只加载一次（CORS + 等待队列）
        │
        ▼
buildChromaBlobUrl
  canvas 拉到原图像素尺寸（5568×3712）
  getImageData → 逐像素改 alpha
  toDataURL(png) → Blob → URL.createObjectURL
        │
        ▼
hotspot.url = blob:...                krpano 当普通透明图渲染
```

`applyHotspots` 一开始就会 `ensureSourceImage`，避免第一条带抠像的热点要等原图下载。没有 `chromaColor` 时直接用原始 JPG。

**逐像素公式**（`chromaPixelAlpha`）：RGB 欧氏距离除以 255，得到 0～√3 量级的色差 `dist`：

```
dist = sqrt((r-kr)² + (g-kg)² + (b-kb)²) / 255
alpha = 0                          若 dist ≤ threshold     （当作键色，全透明）
alpha = 1                          若 dist ≥ threshold+smoothing
alpha = (dist - threshold) / smoothing   （过渡带，软边）
```

再与原图像素 alpha 取小：`data[i+3] = min(原 alpha, 255 * alpha)`。threshold 越大，被抠掉的颜色范围越宽；smoothing 越大，边缘越糊。

**缓存与竞态**：同一组 `#hex|threshold|smoothing` 最多算一次，结果进 `chromaCache`（最多 8 条，超出丢掉最旧的键）。滑条连续拖动时，`chromaJobs[name]` 自增；异步回调里若 job id 对不上当前热点，丢弃结果，避免旧 PNG 盖住新参数。编辑页滑条还有 40ms debounce——全尺寸 `getImageData` 很重，不能像 1.24 那样每个 `input` 都立刻重算。

**取色差异**：1.21 没有（或不稳定）`webGL.makeScreenshot`，也没有运行时 `chromakey` 可临时关掉。场景取色只从 `#pano canvas` 抽 1×1 像素。图已经是抠过的 PNG，点到透明处可能吸到后面的全景色，这是可接受的折中。EyeDropper API 路径与 1.24 相同。

**和 1.24 的取舍**：

| | 1.24 原生 | 1.21 Canvas |
|--|-----------|-------------|
| 谁做抠像 | krpano GPU | JS `getImageData` |
| 热点上看到的 | 原图 URL + `chromakey` | 已抠好的 PNG blob URL |
| 改滑条 | 即时 | 需重生成整图，有 debounce |
| 内存 | 几乎无额外 | 每组参数一张 PNG blob（缓存 8 条） |
| 透明点击 | `alphahittest` | 依赖 PNG alpha（1.21 默认按图采样） |

### 3.5 标题热点（多边形/图片共用）

标题不是 poly/image 自己的 HTML，而是旁边一颗 `type="text"` 热点（style `title_hotspot`），名字为 `{id}_title`。

- 位置独立：`titleSetting.ath/atv`，编辑时可 `drag_title()` 单独拖
- `zoom` / `fixedHV`：跟画面缩放、是否始终正对相机（`distorted = fixedHV !== 1`）
- `showWhenHoving`：预览里默认隐藏，父热点 `onover` 再显示；编辑态始终显示便于摆位置

父热点上记 `titlehs` 和 `hover_title`，XML action 只根据这两个字段开关标题，不必再调 JS。

---

## 相关文件速查

| 想改什么 | 看哪里 |
|----------|--------|
| 多边形/折线如何变成 krpano 对象 | `public/js/hotspots.js` → `addPolyHotspot`、`unwrapPoints` |
| 点击加点、草稿、改点 | `public/js/editor.js` → `startDraw`、`renderDraft`、`onEditorPanoClick` |
| 顶点/图片/标题拖拽 | `krpano/plugins/polygon-editor.xml` |
| 悬停、闪烁 | `krpano/plugins/polygon-hotspots.xml` |
| 图片外观、1.24 原生抠像 | `public/js/hotspots.js` → `applyImageAppearance`、`chromaKeyValue` |
| 1.21 Canvas 抠像 | 分支 `feat/canvas-matting-krpano-1.21`：`applyImageUrl`、`buildChromaBlobUrl`、`chromaPixelAlpha` |
| 图片拖动、缩放、取色 | `public/js/editor.js` → `onImageDrag`、`applyLiveImage`、`startEyedropper` |
| 字段含义 | `data/tour.json` 里现有热点 |

---

## 部署

推送 `main`/`master` 时，GitHub Actions 跑 `scripts/build-pages.sh`：把 `public`、`krpano`、`assets`、`data` 拷到 `_site`，按仓库名改 `<base href>` 和 `APP_BASE`。Pages 上保存只写入浏览器 `localStorage`，不会改仓库里的 `tour.json`。

---

<p align="center">
  <a href="https://cursor.com"><img src="assets/thanks/cursor.png" width="120" height="120" alt="Cursor" /></a>
  &nbsp;&nbsp;
  <a href="https://grok.com"><img src="assets/thanks/grok.png" width="120" height="120" alt="Grok" /></a>
</p>
<p align="center">感谢以上两位开发者</p>
