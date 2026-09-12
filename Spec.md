# 塔罗学习站 · 技术规格书 (Spec)

> 版本 0.1 · 目标设备：iPad mini（Safari，竖屏为主）· 单人使用

---

## 1. 目标与范围

一个给自己用的塔罗学习工具，不是给别人占卜的工具。核心是**学**：查牌义、学牌阵、每天做题、被 AI 追问和批改。

三个模块 + 一个贯穿全局的 AI 层：

| 模块 | 一句话 |
|---|---|
| 牌面解读查询 | 78 张牌的字典 + 检索 + 象征细节 |
| 牌阵学习 | 牌阵图解 + 位置含义 + 空盘练习 |
| 每日作业 | 根据学习进度生成题目、提交、AI 批改、记录 |
| AI 层 | DeepSeek，自填 API Key，负责出题 / 批改 / 答疑 |

**明确不做**（至少 v1 不做）：账号系统、多设备同步、真实抽牌占卜记录、社交分享、多套牌切换。

---

## 2. 技术栈

**结论：无框架、无构建步骤的纯静态站。**

| 层 | 选型 | 理由 |
|---|---|---|
| 页面 | 原生 HTML + CSS + JS（ES Modules） | 无 npm、无打包、改完刷新就见效 |
| 路由 | hash 路由（`#/cards`、`#/cards/major-00`） | 静态托管不用配 rewrite |
| 状态 | 模块级对象 + `localStorage` 持久化 | 数据量极小，不需要状态库 |
| 数据 | 静态 JSON（`cards.json` / `spreads.json`） | 可手改、可版本控制 |
| 样式 | 手写 CSS（CSS 变量 + `@layer`） | 梦幻风靠渐变和字体，Tailwind 在这里帮不上忙 |
| AI | 浏览器直连 DeepSeek `/chat/completions` | 无后端 |
| 托管 | Cloudflare Pages 或 GitHub Pages | 免费、HTTPS、可装 PWA |

两个必须知道的约束：

1. **不能直接双击 `index.html` 打开。** ES Modules 和 `fetch('data/cards.json')` 在 `file://` 下会被 CORS 拦掉。本地开发用 `python3 -m http.server 8000`，正式使用走托管域名。
2. **DeepSeek 的浏览器直连需要实测。** 如果响应头没有 `Access-Control-Allow-Origin`，浏览器会拦截请求。此时的兜底方案是加一个 Cloudflare Worker 代理（约 30 行，把 Key 从 body 转发到 upstream），域名和 Pages 同源。**M1 阶段第一件事就是验证这个**，因为它决定要不要多一个部署对象。

---

## 3. 目录结构

```
tarot/
├── index.html            # 唯一入口，壳 + <main id="view">
├── manifest.webmanifest  # PWA，standalone 全屏
├── sw.js                 # Service Worker，缓存图片和 JSON
├── css/
│   ├── tokens.css        # 颜色、字号、间距变量
│   ├── base.css          # reset + 排版
│   └── components.css    # 卡片、按钮、弹层
├── js/
│   ├── main.js           # 启动、路由分发
│   ├── router.js
│   ├── store.js          # localStorage 读写 + schema 迁移
│   ├── ai/
│   │   ├── client.js     # DeepSeek 请求封装、流式解析、错误处理
│   │   └── prompts.js    # 三套 system prompt
│   └── views/
│       ├── cards.js
│       ├── spreads.js
│       ├── homework.js
│       ├── chat.js
│       └── settings.js
├── data/
│   ├── cards.json
│   └── spreads.json
├── gen_cards.py          # 一次性生成 cards.json 的脚本
└── Cards-jpg/            # 现有牌面文件夹，原样保留
    ├── 00-TheFool.jpg ... 21-TheWorld.jpg
    ├── Wands01.jpg ... Wands14.jpg
    ├── Cups01.jpg ... Cups14.jpg
    ├── Swords01.jpg ... Swords14.jpg
    ├── Pentacles01.jpg ... Pentacles14.jpg
    └── CardBacks.jpg
```

### 图片命名：不改名

现有命名已经完全规整且可解析，**不做批量重命名**——重命名是破坏性操作，收益只是好看一点。`cards.json` 里的 `image` 字段直接指向原文件名，逻辑 id（`major-00` / `wands-11`）和物理文件名解耦。

