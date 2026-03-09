(function() {
  if (window._x_extension_hotkey_listener_2024_unique_) {
    return;
  }
  window._x_extension_hotkey_listener_2024_unique_ = true;

  const REFRESH_SHORTCUT_MS = 15000;
  const TAB_VISIBLE_REPORT_MIN_INTERVAL_MS = 800;
  let shortcutRaw = '';
  let shortcutSpec = null;
  let lastRefreshAt = 0;
  let lastVisibleReportAt = 0;

  function logHotkeyListenerDebug(stage, payload) {
    try {
      const detail = payload && typeof payload === 'object' ? payload : {};
      console.log(`[Lumno][hotkey-listener] ${stage}`, detail);
    } catch (e) {
      // Ignore logging errors.
    }
  }

  function triggerOverlay() {
    logHotkeyListenerDebug('trigger-overlay', {
      shortcut: shortcutRaw || '',
      href: location && location.href ? location.href : ''
    });
    try {
      chrome.runtime.sendMessage({ action: 'triggerShowSearchFromPageHotkey' });
    } catch (e) {
      // Ignore runtime bridge failures.
      logHotkeyListenerDebug('trigger-overlay-failed', {
        error: e && e.message ? e.message : String(e || '')
      });
    }
  }

  function reportTabVisible(reason) {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const now = Date.now();
    if ((now - lastVisibleReportAt) < TAB_VISIBLE_REPORT_MIN_INTERVAL_MS) {
      return;
    }
    lastVisibleReportAt = now;
    try {
      chrome.runtime.sendMessage({
        action: 'reportTabVisible',
        at: now,
        reason: String(reason || '')
      });
    } catch (e) {
      // Ignore runtime bridge failures.
    }
  }

  function parseShortcut(shortcut) {
    const value = String(shortcut || '').trim();
    if (!value) {
      return null;
    }
    const parts = value.split('+').map((item) => String(item || '').trim()).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const keyToken = parts[parts.length - 1];
    const modifierTokens = parts.slice(0, -1);
    const spec = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: ''
    };

    modifierTokens.forEach((token) => {
      const lower = token.toLowerCase();
      if (lower === 'ctrl' || lower === 'control' || lower === 'macctrl') {
        spec.ctrl = true;
      } else if (lower === 'alt' || lower === 'option') {
        spec.alt = true;
      } else if (lower === 'shift') {
        spec.shift = true;
      } else if (lower === 'command' || lower === 'cmd' || lower === 'meta' || lower === 'super') {
        spec.meta = true;
      }
    });

    const keyLower = keyToken.toLowerCase();
    const specialMap = {
      tab: 'Tab',
      enter: 'Enter',
      return: 'Enter',
      esc: 'Escape',
      escape: 'Escape',
      space: ' ',
      spacebar: ' ',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      comma: ',',
      period: '.',
      slash: '/',
      semicolon: ';',
      quote: '\'',
      minus: '-',
      plus: '+',
      backslash: '\\',
      backquote: '`',
      bracketleft: '[',
      bracketright: ']'
    };
    if (specialMap[keyLower]) {
      spec.key = specialMap[keyLower];
      return spec;
    }
    if (/^f\d{1,2}$/.test(keyLower)) {
      spec.key = keyLower.toUpperCase();
      return spec;
    }
    if (keyLower.length === 1) {
      spec.key = keyLower;
      return spec;
    }
    spec.key = keyToken;
    return spec;
  }

  function getShortcutKeyTokenFromCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) {
      return '';
    }
    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3).toLowerCase();
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
    const codeMap = {
      Backquote: '`',
      Minus: '-',
      Equal: '+',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Semicolon: ';',
      Quote: '\'',
      Comma: ',',
      Period: '.',
      Slash: '/',
      Space: ' ',
      Tab: 'Tab',
      Enter: 'Enter',
      Escape: 'Escape',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight'
    };
    if (codeMap[code]) {
      return codeMap[code];
    }
    if (/^F\d{1,2}$/.test(code)) {
      return code.toUpperCase();
    }
    return '';
  }

  function getShortcutKeyTokenFromEvent(event) {
    if (!event) {
      return '';
    }
    return getShortcutKeyTokenFromCode(event.code) || String(event.key || '');
  }

  function isEditableTarget(target) {
    const element = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
    if (!element || !element.closest) {
      return false;
    }
    return Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }

  function shortcutMatchesEvent(event, spec) {
    if (!spec) {
      return false;
    }
    if (Boolean(event.ctrlKey) !== spec.ctrl ||
      Boolean(event.altKey) !== spec.alt ||
      Boolean(event.shiftKey) !== spec.shift ||
      Boolean(event.metaKey) !== spec.meta) {
      return false;
    }
    const eventKey = getShortcutKeyTokenFromEvent(event);
    if (spec.key.length === 1) {
      return eventKey.toLowerCase() === spec.key;
    }
    if (spec.key.startsWith('F')) {
      return eventKey.toUpperCase() === spec.key;
    }
    return eventKey === spec.key;
  }

  function refreshShortcut(force) {
    const now = Date.now();
    if (!force && (now - lastRefreshAt) < REFRESH_SHORTCUT_MS) {
      return;
    }
    lastRefreshAt = now;
    try {
      chrome.runtime.sendMessage({ action: 'getShowSearchShortcut' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyListenerDebug('shortcut-refresh-error', {
            error: chrome.runtime.lastError.message || 'unknown'
          });
          return;
        }
        const nextShortcut = response && typeof response.shortcut === 'string'
          ? response.shortcut
          : '';
        if (nextShortcut === shortcutRaw) {
          return;
        }
        shortcutRaw = nextShortcut;
        shortcutSpec = parseShortcut(nextShortcut);
        logHotkeyListenerDebug('shortcut-refresh', {
          shortcut: shortcutRaw,
          hasSpec: Boolean(shortcutSpec)
        });
      });
    } catch (e) {
      // Ignore runtime bridge failures on restricted frames.
      logHotkeyListenerDebug('shortcut-refresh-failed', {
        error: e && e.message ? e.message : String(e || '')
      });
    }
  }

  refreshShortcut(true);
  logHotkeyListenerDebug('listener-ready', {
    href: location && location.href ? location.href : ''
  });
  window.addEventListener('focus', () => refreshShortcut(true), true);
  window.addEventListener('focus', () => reportTabVisible('focus'), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshShortcut(false);
      reportTabVisible('visibility');
    }
  }, true);
  window.addEventListener('pageshow', () => {
    reportTabVisible('pageshow');
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!event || event.defaultPrevented || event.isComposing || event.repeat) {
      return;
    }
    refreshShortcut(false);
    if (isEditableTarget(event.target)) {
      return;
    }
    if (event.metaKey && String(event.key || '').toLowerCase() === 't') {
      logHotkeyListenerDebug('meta-t-seen', {
        defaultPrevented: Boolean(event.defaultPrevented),
        targetTag: event.target && event.target.tagName ? String(event.target.tagName).toLowerCase() : '',
        shortcut: shortcutRaw || '',
        href: location && location.href ? location.href : ''
      });
    }
    if (shortcutSpec && shortcutMatchesEvent(event, shortcutSpec)) {
      logHotkeyListenerDebug('shortcut-matched', {
        key: String(event.key || ''),
        shortcut: shortcutRaw || ''
      });
      event.preventDefault();
      event.stopPropagation();
      triggerOverlay();
    }
  }, true);
})();
