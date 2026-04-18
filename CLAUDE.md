# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumno is a Manifest V3 Chrome/Firefox browser extension that provides a floating command-bar overlay for universal search across history, bookmarks, tabs, and web suggestions. It also replaces the new tab page with a searchable dashboard.

**No build step** — this is a pure JavaScript/HTML/CSS extension. Load directly via `chrome://extensions` in developer mode.

## Commands

### Load for development
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this repository folder

### Package for Chrome Web Store
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
Must exclude: `.git/`, `.github/`, `.vscode/`, `README.md`, `AGENTS.md`, `.DS_Store`.

### Manual test
```bash
# Verify extension loads without errors
# Open DevTools → Extensions → Lumno → Inspect service worker
# Check console for importScripts errors (blacklist-utils.js, pinyin-pro.js)
```

## Architecture

### Entry Points
| File | Role |
|------|------|
| `background.js` | Service worker — core search logic, message routing, tab management, PiP coordination |
| `input-ui.js` | Injected overlay UI — creates the floating search bar on any page |
| `newtab.js/html` | Custom new tab page — full-page search with recent/bookmark cards |
| `options.js/html` | Settings page — theme, shortcuts, site search, blacklist, PiP options |
| `hotkey-listener.js` | Content script at `document_start` — captures global keyboard shortcuts |
| `hotkey-listener.js` | Content script at `document_start` — captures global keyboard shortcuts |

### Overlay Injection Model
The overlay (input + results) is injected via `input-ui.js` into page DOM. Two architectural constraints govern all UI work:

1. **Full block isolation** — the entire overlay block (input, results, tooltip, mode badge, AI decorations) must be in shadow DOM or equivalent isolation. Host-page styles must not leak into overlay internals via selectors like `input`, `button`, `div`, `:hover`, `:focus`.

2. **SVG icon runtime** — injected UI must not rely on host-page font/icon stacks. Icons use `assets/remixicon/lumno-remix-icon-runtime.js` (locally bundled SVG runtime). Sync via `scripts/sync-remix-icon-svg-runtime.js`.

### Search Logic Duality
`background.js` and `newtab.js` both handle search/suggestion logic. Any change to scoring, weighting, or sorting **must** be applied to both, or verified consistent via `chrome.runtime.sendMessage`. See `AGENTS.md` "搜索逻辑一致性规范".

### PiP Architecture
- `site-auto-pip.js` — auto Picture-in-Picture for generic video sites
- `youtube-auto-pip.js` — YouTube-specific PiP handling
- `document-pip-picker.js` — document-mode PiP picker
- `auto-pip-blacklist.js` — restricts PiP on certain domains
- Global PiP ownership tracked via `chrome.storage.session` with token pattern

### Storage Keys
Extension uses `chrome.storage.sync` (primary) with `chrome.storage.local` fallback. Key patterns:
- `_*_2024_unique_` — established keys
- `_*_2026_unique_` — newer keys

## Critical Constraints

### !important Governance
- `newtab.js`, `newtab.html`, `options.html`, `options.js` should have **zero** `!important`
- `background.js` and `input-ui.js` retain minimal `!important` only for: host-page style collision, geometry positioning, animation protection
- Use stable class names, CSS variables, and "outer shell + inner panel" layering instead

### Regression Requirements
Any overlay/UI change requires dual regression:
1. Normal page overlay (triggered by hotkey)
2. New tab page overlay

Test: input display/focus/placeholder/cursor, suggestion list hover/keyboard/highlight, AI/classic mode toggle, dark/light theme, hotkey open/close/retrigger.

### API Boundaries
- `hotkey-listener.js` — default do not modify commands in `manifest.json` or shortcut fallback logic
- `manifest.json` — default do not modify `commands`, injection entries, or resource declarations unless task explicitly requires
- `assets/remixicon/fonts/remixicon.css` — vendor file, excluded from style governance

## Key Files Reference
- `manifest.json` — extension config, permissions, content script declarations
- `assets/data/site-search.json` — built-in site search shortcuts (gh, yt, bb, etc.)
- `assets/data/shortcut-rules.json` — keyboard shortcut configuration
- `_locales/*/messages.json` — i18n strings (en, zh_CN, zh_TW, zh_HK)