宫廷牌编号约定：`11 = 侍从(Page)`、`12 = 骑士(Knight)`、`13 = 王后(Queen)`、`14 = 国王(King)`，与文件序号一致。

`CardBacks.jpg` 用作牌背：翻牌动效的正面、牌阵空盘的占位、每日作业里"先猜后翻"的题型都要用它。

**待办**：确认图片尺寸。iPad mini 是 2x 屏，牌面展示区宽约 300pt → 600px 足够；若原图是高清扫描件（单张 1MB+），需要批量压到长边 1200px / 单张 150KB 内，否则 78 张总量会超过 Service Worker 离线缓存的合理体积。用 `sips`（macOS 自带）一行搞定，不需要装工具。

---

## 4. 数据模型

### 4.1 `cards.json`

顶层结构：`{ version, system: "RWS", cardBack, count: 78, cards: [...] }`。单张牌：

```jsonc
{
  "id": "major-00",
  "name_cn": "愚者",
  "name_en": "The Fool",
  "arcana": "major",          // major | minor
  "suit": null,               // wands | cups | swords | pentacles
  "suit_cn": "圣杯",          // 仅小阿卡纳
  "suit_theme": "情感、关系、直觉、内在体验",  // 仅小阿卡纳
  "number": 0,                // 宫廷牌用 11-14
  "image": "Cards-jpg/00-TheFool.jpg",
  "element": "风",
  "astro": "天王星",
  "numerology": "0 — 未成形的潜能",
  "keywords_up": ["新的开始", "冒险", "天真"],
  "keywords_rev": ["鲁莽", "逃避", "错误的时机"],
  "meaning_up": "长文，2-4 段",
  "meaning_rev": "长文",
  "domains": {
    "love": "...",
    "career": "...",
    "self": "...",
    "advice": "..."
  },
  "symbols": [
    { "name": "白玫瑰", "meaning": "纯粹的动机，尚未被经验污染" },
    { "name": "悬崖", "meaning": "未知，以及不看路的信任" }
  ],
  "pairs": ["major-21"],      // 常见对照牌，用于出题
  "tags": ["起点", "旅程", "风元素"]
}
```

`meaning_*` 和 `domains` 的文本量很大，78 张全手填不现实。**策略：先只填 `keywords`、`element`、`symbols` 这些结构化字段，长文留空，由 AI 在首次查看某张牌时生成并缓存进 localStorage**（字段 `cards[id].aiText`）。这样冷启动成本几乎为零，而且解读风格和出题风格是同一个 AI，前后一致。

### 4.2 `spreads.json`

```jsonc
{
  "id": "three-card-time",
  "name": "时间之流",
  "cardCount": 3,
  "difficulty": 1,            // 1-3，用于按进度推荐
  "when_to_use": "适合线性发展的问题，不适合'该选 A 还是 B'",
  "positions": [
    { "index": 1, "label": "过去", "x": 20, "y": 50,
      "question": "这件事的根源／已经发生的影响是什么？" },
    { "index": 2, "label": "现在", "x": 50, "y": 50, "question": "..." },
    { "index": 3, "label": "未来", "x": 80, "y": 50, "question": "..." }
  ],
  "reading_tips": "先看三张牌的元素配比，再逐位解读，最后串成一句话",
  "common_mistakes": "把'未来'当成宿命，而不是当前轨迹的延长线"
}
```

`x` / `y` 是百分比坐标，牌位用绝对定位铺在一个 `aspect-ratio` 固定的容器里，凯尔特十字这种复杂牌阵也能表达（含 `rotate` 字段给横放的第二张牌）。

v1 内置 6 个牌阵：单张牌、时间之流、二选一、身心灵、关系六芒星、凯尔特十字。

### 4.3 `localStorage` schema（key: `tarot.v1`）

