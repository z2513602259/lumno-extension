(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }
  if (document.body) {
    document.body.removeAttribute('data-nt-ready');
  }
  root.style.setProperty('padding', '8px', 'important');
  root.style.setProperty('width', '90vw', 'important');
  root.style.setProperty('max-width', '720px', 'important');
  root.style.setProperty('box-sizing', 'border-box', 'important');

  const storageArea = (chrome && chrome.storage && chrome.storage.sync)
    ? chrome.storage.sync
    : (chrome && chrome.storage ? chrome.storage.local : null);
  const storageAreaName = storageArea
    ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null;

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
  const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  const RI_SPRITE_URL = (chrome && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('remixicon.symbol.svg')
    : 'remixicon.symbol.svg';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let currentThemeMode = 'system';
  let modeBadge = null;
  const recentCards = [];
  const bookmarkCards = [];
  const bookmarkCardElementCache = new Map();
  let currentMessages = null;
  let currentLanguageMode = 'system';
  let defaultPlaceholderText = '搜索或输入网址...';
  let currentRecentMode = 'latest';
  let currentRecentCount = 4;
  let searchLayer = null;
  const BOOKMARK_LIMIT = 16;
  let bookmarkCurrentPage = 0;
  let bookmarkAllItems = [];
  let bookmarkCurrentFolderId = '1';
  let bookmarkRootFolderId = '1';
  let bookmarkFolderPath = [];
  let bookmarkRootTotalCount = 0;
  let bookmarkRootVisibleCount = 0;
  const bookmarkNodeMap = new Map();
  let bookmarkTitleWrap = null;
  let bookmarkBreadcrumb = null;
  let bookmarkPagerPrevButton = null;
  let bookmarkPagerNextButton = null;
  let bookmarkPageAnimating = false;
  const BOOKMARK_GAP_ABOVE_RECENT_PX = 100;
  const BOOKMARK_FALLBACK_BOTTOM_PX = 340;

  // 使用系统字体，避免外链字体依赖。
  let defaultSearchEngineState = {
    id: '',
    name: '',
    host: '',
    updatedAt: 0
  };

  const SEARCH_ENGINE_DEFS = [
    {
      id: 'google',
      name: 'Google',
      hostMatches: ['google.'],
      searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'bing',
      name: 'Bing',
      hostMatches: ['bing.com'],
      searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'baidu',
      name: '百度',
      hostMatches: ['baidu.com'],
      searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      hostMatches: ['duckduckgo.com'],
      searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    },
    {
      id: 'yahoo',
      name: 'Yahoo',
      hostMatches: ['search.yahoo.com'],
      searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
    },
    {
      id: 'yandex',
      name: 'Yandex',
      hostMatches: ['yandex.com'],
      searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
    },
    {
      id: 'sogou',
      name: '搜狗',
      hostMatches: ['sogou.com'],
      searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
    },
    {
      id: 'so',
      name: '360搜索',
      hostMatches: ['so.com'],
      searchUrl: (query) => `https://www.so.com/s?q=${encodeURIComponent(query)}`
    },
    {
      id: 'shenma',
      name: '神马',
      hostMatches: ['sm.cn'],
      searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
    }
  ];

  function resolveTheme(mode) {
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    return mediaQuery.matches ? 'dark' : 'light';
  }

  function normalizeLocale(locale) {
    const raw = String(locale || '').trim();
    if (!raw) {
      return 'en';
    }
    const lower = raw.toLowerCase();
    if (lower.startsWith('zh')) {
      if (lower.includes('hk')) {
        return 'zh_HK';
      }
      if (lower.includes('tw') || lower.includes('mo') || lower.includes('hant')) {
        return 'zh_TW';
      }
      return 'zh_CN';
    }
    return 'en';
  }

  function migrateStorageIfNeeded(keys) {
    if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
      return;
    }
    if (storageArea === chrome.storage.local) {
      return;
    }
    chrome.storage.local.get(keys, (localResult) => {
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      storageArea.get(keys, (syncResult) => {
        const hasSync = keys.some((key) => typeof syncResult[key] !== 'undefined');
        if (hasSync) {
          return;
        }
        storageArea.set(localResult);
      });
    });
  }


  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function renderHighlightedText(target, text, query, styles) {
    const safeText = String(text || '');
    const needle = String(query || '').trim();
    if (!needle) {
      target.textContent = safeText;
      return;
    }
    const parts = safeText.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'));
    if (parts.length === 1) {
      target.textContent = safeText;
      return;
    }
    parts.forEach((part) => {
      if (!part) {
        return;
      }
      if (part.toLowerCase() === needle.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.style.background = styles && styles.background
          ? styles.background
          : 'var(--x-ext-mark-bg, #CFE8FF)';
        mark.style.color = styles && styles.color
          ? styles.color
          : 'var(--x-ext-mark-text, #1E3A8A)';
        mark.style.padding = '2px 4px';
        mark.style.borderRadius = '3px';
        mark.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
        mark.textContent = part;
        target.appendChild(mark);
      } else {
        target.appendChild(document.createTextNode(part));
      }
    });
  }

  function loadLocaleMessages(locale) {
    const normalized = normalizeLocale(locale);
    const localePath = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
    return fetch(localePath)
      .then((response) => response.json())
      .catch(() => ({}));
  }

  function t(key, fallback) {
    if (currentMessages && currentMessages[key] && currentMessages[key].message) {
      return currentMessages[key].message;
    }
    if (chrome && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  }

  function markNewtabReady() {
    if (!document.body) {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.setAttribute('data-nt-ready', '1');
      });
    });
  }

  function formatMessage(key, fallback, params) {
    let text = t(key, fallback);
    if (!params) {
      return text;
    }
    Object.keys(params).forEach((token) => {
      const value = params[token];
      text = text.replace(new RegExp(`\\{${token}\\}`, 'g'), value);
    });
    return text;
  }

  function getRiSvg(id, sizeClass, extraClass) {
    const size = sizeClass || 'ri-size-16';
    const extra = extraClass ? ` ${extraClass}` : '';
    return `<svg class="ri-icon ${size}${extra}" aria-hidden="true" focusable="false"><use href="${RI_SPRITE_URL}#${id}"></use></svg>`;
  }

  function getFigmaFolderSvg(idSuffix) {
    const suffix = String(idSuffix || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseLowerFilterId = `x-nt-folder-filter-lower-base-${suffix}`;
    const baseUpperFilterId = `x-nt-folder-filter-upper-base-${suffix}`;
    const hoverLowerFilterId = `x-nt-folder-filter-lower-hover-${suffix}`;
    const hoverUpperFilterId = `x-nt-folder-filter-upper-hover-${suffix}`;
    const baseLowerGradientId = `x-nt-folder-gradient-lower-base-${suffix}`;
    const baseUpperGradientId = `x-nt-folder-gradient-upper-base-${suffix}`;
    const hoverLowerGradientId = `x-nt-folder-gradient-lower-hover-${suffix}`;
    const hoverUpperGradientId = `x-nt-folder-gradient-upper-hover-${suffix}`;
    const hoverUpperOverlayGradientId = `x-nt-folder-gradient-upper-overlay-hover-${suffix}`;
    const morphUpperGradientId = `x-nt-folder-gradient-upper-morph-${suffix}`;
    const morphUpperOverlayGradientId = `x-nt-folder-gradient-upper-overlay-morph-${suffix}`;
    return `
      <svg viewBox="0 0 31 29" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <g data-folder-layer="lower">
          <g class="x-nt-folder-shape x-nt-folder-shape--base" filter="url(#${baseLowerFilterId})">
            <path data-folder-part="lower-body" data-folder-fill-base="url(#${baseLowerGradientId})" data-folder-fill-hover="url(#${hoverLowerGradientId})" d="M7.24 2C6.08213 2 5.5032 2 5.06414 2.23247C4.70983 2.42007 4.42007 2.70983 4.23247 3.06414C4 3.5032 4 4.08213 4 5.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H16.2872C15.7668 5 15.5067 5 15.2631 4.93779C15.0647 4.88712 14.8753 4.80628 14.7014 4.69811C14.488 4.56531 14.308 4.37746 13.948 4.00178L12.9862 2.99822C12.6262 2.62254 12.4462 2.43469 12.2327 2.30189C12.0589 2.19372 11.8694 2.11288 11.6711 2.06221C11.4275 2 11.1673 2 10.647 2H7.24Z" fill="url(#${baseLowerGradientId})"/>
            <path data-folder-part="lower-outline" d="M7.24023 2.5H10.6465C11.1918 2.5 11.3785 2.50393 11.5469 2.54688C11.6957 2.58488 11.8384 2.64543 11.9688 2.72656C12.1163 2.8184 12.2478 2.95016 12.625 3.34375L13.5869 4.34766C13.9294 4.70501 14.1583 4.94931 14.4375 5.12305C14.6547 5.25816 14.8918 5.35857 15.1396 5.42188C15.4582 5.50321 15.7923 5.5 16.2871 5.5H23.7598C24.3471 5.5 24.7568 5.50049 25.0752 5.52734C25.3875 5.5537 25.5669 5.60319 25.7021 5.6748C25.9676 5.81544 26.1846 6.03242 26.3252 6.29785C26.3968 6.4331 26.4463 6.61249 26.4727 6.9248C26.4995 7.24322 26.5 7.65291 26.5 8.24023V19.7598C26.5 20.3471 26.4995 20.7568 26.4727 21.0752C26.4463 21.3875 26.3968 21.5669 26.3252 21.7021C26.1846 21.9676 25.9676 22.1846 25.7021 22.3252C25.5669 22.3968 25.3875 22.4463 25.0752 22.4727C24.7568 22.4995 24.3471 22.5 23.7598 22.5H7.24023C6.65291 22.5 6.24322 22.4995 5.9248 22.4727C5.61249 22.4463 5.4331 22.3968 5.29785 22.3252C5.03242 22.1846 4.81544 21.9676 4.6748 21.7021C4.60319 21.5669 4.5537 21.3875 4.52734 21.0752C4.50049 20.7568 4.5 20.3471 4.5 19.7598V5.24023C4.5 4.65291 4.50049 4.24322 4.52734 3.9248C4.5537 3.61249 4.60319 3.4331 4.6748 3.29785C4.81544 3.03242 5.03242 2.81544 5.29785 2.6748C5.4331 2.60319 5.61249 2.5537 5.9248 2.52734C6.24322 2.50049 6.65291 2.5 7.24023 2.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover" filter="url(#${hoverLowerFilterId})">
            <path data-folder-part-hover="lower-body" d="M7.27966 3C6.06845 3 5.46284 3 5.01299 3.24717C4.65028 3.44648 4.35832 3.75339 4.17738 4.12561C3.95298 4.58724 3.98322 5.19209 4.04371 6.4018L4.71971 19.9218C4.77497 21.027 4.8026 21.5797 5.04189 21.9962C5.23514 22.3326 5.52208 22.6056 5.86774 22.7818C6.29572 23 6.84904 23 7.95566 23H24.4374C25.6583 23 26.2687 23 26.7204 22.7502C27.0846 22.5488 27.3769 22.2388 27.5565 21.8635C27.7794 21.3979 27.7435 20.7885 27.6718 19.5697L27.053 9.04974C26.9885 7.95383 26.9563 7.40587 26.716 6.99327C26.5218 6.65999 26.2354 6.38996 25.8913 6.21572C25.4653 6 24.9164 6 23.8186 6H16.1608C15.6405 6 15.3803 6 15.1367 5.93779C14.9383 5.88712 14.7489 5.80628 14.5751 5.69811C14.3616 5.56531 14.1816 5.37746 13.8216 5.00178L12.8598 3.99822C12.4998 3.62254 12.3198 3.43469 12.1063 3.30189C11.9325 3.19372 11.7431 3.11288 11.5447 3.06221C11.3011 3 11.0409 3 10.5206 3H7.27966Z" fill="url(#${hoverLowerGradientId})"/>
            <path data-folder-part-hover="lower-outline" d="M7.27987 3.5H10.5201C11.0655 3.5 11.2521 3.50393 11.4205 3.54688C11.5693 3.58488 11.712 3.64543 11.8424 3.72656C11.9899 3.8184 12.1214 3.95016 12.4986 4.34375L13.4605 5.34766C13.803 5.70501 14.0319 5.94931 14.3111 6.12305C14.5283 6.25816 14.7654 6.35857 15.0133 6.42188C15.3318 6.50321 15.6659 6.5 16.1607 6.5H23.8189C24.3759 6.5 24.7636 6.50051 25.066 6.52539C25.362 6.54976 25.5338 6.59535 25.6656 6.66211C25.9236 6.7928 26.1382 6.99524 26.2838 7.24512C26.3581 7.37281 26.4139 7.54183 26.4556 7.83594C26.4982 8.13633 26.5216 8.5232 26.5543 9.0791L27.1724 19.5986C27.2088 20.2168 27.2344 20.6491 27.2252 20.9854C27.2161 21.3158 27.1734 21.5048 27.1051 21.6475C26.9703 21.929 26.7512 22.1615 26.4781 22.3125C26.3398 22.389 26.1537 22.4423 25.8248 22.4707C25.4896 22.4996 25.0563 22.5 24.4371 22.5H7.95565C7.3943 22.5 7.00355 22.4998 6.69881 22.4746C6.40048 22.45 6.22764 22.4034 6.09529 22.3359C5.83605 22.2038 5.62012 21.9994 5.47518 21.7471C5.40123 21.6183 5.34672 21.4481 5.30721 21.1514C5.26684 20.8482 5.24736 20.4574 5.21932 19.8965L4.54354 6.37695C4.51286 5.76336 4.49152 5.33461 4.5035 5.00098C4.51527 4.67332 4.5587 4.48532 4.62752 4.34375C4.7632 4.06493 4.98177 3.83493 5.2535 3.68555C5.39147 3.60973 5.57715 3.55741 5.90389 3.5293C6.23648 3.50069 6.66562 3.5 7.27987 3.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
        </g>
        <g data-folder-layer="file">
          <g class="x-nt-folder-shape x-nt-folder-shape--base">
            <path data-folder-part="file-body" d="M7 10C7 9.44772 7.44772 9 8 9H23C23.5523 9 24 9.44772 24 10V17C24 17.5523 23.5523 18 23 18H8C7.44772 18 7 17.5523 7 17V10Z" fill="var(--fill-0, white)"/>
            <path data-folder-part="file-line" d="M13 11L18 11" stroke="var(--stroke-0, #DDE8FB)" stroke-linecap="round"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover">
            <path data-folder-part-hover="file-body" d="M7.87362 10C7.87362 9.44772 8.32133 9 8.87362 9H23.8736C24.4259 9 24.8736 9.44772 24.8736 10V17C24.8736 17.5523 24.4259 18 23.8736 18H8.87362C8.32133 18 7.87362 17.5523 7.87362 17V10Z" fill="var(--fill-0, white)"/>
            <path data-folder-part-hover="file-line" d="M13.8736 11L18.8736 11" stroke="var(--stroke-0, #DDE8FB)" stroke-linecap="round"/>
          </g>
        </g>
        <g data-folder-layer="upper">
          <g class="x-nt-folder-shape x-nt-folder-shape--base">
            <g filter="url(#${baseUpperFilterId})">
              <path data-folder-part="upper-body" data-folder-fill-base="url(#${morphUpperGradientId})" data-folder-fill-hover="url(#${morphUpperGradientId})" d="M7.24 5C6.08213 5 5.5032 5 5.06414 5.23247C4.70983 5.42007 4.42007 5.70983 4.23247 6.06414C4 6.5032 4 7.08213 4 8.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H14.9046H7.24Z" fill="url(#${morphUpperGradientId})"/>
              <path data-folder-part="upper-overlay" data-folder-fill-base="url(#${morphUpperOverlayGradientId})" data-folder-fill-hover="url(#${morphUpperOverlayGradientId})" data-folder-opacity-base="0" data-folder-opacity-hover="1" d="M7.24 5C6.08213 5 5.5032 5 5.06414 5.23247C4.70983 5.42007 4.42007 5.70983 4.23247 6.06414C4 6.5032 4 7.08213 4 8.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H14.9046H7.24Z" fill="url(#${morphUpperOverlayGradientId})" opacity="0"/>
            </g>
            <path data-folder-part="upper-outline" d="M7.24023 5.5H23.7598C24.3471 5.5 24.7568 5.50049 25.0752 5.52734C25.3875 5.5537 25.5669 5.60319 25.7021 5.6748C25.9676 5.81544 26.1846 6.03242 26.3252 6.29785C26.3968 6.4331 26.4463 6.61249 26.4727 6.9248C26.4995 7.24322 26.5 7.65291 26.5 8.24023V19.7598C26.5 20.3471 26.4995 20.7568 26.4727 21.0752C26.4463 21.3875 26.3968 21.5669 26.3252 21.7021C26.1846 21.9676 25.9676 22.1846 25.7021 22.3252C25.5669 22.3968 25.3875 22.4463 25.0752 22.4727C24.7568 22.4995 24.3471 22.5 23.7598 22.5H7.24023C6.65291 22.5 6.24322 22.4995 5.9248 22.4727C5.61249 22.4463 5.4331 22.3968 5.29785 22.3252C5.03242 22.1846 4.81544 21.9676 4.6748 21.7021C4.60319 21.5669 4.5537 21.3875 4.52734 21.0752C4.50049 20.7568 4.5 20.3471 4.5 19.7598V8.24023C4.5 7.65291 4.50049 7.24322 4.52734 6.9248C4.5537 6.61249 4.60319 6.4331 4.6748 6.29785C4.81544 6.03242 5.03242 5.81544 5.29785 5.6748C5.4331 5.60319 5.61249 5.5537 5.9248 5.52734C6.24322 5.50049 6.65291 5.5 7.24023 5.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover">
            <g filter="url(#${hoverUpperFilterId})">
              <path data-folder-part-hover="upper-body" d="M9.52978 13C8.56387 13 8.08092 13 7.68721 13.1785C7.36853 13.3231 7.09334 13.5487 6.88913 13.8328C6.63684 14.1839 6.54213 14.6574 6.3527 15.6046L5.6487 19.1246C5.37742 20.481 5.24179 21.1591 5.43499 21.6872C5.59036 22.1119 5.88507 22.4713 6.27102 22.707C6.75093 23 7.44255 23 8.82578 23H25.2175C26.1834 23 26.6663 23 27.06 22.8215C27.3787 22.6769 27.6539 22.4513 27.8581 22.1672C28.1104 21.8161 28.2051 21.3426 28.3945 20.3954L29.0985 16.8754C29.3698 15.519 29.5054 14.8409 29.3122 14.3128C29.1569 13.8881 28.8622 13.5287 28.4762 13.293C27.9963 13 27.3047 13 25.9215 13H17.7782H9.52978Z" fill="url(#${hoverUpperGradientId})"/>
              <path data-folder-part-hover="upper-overlay" d="M9.52978 13C8.56387 13 8.08092 13 7.68721 13.1785C7.36853 13.3231 7.09334 13.5487 6.88913 13.8328C6.63684 14.1839 6.54213 14.6574 6.3527 15.6046L5.6487 19.1246C5.37742 20.481 5.24179 21.1591 5.43499 21.6872C5.59036 22.1119 5.88507 22.4713 6.27102 22.707C6.75093 23 7.44255 23 8.82578 23H25.2175C26.1834 23 26.6663 23 27.06 22.8215C27.3787 22.6769 27.6539 22.4513 27.8581 22.1672C28.1104 21.8161 28.2051 21.3426 28.3945 20.3954L29.0985 16.8754C29.3698 15.519 29.5054 14.8409 29.3122 14.3128C29.1569 13.8881 28.8622 13.5287 28.4762 13.293C27.9963 13 27.3047 13 25.9215 13H17.7782H9.52978Z" fill="url(#${hoverUpperOverlayGradientId})"/>
            </g>
            <path data-folder-part-hover="upper-outline" d="M9.52987 13.5H25.9215C26.6224 13.5 27.1147 13.5001 27.4928 13.5342C27.866 13.5679 28.0704 13.6312 28.2154 13.7197C28.5048 13.8964 28.7258 14.166 28.8424 14.4844C28.9007 14.6439 28.9225 14.8569 28.8824 15.2295C28.8417 15.6069 28.7455 16.09 28.608 16.7773L27.9039 20.2969C27.8077 20.7777 27.741 21.1113 27.6685 21.3691C27.5978 21.6206 27.5306 21.7653 27.4517 21.875C27.2986 22.0881 27.0921 22.2578 26.8531 22.3662C26.7301 22.4219 26.5753 22.4595 26.315 22.4795C26.0479 22.5 25.7079 22.5 25.2174 22.5H8.82576C8.12483 22.5 7.63254 22.4999 7.25447 22.4658C6.88123 22.4321 6.67684 22.3688 6.53182 22.2803C6.24245 22.1036 6.02143 21.834 5.90487 21.5156C5.84649 21.3561 5.8247 21.1431 5.86483 20.7705C5.90551 20.3931 6.00177 19.91 6.13924 19.2227L6.84334 15.7031C6.93951 15.2223 7.00623 14.8887 7.07869 14.6309C7.14939 14.3794 7.21668 14.2347 7.29549 14.125C7.44865 13.9119 7.65511 13.7422 7.89412 13.6338C8.0171 13.5781 8.17191 13.5405 8.43221 13.5205C8.69934 13.5 9.03932 13.5 9.52987 13.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
        </g>
        <defs>
          <filter id="${baseLowerFilterId}" x="0" y="0" width="31" height="29" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="2"/>
            <feGaussianBlur stdDeviation="2"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.541176 0 0 0 0 0.713726 0 0 0 0 1 0 0 0 0.21 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <filter id="${hoverLowerFilterId}" x="0" y="1" width="31.7267" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="2"/>
            <feGaussianBlur stdDeviation="2"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.541176 0 0 0 0 0.713726 0 0 0 0 1 0 0 0 0.21 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <filter id="${baseUpperFilterId}" x="3.5" y="5" width="26" height="18.8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="0.8"/>
            <feGaussianBlur stdDeviation="0.7"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.72 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
          <filter id="${hoverUpperFilterId}" x="5.34419" y="13" width="24.0589" height="10.8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="0.8"/>
            <feGaussianBlur stdDeviation="0.7"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.72 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
          <linearGradient id="${baseLowerGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${baseUpperGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#CCDFFF"/>
            <stop offset="0.884515" stop-color="#B2CEFF"/>
            <stop offset="0.884615" stop-color="#89B5FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverLowerGradientId}" x1="16.3736" y1="2" x2="16.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverUpperGradientId}" x1="16.3736" y1="2" x2="16.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverUpperOverlayGradientId}" x1="17.3736" y1="11.3333" x2="17.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#CCDFFF"/>
            <stop offset="0.884515" stop-color="#B2CEFF"/>
            <stop offset="0.884615" stop-color="#89B5FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${morphUpperGradientId}" data-folder-gradient-morph="upper-main" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#CCDFFF"></stop>
            <stop offset="0.884515" stop-color="#B2CEFF"></stop>
            <stop offset="0.884615" stop-color="#89B5FF"></stop>
            <stop offset="1" stop-color="#97BEFF"></stop>
          </linearGradient>
          <linearGradient id="${morphUpperOverlayGradientId}" data-folder-gradient-morph="upper-overlay" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#CCDFFF"></stop>
            <stop offset="0.884515" stop-color="#B2CEFF"></stop>
            <stop offset="0.884615" stop-color="#89B5FF"></stop>
            <stop offset="1" stop-color="#97BEFF"></stop>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  const FOLDER_PATH_MORPH_DURATION_MS = 460;
  const FOLDER_PATH_MORPH_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT = 140;
  const FOLDER_PATH_MORPH_BEZIER = {
    x1: 0.22,
    y1: 1,
    x2: 0.36,
    y2: 1
  };

  function cubicBezierSampleCurveX(t, x1, x2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * x1 + 3 * inv * t * t * x2 + t * t * t;
  }

  function cubicBezierSampleCurveY(t, y1, y2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
  }

  function cubicBezierSampleCurveDerivativeX(t, x1, x2) {
    const inv = 1 - t;
    return 3 * inv * inv * x1 + 6 * inv * t * (x2 - x1) + 3 * t * t * (1 - x2);
  }

  function cubicBezierEase(progress, bezier) {
    const clamped = Math.max(0, Math.min(1, progress));
    if (clamped === 0 || clamped === 1) {
      return clamped;
    }
    let t = clamped;
    for (let i = 0; i < 8; i += 1) {
      const x = cubicBezierSampleCurveX(t, bezier.x1, bezier.x2) - clamped;
      const dx = cubicBezierSampleCurveDerivativeX(t, bezier.x1, bezier.x2);
      if (Math.abs(x) < 1e-6 || Math.abs(dx) < 1e-6) {
        break;
      }
      t -= x / dx;
    }
    t = Math.max(0, Math.min(1, t));
    return cubicBezierSampleCurveY(t, bezier.y1, bezier.y2);
  }

  function buildPathMorphTemplate(fromD, toD) {
    const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
    const fromNumbers = (String(fromD || '').match(numberPattern) || []).map((value) => Number(value));
    const toNumbers = (String(toD || '').match(numberPattern) || []).map((value) => Number(value));
    if (!fromNumbers.length || fromNumbers.length !== toNumbers.length) {
      return null;
    }
    const fromMask = String(fromD).replace(numberPattern, '#');
    const toMask = String(toD).replace(numberPattern, '#');
    if (fromMask !== toMask) {
      return null;
    }
    const segments = String(fromD).split(numberPattern);
    return { type: 'number', segments, fromNumbers, toNumbers };
  }

  function composeNumberPathD(segments, numbers) {
    let output = '';
    for (let i = 0; i < numbers.length; i += 1) {
      output += `${segments[i]}${Number(numbers[i].toFixed(6))}`;
    }
    output += segments[numbers.length] || '';
    return output;
  }

  function isClosedPathData(d) {
    return /[zZ]\s*$/.test(String(d || '').trim());
  }

  function samplePathPoints(svgEl, d, sampleCount) {
    if (!svgEl || !d) {
      return null;
    }
    const count = Math.max(8, sampleCount | 0);
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', d);
    tempPath.setAttribute('fill', 'none');
    tempPath.setAttribute('stroke', 'none');
    tempPath.style.opacity = '0';
    tempPath.style.pointerEvents = 'none';
    svgEl.appendChild(tempPath);
    try {
      const total = tempPath.getTotalLength();
      if (!Number.isFinite(total) || total <= 0) {
        return null;
      }
      const closed = isClosedPathData(d);
      const points = [];
      const divisor = closed ? count : Math.max(1, count - 1);
      for (let i = 0; i < count; i += 1) {
        const ratio = i / divisor;
        const len = Math.max(0, Math.min(total, total * ratio));
        const point = tempPath.getPointAtLength(len);
        points.push({ x: point.x, y: point.y });
      }
      return { points, closed };
    } catch (error) {
      return null;
    } finally {
      svgEl.removeChild(tempPath);
    }
  }

  function buildPointMorphTemplate(pathEl, fromD, toD) {
    if (!pathEl) {
      return null;
    }
    const svgEl = pathEl.closest('svg');
    if (!svgEl) {
      return null;
    }
    const sampleCount = FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT;
    const fromData = samplePathPoints(svgEl, fromD, sampleCount);
    const toData = samplePathPoints(svgEl, toD, sampleCount);
    if (!fromData || !toData || fromData.points.length !== toData.points.length) {
      return null;
    }
    const closed = fromData.closed && toData.closed;
    let fromPoints = fromData.points;
    let toPoints = toData.points;
    if (closed && fromPoints.length > 4) {
      const alignClosedPoints = (sourcePoints, targetPoints) => {
        const rotatePoints = (points, shift) => {
          const len = points.length;
          const normalizedShift = ((shift % len) + len) % len;
          if (!normalizedShift) {
            return points.slice();
          }
          return points.slice(normalizedShift).concat(points.slice(0, normalizedShift));
        };
        const reversePoints = (points) => points.slice().reverse();
        const calcScore = (aPoints, bPoints) => {
          let total = 0;
          for (let i = 0; i < aPoints.length; i += 1) {
            const dx = aPoints[i].x - bPoints[i].x;
            const dy = aPoints[i].y - bPoints[i].y;
            total += dx * dx + dy * dy;
          }
          return total;
        };
        let best = targetPoints.slice();
        let bestScore = Number.POSITIVE_INFINITY;
        const directions = [targetPoints, reversePoints(targetPoints)];
        for (let dirIndex = 0; dirIndex < directions.length; dirIndex += 1) {
          const dirPoints = directions[dirIndex];
          for (let shift = 0; shift < dirPoints.length; shift += 1) {
            const candidate = rotatePoints(dirPoints, shift);
            const score = calcScore(sourcePoints, candidate);
            if (score < bestScore) {
              bestScore = score;
              best = candidate;
            }
          }
        }
        return best;
      };
      toPoints = alignClosedPoints(fromPoints, toPoints);
    }
    return {
      type: 'point',
      fromPoints,
      toPoints,
      closed
    };
  }

  function composePointPathD(points, closed) {
    if (!Array.isArray(points) || !points.length) {
      return '';
    }
    let d = `M ${Number(points[0].x.toFixed(6))} ${Number(points[0].y.toFixed(6))}`;
    for (let i = 1; i < points.length; i += 1) {
      d += ` L ${Number(points[i].x.toFixed(6))} ${Number(points[i].y.toFixed(6))}`;
    }
    if (closed) {
      d += ' Z';
    }
    return d;
  }

  function cancelFolderPathMorph(part) {
    if (!part) {
      return;
    }
    if (part.animationFrameId) {
      cancelAnimationFrame(part.animationFrameId);
      part.animationFrameId = 0;
    }
  }

  function hexToRgb(hex) {
    const raw = String(hex || '').trim();
    const normalized = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return null;
    }
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    const toHex = (value) => {
      const v = Math.max(0, Math.min(255, Math.round(value)));
      return v.toString(16).padStart(2, '0');
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function lerpNumber(fromValue, toValue, t) {
    return fromValue + (toValue - fromValue) * t;
  }

  function applyGradientMorphConfig(gradientEl, config) {
    if (!gradientEl || !config) {
      return;
    }
    gradientEl.setAttribute('x1', String(config.x1));
    gradientEl.setAttribute('y1', String(config.y1));
    gradientEl.setAttribute('x2', String(config.x2));
    gradientEl.setAttribute('y2', String(config.y2));
    const stops = gradientEl.querySelectorAll('stop');
    config.stops.forEach((stopConfig, index) => {
      const stopEl = stops[index];
      if (!stopEl) {
        return;
      }
      stopEl.setAttribute('offset', String(stopConfig.offset));
      stopEl.setAttribute('stop-color', stopConfig.color);
    });
  }

  function interpolateGradientConfig(fromConfig, toConfig, t) {
    const progress = Math.max(0, Math.min(1, t));
    const next = {
      x1: Number(lerpNumber(fromConfig.x1, toConfig.x1, progress).toFixed(6)),
      y1: Number(lerpNumber(fromConfig.y1, toConfig.y1, progress).toFixed(6)),
      x2: Number(lerpNumber(fromConfig.x2, toConfig.x2, progress).toFixed(6)),
      y2: Number(lerpNumber(fromConfig.y2, toConfig.y2, progress).toFixed(6)),
      stops: []
    };
    for (let i = 0; i < fromConfig.stops.length; i += 1) {
      const fromStop = fromConfig.stops[i];
      const toStop = toConfig.stops[i];
      if (!fromStop || !toStop) {
        continue;
      }
      const fromRgb = hexToRgb(fromStop.color);
      const toRgb = hexToRgb(toStop.color);
      const color = (fromRgb && toRgb)
        ? rgbToHex({
          r: lerpNumber(fromRgb.r, toRgb.r, progress),
          g: lerpNumber(fromRgb.g, toRgb.g, progress),
          b: lerpNumber(fromRgb.b, toRgb.b, progress)
        })
        : (progress < 0.5 ? fromStop.color : toStop.color);
      next.stops.push({
        offset: Number(lerpNumber(fromStop.offset, toStop.offset, progress).toFixed(6)),
        color
      });
    }
    return next;
  }

  function initFolderUpperGradientMorph(folderIcon) {
    if (!folderIcon || folderIcon._xUpperGradientMorph) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      return;
    }
    const mainGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-main"]');
    const overlayGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-overlay"]');
    if (!mainGradientEl || !overlayGradientEl) {
      return;
    }
    const baseMain = {
      x1: 15.5, y1: 2, x2: 15.5, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.884515, color: '#B2CEFF' },
        { offset: 0.884615, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const hoverMain = {
      x1: 16.3736, y1: 2, x2: 16.3736, y2: 23,
      stops: [
        { offset: 0, color: '#93BBFF' },
        { offset: 0.884515, color: '#81B0FF' },
        { offset: 0.884615, color: '#4389FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const baseOverlay = {
      x1: 15.5, y1: 2, x2: 15.5, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.884515, color: '#B2CEFF' },
        { offset: 0.884615, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const hoverOverlay = {
      x1: 17.3736, y1: 11.3333, x2: 17.3736, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.827284, color: '#B2CEFF' },
        { offset: 0.85339, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    folderIcon._xUpperGradientMorph = {
      mainGradientEl,
      overlayGradientEl,
      baseMain,
      hoverMain,
      baseOverlay,
      hoverOverlay,
      state: 'base',
      rafId: 0
    };
    applyGradientMorphConfig(mainGradientEl, baseMain);
    applyGradientMorphConfig(overlayGradientEl, baseOverlay);
  }

  function playFolderUpperGradientMorph(folderIcon, toHover) {
    if (!folderIcon) {
      return;
    }
    if (!folderIcon._xUpperGradientMorph) {
      initFolderUpperGradientMorph(folderIcon);
    }
    const morphState = folderIcon._xUpperGradientMorph;
    if (!morphState) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (morphState.state === targetState) {
      return;
    }
    morphState.state = targetState;
    if (morphState.rafId) {
      cancelAnimationFrame(morphState.rafId);
      morphState.rafId = 0;
    }
    const fromMain = toHover ? morphState.baseMain : morphState.hoverMain;
    const toMain = toHover ? morphState.hoverMain : morphState.baseMain;
    const fromOverlay = toHover ? morphState.baseOverlay : morphState.hoverOverlay;
    const toOverlay = toHover ? morphState.hoverOverlay : morphState.baseOverlay;
    const startTime = performance.now();
    const tick = (now) => {
      const rawProgress = Math.max(0, Math.min(1, (now - startTime) / FOLDER_PATH_MORPH_DURATION_MS));
      const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
      applyGradientMorphConfig(morphState.mainGradientEl, interpolateGradientConfig(fromMain, toMain, eased));
      applyGradientMorphConfig(morphState.overlayGradientEl, interpolateGradientConfig(fromOverlay, toOverlay, eased));
      if (rawProgress < 1) {
        morphState.rafId = requestAnimationFrame(tick);
        return;
      }
      morphState.rafId = 0;
      applyGradientMorphConfig(morphState.mainGradientEl, toMain);
      applyGradientMorphConfig(morphState.overlayGradientEl, toOverlay);
    };
    morphState.rafId = requestAnimationFrame(tick);
  }

  function setFolderUpperFilterSuspended(folderIcon, suspended) {
    if (!folderIcon) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      return;
    }
    const upperFilterGroup = svg.querySelector('g[data-folder-layer="upper"] .x-nt-folder-shape--base > g[filter]');
    if (!upperFilterGroup) {
      return;
    }
    if (suspended) {
      if (typeof upperFilterGroup._xOriginalFilterAttr === 'undefined') {
        upperFilterGroup._xOriginalFilterAttr = upperFilterGroup.getAttribute('filter');
      }
      upperFilterGroup.setAttribute('filter', 'none');
      return;
    }
    const original = upperFilterGroup._xOriginalFilterAttr;
    if (typeof original === 'string' && original) {
      upperFilterGroup.setAttribute('filter', original);
    } else {
      upperFilterGroup.removeAttribute('filter');
    }
  }

  function animatePathDWithCurve(part, fromD, toD) {
    let template = buildPathMorphTemplate(fromD, toD);
    if (!template) {
      template = buildPointMorphTemplate(part.pathEl, fromD, toD);
    }
    if (!template) {
      part.pathEl.setAttribute('d', toD);
      return false;
    }
    cancelFolderPathMorph(part);
    const startTime = performance.now();
    const syncFollowers = (dValue) => {
      if (!part || !Array.isArray(part.linkedFollowers) || !part.linkedFollowers.length) {
        return;
      }
      part.linkedFollowers.forEach((el) => {
        if (el && typeof el.setAttribute === 'function') {
          el.setAttribute('d', dValue);
        }
      });
    };
    const tick = (now) => {
      const elapsed = now - startTime;
      const rawProgress = Math.max(0, Math.min(1, elapsed / FOLDER_PATH_MORPH_DURATION_MS));
      const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
      if (template.type === 'number') {
        const values = template.fromNumbers.map((fromValue, index) => {
          const toValue = template.toNumbers[index];
          return fromValue + (toValue - fromValue) * eased;
        });
        const nextD = composeNumberPathD(template.segments, values);
        part.pathEl.setAttribute('d', nextD);
        syncFollowers(nextD);
      } else {
        const points = template.fromPoints.map((fromPoint, index) => {
          const toPoint = template.toPoints[index];
          return {
            x: fromPoint.x + (toPoint.x - fromPoint.x) * eased,
            y: fromPoint.y + (toPoint.y - fromPoint.y) * eased
          };
        });
        const nextD = composePointPathD(points, template.closed);
        part.pathEl.setAttribute('d', nextD);
        syncFollowers(nextD);
      }
      if (rawProgress < 1) {
        part.animationFrameId = requestAnimationFrame(tick);
        return;
      }
      part.pathEl.setAttribute('d', toD);
      syncFollowers(toD);
      part.animationFrameId = 0;
    };
    part.animationFrameId = requestAnimationFrame(tick);
    return true;
  }

  function initFolderPathMorph(folderIcon) {
    if (!folderIcon || folderIcon._xFolderMorphParts) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      folderIcon._xFolderMorphParts = [];
      return;
    }
    const hoverPathMap = new Map();
    svg.querySelectorAll('[data-folder-part-hover]').forEach((pathEl) => {
      const partName = pathEl.getAttribute('data-folder-part-hover');
      const partD = pathEl.getAttribute('d');
      if (!partName || !partD) {
        return;
      }
      hoverPathMap.set(partName, partD);
    });
    const parts = [];
    svg.querySelectorAll('[data-folder-part]').forEach((pathEl) => {
      const partName = pathEl.getAttribute('data-folder-part');
      const baseD = pathEl.getAttribute('d');
      const hoverD = hoverPathMap.get(partName);
      if (!partName || !baseD || !hoverD) {
        return;
      }
      parts.push({
        partName,
        pathEl,
        baseD,
        hoverD,
        fillBase: pathEl.getAttribute('data-folder-fill-base') || '',
        fillHover: pathEl.getAttribute('data-folder-fill-hover') || '',
        opacityBase: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-base')),
        opacityHover: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-hover')),
        linkedFollowers: [],
        animationFrameId: 0
      });
    });
    const partMap = new Map();
    parts.forEach((part) => {
      partMap.set(part.partName, part);
    });
    const upperBodyPart = partMap.get('upper-body');
    const upperOverlayPart = partMap.get('upper-overlay');
    if (upperBodyPart && upperOverlayPart) {
      upperBodyPart.linkedFollowers.push(upperOverlayPart.pathEl);
    }
    parts.forEach((part) => {
      if (part.fillBase) {
        part.pathEl.setAttribute('fill', part.fillBase);
      }
      if (Number.isFinite(part.opacityBase)) {
        part.pathEl.style.opacity = String(part.opacityBase);
      }
    });
    folderIcon._xFolderMorphParts = parts;
    folderIcon._xFolderMorphState = 'base';
  }

  function playFolderPathMorph(folderIcon, toHover) {
    if (!folderIcon) {
      return;
    }
    if (!folderIcon._xFolderMorphParts) {
      initFolderPathMorph(folderIcon);
    }
    const parts = Array.isArray(folderIcon._xFolderMorphParts) ? folderIcon._xFolderMorphParts : [];
    if (!parts.length) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (folderIcon._xFolderMorphState === targetState) {
      return;
    }
    setFolderUpperFilterSuspended(folderIcon, true);
    playFolderUpperGradientMorph(folderIcon, toHover);
    if (folderIcon._xUpperFilterRestoreTimerId) {
      clearTimeout(folderIcon._xUpperFilterRestoreTimerId);
      folderIcon._xUpperFilterRestoreTimerId = 0;
    }
    folderIcon._xUpperFilterRestoreTimerId = window.setTimeout(() => {
      folderIcon._xUpperFilterRestoreTimerId = 0;
      setFolderUpperFilterSuspended(folderIcon, false);
    }, FOLDER_PATH_MORPH_DURATION_MS + 48);
    folderIcon._xFolderMorphState = targetState;
    parts.forEach((part) => {
      const currentD = part.pathEl && typeof part.pathEl.getAttribute === 'function'
        ? (part.pathEl.getAttribute('d') || '')
        : '';
      const fromD = currentD || (toHover ? part.baseD : part.hoverD);
      const toD = toHover ? part.hoverD : part.baseD;
      if (!part.pathEl || !fromD || !toD) {
        return;
      }
      const targetFill = toHover ? part.fillHover : part.fillBase;
      if (targetFill) {
        part.pathEl.setAttribute('fill', targetFill);
      }
      if (Number.isFinite(part.opacityBase) && Number.isFinite(part.opacityHover)) {
        part.pathEl.style.transition = `opacity ${FOLDER_PATH_MORPH_DURATION_MS}ms ${FOLDER_PATH_MORPH_EASING}`;
        part.pathEl.style.opacity = String(toHover ? part.opacityHover : part.opacityBase);
      }
      if (part.partName === 'upper-overlay') {
        const upperBodyPart = parts.find((item) => item.partName === 'upper-body');
        if (upperBodyPart && upperBodyPart.pathEl) {
          part.pathEl.setAttribute('d', upperBodyPart.pathEl.getAttribute('d') || toD);
          return;
        }
      }
      const animated = animatePathDWithCurve(part, fromD, toD);
      if (!animated) {
        part.pathEl.setAttribute('d', toD);
        part.animationFrameId = 0;
      }
    });
  }

  function getSearchEngineById(id) {
    if (!id) {
      return null;
    }
    return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
  }

  function buildDefaultSearchUrl(query) {
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine && typeof engine.searchUrl === 'function') {
      return engine.searchUrl(query);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function getDefaultSearchEngineThemeUrl() {
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine && typeof engine.searchUrl === 'function') {
      return engine.searchUrl('test');
    }
    return 'https://www.google.com';
  }

  function getDefaultSearchEngineFaviconUrl() {
    if (defaultSearchEngineState.host) {
      return `https://${defaultSearchEngineState.host}/favicon.ico`;
    }
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine) {
      try {
        const host = new URL(engine.searchUrl('test')).hostname;
        return `https://${host}/favicon.ico`;
      } catch (e) {
        return '';
      }
    }
    return 'https://www.google.com/favicon.ico';
  }

  function getSearchActionLabel() {
    if (defaultSearchEngineState && defaultSearchEngineState.name) {
      return formatMessage('action_search_engine', '在 {engine} 中搜索', {
        engine: defaultSearchEngineState.name
      });
    }
    return t('action_search', '搜索');
  }

  function loadDefaultSearchEngineState() {
    if (!storageArea) {
      return;
    }
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id) {
        defaultSearchEngineState = stored;
      }
    });
  }

  function updateRecentHeading() {
    if (!recentHeading) {
      return;
    }
    const key = currentRecentMode === 'most' ? 'recent_heading_most' : 'recent_heading_latest';
    const fallback = currentRecentMode === 'most' ? '最常访问' : '最近访问';
    recentHeading.textContent = t(key, fallback);
  }

  function updateBookmarkHeading() {
    if (!bookmarkHeading) {
      return;
    }
    bookmarkHeading.textContent = t('bookmarks_heading', '书签');
  }

  function navigateBookmarkFolder(targetId) {
    const id = String(targetId || '').trim();
    if (!id) {
      return;
    }
    bookmarkCurrentFolderId = id;
    bookmarkCurrentPage = 0;
    bookmarkRenderSignature = '';
    loadBookmarks();
  }

  function updateBookmarkHeadingRootLinkState(isNested) {
    if (!bookmarkHeading) {
      return;
    }
    const nested = !!isNested;
    bookmarkHeading.classList.toggle('x-nt-bookmarks-heading--link', nested);
    bookmarkHeading._xCanNavigateRoot = nested;
    if (nested) {
      const rootLabel = t('bookmarks_heading', '书签');
      bookmarkHeading.setAttribute('role', 'button');
      bookmarkHeading.setAttribute('tabindex', '0');
      bookmarkHeading.setAttribute('aria-label', rootLabel);
      bookmarkHeading.title = rootLabel;
    } else {
      bookmarkHeading.removeAttribute('role');
      bookmarkHeading.removeAttribute('tabindex');
      bookmarkHeading.removeAttribute('aria-label');
      bookmarkHeading.title = '';
    }
  }

  function updateBookmarkPagerLabels() {
    if (bookmarkPagerPrevButton) {
      const prevLabel = t('bookmarks_page_prev', '上一页');
      bookmarkPagerPrevButton.title = prevLabel;
      bookmarkPagerPrevButton.setAttribute('aria-label', prevLabel);
    }
    if (bookmarkPagerNextButton) {
      const nextLabel = t('bookmarks_page_next', '下一页');
      bookmarkPagerNextButton.title = nextLabel;
      bookmarkPagerNextButton.setAttribute('aria-label', nextLabel);
    }
  }

  function updateBookmarkBreadcrumb() {
    if (!bookmarkBreadcrumb) {
      return;
    }
    const path = Array.isArray(bookmarkFolderPath) ? bookmarkFolderPath : [];
    bookmarkBreadcrumb.innerHTML = '';
    if (path.length <= 1) {
      bookmarkBreadcrumb.style.setProperty('display', 'none');
      updateBookmarkHeadingRootLinkState(false);
      return;
    }
    updateBookmarkHeadingRootLinkState(true);
    const pathWithoutRoot = path.slice(1);
    bookmarkBreadcrumb.style.setProperty('display', 'inline-flex');
    pathWithoutRoot.forEach((crumb, index) => {
      const isCurrent = index === (pathWithoutRoot.length - 1);
      const separator = document.createElement('span');
      separator.className = 'x-nt-bookmarks-crumb-sep';
      separator.textContent = '/';
      bookmarkBreadcrumb.appendChild(separator);
      const crumbButton = document.createElement('button');
      crumbButton.type = 'button';
      crumbButton.className = 'x-nt-bookmarks-crumb';
      const title = String(crumb && crumb.title ? crumb.title : '').trim() || t('bookmarks_heading', '书签');
      crumbButton.textContent = title;
      crumbButton.title = title;
      crumbButton.setAttribute('aria-label', title);
      if (isCurrent) {
        crumbButton.setAttribute('aria-current', 'page');
        crumbButton.disabled = true;
      } else {
        crumbButton.addEventListener('click', () => {
          const targetId = crumb && crumb.id ? String(crumb.id) : '';
          if (!targetId) {
            return;
          }
          navigateBookmarkFolder(targetId);
        });
      }
      bookmarkBreadcrumb.appendChild(crumbButton);
    });
  }

  function applyLanguageStrings() {
    document.title = t('newtab_page_title', 'New Tab');
    updateRecentHeading();
    updateBookmarkHeading();
    updateBookmarkPagerLabels();
    updateBookmarkBreadcrumb();
    if (inputParts && inputParts.input) {
      defaultPlaceholderText = t('search_placeholder', defaultPlaceholderText);
      if (!siteSearchState) {
        inputParts.input.placeholder = defaultPlaceholderText;
      }
    }
    if (modeBadge) {
      modeBadge.textContent = formatMessage('mode_badge', '模式：{mode}', {
        mode: getThemeModeLabel(currentThemeMode)
      });
    }
    recentCards.forEach((card) => {
      if (!card || !card._xActionText || !card._xTitleText) {
        return;
      }
      card._xActionText.textContent = t('visit_label', '访问');
      card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
        title: card._xTitleText
      }));
    });
    bookmarkCards.forEach((card) => {
      if (!card || !card._xTitleText) {
        return;
      }
      card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
        title: card._xTitleText
      }));
    });
    if (latestQuery && latestQuery.trim()) {
      renderSuggestions(lastSuggestionResponse, latestQuery);
    }
    if ((!latestQuery || !latestQuery.trim()) && Array.isArray(tabs) && tabs.length > 0) {
      renderTabSuggestions(tabs);
    }
  }


  function applyLanguageMode(mode) {
    currentLanguageMode = mode || 'system';
    const targetLocale = currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode);
    if (storageArea) {
      storageArea.get([LANGUAGE_MESSAGES_STORAGE_KEY], (result) => {
        const payload = result[LANGUAGE_MESSAGES_STORAGE_KEY];
        if (payload && payload.locale === targetLocale && payload.messages) {
          currentMessages = payload.messages || {};
          applyLanguageStrings();
          forceReloadRecentSitesForI18n();
          return;
        }
        loadLocaleMessages(targetLocale).then((messages) => {
          currentMessages = messages || {};
          applyLanguageStrings();
          forceReloadRecentSitesForI18n();
        });
      });
      return;
    }
    loadLocaleMessages(targetLocale).then((messages) => {
      currentMessages = messages || {};
      applyLanguageStrings();
      forceReloadRecentSitesForI18n();
    });
  }

  function applyThemeMode(mode) {
    currentThemeMode = mode || 'system';
    const resolved = resolveTheme(mode);
    document.body.setAttribute('data-theme', resolved);
    suggestionItems.forEach((item) => {
      if (item && item._xTheme) {
        applyThemeVariables(item, item._xTheme);
      }
    });
    recentCards.forEach((card) => {
      if (!card || !card._xHost || !card._xTheme) {
        return;
      }
      applyRecentCardTheme(card, card._xTheme, card._xHost);
    });
    bookmarkCards.forEach((card) => {
      if (!card || !card._xHost || !card._xTheme) {
        return;
      }
      applyBookmarkCardTheme(card, card._xTheme, card._xHost);
    });
    applyLanguageStrings();
    updateSelection();
    updateModeBadge(inputParts && inputParts.input ? inputParts.input.value : '');
    refreshFallbackIcons();
    if (mode === 'system' && !mediaListenerAttached) {
      mediaQuery.addEventListener('change', handleMediaChange);
      mediaListenerAttached = true;
      return;
    }
    if (mode !== 'system' && mediaListenerAttached) {
      mediaQuery.removeEventListener('change', handleMediaChange);
      mediaListenerAttached = false;
    }
  }

  function handleMediaChange() {
    if (!storageArea) {
      return;
    }
    storageArea.get([THEME_STORAGE_KEY], (result) => {
      const mode = result[THEME_STORAGE_KEY] || 'system';
      if (mode === 'system') {
        document.body.setAttribute('data-theme', resolveTheme(mode));
      }
    });
  }

  if (storageArea) {
    storageArea.get([THEME_STORAGE_KEY], (result) => {
      applyThemeMode(result[THEME_STORAGE_KEY] || 'system');
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!storageAreaName || areaName !== storageAreaName) {
      return;
    }
    if (changes[THEME_STORAGE_KEY]) {
      applyThemeMode(changes[THEME_STORAGE_KEY].newValue || 'system');
    }
    if (changes[LANGUAGE_STORAGE_KEY]) {
      applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
    }
    if (changes[RECENT_COUNT_STORAGE_KEY]) {
      const nextCount = Number.parseInt(changes[RECENT_COUNT_STORAGE_KEY].newValue, 10);
      currentRecentCount = Number.isFinite(nextCount) ? nextCount : 4;
      loadRecentSites();
    }
    if (changes[RECENT_MODE_STORAGE_KEY]) {
      const nextMode = changes[RECENT_MODE_STORAGE_KEY].newValue;
      currentRecentMode = nextMode === 'most' ? 'most' : 'latest';
      updateRecentHeading();
      loadRecentSites();
    }
    if (changes[LANGUAGE_MESSAGES_STORAGE_KEY]) {
      const payload = changes[LANGUAGE_MESSAGES_STORAGE_KEY].newValue;
      const targetLocale = currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode);
      if (payload && payload.locale === targetLocale && payload.messages) {
        currentMessages = payload.messages || {};
        applyLanguageStrings();
        forceReloadRecentSitesForI18n();
      }
    }
  });

  if (storageArea) {
    storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      applyLanguageMode(result[LANGUAGE_STORAGE_KEY] || 'system');
    });

    storageArea.get([RECENT_COUNT_STORAGE_KEY], (result) => {
      const stored = result[RECENT_COUNT_STORAGE_KEY];
      const count = Number.isFinite(stored) ? stored : 4;
      currentRecentCount = count;
      loadRecentSites();
    });
    storageArea.get([RECENT_MODE_STORAGE_KEY], (result) => {
      const stored = result[RECENT_MODE_STORAGE_KEY];
      const mode = stored === 'most' ? 'most' : 'latest';
      currentRecentMode = mode;
      updateRecentHeading();
      if (stored !== mode) {
        storageArea.set({ [RECENT_MODE_STORAGE_KEY]: mode });
      }
      loadRecentSites();
    });
  }

  function getThemeModeLabel(mode) {
    if (mode === 'dark') {
      return t('theme_label_dark', '深色');
    }
    if (mode === 'light') {
      return t('theme_label_light', '浅色');
    }
    return t('theme_label_system', '跟随系统');
  }

  const commandDefinitions = [
    {
      type: 'commandNewTab',
      primary: '/new',
      aliases: ['/n', '/newtab', '/nt']
    },
    {
      type: 'commandSettings',
      primary: '/settings',
      aliases: ['/set', '/settings', '/s']
    }
  ];

  function getCommandMatch(rawInput) {
    const input = String(rawInput || '').trim().toLowerCase();
    if (!input.startsWith('/')) {
      return null;
    }
    for (let i = 0; i < commandDefinitions.length; i += 1) {
      const command = commandDefinitions[i];
      const tokens = [command.primary].concat(command.aliases || []);
      for (let j = 0; j < tokens.length; j += 1) {
        const token = tokens[j];
        if (token.startsWith(input) || input.startsWith(token)) {
          return {
            command: command,
            completion: command.primary
          };
        }
      }
    }
    return null;
  }

  function buildCommandSuggestion(command) {
    let titleText = '';
    if (command.type === 'commandSettings') {
      titleText = formatMessage('command_settings', '打开 Lumno 设置', {
        name: 'Lumno'
      });
    } else {
      titleText = t('command_newtab', '新建标签页');
    }
    return {
      type: command.type,
      title: titleText,
      url: '',
      commandText: command.primary,
      commandAliases: command.aliases || []
    };
  }

  function updateModeBadge(rawValue) {
    if (!modeBadge) {
      return;
    }
    const shouldShow = isModeCommand(rawValue || '');
    if (!shouldShow) {
      modeBadge.style.setProperty('display', 'none', 'important');
      return;
    }
    modeBadge.textContent = formatMessage('mode_badge', '模式：{mode}', {
      mode: getThemeModeLabel(currentThemeMode)
    });
    modeBadge.style.setProperty('display', 'inline-flex', 'important');
  }

  function getNextThemeMode(mode) {
    const order = ['system', 'light', 'dark'];
    const index = order.indexOf(mode);
    if (index === -1) {
      return 'light';
    }
    return order[(index + 1) % order.length];
  }

  function isModeCommand(input) {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/mode' || raw.startsWith('/mode ');
  }

  function buildModeSuggestion() {
    const nextMode = getNextThemeMode(currentThemeMode);
    return {
      type: 'modeSwitch',
      title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
        name: 'Lumno',
        mode: getThemeModeLabel(nextMode)
      }),
      url: '',
      favicon: chrome.runtime.getURL('lumno.png'),
      nextMode: nextMode
    };
  }

  function setThemeMode(mode) {
    const nextMode = mode || 'system';
    currentThemeMode = nextMode;
    if (!storageArea) {
      applyThemeMode(nextMode);
      return;
    }
    storageArea.set({ [THEME_STORAGE_KEY]: nextMode }, () => {
      applyThemeMode(nextMode);
      if (isModeCommand(inputParts && inputParts.input ? inputParts.input.value : '')) {
        renderSuggestions([], (inputParts.input.value || '').trim());
      }
    });
  }

  let latestQuery = '';
  let latestRawQuery = '';
  let lastDeletionAt = 0;
  let autocompleteState = null;
  let inlineSearchState = null;
  let isComposing = false;
  let siteSearchState = null;
  let debounceTimer = null;
  let tabs = [];
  let siteSearchProvidersCache = null;
  let pendingProviderReload = false;
  loadDefaultSearchEngineState();
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName || !changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
        return;
      }
      const nextValue = changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY].newValue;
      if (nextValue && nextValue.id) {
        defaultSearchEngineState = nextValue;
      }
      if (latestQuery && latestQuery.trim()) {
        renderSuggestions(lastSuggestionResponse, latestQuery);
      }
    });
  }
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
  migrateStorageIfNeeded([
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    LANGUAGE_MESSAGES_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY
  ]);
  let handleTabKey = null;
  const defaultSiteSearchProviders = [
    { key: 'yt', aliases: ['youtube'], name: 'YouTube', template: 'https://www.youtube.com/results?search_query={query}' },
    { key: 'bb', aliases: ['bilibili', 'bili'], name: 'Bilibili', template: 'https://search.bilibili.com/all?keyword={query}' },
    { key: 'gh', aliases: ['github'], name: 'GitHub', template: 'https://github.com/search?q={query}' },
    { key: 'so', aliases: ['baidu', 'bd'], name: '百度', template: 'https://www.baidu.com/s?wd={query}' },
    { key: 'bi', aliases: ['bing'], name: 'Bing', template: 'https://www.bing.com/search?q={query}' },
    { key: 'gg', aliases: ['google'], name: 'Google', template: 'https://www.google.com/search?q={query}' },
    { key: 'zh', aliases: ['zhihu'], name: '知乎', template: 'https://www.zhihu.com/search?q={query}' },
    { key: 'db', aliases: ['douban'], name: '豆瓣', template: 'https://www.douban.com/search?q={query}' },
    { key: 'jd', aliases: ['juejin'], name: '掘金', template: 'https://juejin.cn/search?query={query}' },
    { key: 'tb', aliases: ['taobao'], name: '淘宝', template: 'https://s.taobao.com/search?q={query}' },
    { key: 'tm', aliases: ['tmall'], name: '天猫', template: 'https://list.tmall.com/search_product.htm?q={query}' },
    { key: 'wx', aliases: ['weixin', 'wechat'], name: '微信', template: 'https://weixin.sogou.com/weixin?query={query}' },
    { key: 'tw', aliases: ['twitter', 'x'], name: 'X', template: 'https://x.com/search?q={query}' },
    { key: 'rd', aliases: ['reddit'], name: 'Reddit', template: 'https://www.reddit.com/search/?q={query}' },
    { key: 'wk', aliases: ['wiki', 'wikipedia'], name: 'Wikipedia', template: 'https://en.wikipedia.org/wiki/Special:Search?search={query}' },
    { key: 'zw', aliases: ['zhwiki'], name: '维基百科', template: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}' }
  ];
  const defaultAccentColor = [59, 130, 246];
  const themeColorCache = window._x_extension_theme_color_cache_2024_unique_ || new Map();
  window._x_extension_theme_color_cache_2024_unique_ = themeColorCache;
  const themeHostCache = window._x_extension_theme_host_cache_2024_unique_ || new Map();
  window._x_extension_theme_host_cache_2024_unique_ = themeHostCache;

  function mixColor(color, target, amount) {
    return [
      Math.round(color[0] + (target[0] - color[0]) * amount),
      Math.round(color[1] + (target[1] - color[1]) * amount),
      Math.round(color[2] + (target[2] - color[2]) * amount)
    ];
  }

  function stableHashCode(text) {
    const input = String(text || '');
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function rgbToCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function rgbToCssParts(rgb) {
    return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  }

  function parseCssColor(color) {
    if (!color || typeof color !== 'string') {
      return null;
    }
    const trimmed = color.trim().toLowerCase();
    if (trimmed.startsWith('#')) {
      const hex = trimmed.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return [r, g, b];
        }
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return [r, g, b];
        }
      }
      return null;
    }
    const rgbMatch = trimmed.match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/);
    if (rgbMatch) {
      const r = Number(rgbMatch[1]);
      const g = Number(rgbMatch[2]);
      const b = Number(rgbMatch[3]);
      if ([r, g, b].every((value) => Number.isFinite(value))) {
        return [r, g, b];
      }
    }
    return null;
  }

  function getHighlightColors(theme) {
    const resolvedTheme = getThemeForMode(theme);
    if (!resolvedTheme || !resolvedTheme._xIsBrand) {
      return {
        bg: 'var(--x-nt-hover-bg, #F3F4F6)',
        border: 'transparent'
      };
    }
    return {
      bg: resolvedTheme.highlightBg,
      border: resolvedTheme.highlightBorder
    };
  }

  function getLuminance(rgb) {
    const [r, g, b] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getReadableTextColor(bgRgb) {
    if (!bgRgb || bgRgb.length !== 3) {
      return '#111827';
    }
    const darkText = [17, 24, 39];
    const lightText = [248, 250, 252];
    const bgLum = getLuminance(bgRgb);
    const darkLum = getLuminance(darkText);
    const lightLum = getLuminance(lightText);
    const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
    const contrastWithLight = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
    return contrastWithDark >= contrastWithLight ? '#111827' : '#F8FAFC';
  }

  function normalizeAccentColor(rgb) {
    if (!rgb || rgb.length !== 3) {
      return defaultAccentColor;
    }
    const luminance = getLuminance(rgb);
    if (luminance < 0.12) {
      return mixColor(rgb, [255, 255, 255], 0.55);
    }
    if (luminance > 0.9) {
      return mixColor(rgb, [0, 0, 0], 0.2);
    }
    return rgb;
  }

  function buildThemeVariant(accent, mode) {
    const isDark = mode === 'dark';
    const base = isDark ? [48, 48, 48] : [255, 255, 255];
    const highlightBg = mixColor(accent, base, isDark ? 0.82 : 0.86);
    const highlightBorder = mixColor(accent, base, isDark ? 0.66 : 0.62);
    const markBg = mixColor(accent, base, isDark ? 0.74 : 0.78);
    const tagBg = mixColor(accent, base, isDark ? 0.76 : 0.74);
    const keyBg = mixColor(accent, base, isDark ? 0.88 : 0.9);
    const tagBorder = mixColor(accent, base, isDark ? 0.62 : 0.58);
    const keyBorder = mixColor(accent, base, isDark ? 0.7 : 0.18);
    const buttonBg = mixColor(accent, base, isDark ? 0.8 : 0.94);
    const buttonBorder = mixColor(accent, base, isDark ? 0.68 : 0.7);
    const buttonText = isDark
      ? getReadableTextColor(buttonBg)
      : (getLuminance(accent) > 0.8
        ? rgbToCss(mixColor(accent, [0, 0, 0], 0.6))
        : rgbToCss(accent));
    const placeholderText = isDark
      ? rgbToCss(mixColor(accent, [255, 255, 255], 0.2))
      : buttonText;
    return {
      accent: rgbToCss(accent),
      accentRgb: accent,
      highlightBg: rgbToCss(highlightBg),
      highlightBorder: rgbToCss(highlightBorder),
      markBg: rgbToCss(markBg),
      markText: getReadableTextColor(markBg),
      tagBg: rgbToCss(tagBg),
      tagText: getReadableTextColor(tagBg),
      tagBorder: rgbToCss(tagBorder),
      keyBg: rgbToCss(keyBg),
      keyText: getReadableTextColor(keyBg),
      keyBorder: rgbToCss(keyBorder),
      buttonText: buttonText,
      buttonBg: rgbToCss(buttonBg),
      buttonBorder: rgbToCss(buttonBorder),
      placeholderText: placeholderText
    };
  }

  function buildTheme(rgb) {
    const accent = normalizeAccentColor(rgb);
    return buildThemeVariant(accent, 'light');
  }

  const defaultTheme = buildTheme(defaultAccentColor);
  defaultTheme._xIsDefault = true;
  const urlHighlightTheme = buildTheme(defaultAccentColor);
  urlHighlightTheme._xIsBrand = true;
  urlHighlightTheme._xIsUrl = true;
  const brandAccentMap = {
    'github.com': [36, 41, 46],
    'docs.github.com': [36, 41, 46],
    'douban.com': [0, 181, 29],
    'zhihu.com': [23, 127, 255],
    'bilibili.com': [0, 174, 236],
    'youtube.com': [255, 0, 0],
    'youtu.be': [255, 0, 0],
    'google.com': [66, 133, 244],
    'bing.com': [0, 120, 215],
    'baidu.com': [41, 98, 255],
    'taobao.com': [255, 80, 0],
    'tmall.com': [226, 35, 26],
    'juejin.cn': [30, 128, 255],
    'reddit.com': [255, 69, 0],
    'wikipedia.org': [64, 64, 64],
    'zh.wikipedia.org': [64, 64, 64],
    'x.com': [17, 24, 39],
    'twitter.com': [29, 161, 242]
  };

  function getBrandAccentForHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) {
      return null;
    }
    if (brandAccentMap[host]) {
      return brandAccentMap[host];
    }
    const entry = Object.keys(brandAccentMap).find((key) => host === key || host.endsWith(`.${key}`));
    return entry ? brandAccentMap[entry] : null;
  }

  function getBrandAccentForUrl(url) {
    if (!url) {
      return null;
    }
    try {
      const hostname = normalizeHost(new URL(url).hostname);
      return getBrandAccentForHost(hostname);
    } catch (e) {
      return null;
    }
  }

  function hashStringToHue(value) {
    if (!value) {
      return 0;
    }
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp >= 0 && hp < 1) {
      r = c; g = x; b = 0;
    } else if (hp >= 1 && hp < 2) {
      r = x; g = c; b = 0;
    } else if (hp >= 2 && hp < 3) {
      r = 0; g = c; b = x;
    } else if (hp >= 3 && hp < 4) {
      r = 0; g = x; b = c;
    } else if (hp >= 4 && hp < 5) {
      r = x; g = 0; b = c;
    } else if (hp >= 5 && hp < 6) {
      r = c; g = 0; b = x;
    }
    const m = l - c / 2;
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  function buildFallbackThemeForHost(hostname) {
    if (!hostname) {
      return null;
    }
    const hue = hashStringToHue(hostname);
    const accent = hslToRgb(hue, 0.55, 0.52);
    const theme = buildTheme(accent);
    theme._xIsBrand = true;
    theme._xIsFallback = true;
    return theme;
  }

  function getHostFromUrl(url) {
    if (!url) {
      return '';
    }
    try {
      return normalizeHost(new URL(url).hostname);
    } catch (e) {
      return '';
    }
  }

  function normalizeHost(hostname) {
    if (!hostname) {
      return '';
    }
    const lower = String(hostname).toLowerCase();
    const stripped = lower.replace(/^www\./i, '');
    if (stripped === 'my.feishu.cn') {
      return 'feishu.cn';
    }
    return stripped;
  }

  function normalizeFaviconHost(hostname) {
    if (!hostname) {
      return '';
    }
    const host = String(hostname).toLowerCase().replace(/^www\./i, '');
    if (host === 'feishu.cn' || host.endsWith('.feishu.cn')) {
      return 'feishu.cn';
    }
    return host;
  }

  function isFaviconProxyUrl(url) {
    if (!url) {
      return false;
    }
    return /google\.com\/s2\/favicons/i.test(url) || /gstatic\.com\/favicon/i.test(url);
  }

  const newtabThemeStyle = document.createElement('style');
  newtabThemeStyle.id = '_x_extension_newtab_theme_style_2024_unique_';
  newtabThemeStyle.textContent = `
    #_x_extension_newtab_root_2024_unique_ {
      color: var(--x-nt-text, #111827);
    }
    #_x_extension_newtab_search_input_2024_unique_::placeholder {
      color: var(--x-nt-placeholder, #9CA3AF);
    }
    #_x_extension_newtab_search_input_2024_unique_::selection {
      background: #CFE8FF;
      color: #1E3A8A;
    }
  `;
  document.head.appendChild(newtabThemeStyle);

  function extractAverageColor(image) {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }
    try {
      context.drawImage(image, 0, 0, size, size);
      const data = context.getImageData(0, 0, size, size).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 32) {
          continue;
        }
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const brightness = (red + green + blue) / 3;
        if (brightness > 245) {
          continue;
        }
        r += red;
        g += green;
        b += blue;
        count += 1;
      }
      if (!count) {
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 32) {
            continue;
          }
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
      }
      if (!count) {
        return null;
      }
      return [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count)
      ];
    } catch (e) {
      return null;
    }
  }

  function getThemeFromUrl(url, hostOverride) {
    if (!url) {
      return Promise.resolve(defaultTheme);
    }
    const hostKey = hostOverride || getHostFromUrl(url);
    const isProxy = isFaviconProxyUrl(url);
    const useHostCache = hostKey && (!isProxy || Boolean(hostOverride));
    if (useHostCache && themeHostCache.has(hostKey)) {
      return Promise.resolve(themeHostCache.get(hostKey));
    }
    if (themeColorCache.has(url)) {
      return Promise.resolve(themeColorCache.get(url));
    }
    const brandAccent = (isProxy && hostOverride) ? null : getBrandAccentForUrl(url);
    if (brandAccent) {
      const brandTheme = buildTheme(brandAccent);
      brandTheme._xIsBrand = true;
      themeColorCache.set(url, brandTheme);
      if (useHostCache) {
        themeHostCache.set(hostKey, brandTheme);
      }
      return Promise.resolve(brandTheme);
    }
    const cachedFaviconData = faviconDataCache.get(url);
    if (cachedFaviconData) {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = function() {
          const avg = extractAverageColor(image);
          if (!avg) {
            themeColorCache.set(url, defaultTheme);
            resolve(defaultTheme);
            return;
          }
          const theme = buildTheme(avg);
          theme._xIsBrand = true;
          themeColorCache.set(url, theme);
          if (useHostCache) {
            themeHostCache.set(hostKey, theme);
          }
          resolve(theme);
        };
        image.onerror = function() {
          themeColorCache.set(url, defaultTheme);
          resolve(defaultTheme);
        };
        image.src = cachedFaviconData;
      });
    }
    if (isProxy) {
      return requestFaviconData(url).then((dataUrl) => {
        if (!dataUrl) {
          themeColorCache.set(url, defaultTheme);
          return defaultTheme;
        }
        return new Promise((resolve) => {
          const image = new Image();
          image.onload = function() {
            const avg = extractAverageColor(image);
            if (!avg) {
              themeColorCache.set(url, defaultTheme);
              resolve(defaultTheme);
              return;
            }
            const theme = buildTheme(avg);
            theme._xIsBrand = true;
            themeColorCache.set(url, theme);
            if (useHostCache) {
              themeHostCache.set(hostKey, theme);
            }
            resolve(theme);
          };
          image.onerror = function() {
            themeColorCache.set(url, defaultTheme);
            resolve(defaultTheme);
          };
          image.src = dataUrl;
        });
      });
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = function() {
        const avg = extractAverageColor(image);
        if (!avg) {
          themeColorCache.set(url, defaultTheme);
          resolve(defaultTheme);
          return;
        }
        const theme = buildTheme(avg);
        theme._xIsBrand = true;
        themeColorCache.set(url, theme);
        if (useHostCache) {
          themeHostCache.set(hostKey, theme);
        }
        resolve(theme);
      };
      image.onerror = function() {
        themeColorCache.set(url, defaultTheme);
        resolve(defaultTheme);
      };
      image.src = url;
    });
  }

  function getThemeForProvider(provider) {
    if (provider && provider.template) {
      const brandAccent = getBrandAccentForUrl(provider.template);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return Promise.resolve(brandTheme);
      }
    }
    return getThemeFromUrl(getProviderIcon(provider));
  }

  function shouldUseBrandTheme(suggestion) {
    if (!suggestion) {
      return false;
    }
  const neutralTypes = ['googleSuggest', 'newtab', 'modeSwitch', 'chatgpt', 'perplexity', 'commandNewTab', 'commandSettings'];
    if (neutralTypes.includes(suggestion.type)) {
      return false;
    }
    return true;
  }

  function getThemeForSuggestion(suggestion) {
    if (!shouldUseBrandTheme(suggestion)) {
      return Promise.resolve(defaultTheme);
    }
    if (suggestion && suggestion.provider) {
      return getThemeForProvider(suggestion.provider);
    }
    if (suggestion && suggestion.url) {
      const brandAccent = getBrandAccentForUrl(suggestion.url);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return Promise.resolve(brandTheme);
      }
    }
    const hostKey = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
    return getThemeFromUrl(getThemeSourceForSuggestion(suggestion), hostKey).then((theme) => {
      if (theme && !theme._xIsDefault) {
        return theme;
      }
      const fallback = buildFallbackThemeForHost(hostKey);
      return fallback || theme;
    });
  }

  function getImmediateThemeForSuggestion(suggestion) {
    if (!shouldUseBrandTheme(suggestion)) {
      return defaultTheme;
    }
    if (suggestion && suggestion.provider) {
      const brandAccent = getBrandAccentForUrl(suggestion.provider.template);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return brandTheme;
      }
    }
    if (suggestion && suggestion.url) {
      const hostKey = getHostFromUrl(suggestion.url);
      if (hostKey && themeHostCache.has(hostKey)) {
        return themeHostCache.get(hostKey);
      }
      if (themeColorCache.has(suggestion.url)) {
        return themeColorCache.get(suggestion.url);
      }
      const brandAccent = getBrandAccentForUrl(suggestion.url);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return brandTheme;
      }
      const fallbackTheme = buildFallbackThemeForHost(hostKey);
      if (fallbackTheme) {
        return fallbackTheme;
      }
    }
    return null;
  }

  function isNewtabDarkMode() {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  function getThemeForMode(theme) {
    if (!theme) {
      return defaultTheme;
    }
    if (!isNewtabDarkMode()) {
      return theme;
    }
    if (theme._xDark) {
      return theme._xDark;
    }
    const accentRgb = theme.accentRgb || parseCssColor(theme.accent) || defaultAccentColor;
    const darkTheme = buildThemeVariant(accentRgb, 'dark');
    darkTheme._xIsDefault = Boolean(theme._xIsDefault);
    darkTheme._xIsBrand = Boolean(theme._xIsBrand);
    theme._xDark = darkTheme;
    return darkTheme;
  }

  function getHoverColors(theme) {
    const resolvedTheme = getThemeForMode(theme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = isNewtabDarkMode();
    const base = isDark ? [48, 48, 48] : [255, 255, 255];
    return {
      bg: rgbToCss(mixColor(accentRgb, base, isDark ? 0.6 : 0.9)),
      border: rgbToCss(mixColor(accentRgb, base, isDark ? 0.4 : 0.72))
    };
  }

  function applyThemeVariables(target, theme) {
    if (!target || !theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg, 'important');
    target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText, 'important');
    target.style.setProperty('--x-ext-tag-bg', resolvedTheme.tagBg, 'important');
    target.style.setProperty('--x-ext-tag-text', resolvedTheme.tagText, 'important');
    target.style.setProperty('--x-ext-tag-border', resolvedTheme.tagBorder, 'important');
    target.style.setProperty('--x-ext-key-bg', resolvedTheme.keyBg, 'important');
    target.style.setProperty('--x-ext-key-text', resolvedTheme.keyText, 'important');
    target.style.setProperty('--x-ext-key-border', resolvedTheme.keyBorder, 'important');
    target.style.setProperty('--x-ext-icon-color', resolvedTheme.accent, 'important');
  }

  function applyMarkVariables(target, theme) {
    if (!target || !theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg, 'important');
    target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText, 'important');
  }

  const iconPreloadCache = new Map();
  const faviconDataCache = new Map();
  const faviconDataPending = new Map();
  const missingIconCache = new Set();

  function isBlockedLocalFaviconUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) {
      return false;
    }
    const decodedRaw = (() => {
      try {
        return decodeURIComponent(raw);
      } catch (e) {
        return raw;
      }
    })();
    const localPattern = /(https?:\/\/)?(localhost|127(?:\.\d{1,3}){0,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?(?:[/?#]|$)/i;
    if (localPattern.test(decodedRaw)) {
      return true;
    }
    try {
      const parsed = new URL(raw);
      const protocol = String(parsed.protocol || '').toLowerCase();
      if ((protocol === 'http:' || protocol === 'https:') && isLocalNetworkHost(parsed.hostname)) {
        return true;
      }
      if (protocol === 'chrome:' && parsed.hostname === 'favicon2') {
        const nested = parsed.searchParams.get('url') || '';
        if (nested) {
          try {
            const nestedUrl = new URL(nested);
            if (isLocalNetworkHost(nestedUrl.hostname)) {
              return true;
            }
          } catch (e) {
            // Ignore malformed nested URL.
          }
        }
      }
    } catch (e) {
      // Ignore malformed URL.
    }
    return false;
  }

  function reportMissingIcon(context, url, iconUrl) {
    const key = `${context || 'unknown'}::${url || ''}::${iconUrl || ''}`;
    if (missingIconCache.has(key)) {
      return;
    }
    missingIconCache.add(key);
    console.warn('[Lumno] icon missing', {
      context: context || 'unknown',
      url: url || '',
      icon: iconUrl || ''
    });
  }

  function ensureFallbackIconNode(img) {
    if (!img || !img.parentElement) {
      return null;
    }
    let node = img.parentElement.querySelector('._x_extension_favicon_fallback_2024_unique_');
    if (node) {
      return node;
    }
    node = document.createElement('span');
    const isFolderPreview = !!(img.classList && img.classList.contains('x-nt-folder-preview-favicon'));
    const isBookmarkLeadingIcon = !!(
      img.classList &&
      img.classList.contains('x-nt-bookmark-icon') &&
      img.parentElement &&
      img.parentElement.classList &&
      img.parentElement.classList.contains('x-nt-bookmark-card')
    );
    if (isFolderPreview) {
      node.className = 'x-nt-folder-preview-favicon x-nt-folder-preview-favicon--fallback _x_extension_favicon_fallback_2024_unique_';
      node.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      `;
      node.innerHTML = getRiSvg('ri-link-m', 'ri-size-12');
      img.parentElement.insertBefore(node, img);
      return node;
    }
    node.className = '_x_extension_favicon_fallback_2024_unique_';
    node.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: ${img.clientWidth || 25}px !important;
      height: ${img.clientHeight || 25}px !important;
      border-radius: 6px !important;
      background: ${isBookmarkLeadingIcon ? '#FFFFFF' : 'var(--x-nt-tag-bg, #F3F4F6)'} !important;
      color: var(--x-nt-tag-text, #6B7280) !important;
      box-sizing: border-box !important;
      padding: 3px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    `;
    node.innerHTML = getRiSvg('ri-link-m', 'ri-size-14');
    img.parentElement.insertBefore(node, img.nextSibling);
    return node;
  }

  function applyFallbackIcon(img) {
    if (!img) {
      return;
    }
    const node = ensureFallbackIconNode(img);
    img.setAttribute('data-fallback-icon', 'true');
    img.style.setProperty('display', 'none', 'important');
    if (node) {
      node.style.setProperty('display', 'inline-flex', 'important');
      return;
    }
    // Some local-network entries fallback before the image is attached to DOM.
    // Retry once on next tick so the fallback icon can be mounted after attach.
    setTimeout(() => {
      if (!img || !img.isConnected) {
        return;
      }
      const delayedNode = ensureFallbackIconNode(img);
      if (delayedNode) {
        delayedNode.style.setProperty('display', 'inline-flex', 'important');
      }
    }, 0);
  }

  function refreshFallbackIcons() {
    document.querySelectorAll('img[data-fallback-icon=\"true\"]').forEach((img) => {
      const node = ensureFallbackIconNode(img);
      if (node) {
        node.style.setProperty('display', 'inline-flex', 'important');
      }
      img.style.setProperty('display', 'none', 'important');
    });
  }
  const recentActionOffsetUpdaters = new Set();
  let recentActionResizeBound = false;
  const recentActionObservers = new WeakMap();

  function requestFaviconData(url) {
    if (!url || url.startsWith('data:') || isBlockedLocalFaviconUrl(url)) {
      return Promise.resolve(null);
    }
    if (faviconDataCache.has(url)) {
      return Promise.resolve(faviconDataCache.get(url));
    }
    if (faviconDataPending.has(url)) {
      return faviconDataPending.get(url);
    }
    const promise = new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getFaviconData', url: url }, (response) => {
        const dataUrl = response && response.data ? response.data : '';
        if (dataUrl) {
          faviconDataCache.set(url, dataUrl);
        }
        faviconDataPending.delete(url);
        resolve(dataUrl || null);
      });
    });
    faviconDataPending.set(url, promise);
    return promise;
  }

  function setFaviconSrcWithAnimation(img, nextSrc) {
    if (!img || !nextSrc || isBlockedLocalFaviconUrl(nextSrc)) {
      return false;
    }
    const currentSrc = img.getAttribute('data-favicon-current-src') || '';
    if (currentSrc === nextSrc) {
      return false;
    }
    const hasAppeared = img.getAttribute('data-favicon-has-appeared') === 'true';
    const shouldAnimate = !hasAppeared;
    img._xFaviconLoadToken = (img._xFaviconLoadToken || 0) + 1;
    const token = img._xFaviconLoadToken;
    const finalize = () => {
      if (!img || token !== img._xFaviconLoadToken) {
        return;
      }
      img.setAttribute('data-favicon-current-src', nextSrc);
      img.setAttribute('data-favicon-has-appeared', 'true');
      if (!shouldAnimate) {
        img.style.setProperty('filter', 'none', 'important');
        img.style.setProperty('opacity', '1', 'important');
        img.style.setProperty('transition', 'none', 'important');
        return;
      }
      img.style.setProperty('transition', 'none', 'important');
      img.style.setProperty('filter', 'blur(4px)', 'important');
      img.style.setProperty('opacity', '0.72', 'important');
      requestAnimationFrame(() => {
        if (!img || token !== img._xFaviconLoadToken) {
          return;
        }
        img.style.setProperty('transition', 'filter 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms cubic-bezier(0.22, 1, 0.36, 1)', 'important');
        img.style.setProperty('filter', 'blur(0)', 'important');
        img.style.setProperty('opacity', '1', 'important');
      });
    };
    img.addEventListener('load', finalize, { once: true });
    img.src = nextSrc;
    if (img.complete && img.naturalWidth > 0) {
      finalize();
    }
    return true;
  }

  function attachFaviconData(img, url, hostOverride) {
    if (!img || !url) {
      return;
    }
    const cached = faviconDataCache.get(url);
    if (cached) {
      setFaviconSrcWithAnimation(img, cached);
      preloadThemeFromFavicon(url, cached, hostOverride);
      return;
    }
    requestFaviconData(url).then((dataUrl) => {
      if (!dataUrl || !img.isConnected) {
        return;
      }
      setFaviconSrcWithAnimation(img, dataUrl);
      preloadThemeFromFavicon(url, dataUrl, hostOverride);
    });
  }

  function preloadThemeFromFavicon(url, dataUrl, hostOverride) {
    if (!url || themeColorCache.has(url)) {
      return;
    }
    const hostKey = hostOverride || getHostFromUrl(url);
    const useHostCache = hostKey && (Boolean(hostOverride) || !isFaviconProxyUrl(url));
    if (useHostCache && themeHostCache.has(hostKey)) {
      return;
    }
    if (!dataUrl) {
      return;
    }
    const image = new Image();
    image.onload = function() {
      const avg = extractAverageColor(image);
      if (!avg) {
        return;
      }
      const theme = buildTheme(avg);
      theme._xIsBrand = true;
      themeColorCache.set(url, theme);
      if (useHostCache) {
        themeHostCache.set(hostKey, theme);
      }
    };
    image.onerror = function() {};
    image.src = dataUrl;
  }

  function preloadIcon(url) {
    if (!url || url.startsWith('data:') || iconPreloadCache.has(url) || isBlockedLocalFaviconUrl(url)) {
      return;
    }
    const host = getHostFromUrl(url);
    if (host && isLocalNetworkHost(host)) {
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = url;
    iconPreloadCache.set(url, img);
  }

  function warmIconCache(list) {
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach((item) => {
      if (!item) {
        return;
      }
      const skipType = item.type === 'browserPage' ||
        item.type === 'directUrl' ||
        item.type === 'newtab' ||
        item.type === 'googleSuggest';
      if (item.favicon && !skipType) {
        preloadIcon(item.favicon);
        const hostKey = item && item.url ? getHostFromUrl(item.url) : '';
        requestFaviconData(item.favicon).then((dataUrl) => {
          if (dataUrl) {
            preloadThemeFromFavicon(item.favicon, dataUrl, hostKey);
          }
        });
      }
      const hostKeyForTheme = item && item.url ? getHostFromUrl(item.url) : '';
      if (hostKeyForTheme && !themeHostCache.has(hostKeyForTheme)) {
        const themeIcon = getGoogleFaviconUrl(hostKeyForTheme);
        if (themeIcon) {
          requestFaviconData(themeIcon).then((dataUrl) => {
            if (dataUrl) {
              preloadThemeFromFavicon(themeIcon, dataUrl, hostKeyForTheme);
            }
          });
        }
      }
    });
  }

  function createSearchIcon() {
    const icon = document.createElement('span');
    icon.innerHTML = getRiSvg('ri-search-line', 'ri-size-16');
    icon.style.cssText = `
      all: unset !important;
      width: 16px !important;
      height: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;
    return icon;
  }

  function createLinkIcon() {
    const icon = document.createElement('span');
    icon.innerHTML = getRiSvg('ri-link-m', 'ri-size-16');
    icon.style.cssText = `
      all: unset !important;
      width: 16px !important;
      height: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;
    return icon;
  }

  function getNonFaviconIconBg() {
    return isNewtabDarkMode() ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF';
  }

  function setNonFaviconIconBg(item, isActive) {
    if (!item || !item._xIconWrap || item._xIconIsFavicon) {
      return;
    }
    item._xIconWrap.style.setProperty(
      'background-color',
      isActive ? getNonFaviconIconBg() : 'transparent',
      'important'
    );
  }

  const FAVICON_GOOGLE_SIZE = 128;

  function getThemeSourceForSuggestion(suggestion) {
    if (suggestion && suggestion.url) {
      try {
        const hostname = normalizeHost(new URL(suggestion.url).hostname);
        if (hostname) {
          return getGoogleFaviconUrl(hostname);
        }
      } catch (e) {
        // Ignore malformed URLs.
      }
    }
    return suggestion && suggestion.favicon ? suggestion.favicon : '';
  }

  function getSiteFaviconUrl(hostname) {
    if (!hostname) {
      return '';
    }
    return `https://${hostname}/favicon.ico`;
  }

  function createActionTag(labelText, keyLabel) {
    const tag = document.createElement('span');
    tag.style.cssText = `
      all: unset !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      background: var(--x-ext-tag-bg, #EEF6FF) !important;
      color: var(--x-ext-tag-text, #1E3A8A) !important;
      border: 1px solid var(--x-ext-tag-border, #BFDBFE) !important;
      padding: 4px 10px 4px 8px !important;
      border-radius: 999px !important;
      font-size: 11px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
    `;

    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = `
      all: unset !important;
      font-weight: 500 !important;
      line-height: 1 !important;
    `;

    const keycap = document.createElement('span');
    keycap.textContent = keyLabel;
    keycap.style.cssText = `
      all: unset !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 2px 7px !important;
      border-radius: 6px !important;
      background: var(--x-ext-key-bg, #FFFFFF) !important;
      color: var(--x-ext-key-text, #1E3A8A) !important;
      border: 1px solid var(--x-ext-key-border, #BFDBFE) !important;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12) !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
    `;

    tag.appendChild(label);
    tag.appendChild(keycap);
    return tag;
  }

  function navigateToUrl(url) {
    if (!url) {
      return;
    }
    if (chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent(function(tab) {
        if (chrome.runtime.lastError) {
          window.location.href = url;
          return;
        }
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { url: url });
        } else {
          window.location.href = url;
        }
      });
    } else {
      window.location.href = url;
    }
  }

  function openBookmarkFolder(nodeId) {
    const id = String(nodeId || '').trim();
    if (!id) {
      return;
    }
    navigateBookmarkFolder(id);
  }

  function markCurrentTabForSearchTracking() {
    if (!chrome || !chrome.tabs || !chrome.tabs.getCurrent || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    chrome.tabs.getCurrent((tab) => {
      if (tab && typeof tab.id === 'number') {
        chrome.runtime.sendMessage({ action: 'trackSearchTab', tabId: tab.id });
      }
    });
  }

  function runBrowserSearch(query, disposition, onFail) {
    if (chrome && chrome.search && typeof chrome.search.query === 'function') {
      try {
        chrome.search.query({ text: query, disposition: disposition || 'CURRENT_TAB' }, () => {
          if (chrome.runtime && chrome.runtime.lastError && typeof onFail === 'function') {
            onFail();
          }
        });
        return true;
      } catch (e) {
        if (typeof onFail === 'function') {
          onFail();
        }
        return false;
      }
    }
    return false;
  }

  function navigateToQuery(query, forceSearch) {
    const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
    let targetUrl = query;
    if (directUrl) {
      navigateToUrl(directUrl);
      return;
    }
    markCurrentTabForSearchTracking();
    const attempted = runBrowserSearch(query, 'CURRENT_TAB', () => {
      const fallbackUrl = buildDefaultSearchUrl(query);
      navigateToUrl(fallbackUrl);
    });
    if (attempted) {
      return;
    }
    targetUrl = buildDefaultSearchUrl(query);
    navigateToUrl(targetUrl);
  }

  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = '_x_extension_newtab_suggestions_container_2024_unique_';
  suggestionsContainer.style.cssText = `
    all: unset !important;
    width: 100% !important;
    margin-top: 0 !important;
    position: relative !important;
    left: auto !important;
    right: auto !important;
    top: auto !important;
    z-index: 1 !important;
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 8px !important;
    box-sizing: border-box !important;
    display: none !important;
    max-height: calc(100vh - 220px) !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
    transform: translateY(-4px) !important;
    transition: opacity 0.12s ease, transform 0.12s ease !important;
    line-height: 1 !important;
    text-decoration: none !important;
    list-style: none !important;
    outline: none !important;
    color: inherit !important;
    font-size: 100% !important;
    font: inherit !important;
    vertical-align: baseline !important;
  `;

  const bookmarkSection = document.createElement('section');
  bookmarkSection.id = '_x_extension_newtab_bookmarks_2024_unique_';
  bookmarkSection.style.setProperty('display', 'none', 'important');
  bookmarkSection.style.setProperty('margin', '0', 'important');
  bookmarkSection.style.setProperty('width', '100%', 'important');
  bookmarkSection.style.setProperty('pointer-events', 'auto', 'important');
  const bookmarkHeader = document.createElement('div');
  bookmarkHeader.className = 'x-nt-bookmarks-header';
  bookmarkTitleWrap = document.createElement('div');
  bookmarkTitleWrap.className = 'x-nt-bookmarks-title-wrap';
  const bookmarkHeading = document.createElement('div');
  bookmarkHeading.className = 'x-nt-bookmarks-heading';
  updateBookmarkHeading();
  bookmarkBreadcrumb = document.createElement('div');
  bookmarkBreadcrumb.className = 'x-nt-bookmarks-breadcrumb';
  bookmarkBreadcrumb.style.setProperty('display', 'none');
  const bookmarkPager = document.createElement('div');
  bookmarkPager.className = 'x-nt-bookmarks-pager';
  bookmarkPagerPrevButton = document.createElement('button');
  bookmarkPagerPrevButton.type = 'button';
  bookmarkPagerPrevButton.className = 'x-nt-bookmarks-pager-btn';
  bookmarkPagerPrevButton.innerHTML = getRiSvg('ri-arrow-left-s-line', 'ri-size-16');
  bookmarkPagerNextButton = document.createElement('button');
  bookmarkPagerNextButton.type = 'button';
  bookmarkPagerNextButton.className = 'x-nt-bookmarks-pager-btn';
  bookmarkPagerNextButton.innerHTML = getRiSvg('ri-arrow-right-s-line', 'ri-size-16');
  bookmarkPager.appendChild(bookmarkPagerPrevButton);
  bookmarkPager.appendChild(bookmarkPagerNextButton);
  bookmarkTitleWrap.appendChild(bookmarkHeading);
  bookmarkTitleWrap.appendChild(bookmarkBreadcrumb);
  bookmarkHeader.appendChild(bookmarkTitleWrap);
  bookmarkHeader.appendChild(bookmarkPager);
  bookmarkHeading.addEventListener('click', () => {
    if (!bookmarkHeading._xCanNavigateRoot) {
      return;
    }
    navigateBookmarkFolder(bookmarkRootFolderId);
  });
  bookmarkHeading.addEventListener('keydown', (event) => {
    if (!bookmarkHeading._xCanNavigateRoot) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    navigateBookmarkFolder(bookmarkRootFolderId);
  });
  updateBookmarkPagerLabels();
  updateBookmarkBreadcrumb();
  const bookmarkGrid = document.createElement('div');
  bookmarkGrid.id = '_x_extension_newtab_bookmarks_grid_2024_unique_';
  bookmarkSection.appendChild(bookmarkHeader);
  bookmarkSection.appendChild(bookmarkGrid);
  let bookmarkRenderSignature = '';

  const recentSection = document.createElement('section');
  recentSection.id = '_x_extension_newtab_recent_sites_2024_unique_';
  recentSection.style.setProperty('display', 'none', 'important');
  recentSection.style.setProperty('margin', '0', 'important');
  recentSection.style.setProperty('width', '100%', 'important');
  recentSection.style.setProperty('pointer-events', 'auto', 'important');
  const recentHeading = document.createElement('div');
  recentHeading.className = 'x-nt-recent-heading';
  updateRecentHeading();
  const recentGrid = document.createElement('div');
  recentGrid.id = '_x_extension_newtab_recent_sites_grid_2024_unique_';
  recentSection.appendChild(recentHeading);
  recentSection.appendChild(recentGrid);
  let recentRenderSignature = '';
  const bottomDock = document.createElement('div');
  bottomDock.id = '_x_extension_newtab_bottom_dock_2024_unique_';
  bottomDock.style.cssText = `
    all: unset !important;
    position: fixed !important;
    left: 50% !important;
    bottom: 0 !important;
    transform: translateX(-50%) !important;
    width: min(96vw, 1040px) !important;
    max-height: calc(100vh - 240px) !important;
    display: none !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 32px !important;
    padding: 0 0 60px 0 !important;
    box-sizing: border-box !important;
    z-index: 2 !important;
    pointer-events: auto !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    overscroll-behavior: contain !important;
  `;

  bookmarkPagerPrevButton.addEventListener('click', () => {
    if (bookmarkCurrentPage <= 0) {
      return;
    }
    switchBookmarkPage(bookmarkCurrentPage - 1);
  });
  bookmarkPagerNextButton.addEventListener('click', () => {
    const pageCount = getBookmarkPageCount();
    if (bookmarkCurrentPage >= (pageCount - 1)) {
      return;
    }
    switchBookmarkPage(bookmarkCurrentPage + 1);
  });

  function getBookmarksSignature(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }
    return items.map((item, index) => {
      const id = item && item.id ? String(item.id) : '';
      const type = item && item.type ? String(item.type) : '';
      const title = item && item.title ? String(item.title) : '';
      const url = item && item.url ? String(item.url) : '';
      const themeUrl = item && item.themeUrl ? String(item.themeUrl) : '';
      return `${index}::${id}::${type}::${title}::${url}::${themeUrl}`;
    }).join('\n');
  }

  function getBookmarkCacheKey(item) {
    if (!item) {
      return '';
    }
    const id = item.id ? String(item.id) : '';
    const type = item.type ? String(item.type) : '';
    const title = item.title ? String(item.title) : '';
    const url = item.url ? String(item.url) : '';
    const themeUrl = item.themeUrl ? String(item.themeUrl) : '';
    return `${id}::${type}::${title}::${url}::${themeUrl}`;
  }

  function syncBookmarkCardElementCache(items) {
    // Keep cache across folder levels so entering subfolders does not reload favicons.
    // Soft-limit cache size to avoid unbounded growth.
    const MAX_CACHE_SIZE = 1500;
    if (bookmarkCardElementCache.size <= MAX_CACHE_SIZE) {
      return;
    }
    const keys = Array.from(bookmarkCardElementCache.keys());
    const removeCount = Math.max(1, bookmarkCardElementCache.size - MAX_CACHE_SIZE);
    for (let i = 0; i < removeCount && i < keys.length; i += 1) {
      bookmarkCardElementCache.delete(keys[i]);
    }
  }

  function getBookmarkPageCount() {
    const total = Array.isArray(bookmarkAllItems) ? bookmarkAllItems.length : 0;
    return Math.max(1, Math.ceil(total / BOOKMARK_LIMIT));
  }

  function getBookmarkPageItems() {
    if (!Array.isArray(bookmarkAllItems) || bookmarkAllItems.length === 0) {
      return [];
    }
    const pageCount = getBookmarkPageCount();
    bookmarkCurrentPage = Math.min(Math.max(0, bookmarkCurrentPage), pageCount - 1);
    const start = bookmarkCurrentPage * BOOKMARK_LIMIT;
    return bookmarkAllItems.slice(start, start + BOOKMARK_LIMIT);
  }

  function updateBookmarkPagerState() {
    if (!bookmarkPagerPrevButton || !bookmarkPagerNextButton) {
      return;
    }
    const pageCount = getBookmarkPageCount();
    const atStart = bookmarkCurrentPage <= 0;
    const atEnd = bookmarkCurrentPage >= (pageCount - 1);
    bookmarkPagerPrevButton.disabled = atStart;
    bookmarkPagerNextButton.disabled = atEnd;
    bookmarkPagerPrevButton.setAttribute('aria-disabled', atStart ? 'true' : 'false');
    bookmarkPagerNextButton.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
  }

  function updateBookmarkGridHeightLock() {
    if (!bookmarkGrid) {
      return;
    }
    const total = Array.isArray(bookmarkAllItems) ? bookmarkAllItems.length : 0;
    const cols = window.innerWidth <= 860 ? 2 : 4;
    const firstCard = bookmarkGrid.querySelector('.x-nt-bookmark-card');
    const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : 51;
    const gridStyle = window.getComputedStyle(bookmarkGrid);
    const rowGap = Number.parseFloat(gridStyle.rowGap) || 16;
    const isAtRoot = String(bookmarkCurrentFolderId || '') === String(bookmarkRootFolderId || '1');
    let targetItemCount = 0;

    if (isAtRoot) {
      if (total <= BOOKMARK_LIMIT) {
        bookmarkGrid.style.removeProperty('min-height');
        return;
      }
      targetItemCount = BOOKMARK_LIMIT;
    } else {
      if (bookmarkRootTotalCount > BOOKMARK_LIMIT) {
        targetItemCount = BOOKMARK_LIMIT;
      } else {
        targetItemCount = Math.max(0, bookmarkRootVisibleCount);
      }
      if (targetItemCount <= 0) {
        if (total <= BOOKMARK_LIMIT) {
          bookmarkGrid.style.removeProperty('min-height');
          return;
        }
        targetItemCount = BOOKMARK_LIMIT;
      }
    }

    const rowsPerPage = Math.max(1, Math.ceil(targetItemCount / cols));
    const minHeight = (rowsPerPage * cardHeight) + ((rowsPerPage - 1) * rowGap);
    bookmarkGrid.style.setProperty('min-height', `${Math.ceil(minHeight)}px`);
  }

  function renderCurrentBookmarkPage() {
    renderBookmarks(getBookmarkPageItems());
    updateBookmarkPagerState();
  }

  function switchBookmarkPage(nextPage) {
    const pageCount = getBookmarkPageCount();
    const targetPage = Math.min(Math.max(0, Number(nextPage) || 0), pageCount - 1);
    if (targetPage === bookmarkCurrentPage) {
      return;
    }
    if (bookmarkPageAnimating) {
      return;
    }
    if (!bookmarkGrid) {
      bookmarkCurrentPage = targetPage;
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      return;
    }
    const direction = targetPage > bookmarkCurrentPage ? 1 : -1;
    const offsetPx = 34;
    const durationMs = 220;
    const fadeBlurDurationMs = 150;
    const colStaggerMs = 24;
    const rowStaggerMs = 10;
    const randomJitterRangeMs = 6;
    const handoffOverlapMs = 70;
    const cols = window.innerWidth <= 860 ? 2 : 4;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    bookmarkPageAnimating = true;
    const getCards = () => Array.from(bookmarkGrid.children || []);
    const getDelayByIndex = (card, index, pageSeed) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const seedText = `${pageSeed || 0}|${index}|${card && card._xTitleText ? card._xTitleText : ''}`;
      const seed = Math.abs(stableHashCode(seedText));
      const jitter = (seed % (randomJitterRangeMs * 2 + 1)) - randomJitterRangeMs;
      return Math.max(0, (col * colStaggerMs) + (row * rowStaggerMs) + jitter);
    };

    const cleanupCards = (cards) => {
      cards.forEach((card) => {
        card.style.removeProperty('transition');
        card.style.removeProperty('transform');
        card.style.removeProperty('opacity');
        card.style.removeProperty('filter');
        card.style.removeProperty('will-change');
      });
    };

    const cleanup = (cards) => {
      cleanupCards(cards);
      bookmarkPageAnimating = false;
    };

    const enterNextPage = () => {
      bookmarkCurrentPage = targetPage;
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      const nextCards = getCards();
      if (nextCards.length === 0) {
        cleanup(nextCards);
        return;
      }
      nextCards.forEach((card, index) => {
        card.style.setProperty('will-change', 'transform, opacity, filter');
        card.style.setProperty('transition', 'none');
        card.style.setProperty('opacity', '0');
        card.style.setProperty('filter', 'blur(5px)');
        card.style.setProperty('transform', `translateX(${direction * offsetPx}px)`);
      });
      void bookmarkGrid.offsetHeight;
      let maxInDelay = 0;
      nextCards.forEach((card, index) => {
        const delay = getDelayByIndex(card, index, targetPage);
        if (delay > maxInDelay) {
          maxInDelay = delay;
        }
        card.style.setProperty(
          'transition',
          `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeBlurDurationMs}ms ${easing} ${delay}ms, filter ${fadeBlurDurationMs}ms ${easing} ${delay}ms`
        );
        card.style.setProperty('opacity', '1');
        card.style.setProperty('filter', 'blur(0px)');
        card.style.setProperty('transform', 'translateX(0)');
      });
      const inTotalMs = durationMs + maxInDelay;
      window.setTimeout(() => cleanup(nextCards), inTotalMs + 20);
    };

    const currentCards = getCards();
    if (currentCards.length === 0) {
      enterNextPage();
      return;
    }
    let maxOutDelay = 0;
    currentCards.forEach((card, index) => {
      const delay = getDelayByIndex(card, index, bookmarkCurrentPage);
      if (delay > maxOutDelay) {
        maxOutDelay = delay;
      }
      card.style.setProperty('will-change', 'transform, opacity, filter');
      card.style.setProperty(
        'transition',
        `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeBlurDurationMs}ms ${easing} ${delay}ms, filter ${fadeBlurDurationMs}ms ${easing} ${delay}ms`
      );
      card.style.setProperty('opacity', '0');
      card.style.setProperty('filter', 'blur(5px)');
      card.style.setProperty('transform', `translateX(${direction * -offsetPx}px)`);
    });
    const outTotalMs = durationMs + maxOutDelay;
    const handoffDelayMs = Math.max(0, outTotalMs - handoffOverlapMs);
    window.setTimeout(() => {
      cleanupCards(currentCards);
      enterNextPage();
    }, handoffDelayMs);
  }

  function updateBookmarkSectionPosition() {
    if (!document.body || !bookmarkSection || !recentSection || !bottomDock) {
      return;
    }
    const bottomDockMaxHeight = Math.max(0, window.innerHeight - 240);
    const bookmarkVisible = bookmarkSection.style.getPropertyValue('display') !== 'none';
    const recentVisible = recentSection.style.getPropertyValue('display') !== 'none';
    document.body.classList.remove('x-nt-stack-layout');
    document.body.classList.add('x-nt-bottom-layout');
    document.body.classList.toggle('x-nt-no-bookmarks', !bookmarkVisible);
    bottomDock.style.setProperty('max-height', `${bottomDockMaxHeight}px`, 'important');
    bottomDock.style.setProperty('display', (bookmarkVisible || recentVisible) ? 'flex' : 'none', 'important');
    updateSuggestionsFloatingLayout();
  }

  function renderBookmarks(items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const nextSignature = `${bookmarkCurrentFolderId}##${getBookmarksSignature(normalizedItems)}`;
    const isAtRoot = String(bookmarkCurrentFolderId || '') === String(bookmarkRootFolderId || '1');
    const appendEmptyFolderState = () => {
      const emptyState = document.createElement('div');
      emptyState.className = 'x-nt-bookmark-empty';
      emptyState.innerHTML = `${getRiSvg('ri-file-3-line', 'ri-size-16')}<span>${t('bookmarks_empty_folder', '暂无内容')}</span>`;
      bookmarkGrid.appendChild(emptyState);
    };
    if (nextSignature === bookmarkRenderSignature) {
      if (normalizedItems.length === 0) {
        if (isAtRoot) {
          bookmarkSection.style.setProperty('display', 'none', 'important');
        } else {
          bookmarkSection.style.setProperty('display', 'flex', 'important');
          bookmarkGrid.innerHTML = '';
          appendEmptyFolderState();
        }
      } else {
        bookmarkSection.style.setProperty('display', 'flex', 'important');
        updateBookmarkGridHeightLock();
        updateBookmarkSectionPosition();
      }
      updateBookmarkPagerState();
      return;
    }
    bookmarkRenderSignature = nextSignature;
    bookmarkGrid.innerHTML = '';
    bookmarkCards.length = 0;
    if (normalizedItems.length === 0) {
      if (isAtRoot) {
        bookmarkSection.style.setProperty('display', 'none', 'important');
      } else {
        bookmarkSection.style.setProperty('display', 'flex', 'important');
        appendEmptyFolderState();
      }
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
      updateBookmarkPagerState();
      return;
    }
    normalizedItems.forEach((item, index) => {
      const cacheKey = getBookmarkCacheKey(item);
      let card = cacheKey ? bookmarkCardElementCache.get(cacheKey) : null;
      if (!card) {
        card = buildBookmarkCard(item, index);
        if (card && cacheKey) {
          bookmarkCardElementCache.set(cacheKey, card);
        }
      }
      if (card) {
        bookmarkGrid.appendChild(card);
      }
    });
    bookmarkSection.style.setProperty('display', 'flex', 'important');
    updateBookmarkPagerState();
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  }

  function getRecentSitesSignature(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }
    return items.map((item, index) => {
      const url = item && item.url ? String(item.url) : '';
      const title = item && item.title ? String(item.title) : '';
      const siteName = item && item.siteName ? String(item.siteName) : '';
      const lastVisitTime = item && item.lastVisitTime ? String(item.lastVisitTime) : '';
      const visitCount = item && item.visitCount ? String(item.visitCount) : '';
      return `${index}::${url}::${title}::${siteName}::${lastVisitTime}::${visitCount}`;
    }).join('\n');
  }

  function renderRecentSites(items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const nextSignature = getRecentSitesSignature(normalizedItems);
    if (nextSignature === recentRenderSignature) {
      if (normalizedItems.length === 0) {
        recentSection.style.setProperty('display', 'none', 'important');
      } else {
        recentSection.style.setProperty('display', 'flex', 'important');
      }
      updateBookmarkSectionPosition();
      return;
    }
    recentRenderSignature = nextSignature;
    recentGrid.innerHTML = '';
    recentCards.length = 0;
    if (normalizedItems.length === 0) {
      recentSection.style.setProperty('display', 'none', 'important');
      updateBookmarkSectionPosition();
      return;
    }
    normalizedItems.forEach((item, index) => {
      const card = buildRecentSiteCard(item, index);
      if (card) {
        recentGrid.appendChild(card);
      }
    });
    recentSection.style.setProperty('display', 'flex', 'important');
    updateBookmarkSectionPosition();
  }

  function loadBookmarks() {
    getTopBookmarks(0, bookmarkCurrentFolderId).then((items) => {
      bookmarkAllItems = Array.isArray(items) ? items : [];
      const isAtRoot = String(bookmarkCurrentFolderId || '') === String(bookmarkRootFolderId || '1');
      if (isAtRoot) {
        bookmarkRootTotalCount = bookmarkAllItems.length;
        bookmarkRootVisibleCount = Math.min(BOOKMARK_LIMIT, bookmarkAllItems.length);
      }
      syncBookmarkCardElementCache(bookmarkAllItems);
      const pageCount = getBookmarkPageCount();
      if (bookmarkCurrentPage > (pageCount - 1)) {
        bookmarkCurrentPage = pageCount - 1;
      }
      if (bookmarkCurrentPage < 0) {
        bookmarkCurrentPage = 0;
      }
      updateBookmarkBreadcrumb();
      renderCurrentBookmarkPage();
    });
  }

  function loadRecentSites() {
    if (!currentRecentCount || currentRecentCount <= 0) {
      recentRenderSignature = '';
      recentCards.length = 0;
      recentGrid.innerHTML = '';
      recentSection.style.setProperty('display', 'none', 'important');
      updateBookmarkSectionPosition();
      return;
    }
    getRecentSites(currentRecentCount, currentRecentMode).then((items) => {
      renderRecentSites(items);
    });
  }

  function handleRecentVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadRecentSites();
      loadBookmarks();
      updateBookmarkSectionPosition();
    }
  }

  function forceReloadRecentSitesForI18n() {
    recentRenderSignature = '';
    bookmarkRenderSignature = '';
    loadRecentSites();
    loadBookmarks();
  }

  function setSuggestionsVisible(visible) {
    if (visible) {
      updateSuggestionsFloatingLayout();
    }
    if (searchLayer) {
      searchLayer.style.setProperty('z-index', visible ? '20' : '12', 'important');
      searchLayer.style.setProperty('border-radius', visible ? '24px' : '24px', 'important');
      searchLayer.style.setProperty('background', visible
        ? 'var(--x-nt-suggestions-bg, rgba(255, 255, 255, 0.96))'
        : 'var(--x-nt-input-bg, rgba(255, 255, 255, 0.9))', 'important');
      searchLayer.style.setProperty('border', visible
        ? '1px solid transparent'
        : '1px solid var(--x-nt-input-border, rgba(0, 0, 0, 0.06))', 'important');
      searchLayer.style.setProperty('box-shadow', visible
        ? 'none'
        : 'var(--x-nt-input-shadow, 0 20px 60px rgba(0, 0, 0, 0.08))', 'important');
    }
    if (inputParts && inputParts.container) {
      inputParts.container.style.setProperty('border-radius', '0', 'important');
      inputParts.container.style.setProperty('border', 'none', 'important');
      inputParts.container.style.setProperty('border-bottom', 'none', 'important');
      inputParts.container.style.setProperty('box-shadow', 'none', 'important');
      inputParts.container.style.setProperty('background', 'transparent', 'important');
      inputParts.container.style.setProperty('z-index', '2', 'important');
    }
    if (inputParts && inputParts.divider) {
      inputParts.divider.style.setProperty('display', 'none', 'important');
      inputParts.divider.style.setProperty('opacity', '0', 'important');
    }
    suggestionsContainer.style.setProperty('display', visible ? 'block' : 'none', 'important');
    suggestionsContainer.style.setProperty('margin-top', visible ? '10px' : '0', 'important');
    suggestionsContainer.style.setProperty('opacity', visible ? '1' : '0', 'important');
    suggestionsContainer.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
    suggestionsContainer.style.setProperty('pointer-events', visible ? 'auto' : 'none', 'important');
    suggestionsContainer.style.setProperty('transform', visible ? 'translateY(0)' : 'translateY(-4px)', 'important');
    suggestionsContainer.style.setProperty('border', 'none', 'important');
    suggestionsContainer.style.setProperty('border-top', 'none', 'important');
    suggestionsContainer.style.setProperty('border-radius', '0', 'important');
    suggestionsContainer.style.setProperty('box-shadow', 'none', 'important');
  }

  function updateSuggestionsFloatingLayout() {
    if (!suggestionsContainer || !inputParts || !inputParts.container) {
      return;
    }
    const anchor = inputParts.container;
    const anchorRect = anchor.getBoundingClientRect();
    const dropdownTopViewport = anchorRect.bottom - 1;
    const available = window.innerHeight - dropdownTopViewport - 14;
    const maxHeight = Math.max(120, Math.floor(available));
    suggestionsContainer.style.setProperty('max-height', `${maxHeight}px`, 'important');
  }

  function isEnglishQuery(query) {
    if (!query) {
      return false;
    }
    if (!/[A-Za-z]/.test(query)) {
      return false;
    }
    return /^[A-Za-z0-9\s._/-]+$/.test(query);
  }

  function getUrlDisplay(url) {
    if (!url) {
      return '';
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
    } catch (e) {
      return url;
    }
  }

  function isRestrictedUrl(url) {
    if (!url) {
      return true;
    }
    const lower = String(url).toLowerCase();
    if (lower.startsWith('chrome://') ||
      lower.startsWith('chrome-extension://') ||
      lower.startsWith('edge://') ||
      lower.startsWith('brave://') ||
      lower.startsWith('vivaldi://') ||
      lower.startsWith('opera://') ||
      lower.startsWith('about:')) {
      return true;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      if ((host === 'chrome.google.com' && path.startsWith('/webstore')) ||
          host === 'chromewebstore.google.com' ||
          (host === 'microsoftedge.microsoft.com' && path.startsWith('/addons')) ||
          host === 'addons.opera.com') {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
  }

  function getChromeFaviconUrl(url) {
    if (!url) {
      return '';
    }
    if (location && location.protocol === 'chrome-extension:') {
      return '';
    }
    return `chrome://favicon2/?size=128&scale_factor=2x&show_fallback_monogram=1&url=${encodeURIComponent(url)}`;
  }

  function getGoogleFaviconUrl(hostname) {
    const normalized = normalizeFaviconHost(hostname);
    if (!normalized) {
      return '';
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalized)}&sz=${FAVICON_GOOGLE_SIZE}`;
  }

  function isLocalNetworkHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) {
      return false;
    }
    if (host === 'localhost' || host.endsWith('.local')) {
      return true;
    }
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      const parts = host.split('.').map((part) => Number(part));
      if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return false;
      }
      if (parts[0] === 10 || parts[0] === 127) {
        return true;
      }
      if (parts[0] === 192 && parts[1] === 168) {
        return true;
      }
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        return true;
      }
      return false;
    }
    return false;
  }

  function attachFaviconWithFallbacks(img, url, host) {
    if (!img || !url) {
      return;
    }
    const hostKey = host || getHostFromUrl(url);
    if (isLocalNetworkHost(hostKey)) {
      applyFallbackIcon(img);
      return;
    }
    const faviconHostKey = normalizeFaviconHost(hostKey);
    const chromeFavicon = getChromeFaviconUrl(url);
    const siteSvgFavicon = faviconHostKey ? `https://${faviconHostKey}/favicon.svg` : '';
    const siteIcoFavicon = faviconHostKey ? `https://${faviconHostKey}/favicon.ico` : '';
    const googleFavicon = faviconHostKey ? getGoogleFaviconUrl(faviconHostKey) : '';
    const fallbackCandidates = [chromeFavicon, googleFavicon, siteSvgFavicon, siteIcoFavicon].filter(Boolean);
    const quickSrc = fallbackCandidates[0] || '';
    const tried = new Set();
    const trySetDirect = (nextSrc) => {
      if (!nextSrc || !img) {
        return false;
      }
      if (tried.has(nextSrc)) {
        return false;
      }
      tried.add(nextSrc);
      setFaviconSrcWithAnimation(img, nextSrc);
      if (nextSrc === googleFavicon) {
        attachFaviconData(img, googleFavicon, hostKey);
      }
      return true;
    };
    if (!trySetDirect(quickSrc)) {
      applyFallbackIcon(img);
      return;
    }
    img.onerror = function() {
      const nextFallback = fallbackCandidates.find((candidate) => !tried.has(candidate));
      if (!trySetDirect(nextFallback)) {
        applyFallbackIcon(img);
      }
    };

    // Improve icon quality in background without blocking first paint.
    const tryUpgradeCandidates = (candidateUrls) => {
      const unique = Array.from(new Set((candidateUrls || []).filter(Boolean)));
      const upgrades = unique.filter((candidate) => candidate && candidate !== img.src);
      if (upgrades.length === 0) {
        return;
      }
      const loadNext = (index) => {
        if (!img || !img.isConnected || index >= upgrades.length) {
          return;
        }
        const candidate = upgrades[index];
        const probe = new Image();
        probe.referrerPolicy = 'no-referrer';
        probe.onload = () => {
          if (!img || !img.isConnected) {
            return;
          }
          setFaviconSrcWithAnimation(img, candidate);
          if (candidate === googleFavicon) {
            attachFaviconData(img, googleFavicon, hostKey);
          }
        };
        probe.onerror = () => {
          loadNext(index + 1);
        };
        probe.src = candidate;
      };
      loadNext(0);
    };
    chrome.runtime.sendMessage(
      { action: 'resolveFaviconCandidates', url: url, host: hostKey, fallbackUrl: '' },
      (response) => {
        const resolved = response && Array.isArray(response.urls) ? response.urls : [];
        tryUpgradeCandidates([...resolved, ...fallbackCandidates]);
      }
    );
  }

  function getRecentSites(limit, mode) {
    return new Promise((resolve) => {
      function loadLatestRecentSites() {
        if (!chrome.history || !chrome.history.search) {
          resolve([]);
          return;
        }
        chrome.history.search({
          text: '',
          maxResults: 60,
          startTime: Date.now() - 1000 * 60 * 60 * 24 * 30
        }, (items) => {
          if (chrome.runtime.lastError || !Array.isArray(items)) {
            resolve([]);
            return;
          }
          const results = [];
          const seenHosts = new Set();
          for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const url = item && item.url ? String(item.url) : '';
            if (!url || isRestrictedUrl(url)) {
              continue;
            }
            let host = '';
            try {
              host = normalizeHost(new URL(url).hostname);
            } catch (e) {
              continue;
            }
            if (!host || seenHosts.has(host)) {
              continue;
            }
            seenHosts.add(host);
            results.push({
              title: item.title || host,
              url: url,
              host: host,
              lastVisitTime: item.lastVisitTime || 0
            });
            if (results.length >= limit) {
              break;
            }
          }
          if (results.length >= limit || !chrome.topSites || !chrome.topSites.get) {
            resolve(results);
            return;
          }
          chrome.topSites.get((topSites) => {
            if (!Array.isArray(topSites)) {
              resolve(results);
              return;
            }
            for (let i = 0; i < topSites.length; i += 1) {
              const item = topSites[i];
              const url = item && item.url ? String(item.url) : '';
              if (!url || isRestrictedUrl(url)) {
                continue;
              }
              let host = '';
              try {
                host = normalizeHost(new URL(url).hostname);
              } catch (e) {
                continue;
              }
              if (!host || seenHosts.has(host)) {
                continue;
              }
              seenHosts.add(host);
              results.push({
                title: item.title || host,
                url: url,
                host: host,
                lastVisitTime: 0
              });
              if (results.length >= limit) {
                break;
              }
            }
            resolve(results);
          });
        });
      }

      const viewMode = mode === 'most' ? 'most' : 'latest';
      if (viewMode === 'most') {
        if (!chrome.topSites || !chrome.topSites.get) {
          loadLatestRecentSites();
          return;
        }
        chrome.topSites.get((topSites) => {
          if (!Array.isArray(topSites)) {
            loadLatestRecentSites();
            return;
          }
          const results = [];
          const seenHosts = new Set();
          for (let i = 0; i < topSites.length; i += 1) {
            const item = topSites[i];
            const url = item && item.url ? String(item.url) : '';
            if (!url || isRestrictedUrl(url)) {
              continue;
            }
            let host = '';
            try {
              host = normalizeHost(new URL(url).hostname);
            } catch (e) {
              continue;
            }
            if (!host || seenHosts.has(host)) {
              continue;
            }
            seenHosts.add(host);
            results.push({
              title: item.title || host,
              url: url,
              host: host,
              lastVisitTime: 0,
              visitCount: 0
            });
            if (results.length >= limit) {
              break;
            }
          }
          if (results.length === 0) {
            loadLatestRecentSites();
            return;
          }
          resolve(results);
        });
        return;
      }

      loadLatestRecentSites();
    });
  }

  function findBookmarksBarNode(treeNodes) {
    if (!Array.isArray(treeNodes)) {
      return null;
    }
    for (let i = 0; i < treeNodes.length; i += 1) {
      const root = treeNodes[i];
      const rootChildren = Array.isArray(root && root.children) ? root.children : [];
      const directMatch = rootChildren.find((child) => String(child && child.id || '') === '1');
      if (directMatch) {
        return directMatch;
      }
      for (let j = 0; j < rootChildren.length; j += 1) {
        const child = rootChildren[j];
        const title = String(child && child.title || '').toLowerCase();
        if (title === 'bookmarks bar' || title === '书签栏' || title === '書籤列') {
          return child;
        }
      }
    }
    return null;
  }

  function findFirstUrlInFolder(node) {
    if (!node) {
      return '';
    }
    const directUrl = node && node.url ? String(node.url) : '';
    if (directUrl) {
      return directUrl;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = 0; i < children.length; i += 1) {
      const nested = findFirstUrlInFolder(children[i]);
      if (nested) {
        return nested;
      }
    }
    return '';
  }

  function collectFolderUrls(node, limit, collected, seen) {
    if (!node || collected.length >= limit) {
      return;
    }
    const nodeUrl = node && node.url ? String(node.url) : '';
    if (nodeUrl && !seen.has(nodeUrl)) {
      seen.add(nodeUrl);
      collected.push(nodeUrl);
      if (collected.length >= limit) {
        return;
      }
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = 0; i < children.length; i += 1) {
      collectFolderUrls(children[i], limit, collected, seen);
      if (collected.length >= limit) {
        break;
      }
    }
  }

  function buildBookmarkNodeMap(nodes) {
    bookmarkNodeMap.clear();
    const walk = (node, parentId) => {
      if (!node) {
        return;
      }
      const nodeId = String(node.id || '');
      if (nodeId) {
        node.parentId = node.parentId || parentId || '';
        bookmarkNodeMap.set(nodeId, node);
      }
      const children = Array.isArray(node.children) ? node.children : [];
      for (let i = 0; i < children.length; i += 1) {
        walk(children[i], nodeId);
      }
    };
    const rootNodes = Array.isArray(nodes) ? nodes : [];
    for (let i = 0; i < rootNodes.length; i += 1) {
      walk(rootNodes[i], '');
    }
  }

  function buildBookmarkFolderPath(folderId) {
    const rootLabel = t('bookmarks_heading', '书签');
    const rootId = String(bookmarkRootFolderId || '1');
    const targetId = String(folderId || rootId);
    const path = [{ id: rootId, title: rootLabel }];
    if (targetId === rootId) {
      return path;
    }
    const chain = [];
    let cursor = bookmarkNodeMap.get(targetId);
    let guard = 0;
    while (cursor && guard < 64) {
      const cursorId = String(cursor.id || '');
      if (!cursorId || cursorId === rootId) {
        break;
      }
      chain.push({
        id: cursorId,
        title: String(cursor.title || '').trim() || rootLabel
      });
      const parentId = String(cursor.parentId || '');
      cursor = parentId ? bookmarkNodeMap.get(parentId) : null;
      guard += 1;
    }
    chain.reverse().forEach((item) => path.push(item));
    return path;
  }

  function getTopBookmarks(limit, folderId) {
    return new Promise((resolve) => {
      const parsedLimit = Number.parseInt(limit, 10);
      const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
      if (!chrome.bookmarks || !chrome.bookmarks.getTree) {
        bookmarkFolderPath = [{ id: '1', title: t('bookmarks_heading', '书签') }];
        resolve([]);
        return;
      }
      chrome.bookmarks.getTree((nodes) => {
        if (chrome.runtime.lastError || !Array.isArray(nodes) || nodes.length === 0) {
          bookmarkFolderPath = [{ id: '1', title: t('bookmarks_heading', '书签') }];
          resolve([]);
          return;
        }
        buildBookmarkNodeMap(nodes);
        const barNode = findBookmarksBarNode(nodes);
        if (!barNode) {
          bookmarkFolderPath = [{ id: '1', title: t('bookmarks_heading', '书签') }];
          resolve([]);
          return;
        }
        bookmarkRootFolderId = String(barNode.id || '1');
        const targetFolderId = String(folderId || bookmarkCurrentFolderId || bookmarkRootFolderId);
        const targetNode = bookmarkNodeMap.get(targetFolderId) || barNode;
        bookmarkCurrentFolderId = String(targetNode.id || bookmarkRootFolderId);
        bookmarkFolderPath = buildBookmarkFolderPath(bookmarkCurrentFolderId);

        const children = Array.isArray(targetNode.children) ? targetNode.children : [];
        const results = [];
        const seenUrls = new Set();
        for (let index = 0; index < children.length; index += 1) {
          if (safeLimit > 0 && results.length >= safeLimit) {
            break;
          }
          const item = children[index];
          if (!item) {
            continue;
          }
          const title = String(item.title || '').trim();
          const url = item.url ? String(item.url) : '';
          const itemChildren = Array.isArray(item.children) ? item.children : [];
          if (url) {
            if (seenUrls.has(url)) {
              continue;
            }
            let host = '';
            try {
              host = normalizeHost(new URL(url).hostname);
            } catch (error) {
              host = '';
            }
            seenUrls.add(url);
            results.push({
              id: String(item.id || ''),
              type: 'bookmark',
              title: title,
              url: url,
              host: host,
              themeUrl: url
            });
            continue;
          }
          const themeUrl = findFirstUrlInFolder(item);
          const previewUrls = [];
          collectFolderUrls(item, 4, previewUrls, new Set());
          let host = '';
          if (themeUrl) {
            try {
              host = normalizeHost(new URL(themeUrl).hostname);
            } catch (error) {
              host = '';
            }
          }
          results.push({
            id: String(item.id || ''),
            type: 'folder',
            title: title,
            url: '',
            host: host,
            childCount: itemChildren.length,
            themeUrl: themeUrl,
            previewUrls: previewUrls
          });
        }
        resolve(safeLimit > 0 ? results.slice(0, safeLimit) : results);
      });
    });
  }

  function getSiteDisplayName(hostname, title) {
    const rawTitle = String(title || '').trim();
    const host = String(hostname || '').toLowerCase().replace(/^(www|m)\./i, '');
    const brandMap = {
      'github.com': 'GitHub',
      'youtube.com': 'YouTube',
      'google.com': 'Google',
      'mp.weixin.qq.com': t('site_brand_wechat_official', '微信公众号'),
      'weibo.com': '微博',
      'x.com': 'X',
      'twitter.com': 'X',
      'immersivetranslate.com': 'Immersive Translate',
      'abouttrans.info': 'aboutTrans',
      'aboutrans.info': 'aboutTrans'
    };
    const suffixes = new Set([
      'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
      'com.cn', 'net.cn', 'org.cn', 'gov.cn',
      'com.hk', 'com.tw', 'com.au', 'com.sg',
      'co.jp', 'co.kr'
    ]);
    const noisySubdomains = new Set([
      'onboarding', 'login', 'signin', 'auth', 'account',
      'web', 'app', 'admin', 'stage', 'staging', 'preview', 'dev'
    ]);
    const separators = [' | ', ' - ', ' — ', ' – ', ' · ', ' • ', '：', ':'];

    function getPrimaryLabelFromHost(hostValue) {
      if (!hostValue) {
        return '';
      }
      const parts = hostValue.split('.').filter(Boolean);
      if (parts.length === 0) {
        return '';
      }
      if (parts.length === 1) {
        return parts[0];
      }
      const tail2 = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      const index = suffixes.has(tail2) && parts.length >= 3 ? parts.length - 3 : parts.length - 2;
      return parts[index] || parts[0];
    }

    function prettifyLabel(label) {
      const value = String(label || '').trim();
      if (!value) {
        return '';
      }
      if (value.length === 1) {
        return value.toUpperCase();
      }
      if (/^[a-z]+$/.test(value)) {
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
      return value;
    }

    function pickTitleCandidate() {
      if (!rawTitle) {
        return '';
      }
      const candidates = [rawTitle];
      separators.forEach((sep) => {
        if (rawTitle.includes(sep)) {
          rawTitle.split(sep).forEach((part) => candidates.push(part));
        }
      });
      let best = '';
      let bestScore = -1;
      candidates.forEach((part) => {
        const value = String(part || '').trim();
        if (!value || value.length < 2 || value.length > 24) {
          return;
        }
        if (/https?:|\/|\\|\?|=|&/.test(value)) {
          return;
        }
        if (/^\d+$/.test(value)) {
          return;
        }
        let score = 0;
        if (/[\u4e00-\u9fff]/.test(value)) {
          score += 2;
        }
        if (/\s/.test(value)) {
          score += 1;
        }
        if (value.length >= 3 && value.length <= 14) {
          score += 1;
        }
        if (score > bestScore) {
          best = value;
          bestScore = score;
        }
      });
      return best;
    }

    function normalizeWordToken(value) {
      return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }

    function pickCasedLabelFromTitle(hostLabelRaw) {
      const raw = String(hostLabelRaw || '').trim();
      if (!raw || !rawTitle) {
        return '';
      }
      const target = normalizeWordToken(raw);
      if (!target) {
        return '';
      }
      const candidates = [rawTitle];
      separators.forEach((sep) => {
        if (rawTitle.includes(sep)) {
          rawTitle.split(sep).forEach((part) => candidates.push(part));
        }
      });
      for (let i = 0; i < candidates.length; i += 1) {
        const token = String(candidates[i] || '').trim();
        if (!token) {
          continue;
        }
        if (normalizeWordToken(token) === target) {
          return token;
        }
      }
      const words = rawTitle.split(/[\s|—–\-·•:：()（）\[\]【】]+/).map((part) => String(part || '').trim()).filter(Boolean);
      for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        if (normalizeWordToken(word) === target) {
          return word;
        }
      }
      return '';
    }

    function isWeakHostLabel(label) {
      const value = String(label || '').trim().toLowerCase();
      if (!value) {
        return true;
      }
      if (value.length <= 1 || /^\d+$/.test(value)) {
        return true;
      }
      return noisySubdomains.has(value);
    }

    if (host) {
      if (brandMap[host]) {
        return brandMap[host];
      }
      const matchedBrandHost = Object.keys(brandMap).find((key) => host === key || host.endsWith(`.${key}`));
      if (matchedBrandHost) {
        return brandMap[matchedBrandHost];
      }
      const primaryHostLabel = getPrimaryLabelFromHost(host);
      const casedFromTitle = pickCasedLabelFromTitle(primaryHostLabel);
      const hostLabel = casedFromTitle || prettifyLabel(primaryHostLabel);
      const titleCandidate = pickTitleCandidate();
      const firstSubdomain = host.split('.').filter(Boolean)[0] || '';
      if (noisySubdomains.has(firstSubdomain) && titleCandidate) {
        return titleCandidate;
      }
      if (isWeakHostLabel(hostLabel) && titleCandidate) {
        return titleCandidate;
      }
      if (hostLabel) {
        return hostLabel;
      }
      if (titleCandidate) {
        return titleCandidate;
      }
    }
    return rawTitle || hostname || '';
  }

  function getRecentCardColors(theme, host) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.1);
    const innerTint = mixColor(accentRgb, [255, 255, 255], 0.82);
    return {
      base: rgbToCss(base),
      border: rgbToCss(border),
      innerTint: rgbToCssParts(innerTint)
    };
  }

  function applyRecentCardTheme(card, theme, host) {
    if (!card) {
      return;
    }
    const colors = getRecentCardColors(theme, host);
    card.style.setProperty('--x-nt-recent-card-color', colors.base);
    card.style.setProperty('--x-nt-recent-card-border-color', colors.border);
    card.style.setProperty('--x-nt-recent-inner-tint-rgb', colors.innerTint);
  }

  function getBookmarkCardColors(theme, host) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [24, 24, 24] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.9 : 0.94);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.07);
    const icon = mixColor(accentRgb, baseTarget, isDark ? 0.92 : 0.96);
    const shadow = isDark
      ? mixColor(accentRgb, [18, 26, 40], 0.62)
      : mixColor(accentRgb, [138, 146, 160], 0.46);
    return {
      base: rgbToCss(base),
      border: rgbToCss(border),
      iconBg: rgbToCss(icon),
      shadowRgb: rgbToCssParts(shadow)
    };
  }

  function applyBookmarkCardTheme(card, theme, host) {
    if (!card) {
      return;
    }
    if (card._xNoThemeTint) {
      card.style.removeProperty('--x-nt-bookmark-card-color');
      card.style.removeProperty('--x-nt-bookmark-card-border-color');
      card.style.removeProperty('--x-nt-bookmark-icon-color');
      const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
      card.style.setProperty('--x-nt-bookmark-shadow-rgb', isDark ? '52, 96, 180' : '86, 138, 220');
      return;
    }
    const colors = getBookmarkCardColors(theme, host);
    card.style.setProperty('--x-nt-bookmark-card-color', colors.base);
    card.style.setProperty('--x-nt-bookmark-card-border-color', colors.border);
    card.style.setProperty('--x-nt-bookmark-icon-color', colors.iconBg);
    card.style.setProperty('--x-nt-bookmark-shadow-rgb', colors.shadowRgb);
  }

  function updateRecentActionOffset(card, actionLine) {
    if (!card || !actionLine) {
      return;
    }
    const update = () => {
      if (!card.isConnected) {
        return;
      }
      const width = Math.ceil(actionLine.getBoundingClientRect().width);
      card.style.setProperty('--x-nt-recent-action-offset', `${width}px`);
    };
    requestAnimationFrame(update);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update).catch(() => {});
    }
    recentActionOffsetUpdaters.add(update);
    if (!recentActionResizeBound) {
      recentActionResizeBound = true;
      window.addEventListener('resize', () => {
        recentActionOffsetUpdaters.forEach((handler) => handler());
      });
    }
    if (!recentActionObservers.has(actionLine)) {
      const mutationObserver = new MutationObserver(() => update());
      mutationObserver.observe(actionLine, {
        childList: true,
        characterData: true,
        subtree: true
      });
      let resizeObserver = null;
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => update());
        resizeObserver.observe(actionLine);
      }
      recentActionObservers.set(actionLine, { mutationObserver, resizeObserver });
    }
  }

  function buildRecentSiteCard(item, index) {
    if (!item || !item.url) {
      return null;
    }
    const host = item.host || getHostFromUrl(item.url) || '';
    const siteName = getSiteDisplayName(host, item.title);
    const titleText = item.title || siteName || item.url;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'x-nt-recent-card';
    card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
      title: titleText
    }));
    card._xHost = host;
    const themeSuggestion = { type: 'history', url: item.url, title: item.title || '' };
    const immediateTheme = getImmediateThemeForSuggestion(themeSuggestion);
    card._xTheme = immediateTheme;
    applyRecentCardTheme(card, immediateTheme, host);
    getThemeForSuggestion(themeSuggestion).then((theme) => {
      if (card.isConnected) {
        card._xTheme = theme || card._xTheme;
        applyRecentCardTheme(card, theme, host);
      }
    });

    const inner = document.createElement('div');
    inner.className = 'x-nt-recent-inner';
    const header = document.createElement('div');
    header.className = 'x-nt-recent-header';
    const faviconImage = document.createElement('img');
    faviconImage.className = 'x-nt-recent-favicon';
    faviconImage.alt = siteName || t('site_icon_alt', '站点');
    const eagerCount = Math.min(6, currentRecentCount);
    const shouldEager = index < eagerCount;
    faviconImage.loading = shouldEager ? 'eager' : 'lazy';
    if (shouldEager) {
      faviconImage.fetchPriority = 'high';
    }
    attachFaviconWithFallbacks(faviconImage, item.url, host);
    faviconImage.onerror = function() {
      reportMissingIcon('recent', item.url, faviconImage.src);
      applyFallbackIcon(faviconImage);
    };
    const name = document.createElement('div');
    name.className = 'x-nt-recent-name';
    name.textContent = siteName;
    name.title = siteName;
    header.appendChild(faviconImage);
    header.appendChild(name);

    const title = document.createElement('div');
    title.className = 'x-nt-recent-title';
    title.textContent = titleText;
    title.title = titleText;

    const urlLine = document.createElement('div');
    urlLine.className = 'x-nt-recent-url';
    urlLine.textContent = getUrlDisplay(item.url);
    urlLine.title = item.url;

    const actionLine = document.createElement('div');
    actionLine.className = 'x-nt-recent-action';
    const actionText = document.createElement('span');
    actionText.textContent = t('visit_label', '访问');
    actionLine.appendChild(actionText);
    const actionIcon = document.createElement('span');
    actionIcon.innerHTML = getRiSvg('ri-arrow-right-line', 'ri-size-12');
    actionLine.appendChild(actionIcon);
    card._xActionText = actionText;
    card._xTitleText = titleText;

    inner.appendChild(header);
    inner.appendChild(title);
    card.appendChild(inner);
    card.appendChild(urlLine);
    card.appendChild(actionLine);
    updateRecentActionOffset(card, actionLine);
    recentCards.push(card);

    let isCardPointerActive = false;
    let hasNavigateAttempted = false;
    let rollbackTimerId = null;
    let hoverUnlockTimerId = null;
    let isHoverLocked = false;
    const rollbackClassName = 'x-nt-recent-card--rollback';
    const ROLLBACK_ANIMATION_MS = 220;
    const HOVER_REENABLE_DELAY_MS = 1000;
    const clearRollbackTimer = () => {
      if (rollbackTimerId !== null) {
        window.clearTimeout(rollbackTimerId);
        rollbackTimerId = null;
      }
    };
    const clearHoverUnlockTimer = () => {
      if (hoverUnlockTimerId !== null) {
        window.clearTimeout(hoverUnlockTimerId);
        hoverUnlockTimerId = null;
      }
    };
    const lockHoverAfterRollback = () => {
      clearHoverUnlockTimer();
      isHoverLocked = true;
      card.classList.add(rollbackClassName);
      hoverUnlockTimerId = window.setTimeout(() => {
        hoverUnlockTimerId = null;
        isHoverLocked = false;
        card.classList.remove(rollbackClassName);
      }, ROLLBACK_ANIMATION_MS + HOVER_REENABLE_DELAY_MS);
    };
    const markNavigationSuccess = () => {
      clearRollbackTimer();
      clearHoverUnlockTimer();
    };
    const scheduleRollbackIfPending = () => {
      clearRollbackTimer();
      rollbackTimerId = window.setTimeout(() => {
        rollbackTimerId = null;
        if (document.visibilityState === 'hidden') {
          return;
        }
        lockHoverAfterRollback();
        hasNavigateAttempted = false;
      }, 180);
    };
    const navigateFromCard = () => {
      if (hasNavigateAttempted) {
        return;
      }
      hasNavigateAttempted = true;
      if (!isHoverLocked) {
        card.classList.remove(rollbackClassName);
      }
      navigateToUrl(item.url);
      scheduleRollbackIfPending();
    };
    card.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }
      isCardPointerActive = true;
      if (typeof card.setPointerCapture === 'function') {
        try {
          card.setPointerCapture(event.pointerId);
        } catch (error) {
          // Ignore capture errors and keep pointer flow fallback.
        }
      }
      navigateFromCard();
    });
    card.addEventListener('pointercancel', () => {
      isCardPointerActive = false;
    });
    card.addEventListener('pointerup', (event) => {
      if (event.button !== 0 || !isCardPointerActive) {
        return;
      }
      isCardPointerActive = false;
    });
    card.addEventListener('pointerleave', () => {
      if (!hasNavigateAttempted && !isHoverLocked) {
        card.classList.remove(rollbackClassName);
      }
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markNavigationSuccess();
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', markNavigationSuccess, { once: true });
    card.addEventListener('click', () => {
      navigateFromCard();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigateFromCard();
      }
    });

    return card;
  }

  function buildBookmarkCard(item, index) {
    if (!item || (!item.url && item.type !== 'folder')) {
      return null;
    }
    const isFolder = item.type === 'folder';
    const themeUrl = item.themeUrl || item.url || '';
    const host = item.host || getHostFromUrl(themeUrl) || '';
    const siteName = getSiteDisplayName(host, item.title);
    const titleText = item.title || siteName || (item.url ? getUrlDisplay(item.url) : t('bookmarks_heading', '书签'));
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'x-nt-bookmark-card';
    if (isFolder) {
      card.classList.add('x-nt-bookmark-card--folder');
    }
    card.title = titleText;
    card._xTitleText = titleText;
    card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
      title: titleText
    }));
    card._xNoThemeTint = isFolder;

    const themeSuggestion = { type: isFolder ? 'bookmark' : 'bookmark', url: themeUrl, title: titleText };
    const immediateTheme = getImmediateThemeForSuggestion(themeSuggestion);
    card._xTheme = immediateTheme;
    card._xHost = host;
    applyBookmarkCardTheme(card, immediateTheme, host);
    if (themeUrl) {
      getThemeForSuggestion(themeSuggestion).then((theme) => {
        if (!card.isConnected) {
          return;
        }
        card._xTheme = theme || card._xTheme;
        applyBookmarkCardTheme(card, card._xTheme, host);
      });
    }

    let icon = null;
    if (isFolder) {
      const folderIcon = document.createElement('span');
      folderIcon.className = 'x-nt-bookmark-icon x-nt-bookmark-icon--figma';
      folderIcon.innerHTML = getFigmaFolderSvg(`${item.id || 'folder'}-${index}`);
      folderIcon.setAttribute('aria-hidden', 'true');
      initFolderPathMorph(folderIcon);
      card.addEventListener('mouseenter', () => {
        playFolderPathMorph(folderIcon, true);
      });
      card.addEventListener('mouseleave', () => {
        playFolderPathMorph(folderIcon, false);
      });
      card.addEventListener('focus', () => {
        playFolderPathMorph(folderIcon, true);
      });
      card.addEventListener('blur', () => {
        playFolderPathMorph(folderIcon, false);
      });
      icon = folderIcon;
    } else {
      const favicon = document.createElement('img');
      favicon.className = 'x-nt-bookmark-icon';
      favicon.alt = siteName || t('site_icon_alt', '站点');
      favicon.loading = index < 4 ? 'eager' : 'lazy';
      if (index < 4) {
        favicon.fetchPriority = 'high';
      }
      attachFaviconWithFallbacks(favicon, item.url, host);
      favicon.onerror = function() {
        reportMissingIcon('bookmark-panel', item.url, favicon.src);
        applyFallbackIcon(favicon);
      };
      icon = favicon;
    }

    const title = document.createElement('span');
    title.className = 'x-nt-bookmark-title';
    title.textContent = titleText;

    card.appendChild(icon);
    card.appendChild(title);
    if (isFolder && Array.isArray(item.previewUrls) && item.previewUrls.length > 0) {
      const previewWrap = document.createElement('span');
      previewWrap.className = 'x-nt-folder-preview';
      const maxPreview = Math.min(4, item.previewUrls.length);
      for (let i = 0; i < maxPreview; i += 1) {
        const url = item.previewUrls[i];
        if (!url) {
          continue;
        }
        let previewHost = '';
        try {
          previewHost = normalizeHost(new URL(url).hostname);
        } catch (error) {
          previewHost = '';
        }
        const previewFavicon = document.createElement('img');
        previewFavicon.className = 'x-nt-folder-preview-favicon';
        const rotationSeed = stableHashCode(`${url}|${i}|${item.id || ''}`);
        const rotationDeg = ((rotationSeed % 13) - 6) * 0.5;
        previewFavicon.style.setProperty('--x-nt-folder-favicon-rot', `${rotationDeg.toFixed(2)}deg`);
        previewFavicon.style.zIndex = String(10 + i);
        previewFavicon.alt = '';
        previewFavicon.loading = 'lazy';
        previewFavicon.setAttribute('aria-hidden', 'true');
        attachFaviconWithFallbacks(previewFavicon, url, previewHost);
        previewFavicon.onerror = function() {
          applyFallbackIcon(previewFavicon);
        };
        previewWrap.appendChild(previewFavicon);
      }
      card.appendChild(previewWrap);
    }
    card.addEventListener('click', () => {
      if (isFolder) {
        openBookmarkFolder(item.id);
        return;
      }
      navigateToUrl(item.url);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (isFolder) {
          openBookmarkFolder(item.id);
          return;
        }
        navigateToUrl(item.url);
      }
    });
    bookmarkCards.push(card);
    return card;
  }

  function getAutocompleteCandidate(allSuggestions, rawQuery) {
    if (!Array.isArray(allSuggestions) || !rawQuery) {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    const passes = [true, false];
    for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
      const skipGoogleSuggest = passes[passIndex];
      for (let i = 0; i < allSuggestions.length; i += 1) {
      const suggestion = allSuggestions[i];
      if (!suggestion || suggestion.type === 'newtab') {
        continue;
      }
      if (skipGoogleSuggest && suggestion.type === 'googleSuggest') {
        continue;
      }
      if (suggestion.commandText) {
        const commandText = String(suggestion.commandText).toLowerCase();
        if (commandText.startsWith(rawLower)) {
          return {
            completion: suggestion.commandText,
            url: '',
            title: suggestion.title || '',
            type: 'command'
          };
        }
        const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
        for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
          const alias = String(aliases[aliasIndex] || '').toLowerCase();
          if (alias && alias.startsWith(rawLower)) {
            return {
              completion: aliases[aliasIndex],
              url: '',
              title: suggestion.title || '',
              type: 'command'
            };
          }
        }
      }
        const urlText = getUrlDisplay(suggestion.url);
        if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
        const titleText = suggestion.title || '';
        if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: titleText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'title'
          };
        }
      }
    }
    return null;
  }

  function getDomainPrefixCandidate(allSuggestions, rawQuery) {
    if (!Array.isArray(allSuggestions) || !rawQuery) {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    for (let i = 0; i < allSuggestions.length; i += 1) {
      const suggestion = allSuggestions[i];
      if (!suggestion || suggestion.type === 'newtab') {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url);
      if (!urlText) {
        continue;
      }
      const host = urlText.split('/')[0] || '';
      if (host.toLowerCase().startsWith(rawLower)) {
        return {
          completion: urlText,
          url: suggestion.url || '',
          title: suggestion.title || '',
          type: 'url'
        };
      }
    }
    return null;
  }

  function clearAutocomplete() {
    autocompleteState = null;
  }

  function applyAutocomplete(allSuggestions) {
    const rawQuery = latestRawQuery;
    const trimmedQuery = rawQuery.trim();
    if (Date.now() - lastDeletionAt < 250) {
      clearAutocomplete();
      return;
    }
    if (siteSearchState) {
      clearAutocomplete();
      return;
    }
    if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
      clearAutocomplete();
      return;
    }
    if (!allSuggestions || !Array.isArray(allSuggestions)) {
      clearAutocomplete();
      return;
    }
    if (inputParts.input.selectionStart !== inputParts.input.value.length ||
        inputParts.input.selectionEnd !== inputParts.input.value.length) {
      return;
    }
    const candidate = getDomainPrefixCandidate(allSuggestions, rawQuery) ||
      getAutocompleteCandidate(allSuggestions, rawQuery);
    if (!candidate || !candidate.completion) {
      clearAutocomplete();
      return;
    }
    if (candidate.completion.length <= rawQuery.length) {
      clearAutocomplete();
      return;
    }
    if (!candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
      clearAutocomplete();
      return;
    }
    let displayText = candidate.completion;
    if (candidate.type === 'url' && candidate.title) {
      displayText = `${candidate.completion} - ${candidate.title}`;
    }
    inputParts.input.value = displayText;
    inputParts.input.setSelectionRange(rawQuery.length, displayText.length);
    autocompleteState = {
      completion: candidate.completion,
      displayText: displayText,
      url: candidate.url || '',
      rawQuery: rawQuery,
      title: candidate.title || '',
      type: candidate.type || ''
    };
  }

  function buildUrlLine(url) {
    if (!url) {
      return null;
    }
    const urlLine = document.createElement('span');
    urlLine.textContent = url;
    urlLine.style.cssText = `
      all: unset !important;
      color: var(--x-nt-link, #2563EB) !important;
      font-size: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      text-decoration: none !important;
      display: inline-block !important;
      max-width: 60% !important;
      line-height: 1.4 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
    `;
    return urlLine;
  }

  function buildSearchUrl(template, query) {
    if (!template) {
      return '';
    }
    return template.replace(/\{query\}/g, encodeURIComponent(query));
  }

  function getProviderIcon(provider) {
    if (provider && provider.icon) {
      return provider.icon;
    }
    const template = provider && provider.template ? provider.template : '';
    try {
      const url = template.replace(/\{query\}/g, 'test');
      const hostname = normalizeHost(new URL(url).hostname);
      return getGoogleFaviconUrl(hostname);
    } catch (e) {
      return '';
    }
  }

  function mergeCustomProvidersLocal(baseItems, customItems) {
    const merged = [];
    const seen = new Set();
    (customItems || []).forEach((item) => {
      const key = String(item && item.key ? item.key : '').toLowerCase();
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(item);
    });
    (baseItems || []).forEach((item) => {
      const key = String(item && item.key ? item.key : '').toLowerCase();
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(item);
    });
    return merged;
  }

  function getSiteSearchProviders() {
    if (siteSearchProvidersCache) {
      return Promise.resolve(siteSearchProvidersCache);
    }
    const localUrl = chrome.runtime.getURL('site-search.json');
    const localFallback = fetch(localUrl)
      .then((response) => response.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        return items;
      })
      .catch(() => []);
    const customFallback = new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SITE_SEARCH_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
        resolve(items);
      });
    });
    const disabledFallback = new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
          ? result[SITE_SEARCH_DISABLED_STORAGE_KEY]
          : [];
        resolve(items.map((item) => String(item).toLowerCase()).filter(Boolean));
      });
    });
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSiteSearchProviders' }, (response) => {
        const items = response && Array.isArray(response.items) ? response.items : [];
        if (items.length > 0) {
          siteSearchProvidersCache = items;
          resolve(items);
          return;
        }
        Promise.all([localFallback, customFallback, disabledFallback])
          .then(([localItems, customItems, disabledKeys]) => {
          const baseItems = localItems.length > 0 ? localItems : defaultSiteSearchProviders;
          const filteredBase = baseItems.filter((item) => {
            const key = String(item && item.key ? item.key : '').toLowerCase();
            return key && !disabledKeys.includes(key);
          });
          const merged = mergeCustomProvidersLocal(filteredBase, customItems);
          siteSearchProvidersCache = merged;
          resolve(merged);
        });
      });
    });
  }

  function findSiteSearchProvider(trigger, providers) {
    const key = String(trigger || '').toLowerCase();
    if (!key) {
      return null;
    }
    return (providers || []).find((provider) => {
      const providerKey = String(provider.key || '').toLowerCase();
      if (providerKey === key) {
        return true;
      }
      const aliases = Array.isArray(provider.aliases) ? provider.aliases : [];
      return aliases.some((alias) => String(alias).toLowerCase() === key);
    }) || null;
  }

  function getSiteSearchDisplayName(provider) {
    if (!provider) {
      return t('site_search_default', '站内');
    }
    return provider.name || provider.key || t('site_search_default', '站内');
  }

  function suggestionMatchesProvider(suggestion, provider) {
    if (!suggestion || !provider || !suggestion.url) {
      return false;
    }
    const normalizedSuggestion = getSuggestionHost(suggestion);
    const normalizedProvider = getProviderHost(provider);
    if (!normalizedSuggestion || !normalizedProvider) {
      return false;
    }
    return normalizedSuggestion === normalizedProvider ||
      normalizedSuggestion.endsWith(`.${normalizedProvider}`) ||
      normalizedProvider.endsWith(`.${normalizedSuggestion}`);
  }

  function isAsciiToken(token) {
    return /^[a-z0-9]+$/i.test(token || '');
  }

  function isProviderTokenEligible(token) {
    if (!token) {
      return false;
    }
    const normalized = String(token).trim();
    if (!normalized) {
      return false;
    }
    if (isAsciiToken(normalized)) {
      return normalized.length >= 3;
    }
    return normalized.length >= 2;
  }

  function providerMatchesSuggestion(provider, suggestion) {
    if (!provider || !suggestion) {
      return false;
    }
    if (suggestionMatchesProvider(suggestion, provider)) {
      return true;
    }
    const titleText = String(suggestion.title || '').toLowerCase();
    const urlText = String(suggestion.url || '').toLowerCase();
    const hostText = normalizeHost(getSuggestionHost(suggestion));
    const haystack = `${titleText} ${urlText} ${hostText}`;
    const tokens = [provider.key, provider.name].concat(provider.aliases || []);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = String(tokens[i] || '').toLowerCase().trim();
      if (!isProviderTokenEligible(token)) {
        continue;
      }
      if (token && haystack.includes(token)) {
        return true;
      }
    }
    return false;
  }

  function findProviderForSuggestionMatch(suggestion, providers) {
    if (!suggestion) {
      return null;
    }
    const eligibleTypes = new Set(['topSite', 'history', 'bookmark']);
    if (!eligibleTypes.has(suggestion.type) && !suggestion.isTopSite) {
      return null;
    }
    return (providers || []).find((provider) => providerMatchesSuggestion(provider, suggestion)) || null;
  }

  function findSiteSearchProviderByKey(trigger, providers) {
    const key = String(trigger || '').toLowerCase();
    if (!key) {
      return null;
    }
    return (providers || []).find((provider) => String(provider.key || '').toLowerCase() === key) || null;
  }

  function findSiteSearchProviderByInput(input, providers) {
    const raw = String(input || '').trim();
    if (!raw) {
      return null;
    }
    const firstToken = raw.split(/\s+/)[0];
    const keyMatch = findSiteSearchProvider(firstToken, providers) ||
      findSiteSearchProviderByKey(firstToken, providers);
    if (keyMatch) {
      return keyMatch;
    }
    let host = '';
    if (/[./]/.test(firstToken)) {
      try {
        const url = firstToken.includes('://') ? firstToken : `https://${firstToken}`;
        host = new URL(url).hostname;
      } catch (e) {
        host = firstToken.split('/')[0] || '';
      }
    }
    if (!host) {
      return null;
    }
    const normalizedHost = normalizeHost(host);
    return (providers || []).find((provider) => {
      const providerHost = normalizeHost(getProviderHost(provider));
      if (!providerHost) {
        return false;
      }
      return normalizedHost === providerHost ||
        normalizedHost.endsWith(`.${providerHost}`) ||
        providerHost.endsWith(`.${normalizedHost}`);
    }) || null;
  }

  function getInlineSiteSearchCandidate(input, providers) {
    const raw = String(input || '').trim();
    if (!raw) {
      return null;
    }
    const tokens = raw.split(/\s+/);
    if (tokens.length < 2) {
      return null;
    }
    const provider = findSiteSearchProviderByInput(raw, providers);
    if (!provider) {
      return null;
    }
    const firstToken = tokens[0];
    const remainder = raw.slice(raw.indexOf(firstToken) + firstToken.length).trim();
    if (!remainder) {
      return null;
    }
    return { provider: provider, query: remainder };
  }

  function matchesTopSitePrefix(suggestion, input) {
    if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
      return false;
    }
    const query = String(input || '').trim().toLowerCase();
    if (!query) {
      return false;
    }
    const titleText = String(suggestion.title || '').toLowerCase();
    if (titleText.startsWith(query)) {
      return true;
    }
    const urlText = getUrlDisplay(suggestion.url || '');
    if (!urlText) {
      return false;
    }
    const host = urlText.split('/')[0] || '';
    return host.toLowerCase().startsWith(query);
  }

  function getTopSiteMatchCandidate(list, input) {
    if (!Array.isArray(list)) {
      return null;
    }
    const query = String(input || '').trim();
    if (!query || /\s/.test(query)) {
      return null;
    }
    let fallback = null;
    for (let i = 0; i < list.length; i += 1) {
      const suggestion = list[i];
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url || '');
      const host = urlText ? (urlText.split('/')[0] || '') : '';
      if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
        return suggestion;
      }
      if (!fallback && matchesTopSitePrefix(suggestion, query)) {
        fallback = suggestion;
      }
    }
    return fallback;
  }

  function promoteTopSiteMatch(list, queryText) {
    const match = getTopSiteMatchCandidate(list, queryText);
    if (!match) {
      return null;
    }
    const matchIndex = list.indexOf(match);
    if (matchIndex > 0) {
      const [picked] = list.splice(matchIndex, 1);
      list.unshift(picked);
      return picked;
    }
    if (matchIndex === 0) {
      return list[0];
    }
    return null;
  }

  function getProviderHost(provider) {
    if (!provider || !provider.template) {
      return '';
    }
    try {
      const url = provider.template.replace(/\{query\}/g, 'test');
      return normalizeHost(new URL(url).hostname);
    } catch (e) {
      return '';
    }
  }

  function getSuggestionHost(suggestion) {
    if (!suggestion || !suggestion.url) {
      return '';
    }
    try {
      return normalizeHost(new URL(suggestion.url).hostname);
    } catch (e) {
      return '';
    }
  }

  function hostsMatch(a, b) {
    if (!a || !b) {
      return false;
    }
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
  }

  function providerMatchesInputPrefix(provider, input) {
    const needle = String(input || '').toLowerCase();
    if (!needle || !provider) {
      return false;
    }
    const allowPrefix = needle.length >= 2;
    const tokens = [provider.key, provider.name].concat(provider.aliases || []);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = String(tokens[i] || '').toLowerCase();
      if (!token) {
        continue;
      }
      if (token === needle || (allowPrefix && token.startsWith(needle))) {
        return true;
      }
    }
    const host = normalizeHost(getProviderHost(provider));
    if (host) {
      const hostToken = host.split('.')[0] || host;
      if (hostToken === needle || (allowPrefix && hostToken.startsWith(needle))) {
        return true;
      }
    }
    return false;
  }

  function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
    const trimmed = String(input || '').trim();
    if (!trimmed || /\s/.test(trimmed)) {
      return null;
    }
    let provider = findSiteSearchProvider(trimmed, providers) ||
      findSiteSearchProviderByKey(trimmed, providers);
    if (!provider && topSiteMatch) {
      provider = (providers || []).find((candidate) => {
        if (!suggestionMatchesProvider(topSiteMatch, candidate)) {
          return false;
        }
        return providerMatchesInputPrefix(candidate, trimmed);
      }) || null;
    }
    if (!provider) {
      return null;
    }
    if (topSiteMatch && trimmed.length <= 2 && matchesTopSitePrefix(topSiteMatch, trimmed)) {
      const providerHost = getProviderHost(provider);
      const topHost = getSuggestionHost(topSiteMatch);
      if (!hostsMatch(providerHost, topHost)) {
        return null;
      }
    }
    return provider;
  }

  function activateSiteSearch(provider) {
    if (!provider) {
      return;
    }
    siteSearchState = provider;
    inlineSearchState = null;
    inputParts.input.value = '';
    latestRawQuery = '';
    latestQuery = '';
    clearAutocomplete();
    setSiteSearchPrefix(provider, defaultTheme);
    getThemeForProvider(provider).then((theme) => {
      if (siteSearchState === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    clearSearchSuggestions();
  }

  function clearSiteSearch() {
    if (!siteSearchState) {
      return;
    }
    siteSearchState = null;
    inlineSearchState = null;
    clearSiteSearchPrefix();
    clearAutocomplete();
  }

  function getBrowserInternalScheme() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Edg/')) {
      return 'edge://';
    }
    if (ua.includes('Brave')) {
      return 'brave://';
    }
    if (ua.includes('Vivaldi')) {
      return 'vivaldi://';
    }
    if (ua.includes('OPR/') || ua.includes('Opera')) {
      return 'opera://';
    }
    return 'chrome://';
  }

  function getShortcutRules() {
    if (window._x_extension_shortcut_rules_2024_unique_) {
      return Promise.resolve(window._x_extension_shortcut_rules_2024_unique_);
    }
    if (window._x_extension_shortcut_rules_promise_2024_unique_) {
      return window._x_extension_shortcut_rules_promise_2024_unique_;
    }
    const rulesUrl = chrome.runtime.getURL('shortcut-rules.json');
    const rulesPromise = fetch(rulesUrl)
      .then((response) => response.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        window._x_extension_shortcut_rules_2024_unique_ = items;
        return items;
      })
      .catch(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          window._x_extension_shortcut_rules_2024_unique_ = items;
          resolve(items);
        });
      }));
    window._x_extension_shortcut_rules_promise_2024_unique_ = rulesPromise;
    return rulesPromise;
  }

  function buildKeywordSuggestions(input, rules) {
    const queryLower = input.toLowerCase();
    const scheme = getBrowserInternalScheme();
    const matches = [];
    rules.forEach((rule) => {
      if (!rule || !Array.isArray(rule.keys)) {
        return;
      }
      const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
      if (!isMatch) {
        return;
      }
      if (rule.type === 'browserPage' && rule.path) {
        const targetUrl = `${scheme}${rule.path}`;
        matches.push({
          type: 'browserPage',
          title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
          url: targetUrl,
          favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
        });
      } else if (rule.type === 'url' && rule.url) {
        matches.push({
          type: 'browserPage',
          title: formatMessage('open_url', '打开 {url}', { url: rule.url }),
          url: rule.url,
          favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
        });
      }
    });
    return matches;
  }

  function getDirectUrlSuggestion(input) {
    const targetUrl = getDirectNavigationUrl(input);
    if (!targetUrl) {
      return null;
    }
    return {
      type: 'directUrl',
      title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
      url: targetUrl,
      favicon: ''
    };
  }

  function isNumericHostLike(hostname) {
    if (!hostname) {
      return false;
    }
    if (!/^(\d{1,3})(\.\d{1,3}){0,3}$/.test(hostname)) {
      return false;
    }
    const parts = hostname.split('.');
    if (parts.length < 1 || parts.length > 4) {
      return false;
    }
    if (parts.length === 1) {
      return parts[0] === '127';
    }
    return parts.every((part) => {
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }

  function extractHostFromInput(rawInput) {
    const withoutScheme = String(rawInput || '').replace(/^https?:\/\//i, '');
    const authority = withoutScheme.split(/[/?#]/)[0] || '';
    if (!authority) {
      return '';
    }
    if (authority.startsWith('[')) {
      const endBracket = authority.indexOf(']');
      if (endBracket > 1) {
        return authority.slice(1, endBracket).toLowerCase();
      }
      return '';
    }
    if (authority.includes('::') && !authority.includes('.')) {
      return authority.toLowerCase();
    }
    return (authority.split(':')[0] || '').toLowerCase();
  }

  function isDevHostLike(hostname) {
    if (!hostname) {
      return false;
    }
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return true;
    }
    if (hostname === 'host.docker.internal') {
      return true;
    }
    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.localdev') ||
      hostname.endsWith('.internal')
    ) {
      return true;
    }
    return hostname === '::1' || hostname === '0:0:0:0:0:0:0:1';
  }

  function getDirectNavigationUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) {
      return '';
    }
    const queryLower = raw.toLowerCase();
    const isInternal = ['chrome://', 'edge://', 'brave://', 'vivaldi://', 'opera://'].some((prefix) =>
      queryLower.startsWith(prefix)
    );
    let normalizedInput = raw.match(/^(\d{1,3})([.\s]\d{1,3}){0,3}(?::\d{1,5})?(?:[/?#].*)?$/)
      ? raw.replace(/\s+/g, '.').replace(/\.{2,}/g, '.')
      : raw;
    const hostOnly = extractHostFromInput(normalizedInput);
    const isDevHost = isDevHostLike(hostOnly);
    const isNumericLike = isNumericHostLike(hostOnly);
    const looksLikeUrl = (normalizedInput.includes('.') && !normalizedInput.includes(' ')) || isInternal || isDevHost || isNumericLike;
    if (!looksLikeUrl) {
      return '';
    }
    if (hostOnly.includes(':') && !/^https?:\/\//i.test(normalizedInput) && !normalizedInput.startsWith('[')) {
      normalizedInput = `[${normalizedInput}]`;
    }
    if (!isInternal && !normalizedInput.startsWith('http://') && !normalizedInput.startsWith('https://')) {
      return `https://${normalizedInput}`;
    }
    return normalizedInput;
  }

  function resolveQuickNavigation(query) {
    const directUrlSuggestion = getDirectUrlSuggestion(query);
    if (directUrlSuggestion) {
      return Promise.resolve(directUrlSuggestion.url);
    }
    return getShortcutRules().then((rules) => {
      const keywordSuggestions = buildKeywordSuggestions(query, rules);
      if (keywordSuggestions.length > 0) {
        return keywordSuggestions[0].url;
      }
      return null;
    });
  }

  const suggestionItems = [];
  let selectedIndex = -1;
  let currentSuggestions = [];
  let lastSuggestionResponse = [];
  let siteSearchTriggerState = null;
  let lastRenderedQuery = '';

  function getAutoHighlightIndex() {
    return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
  }

  function isSameSuggestion(a, b) {
    if (!a || !b) {
      return false;
    }
    if (a.type !== b.type) {
      return false;
    }
    if ((a.url || '') !== (b.url || '')) {
      return false;
    }
    if ((a.title || '') !== (b.title || '')) {
      return false;
    }
    const providerA = a.provider && a.provider.key ? a.provider.key : '';
    const providerB = b.provider && b.provider.key ? b.provider.key : '';
    return providerA === providerB;
  }

  function isSuggestionPrefix(previous, next) {
    if (!Array.isArray(previous) || !Array.isArray(next)) {
      return false;
    }
    if (previous.length === 0 || previous.length > next.length) {
      return false;
    }
    for (let i = 0; i < previous.length; i += 1) {
      if (!isSameSuggestion(previous[i], next[i])) {
        return false;
      }
    }
    return true;
  }

  function applySearchSuggestionHighlight(item, theme) {
    const highlight = getHighlightColors(theme);
    item.style.setProperty('background', highlight.bg, 'important');
    item.style.setProperty('border', `1px solid ${highlight.border}`, 'important');
  }

  function resetSearchSuggestion(item) {
    item.style.setProperty('background', 'transparent', 'important');
    item.style.setProperty('border', '1px solid transparent', 'important');
  }

  function applySearchActionStyles(item, theme, isActive) {
    const resolvedTheme = getThemeForMode(theme);
    applyMarkVariables(item, isActive ? resolvedTheme : defaultTheme);
    if (item._xHistoryTag) {
      if (isActive) {
        item._xHistoryTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
        item._xHistoryTag.style.setProperty('color', resolvedTheme.tagText, 'important');
        item._xHistoryTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
      } else {
        item._xHistoryTag.style.setProperty('background', item._xHistoryTag._xDefaultBg || 'var(--x-nt-tag-bg, #F3F4F6)', 'important');
        item._xHistoryTag.style.setProperty('color', item._xHistoryTag._xDefaultText || 'var(--x-nt-tag-text, #6B7280)', 'important');
        item._xHistoryTag.style.setProperty('border', `1px solid ${item._xHistoryTag._xDefaultBorder || 'transparent'}`, 'important');
      }
    }
    if (item._xBookmarkTag) {
      if (isActive) {
        item._xBookmarkTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
        item._xBookmarkTag.style.setProperty('color', resolvedTheme.tagText, 'important');
        item._xBookmarkTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
      } else {
        item._xBookmarkTag.style.setProperty('background', item._xBookmarkTag._xDefaultBg || 'var(--x-nt-bookmark-tag-bg, #FEF3C7)', 'important');
        item._xBookmarkTag.style.setProperty('color', item._xBookmarkTag._xDefaultText || 'var(--x-nt-bookmark-tag-text, #D97706)', 'important');
        item._xBookmarkTag.style.setProperty('border', `1px solid ${item._xBookmarkTag._xDefaultBorder || 'transparent'}`, 'important');
      }
    }
    if (item._xTopSiteTag) {
      if (isActive) {
        item._xTopSiteTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
        item._xTopSiteTag.style.setProperty('color', resolvedTheme.tagText, 'important');
        item._xTopSiteTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
      } else {
        item._xTopSiteTag.style.setProperty('background', item._xTopSiteTag._xDefaultBg || 'var(--x-nt-tag-bg, #F3F4F6)', 'important');
        item._xTopSiteTag.style.setProperty('color', item._xTopSiteTag._xDefaultText || 'var(--x-nt-tag-text, #6B7280)', 'important');
        item._xTopSiteTag.style.setProperty('border', `1px solid ${item._xTopSiteTag._xDefaultBorder || 'transparent'}`, 'important');
      }
    }
    if (item._xTagContainer) {
      if (item._xHasActionTags) {
        item._xTagContainer.style.setProperty('display', 'inline-flex', 'important');
        item._xTagContainer.style.setProperty('visibility', isActive ? 'visible' : 'hidden', 'important');
      } else {
        item._xTagContainer.style.setProperty('display', 'none', 'important');
        item._xTagContainer.style.setProperty('visibility', 'hidden', 'important');
      }
    }
    if (item._xTitle) {
      item._xTitle.style.setProperty('font-weight', isActive ? '600' : '400', 'important');
    }
  }

  function updateSelection() {
    suggestionItems.forEach((item, index) => {
      const isSelected = index === selectedIndex;
      const shouldAutoHighlight = selectedIndex === -1 && item._xIsAutocompleteTop;
      const isHighlighted = isSelected || shouldAutoHighlight;
      if (item._xIsSearchSuggestion) {
          const theme = item._xTheme || defaultTheme;
          if (isHighlighted) {
            applySearchSuggestionHighlight(item, theme);
          } else {
            resetSearchSuggestion(item);
          }
          applySearchActionStyles(item, theme, isHighlighted);
          setNonFaviconIconBg(item, Boolean(isHighlighted || item._xIsHovering));
          if (item._xDirectIconWrap) {
            const shouldShow = isHighlighted && theme && theme._xIsBrand;
            const resolvedTheme = getThemeForMode(theme || defaultTheme);
            item._xDirectIconWrap.style.setProperty(
              'color',
              shouldShow ? resolvedTheme.accent : 'var(--x-nt-subtext, #6B7280)',
              'important'
            );
          }
          return;
        }
      setNonFaviconIconBg(item, Boolean(isHighlighted || item._xIsHovering));
      const theme = item._xTheme || defaultTheme;
      if (isSelected) {
        applySearchSuggestionHighlight(item, theme);
        if (item._xSwitchButton) {
          item._xSwitchButton.style.setProperty('color', 'var(--x-nt-text, #111827)', 'important');
        }
      } else {
        resetSearchSuggestion(item);
        if (item._xSwitchButton) {
          item._xSwitchButton.style.setProperty('color', 'var(--x-nt-subtext, #9CA3AF)', 'important');
        }
      }
    });
  }

  function animateSuggestionsGrowth(container, fromHeight) {
    if (!container || !fromHeight) {
      return;
    }
    const toHeight = container.getBoundingClientRect().height;
    if (toHeight <= fromHeight + 1) {
      return;
    }
    container.style.setProperty('height', `${fromHeight}px`, 'important');
    container.style.setProperty('overflow', 'hidden', 'important');
    container.style.setProperty('transition', 'height 180ms ease', 'important');
    requestAnimationFrame(() => {
      container.style.setProperty('height', `${toHeight}px`, 'important');
    });
    const cleanup = () => {
      container.style.removeProperty('height');
      container.style.removeProperty('overflow');
      container.style.removeProperty('transition');
      container.removeEventListener('transitionend', cleanup);
    };
    container.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 220);
  }


  function renderTabSuggestions(tabList) {
    suggestionsContainer.innerHTML = '';
    suggestionItems.length = 0;
    currentSuggestions = [];
    lastRenderedQuery = '';
    const list = Array.isArray(tabList) ? tabList : [];
    if (list.length === 0) {
      setSuggestionsVisible(false);
      return;
    }
    list.forEach((tab) => {
      if (tab && tab.favIconUrl) {
        preloadIcon(tab.favIconUrl);
      }
    });
    list.forEach((tab, index) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
      const isLastItem = index === list.length - 1;
      suggestionItem.style.cssText = `
        all: unset !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 12px 16px !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        border-radius: 16px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        box-sizing: border-box !important;
        margin: 0 0 ${isLastItem ? '0' : '6px'} 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
      suggestionItem._xIsSearchSuggestion = false;
      suggestionItem._xIsAutocompleteTop = false;
      suggestionItems.push(suggestionItem);

      const leftSide = document.createElement('div');
      leftSide.style.cssText = `
        all: unset !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        flex: 1 !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;

      const favicon = document.createElement('img');
      let hostForTab = '';
      try {
        hostForTab = tab && tab.url ? new URL(tab.url).hostname : '';
      } catch (e) {
        hostForTab = '';
      }
      const useFallback = !tab.favIconUrl || isLocalNetworkHost(hostForTab);
      if (useFallback) {
        applyFallbackIcon(favicon);
      } else {
        favicon.src = tab.favIconUrl;
      }
      favicon.decoding = 'async';
      favicon.loading = 'eager';
      favicon.referrerPolicy = 'no-referrer';
      if (index < 4) {
        favicon.fetchPriority = 'high';
      }
      const isFallbackIcon = useFallback;
      favicon.style.cssText = `
        all: unset !important;
        width: ${isFallbackIcon ? '18px' : '16px'} !important;
        height: ${isFallbackIcon ? '18px' : '16px'} !important;
        border-radius: 2px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
        display: block !important;
      `;
      const iconSlot = document.createElement('span');
      iconSlot.style.cssText = `
        all: unset !important;
        width: 24px !important;
        height: 24px !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        transition: background-color 0.2s ease !important;
        color: var(--x-nt-subtext, #6B7280) !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
      iconSlot.appendChild(favicon);
      suggestionItem._xIconWrap = iconSlot;
      suggestionItem._xIconIsFavicon = !useFallback;
      favicon.onerror = function() {
        reportMissingIcon('tab', tab && tab.url ? tab.url : '', favicon.src);
        applyFallbackIcon(favicon);
        favicon.style.width = '18px';
        favicon.style.height = '18px';
        suggestionItem._xIconIsFavicon = false;
      };

      const title = document.createElement('span');
      title.textContent = tab.title || t('untitled', '无标题');
      title.style.cssText = `
        all: unset !important;
        color: var(--x-nt-text, #111827) !important;
        font-size: 14px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        display: inline-block !important;
        vertical-align: baseline !important;
      `;

      const switchButton = document.createElement('button');
      switchButton.innerHTML = `${t('switch_to_tab', '切换到标签页')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
      switchButton.style.cssText = `
        all: unset !important;
        background: transparent !important;
        color: var(--x-nt-subtext, #6B7280) !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        padding: 6px 12px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        vertical-align: baseline !important;
      `;
      suggestionItem._xSwitchButton = switchButton;

      suggestionItem.addEventListener('mouseenter', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
          this._xIsHovering = true;
          setNonFaviconIconBg(this, true);
          if (selectedIndex === -1 && this._xIsAutocompleteTop) {
            return;
          }
          const theme = this._xTheme;
          if (theme && theme._xIsBrand) {
            const hover = getHoverColors(theme);
            this.style.setProperty('background-color', hover.bg, 'important');
            this.style.setProperty('border', `1px solid ${hover.border}`, 'important');
          } else {
            this.style.setProperty('background-color', 'var(--x-nt-hover-bg, #F3F4F6)', 'important');
            this.style.setProperty('border', '1px solid transparent', 'important');
          }
        }
      });

      suggestionItem.addEventListener('mouseleave', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
          this._xIsHovering = false;
          updateSelection();
        }
      });

      switchButton.addEventListener('click', function(event) {
        event.stopPropagation();
        chrome.runtime.sendMessage({
          action: 'switchToTab',
          tabId: tab.id
        });
      });

      suggestionItem.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'switchToTab',
          tabId: tab.id
        });
      });

      leftSide.appendChild(iconSlot);
      leftSide.appendChild(title);
      suggestionItem.appendChild(leftSide);
      suggestionItem.appendChild(switchButton);
      suggestionsContainer.appendChild(suggestionItem);

      const themeSourceSuggestion = {
        url: tab.url || '',
        favicon: tab.favIconUrl || ''
      };
      const immediateTheme = getImmediateThemeForSuggestion(themeSourceSuggestion) || defaultTheme;
      suggestionItem._xTheme = immediateTheme;
      applyThemeVariables(suggestionItem, immediateTheme);
      getThemeForSuggestion(themeSourceSuggestion).then((theme) => {
        if (!suggestionItem.isConnected) {
          return;
        }
        suggestionItem._xTheme = theme;
        updateSelection();
      });
    });

    selectedIndex = -1;
    setSuggestionsVisible(true);
  }

  function requestTabsAndRender() {
    chrome.runtime.sendMessage({ action: 'getTabsForOverlay' }, (response) => {
      const freshTabs = response && Array.isArray(response.tabs) ? response.tabs : [];
      if (freshTabs.length === 0) {
        setSuggestionsVisible(false);
        return;
      }
      tabs = freshTabs;
      renderTabSuggestions(freshTabs);
    });
  }

  function clearSearchSuggestions() {
    inlineSearchState = null;
    siteSearchTriggerState = null;
    suggestionsContainer.innerHTML = '';
    suggestionItems.length = 0;
    currentSuggestions = [];
    lastSuggestionResponse = [];
    selectedIndex = -1;
    lastRenderedQuery = '';
    setSuggestionsVisible(false);
  }

  function renderSuggestions(suggestions, query) {
    if (!query) {
      clearSearchSuggestions();
      return;
    }
    lastSuggestionResponse = Array.isArray(suggestions) ? suggestions : [];

    getShortcutRules().then((rules) => {
      if (query !== latestQuery) {
        return;
      }
      const rawTagInput = (latestRawQuery || inputParts.input.value || '').trim();
      const modeCommandActive = isModeCommand(rawTagInput);
      if (modeCommandActive) {
        if (storageArea) {
          storageArea.get([THEME_STORAGE_KEY], (result) => {
            const storedMode = result[THEME_STORAGE_KEY] || 'system';
            if (storedMode !== currentThemeMode && query === latestQuery) {
              currentThemeMode = storedMode;
              renderSuggestions([], query);
            }
          });
        }
      }
      const commandMatch = !modeCommandActive ? getCommandMatch(rawTagInput) : null;
      const hasCommand = Boolean(commandMatch);
      const preSuggestions = [];
      if (modeCommandActive) {
        preSuggestions.push(buildModeSuggestion());
      } else {
        if (hasCommand) {
          preSuggestions.push(buildCommandSuggestion(commandMatch.command));
        }
        const directUrlSuggestion = getDirectUrlSuggestion(query);
        if (directUrlSuggestion) {
          preSuggestions.push(directUrlSuggestion);
        }
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        preSuggestions.push(...keywordSuggestions);
      }

      const providersForTags = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      if (!siteSearchProvidersCache && !pendingProviderReload) {
        pendingProviderReload = true;
        getSiteSearchProviders().then((items) => {
          pendingProviderReload = false;
          if (query !== latestQuery) {
            return;
          }
          siteSearchProvidersCache = items;
          renderSuggestions(suggestions, query);
        });
      }
      const inlineCandidate = (!siteSearchState && !modeCommandActive && !hasCommand)
        ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
        : null;
      let inlineSuggestion = null;
      if (inlineCandidate) {
        const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: formatMessage('search_in_site', '在 {site} 中搜索', {
              site: getSiteSearchDisplayName(inlineCandidate.provider)
            }),
            url: inlineUrl,
            favicon: getProviderIcon(inlineCandidate.provider),
            provider: inlineCandidate.provider
          };
        }
      }

      const newTabSuggestion = modeCommandActive
        ? null
        : {
          type: 'newtab',
          title: formatMessage('search_query', '搜索 "{query}"', {
            query: query
          }),
          url: buildDefaultSearchUrl(query),
          favicon: getDefaultSearchEngineFaviconUrl(),
          searchQuery: query,
          forceSearch: true
        };

      let allSuggestions = modeCommandActive
        ? [...preSuggestions]
        : [...preSuggestions, newTabSuggestion, ...suggestions];
      if (!modeCommandActive && siteSearchState && query) {
        const siteUrl = buildSearchUrl(siteSearchState.template, query);
        if (siteUrl) {
          allSuggestions.unshift({
            type: 'siteSearch',
            title: formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', {
              site: getSiteSearchDisplayName(siteSearchState),
              query: query
            }),
            url: siteUrl,
            favicon: getProviderIcon(siteSearchState),
            provider: siteSearchState
          });
        }
      }

      const onlyKeywordSuggestions = allSuggestions.length > 0 &&
        allSuggestions.every((item) => item && (item.type === 'googleSuggest' || item.type === 'newtab'));

      let autocompleteCandidate = null;
      let primaryHighlightIndex = -1;
      let primaryHighlightReason = 'none';
      let topSiteMatch = null;
      let siteSearchPrompt = null;
      let mergedProvider = null;
      let primarySuggestion = null;
      const inlineEnabled = Boolean(inlineSuggestion);
      let siteSearchTrigger = null;
      if (!modeCommandActive && !hasCommand) {
        if (!siteSearchState && !inlineEnabled) {
          topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawQuery.trim());
        }
        siteSearchTrigger = (!siteSearchState && !inlineEnabled)
          ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
          : null;
        if (siteSearchTrigger && !topSiteMatch) {
          siteSearchPrompt = {
            type: 'siteSearchPrompt',
            title: formatMessage('search_in_site', '在 {site} 中搜索', {
              site: getSiteSearchDisplayName(siteSearchTrigger)
            }),
            url: '',
            favicon: getProviderIcon(siteSearchTrigger),
            provider: siteSearchTrigger
          };
          allSuggestions.unshift(siteSearchPrompt);
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'siteSearchPrompt';
        }
        if (!siteSearchState && !inlineEnabled && !siteSearchPrompt) {
          autocompleteCandidate = getAutocompleteCandidate(allSuggestions, latestRawQuery);
          if (autocompleteCandidate) {
            const candidateIndex = allSuggestions.findIndex((suggestion) => {
              if (!suggestion || suggestion.type === 'newtab') {
                return false;
              }
              if (autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) {
                return true;
              }
              const suggestionUrlText = getUrlDisplay(suggestion.url);
              if (suggestionUrlText && suggestionUrlText.toLowerCase() === autocompleteCandidate.completion.toLowerCase()) {
                return true;
              }
              if (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())) {
                return true;
              }
              return false;
            });
            if (candidateIndex >= 0 && candidateIndex !== 0) {
              const [candidateSuggestion] = allSuggestions.splice(candidateIndex, 1);
              allSuggestions.unshift(candidateSuggestion);
            }
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'autocomplete';
          }
        }
        if (inlineSuggestion) {
          allSuggestions.unshift(inlineSuggestion);
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'inline';
        } else if (!siteSearchPrompt && topSiteMatch) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'topSite';
        }
        if (query && primaryHighlightIndex < 0 && allSuggestions.length > 0) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'default';
        }
        if (primaryHighlightIndex >= 0) {
          primarySuggestion = allSuggestions[primaryHighlightIndex] || null;
          mergedProvider = findProviderForSuggestionMatch(primarySuggestion, providersForTags);
        }
        applyAutocomplete(allSuggestions);
        const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
        inlineSearchState = inlineSuggestion
          ? { url: inlineSuggestion.url, rawInput: rawTagInput, isAuto: inlineAutoHighlight }
          : null;
        const resolvedProvider = mergedProvider || siteSearchTrigger;
        siteSearchTriggerState = resolvedProvider
          ? { provider: resolvedProvider, rawInput: rawTagInput }
          : null;
      } else if (modeCommandActive) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'modeSwitch';
      } else if (hasCommand) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'command';
      }
      if (hasCommand) {
        applyAutocomplete(allSuggestions);
      }

      const canAppend = query === lastRenderedQuery &&
        isSuggestionPrefix(currentSuggestions, allSuggestions);
      const startIndex = canAppend ? currentSuggestions.length : 0;
      const shouldAnimateGrowth = canAppend && startIndex < allSuggestions.length;
      const previousHeight = shouldAnimateGrowth
        ? suggestionsContainer.getBoundingClientRect().height
        : 0;
      if (!canAppend) {
        suggestionsContainer.innerHTML = '';
        suggestionItems.length = 0;
        selectedIndex = -1;
      } else {
        suggestionItems.forEach((item, index) => {
          item._xIsAutocompleteTop = index === primaryHighlightIndex;
        });
      }

      currentSuggestions = allSuggestions;
      lastRenderedQuery = query;
      warmIconCache(allSuggestions);

      allSuggestions.forEach(function(suggestion, index) {
        if (index < startIndex) {
          return;
        }
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === allSuggestions.length - 1;
        const isPrimaryHighlight = index === primaryHighlightIndex;
        const isPrimarySearchSuggest = isPrimaryHighlight && suggestion.type === 'googleSuggest';
        let immediateTheme = getImmediateThemeForSuggestion(suggestion) || defaultTheme;
        if (suggestion.type === 'directUrl' || suggestion.type === 'browserPage') {
          immediateTheme = urlHighlightTheme;
        }
        const shouldUseSearchEngineTheme = isPrimarySearchSuggest ||
          (onlyKeywordSuggestions && isPrimaryHighlight && suggestion.type === 'newtab');
        if (shouldUseSearchEngineTheme) {
          const engineAccent = getBrandAccentForUrl(getDefaultSearchEngineThemeUrl());
          if (engineAccent) {
            immediateTheme = buildTheme(engineAccent);
            immediateTheme._xIsBrand = true;
          }
        }
        const initialHighlight = isPrimaryHighlight ? getHighlightColors(immediateTheme) : null;
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 16px !important;
          min-height: 44px !important;
          background: ${isPrimaryHighlight ? initialHighlight.bg : 'transparent'} !important;
          border: ${isPrimaryHighlight ? `1px solid ${initialHighlight.border}` : '1px solid transparent'} !important;
          border-radius: 16px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          box-sizing: border-box !important;
          margin: 0 0 ${isLastItem ? '0' : '6px'} 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          color: inherit !important;
          font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
        suggestionItems.push(suggestionItem);
        suggestionItem._xIsSearchSuggestion = true;
        suggestionItem._xTheme = immediateTheme;
        suggestionItem._xIsAutocompleteTop = isPrimaryHighlight;
        applyThemeVariables(suggestionItem, immediateTheme);

        const leftSide = document.createElement('div');
        leftSide.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex: 1 !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        let iconNode = null;
        let iconWrapper = null;
        if (suggestion.type === 'browserPage') {
          const themedIcon = document.createElement('span');
          themedIcon.innerHTML = getRiSvg('ri-window-2-line', 'ri-size-16');
          themedIcon.style.cssText = `
            all: unset !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconNode = themedIcon;
        } else if (suggestion.type === 'directUrl') {
          iconNode = createSearchIcon();
        } else if (suggestion.type === 'commandNewTab') {
          const plusIcon = document.createElement('span');
          plusIcon.innerHTML = getRiSvg('ri-add-line', 'ri-size-16');
          plusIcon.style.cssText = `
            all: unset !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: var(--x-nt-subtext, #6B7280) !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconNode = plusIcon;
        } else if (suggestion.type === 'commandSettings') {
          const gearIcon = document.createElement('span');
          gearIcon.innerHTML = getRiSvg('ri-settings-3-line', 'ri-size-16');
          gearIcon.style.cssText = `
            all: unset !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: var(--x-nt-subtext, #6B7280) !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconNode = gearIcon;
        } else if (suggestion.type === 'newtab' || suggestion.type === 'googleSuggest') {
          const searchIcon = createSearchIcon();
          searchIcon.style.setProperty('color', 'var(--x-nt-subtext, #6B7280)', 'important');
          iconNode = searchIcon;
        } else if (suggestion.favicon) {
          const suggestionHost = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
          const isLocalSuggestion = suggestionHost && isLocalNetworkHost(suggestionHost);
          if (isLocalSuggestion) {
            iconNode = createLinkIcon();
          } else {
            const favicon = document.createElement('img');
            favicon.decoding = 'async';
            favicon.loading = 'eager';
            favicon.referrerPolicy = 'no-referrer';
            if (index < 4) {
              favicon.fetchPriority = 'high';
            }
            const faviconPageUrl = suggestion && suggestion.url ? suggestion.url : (suggestion.favicon || '');
            attachFaviconWithFallbacks(favicon, faviconPageUrl, suggestionHost);
            favicon.style.cssText = `
              all: unset !important;
              width: 16px !important;
              height: 16px !important;
              border-radius: 2px !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              background: transparent !important;
              color: inherit !important;
              font-size: 100% !important;
              font: inherit !important;
              vertical-align: baseline !important;
              display: block !important;
              object-fit: contain !important;
            `;
            iconNode = favicon;
          }
        } else {
          const suggestionHost = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
          if (suggestionHost && isLocalNetworkHost(suggestionHost)) {
            const linkIcon = createLinkIcon();
            linkIcon.style.setProperty('color', 'var(--x-nt-subtext, #6B7280)', 'important');
            iconNode = linkIcon;
          } else {
            const searchIcon = createSearchIcon();
            searchIcon.style.setProperty('color', 'var(--x-nt-subtext, #6B7280)', 'important');
            iconNode = searchIcon;
          }
        }

        if (iconNode) {
          const isFaviconIcon = iconNode.tagName === 'IMG';
          const iconSlot = document.createElement('span');
          iconSlot.style.cssText = `
            all: unset !important;
            width: 24px !important;
            height: 24px !important;
            border-radius: 8px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            transition: background-color 0.2s ease !important;
            color: var(--x-nt-subtext, #6B7280) !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconSlot._xIsFavicon = isFaviconIcon;
          iconSlot.appendChild(iconNode);
          iconNode = iconSlot;
          suggestionItem._xIconWrap = iconSlot;
          suggestionItem._xIconIsFavicon = isFaviconIcon;
          if (suggestion.type === 'directUrl' || suggestion.type === 'browserPage') {
            iconWrapper = iconSlot;
          }
        }

        const textWrapper = document.createElement('div');
        textWrapper.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          flex: 1 !important;
          min-width: 0 !important;
          overflow: visible !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 8px 0 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        const title = document.createElement('span');
        const baseTitle = suggestion.title || '';
        let highlightedTitle;
        if (isPrimarySearchSuggest ||
            suggestion.type === 'chatgpt' ||
            suggestion.type === 'perplexity' ||
            suggestion.type === 'newtab' ||
            suggestion.type === 'siteSearch' ||
            suggestion.type === 'inlineSiteSearch' ||
            suggestion.type === 'siteSearchPrompt' ||
            suggestion.type === 'modeSwitch') {
          highlightedTitle = baseTitle;
        } else {
          highlightedTitle = baseTitle;
        }
        title.textContent = '';
        renderHighlightedText(title, highlightedTitle, query, {
          background: 'var(--x-ext-mark-bg, #CFE8FF)',
          color: 'var(--x-ext-mark-text, #1E3A8A)'
        });
        title.style.cssText = `
          all: unset !important;
          color: var(--x-nt-text, #111827) !important;
          font-size: 14px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-weight: 400 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          display: inline-block !important;
          vertical-align: baseline !important;
        `;
        suggestionItem._xTitle = title;

        textWrapper.appendChild(title);

        if (suggestion.type === 'history' && !suggestion.isTopSite) {
          const urlLine = buildUrlLine(suggestion.url || '');
          if (urlLine) {
            textWrapper.appendChild(urlLine);
          }
          const historyTag = document.createElement('span');
          historyTag.textContent = t('search_tag_history', '历史');
          historyTag._xDefaultBg = 'var(--x-nt-tag-bg, #F3F4F6)';
          historyTag._xDefaultText = 'var(--x-nt-tag-text, #6B7280)';
          historyTag._xDefaultBorder = 'transparent';
          historyTag.style.cssText = `
            all: unset !important;
            background: var(--x-nt-tag-bg, #F3F4F6) !important;
            color: var(--x-nt-tag-text, #6B7280) !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(historyTag);
          suggestionItem._xHistoryTag = historyTag;
        }

        if (suggestion.type === 'topSite' || suggestion.isTopSite) {
          const urlLine = buildUrlLine(suggestion.url || '');
          if (urlLine) {
            textWrapper.appendChild(urlLine);
          }
          const topSiteTag = document.createElement('span');
          topSiteTag.textContent = t('search_tag_top_site', '常用');
          topSiteTag._xDefaultBg = 'var(--x-nt-tag-bg, #F3F4F6)';
          topSiteTag._xDefaultText = 'var(--x-nt-tag-text, #6B7280)';
          topSiteTag._xDefaultBorder = 'transparent';
          topSiteTag.style.cssText = `
            all: unset !important;
            background: var(--x-nt-tag-bg, #F3F4F6) !important;
            color: var(--x-nt-tag-text, #6B7280) !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(topSiteTag);
          suggestionItem._xTopSiteTag = topSiteTag;
        }

        if (suggestion.type === 'bookmark') {
          if (suggestion.path) {
            const bookmarkPath = document.createElement('span');
            bookmarkPath.textContent = suggestion.path;
            bookmarkPath.style.cssText = `
              all: unset !important;
              color: var(--x-nt-link, #2563EB) !important;
              font-size: 12px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              text-decoration: none !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1.2 !important;
              display: inline-block !important;
              vertical-align: middle !important;
            `;
            textWrapper.appendChild(bookmarkPath);
          }
          const bookmarkTag = document.createElement('span');
          bookmarkTag.textContent = t('search_tag_bookmark', '书签');
          bookmarkTag._xDefaultBg = 'var(--x-nt-bookmark-tag-bg, #FEF3C7)';
          bookmarkTag._xDefaultText = 'var(--x-nt-bookmark-tag-text, #D97706)';
          bookmarkTag._xDefaultBorder = 'transparent';
          bookmarkTag.style.cssText = `
            all: unset !important;
            background: var(--x-nt-bookmark-tag-bg, #FEF3C7) !important;
            color: var(--x-nt-bookmark-tag-text, #D97706) !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(bookmarkTag);
          suggestionItem._xBookmarkTag = bookmarkTag;
        }

        const rightSide = document.createElement('div');
        rightSide.style.cssText = `
          all: unset !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          flex-shrink: 0 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        const actionTags = document.createElement('div');
        actionTags.style.cssText = `
          all: unset !important;
          display: none !important;
          align-items: center !important;
          gap: 6px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
          flex-shrink: 0 !important;
        `;

        const isTopSiteMatch = Boolean(topSiteMatch && suggestion === topSiteMatch);
        const isDirectHighlight = isPrimaryHighlight &&
          (suggestion.type === 'directUrl' || suggestion.type === 'browserPage');
        const isMergedHighlight = Boolean(mergedProvider && primarySuggestion === suggestion && isPrimaryHighlight);
        const shouldShowEnterTag = !isPrimarySearchSuggest && isPrimaryHighlight &&
          !onlyKeywordSuggestions &&
          (primaryHighlightReason === 'topSite' ||
            primaryHighlightReason === 'inline' ||
            primaryHighlightReason === 'autocomplete' ||
            isDirectHighlight ||
            isMergedHighlight);
        const shouldShowSiteSearchTag = !isPrimarySearchSuggest && isPrimaryHighlight &&
          ((siteSearchTrigger && (primaryHighlightReason === 'siteSearchPrompt' || isTopSiteMatch)) ||
            isMergedHighlight);
        if (shouldShowEnterTag) {
          actionTags.appendChild(createActionTag(t('visit_label', '访问'), 'Enter'));
        }
        if (shouldShowSiteSearchTag) {
          actionTags.appendChild(createActionTag(t('action_search', '搜索'), 'Tab'));
        }
        if (isPrimaryHighlight && onlyKeywordSuggestions && suggestion.type === 'newtab') {
          actionTags.appendChild(createActionTag(getSearchActionLabel(), 'Enter'));
        }

        suggestionItem._xTagContainer = actionTags;
        suggestionItem._xHasActionTags = actionTags.childNodes.length > 0;

        suggestionItem.addEventListener('mouseenter', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this._xIsHovering = true;
            setNonFaviconIconBg(this, true);
            if (selectedIndex === -1 && this._xIsAutocompleteTop) {
              return;
            }
            this.style.setProperty('background', 'var(--x-nt-hover-bg, #F3F4F6)', 'important');
            this.style.setProperty('border', '1px solid transparent', 'important');
          }
        });

        suggestionItem.addEventListener('mouseleave', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this._xIsHovering = false;
            updateSelection();
          }
        });

        suggestionItem.addEventListener('click', function() {
          if (suggestion.type === 'commandNewTab') {
            chrome.runtime.sendMessage({ action: 'openNewTab' });
            return;
          }
          if (suggestion.type === 'commandSettings') {
            chrome.runtime.sendMessage({ action: 'openOptionsPage' });
            return;
          }
          if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
            activateSiteSearch(suggestion.provider);
            inputParts.input.focus();
            return;
          }
          if (suggestion.type === 'modeSwitch') {
            setThemeMode(suggestion.nextMode);
            inputParts.input.focus();
            return;
          }
          if (suggestion.forceSearch && suggestion.searchQuery) {
            navigateToQuery(suggestion.searchQuery, true);
            return;
          }
          navigateToUrl(suggestion.url);
        });

        leftSide.appendChild(iconNode);
        leftSide.appendChild(textWrapper);
        suggestionItem.appendChild(leftSide);
        rightSide.appendChild(actionTags);
        suggestionItem.appendChild(rightSide);
        if (iconWrapper) {
          suggestionItem._xDirectIconWrap = iconWrapper;
        }
        suggestionsContainer.appendChild(suggestionItem);

        if (!shouldUseSearchEngineTheme &&
            !(onlyKeywordSuggestions && suggestion.type === 'newtab') &&
            suggestion.type !== 'directUrl' &&
            suggestion.type !== 'browserPage') {
          getThemeForSuggestion(suggestion).then((theme) => {
            if (!suggestionItem.isConnected) {
              return;
            }
            suggestionItem._xTheme = theme;
            applyThemeVariables(suggestionItem, theme);
            updateSelection();
          });
        }
      });

      updateSelection();
      if (shouldAnimateGrowth) {
        animateSuggestionsGrowth(suggestionsContainer, previousHeight);
      }
      setSuggestionsVisible(true);
    });
  }

  function requestSuggestions(query, options) {
    latestQuery = query;
    const immediate = options && options.immediate;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(function() {
      const requestQuery = latestQuery;
      chrome.runtime.sendMessage({
        action: 'getSearchSuggestions',
        query: requestQuery
      }, function(response) {
        if (requestQuery !== latestQuery) {
          return;
        }
        if (chrome.runtime && chrome.runtime.lastError) {
          renderSuggestions([], requestQuery);
          return;
        }
        if (response && response.suggestions) {
          renderSuggestions(response.suggestions, requestQuery);
          return;
        }
        renderSuggestions([], requestQuery);
      });
    }, immediate ? 0 : 120);
  }

  const inputParts = createSearchInput({
    containerId: '_x_extension_newtab_input_container_2024_unique_',
    inputId: '_x_extension_newtab_search_input_2024_unique_',
    iconId: '_x_extension_newtab_search_icon_2024_unique_',
    placeholder: t('search_placeholder', defaultPlaceholderText),
    containerStyleOverrides: {
      'border-radius': '24px',
      'background': 'transparent',
      'border': 'none',
      'box-shadow': 'none',
      'min-width': '100%',
      'min-height': '44px',
      'height': '44px',
      'position': 'relative',
      'z-index': '2'
    },
    inputStyleOverrides: {
      'border-bottom': 'none',
      'color': 'var(--x-nt-text, #111827)',
      'caret-color': 'var(--x-nt-link, #2563EB)',
      'padding': '8px 52px 8px 44px',
      'min-height': '44px',
      'height': '44px',
      'line-height': '24px'
    },
    iconStyleOverrides: {
      'color': 'var(--x-nt-subtext, #6B7280)'
    },
    rightIconStyleOverrides: {
      cursor: 'pointer'
    },
    onInput: function(event) {
      const rawValue = event.target.value;
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      const inputType = event && event.inputType;
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType && inputType.startsWith('delete');
      if (isDelete) {
        lastDeletionAt = Date.now();
      }
      if (isComposing) {
        latestQuery = query;
        latestRawQuery = rawValue;
        return;
      }
      if (!query) {
        latestQuery = '';
        latestRawQuery = '';
        clearAutocomplete();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        clearSearchSuggestions();
        return;
      }
      latestRawQuery = rawValue;
      clearAutocomplete();
      if (isModeCommand(query) || getCommandMatch(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        return;
      }
      if (isPaste || getDirectUrlSuggestion(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        requestSuggestions(query, { immediate: true });
        return;
      }
      requestSuggestions(query);
    },
    onKeyDown: function(event) {
      if (event.key !== 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        latestRawQuery = inputParts.input.value;
        latestQuery = inputParts.input.value.trim();
      }
      if (event.key === 'Escape' && siteSearchState) {
        event.preventDefault();
        clearSiteSearch();
        return;
      }
      if (event.key === 'Backspace' && siteSearchState && !inputParts.input.value) {
        clearSiteSearch();
        return;
      }
      if (isComposing || (event && event.isComposing)) {
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (suggestionItems.length === 0) {
          return;
        }
        event.preventDefault();
        if (event.key === 'ArrowDown') {
          if (selectedIndex === -1) {
            const autoIndex = getAutoHighlightIndex();
            selectedIndex = autoIndex >= 0
              ? (autoIndex + 1) % suggestionItems.length
              : 0;
          } else {
            selectedIndex = (selectedIndex + 1) % suggestionItems.length;
          }
        } else {
          if (selectedIndex === 0) {
            selectedIndex = -1;
          } else if (selectedIndex === -1) {
            const autoIndex = getAutoHighlightIndex();
            if (autoIndex > 0) {
              selectedIndex = autoIndex - 1;
            } else if (autoIndex === 0) {
              selectedIndex = -1;
            } else {
              selectedIndex = suggestionItems.length - 1;
            }
          } else {
            selectedIndex = selectedIndex - 1;
          }
        }
        updateSelection();
        return;
      }
      if (event.key === 'Tab' && handleTabKey) {
        handleTabKey(event);
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      const query = event.target.value.trim();
      if (!query) {
        return;
      }
      const commandMatch = getCommandMatch(query);
      if (commandMatch && selectedIndex === -1) {
        if (commandMatch.command.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return;
        }
        if (commandMatch.command.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return;
        }
      }
      if (isModeCommand(query)) {
        setThemeMode(getNextThemeMode(currentThemeMode));
        return;
      }
      const executeSuggestion = (selectedSuggestion) => {
        if (!selectedSuggestion) {
          return false;
        }
        if (selectedSuggestion.type === 'modeSwitch') {
          setThemeMode(selectedSuggestion.nextMode);
          return true;
        }
        if (selectedSuggestion.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return true;
        }
        if (selectedSuggestion.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return true;
        }
        if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
          activateSiteSearch(selectedSuggestion.provider);
          inputParts.input.focus();
          return true;
        }
        if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
          navigateToQuery(selectedSuggestion.searchQuery, true);
          return true;
        }
        if (selectedSuggestion.url) {
          navigateToUrl(selectedSuggestion.url);
          return true;
        }
        return false;
      };
      if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
        if (executeSuggestion(currentSuggestions[selectedIndex])) {
          return;
        }
      } else {
        const autoIndex = getAutoHighlightIndex();
        if (autoIndex >= 0 && currentSuggestions[autoIndex]) {
          if (executeSuggestion(currentSuggestions[autoIndex])) {
            return;
          }
        }
      }
      if (siteSearchState) {
        const siteUrl = buildSearchUrl(siteSearchState.template, query);
        if (siteUrl) {
          navigateToUrl(siteUrl);
          return;
        }
      }
      const currentRawInput = (latestRawQuery || inputParts.input.value || '').trim();
      if (inlineSearchState && inlineSearchState.isAuto &&
          inlineSearchState.url && inlineSearchState.rawInput === currentRawInput) {
        navigateToUrl(inlineSearchState.url);
        return;
      }
      if (autocompleteState && autocompleteState.url) {
        navigateToUrl(autocompleteState.url);
        return;
      }
      resolveQuickNavigation(query).then((targetUrl) => {
        if (targetUrl) {
          navigateToUrl(targetUrl);
          return;
        }
        navigateToQuery(query);
      });
    }
  });

  const shouldAutoFocus = window.location.search.includes('focus=1') ||
    window.location.hash.includes('focus');
  if (shouldAutoFocus) {
    setTimeout(() => {
      inputParts.input.focus();
    }, 0);
  }

  function isEditableElement(el) {
    if (!el) {
      return false;
    }
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    return Boolean(el.isContentEditable);
  }

  function handleGlobalTypingFocus(event) {
    if (!event || event.defaultPrevented || event.isComposing) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement === inputParts.input || isEditableElement(activeElement)) {
      return;
    }
    const key = event.key || '';
    if (!key || key === 'Tab' || key === 'Escape' || key.startsWith('Arrow')) {
      return;
    }
    inputParts.input.focus();
    const currentValue = inputParts.input.value || '';
    if (key === 'Backspace') {
      if (currentValue) {
        inputParts.input.value = currentValue.slice(0, -1);
        inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      event.preventDefault();
      return;
    }
    if (key.length === 1) {
      inputParts.input.value = currentValue + key;
      inputParts.input.setSelectionRange(inputParts.input.value.length, inputParts.input.value.length);
      inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      event.preventDefault();
    }
  }

  function shouldFocusOnBackground(target) {
    if (!target) {
      return false;
    }
    if (target === inputParts.input || inputParts.input.contains(target)) {
      return false;
    }
    if (inputContainer && (target === inputContainer || inputContainer.contains(target))) {
      return false;
    }
    if (isEditableElement(target)) {
      return false;
    }
    if (modeBadge && modeBadge.contains(target)) {
      return false;
    }
    if (rightIcon && (target === rightIcon || rightIcon.contains(target))) {
      return false;
    }
    if (suggestionsContainer && suggestionsContainer.contains(target)) {
      return false;
    }
    return true;
  }

  window.addEventListener('keydown', handleGlobalTypingFocus, true);
  window.addEventListener('pointerdown', function(event) {
    if (!event || event.defaultPrevented) {
      return;
    }
    if (shouldFocusOnBackground(event.target)) {
      inputParts.input.focus();
    }
  }, true);
  modeBadge = document.createElement('div');
  modeBadge.id = '_x_extension_newtab_mode_badge_2024_unique_';
  modeBadge.style.cssText = `
    all: unset !important;
    position: absolute !important;
    right: 52px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    display: none !important;
    align-items: center !important;
    gap: 6px !important;
    background: var(--x-nt-tag-bg, #F3F4F6) !important;
    color: var(--x-nt-tag-text, #6B7280) !important;
    border: 1px solid var(--x-nt-panel-border, rgba(0, 0, 0, 0.08)) !important;
    border-radius: 999px !important;
    padding: 4px 8px !important;
    font-size: 11px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    font-weight: 500 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    max-width: 180px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
    pointer-events: none !important;
    z-index: 1 !important;
  `;
  inputParts.container.appendChild(modeBadge);
  const searchInput = inputParts.input;
  const inputContainer = inputParts.container;
  const rightIcon = inputParts.rightIcon;
  searchLayer = document.createElement('div');
  searchLayer.id = '_x_extension_newtab_search_layer_2024_unique_';
  searchLayer.style.cssText = `
    all: unset !important;
    position: relative !important;
    width: 100% !important;
    min-width: 100% !important;
    min-height: 44px !important;
    display: block !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    border-radius: 24px !important;
    background: var(--x-nt-input-bg, rgba(255, 255, 255, 0.9)) !important;
    border: 1px solid var(--x-nt-input-border, rgba(0, 0, 0, 0.06)) !important;
    box-shadow: var(--x-nt-input-shadow, 0 20px 60px rgba(0, 0, 0, 0.08)) !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 12 !important;
  `;

  if (rightIcon) {
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }
      window.open(chrome.runtime.getURL('options.html'), '_blank');
    });
  }
  const defaultPlaceholder = searchInput.placeholder;
  const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
  let baseInputPaddingLeft = null;
  const prefixGap = 6;

  const siteSearchPrefix = document.createElement('span');
  siteSearchPrefix.id = '_x_extension_newtab_site_search_prefix_2024_unique_';
  siteSearchPrefix.style.cssText = `
    all: unset !important;
    position: absolute !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    left: 50px !important;
    display: none !important;
    white-space: nowrap !important;
    font-size: 16px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    line-height: 1 !important;
    color: var(--x-nt-subtext, #6B7280) !important;
    pointer-events: none !important;
    z-index: 1 !important;
  `;
  inputContainer.appendChild(siteSearchPrefix);

  function getBaseInputPaddingLeft() {
    if (baseInputPaddingLeft === null) {
      const computed = parseFloat(window.getComputedStyle(searchInput).paddingLeft);
      baseInputPaddingLeft = Number.isFinite(computed) ? computed : 50;
    }
    return baseInputPaddingLeft;
  }

  function updateSiteSearchPrefixLayout() {
    const basePadding = getBaseInputPaddingLeft();
    siteSearchPrefix.style.setProperty('left', `${basePadding}px`, 'important');
    if (siteSearchPrefix.style.display === 'none') {
      searchInput.style.setProperty('padding-left', `${basePadding}px`, 'important');
      return;
    }
    const prefixWidth = siteSearchPrefix.getBoundingClientRect().width;
    const paddedLeft = Math.max(basePadding + prefixWidth + prefixGap, basePadding);
    searchInput.style.setProperty('padding-left', `${paddedLeft}px`, 'important');
  }

  function setSiteSearchPrefix(provider, theme) {
    const prefixText = formatMessage('search_in_site_ellipsis', '在 {site} 中搜索...', {
      site: getSiteSearchDisplayName(provider)
    });
    siteSearchPrefix.textContent = prefixText;
    siteSearchPrefix.style.setProperty('display', 'inline-flex', 'important');
    const resolvedTheme = theme ? getThemeForMode(theme) : null;
    if (resolvedTheme && resolvedTheme.placeholderText) {
      siteSearchPrefix.style.setProperty('color', resolvedTheme.placeholderText, 'important');
    }
    searchInput.placeholder = '';
    if (resolvedTheme && resolvedTheme.placeholderText) {
      searchInput.style.setProperty('caret-color', resolvedTheme.placeholderText, 'important');
    }
    updateSiteSearchPrefixLayout();
  }

  function clearSiteSearchPrefix() {
    siteSearchPrefix.textContent = '';
    siteSearchPrefix.style.setProperty('display', 'none', 'important');
    searchInput.placeholder = defaultPlaceholder;
    searchInput.style.setProperty('caret-color', defaultCaretColor, 'important');
    updateSiteSearchPrefixLayout();
  }

  window.addEventListener('resize', () => {
    updateSiteSearchPrefixLayout();
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
    updateSuggestionsFloatingLayout();
  });

  handleTabKey = function(event) {
    if (siteSearchState) {
      return false;
    }
    const rawValue = inputParts.input.value;
    const rawTrigger = latestRawQuery || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (siteSearchTriggerState &&
        siteSearchTriggerState.rawInput === triggerInput &&
        siteSearchTriggerState.provider) {
      event.preventDefault();
      activateSiteSearch(siteSearchTriggerState.provider);
      return true;
    }
    if (triggerInput) {
      event.preventDefault();
      const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const topSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
      const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
      if (directProvider) {
        activateSiteSearch(directProvider);
        return true;
      }
      getSiteSearchProviders().then((items) => {
        const asyncTopSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
        const asyncProvider = getSiteSearchTriggerCandidate(triggerInput, items, asyncTopSiteMatch);
        if (asyncProvider) {
          activateSiteSearch(asyncProvider);
          return;
        }
        if (autocompleteState && autocompleteState.completion) {
          inputParts.input.value = autocompleteState.completion;
          inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
          latestRawQuery = autocompleteState.completion;
          latestQuery = autocompleteState.completion.trim();
          autocompleteState = null;
          inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      return true;
    }
    if (autocompleteState && autocompleteState.completion) {
      event.preventDefault();
      inputParts.input.value = autocompleteState.completion;
      inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
      latestRawQuery = autocompleteState.completion;
      latestQuery = autocompleteState.completion.trim();
      autocompleteState = null;
      inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  };

  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Tab') {
      return;
    }
    if (document.activeElement !== inputParts.input) {
      return;
    }
    if (handleTabKey) {
      handleTabKey(event);
    }
  }, true);

  getSiteSearchProviders();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!storageAreaName || areaName !== storageAreaName ||
        (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY])) {
      return;
    }
    if (!storageArea) {
      return;
    }
    storageArea.get([SITE_SEARCH_STORAGE_KEY, SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
      const customItems = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
      const disabledKeys = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
        ? result[SITE_SEARCH_DISABLED_STORAGE_KEY].map((item) => String(item).toLowerCase()).filter(Boolean)
        : [];
      const baseItems = defaultSiteSearchProviders.filter((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        return key && !disabledKeys.includes(key);
      });
      siteSearchProvidersCache = mergeCustomProvidersLocal(baseItems, customItems);
      if (latestQuery) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    });
  });

  inputParts.input.addEventListener('compositionstart', function() {
    isComposing = true;
    clearAutocomplete();
  });

  inputParts.input.addEventListener('compositionend', function(event) {
    isComposing = false;
    const rawValue = event.target.value;
    const query = rawValue.trim();
    latestQuery = query;
    latestRawQuery = rawValue;
    clearAutocomplete();
    if (!query) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      clearSearchSuggestions();
      return;
    }
    requestSuggestions(query);
  });

  searchLayer.appendChild(inputParts.container);
  searchLayer.appendChild(suggestionsContainer);
  root.appendChild(searchLayer);
  bottomDock.appendChild(bookmarkSection);
  bottomDock.appendChild(recentSection);
  document.body.appendChild(bottomDock);
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  loadBookmarks();
  updateBookmarkSectionPosition();
  markNewtabReady();

})();
