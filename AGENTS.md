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
- `blacklist-utils.js`
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
  blacklist-utils.js \
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

## 样式治理规范（必须）
- 后续写代码时，默认避免新增 `!important`，也不要把 `style.setProperty(..., 'important')` 当作常规实现手段。
- 优先使用稳定类名、CSS 变量、明确的承载层级，以及“外层保护壳 + 内层内容层”的分层方式解决样式优先级问题。
- `newtab.html`、`newtab.js`、`options.html`、`options.js` 这类自有页面，原则上不应再新增 `!important`；若必须新增，需要先证明普通层叠、变量或结构调整无法满足。
- 对注入路径（尤其 `background.js`、`input-ui.js`）保持保守：只有在宿主页面样式污染、几何定位同步、进入/退出动画保护这类明确高风险位点，才允许保留少量 `!important`。
- 任何涉及浮层容器、输入框壳层、tooltip、toast、站内搜索前缀、AI 特效承载层的样式改动，优先检查 `overflow`、`contain`、`transform`、`backdrop-filter` 与挂载层级，不要先用 `!important` 硬压。
- 若确实需要保留或新增 `!important`，必须把范围收敛到最小，并确认不会影响已有样式、加载时机与快捷键行为。

## AI 搜索落地规范（v1）
- AI 搜索模式必须由输入框右侧 `AI` 按钮切换，浮层与新标签页保持一致交互。
- 双入口统一走 `chrome.runtime.sendMessage({ action: 'getSearchSuggestions', query, mode, context })`，其中 `mode` 取值 `classic|ai`。
- AI 模式的自然语言解析（时间范围、主题关键词、模糊词扩展）只放在 `background.js`，前端仅负责展示和状态切换。
- 任何 AI 模式下的召回、打分、去重、排序调整，必须复用后台单一实现；禁止在 `newtab.js` 添加独立排序权重。
- 隐私默认本地：历史检索与排序不出浏览器；若未来接入云端解析，仅允许上传 query，不得默认上传历史 URL/标题。
- AI 模式新增或调整后，必须做双入口回归：普通网页浮层 + 新标签页浮层，重点覆盖“上周/最近N天/作品集”等自然语言查询。