```jsonc
{
  "version": 1,
  "settings": {
    "apiKey": "sk-...",
    "model": "deepseek-chat",
    "dailyTaskCount": 3,
    "tone": "严格"            // 严格 | 温和，影响批改语气
  },
  "cards": {
    "major-00": {
      "status": "learning",   // new | learning | familiar | mastered
      "reviewCount": 3,
      "lastReview": "2026-09-10",
      "nextReview": "2026-09-14",
      "interval": 4,          // 天
      "aiText": { "meaning_up": "...", "cachedAt": "..." }
    }
  },
  "spreads": { "three-card-time": { "status": "familiar", "practiced": 2 } },
  "homework": [
    {
      "date": "2026-09-12",
      "tasks": [ /* 见 5.3 */ ],
      "answers": ["...", "...", "..."],
      "grade": { "score": 82, "perTask": [...], "summary": "...", "weakPoints": ["宫廷牌人格化过度"] },
      "status": "graded"      // pending | submitted | graded
    }
  ],
  "chat": [ { "role": "user", "content": "...", "ts": 0 } ]
}
```

`store.js` 每次读取时检查 `version`，不匹配就跑迁移函数。写入做 300ms 防抖。**localStorage 有 5MB 上限**，`chat` 只保留最近 50 条，`homework` 只保留最近 90 天，超出的自动裁掉。

---

## 5. 模块规格

### 5.1 牌面解读查询

- **列表页**：默认按牌组分五个 Tab（大阿卡纳 / 权杖 / 圣杯 / 宝剑 / 星币），网格展示牌面缩略图，每张角标显示掌握状态（一个小圆点，四种颜色）。
- **搜索**：顶部搜索框，同时匹配中文名、英文名、关键词、tag。纯前端 `filter`，78 条不需要索引。
- **筛选**：元素、数字、掌握状态。
- **详情页**：大图 + 正逆位切换（一个滑块，切换时文字区淡入淡出，牌面图旋转 180°）+ 关键词 chips + 长文解读 + 象征拆解列表 + 底部三个按钮：`标记为已掌握` / `问 AI` / `加入今日复习`。
- 长文若为空 → 显示"生成解读"按钮 → 调 AI → 写入 `aiText` 缓存 → 之后直接读缓存（详情页右上角提供"重新生成"）。

### 5.2 牌阵学习

- **列表**：卡片式，显示牌阵名、张数、难度、掌握状态。
- **详情**：等比容器画出牌位（半透明牌背 + 序号 + 位置名），点击某个牌位 → 底部弹层显示该位置的含义和引导问题。
- **空盘练习**：从牌库随机发牌到各位置 → 对每个位置写解读 → 提交 → AI 批改（复用作业批改逻辑，`type: "spread"`）。练习一次 `practiced +1`。

### 5.3 每日作业

**进度输入**：不需要用户手填。系统从 `store.cards` 直接算出当日状态摘要：

```
今日复习到期：6 张（列出 id）
learning 状态：12 张
未接触：47 张
最近三次作业的薄弱点：宫廷牌人格化过度 / 逆位=坏事的惯性
已学牌阵：单张牌、时间之流
```

这段摘要作为 user message 喂给 AI，AI 返回题目 JSON。

**题型**（AI 从中选择，混合搭配）：

| type | 说明 |
|---|---|
| `recall` | 给牌面图，说出正位三个关键词和一句核心含义 |
| `contrast` | 对比两张易混牌（如星币三 vs 星币八） |
| `scenario` | 给一个生活情境和一张牌，写出解读 |
| `spread` | 给一个牌阵和随机牌面，写完整解读 |
| `symbol` | 指出某张牌上某个象征物的含义 |
| `reverse` | 同一张牌在两种不同提问下的逆位差异 |

**AI 出题返回格式**（强制 JSON，无 markdown 围栏）：

```json
{
  "tasks": [
    { "id": 1, "type": "contrast", "cards": ["pentacles-03", "pentacles-08"],
      "prompt": "这两张都在讲'工作'，说清楚它们的差别在哪一层",
      "hint": "一个关于协作，一个关于独处",
      "rubric": "需要提到：合作 vs 独立精进；外部认可 vs 内在打磨" }
  ],
  "focus": "本次重点是星币牌组的层次区分"
}
```

`rubric` 不展示给用户，提交批改时随答案一起回传给 AI 作为评分依据。

**批改返回格式**：

```json
{
  "perTask": [
    { "id": 1, "score": 8, "max": 10,
      "correct": ["抓住了独处这一层"],
      "missing": ["没有提到外部认可的维度"],
      "comment": "..." }
  ],
  "total": 24, "max": 30,
  "weakPoints": ["宫廷牌人格化过度"],
  "nextFocus": "建议下次加强圣杯宫廷牌"
}
```

