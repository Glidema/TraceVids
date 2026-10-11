# TraceVids

**把网址变成可发布的产品演示视频。**

TraceVids 不是一个剪辑软件。它把「打开网页 → 按步骤操作 → 录成素材 → 抛光出片」收成一条固定工作流：你给 URL 和步骤脚本，它产出带标题卡、镜头推进和点击高亮的演示片。

当前状态：**本地 CLI MVP 已跑通**（Playwright 录制 + Remotion 抛光）。产品壳、LLM 自动写脚本等能力在路线图中。

---

## 产品是什么

| | |
|---|---|
| **输入** | 网址 + YAML 分步脚本（或先用 scout 扫页出草稿） |
| **过程** | 本机 Chrome 自动操作页面并录像 → Remotion 套模板抛光 |
| **输出** | `demo.webm`（原始录屏）+ `demo-polished.mp4`（可发布成片）+ `meta.json`（步骤时间轴） |

刻意不做：完整多轨剪辑器、系统级桌面录屏、交互式 click-through demo 托管。

---

## 核心思路

传统路径是「人录屏 → 人剪辑 → 导出」。TraceVids 把中间两步变成**可重复的脚本 + 固定抛光模板**：

```text
URL / 目标说明
      ↓
  YAML 步骤脚本（Agent 草稿或人手写）
      ↓
  Playwright 浏览器录制（无需系统录屏权限）
      ↓
  Remotion 抛光（标题 / 推进 / 点击高亮）
      ↓
  可发布 MP4
```

浏览器内录像，不依赖 macOS「屏幕录制」权限，也不用对齐系统窗口——这是相对 OpenScreen / Screen Studio 类方案更轻的一条路。

---

## 功能介绍

### 已具备

- **YAML 分步脚本** — `goto` / `click` / `type` / `scroll` / `upload` / `wait` / `hover` / `press` / `assert`
- **页面巡游录制** — Playwright `recordVideo`，默认 1280×720，优先使用本机 Google Chrome
- **Scout 扫页草稿** — 启发式读取标题、按钮、文件上传控件，生成可编辑 YAML（尚无 LLM）
- **Remotion 抛光** — 标题卡、轻微镜头推进、点击/悬停坐标高亮、淡出片尾 → H.264 MP4
- **一条龙命令** — `npm run demo`：脚本 → 录制 → 抛光

### 规划中

- LLM Agent：根据「网址 + 一句话目标」生成高质量步骤脚本
- 旁白 / 字幕 / 多语言片头
- 品牌模板（配色、字体、画幅 9:16 / 1:1）
- 极简 Web/桌面壳：贴 URL → 预览步骤 → 下载成片
- 登录态、多步骤业务流程、失败自动重试

---

## 适用场景

| 场景 | 怎么用 |
|---|---|
| **SaaS / 工具落地页演示** | 为「转 MP3」「注册」「导入数据」等单页流程写 YAML，批量出片 |
| **文档 / Changelog 配视频** | 每次功能更新改几步脚本，重新 `demo` 即可，无需重剪 |
| **销售 / 投放素材** | 固定模板抛光后直接投信息流或嵌官网 |
| **竞品 / 页面走查存档** | Scout 出草稿 → 微调 → 录一版页面现状 |
| **Agent 自动化内容** | 后续接 LLM 后，可批量「URL 列表 → 演示视频库」 |

示例脚本：[`workflow/scripts/formats-to-mp3.yaml`](workflow/scripts/formats-to-mp3.yaml)（Transcribe 免费转 MP3 页）。

---

## 快速开始

### 环境要求

- Node.js **20+**
- macOS / Windows / Linux 桌面环境（需能启动 Chrome）
- 已安装 **Google Chrome**（推荐；也可改用 Playwright 自带 Chromium）
- 磁盘建议预留 **≥2GB**（Remotion 渲染与浏览器缓存）

### 安装

