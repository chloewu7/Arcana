# Arcana · 塔罗学习手记

面向 iPad mini Safari / 添加到主屏幕的中文塔罗学习 PWA。原生 HTML、CSS、ES Modules，无 npm 和构建依赖。

## 本地使用

```sh
python3 -m http.server 8000
```

访问 http://localhost:8000 。不能直接双击 HTML。设置页填写个人 DeepSeek API Key，保存并测试连接。

## GitHub Pages

仓库：`chloewu7/Arcana`。已提供 `.github/workflows/pages.yml`，仅上传网站文件，不上传测试、规格及生成脚本。

1. 将项目提交并推送到 `main`。
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
3. 运行 / 等待 **Deploy Arcana to GitHub Pages** 工作流成功。
4. 访问 `https://chloewu7.github.io/Arcana/`，用 Safari 分享 → 添加到主屏幕。

所有资源路径、manifest scope/start_url 和 Service Worker 均支持 `/Arcana/` 子目录。仓库仍未在本次实现中推送或发布。

## 离线与更新

首次联网打开后，缓存网站壳、78 张牌、牌背、牌阵与图标。设置页可检查离线是否就绪。离线支持牌库、已缓存的解读、手记和牌阵练习；AI 需要联网。

发布修改时递增 `sw.js` 的 CACHE 版本，保证资源一致。安装新缓存成功后才接管并删除旧缓存，重新打开即可加载新版。主屏幕图标更新可能需要移除快捷入口后重新添加。

数据存于当前来源的 `localStorage`，不会同步到 GitHub。默认导出不包含 Key；「导出原始存储」包含原始全部数据（可能含 Key），仅用于自行备份恢复。导入覆盖前有确认。作业保留最近 90 天、聊天保留最近 50 条。

## 验证

```sh
node --experimental-default-type=module tests/core.mjs
```

覆盖凌晨 4 点边界、跨年日期、78 张图片映射、6 个牌阵、AI JSON 校验、评分范围与总分、复习间隔、损坏备份拒绝、分块 SSE 中文、JSON 重试、重复批改保护与牌阵计数。

2026-09-12：DeepSeek 对 `https://chloewu7.github.io` 的 OPTIONS 预检返回 200，允许 POST、authorization、content-type。未使用真实 Key 验证付费生成；需要在设置页完成连接测试。接口依据 [DeepSeek 官方文档](https://api-docs.deepseek.com/api/create-chat-completion/)。

## 素材与图标

`Cards-jpg/` 保持原名。`gen_cards.py` 生成 `data/cards.json`，会覆盖其中手工更改；现有根目录 `cards.json` 作为原始输入保留。

图标：`assets/icon-original.png`，以及 180 / 192 / 512 像素的 Apple Touch Icon / PWA 派生文件。使用内置 imagegen 生成，提示词见 `assets/icon-prompt.txt`。
