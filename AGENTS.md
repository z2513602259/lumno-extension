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
  input-ui.js hotkey-listener.js auto-pip-blacklist.js \
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