```bash
cd workflow
npm install
npx playwright install ffmpeg          # 录制写 WebM 需要
cd polish && npm install && cd ..
```

### 三条常用命令

```bash
# 1) 扫页面，生成步骤草稿
npm run scout -- https://example.com -o scripts/example.yaml

# 2) 按脚本录制 + 抛光（推荐）
npm run demo -- --script scripts/formats-to-mp3.yaml --out ./output/transcribe-mp3

# 3) 分步执行（调试时）
npm run record -- --script scripts/formats-to-mp3.yaml --out ./output/transcribe-mp3
npm run polish -- ./output/transcribe-mp3
```

### 产出物

```text
output/transcribe-mp3/
  demo.webm            # 原始浏览器录像
  demo-polished.mp4    # Remotion 成片 ← 优先看这个
  meta.json            # 标题、URL、每步时间戳与点击坐标
```

首次完整跑通约 1–2 分钟（含 Remotion 拉 Headless Shell）；之后会快很多。

---

## 使用教程

### 教程 A：复现官方示例（Transcribe 转 MP3）

```bash
cd workflow
npm run demo -- --script scripts/formats-to-mp3.yaml --out ./output/transcribe-mp3
open ./output/transcribe-mp3/demo-polished.mp4   # macOS
```

脚本会：打开页面 → 展示上传区 → 上传示例音频 → 展开区间选项 → 点击转档 → 打开 FAQ。

### 教程 B：为任意网址做一版演示

1. **生成草稿**

   ```bash
   npm run scout -- https://你的产品.com/feature -o scripts/my-feature.yaml
   ```

2. **编辑脚本**  
   打开 `scripts/my-feature.yaml`，改 `title` / `subtitle`，把步骤改成真正想展示的路径（点哪个按钮、滚到哪、是否上传文件）。

3. **出片**

   ```bash
   npm run demo -- --script scripts/my-feature.yaml --out ./output/my-feature
   ```

4. **不满意就改 YAML 重跑**  
   不用进时间线剪辑；改步骤比改成片便宜。

### 教程 C：只录不抛光 / 只抛光已有录像

```bash
# 只要原始 WebM
npm run record -- --script scripts/my-feature.yaml --out ./output/my-feature

# 已有 output 目录（含 demo.webm + meta.json）时单独抛光
npm run polish -- ./output/my-feature
```

录制时加 `--headed` 可看到浏览器窗口，便于排查选择器：

```bash
npm run record -- --script scripts/my-feature.yaml --out ./output/debug --headed
```

---

## 步骤脚本说明

脚本为 YAML（或 JSON），最小结构：

```yaml
name: my-demo
url: https://example.com
title: 产品一句话标题
subtitle: 副标题
locale: zh-CN
viewport:
  width: 1280
  height: 720
steps:
  - action: goto
    waitUntil: domcontentloaded
  - action: wait
    ms: 1000
  - action: click
    selector: "text=立即开始"
  - action: wait
    ms: 1500
```

### 支持的 action

| action | 作用 | 常用字段 |
|---|---|---|
| `goto` | 打开页面 | `url?` `waitUntil?` |
| `wait` | 等待时间或元素 | `ms?` `selector?` `state?` |
| `click` | 点击 | `selector` `button?` |
| `hover` | 悬停（抛光时可画高亮） | `selector` |
| `type` | 输入文字 | `selector` `text` `clear?` `delayMs?` |
| `press` | 按键 | `key` |
| `scroll` | 滚轮或滚到元素 | `y?` `x?` `selector?` |
| `upload` | 上传文件 | `path` `selector?`（默认 `input[type=file]`） |
| `assert` | 断言可见/文案 | `selector` `textContains?` |