批改结果写回 `store`：分数 ≥ 80% 的相关牌 `interval` 翻倍、`status` 升级；< 60% 的 `interval` 重置为 1 天。这是一个简化的 SM-2，不引入完整算法。

**页面结构**：顶部日期和连续天数；无作业时显示"生成今日作业"按钮；有作业时逐题展示（题干 + 相关牌面图 + textarea + 可展开的 hint）；底部"提交批改"；批改后每题展开评语，正确点绿色、缺失点橙色。

### 5.4 AI 问答

全局悬浮按钮，任何页面可唤起底部抽屉。带上下文：当前正在看的牌 / 牌阵会自动作为前缀注入。流式输出（SSE 逐 token 渲染）。

### 5.5 设置

API Key 输入（`type="password"` + 显示切换）、连接测试按钮、模型选择、每日题量、批改语气、数据导出 / 导入（下载 JSON，用于换设备）、清空数据。

**安全声明**：Key 明文存在 localStorage，仅适用于个人设备。设置页需要直白写出这一点，并提醒不要在共用 iPad 上使用。

---

## 6. AI 层实现

### 6.1 请求封装

```js
// js/ai/client.js
const ENDPOINT = 'https://api.deepseek.com/chat/completions';

export async function call({ system, user, json = false, stream = false, signal }) {
  const key = store.get('settings.apiKey');
  if (!key) throw new AIError('NO_KEY');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: store.get('settings.model'),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: json ? 0.3 : 0.8,
      stream,
      ...(json && { response_format: { type: 'json_object' } })
    }),
    signal
  });
  // 401 → 提示 Key 无效；429 → 退避重试一次；5xx → 提示稍后
}
```

JSON 场景（出题、批改、解读生成）额外做一层容错：先尝试 `JSON.parse`，失败则剥离 ` ```json ` 围栏再试，再失败则重试一次并在 prompt 里追加"上次返回不是合法 JSON"。

所有请求带 `AbortController`，超时 60s。请求期间显示骨架屏，不要转圈。

### 6.2 三套 System Prompt 要点

- **解读生成**：韦特体系为准；分正逆位；避免宿命论措辞；逆位不等于负面，而是能量的阻塞、过度或内化；输出纯 JSON。
- **出题**：接收学习进度摘要；题目要能暴露理解偏差而不是考记忆；难度贴着 `learning` 集合走；每题必须给 `rubric`；不要出选择题。
- **批改**：按 rubric 逐条比对；先指出对的地方再指出缺的；语气受 `settings.tone` 控制；不要因为答案措辞不同就判错，只看理解是否到位。

---

## 7. UI 规格（梦幻风）

### 7.1 视觉方向

深夜星空底 + 玻璃拟态卡片 + 微弱的光晕。不要粉紫渐变糊满全屏，那会让 78 张牌面本身失去存在感——**牌是主角，界面是夜色**。

```css
:root {
  --bg-deep:    #0d0a1f;   /* 主背景 */
  --bg-raise:   #171233;   /* 卡片底 */
  --glass:      rgba(255,255,255,.06);
  --border:     rgba(190,170,255,.18);
  --ink:        #ece8ff;
  --ink-dim:    #a89ec9;
  --gold:       #e5c07b;   /* 强调、掌握状态 */
  --violet:     #9d7fff;
  --glow:       0 0 24px rgba(157,127,255,.35);
  --radius:     18px;
}
```

- 背景：`radial-gradient` 两三处紫/靛光斑 + 一层极淡的星点（CSS `background-image` 生成的噪点，不用 canvas 粒子——iPad mini 上跑动画会掉帧、耗电）。
- 卡片：`backdrop-filter: blur(12px)` + 1px 描边 + 内阴影。Safari 对 `backdrop-filter` 支持良好，但同屏超过 10 个会卡，列表页的缩略图**不要**用玻璃效果，只在详情、弹层、顶栏用。
- 字体：标题用衬线（`Noto Serif SC`），正文用系统 `-apple-system`。衬线是"梦幻"最省力的来源，比任何渐变都有效。
- 动效：仅保留页面切换的淡入（200ms）和牌面翻转（400ms `rotateY`）。尊重 `prefers-reduced-motion`。

### 7.2 iPad mini 适配

- 视口：`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`，配 `env(safe-area-inset-*)`。
- 布局断点：竖屏 744pt → 牌网格 4 列；横屏 1133pt → 6 列 + 详情页左右分栏。
- 触摸目标 ≥ 44pt；无 hover 态，用 `:active` 做按下反馈。
- 底部 Tab Bar 导航（四个：牌库 / 牌阵 / 作业 / 设置），比顶部导航更适合单手持握。
- 禁用双击缩放：`touch-action: manipulation`。
- textarea 聚焦时字号 ≥ 16px，否则 Safari 会自动放大页面。
- PWA：`manifest.webmanifest` 设 `display: standalone`、`theme_color: #0d0a1f`，加 `apple-touch-icon`，"添加到主屏幕"后没有地址栏。

