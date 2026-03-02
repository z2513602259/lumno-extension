(function() {
  if (window._x_extension_hotkey_listener_2024_unique_) {
    return;
  }
  window._x_extension_hotkey_listener_2024_unique_ = true;

  const REFRESH_SHORTCUT_MS = 15000;
  let shortcutRaw = '';
  let shortcutSpec = null;
  let lastRefreshAt = 0;

  function triggerOverlay() {
    try {
      chrome.runtime.sendMessage({ action: 'triggerShowSearchFromPageHotkey' });
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
    const eventKey = String(event.key || '');
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
      });
    } catch (e) {
      // Ignore runtime bridge failures on restricted frames.
    }
  }

  refreshShortcut(true);
  window.addEventListener('focus', () => refreshShortcut(true), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshShortcut(false);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!event || event.defaultPrevented || event.isComposing || event.repeat) {
      return;
    }
    refreshShortcut(false);
    if (isEditableTarget(event.target)) {
      return;
    }
    if (shortcutSpec && shortcutMatchesEvent(event, shortcutSpec)) {
      event.preventDefault();
      event.stopPropagation();
      triggerOverlay();
    }
  }, true);
})();
