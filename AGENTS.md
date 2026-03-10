# AGENTS

## 发布打包规范（Chrome Web Store）
当用户要求“打包插件上传商店”时，默认使用白名单打包，避免把开发文件带入发布包。

### 1) 仅打包运行必需文件
- `manifest.json`
- `background.js`
- `newtab.html`
- `newtab.js`
- `options.html`
- `options.js`
- `input-ui.js`
- `document-pip-picker.js`
- `hotkey-listener.js`
- `auto-pip-blacklist.js`
- `site-auto-pip.js`
- `youtube-auto-pip.js`
- `youtube-auto-pip-page.js`
- `_locales/`
- `assets/`

### 2) 必须排除
- `.git/`、`.github/`
- `.vscode/`
- `README.md`
- `AGENTS.md` 及其他 agent/流程说明文件
- 所有 `.DS_Store`
- 其他非运行必需文件

### 3) 打包命令（标准）
在仓库根目录执行：

```bash
mkdir -p dist
VERSION=$(node -p "require('./manifest.json').version")
ZIP="dist/lumno-store-v${VERSION}.zip"
rm -f "$ZIP"
zip -r "$ZIP" \
  manifest.json background.js \
  newtab.html newtab.js \
  options.html options.js \
  input-ui.js document-pip-picker.js hotkey-listener.js auto-pip-blacklist.js \
  site-auto-pip.js youtube-auto-pip.js youtube-auto-pip-page.js \
  _locales assets \
  -x "*.DS_Store"
```

### 4) 打包后校验（必须）
- 用 `unzip -l <zip>` 检查内容。
- 确认不包含 `.git`、`.github`、`.vscode`、`README.md`、`AGENTS.md`、`.DS_Store`。
- 确认 `manifest` 引用资源都在包内。

## 搜索逻辑一致性规范（必须）
- 任何涉及“搜索建议/排序/打分/匹配权重”的改动，必须同步检查 `background.js` 与 `newtab.js`，避免入口行为不一致。
- `newtab.js` 的输入建议默认通过 `chrome.runtime.sendMessage({ action: 'getSearchSuggestions' })` 复用 `background.js` 结果；若新增本地排序分支，必须与后台同权重策略并在 PR 说明中注明。
- 涉及 URL 路径关键词（如 `/release/`）或最近访问频次（`lastVisitTime`、`visitCount`、`typedCount`）的权重调整时，必须做双入口回归：普通网页浮层 + 新标签页浮层。

## AI 搜索落地规范（v1）
- AI 搜索模式必须由输入框右侧 `AI` 按钮切换，浮层与新标签页保持一致交互。
- 双入口统一走 `chrome.runtime.sendMessage({ action: 'getSearchSuggestions', query, mode, context })`，其中 `mode` 取值 `classic|ai`。
- AI 模式的自然语言解析（时间范围、主题关键词、模糊词扩展）只放在 `background.js`，前端仅负责展示和状态切换。
- 任何 AI 模式下的召回、打分、去重、排序调整，必须复用后台单一实现；禁止在 `newtab.js` 添加独立排序权重。
- 隐私默认本地：历史检索与排序不出浏览器；若未来接入云端解析，仅允许上传 query，不得默认上传历史 URL/标题。
- AI 模式新增或调整后，必须做双入口回归：普通网页浮层 + 新标签页浮层，重点覆盖“上周/最近N天/作品集”等自然语言查询。
