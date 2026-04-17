# Developer Notes

## `!important` 治理计划（2026-04-17）

### 目标
- 逐步收敛仓库内海量 `!important` 的使用，降低样式维护成本。
- 保持浮层、新标签页、设置页的现有视觉和交互不回退。
- 不引入新的加载问题，不影响快捷键与现有注入流程。

### 当前基线
- 当前仓库内约有 `1969` 处 `!important`。
- 主要集中在 `background.js`、`newtab.js`、`input-ui.js`。
- 大量样式通过 `style.cssText` 和 `style.setProperty(..., 'important')` 动态注入。
- 当前注入 UI 未使用 Shadow DOM，浮层与输入框仍直接暴露在宿主页面样式环境中。

### 当前进展
- 第一阶段已开始落地，已完成 `newtab` / `options` 自有页面清理，并继续收敛浮层注入路径中低风险的内部壳层；仍不触碰 `hotkey-listener.js`。
- `newtab.js` 内静态 `!important` 已清零。
- `newtab.html` 内 `!important` 已清零。
- `newtab.js` 内 `style.cssText` 已清零，静态壳层样式已下沉到 `newtab.html` 的稳定类名。
- `options.html` / `options.js` 内 `!important` 已清零。
- `input-ui.js` 内字面量 `!important` 与 `style.cssText` 已清零；当前仅保留少量运行时 `setProperty(..., 'important')`，集中在宿主页面定位保护、特效载体几何同步与持续时间变量这类高风险位点。
- `background.js` 已继续收敛浮层内部静态壳层与建议项状态样式，并把根容器拆成“外层保护壳 + 内层 panel”两层承载：显式 `!important` 当前只剩 `9` 处，全部收敛在外层保护壳的几何定位与层级保护；运行时 `setProperty(..., 'important')` 当前只剩 `24` 处，集中在根容器尺寸同步、进入/回弹动画这类高风险位点。
- 已补齐 `[hidden]` 显隐规则，修复了清理过程中由类样式覆盖浏览器原生 `hidden` 导致的 `newtab` 展示异常。
- 当前仓库显式 `!important` 总量已降到约 `10` 处（其中 `9` 处在 `background.js` 外层保护壳、`1` 处在 vendor 的 `assets/remixicon/fonts/remixicon.css`）；运行时 `setProperty(..., 'important')` 仍约 `230` 处，但高风险区已明显集中到注入路径与动画/几何保护，不再继续盲删。

### 非退让约束
- 不影响已有样式表现。
  - 所有治理必须以“视觉等价”为前提，不能顺手改版、换层级、改间距、改动效。
  - 已有主题变量、hover、选中态、标签态、AI/classic 模式态必须保持一致。
- 不引入加载问题。
  - 不增加新的远程资源依赖。
  - 不在启动路径里增加重脚本、阻塞计算或重复注入。
  - 不为了解决样式问题引入会明显拖慢浮层初始化的新机制。
- 不影响快捷键。
  - 未经明确需求，不修改 `manifest.json` 中 commands、`hotkey-listener.js`、快捷键回退逻辑、快捷键设置读写逻辑。
  - 如改动波及浮层初始化或页面注入时机，必须验证快捷键仍能稳定唤起和关闭浮层。

### 分阶段执行

#### 第一阶段：先清理自有页面
- 优先处理 `newtab.js`、`newtab.html`、`options.html`。
- 将自有页面内的动态 `cssText` 和 `setProperty(..., 'important')` 逐步迁移到：
  - 稳定类名
  - CSS 变量
  - 普通层叠规则
- 第一阶段原则：
  - 不追求一次性删光。
  - 先删“自有页面里并不需要抢优先级”的部分。
  - 只在确认无视觉回退后继续扩大范围。

#### 第二阶段：抽离共享样式模板
- 针对输入框、图标、按钮、标签、提示、建议项等重复样式建立共享样式工厂或基础类。
- 重点消除以下复制型模式：
  - `all: unset !important`
  - `line-height: 1 !important`
  - `font-family: 'Open Sans' ... !important`
  - 大段重复的 `display / align-items / box-sizing / margin / padding` 模板
- 第二阶段原则：
  - 先去重，再减量。
  - 不在多个入口分别复制新的样式逻辑。

#### 第三阶段：改造注入路径
- 处理 `background.js` 与 `input-ui.js` 的注入 UI。
- 优先评估 Shadow DOM 或等价隔离层，减少对宿主页面的样式竞争。
- 若阶段内无法一次性完成隔离，至少要把 `!important` 收敛到以下范围：
  - 根容器重置
  - 几何定位
  - 少数明确存在宿主冲突的样式位点
- 第三阶段原则：
  - 不搞“大扫除式删除”。
  - 没有隔离前，不要贸然拔掉注入 UI 内部的大量 `!important`。

### 文件级执行边界
- `newtab.js` / `newtab.html` / `options.html`
  - 属于低风险优先区。
  - 可以优先迁移到类名和 CSS 变量。
- `background.js` / `input-ui.js`
  - 属于高风险区。
  - 所有减量必须以宿主页面兼容性为前提。
- `hotkey-listener.js`
  - 默认不动。
- `manifest.json`
  - 默认不动 commands、注入入口、资源声明，除非任务明确要求。
- `assets/remixicon/fonts/remixicon.css`
  - 视为 vendor 文件，不纳入本轮治理目标。

### 回归要求
- 每一阶段都必须做双入口回归：
  - 普通网页浮层
  - 新标签页
- 每次改动至少验证以下行为：
  - 输入框展示、聚焦、占位符、光标颜色
  - 建议列表展示、hover、键盘选中、高亮
  - AI/classic 模式切换
  - 站内搜索前缀展示与布局
  - 删除按钮、操作标签、右侧图标、tooltip
  - 深色 / 浅色主题切换
  - 快捷键唤起、关闭、重复触发
- 涉及搜索建议样式或结果容器结构时，继续遵守 `AGENTS.md` 中的双入口一致性要求。

### 执行顺序
1. 从 `newtab.js` / `newtab.html` / `options.html` 开始。
2. 再做共享样式抽离。
3. 最后再动 `background.js` / `input-ui.js` 的隔离改造。

### 禁止事项
- 不要直接全局搜索替换删除 `!important`。
- 不要在没有回归的情况下批量改写 `style.cssText`。
- 不要把注入页问题转嫁为更多同步脚本、更多监听器或更重的初始化逻辑。
- 不要因为样式治理顺手调整快捷键、搜索排序、AI 入口行为。