`selector` 使用 [Playwright 选择器](https://playwright.dev/docs/selectors)，常用：

- `text=立即开始`
- `text=/登录|Sign in/i`
- `css=button.primary`
- `role=button[name=/提交/i]`

单步失败默认打警告并继续（保证尽量出片）；需要严格失败时可再加强 `assert`。

---

## 仓库结构

```text
TraceVids/
  README.md                 ← 你正在读的产品文档
  workflow/                 ← 可运行的 MVP
    scripts/                # YAML 演示脚本
    fixtures/               # 上传用示例文件
    src/
      recordUrl.ts          # 录制入口
      scout.ts              # 扫页生成草稿
      demo.ts               # 录制 + 抛光一条龙
      script/               # YAML 加载与执行
    polish/                 # Remotion 抛光工程
    output/                 # 本地产出（gitignore）
```

---

## 常见问题

**Q: 和 Loom / Screen Studio / OpenScreen 有什么区别？**  
A: 那些偏「人录屏 + 编辑器」。TraceVids 偏「脚本驱动浏览器 + 固定模板出片」，目标是可重复、可批量，而不是做更强的时间线。

**Q: 为什么不用系统录屏？**  
A: 系统录屏要处理权限、窗口对齐、跨平台差异，Agent 自动化成本高。浏览器内 `recordVideo` 对「网站演示」足够，也更稳。

**Q: Scout 生成的脚本能直接用吗？**  
A: 只能当草稿。它现在是启发式（标题、按钮、是否有 file input），**不会理解你的产品叙事**。请人工改完再 `demo`。LLM 写脚本在路线图里。

**Q: 提示找不到 ffmpeg？**  
A: 执行 `cd workflow && npx playwright install ffmpeg`。录制写 WebM 依赖 Playwright 自带的 ffmpeg，不是系统 PATH 里的 ffmpeg。

**Q: 没有 Google Chrome 怎么办？**  
A: 安装 Chrome，或 `npx playwright install chromium`（体积较大）。代码会优先 `channel: "chrome"`，失败再回退 Chromium。

**Q: Remotion 很慢 / 在下载 Chrome Headless Shell？**  
A: 首次抛光会下载渲染用浏览器，属正常。完成后缓存在本机，后续会快很多。

**Q: 磁盘空间不够？**  
A: Remotion + 浏览器缓存占用明显。可删 `workflow/polish/node_modules` 重装，或清理旧的 Playwright 浏览器缓存；录制本身只依赖 Chrome + 小体积 ffmpeg。

**Q: 页面要点击登录后的内容？**  
A: MVP 尚未内置登录态/存储状态。可先手动导出 Playwright `storageState` 再接入（后续功能）。现阶段适合公开页或无需登录的演示路径。

**Q: 选择器点不到元素？**  
A: 用 `--headed` 录一遍观察；把 `text=` 改成更稳的 `css=` / `role=`；在点击前加 `wait` 或 `scroll` 到目标。中文文案注意繁简与空格是否与页面一致。

**Q: 成片没有点击高亮？**  
A: 高亮依赖 `meta.json` 里带坐标的 `click` / `hover` 事件。若步骤失败或选择器未命中，坐标会缺失。

**Q: 能出 GIF / 竖屏吗？**  
A: MVP 固定 1280×720 MP4。改画幅与 GIF 导出属于抛光模板增强，尚未做。

**Q: 可以商用吗？**  
A: 本仓库自有代码按你后续选定的许可证为准；Remotion 有自己的[许可条款](https://www.remotion.dev/docs/license)，公司使用前请自行确认。

---

## 路线图（近期）

1. **LLM 生成 YAML** — 输入 URL + 目标句，输出可审脚本  
2. **抛光增强** — 字幕、旁白、品牌色、多画幅  
3. **产品壳** — 最少 UI，隐藏时间线  
4. **稳态** — 登录态、重试、CI 批量出片  

细节优化与功能增强会在这条主线上叠加，而不是重新做剪辑软件。

---

## 许可与致谢

- 录制：[Playwright](https://playwright.dev/)
- 抛光：[Remotion](https://www.remotion.dev/)

---

有问题或想加的场景，直接在仓库里提需求或改 `workflow/scripts/` 下的 YAML 试跑即可。