---

## 8. 里程碑

| 阶段 | 内容 | 验收 |
|---|---|---|
| **M0** | 保留图片原名、生成 `cards.json` 骨架（脚本填 78 条的 id/name/image/element/number） | JSON 能被 fetch，78 张图都能显示 |
| **M1** | 壳 + 路由 + store + **DeepSeek 直连验证** | 设置页能存 Key，点"测试连接"拿到回复；若 CORS 失败，同期完成 Worker 代理 |
| **M2** | 牌面查询模块（列表 / 搜索 / 详情 / AI 生成解读 + 缓存） | 能查任意一张牌并看到 AI 解读 |
| **M3** | 每日作业模块（生成 / 提交 / 批改 / 进度回写） | 连续三天生成的题目能体现进度变化 |
| **M4** | 牌阵模块 + 全局 AI 问答 | 六个牌阵可练习并被批改 |
| **M5** | PWA + Service Worker 离线 + 数据导出 | 飞行模式下能查牌、能看历史作业（AI 功能提示离线） |

M0-M2 是最小可用闭环，先跑起来再说。

---

## 9. 已确认的决定

| 项 | 结论 |
|---|---|
| 图片位置 | 项目根目录 `Cards-jpg/`，原样保留不改名 |
| 体系 | RWS（韦特），宫廷牌用中文：侍从 / 骑士 / 王后 / 国王 |
| 语言 | 界面与牌义纯中文；`name_en` 仅作为搜索关键词保留，不在 UI 展示 |
| 牌背 | 有，`CardBacks.jpg` |
| 每日重置 | 凌晨 4:00（本地时区）|

### 每日重置的实现

不要用 `new Date().toDateString()`,那是零点切换。用一个"逻辑日期"函数,全站只此一处计算日期：

```js
// js/store.js
export function today() {
  const d = new Date();
  d.setHours(d.getHours() - 4);        // 4 点前算前一天
  return d.toLocaleDateString('sv-SE'); // → "2026-09-12"
}
```

`sv-SE` locale 的日期格式恰好是 `YYYY-MM-DD`,比手拼字符串短且不会有时区偏移问题。作业记录、连续天数、复习到期判断全部走这个函数。

---

## 10. 剩余待办

1. 确认 `Cards-jpg/` 里的图片尺寸和单张体积,决定是否需要压缩(见 §3)。
2. 把 `Cards-jpg/` 和 `gen_cards.py` 放同一层跑一次脚本,它会校验 78 个文件名是否全部对得上、有没有多余文件。
3. `spreads.json` 的六个牌阵还需要手写位置坐标——这部分不适合脚本生成,但只有六个,一次性写完。


## 11. 2026-09-12 补充确认

- 主要入口：iPad mini 的 Safari「添加到主屏幕」，从产品图标以 standalone 模式启动。
- 部署平台：GitHub Pages；所有资源、manifest 和 Service Worker 使用相对路径，支持 `/Arcana/` 项目子目录。
- 产品名称：Arcana。图标采用深靛底色、金色月亮与星光牌面，提供 Apple Touch Icon 及 PWA 图标。
- 现有图片均为 300 × 527 px，总量约 3.44 MB，无需压缩。
- 当前 symbols 为空，纳入 AI 解读生成与本地缓存。
