# PageStyler AI · AI 网页装修师

基于 **WXT + Vue 3 + Pinia + Zod** 的浏览器插件，界面采用 Neo Brutalism 风格。用自然语言、预设主题、元素选择和手动面板装修任意网页，像装修房间一样装修你的互联网，并通过装修码分享复刻。

## ✨ 功能特性

- **🤖 AI 装修**：用一句自然语言描述需求（如「把导航栏换成黄黑撞色」），AI 生成结构化装修方案，预览满意后再采用；支持多轮增量修改、失效规则智能修复
- **🎨 预设主题**：内置 10 个一键主题——午夜深色、专注阅读、玻璃拟态、Neo Brutalism、赛博朋克、报纸模式、樱花模式、柔和护眼、OLED 黑、像素模式
- **🎯 元素选择**：悬停高亮、点击选中、Shift 多选、Alt 取消、方向键在父/子元素间切换；自动识别相似元素可批量应用
- **🖌 手动装修**：选元素后手动调整颜色、边框、阴影、字体、布局、透明度等，实时预览；也可以一键隐藏或删除元素
- **📮 装修码分享**：把当前装修打包成一串短代码（前缀 `PSAI1.`），发给朋友导入即可一键复刻
- **🐱 吉祥物入口**：页面右侧可拖动的 SVG 吉祥物（6 状态 × 4 配色 × 3 形态），点击打开装修面板
- **⏪ 安全可逆**：所有操作支持撤销 / 重做；一键切换「装修效果 / 原样」，规则保留随时恢复
- **🔒 隐私优先**：数据全部存本地；API Key 不上传；发给 AI 的页面摘要不含输入值、密码、Cookie

## 📦 安装（开发者模式加载）

```bash
git clone https://github.com/ns2250225/zhuangxiu.git
cd zhuangxiu
npm install
npm run build        # 产物在 output/
```

| 浏览器 | 加载方式 |
| --- | --- |
| Chrome | 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `output/chrome-mv3` |
| Edge | 打开 `edge://extensions` → 开启「开发人员模式」→「加载解压缩的扩展」→ 选择 `output/edge-mv3` |
| Firefox | 打开 `about:debugging` →「此 Firefox」→「临时载入附加组件」→ 选择 `output/firefox-mv2/manifest.json`（临时加载，重启浏览器后失效；正式分发需在 addons.mozilla.org 签名） |

上架用 zip 包在 `output/` 目录：`pagestyler-ai-<版本>-chrome.zip`、`-edge.zip`、`-firefox.zip`（提交 AMO 时需连同 `-sources.zip` 一起上传）。

## 🚀 快速上手

1. 打开插件设置页 → **AI 模型** → 填写任意 OpenAI 兼容的 API URL / Key / Model → 测试连接（不用 AI 也可以直接用预设和手动装修）
2. 点击页面上的吉祥物（或按 `Alt+Shift+P`）打开装修面板
3. 选一种装修方式：跟 AI 说需求 / 挑一个预设主题 / 开始元素选择 / 手动调整
4. 预览满意后「采用」，随时用 `Alt+Shift+O` 切回原样

### 快捷键

| 功能 | 默认 |
| --- | --- |
| 切换 装修效果 / 原样 | Alt+Shift+O |
| 打开 / 关闭 装修面板 | Alt+Shift+P |
| 进入元素选择 | Alt+Shift+E |

## 🛠 开发

```bash
npm install
npm run dev          # Chrome 开发模式（自动打开浏览器并热更新）
npm run dev:firefox  # Firefox 开发模式
npm run build        # 构建 Chrome 版（产物在 output/chrome-mv3）
npm run build:firefox
npx wxt build -b edge
npm run compile      # 类型检查（vue-tsc）
npm run zip          # 构建 + 打包 Chrome zip
npx wxt zip -b edge  # Edge 包
npm run zip:firefox  # Firefox 包（MV2）+ 源码包（AMO 审核需要）
```

技术栈：[WXT](https://wxt.dev)（Manifest V3，Firefox 默认 MV2）· Vue 3 `<script setup>` · Pinia · Zod · TypeScript，全部构建产物输出到 `output/`。

## 📁 目录结构

```
entrypoints/
  background.ts        AI 请求转发、快捷键、消息中转
  content/             页面内 UI（Shadow DOM 隔离）
    index.ts           注入、消息监听、SPA 路由监听
    store.ts           Pinia：装修数据、预览、撤销/重做、选择、AI 多轮对话
    usePicker.ts       元素选择（elementFromPoint + 捕获阶段拦截）
    components/        吉祥物入口、侧边面板及各 Tab、手动装修、规则编辑器
  popup/               工具栏弹窗
  options/             设置页（AI、吉祥物、隐私、数据管理、快捷键）
components/Mascot.vue  代码绘制的 SVG 吉祥物
lib/
  decoration-engine.ts 规则 → 单个 <style> 注入；删除元素规则带原位置登记、可还原
  css-sanitize.ts      安全闸门：拦截脚本 / 外部 url / 声明逃逸
  selector-engine.ts   唯一选择器、相似元素识别
  page-summary.ts      发给 AI 的页面结构摘要（不含输入值/密码/Cookie）
  ai/                  提示词、OpenAI 兼容客户端、容错 JSON 解析
  share-code.ts        装修码（deflate + base64url，前缀 PSAI1.）
  presets.ts           10 个预设主题
  storage.ts           browser.storage.local 封装
```

## 🔒 安全与隐私设计

- AI 只能返回 JSON 样式规则；所有规则（AI / 导入 / 备份）都经过 `css-sanitize` 清洗后才会生成 CSS，**绝不执行脚本**。
- 禁止 `expression()`、`javascript:`、`@import`、外部 `url()`（仅允许 `data:image` 内联图片）、`{ } ;` 等逃逸字符。
- 页面摘要只包含标签、类名、尺寸与少量可见文本（可关闭），不读取输入框、密码、Cookie、LocalStorage。
- API Key 仅保存在本地 `browser.storage.local`；装修码不包含 API 配置、聊天记录或任何隐私数据。
- 删除元素的动作在插件内部登记原位置：撤销、停用规则或显示原样时自动放回，`html` / `body` 与插件自身 UI 永不可删。

## 📄 许可证

暂未设置开源许可证，保留所有权利。如需转载或二次开发，请先开 issue 联系。
