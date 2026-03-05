
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
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return true;
    }
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

function openNewtabFallback() {
  const newtabUrl = chrome.runtime.getURL('newtab.html?focus=1');
  chrome.tabs.create({ url: newtabUrl });
}

function getResolvedTabUrl(tab) {
  if (!tab || typeof tab !== 'object') {
    return '';
  }
  const directUrl = typeof tab.url === 'string' ? String(tab.url).trim() : '';
  if (directUrl) {
    return directUrl;
  }
  const pendingUrl = typeof tab.pendingUrl === 'string' ? String(tab.pendingUrl).trim() : '';
  return pendingUrl;
}

function isLumnoNewtabUrl(url) {
  const value = String(url || '');
  if (!value || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const lumnoNewtabPrefix = chrome.runtime.getURL('newtab.html');
  return value === lumnoNewtabPrefix || value.startsWith(`${lumnoNewtabPrefix}?`);
}

function isBrowserNewtabUrl(url) {
  const lower = String(url || '').toLowerCase();
  return lower === 'chrome://newtab/' ||
    lower === 'chrome://new-tab-page/' ||
    lower === 'edge://newtab/' ||
    lower === 'brave://newtab/' ||
    lower === 'opera://startpage/';
}

function shouldRecoverFromCommandNewtab(activeTab, source) {
  if (source !== 'commands' || !activeTab) {
    return false;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  return isLumnoNewtabUrl(activeUrl) || isBrowserNewtabUrl(activeUrl);
}

function pickRecoveryTargetTab(activeTab, tabs) {
  const tabList = Array.isArray(tabs) ? tabs : [];
  if (!activeTab || typeof activeTab.id !== 'number') {
    return null;
  }
  const openerTabId = typeof activeTab.openerTabId === 'number' ? activeTab.openerTabId : null;
  if (typeof openerTabId === 'number') {
    const openerTab = tabList.find((item) =>
      item &&
      item.id === openerTabId &&
      !isRestrictedUrl(item.url || '')
    );
    if (openerTab) {
      return openerTab;
    }
  }
  const candidates = tabList
    .filter((item) =>
      item &&
      typeof item.id === 'number' &&
      item.id !== activeTab.id &&
      !isRestrictedUrl(item.url || '')
    )
    .sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
  return candidates[0] || null;
}

function recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source) {
  if (!shouldRecoverFromCommandNewtab(activeTab, source)) {
    return false;
  }
  const targetTab = pickRecoveryTargetTab(activeTab, tabs);
  if (!targetTab || typeof targetTab.id !== 'number') {
    logHotkeyDebug('command-newtab-recover-missed', {
      reason: 'no-target',
      tabId: activeTab && typeof activeTab.id === 'number' ? activeTab.id : null,
      source: source || ''
    });
    return false;
  }
  logHotkeyDebug('command-newtab-recover-start', {
    source: source || '',
    fromTabId: activeTab.id,
    toTabId: targetTab.id,
    fromUrl: activeTab.url || '',
    toUrl: targetTab.url || ''
  });
  chrome.tabs.update(targetTab.id, { active: true }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      logHotkeyDebug('command-newtab-recover-failed', {
        source: source || '',
        targetTabId: targetTab.id,
        error: chrome.runtime.lastError.message || 'unknown'
      });
      return;
    }
    if (typeof activeTab.id === 'number') {
      chrome.tabs.remove(activeTab.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyDebug('command-newtab-close-failed', {
            source: source || '',
            tabId: activeTab.id,
            error: chrome.runtime.lastError.message || 'unknown'
          });
        }
      });
    }
    openOverlayOnTab(targetTab, tabs, 'commands-recover');
  });
  return true;
}

function openExtensionOptionsPage(callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  const fallbackOpen = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }, () => {
      done(!(chrome.runtime && chrome.runtime.lastError));
    });
  };

  if (!chrome.runtime || typeof chrome.runtime.openOptionsPage !== 'function') {
    fallbackOpen();
    return;
  }

  chrome.runtime.openOptionsPage(() => {
    if (chrome.runtime && chrome.runtime.lastError) {
      fallbackOpen();
      return;
    }
    done(true);
  });
}

const ONBOARDING_URL = 'https://lumno.kubai.design/onboarding/';
const RELEASE_URL = 'https://lumno.kubai.design/release/';

function openOnboardingPage(callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  chrome.tabs.create({ url: ONBOARDING_URL }, () => {
    done(!(chrome.runtime && chrome.runtime.lastError));
  });
}

function getExtensionVersionTag() {
  const version = chrome && chrome.runtime && chrome.runtime.getManifest
    ? String((chrome.runtime.getManifest() || {}).version || '').trim()
    : '';
  if (!version) {
    return '';
  }
  return /^v/i.test(version) ? version : `v${version}`;
}

function buildReleaseUrl(options) {
  const params = new URLSearchParams();
  params.set('entry', 'ext');
  const reason = options && typeof options.reason === 'string' ? String(options.reason).trim().toLowerCase() : '';
  if (reason) {
    params.set('reason', reason);
  }
  const version = getExtensionVersionTag();
  if (version) {
    params.set('version', version);
  }
  return `${RELEASE_URL}?${params.toString()}`;
}

function openReleasePage(options, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  chrome.tabs.create({ url: buildReleaseUrl(options) }, () => {
    done(!(chrome.runtime && chrome.runtime.lastError));
  });
}

function getBookmarkManagerUrls() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent)
    ? String(navigator.userAgent).toLowerCase()
    : '';
  const candidates = [];
  const pushUnique = (url) => {
    const value = String(url || '').trim();
    if (!value || candidates.includes(value)) {
      return;
    }
    candidates.push(value);
  };

  if (ua.includes('firefox/')) {
    pushUnique('about:bookmarks');
    pushUnique('chrome://bookmarks/');
    return candidates;
  }
  if (ua.includes('edg/')) {
    pushUnique('edge://favorites/');
    pushUnique('edge://bookmarks/');
  } else if (ua.includes('vivaldi/')) {
    pushUnique('vivaldi://bookmarks/');
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    pushUnique('opera://bookmarks/');
  } else if (ua.includes('brave/')) {
    pushUnique('brave://bookmarks/');
  }
  pushUnique('chrome://bookmarks/');
  return candidates;
}

function openBookmarkManagerPage() {
  const urls = getBookmarkManagerUrls();
  return new Promise((resolve, reject) => {
    const tryOpen = (index) => {
      if (index >= urls.length) {
        reject(new Error('no-bookmark-manager-url'));
        return;
      }
      const targetUrl = urls[index];
      chrome.tabs.create({ url: targetUrl }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          tryOpen(index + 1);
          return;
        }
        resolve(targetUrl);
      });
    };
    tryOpen(0);
  });
}

function logHotkeyDebug(stage, payload) {
  try {
    const detail = payload && typeof payload === 'object' ? payload : {};
    console.log(`[Lumno][hotkey] ${stage}`, detail);
  } catch (e) {
    // Ignore logging errors.
  }
}

const storageArea = (chrome && chrome.storage && chrome.storage.sync)
  ? chrome.storage.sync
  : (chrome && chrome.storage ? chrome.storage.local : null);
const storageAreaName = storageArea
  ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
  : null;
const RESTRICTED_ACTION_STORAGE_KEY = '_x_extension_restricted_action_2024_unique_';
const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
const FALLBACK_SHORTCUT_STORAGE_KEY = '_x_extension_fallback_hotkey_2024_unique_';
const SHOW_SEARCH_COMMAND_NAME = 'show-search';
const HOTKEY_DUP_GUARD_MS = 180;
let restrictedActionCache = 'default';
const hotkeyInvokeAtByTabId = new Map();

if (storageArea) {
  storageArea.get([RESTRICTED_ACTION_STORAGE_KEY], (result) => {
    const stored = result[RESTRICTED_ACTION_STORAGE_KEY];
    const normalized = stored === 'none' ? 'none' : 'default';
    if (normalized !== stored) {
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: normalized });
    }
    restrictedActionCache = normalized;
  });
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

function shouldIgnoreDuplicateHotkey(tabId) {
  if (typeof tabId !== 'number') {
    return false;
  }
  const now = Date.now();
  const lastAt = hotkeyInvokeAtByTabId.get(tabId) || 0;
  hotkeyInvokeAtByTabId.set(tabId, now);
  return (now - lastAt) <= HOTKEY_DUP_GUARD_MS;
}

function openOverlayOnTab(activeTab, tabs, source) {
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    return;
  }
  if (shouldIgnoreDuplicateHotkey(activeTab.id)) {
    logHotkeyDebug('duplicate-ignored', { tabId: activeTab.id, source: source || '' });
    return;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  const rawUrl = typeof activeTab.url === 'string' ? activeTab.url : '';
  const rawPendingUrl = typeof activeTab.pendingUrl === 'string' ? activeTab.pendingUrl : '';
  const restricted = isRestrictedUrl(activeUrl);
  logHotkeyDebug('active-tab', {
    tabId: activeTab.id,
    resolvedUrl: activeUrl,
    tabUrl: rawUrl,
    pendingUrl: rawPendingUrl,
    url: activeUrl,
    restricted: restricted,
    source: source || ''
  });
  if (restricted) {
    if (recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source)) {
      return;
    }
    const action = restrictedActionCache || 'default';
    logHotkeyDebug('restricted-url', {
      action: action,
      url: activeUrl,
      source: source || ''
    });
    if (action === 'none') {
      logHotkeyDebug('suppressed', { reason: 'restricted_action_none', source: source || '' });
      return;
    }
    if (action === 'default') {
      logHotkeyDebug('fallback-open-create-newtab', { reason: 'restricted_url', source: source || '' });
      openNewtabFallback();
      return;
    }
    logHotkeyDebug('fallback-open-lumno-newtab', { reason: 'restricted_url', source: source || '' });
    openNewtabFallback();
    return;
  }
  logHotkeyDebug('inject-start', { tabId: activeTab.id, file: 'input-ui.js', source: source || '' });
  chrome.scripting.executeScript({
    target: {tabId: activeTab.id},
    files: ['input-ui.js']
  }, function() {
    if (chrome.runtime.lastError) {
      logHotkeyDebug('inject-failed', {
        step: 'input-ui.js',
        tabId: activeTab.id,
        error: chrome.runtime.lastError.message || 'unknown',
        source: source || ''
      });
      openNewtabFallback();
      return;
    }
    chrome.scripting.executeScript({
      target: {tabId: activeTab.id},
      function: toggleBlackRectangle,
      args: [tabs]
    }, function() {
      if (chrome.runtime.lastError) {
        logHotkeyDebug('inject-failed', {
          step: 'toggleBlackRectangle',
          tabId: activeTab.id,
          error: chrome.runtime.lastError.message || 'unknown',
          source: source || ''
        });
        openNewtabFallback();
        return;
      }
      logHotkeyDebug('overlay-opened', {
        tabId: activeTab.id,
        tabCount: Array.isArray(tabs) ? tabs.length : 0,
        source: source || ''
      });
    });
  });
}

function triggerShowSearchForTab(tab, source) {
  if (!tab || typeof tab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    return;
  }
  const windowQuery = (typeof tab.windowId === 'number')
    ? { windowId: tab.windowId }
    : { currentWindow: true };
  chrome.tabs.query(windowQuery, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const resolvedTab = tabList.find((item) => item && item.id === tab.id) || tab;
    openOverlayOnTab(resolvedTab, tabList, source);
  });
}

function getDefaultFallbackShortcutByPlatform(platformOs) {
  return platformOs === 'mac' ? 'Command+T' : 'Ctrl+T';
}

function getDefaultFallbackShortcut(callback) {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.getPlatformInfo !== 'function') {
    callback('Ctrl+T');
    return;
  }
  chrome.runtime.getPlatformInfo((info) => {
    const os = info && typeof info.os === 'string' ? info.os : '';
    callback(getDefaultFallbackShortcutByPlatform(os));
  });
}

function getConfiguredFallbackShortcut(callback) {
  getDefaultFallbackShortcut((defaultShortcut) => {
    if (!storageArea) {
      callback(defaultShortcut);
      return;
    }
    storageArea.get([FALLBACK_SHORTCUT_STORAGE_KEY], (result) => {
      const stored = result && typeof result[FALLBACK_SHORTCUT_STORAGE_KEY] === 'string'
        ? String(result[FALLBACK_SHORTCUT_STORAGE_KEY]).trim()
        : '';
      callback(stored || defaultShortcut);
    });
  });
}

chrome.commands.onCommand.addListener(function(command) {
  if (command === SHOW_SEARCH_COMMAND_NAME) {
    logHotkeyDebug('received', { command: command, source: 'commands' });
    chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
      triggerShowSearchForTab(activeTabs[0], 'commands');
    });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (!details) {
    return;
  }
  const reason = String(details.reason || '');
  if (reason === 'install') {
    openReleasePage({ reason: 'install' });
    return;
  }
  if (reason === 'update') {
    openReleasePage({ reason: 'update' });
  }
});

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(() => {
    openExtensionOptionsPage();
  });
}

// Listen for messages from content script to switch tabs
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'switchToTab') {
    chrome.tabs.update(request.tabId, {active: true});
    sendResponse({ ok: true });
    return;
  } else if (request.action === 'getShowSearchShortcut') {
    getConfiguredFallbackShortcut((shortcut) => {
      sendResponse({ shortcut: shortcut || '' });
    });
    return true;
  } else if (request.action === 'triggerShowSearchFromPageHotkey') {
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (!senderTab || typeof senderTab.id !== 'number') {
      sendResponse({ ok: false });
      return;
    }
    logHotkeyDebug('received', {
      command: SHOW_SEARCH_COMMAND_NAME,
      source: 'page-hotkey',
      tabId: senderTab.id
    });
    triggerShowSearchForTab(senderTab, 'page-hotkey');
    sendResponse({ ok: true });
    return;
  } else if (request.action === 'siteTryEnterPiPInMainWorld') {
    const senderTab = sender && sender.tab ? sender.tab : null;
    const tabId = senderTab && typeof senderTab.id === 'number' ? senderTab.id : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'no-tab' });
      return;
    }
    const frameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: async () => {
        const result = {
          ok: true,
          before: Boolean(document.pictureInPictureElement),
          after: Boolean(document.pictureInPictureElement),
          attempted: false,
          used: '',
          error: ''
        };

        const selectors = [
          '.xgplayer video',
          '.xgplayer-video-wrap video',
          '.xg-video-container video',
          '.iqp-player-videolayer video',
          '.iqp-player video',
          '.bpx-player-video-wrap video',
          '#player video',
          'video'
        ];

        const host = String(location.hostname || '').toLowerCase();
        const candidateVideos = [];
        const seen = new WeakSet();
        const pushVideo = (video) => {
          if (!(video instanceof HTMLVideoElement)) {
            return;
          }
          if (!video.isConnected || seen.has(video)) {
            return;
          }
          seen.add(video);
          candidateVideos.push(video);
        };

        for (const selector of selectors) {
          const nodes = Array.from(document.querySelectorAll(selector));
          for (const node of nodes) {
            pushVideo(node);
          }
        }
        Array.from(document.querySelectorAll('video')).forEach((node) => {
          pushVideo(node);
        });

        const getArea = (video) => {
          if (!video || typeof video.getBoundingClientRect !== 'function') {
            return 0;
          }
          const rect = video.getBoundingClientRect();
          const width = Math.max(0, Number(rect.width || 0));
          const height = Math.max(0, Number(rect.height || 0));
          return width * height;
        };

        const hasBoost = (video) => {
          if (!video || typeof video.closest !== 'function') {
            return false;
          }
          if (host.endsWith('.douyin.com') || host === 'douyin.com') {
            return Boolean(video.closest('.xgplayer, .xgplayer-video-wrap, .xg-video-container'));
          }
          if (host.endsWith('.iqiyi.com') || host === 'iqiyi.com' || host.includes('.iqiyi.')) {
            return Boolean(video.closest('.iqp-player, .iqp-player-videolayer, #flashbox, #player'));
          }
          if (host.endsWith('.bilibili.com') || host === 'bilibili.com') {
            return Boolean(video.closest('.bpx-player-video-wrap, .bilibili-player-video-wrap, #bilibili-player, #player'));
          }
          return false;
        };

        const scoreVideo = (video) => {
          if (!(video instanceof HTMLVideoElement) || !video.isConnected) {
            return -1;
          }
          const area = getArea(video);
          const resolution = Math.max(
            0,
            Number(video.videoWidth || 0) * Number(video.videoHeight || 0)
          );
          const hasFrame = resolution > 0 || Number(video.readyState || 0) >= 1;
          if (!hasFrame) {
            return -1;
          }
          const playingBoost = (!video.paused && !video.ended && Number(video.readyState || 0) >= 2)
            ? 1_000_000_000
            : 0;
          const profileBoost = hasBoost(video) ? 180_000_000 : 0;
          const resolutionBoost = Math.min(80_000_000, Math.floor(resolution / 24));
          return playingBoost + profileBoost + resolutionBoost + area;
        };

        candidateVideos.sort((a, b) => scoreVideo(b) - scoreVideo(a));

        for (const video of candidateVideos) {
          if (document.pictureInPictureElement) {
            break;
          }
          if (scoreVideo(video) < 0) {
            continue;
          }
          try {
            video.autoPictureInPicture = true;
          } catch (e) {}
          try {
            if (video.disablePictureInPicture) {
              video.disablePictureInPicture = false;
            }
          } catch (e) {}
          try {
            if (video.hasAttribute('disablepictureinpicture')) {
              video.removeAttribute('disablepictureinpicture');
            }
          } catch (e) {}
          if (video.paused && !video.ended) {
            try {
              await video.play();
            } catch (e) {}
          }
          if (typeof video.requestPictureInPicture !== 'function') {
            continue;
          }
          try {
            result.attempted = true;
            result.used = 'video.requestPictureInPicture';
            await video.requestPictureInPicture();
            if (document.pictureInPictureElement) {
              break;
            }
          } catch (e) {
            result.error = e && e.name ? String(e.name) : String(e);
          }
        }

        result.after = Boolean(document.pictureInPictureElement);
        return result;
      }
    }, (results) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          reason: chrome.runtime.lastError.message || 'executeScript-failed'
        });
        return;
      }
      const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
      const payload = first && typeof first.result === 'object' ? first.result : null;
      sendResponse(payload || { ok: false, reason: 'no-result' });
    });
    return true;
  } else if (request.action === 'iqiyiTryEnterPiPInMainWorld') {
    const senderTab = sender && sender.tab ? sender.tab : null;
    const tabId = senderTab && typeof senderTab.id === 'number' ? senderTab.id : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'no-tab' });
      return;
    }
    const frameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: async () => {
        const result = {
          ok: true,
          before: Boolean(document.pictureInPictureElement),
          after: Boolean(document.pictureInPictureElement),
          attempted: false,
          used: '',
          error: ''
        };

        const callMethod = async (obj, candidates) => {
          if (!obj || typeof obj !== 'object' || !Array.isArray(candidates)) {
            return false;
          }
          for (const candidate of candidates) {
            const name = typeof candidate === 'string' ? candidate : candidate && candidate.name;
            const args = (candidate && Array.isArray(candidate.args)) ? candidate.args : [];
            if (typeof obj[name] !== 'function') {
              continue;
            }
            try {
              const output = obj[name].apply(obj, args);
              if (output && typeof output.then === 'function') {
                await output;
              }
              result.attempted = true;
              result.used = `method:${name}${args.length ? '(args)' : ''}`;
              if (document.pictureInPictureElement) {
                return true;
              }
            } catch (e) {
              // Try next candidate.
            }
          }
          return false;
        };

        const trySetPiPProperty = (obj) => {
          if (!obj || typeof obj !== 'object' || !('pictureInPicture' in obj)) {
            return false;
          }
          try {
            obj.pictureInPicture = true;
            result.attempted = true;
            result.used = 'property:pictureInPicture';
            return Boolean(document.pictureInPictureElement);
          } catch (e) {
            return false;
          }
        };

        const getPrimaryVideo = () => {
          const selectors = [
            '.iqp-player-videolayer video',
            '.iqp-player video',
            '#flashbox video',
            '#player video',
            'video'
          ];
          for (const selector of selectors) {
            const nodes = Array.from(document.querySelectorAll(selector));
            for (const node of nodes) {
              if (!(node instanceof HTMLVideoElement)) {
                continue;
              }
              if (node.matches('.player_outer_video video') || node.getAttribute('outer') === '1') {
                continue;
              }
              return node;
            }
          }
          return null;
        };

        const roots = [];
        const rootSet = new WeakSet();
        const pushRoot = (obj) => {
          if (!obj || typeof obj !== 'object') {
            return;
          }
          if (rootSet.has(obj)) {
            return;
          }
          rootSet.add(obj);
          roots.push(obj);
        };

        try {
          if (window.webPlay &&
              window.webPlay.wonder &&
              typeof window.webPlay.wonder.getPlayer === 'function') {
            pushRoot(window.webPlay.wonder.getPlayer());
          }
        } catch (e) {}
        try {
          if (window.webPlay &&
              window.webPlay.wonder &&
              typeof window.webPlay.wonder.getPCBridge === 'function') {
            pushRoot(window.webPlay.wonder.getPCBridge());
          }
        } catch (e) {}
        try {
          if (window.webPlay &&
              window.webPlay.wonder &&
              window.webPlay.wonder._manager &&
              window.webPlay.wonder._manager._players &&
              typeof window.webPlay.wonder._manager._players === 'object') {
            Object.values(window.webPlay.wonder._manager._players).forEach((player) => {
              pushRoot(player);
            });
          }
        } catch (e) {}

        const collectLoaderPlayers = async (timeoutMs) => {
          if (!window.QiyiPlayerLoader || typeof window.QiyiPlayerLoader.ready !== 'function') {
            return;
          }
          await new Promise((resolve) => {
            let done = false;
            const finish = () => {
              if (done) {
                return;
              }
              done = true;
              resolve();
            };
            const timer = setTimeout(finish, Math.max(120, Number(timeoutMs || 260)));
            try {
              window.QiyiPlayerLoader.ready((manager) => {
                try {
                  if (manager && typeof manager === 'object') {
                    pushRoot(manager);
                    if (manager._players && typeof manager._players === 'object') {
                      Object.values(manager._players).forEach((player) => {
                        pushRoot(player);
                      });
                    }
                    if (typeof manager.getPlayerById === 'function') {
                      ['mainContent', 'root', 'player', '5fcma2g3wzdcvv2smpk4d3h3vq'].forEach((id) => {
                        try {
                          pushRoot(manager.getPlayerById(id));
                        } catch (e) {}
                      });
                    }
                  }
                } catch (e) {
                  // Ignore manager traversal errors.
                } finally {
                  clearTimeout(timer);
                  finish();
                }
              });
            } catch (e) {
              clearTimeout(timer);
              finish();
            }
          });
        };

        await collectLoaderPlayers(280);
        if (!roots.length) {
          await collectLoaderPlayers(360);
        }

        const methodCandidates = [
          { name: 'openPictureInPicture', args: [] },
          { name: 'toggleBrowserPicInPic', args: [] },
          { name: 'togglePictureInPicture', args: [] },
          { name: 'togglePip', args: [] },
          { name: 'enterPictureInPicture', args: [] },
          { name: 'setSmallWindowMode', args: [true] }
        ];

        const nestedKeys = [
          '_playBack',
          'playBack',
          '_player',
          'player',
          '_playProxy',
          'videoInfo',
          '_videoInfo'
        ];

        for (const root of roots) {
          if (document.pictureInPictureElement) {
            break;
          }
          await callMethod(root, methodCandidates);
          if (document.pictureInPictureElement) {
            break;
          }
          trySetPiPProperty(root);
          if (document.pictureInPictureElement) {
            break;
          }
          for (const key of nestedKeys) {
            if (!root || typeof root !== 'object') {
              continue;
            }
            const nested = root[key];
            if (!nested || typeof nested !== 'object') {
              continue;
            }
            await callMethod(nested, methodCandidates);
            if (document.pictureInPictureElement) {
              break;
            }
            trySetPiPProperty(nested);
            if (document.pictureInPictureElement) {
              break;
            }
          }
        }

        if (!document.pictureInPictureElement) {
          const video = getPrimaryVideo();
          if (video && typeof video.requestPictureInPicture === 'function') {
            try {
              if (video.disablePictureInPicture) {
                video.disablePictureInPicture = false;
              }
              if (video.hasAttribute('disablepictureinpicture')) {
                video.removeAttribute('disablepictureinpicture');
              }
              result.attempted = true;
              result.used = 'video.requestPictureInPicture';
              await video.requestPictureInPicture();
            } catch (e) {
              result.error = e && e.name ? String(e.name) : String(e);
            }
          }
        }

        result.after = Boolean(document.pictureInPictureElement);
        return result;
      }
    }, (results) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          reason: chrome.runtime.lastError.message || 'executeScript-failed'
        });
        return;
      }
      const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
      const payload = first && typeof first.result === 'object' ? first.result : null;
      sendResponse(payload || { ok: false, reason: 'no-result' });
    });
    return true;
  } else if (request.action === 'iqiyiSetupAutoPiPInMainWorld') {
    const senderTab = sender && sender.tab ? sender.tab : null;
    const tabId = senderTab && typeof senderTab.id === 'number' ? senderTab.id : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'no-tab' });
      return;
    }
    const frameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: () => {
        const result = {
          ok: true,
          bound: false,
          preparedVideos: 0,
          error: ''
        };
        try {
          if (window.__lumnoIqiyiAutoPipSetupDone2026) {
            result.bound = true;
            return result;
          }

          const getPrimaryVideo = () => {
            const selectors = [
              '.iqp-player-videolayer video',
              '.iqp-player video',
              '#flashbox video',
              '#player video',
              'video'
            ];
            for (const selector of selectors) {
              const nodes = Array.from(document.querySelectorAll(selector));
              for (const node of nodes) {
                if (!(node instanceof HTMLVideoElement)) {
                  continue;
                }
                if (node.matches('.player_outer_video video') || node.getAttribute('outer') === '1') {
                  continue;
                }
                return node;
              }
            }
            return null;
          };

          const prepareVideo = (video) => {
            if (!(video instanceof HTMLVideoElement)) {
              return false;
            }
            if (video.matches('.player_outer_video video') || video.getAttribute('outer') === '1') {
              return false;
            }
            try {
              video.autoPictureInPicture = true;
            } catch (e) {}
            try {
              if (video.disablePictureInPicture) {
                video.disablePictureInPicture = false;
              }
            } catch (e) {}
            try {
              if (video.hasAttribute('disablepictureinpicture')) {
                video.removeAttribute('disablepictureinpicture');
              }
            } catch (e) {}
            return true;
          };

          const prepareExistingVideos = () => {
            let count = 0;
            const list = Array.from(document.querySelectorAll('video'));
            for (const video of list) {
              if (prepareVideo(video)) {
                count += 1;
              }
            }
            return count;
          };

          const mediaSession = ('mediaSession' in navigator) ? navigator.mediaSession : null;
          const proto = mediaSession ? Object.getPrototypeOf(mediaSession) : null;
          const nativeSetActionHandler = proto && typeof proto.setActionHandler === 'function'
            ? proto.setActionHandler
            : null;

          if (mediaSession && nativeSetActionHandler) {
            nativeSetActionHandler.call(mediaSession, 'enterpictureinpicture', async () => {
              const video = getPrimaryVideo();
              if (!video || typeof video.requestPictureInPicture !== 'function') {
                return;
              }
              try {
                prepareVideo(video);
                if (!video.paused || document.visibilityState === 'hidden') {
                  await video.requestPictureInPicture();
                }
              } catch (e) {}
            });
            nativeSetActionHandler.call(mediaSession, 'leavepictureinpicture', async () => {
              try {
                if (document.pictureInPictureElement && typeof document.exitPictureInPicture === 'function') {
                  await document.exitPictureInPicture();
                }
              } catch (e) {}
            });
            result.bound = true;
          }

          result.preparedVideos = prepareExistingVideos();

          if (!window.__lumnoIqiyiAutoPipObserver2026) {
            const observer = new MutationObserver(() => {
              prepareExistingVideos();
            });
            observer.observe(document.documentElement || document.body, {
              childList: true,
              subtree: true
            });
            window.__lumnoIqiyiAutoPipObserver2026 = observer;
          }

          window.__lumnoIqiyiAutoPipSetupDone2026 = true;
          return result;
        } catch (e) {
          result.ok = false;
          result.error = e && e.message ? String(e.message) : String(e);
          return result;
        }
      }
    }, (results) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          reason: chrome.runtime.lastError.message || 'executeScript-failed'
        });
        return;
      }
      const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
      const payload = first && typeof first.result === 'object' ? first.result : null;
      sendResponse(payload || { ok: false, reason: 'no-result' });
    });
    return true;
  } else if (request.action === 'forceExitPiPInMainWorld') {
    const senderTab = sender && sender.tab ? sender.tab : null;
    const tabId = senderTab && typeof senderTab.id === 'number' ? senderTab.id : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'no-tab' });
      return;
    }
    const frameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: async () => {
        const result = {
          ok: true,
          before: Boolean(document.pictureInPictureElement),
          after: Boolean(document.pictureInPictureElement),
          attemptedExit: false,
          error: ''
        };
        try {
          if (document.pictureInPictureElement && typeof document.exitPictureInPicture === 'function') {
            result.attemptedExit = true;
            await document.exitPictureInPicture();
          }
        } catch (e) {
          result.error = e && e.name ? String(e.name) : String(e);
        }
        result.after = Boolean(document.pictureInPictureElement);
        return result;
      }
    }, (results) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          reason: chrome.runtime.lastError.message || 'executeScript-failed'
        });
        return;
      }
      const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
      const payload = first && typeof first.result === 'object' ? first.result : null;
      sendResponse(payload || { ok: false, reason: 'no-result' });
    });
    return true;
  } else if (request.action === 'ytForceExitPiPInMainWorld') {
    const senderTab = sender && sender.tab ? sender.tab : null;
    const tabId = senderTab && typeof senderTab.id === 'number' ? senderTab.id : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'no-tab' });
      return;
    }
    const frameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: async () => {
        const result = {
          ok: true,
          before: Boolean(document.pictureInPictureElement),
          after: Boolean(document.pictureInPictureElement),
          attemptedExit: false,
          unminimized: false,
          error: ''
        };

        const getPlayer = () => {
          const moviePlayer = document.getElementById('movie_player');
          if (moviePlayer && typeof moviePlayer === 'object') {
            return moviePlayer;
          }
          const ytdPlayer = document.querySelector('ytd-player');
          if (ytdPlayer && typeof ytdPlayer.getPlayer === 'function') {
            try {
              return ytdPlayer.getPlayer();
            } catch (e) {
              return null;
            }
          }
          return null;
        };

        const callPlayerMethod = (player, name, args) => {
          if (!player || typeof player[name] !== 'function') {
            return false;
          }
          try {
            player[name].apply(player, Array.isArray(args) ? args : []);
            return true;
          } catch (e) {
            return false;
          }
        };

        const forceUnminimize = () => {
          const player = getPlayer();
          if (!player) {
            return false;
          }
          let changed = false;
          changed = callPlayerMethod(player, 'setMinimized', [false]) || changed;
          changed = callPlayerMethod(player, 'setMinimized', [0]) || changed;
          changed = callPlayerMethod(player, 'setMinimized', [null]) || changed;
          changed = callPlayerMethod(player, 'setMinimized', []) || changed;
          return changed;
        };

        result.unminimized = forceUnminimize();
        try {
          if (document.pictureInPictureElement && typeof document.exitPictureInPicture === 'function') {
            result.attemptedExit = true;
            await document.exitPictureInPicture();
          }
        } catch (e) {
          result.error = e && e.name ? String(e.name) : String(e);
        }
        result.unminimized = forceUnminimize() || result.unminimized;
        result.after = Boolean(document.pictureInPictureElement);
        return result;
      }
    }, (results) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          reason: chrome.runtime.lastError.message || 'executeScript-failed'
        });
        return;
      }
      const first = Array.isArray(results) && results.length > 0 ? results[0] : null;
      const payload = first && typeof first.result === 'object' ? first.result : null;
      sendResponse(payload || { ok: false, reason: 'no-result' });
    });
    return true;
  } else if (request.action === 'searchOrNavigate') {
    const query = request.query ? String(request.query) : '';
    const forceSearch = Boolean(request.forceSearch);
    loadShortcutRules().then((rules) => {
      const shortcutUrl = getShortcutUrl(query, rules);
      if (shortcutUrl) {
        chrome.tabs.create({ url: shortcutUrl });
        sendResponse({ ok: true, url: shortcutUrl });
        return;
      }
      const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
      if (directUrl) {
        chrome.tabs.create({ url: directUrl });
        sendResponse({ ok: true, url: directUrl });
      } else {
        // It's a search query - use browser default search engine
        const fallbackUrl = buildDefaultSearchUrl(query);
        if (chrome && chrome.search && typeof chrome.search.query === 'function') {
          markPendingSearchTab(null);
          try {
            chrome.search.query({ text: query, disposition: 'NEW_TAB' }, () => {
              if (chrome.runtime && chrome.runtime.lastError) {
                pendingSearchAt = 0;
                pendingSearchTabId = null;
                chrome.tabs.create({ url: fallbackUrl });
                sendResponse({ ok: true, url: fallbackUrl });
                return;
              }
              sendResponse({ ok: true, url: fallbackUrl });
            });
            return;
          } catch (e) {
            pendingSearchAt = 0;
            pendingSearchTabId = null;
          }
        }
        chrome.tabs.create({ url: fallbackUrl });
        sendResponse({ ok: true, url: fallbackUrl });
      }
    });
    return true;
  } else if (request.action === 'getSearchSuggestions') {
    const query = request.query;
    getSearchSuggestions(query).then(suggestions => {
      sendResponse({ suggestions: suggestions });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'getTabsForOverlay') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse({ tabs: tabs });
    });
    return true;
  } else if (request.action === 'getSiteSearchProviders') {
    loadSiteSearchProviders().then((items) => {
      sendResponse({ items: items });
    });
    return true;
  } else if (request.action === 'getShortcutRules') {
    loadShortcutRules().then((items) => {
      sendResponse({ items: items });
    });
    return true;
  } else if (request.action === 'trackSearchTab') {
    if (typeof request.tabId === 'number') {
      markPendingSearchTab(request.tabId);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return true;
  } else if (request.action === 'getLocaleMessages') {
    const locale = normalizeLocaleForMessages(request.locale);
    const localePath = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    fetch(localePath)
      .then((response) => response.json())
      .then((messages) => {
        sendResponse({ messages: messages || {} });
      })
      .catch(() => {
        sendResponse({ messages: {} });
      });
    return true;
  } else if (request.action === 'openOptionsPage') {
    openExtensionOptionsPage((ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  } else if (request.action === 'openBookmarkManager') {
    openBookmarkManagerPage().then((url) => {
      sendResponse({ ok: true, url: url });
    }).catch(() => {
      sendResponse({ ok: false });
    });
    return true;
  } else if (request.action === 'createTab') {
    const targetUrl = typeof request.url === 'string' ? request.url : '';
    if (!targetUrl) {
      sendResponse({ ok: false });
      return;
    }
    chrome.tabs.create({ url: targetUrl }, () => {
      sendResponse({ ok: !(chrome.runtime && chrome.runtime.lastError) });
    });
    return true;
  } else if (request.action === 'openNewTab') {
    const newtabUrl = chrome.runtime.getURL('newtab.html?focus=1');
    chrome.tabs.create({ url: newtabUrl }, () => {
      sendResponse({ ok: !(chrome.runtime && chrome.runtime.lastError) });
    });
    return true;
  } else if (request.action === 'resolveFaviconCandidates') {
    const targetUrl = request.url || '';
    const hostOverride = request.host || '';
    const fallbackUrl = request.fallbackUrl || '';
    const preferredTheme = request.preferredTheme || '';
    const options = {
      includeChromeFallback: request.excludeChromeFallback ? false : true
    };
    resolveFaviconCandidates(targetUrl, hostOverride, fallbackUrl, preferredTheme, options).then((urls) => {
      sendResponse({ urls: Array.isArray(urls) ? urls : [] });
    }).catch(() => {
      sendResponse({ urls: [] });
    });
    return true;
  } else if (request.action === 'getFaviconData') {
    const targetUrl = request.url || '';
    if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.startsWith('data:') || isBlockedLocalFaviconUrl(targetUrl)) {
      if (targetUrl && isBlockedLocalFaviconUrl(targetUrl)) {
        logBlockedLocalFavicon(targetUrl, 'message:getFaviconData');
      }
      sendResponse({ data: '' });
      return;
    }
    try {
      const targetHost = new URL(targetUrl).hostname;
      if (isLocalNetworkHost(targetHost)) {
        sendResponse({ data: '' });
        return;
      }
    } catch (e) {
      // Ignore parse failures and continue with non-local handling.
    }
    fetchFaviconData(targetUrl).then((dataUrl) => {
      sendResponse({ data: dataUrl || '' });
    }).catch(() => {
      sendResponse({ data: '' });
    });
    return true;
  }
  sendResponse({ ok: false });
  return;
});

let shortcutRulesCache = null;
let shortcutRulesPromise = null;
let siteSearchCache = null;
let siteSearchPromise = null;
const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
migrateStorageIfNeeded([
  DEFAULT_SEARCH_ENGINE_STORAGE_KEY,
  OVERLAY_TAB_PRIORITY_STORAGE_KEY,
  RESTRICTED_ACTION_STORAGE_KEY,
  FALLBACK_SHORTCUT_STORAGE_KEY,
  SITE_SEARCH_STORAGE_KEY,
  SITE_SEARCH_DISABLED_STORAGE_KEY
]);
const FAVICON_GOOGLE_SIZE = 128;
const faviconDataCache = new Map();
const faviconPending = new Map();
const faviconResolveCache = new Map();
const faviconResolvePending = new Map();
const blockedLocalFaviconLogCache = new Set();

function logBlockedLocalFavicon(url, source) {
  const key = `${source || 'unknown'}::${String(url || '')}`;
  if (blockedLocalFaviconLogCache.has(key)) {
    return;
  }
  blockedLocalFaviconLogCache.add(key);
  console.log('[Lumno][favicon-blocked-local]', {
    source: source || 'unknown',
    url: String(url || '')
  });
}

const SEARCH_ENGINE_DEFS = [
  {
    id: 'google',
    name: 'Google',
    hostMatches: ['google.'],
    searchTemplate: 'https://www.google.com/search?q={query}',
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'bing',
    name: 'Bing',
    hostMatches: ['bing.com'],
    searchTemplate: 'https://www.bing.com/search?q={query}',
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'baidu',
    name: '百度',
    hostMatches: ['baidu.com'],
    searchTemplate: 'https://www.baidu.com/s?wd={query}',
    searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hostMatches: ['duckduckgo.com'],
    searchTemplate: 'https://duckduckgo.com/?q={query}',
    searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    hostMatches: ['search.yahoo.com'],
    searchTemplate: 'https://search.yahoo.com/search?p={query}',
    searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
  },
  {
    id: 'yandex',
    name: 'Yandex',
    hostMatches: ['yandex.com'],
    searchTemplate: 'https://yandex.com/search/?text={query}',
    searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
  },
  {
    id: 'sogou',
    name: '搜狗',
    hostMatches: ['sogou.com'],
    searchTemplate: 'https://www.sogou.com/web?query={query}',
    searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
  },
  {
    id: 'so',
    name: '360搜索',
    hostMatches: ['so.com'],
    searchTemplate: 'https://www.so.com/s?q={query}',
    searchUrl: (query) => `https://www.so.com/s?q=${encodeURIComponent(query)}`
  },
  {
    id: 'shenma',
    name: '神马',
    hostMatches: ['sm.cn'],
    searchTemplate: 'https://m.sm.cn/s?q={query}',
    searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
  }
];

let defaultSearchEngineState = {
  id: '',
  name: '',
  host: '',
  searchTemplate: '',
  updatedAt: 0
};

let pendingSearchAt = 0;
let pendingSearchTabId = null;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function getGoogleFaviconUrl(hostname) {
  const normalized = normalizeFaviconHost(hostname);
  if (!normalized) {
    return '';
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalized)}&sz=${FAVICON_GOOGLE_SIZE}`;
}

function getFaviconIsUrl(hostname) {
  const normalized = normalizeFaviconHost(hostname);
  if (!normalized) {
    return '';
  }
  return `https://favicon.is/${encodeURIComponent(normalized)}`;
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

function getSearchEngineByHostname(hostname) {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) =>
    engine.hostMatches.some((match) => normalized.includes(match))
  ) || null;
}

function getSearchEngineById(id) {
  if (!id) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
}

function setDefaultSearchEngineState(nextState, shouldPersist) {
  if (!nextState || !nextState.id) {
    return;
  }
  const engine = getSearchEngineById(nextState.id);
  const updated = {
    id: nextState.id,
    name: nextState.name || '',
    host: nextState.host || '',
    searchTemplate: nextState.searchTemplate || (engine ? engine.searchTemplate : ''),
    updatedAt: nextState.updatedAt || Date.now()
  };
  defaultSearchEngineState = updated;
  if (shouldPersist && storageArea) {
    storageArea.set({ [DEFAULT_SEARCH_ENGINE_STORAGE_KEY]: updated });
  }
}

function loadDefaultSearchEngineState() {
  if (!storageArea) {
    return;
  }
  storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
    const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
    if (stored && stored.id) {
      setDefaultSearchEngineState(stored, false);
    }
  });
}

function isSearchEngineResultUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.toLowerCase();
    const isKnownHost = SEARCH_ENGINE_DEFS.some((engine) =>
      engine.hostMatches.some((match) => hostname.includes(match))
    );
    if (!isKnownHost) {
      return false;
    }
    const searchPaths = [
      '/search',
      '/s',
      '/s/2',
      '/web',
      '/?'
    ];
    if (path === '/' && parsedUrl.searchParams.has('q')) {
      return true;
    }
    if (path === '/' && parsedUrl.searchParams.has('wd')) {
      return true;
    }
    if (path === '/' && parsedUrl.searchParams.has('query')) {
      return true;
    }
    if (searchPaths.some((prefix) => path.startsWith(prefix))) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function updateDefaultSearchEngineFromUrl(url) {
  if (!url || !isSearchEngineResultUrl(url)) {
    return false;
  }
  try {
    const parsedUrl = new URL(url);
    const engine = getSearchEngineByHostname(parsedUrl.hostname);
    if (!engine) {
      return false;
    }
    setDefaultSearchEngineState({
      id: engine.id,
      name: engine.name,
      host: normalizeHost(parsedUrl.hostname),
      searchTemplate: engine.searchTemplate,
      updatedAt: Date.now()
    }, true);
    return true;
  } catch (e) {
    return false;
  }
}

function buildDefaultSearchUrl(query) {
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine && typeof engine.searchUrl === 'function') {
    return engine.searchUrl(query);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
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
  const lower = raw.toLowerCase();
  const isInternal = ['chrome://', 'edge://', 'brave://', 'vivaldi://', 'opera://'].some((prefix) =>
    lower.startsWith(prefix)
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

function parseJsonpPayload(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start < 0 || end <= start) {
    return null;
  }
  const payload = text.slice(start + 1, end);
  try {
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

function extractJsonArray(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) {
    return null;
  }
  const payload = text.slice(start, end + 1);
  try {
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

async function fetchJson(url) {
  if (!url) {
    return null;
  }
  const response = await fetch(url);
  if (!response || !response.ok) {
    return null;
  }
  return response.json();
}

async function fetchText(url) {
  if (!url) {
    return '';
  }
  const response = await fetch(url);
  if (!response || !response.ok) {
    return '';
  }
  return response.text();
}

async function fetchSearchSuggestionsForEngine(query) {
  const engineId = defaultSearchEngineState.id;
  if (!query || !engineId) {
    return [];
  }
  try {
    if (engineId === 'google') {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'bing') {
      const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'baidu') {
      const url = `https://www.baidu.com/sugrec?ie=utf-8&json=1&prod=pc&wd=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (data && Array.isArray(data.g)) {
        return data.g.map((item) => item && item.q).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'sogou') {
      const url = `https://sor.html5.qq.com/api/getsug?m=searxng&key=${encodeURIComponent(query)}`;
      const text = await fetchText(url);
      const data = extractJsonArray(text);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'so') {
      const url = `https://sug.so.360.cn/suggest?format=json&word=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (data && Array.isArray(data.result)) {
        return data.result
          .map((item) => (item && (item.word || item.w)) || '')
          .filter(Boolean);
      }
      return [];
    }
    if (engineId === 'duckduckgo') {
      const url = `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          return data[1];
        }
        return data.map((item) => item && item.phrase).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'yandex') {
      const url = `https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'quark') {
      const url = `https://sugs.m.sm.cn/web?q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (data && Array.isArray(data.r)) {
        return data.r.map((item) => item && item.w).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'shenma') {
      const url = `https://sugs.m.sm.cn/web?q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url);
      if (data && Array.isArray(data.r)) {
        return data.r.map((item) => item && item.w).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'yahoo') {
      const url = `https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=sd1&command=${encodeURIComponent(query)}`;
      const text = await fetchText(url);
      const data = parseJsonpPayload(text) || extractJsonArray(text);
      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          return data[1];
        }
        if (data[0] && Array.isArray(data[0])) {
          return data[0];
        }
      }
      if (data && Array.isArray(data.gossip && data.gossip.results)) {
        return data.gossip.results.map((item) => item && item.key).filter(Boolean);
      }
      return [];
    }
    return [];
  } catch (e) {
    return [];
  }
}

function markPendingSearchTab(tabId) {
  pendingSearchAt = Date.now();
  pendingSearchTabId = typeof tabId === 'number' ? tabId : null;
}

loadDefaultSearchEngineState();

if (chrome && chrome.tabs) {
  chrome.tabs.onCreated.addListener((tab) => {
    if (!pendingSearchAt || !tab || typeof tab.id !== 'number') {
      return;
    }
    if (Date.now() - pendingSearchAt > 5000) {
      return;
    }
    pendingSearchTabId = tab.id;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo || !changeInfo.url) {
      return;
    }
    if (!pendingSearchAt || (Date.now() - pendingSearchAt > 10000)) {
      return;
    }
    if (pendingSearchTabId !== null && tabId !== pendingSearchTabId) {
      return;
    }
    const updated = updateDefaultSearchEngineFromUrl(changeInfo.url);
    if (updated) {
      pendingSearchTabId = null;
      pendingSearchAt = 0;
    }
  });
}

function normalizeLocaleForMessages(locale) {
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

function isLocalNetworkHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) {
    return false;
  }
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'host.docker.internal'
  ) {
    return true;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){0,2}$/.test(host)) {
    const shortParts = host.split('.').map((part) => Number(part));
    if (shortParts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      return true;
    }
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const parts = host.split('.').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
      return false;
    }
    if (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254)
    ) {
      return true;
    }
    if (parts[0] === 192 && parts[1] === 168) {
      return true;
    }
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return true;
    }
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
      return true;
    }
    return false;
  }
  const ipv6 = host.split('%')[0];
  if (
    ipv6 === '::1' ||
    ipv6 === '0:0:0:0:0:0:0:1' ||
    ipv6 === '::' ||
    /^fe[89ab][0-9a-f]*:/i.test(ipv6) ||
    /^[fd][0-9a-f]{1,3}:/i.test(ipv6)
  ) {
    return true;
  }
  const mappedIpv4 = ipv6.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4 && mappedIpv4[1]) {
    return isLocalNetworkHost(mappedIpv4[1]);
  }
  return false;
}

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
  const withoutScheme = decodedRaw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const authority = withoutScheme.split(/[/?#]/)[0] || '';
  const hostCandidateRaw = authority.includes('@') ? authority.split('@').pop() : authority;
  const hostCandidate = (() => {
    const value = String(hostCandidateRaw || '').trim().toLowerCase();
    if (!value) {
      return '';
    }
    if (value.startsWith('[')) {
      const endBracket = value.indexOf(']');
      if (endBracket > 1) {
        return value.slice(1, endBracket);
      }
    }
    return value.replace(/^\[|\]$/g, '').split(':')[0];
  })();
  if (hostCandidate && isLocalNetworkHost(hostCandidate)) {
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

function getChromeFaviconUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return '';
  }
  return `chrome://favicon2/?size=128&scale_factor=2x&show_fallback_monogram=1&url=${encodeURIComponent(url)}`;
}

function normalizeThemePreference(theme) {
  if (theme === 'dark') {
    return 'dark';
  }
  if (theme === 'light') {
    return 'light';
  }
  return '';
}

function hasThemeTokenInUrl(url, token) {
  const lower = String(url || '').toLowerCase();
  return new RegExp(`(^|[._/-])${token}([._/-]|$)`).test(lower);
}

function shouldSkipThemeUpgradeCandidate(candidateUrl, preferredTheme, currentUrl) {
  const mode = normalizeThemePreference(preferredTheme);
  if (!mode) {
    return false;
  }
  const opposite = mode === 'dark' ? 'light' : 'dark';
  if (hasThemeTokenInUrl(candidateUrl, opposite)) {
    return true;
  }
  const currentHasPreferredToken = hasThemeTokenInUrl(currentUrl, mode);
  const candidateHasPreferredToken = hasThemeTokenInUrl(candidateUrl, mode);
  if (currentHasPreferredToken && !candidateHasPreferredToken) {
    return true;
  }
  return false;
}

function getKnownThemedFaviconCandidates(hostname, preferredTheme) {
  const host = normalizeFaviconHost(hostname);
  const mode = normalizeThemePreference(preferredTheme);
  if (!host) {
    return [];
  }
  if (host === 'github.com' || host.endsWith('.github.com')) {
    if (mode === 'dark') {
      return [
        { url: 'https://github.githubassets.com/favicons/favicon-dark.svg', score: 60 },
        { url: 'https://github.githubassets.com/favicons/favicon.svg', score: 42 },
        { url: 'https://github.githubassets.com/favicons/favicon.png', score: 36 }
      ];
    }
    if (mode === 'light') {
      return [
        { url: 'https://github.githubassets.com/favicons/favicon.svg', score: 60 },
        { url: 'https://github.githubassets.com/favicons/favicon-dark.svg', score: 40 },
        { url: 'https://github.githubassets.com/favicons/favicon.png', score: 36 }
      ];
    }
    return [
      { url: 'https://github.githubassets.com/favicons/favicon.svg', score: 52 },
      { url: 'https://github.githubassets.com/favicons/favicon-dark.svg', score: 52 },
      { url: 'https://github.githubassets.com/favicons/favicon.png', score: 36 }
    ];
  }
  return [];
}

function getThemeHintScore(url, mediaValue, preferredTheme) {
  const normalizedTheme = normalizeThemePreference(preferredTheme);
  if (!normalizedTheme) {
    return 0;
  }
  let score = 0;
  const lowerMedia = String(mediaValue || '').toLowerCase();
  if (lowerMedia.includes('prefers-color-scheme')) {
    const hasDark = /prefers-color-scheme\s*:\s*dark/.test(lowerMedia);
    const hasLight = /prefers-color-scheme\s*:\s*light/.test(lowerMedia);
    if ((normalizedTheme === 'dark' && hasDark) || (normalizedTheme === 'light' && hasLight)) {
      score += 34;
    }
    if ((normalizedTheme === 'dark' && hasLight) || (normalizedTheme === 'light' && hasDark)) {
      score -= 20;
    }
  }
  const lowerUrl = String(url || '').toLowerCase();
  const hasDarkToken = /(^|[._/-])dark([._/-]|$)/.test(lowerUrl);
  const hasLightToken = /(^|[._/-])light([._/-]|$)/.test(lowerUrl);
  if (normalizedTheme === 'dark') {
    if (hasDarkToken) {
      score += 16;
    }
    if (hasLightToken) {
      score -= 8;
    }
  } else if (normalizedTheme === 'light') {
    if (hasLightToken) {
      score += 16;
    }
    if (hasDarkToken) {
      score -= 8;
    }
  }
  return score;
}

function parseHtmlIconCandidates(html, pageUrl, preferredTheme) {
  if (!html || !pageUrl) {
    return [];
  }
  const normalizedTheme = normalizeThemePreference(preferredTheme);
  const list = [];
  const linkMatches = String(html).match(/<link\b[^>]*>/gi) || [];
  linkMatches.forEach((tag) => {
    const relMatch = tag.match(/\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const hrefMatch = tag.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!relMatch || !hrefMatch) {
      return;
    }
    const rel = String(relMatch[2] || relMatch[3] || relMatch[4] || '').toLowerCase();
    const hrefRaw = String(hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '').trim();
    if (!rel.includes('icon') || !hrefRaw) {
      return;
    }
    let href = '';
    try {
      href = new URL(hrefRaw, pageUrl).href;
    } catch (e) {
      return;
    }
    const typeMatch = tag.match(/\btype\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const sizesMatch = tag.match(/\bsizes\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const mediaMatch = tag.match(/\bmedia\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const baseHrefMatch = tag.match(/\bdata-base-href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const type = String(typeMatch ? (typeMatch[2] || typeMatch[3] || typeMatch[4] || '') : '').toLowerCase();
    const sizes = String(sizesMatch ? (sizesMatch[2] || sizesMatch[3] || sizesMatch[4] || '') : '').toLowerCase();
    const media = String(mediaMatch ? (mediaMatch[2] || mediaMatch[3] || mediaMatch[4] || '') : '').toLowerCase();
    let score = 10;
    if (/\bicon\b/.test(rel)) {
      score += 20;
    }
    if (rel.includes('shortcut')) {
      score += 6;
    }
    if (rel.includes('apple-touch-icon')) {
      score += 8;
    }
    if (type.includes('svg') || href.toLowerCase().endsWith('.svg')) {
      score += 14;
    }
    if (href.toLowerCase().includes('favicon')) {
      score += 6;
    }
    score += getThemeHintScore(href, media, normalizedTheme);
    const sizeNumbers = sizes.match(/\d+/g);
    if (sizeNumbers && sizeNumbers.length > 0) {
      const size = Math.max(...sizeNumbers.map((n) => Number(n) || 0));
      score += Math.min(20, Math.floor(size / 8));
    }
    list.push({ url: href, score: score });
    if (normalizedTheme === 'dark' && /\/favicon\.svg(?:[?#].*)?$/i.test(href)) {
      list.push({
        url: href.replace(/\/favicon\.svg([?#].*)?$/i, '/favicon-dark.svg$1'),
        score: score + 14
      });
    }
    if (normalizedTheme === 'light' && /\/favicon-dark\.svg(?:[?#].*)?$/i.test(href)) {
      list.push({
        url: href.replace(/\/favicon-dark\.svg([?#].*)?$/i, '/favicon.svg$1'),
        score: score + 14
      });
    }
    const baseHrefRaw = String(baseHrefMatch ? (baseHrefMatch[2] || baseHrefMatch[3] || baseHrefMatch[4] || '') : '').trim();
    if (baseHrefRaw) {
      let baseHref = '';
      try {
        baseHref = new URL(baseHrefRaw, pageUrl).href;
      } catch (e) {
        baseHref = '';
      }
      if (baseHref) {
        if (normalizedTheme === 'dark') {
          list.push({ url: `${baseHref}-dark.svg`, score: score + 20 });
          list.push({ url: `${baseHref}.svg`, score: score + 8 });
        } else if (normalizedTheme === 'light') {
          list.push({ url: `${baseHref}.svg`, score: score + 20 });
          list.push({ url: `${baseHref}-light.svg`, score: score + 12 });
        } else {
          list.push({ url: `${baseHref}.svg`, score: score + 12 });
          list.push({ url: `${baseHref}-dark.svg`, score: score + 12 });
        }
      }
    }
  });
  return list;
}

function buildFaviconFallbackCandidates(pageUrl, hostOverride, fallbackUrl, preferredTheme, options) {
  const includeChromeFallback = !options || options.includeChromeFallback !== false;
  const normalizedTheme = normalizeThemePreference(preferredTheme);
  const candidates = [];
  const inputUrl = String(pageUrl || '').trim();
  const fallback = String(fallbackUrl || '').trim();
  let host = normalizeFaviconHost(hostOverride || '');
  if (!host && inputUrl) {
    try {
      host = normalizeFaviconHost(new URL(inputUrl).hostname);
    } catch (e) {
      host = '';
    }
  }
  if (host && isLocalNetworkHost(host)) {
    return [];
  }
  if (host) {
    candidates.push(...getKnownThemedFaviconCandidates(host, normalizedTheme));
    if (normalizedTheme === 'dark') {
      candidates.push({ url: `https://${host}/favicon-dark.svg`, score: 34 });
      candidates.push({ url: `https://${host}/favicon.svg`, score: 28 });
      candidates.push({ url: `https://${host}/favicon-light.svg`, score: 16 });
    } else if (normalizedTheme === 'light') {
      candidates.push({ url: `https://${host}/favicon-light.svg`, score: 32 });
      candidates.push({ url: `https://${host}/favicon.svg`, score: 29 });
      candidates.push({ url: `https://${host}/favicon-dark.svg`, score: 15 });
    } else {
      candidates.push({ url: `https://${host}/favicon.svg`, score: 28 });
      candidates.push({ url: `https://${host}/favicon-dark.svg`, score: 20 });
      candidates.push({ url: `https://${host}/favicon-light.svg`, score: 20 });
    }
    candidates.push({ url: `https://${host}/favicon.ico`, score: 24 });
    candidates.push({ url: `https://${host}/apple-touch-icon.png`, score: 16 });
    candidates.push({ url: getGoogleFaviconUrl(host), score: 8 });
    candidates.push({ url: getFaviconIsUrl(host), score: 1 });
  }
  if (inputUrl && includeChromeFallback) {
    candidates.push({ url: getChromeFaviconUrl(inputUrl), score: 12 });
  }
  if (fallback) {
    candidates.push({ url: fallback, score: 10 });
  }
  return candidates.filter((item) => item && item.url);
}

function dedupeAndSortFaviconCandidates(candidates) {
  const byUrl = new Map();
  (candidates || []).forEach((item) => {
    if (!item || !item.url) {
      return;
    }
    const key = String(item.url);
    const current = byUrl.get(key);
    if (!current || Number(item.score || 0) > Number(current.score || 0)) {
      byUrl.set(key, { url: key, score: Number(item.score || 0) });
    }
  });
  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

function resolveFaviconCandidates(targetUrl, hostOverride, fallbackUrl, preferredTheme, options) {
  const includeChromeFallback = !options || options.includeChromeFallback !== false;
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return Promise.resolve([]);
  }
  let parsed = null;
  try {
    parsed = new URL(inputUrl);
  } catch (e) {
    return Promise.resolve([]);
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return Promise.resolve([]);
  }
  if (isLocalNetworkHost(parsed.hostname) || (hostOverride && isLocalNetworkHost(hostOverride))) {
    logBlockedLocalFavicon(targetUrl || hostOverride || '', 'resolveFaviconCandidates');
    return Promise.resolve([]);
  }
  const normalizedTheme = normalizeThemePreference(preferredTheme);
  const normalizedHost = normalizeFaviconHost(hostOverride || parsed.hostname);
  const cacheKey = `${normalizedHost}::${parsed.origin}::${normalizedTheme || 'auto'}::chrome=${includeChromeFallback ? '1' : '0'}`;
  if (faviconResolveCache.has(cacheKey)) {
    const cached = faviconResolveCache.get(cacheKey);
    const extra = buildFaviconFallbackCandidates(inputUrl, hostOverride, fallbackUrl, normalizedTheme, { includeChromeFallback: includeChromeFallback });
    return Promise.resolve(dedupeAndSortFaviconCandidates([...(cached || []).map((url) => ({ url: url, score: 20 })), ...extra]));
  }
  if (faviconResolvePending.has(cacheKey)) {
    return faviconResolvePending.get(cacheKey);
  }
  const promise = fetch(inputUrl, { cache: 'force-cache' })
    .then((response) => {
      if (!response || !response.ok) {
        return '';
      }
      return response.text();
    })
    .then((html) => {
      const parsedCandidates = parseHtmlIconCandidates(html, inputUrl, normalizedTheme);
      const fallbackCandidates = buildFaviconFallbackCandidates(inputUrl, hostOverride, fallbackUrl, normalizedTheme, { includeChromeFallback: includeChromeFallback });
      const resolved = dedupeAndSortFaviconCandidates([...parsedCandidates, ...fallbackCandidates]);
      faviconResolveCache.set(cacheKey, resolved.slice(0, 8));
      faviconResolvePending.delete(cacheKey);
      return resolved;
    })
    .catch(() => {
      const fallbackCandidates = buildFaviconFallbackCandidates(inputUrl, hostOverride, fallbackUrl, normalizedTheme, { includeChromeFallback: includeChromeFallback });
      const resolved = dedupeAndSortFaviconCandidates(fallbackCandidates);
      faviconResolveCache.set(cacheKey, resolved.slice(0, 8));
      faviconResolvePending.delete(cacheKey);
      return resolved;
    });
  faviconResolvePending.set(cacheKey, promise);
  return promise;
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeDisplayText(text) {
  const raw = String(text || '');
  const withoutSpecial = raw.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\uFFF9-\uFFFD]|\p{Co}/gu, '');
  return withoutSpecial.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function renderHighlightedText(target, text, query, styles) {
  const safeText = sanitizeDisplayText(text);
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
      mark.style.fontFamily = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      mark.textContent = part;
      target.appendChild(mark);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  });
}

function fetchFaviconData(url) {
  if (!url) {
    return Promise.resolve(null);
  }
  if (isBlockedLocalFaviconUrl(url)) {
    logBlockedLocalFavicon(url, 'fetchFaviconData');
    return Promise.resolve(null);
  }
  try {
    const parsed = new URL(url);
    if (isLocalNetworkHost(parsed.hostname)) {
      return Promise.resolve(null);
    }
  } catch (e) {
    // Keep existing behavior for non-standard URL formats.
  }
  if (faviconDataCache.has(url)) {
    return Promise.resolve(faviconDataCache.get(url));
  }
  if (faviconPending.has(url)) {
    return faviconPending.get(url);
  }
  const promise = fetch(url, { cache: 'force-cache' })
    .then((response) => {
      if (!response || !response.ok) {
        return null;
      }
      return response.blob();
    })
    .then((blob) => {
      if (!blob || blob.size > 256 * 1024) {
        return null;
      }
      return blob.arrayBuffer().then((buffer) => {
        const base64 = arrayBufferToBase64(buffer);
        return `data:${blob.type || 'image/png'};base64,${base64}`;
      });
    })
    .then((dataUrl) => {
      if (dataUrl) {
        faviconDataCache.set(url, dataUrl);
      }
      faviconPending.delete(url);
      return dataUrl;
    })
    .catch(() => {
      faviconPending.delete(url);
      return null;
    });
  faviconPending.set(url, promise);
  return promise;
}

function normalizeSiteSearchTemplate(template) {
  if (!template) {
    return '';
  }
  return template
    .replace(/\{\{\{s\}\}\}/g, '{query}')
    .replace(/\{s\}/g, '{query}')
    .replace(/\{searchTerms\}/g, '{query}');
}

function sanitizeSiteSearchProviders(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((item) => item && item.key && item.template)
    .map((item) => ({
      key: String(item.key).trim(),
      aliases: Array.isArray(item.aliases) ? item.aliases.filter(Boolean) : [],
      name: item.name || item.key,
      template: normalizeSiteSearchTemplate(item.template)
    }))
    .filter((item) => item.key && item.template && item.template.includes('{query}'));
}

function loadCustomSiteSearchProviders() {
  return new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([SITE_SEARCH_STORAGE_KEY], (result) => {
      const items = sanitizeSiteSearchProviders(result[SITE_SEARCH_STORAGE_KEY]);
      resolve(items);
    });
  });
}

function loadDisabledSiteSearchKeys() {
  return new Promise((resolve) => {
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
}

function mergeCustomProviders(baseItems, customItems) {
  const merged = [];
  const seen = new Set();
  customItems.forEach((item) => {
    if (item && item.disabled) {
      return;
    }
    const key = String(item.key || '').toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(item);
  });
  baseItems.forEach((item) => {
    const key = String(item.key || '').toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(item);
  });
  return merged;
}

function getTemplateDomain(template) {
  if (!template) {
    return '';
  }
  try {
    const url = template.replace(/\{query\}/g, 'test');
    return normalizeHost(new URL(url).hostname);
  } catch (e) {
    return '';
  }
}

function mergeSiteSearchProviders(localItems, bangList) {
  if (!Array.isArray(localItems) || localItems.length === 0) {
    return [];
  }
  if (!Array.isArray(bangList) || bangList.length === 0) {
    return localItems;
  }
  return localItems.map((item) => {
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    const keys = [item.key, ...aliases].filter(Boolean).map((key) => String(key).toLowerCase());
    const domain = getTemplateDomain(item.template);
    let match = bangList.find((bang) => bang && keys.includes(String(bang.t || '').toLowerCase()));
    if (!match && domain) {
      match = bangList.find((bang) => bang && String(bang.d || '').toLowerCase().includes(domain));
    }
    if (!match || !match.u) {
      return item;
    }
    return {
      key: item.key,
      aliases: item.aliases || [],
      name: item.name || match.s || item.key,
      template: normalizeSiteSearchTemplate(match.u)
    };
  });
}

function parseBangList(text) {
  if (!text) {
    return [];
  }
  let jsonText = text.trim();
  if (jsonText.startsWith('/*')) {
    jsonText = jsonText.replace(/^\/\*.*?\*\/\s*/s, '');
  }
  if (!jsonText.startsWith('[')) {
    return [];
  }
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadSiteSearchProviders() {
  if (siteSearchCache) {
    return Promise.resolve(siteSearchCache);
  }
  if (siteSearchPromise) {
    return siteSearchPromise;
  }
  const localUrl = chrome.runtime.getURL('assets/data/site-search.json');
  siteSearchPromise = fetch(localUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      return sanitizeSiteSearchProviders(items);
    })
    .catch(() => []);
  siteSearchPromise = siteSearchPromise.then((localItems) => {
    return localItems;
  }).then((items) => Promise.all([loadCustomSiteSearchProviders(), loadDisabledSiteSearchKeys()])
    .then(([customItems, disabledKeys]) => {
      const filteredBase = items.filter((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        return key && !disabledKeys.includes(key);
      });
      const merged = mergeCustomProviders(filteredBase, customItems);
      siteSearchCache = merged;
      return merged;
    })).catch(() => {
    return loadCustomSiteSearchProviders().then((customItems) => {
      siteSearchCache = customItems;
      return customItems;
    });
  });
  return siteSearchPromise;
}

function loadShortcutRules() {
  if (shortcutRulesCache) {
    return Promise.resolve(shortcutRulesCache);
  }
  if (shortcutRulesPromise) {
    return shortcutRulesPromise;
  }
  const rulesUrl = chrome.runtime.getURL('assets/data/shortcut-rules.json');
  shortcutRulesPromise = fetch(rulesUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      shortcutRulesCache = items;
      return items;
    })
    .catch(() => []);
  return shortcutRulesPromise;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!storageAreaName || areaName !== storageAreaName) {
    return;
  }
  if (changes[RESTRICTED_ACTION_STORAGE_KEY]) {
    const next = changes[RESTRICTED_ACTION_STORAGE_KEY].newValue;
    restrictedActionCache = next === 'none' ? 'none' : 'default';
    if (typeof next !== 'undefined' && next !== restrictedActionCache && storageArea) {
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: restrictedActionCache });
    }
  }
  if (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY]) {
    return;
  }
  siteSearchCache = null;
  siteSearchPromise = null;
});

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

function getShortcutUrl(query, rules) {
  if (!query || !Array.isArray(rules)) {
    return null;
  }
  const queryLower = query.toLowerCase();
  const scheme = getBrowserInternalScheme();
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (!rule || !Array.isArray(rule.keys)) {
      continue;
    }
    const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
    if (!isMatch) {
      continue;
    }
    if (rule.type === 'browserPage' && rule.path) {
      return `${scheme}${rule.path}`;
    }
    if (rule.type === 'url' && rule.url) {
      return rule.url;
    }
  }
  return null;
}

// Function to get search suggestions from history and top sites
async function getSearchSuggestions(query) {
  const suggestions = [];

  try {
    const [
      engineSuggestions,
      historyItemsRaw,
      topSites,
      bookmarks,
      bookmarkTree
    ] = await Promise.all([
      fetchSearchSuggestionsForEngine(query)
        .then((items) => (Array.isArray(items) ? items.slice(0, 5) : []))
        .catch(() => []),
      new Promise((resolve) => {
        chrome.history.search({
          text: query,
          maxResults: 50,
          startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)
        }, resolve);
      }),
      new Promise((resolve) => {
        chrome.topSites.get(resolve);
      }),
      new Promise((resolve) => {
        chrome.bookmarks.search({ query: query }, resolve);
      }),
      new Promise((resolve) => {
        chrome.bookmarks.getTree(resolve);
      })
    ]);
    let historyItems = Array.isArray(historyItemsRaw) ? historyItemsRaw : [];
    if (historyItems.length === 0 && query && query.trim().length > 0) {
      const fallbackHistoryItems = await new Promise((resolve) => {
        chrome.history.search({
          text: '',
          maxResults: 300,
          startTime: Date.now() - (90 * 24 * 60 * 60 * 1000)
        }, resolve);
      });
      const queryLower = query.toLowerCase();
      historyItems = Array.isArray(fallbackHistoryItems)
        ? fallbackHistoryItems.filter((item) => {
          if (!item || !item.url) {
            return false;
          }
          const titleLower = item.title ? item.title.toLowerCase() : '';
          const urlLower = item.url.toLowerCase();
          return titleLower.includes(queryLower) || urlLower.includes(queryLower);
        })
        : [];
    }

    engineSuggestions.forEach((suggestion) => {
      if (suggestion && suggestion !== query) {
        suggestions.push({
          type: 'googleSuggest',
          title: suggestion,
          url: buildDefaultSearchUrl(suggestion),
          favicon: getDefaultSearchEngineFaviconUrl(),
          score: 200,
          searchQuery: suggestion,
          forceSearch: true
        });
      }
    });

    const bookmarkNodeMap = new Map();
    function indexBookmarkNodes(node, parentId) {
      if (!node || !node.id) {
        return;
      }
      bookmarkNodeMap.set(node.id, {
        title: node.title || '',
        parentId: parentId || null,
        hasUrl: Boolean(node.url)
      });
      if (Array.isArray(node.children)) {
        node.children.forEach((child) => indexBookmarkNodes(child, node.id));
      }
    }
    if (Array.isArray(bookmarkTree)) {
      bookmarkTree.forEach((node) => indexBookmarkNodes(node, null));
    }
    
    // Helper function to calculate relevance score
    function calculateRelevanceScore(item, query) {
      const queryLower = query.toLowerCase();
      const titleLower = item.title ? item.title.toLowerCase() : '';
      const urlLower = item.url.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 0);
      let hostname = '';
      
      let score = 0;
      
      // Exact title match (highest priority)
      if (titleLower === queryLower) score += 100;
      
      // Title starts with query
      if (titleLower.startsWith(queryLower)) score += 50;
      
      // Query words in title
      queryWords.forEach(word => {
        if (titleLower.includes(word)) score += 20;
      });
      
      // Partial title match
      if (titleLower.includes(queryLower)) score += 15;
      
      // URL domain match
      try {
        hostname = normalizeHost(new URL(item.url).hostname);
        if (hostname.includes(queryLower)) score += 10;
        if (hostname.startsWith(queryLower)) score += 20;
      } catch (e) {
        // Invalid URL, skip domain scoring
      }
      
      // URL path match: boost token-level hits so "/release/"-like keywords rank higher.
      if (urlLower.includes(queryLower)) score += 8;
      try {
        const parsedUrl = new URL(item.url);
        const pathnameLower = String(parsedUrl.pathname || '').toLowerCase();
        const decodedPathnameLower = decodeURIComponent(pathnameLower);
        const pathSegments = decodedPathnameLower.split('/').filter(Boolean);
        const pathTokens = [];
        pathSegments.forEach((segment) => {
          const segmentTokens = segment.split(/[^a-z0-9\u4e00-\u9fff]+/i).filter(Boolean);
          if (segmentTokens.length > 0) {
            pathTokens.push(...segmentTokens);
          }
        });
        if (decodedPathnameLower && queryWords.length > 0) {
          queryWords.forEach((word) => {
            if (!word) {
              return;
            }
            if (pathTokens.includes(word)) {
              score += 30;
              return;
            }
            const hasPrefixToken = pathTokens.some((token) => token.startsWith(word));
            if (hasPrefixToken) {
              score += 20;
              return;
            }
            const hasPartialToken = pathTokens.some((token) => token.includes(word));
            if (hasPartialToken) {
              score += 12;
              return;
            }
            if (decodedPathnameLower.includes(word)) {
              score += 8;
            }
          });
        }
      } catch (e) {
        // Ignore invalid URL parsing/decoding errors.
      }

      // Local-network/dev pages should surface earlier for quick workflows.
      if (hostname && isLocalNetworkHost(hostname)) {
        if (titleLower === queryLower) score += 90;
        else if (titleLower.startsWith(queryLower)) score += 70;
        else if (titleLower.includes(queryLower)) score += 45;
        else if (urlLower.includes(queryLower)) score += 20;
      }
      
      // Recency bonus (for history items)
      if (item.lastVisitTime) {
        const daysSinceVisit = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60 * 24);
        if (daysSinceVisit < 1) score += 10;
        else if (daysSinceVisit < 7) score += 5;
        else if (daysSinceVisit < 30) score += 2;
      }
      
      return score;
    }
    
    // Process history items with scoring
    const processedUrls = new Set();
    const suggestionByUrl = new Map();
    const suggestionIndexByUrl = new Map();
    historyItems.forEach(item => {
      if (isSearchEngineResultUrl(item.url)) {
        return;
      }
      if (item.title && !processedUrls.has(item.url)) {
        const score = calculateRelevanceScore(item, query);
        if (score > 0) {
          // Get favicon URL using Google's favicon service (more reliable)
        let faviconUrl = '';
        try {
          const urlObj = new URL(item.url);
          const host = normalizeHost(urlObj.hostname);
          faviconUrl = isLocalNetworkHost(host) ? '' : getGoogleFaviconUrl(host);
        } catch (e) {
          // Fallback to direct favicon URL (skip local network)
          faviconUrl = isLocalNetworkHost(item.url) ? '' : item.url + '/favicon.ico';
        }
        
          const suggestion = {
            type: 'history',
            title: item.title,
            url: item.url,
            favicon: faviconUrl,
            score: score,
            lastVisitTime: item.lastVisitTime || 0
          };
          suggestions.push(suggestion);
          processedUrls.add(item.url);
          suggestionByUrl.set(item.url, suggestion);
          suggestionIndexByUrl.set(item.url, suggestions.length - 1);
        }
      }
    });
    
    // Process top sites with scoring
    const fallbackTopSites = [];
    topSites.forEach(site => {
      if (!site || !site.url || processedUrls.has(site.url)) {
        if (site && site.url) {
          const existing = suggestionByUrl.get(site.url);
          if (existing) {
            existing.isTopSite = true;
            existing.score = (existing.score || 0) + 10;
          }
        }
        return;
      }
      const score = calculateRelevanceScore(site, query);
      let adjustedScore = score;
      if (score > 0) {
        adjustedScore += 20; // Boost top sites so they surface earlier
        const queryLower = query.toLowerCase();
        const titleLower = site.title ? site.title.toLowerCase() : '';
        try {
          const hostname = normalizeHost(new URL(site.url).hostname);
          if (hostname.startsWith(queryLower)) {
            adjustedScore += 15;
          }
        } catch (e) {
          // Ignore invalid URLs
        }
        if (titleLower.startsWith(queryLower)) {
          adjustedScore += 10;
        }
      }
      if (score > 0) {
        let faviconUrl = '';
        try {
          const urlObj = new URL(site.url);
          const host = normalizeHost(urlObj.hostname);
          faviconUrl = isLocalNetworkHost(host) ? '' : getGoogleFaviconUrl(host);
        } catch (e) {
          faviconUrl = isLocalNetworkHost(site.url) ? '' : site.url + '/favicon.ico';
        }
        
        const suggestion = {
          type: 'topSite',
          title: site.title || site.url,
          url: site.url,
          favicon: faviconUrl,
          score: adjustedScore
        };
        suggestions.push(suggestion);
        processedUrls.add(site.url);
        suggestionByUrl.set(site.url, suggestion);
        suggestionIndexByUrl.set(site.url, suggestions.length - 1);
      } else {
        fallbackTopSites.push(site);
      }
    });
    
    // Process bookmarks with scoring
    bookmarks.forEach(bookmark => {
      if (!bookmark.url) {
        return;
      }
      const existingSuggestion = suggestionByUrl.get(bookmark.url);
      const shouldReplaceExisting = existingSuggestion && existingSuggestion.type !== 'bookmark';
      if (!processedUrls.has(bookmark.url) || shouldReplaceExisting) {
        const score = calculateRelevanceScore(bookmark, query);
        // Boost bookmark score slightly to prioritize them
        if (score > 0) {
          const adjustedScore = score + 5; // Bonus for bookmarks
          
          // Get favicon URL using Google's favicon service
          let faviconUrl = '';
          try {
            const urlObj = new URL(bookmark.url);
            const host = normalizeHost(urlObj.hostname);
            faviconUrl = isLocalNetworkHost(host) ? '' : getGoogleFaviconUrl(host);
          } catch (e) {
            // Fallback to direct favicon URL (skip local network)
            faviconUrl = isLocalNetworkHost(bookmark.url) ? '' : bookmark.url + '/favicon.ico';
          }
          
          const pathParts = [];
          let parentId = bookmark.id;
          if (bookmark.parentId) {
            parentId = bookmark.parentId;
          }
          const rootFolderTitles = new Set([
            'Bookmarks bar',
            'Other bookmarks',
            'Mobile bookmarks',
            '书签栏',
            '其他书签',
            '移动设备书签'
          ]);
          while (parentId) {
            const node = bookmarkNodeMap.get(parentId);
            if (!node) {
              break;
            }
            const isRootFolder = !node.parentId && rootFolderTitles.has(node.title);
            if (!node.hasUrl && node.title && !isRootFolder) {
              pathParts.unshift(node.title);
            }
            parentId = node.parentId;
          }
          const bookmarkPath = pathParts.join('/');

          const suggestion = {
            type: 'bookmark',
            title: bookmark.title || bookmark.url,
            url: bookmark.url,
            favicon: faviconUrl,
            path: bookmarkPath,
            score: adjustedScore
          };
          const existingIndex = suggestionIndexByUrl.get(bookmark.url);
          if (shouldReplaceExisting && typeof existingIndex === 'number') {
            suggestions[existingIndex] = suggestion;
            suggestionIndexByUrl.set(bookmark.url, existingIndex);
          } else {
            suggestions.push(suggestion);
            suggestionIndexByUrl.set(bookmark.url, suggestions.length - 1);
          }
          processedUrls.add(bookmark.url);
          suggestionByUrl.set(bookmark.url, suggestion);
        }
      }
    });
    
    // Sort by top site, then relevance, then recency
    suggestions.sort((a, b) => {
      const aTop = a.isTopSite || a.type === 'topSite';
      const bTop = b.isTopSite || b.type === 'topSite';
      if (aTop !== bTop) {
        return aTop ? -1 : 1;
      }
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const aVisit = a.lastVisitTime || 0;
      const bVisit = b.lastVisitTime || 0;
      return bVisit - aVisit;
    });
    
    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.url === suggestion.url)
    ).slice(0, 12); // Increased limit before title deduplication
    
    // Also remove duplicates by title to avoid similar entries
    const dedupedByTitle = [];
    const titleIndexMap = new Map();
    uniqueSuggestions.forEach((suggestion) => {
      const titleKey = (suggestion.title || '').toLowerCase();
      if (!titleKey) {
        dedupedByTitle.push(suggestion);
        return;
      }
      if (!titleIndexMap.has(titleKey)) {
        titleIndexMap.set(titleKey, dedupedByTitle.length);
        dedupedByTitle.push(suggestion);
        return;
      }
      const existingIndex = titleIndexMap.get(titleKey);
      const existing = dedupedByTitle[existingIndex];
      if (suggestion.type === 'bookmark' && existing.type !== 'bookmark') {
        dedupedByTitle[existingIndex] = suggestion;
      }
    });
    let finalSuggestions = dedupedByTitle;

    const hostCounts = new Map();
    finalSuggestions = finalSuggestions.filter((suggestion) => {
      if (!suggestion.url) {
        return true;
      }
      let hostname = '';
      try {
        hostname = normalizeHost(new URL(suggestion.url).hostname);
      } catch (e) {
        return true;
      }
      const current = hostCounts.get(hostname) || 0;
      if (current >= 2) {
        return false;
      }
      hostCounts.set(hostname, current + 1);
      return true;
    }).slice(0, 8);

    if (finalSuggestions.length === 0 && fallbackTopSites.length > 0) {
      const fallbackResults = fallbackTopSites.slice(0, 3).map((site, index) => {
        let faviconUrl = '';
        try {
          const urlObj = new URL(site.url);
          const host = normalizeHost(urlObj.hostname);
          faviconUrl = isLocalNetworkHost(host) ? '' : getGoogleFaviconUrl(host);
        } catch (e) {
          faviconUrl = isLocalNetworkHost(site.url) ? '' : site.url + '/favicon.ico';
        }
        return {
          type: 'topSite',
          title: site.title || site.url,
          url: site.url,
          favicon: faviconUrl,
          score: 1 - index
        };
      });
      finalSuggestions = fallbackResults;
    }
    
    console.log('Search suggestions:', finalSuggestions);
    return finalSuggestions;
    
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

  async function toggleBlackRectangle(tabs) {
  let captureTabHandler = null;
  let overlayThemeStorageListener = null;
  let overlayLanguageStorageListener = null;
  let overlaySearchEngineStorageListener = null;
  let overlayTabPriorityStorageListener = null;
  let overlayThemeMediaListener = null;
  let overlayPageThemeObserver = null;
  let overlayPageThemeSyncRaf = null;
  let siteSearchStorageListener = null;
  let keydownHandler = null;
  let overlayKeyCaptureHandler = null;
  let clickOutsideHandler = null;
  let overlayEnterAnimationRafA = null;
  let overlayEnterAnimationRafB = null;
  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
  const storageArea = (chrome && chrome.storage && chrome.storage.sync)
    ? chrome.storage.sync
    : (chrome && chrome.storage ? chrome.storage.local : null);
  const storageAreaName = storageArea
    ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null;
  const RI_CSS_URL = (chrome && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('assets/remixicon/fonts/remixicon.css')
    : 'assets/remixicon/fonts/remixicon.css';
  const OPEN_SANS_CSS_URL = (chrome && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('assets/fonts/open-sans/open-sans.css')
    : 'assets/fonts/open-sans/open-sans.css';
  const overlayMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let overlayThemeMode = 'system';
  let overlayThemeListenerAttached = false;

  function stopOverlayPageThemeObserver() {
    if (overlayPageThemeSyncRaf !== null) {
      cancelAnimationFrame(overlayPageThemeSyncRaf);
      overlayPageThemeSyncRaf = null;
    }
    if (overlayPageThemeObserver) {
      overlayPageThemeObserver.disconnect();
      overlayPageThemeObserver = null;
    }
  }

  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function sanitizeDisplayText(text) {
    const raw = String(text || '');
    const withoutSpecial = raw.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\uFFF9-\uFFFD]|\p{Co}/gu, '');
    return withoutSpecial.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  }

  function renderHighlightedText(target, text, query, styles) {
    const safeText = sanitizeDisplayText(text);
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
        mark.style.fontFamily = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
        mark.textContent = part;
        target.appendChild(mark);
      } else {
        target.appendChild(document.createTextNode(part));
      }
    });
  }

  function applyNoTranslate(element) {
    if (!element || !element.setAttribute) {
      return element;
    }
    element.setAttribute('translate', 'no');
    element.setAttribute('lang', 'zxx');
    element.setAttribute('data-no-translate', 'true');
    if (element.classList) {
      element.classList.add('notranslate');
    }
    return element;
  }
  let modeBadge = null;
  let overlayLanguageMode = 'system';
  let overlayTabQuickSwitchEnabled = true;
  let currentMessages = null;
  let defaultPlaceholderText = '搜索或输入网址...';
  let lastSuggestionResponse = [];
  let overlaySearchEngineState = {
    id: '',
    name: '',
    host: '',
    searchTemplate: ''
  };

  async function ensureRemixIconStyles() {
    if (document.getElementById('_x_extension_remixicon_css_2024_unique_')) {
      return;
    }
    const host = document.head || document.documentElement;
    if (!host) {
      return;
    }
    const link = document.createElement('link');
    link.id = '_x_extension_remixicon_css_2024_unique_';
    link.rel = 'stylesheet';
    link.href = RI_CSS_URL;
    host.appendChild(link);
  }

  async function ensureOpenSansStyles() {
    if (document.getElementById('_x_extension_open_sans_css_2024_unique_')) {
      return;
    }
    const host = document.head || document.documentElement;
    if (!host) {
      return;
    }
    const link = document.createElement('link');
    link.id = '_x_extension_open_sans_css_2024_unique_';
    link.rel = 'stylesheet';
    link.href = OPEN_SANS_CSS_URL;
    host.appendChild(link);
  }

  await ensureOpenSansStyles();
  await ensureRemixIconStyles();

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

  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function loadLocaleMessages(locale) {
    const normalized = normalizeLocale(locale);
    if (!chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
      return Promise.resolve({});
    }
    const localePath = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
    if (!localePath || localePath.startsWith('chrome-extension://invalid/')) {
      return new Promise((resolve) => {
        if (!chrome.runtime.sendMessage) {
          resolve({});
          return;
        }
        chrome.runtime.sendMessage({ action: 'getLocaleMessages', locale: normalized }, (response) => {
          resolve((response && response.messages) || {});
        });
      });
    }
    return fetch(localePath)
      .then((response) => response.json())
      .catch(() => new Promise((resolve) => {
        if (!chrome.runtime.sendMessage) {
          resolve({});
          return;
        }
        chrome.runtime.sendMessage({ action: 'getLocaleMessages', locale: normalized }, (response) => {
          resolve((response && response.messages) || {});
        });
      }));
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

  function normalizeOverlayTabPriorityMode(mode) {
    if (mode === 'switchTabFirst') {
      return true;
    }
    if (mode === 'newtabFirst') {
      return false;
    }
    if (mode === false) {
      return false;
    }
    return true;
  }

  function getRiSvg(id, sizeClass, extraClass) {
    const size = sizeClass || 'ri-size-16';
    const extra = extraClass ? ` ${extraClass}` : '';
    return `<i class="ri-icon ${size}${extra} ${id}" aria-hidden="true"></i>`;
  }

  function buildSearchUrlFromTemplate(template, query) {
    if (!template) {
      return '';
    }
    return template.replace(/\{query\}/g, encodeURIComponent(query || ''));
  }

  function getOverlaySearchEngineState() {
    return overlaySearchEngineState || {};
  }

  function buildDefaultSearchUrlForOverlay(query) {
    const state = getOverlaySearchEngineState();
    if (state.searchTemplate) {
      return buildSearchUrlFromTemplate(state.searchTemplate, query);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function getDefaultSearchEngineFaviconUrlForOverlay() {
    const state = getOverlaySearchEngineState();
    if (state.host) {
      return `https://${state.host}/favicon.ico`;
    }
    if (state.searchTemplate) {
      try {
        const url = buildSearchUrlFromTemplate(state.searchTemplate, 'test');
        const host = new URL(url).hostname;
        return `https://${host}/favicon.ico`;
      } catch (e) {
        return '';
      }
    }
    return 'https://www.google.com/favicon.ico';
  }

  function getDefaultSearchEngineThemeUrlForOverlay() {
    const state = getOverlaySearchEngineState();
    if (state.searchTemplate) {
      return buildSearchUrlFromTemplate(state.searchTemplate, 'test');
    }
    if (state.host) {
      return `https://${state.host}`;
    }
    return 'https://www.google.com';
  }

  function getSearchActionLabel() {
    const state = getOverlaySearchEngineState();
    if (state.name) {
      return formatMessage('action_search_engine', '在 {engine} 中搜索', {
        engine: state.name
      });
    }
    return t('action_search', '搜索');
  }

  function loadOverlaySearchEngineState() {
    if (!storageArea) {
      return;
    }
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id) {
        overlaySearchEngineState = stored;
        if (latestOverlayQuery) {
          updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
        }
      }
    });
  }


  function isLocalNetworkHost(hostname) {
    const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) {
      return false;
    }
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === 'host.docker.internal'
    ) {
      return true;
    }
    if (/^\d{1,3}(?:\.\d{1,3}){0,2}$/.test(host)) {
      const shortParts = host.split('.').map((part) => Number(part));
      if (shortParts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
        return true;
      }
    }
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      const parts = host.split('.').map((part) => Number(part));
      if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return false;
      }
      if (
        parts[0] === 0 ||
        parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 169 && parts[1] === 254)
      ) {
        return true;
      }
      if (parts[0] === 192 && parts[1] === 168) {
        return true;
      }
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        return true;
      }
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
        return true;
      }
    }
    const ipv6 = host.split('%')[0];
    if (
      ipv6 === '::1' ||
      ipv6 === '0:0:0:0:0:0:0:1' ||
      ipv6 === '::' ||
      /^fe[89ab][0-9a-f]*:/i.test(ipv6) ||
      /^[fd][0-9a-f]{1,3}:/i.test(ipv6)
    ) {
      return true;
    }
    const mappedIpv4 = ipv6.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (mappedIpv4 && mappedIpv4[1]) {
      return isLocalNetworkHost(mappedIpv4[1]);
    }
    return false;
  }

  function isLocalNetworkInput(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) {
      return false;
    }
    const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    const authority = withoutScheme.split(/[/?#]/)[0] || '';
    const host = authority.includes('@') ? authority.split('@').pop() : authority;
    const normalizedHost = (() => {
      const value = String(host || '').trim().toLowerCase();
      if (!value) {
        return '';
      }
      if (value.startsWith('[')) {
        const endBracket = value.indexOf(']');
        if (endBracket > 1) {
          return value.slice(1, endBracket);
        }
      }
      return value.replace(/^\[|\]$/g, '').split(':')[0];
    })();
    if (!normalizedHost) {
      return false;
    }
    return isLocalNetworkHost(normalizedHost);
  }
  function clearOverlayEnterAnimationFrames() {
    if (overlayEnterAnimationRafA !== null) {
      cancelAnimationFrame(overlayEnterAnimationRafA);
      overlayEnterAnimationRafA = null;
    }
    if (overlayEnterAnimationRafB !== null) {
      cancelAnimationFrame(overlayEnterAnimationRafB);
      overlayEnterAnimationRafB = null;
    }
  }

  // Helper function to remove overlay and clean up styles
  function removeOverlay(overlayElement) {
    clearOverlayEnterAnimationFrames();
    if (overlayElement) {
      overlayElement.remove();
    }
    // Also remove the scrollbar style
    const scrollbarStyle = document.getElementById('_x_extension_scrollbar_style_2024_unique_');
    if (scrollbarStyle) {
      scrollbarStyle.remove();
    }
    const overlayThemeStyle = document.getElementById('_x_extension_overlay_theme_style_2024_unique_');
    if (overlayThemeStyle) {
      overlayThemeStyle.remove();
    }
    if (captureTabHandler) {
      document.removeEventListener('keydown', captureTabHandler, true);
      captureTabHandler = null;
    }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (clickOutsideHandler) {
      document.removeEventListener('click', clickOutsideHandler);
      clickOutsideHandler = null;
    }
    if (overlayKeyCaptureHandler) {
      window.removeEventListener('keydown', overlayKeyCaptureHandler, true);
      overlayKeyCaptureHandler = null;
    }
    if (overlayThemeStorageListener) {
      chrome.storage.onChanged.removeListener(overlayThemeStorageListener);
      overlayThemeStorageListener = null;
    }
    if (overlayLanguageStorageListener) {
      chrome.storage.onChanged.removeListener(overlayLanguageStorageListener);
      overlayLanguageStorageListener = null;
    }
    if (overlaySearchEngineStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySearchEngineStorageListener);
      overlaySearchEngineStorageListener = null;
    }
    if (overlayTabPriorityStorageListener) {
      chrome.storage.onChanged.removeListener(overlayTabPriorityStorageListener);
      overlayTabPriorityStorageListener = null;
    }
    if (overlayThemeMediaListener) {
      overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
      overlayThemeMediaListener = null;
    }
    stopOverlayPageThemeObserver();
    if (siteSearchStorageListener) {
      chrome.storage.onChanged.removeListener(siteSearchStorageListener);
      siteSearchStorageListener = null;
    }
    window.removeEventListener('resize', updateSiteSearchPrefixLayout);
  }
  
  // Check if the overlay already exists
  let overlay = document.getElementById('_x_extension_overlay_2024_unique_');
  
  if (overlay) {
    // If it exists, remove it (toggle off)
    removeOverlay(overlay);
  } else {
    // If it doesn't exist, create it (toggle on)
    overlay = document.createElement('div');
    overlay.id = '_x_extension_overlay_2024_unique_';
    applyNoTranslate(overlay);
    overlay.style.cssText = `
      all: unset !important;
      position: fixed !important;
      top: 20vh !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(10px) scale(0.985) !important;
      transform-origin: top center !important;
      width: 760px !important;
      max-width: calc(100vw - 24px) !important;
      max-height: 75vh !important;
      background: var(--x-ov-bg, rgba(255, 255, 255, 0.82)) !important;
      backdrop-filter: blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%)) !important;
      -webkit-backdrop-filter: blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%)) !important;
      border: 1px solid var(--x-ov-border, rgba(0, 0, 0, 0.08)) !important;
      border-radius: 28px !important;
      box-shadow: var(--x-ov-shadow, 0 17px 120px 0 rgba(0, 0, 0, 0.05), 0 32px 44.5px 0 rgba(0, 0, 0, 0.10), 0 80px 120px 0 rgba(0, 0, 0, 0.15)) !important;
      z-index: 2147483647 !important;
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      color: var(--x-ov-text, #111827) !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
      opacity: 0 !important;
      filter: blur(6px) !important;
      will-change: transform, opacity, filter !important;
      transition: transform 340ms cubic-bezier(0.2, 1, 0.36, 1), opacity 220ms ease, filter 300ms ease !important;
    `;


    const applyOverlayTheme = (mode) => {
      overlayThemeMode = mode;
      const previousResolvedTheme = overlay ? overlay.getAttribute('data-theme') : '';
      applyOverlayThemeVariables(overlay, mode);
      const nextResolvedTheme = overlay ? overlay.getAttribute('data-theme') : '';
      suggestionItems.forEach((item) => {
        if (item && item._xTheme) {
          applyThemeVariables(item, item._xTheme);
        }
      });
      updateSelection();
      updateModeBadge(searchInput ? searchInput.value : '');
      if (previousResolvedTheme !== nextResolvedTheme) {
        refreshOverlayThemeAwareFavicons();
      }
      if (mode === 'system') {
        startOverlayPageThemeObserver();
        if (!overlayThemeListenerAttached) {
          overlayThemeMediaListener = function() {
            if (overlayThemeMode === 'system') {
              // 仅更新容器变量会导致建议项主题变量滞后，系统主题切换时完整刷新。
              applyOverlayTheme('system');
            }
          };
          overlayMediaQuery.addEventListener('change', overlayThemeMediaListener);
          overlayThemeListenerAttached = true;
        }
        return;
      }
      stopOverlayPageThemeObserver();
      if (overlayThemeListenerAttached) {
        overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
        overlayThemeMediaListener = null;
        overlayThemeListenerAttached = false;
      }
    };
    
    // 使用系统字体，避免外链字体依赖。
    
    // Add style to hide scrollbars for WebKit browsers
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.id = '_x_extension_scrollbar_style_2024_unique_';
    scrollbarStyle.textContent = `
      #_x_extension_overlay_2024_unique_ *::-webkit-scrollbar {
        display: none !important;
      }
      #_x_extension_overlay_2024_unique_ * {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `;
    document.head.appendChild(scrollbarStyle);

    const overlayThemeStyle = document.createElement('style');
    overlayThemeStyle.id = '_x_extension_overlay_theme_style_2024_unique_';
    overlayThemeStyle.textContent = `
      #_x_extension_overlay_2024_unique_ .ri-icon {
        width: var(--ri-size, 16px);
        height: var(--ri-size, 16px);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        font-size: var(--ri-size, 16px);
        flex-shrink: 0;
      }
      #_x_extension_overlay_2024_unique_ .ri-size-8 { --ri-size: 8px; }
      #_x_extension_overlay_2024_unique_ .ri-size-12 { --ri-size: 12px; }
      #_x_extension_overlay_2024_unique_ .ri-size-16 { --ri-size: 16px; }
      #_x_extension_overlay_2024_unique_ .ri-size-20 { --ri-size: 20px; }
      #_x_extension_overlay_2024_unique_ .ri-size-24 { --ri-size: 24px; }
      #_x_extension_search_input_2024_unique_ {
        text-align: left !important;
      }
      #_x_extension_search_input_2024_unique_::placeholder {
        color: var(--x-ov-placeholder, #9CA3AF) !important;
        text-align: left !important;
      }
      #_x_extension_search_input_2024_unique_::selection {
        background: #CFE8FF !important;
        color: #1E3A8A !important;
      }
    `;
    document.head.appendChild(overlayThemeStyle);

    
    if (typeof window._x_extension_createSearchInput_2024_unique_ !== 'function') {
      console.warn('Lumno: input UI helper not available.');
      removeOverlay(overlay);
      return;
    }

    const inputParts = window._x_extension_createSearchInput_2024_unique_({
      placeholder: t('search_placeholder', defaultPlaceholderText),
      inputId: '_x_extension_search_input_2024_unique_',
      iconId: '_x_extension_search_icon_2024_unique_',
      containerId: '_x_extension_input_container_2024_unique_',
      rightIconUrl: chrome.runtime.getURL('assets/images/lumno-input-light.png'),
      rightIconStyleOverrides: {
        cursor: 'pointer'
      },
      showUnderlineWhenEmpty: true
    });
    const searchInput = inputParts.input;
    const inputContainer = inputParts.container;
    const rightIcon = inputParts.rightIcon;
    applyNoTranslate(searchInput);
    applyNoTranslate(inputContainer);
    applyNoTranslate(rightIcon);
    modeBadge = document.createElement('div');
    modeBadge.id = '_x_extension_mode_badge_2024_unique_';
    applyNoTranslate(modeBadge);
    modeBadge.style.cssText = `
      all: unset !important;
      position: absolute !important;
      right: 52px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      display: none !important;
      align-items: center !important;
      gap: 6px !important;
      background: var(--x-ov-tag-bg, #F3F4F6) !important;
      color: var(--x-ov-tag-text, #6B7280) !important;
      border: 1px solid var(--x-ov-border, rgba(0, 0, 0, 0.08)) !important;
      border-radius: 999px !important;
      padding: 4px 8px !important;
      font-size: 11px !important;
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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
    inputContainer.appendChild(modeBadge);


    function applyLanguageStrings() {
      if (searchInput) {
        defaultPlaceholderText = t('search_placeholder', defaultPlaceholderText);
        if (!siteSearchState) {
          searchInput.placeholder = defaultPlaceholderText;
        }
      }
      if (modeBadge) {
        updateModeBadge(searchInput ? searchInput.value : '');
      }
      if (siteSearchState) {
        setSiteSearchPrefix(siteSearchState);
        updateSiteSearchPrefixLayout();
      }
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      } else if (Array.isArray(tabs) && tabs.length > 0) {
        renderTabSuggestions(tabs);
      }
    }

    function applyLanguageMode(mode) {
      overlayLanguageMode = mode || 'system';
      const targetLocale = overlayLanguageMode === 'system'
        ? getSystemLocale()
        : normalizeLocale(overlayLanguageMode);
      if (storageArea) {
        storageArea.get([LANGUAGE_MESSAGES_STORAGE_KEY], (result) => {
          const payload = result[LANGUAGE_MESSAGES_STORAGE_KEY];
          if (payload && payload.locale === targetLocale && payload.messages) {
            currentMessages = payload.messages || {};
            applyLanguageStrings();
            return;
          }
          loadLocaleMessages(targetLocale).then((messages) => {
            currentMessages = messages || {};
            applyLanguageStrings();
          });
        });
        return;
      }
      loadLocaleMessages(targetLocale).then((messages) => {
        currentMessages = messages || {};
        applyLanguageStrings();
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
      if (overlayThemeMode === 'system') {
        const pageTheme = detectPageTheme();
        if (pageTheme) {
          modeBadge.textContent = formatMessage('mode_badge_follow_site', '模式：{mode}（跟随网站）', {
            mode: getThemeModeLabel(pageTheme)
          });
        } else {
          const systemResolved = overlayMediaQuery.matches ? 'dark' : 'light';
          modeBadge.textContent = formatMessage('mode_badge_follow_system', '模式：{mode}（跟随系统）', {
            mode: getThemeModeLabel(systemResolved)
          });
        }
      } else {
        modeBadge.textContent = formatMessage('mode_badge', '模式：{mode}', {
          mode: getThemeModeLabel(overlayThemeMode)
        });
      }
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
      const nextMode = getNextThemeMode(overlayThemeMode || 'system');
      return {
        type: 'modeSwitch',
        title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
          name: 'Lumno',
          mode: getThemeModeLabel(nextMode)
        }),
        url: '',
        favicon: chrome.runtime.getURL('assets/images/lumno.png'),
        nextMode: nextMode
      };
    }

    function applyThemeModeChange(mode) {
      const nextMode = mode || 'system';
      if (storageArea) {
        storageArea.set({ [THEME_STORAGE_KEY]: nextMode });
      }
      applyOverlayTheme(nextMode);
      if (isModeCommand(searchInput.value || '')) {
        updateSearchSuggestions([], (searchInput.value || '').trim());
      }
    }

    if (rightIcon) {
      rightIcon.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        removeOverlay(overlay);
        if (clickOutsideHandler) {
          document.removeEventListener('click', clickOutsideHandler);
        }
        if (keydownHandler) {
          document.removeEventListener('keydown', keydownHandler);
        }
        if (captureTabHandler) {
          document.removeEventListener('keydown', captureTabHandler, true);
        }
      });
    }

    // Add focus styles
    searchInput.addEventListener('focus', function() {
      selectedIndex = -1;
      updateSelection();
    });
    
    searchInput.addEventListener('blur', function() {
      // Don't change selectedIndex here to allow keyboard navigation
    });
    
    let latestOverlayQuery = '';
    let latestRawInputValue = '';
    let lastDeletionAt = 0;
    let autocompleteState = null;
    let inlineSearchState = null;
    let siteSearchTriggerState = null;
    let isComposing = false;
    let siteSearchState = null;
    const defaultPlaceholder = searchInput.placeholder;
    let siteSearchProvidersCache = null;
    let pendingProviderReload = false;
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
    const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
    let baseInputPaddingLeft = null;
    const prefixGap = 6;

    function mixColor(color, target, amount) {
      return [
        Math.round(color[0] + (target[0] - color[0]) * amount),
        Math.round(color[1] + (target[1] - color[1]) * amount),
        Math.round(color[2] + (target[2] - color[2]) * amount)
      ];
    }

    function rgbToCss(rgb) {
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
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
          bg: 'var(--x-ov-hover-bg, #F3F4F6)',
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
    const overlayThemeTokens = {
      light: {
        bg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.84) 100%)',
        border: 'rgba(0, 0, 0, 0.14)',
        shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 16px 40px rgba(15, 23, 42, 0.12), 0 40px 90px rgba(15, 23, 42, 0.12)',
        text: '#111827',
        subtext: '#6B7280',
        link: '#2563EB',
        placeholder: '#9CA3AF',
        hoverBg: 'rgba(200, 208, 218, 0.45)',
        tagBg: '#F3F4F6',
        tagText: '#6B7280',
        bookmarkTagBg: '#FEF3C7',
        bookmarkTagText: '#D97706',
        underline: '#E5E7EB',
        dividerOpacity: '0.5',
        dividerInset: '24px',
        blur: '14px',
        saturate: '175%'
      },
      dark: {
        bg: 'rgba(20, 20, 20, 0.62)',
        border: 'rgba(255, 255, 255, 0.16)',
        shadow: '0 24px 90px rgba(0, 0, 0, 0.65)',
        text: '#E5E7EB',
        subtext: '#9CA3AF',
        link: '#D1D5DB',
        placeholder: '#9CA3AF',
        hoverBg: 'rgba(255, 255, 255, 0.08)',
        tagBg: 'rgba(255, 255, 255, 0.12)',
        tagText: '#E5E7EB',
        bookmarkTagBg: 'rgba(245, 158, 11, 0.22)',
        bookmarkTagText: '#FBBF24',
        underline: 'rgba(255, 255, 255, 0.18)',
        dividerOpacity: '0.35',
        dividerInset: '24px',
        blur: '40px',
        saturate: '145%'
      }
    };
    function resolveOverlayTheme(mode) {
      if (mode === 'dark') {
        return 'dark';
      }
      if (mode === 'light') {
        return 'light';
      }
      const pageTheme = detectPageTheme();
      if (pageTheme) {
        return pageTheme;
      }
      return overlayMediaQuery.matches ? 'dark' : 'light';
    }

    function detectPageTheme() {
      const docEl = document.documentElement;
      const body = document.body;
      if (!docEl) {
        return null;
      }
      // Some sites use boolean dark/light attributes instead of data-theme tokens.
      if (docEl.hasAttribute('dark') || (body && body.hasAttribute('dark'))) {
        return 'dark';
      }
      if (docEl.hasAttribute('light') || (body && body.hasAttribute('light'))) {
        return 'light';
      }
      const darkAttrNode = document.querySelector(
        'html[dark], body[dark], ytd-app[dark], ytm-app[dark], [data-dark], [dark-mode], [theme="dark"], [color-scheme="dark"], [data-color-mode="dark"], [data-mode="dark"], [data-appearance="dark"]'
      );
      if (darkAttrNode) {
        return 'dark';
      }
      const lightAttrNode = document.querySelector(
        '[theme="light"], [color-scheme="light"], [data-color-mode="light"], [data-mode="light"], [data-appearance="light"]'
      );
      if (lightAttrNode) {
        return 'light';
      }
      const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
      if (colorSchemeMeta) {
        const metaContent = String(colorSchemeMeta.getAttribute('content') || '').toLowerCase();
        if (metaContent.includes('dark') && !metaContent.includes('light')) {
          return 'dark';
        }
        if (metaContent.includes('light') && !metaContent.includes('dark')) {
          return 'light';
        }
      }
      const schemeValue = (window.getComputedStyle(docEl).colorScheme || '').toLowerCase();
      if (schemeValue.includes('dark') && !schemeValue.includes('light')) {
        return 'dark';
      }
      if (schemeValue.includes('light') && !schemeValue.includes('dark')) {
        return 'light';
      }
      const attrCandidates = [
        docEl.getAttribute('data-theme'),
        docEl.getAttribute('data-color-scheme'),
        docEl.getAttribute('data-color-mode'),
        docEl.getAttribute('data-mode'),
        docEl.getAttribute('data-appearance'),
        docEl.getAttribute('color-scheme'),
        docEl.getAttribute('theme'),
        docEl.getAttribute('data-bs-theme'),
        body ? body.getAttribute('data-theme') : null,
        body ? body.getAttribute('data-color-scheme') : null,
        body ? body.getAttribute('data-color-mode') : null,
        body ? body.getAttribute('data-mode') : null,
        body ? body.getAttribute('data-appearance') : null,
        body ? body.getAttribute('color-scheme') : null,
        body ? body.getAttribute('theme') : null,
        body ? body.getAttribute('data-bs-theme') : null
      ];
      for (let i = 0; i < attrCandidates.length; i += 1) {
        const value = String(attrCandidates[i] || '').toLowerCase();
        if (!value) {
          continue;
        }
        if (
          value.includes('dark') ||
          value.includes('night') ||
          value === '1' ||
          value === 'true' ||
          value === 'on'
        ) {
          return 'dark';
        }
        if (
          value.includes('light') ||
          value.includes('day') ||
          value === '0' ||
          value === 'false' ||
          value === 'off'
        ) {
          return 'light';
        }
      }
      const classTokens = [
        docEl.className || '',
        body ? body.className || '' : ''
      ];
      for (let i = 0; i < classTokens.length; i += 1) {
        const classText = String(classTokens[i] || '').toLowerCase();
        const tokenList = classText.split(/\s+/);
        if (tokenList.includes('dark')) {
          return 'dark';
        }
        if (tokenList.includes('light')) {
          return 'light';
        }
        if (/(^|[\s_-])(dark|darkmode|dark-theme|theme-dark|night)([\s_-]|$)/.test(classText)) {
          return 'dark';
        }
        if (/(^|[\s_-])(light|lightmode|light-theme|theme-light|day)([\s_-]|$)/.test(classText)) {
          return 'light';
        }
      }
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        const themeColor = String(themeColorMeta.getAttribute('content') || '').trim();
        const rgb = parseCssColor(themeColor);
        if (rgb && rgb.length === 3) {
          return getLuminance(rgb) < 0.42 ? 'dark' : 'light';
        }
      }
      const bodyStyle = body ? window.getComputedStyle(body) : null;
      const docStyle = window.getComputedStyle(docEl);
      const bgColor = (bodyStyle && bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'transparent')
        ? bodyStyle.backgroundColor
        : docStyle.backgroundColor;
      const rgb = parseCssColor(bgColor);
      if (rgb && rgb.length === 3) {
        return getLuminance(rgb) < 0.42 ? 'dark' : 'light';
      }
      return null;
    }

    function scheduleOverlayPageThemeSync() {
      if (overlayPageThemeSyncRaf !== null) {
        return;
      }
      overlayPageThemeSyncRaf = requestAnimationFrame(() => {
        overlayPageThemeSyncRaf = null;
        if (!overlay || !overlay.isConnected || overlayThemeMode !== 'system') {
          return;
        }
        applyOverlayTheme('system');
      });
    }

    function startOverlayPageThemeObserver() {
      if (overlayPageThemeObserver || overlayThemeMode !== 'system') {
        return;
      }
      const themeAttrFilter = [
        'class',
        'style',
        'data-theme',
        'data-color-scheme',
        'data-color-mode',
        'data-mode',
        'data-appearance',
        'theme',
        'color-scheme',
        'dark',
        'light',
        'data-bs-theme'
      ];
      overlayPageThemeObserver = new MutationObserver(() => {
        scheduleOverlayPageThemeSync();
      });
      const docEl = document.documentElement;
      if (docEl) {
        overlayPageThemeObserver.observe(docEl, {
          attributes: true,
          attributeFilter: themeAttrFilter
        });
      }
      const body = document.body;
      if (body) {
        overlayPageThemeObserver.observe(body, {
          attributes: true,
          attributeFilter: themeAttrFilter
        });
      }
      const head = document.head;
      if (head) {
        overlayPageThemeObserver.observe(head, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['name', 'content', 'media']
        });
      }
      scheduleOverlayPageThemeSync();
    }

    function applyOverlayThemeVariables(target, mode) {
      if (!target) {
        return;
      }
      const resolved = resolveOverlayTheme(mode);
      const tokens = overlayThemeTokens[resolved] || overlayThemeTokens.light;
      target.setAttribute('data-theme', resolved);
      target.style.setProperty('--x-ov-bg', tokens.bg, 'important');
      target.style.setProperty('--x-ov-border', tokens.border, 'important');
      target.style.setProperty('--x-ov-shadow', tokens.shadow, 'important');
      target.style.setProperty('--x-ov-text', tokens.text, 'important');
      target.style.setProperty('--x-ov-subtext', tokens.subtext, 'important');
      target.style.setProperty('--x-ov-link', tokens.link, 'important');
      target.style.setProperty('--x-ov-placeholder', tokens.placeholder, 'important');
      target.style.setProperty('--x-ov-hover-bg', tokens.hoverBg, 'important');
      target.style.setProperty('--x-ov-tag-bg', tokens.tagBg, 'important');
      target.style.setProperty('--x-ov-tag-text', tokens.tagText, 'important');
      target.style.setProperty('--x-ov-bookmark-tag-bg', tokens.bookmarkTagBg, 'important');
      target.style.setProperty('--x-ov-bookmark-tag-text', tokens.bookmarkTagText, 'important');
      target.style.setProperty('--x-ov-blur', tokens.blur, 'important');
      target.style.setProperty('--x-ov-saturate', tokens.saturate, 'important');
      target.style.setProperty('--x-ext-input-text', tokens.text, 'important');
      target.style.setProperty('--x-ext-input-caret', tokens.link, 'important');
      target.style.setProperty('--x-ext-input-icon', tokens.subtext, 'important');
      target.style.setProperty('--x-ext-input-underline', tokens.underline, 'important');
      target.style.setProperty('--x-ext-input-divider-inset', tokens.dividerInset, 'important');
      target.style.setProperty('--x-ext-input-divider-opacity', tokens.dividerOpacity, 'important');
    }

    if (storageArea) {
      storageArea.get([THEME_STORAGE_KEY], (result) => {
        applyOverlayTheme(result[THEME_STORAGE_KEY] || 'system');
      });
    }
    overlayThemeStorageListener = (changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName || !changes[THEME_STORAGE_KEY]) {
        return;
      }
      applyOverlayTheme(changes[THEME_STORAGE_KEY].newValue || 'system');
    };
    chrome.storage.onChanged.addListener(overlayThemeStorageListener);

    if (storageArea) {
      storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
        applyLanguageMode(result[LANGUAGE_STORAGE_KEY] || 'system');
      });
    }
    overlayLanguageStorageListener = (changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName) {
        return;
      }
      if (changes[LANGUAGE_STORAGE_KEY]) {
        applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
      }
      if (changes[LANGUAGE_MESSAGES_STORAGE_KEY]) {
        const payload = changes[LANGUAGE_MESSAGES_STORAGE_KEY].newValue;
        const targetLocale = overlayLanguageMode === 'system'
          ? getSystemLocale()
          : normalizeLocale(overlayLanguageMode);
        if (payload && payload.locale === targetLocale && payload.messages) {
          currentMessages = payload.messages || {};
          applyLanguageStrings();
        }
      }
    };
    chrome.storage.onChanged.addListener(overlayLanguageStorageListener);

    loadOverlaySearchEngineState();
    overlaySearchEngineStorageListener = (changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName || !changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
        return;
      }
      const nextValue = changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY].newValue;
      if (nextValue && nextValue.id) {
        overlaySearchEngineState = nextValue;
        if (latestOverlayQuery) {
          updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
        }
      }
    };
    chrome.storage.onChanged.addListener(overlaySearchEngineStorageListener);

    if (storageArea) {
      storageArea.get([OVERLAY_TAB_PRIORITY_STORAGE_KEY], (result) => {
        overlayTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(result[OVERLAY_TAB_PRIORITY_STORAGE_KEY]);
      });
    }
    overlayTabPriorityStorageListener = (changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName || !changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY]) {
        return;
      }
      overlayTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY].newValue);
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(overlayTabPriorityStorageListener);

    function isOverlayDarkMode() {
      return overlay && overlay.getAttribute('data-theme') === 'dark';
    }

    function getThemeForMode(theme) {
      if (!theme) {
        return defaultTheme;
      }
      if (!isOverlayDarkMode()) {
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
      const isDark = isOverlayDarkMode();
      const base = isDark ? [48, 48, 48] : [255, 255, 255];
      return {
        bg: rgbToCss(mixColor(accentRgb, base, isDark ? 0.6 : 0.9)),
        border: rgbToCss(mixColor(accentRgb, base, isDark ? 0.4 : 0.72))
      };
    }
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

    function getGoogleFaviconUrl(hostname) {
      const normalized = normalizeFaviconHost(hostname);
      if (!normalized) {
        return '';
      }
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalized)}&sz=128`;
    }

    function getFaviconIsUrl(hostname) {
      const normalized = normalizeFaviconHost(hostname);
      if (!normalized) {
        return '';
      }
      return `https://favicon.is/${encodeURIComponent(normalized)}`;
    }

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

    function isFaviconProxyUrl(url) {
      if (!url) {
        return false;
      }
      return /google\.com\/s2\/favicons/i.test(url) || /gstatic\.com\/favicon/i.test(url);
    }

    function getThemeFromUrl(url, hostOverride) {
      if (!url) {
        return Promise.resolve(defaultTheme);
      }
      const hostKey = hostOverride || getHostFromUrl(url);
      if (isBlockedLocalFaviconUrl(url) || (hostKey && isLocalNetworkHost(hostKey))) {
        const fallbackTheme = buildFallbackThemeForHost(hostKey);
        return Promise.resolve(fallbackTheme || defaultTheme);
      }
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
      if (hostKey && isLocalNetworkHost(hostKey)) {
        const fallbackTheme = buildFallbackThemeForHost(hostKey);
        return Promise.resolve(fallbackTheme || defaultTheme);
      }
      const siteFavicon = hostKey ? getSiteFaviconUrl(hostKey) : '';
      if (siteFavicon) {
        return getThemeFromUrl(siteFavicon, hostKey).then((theme) => {
          if (theme && !theme._xIsDefault) {
            return theme;
          }
          return getThemeFromUrl(getThemeSourceForSuggestion(suggestion), hostKey);
        });
      }
      return getThemeFromUrl(getThemeSourceForSuggestion(suggestion), hostKey);
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
    const resolvedFaviconUrlCache = window._x_extension_overlay_favicon_url_cache_2024_unique_ || new Map();
    window._x_extension_overlay_favicon_url_cache_2024_unique_ = resolvedFaviconUrlCache;

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
      const withoutScheme = decodedRaw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
      const authority = withoutScheme.split(/[/?#]/)[0] || '';
      const hostCandidateRaw = authority.includes('@') ? authority.split('@').pop() : authority;
      const hostCandidate = (() => {
        const value = String(hostCandidateRaw || '').trim().toLowerCase();
        if (!value) {
          return '';
        }
        if (value.startsWith('[')) {
          const endBracket = value.indexOf(']');
          if (endBracket > 1) {
            return value.slice(1, endBracket);
          }
        }
        return value.replace(/^\[|\]$/g, '').split(':')[0];
      })();
      if (hostCandidate && isLocalNetworkHost(hostCandidate)) {
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

    function canReuseCurrentFavicon(img, nextSrc) {
      if (!img || !nextSrc) {
        return false;
      }
      const currentSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
      if (currentSrc !== nextSrc) {
        return false;
      }
      const currentResolved = img.getAttribute('data-favicon-current-src') || '';
      if (currentResolved === nextSrc) {
        return true;
      }
      return Boolean(img.complete && img.naturalWidth > 0);
    }

    function getLastWorkingFaviconSrc(img) {
      if (!img) {
        return '';
      }
      const resolved = img.getAttribute('data-favicon-current-src') || '';
      if (resolved) {
        return resolved;
      }
      if (img.complete && img.naturalWidth > 0) {
        return img.src || '';
      }
      return '';
    }

    function restoreWorkingFaviconOrFail(img, previousSrc, onFailed) {
      const fallbackSrc = String(previousSrc || '').trim();
      if (fallbackSrc) {
        const applied = setFaviconSrcWithAnimation(img, fallbackSrc);
        if (applied || canReuseCurrentFavicon(img, fallbackSrc)) {
          return true;
        }
      }
      if (typeof onFailed === 'function') {
        onFailed();
      }
      return false;
    }

    function attachResolvedFaviconWithFallbacks(img, pageUrl, hostKey, fallbackUrl, onFailed) {
      if (!img) {
        return;
      }
      const isChromeMonogramFaviconUrl = (url) => /^chrome:\/\/favicon2\//i.test(String(url || ''));
      const handleFailed = typeof onFailed === 'function' ? onFailed : function() {};
      const preferredTheme = isOverlayDarkMode() ? 'dark' : 'light';
      const previousWorkingSrc = getLastWorkingFaviconSrc(img);
      img.setAttribute('data-x-ov-theme-favicon', '1');
      img.setAttribute('data-x-ov-favicon-page-url', String(pageUrl || ''));
      img.setAttribute('data-x-ov-favicon-host', String(hostKey || ''));
      img.setAttribute('data-x-ov-favicon-fallback-url', String(fallbackUrl || ''));
      const cacheKey = `${String(hostKey || '')}::${String(pageUrl || '')}::${String(fallbackUrl || '')}::${preferredTheme}`;
      const cachedUrl = resolvedFaviconUrlCache.get(cacheKey) || '';
      const safeCachedUrl = (isBlockedLocalFaviconUrl(cachedUrl) || isChromeMonogramFaviconUrl(cachedUrl)) ? '' : cachedUrl;
      const safeFallbackUrl = isBlockedLocalFaviconUrl(fallbackUrl) ? '' : String(fallbackUrl || '');
      const quickUrl = safeCachedUrl || safeFallbackUrl;
      const trySetCandidate = (nextUrl) => {
        if (!nextUrl) {
          return false;
        }
        const applied = setFaviconSrcWithAnimation(img, nextUrl);
        if (!applied && !canReuseCurrentFavicon(img, nextUrl)) {
          return false;
        }
        return true;
      };
      const quickApplied = quickUrl ? trySetCandidate(quickUrl) : false;
      chrome.runtime.sendMessage(
        {
          action: 'resolveFaviconCandidates',
          url: pageUrl || '',
          host: hostKey || '',
          fallbackUrl: fallbackUrl || '',
          preferredTheme: preferredTheme,
          excludeChromeFallback: true
        },
        (response) => {
          const resolved = response && Array.isArray(response.urls) ? response.urls.filter(Boolean) : [];
          const urls = Array.from(
            new Set(
              [safeCachedUrl, ...resolved, safeFallbackUrl].filter((url) =>
                url && !isBlockedLocalFaviconUrl(url) && !isChromeMonogramFaviconUrl(url)
              )
            )
          );
          if (!urls.length) {
            if (!quickApplied) {
              restoreWorkingFaviconOrFail(img, previousWorkingSrc, handleFailed);
            }
            return;
          }
          let index = quickApplied ? Math.max(0, urls.indexOf(quickUrl) + 1) : 0;
          const tryNext = () => {
            if (!img) {
              return;
            }
            if (index >= urls.length) {
              restoreWorkingFaviconOrFail(img, previousWorkingSrc, handleFailed);
              return;
            }
            const nextUrl = urls[index];
            index += 1;
            if (!trySetCandidate(nextUrl)) {
              tryNext();
              return;
            }
            resolvedFaviconUrlCache.set(cacheKey, nextUrl);
          };
          img.onerror = () => {
            tryNext();
          };
          if (!quickApplied) {
            tryNext();
            return;
          }
          const currentUrl = String(quickUrl || (img && img.src ? img.src : '') || '');
          const upgradeCandidates = urls.filter((candidate) => {
            if (!candidate || candidate === quickUrl) {
              return false;
            }
            if (shouldSkipThemeUpgradeCandidate(candidate, preferredTheme, currentUrl)) {
              return false;
            }
            return true;
          });
          const tryUpgrade = (index) => {
            if (!img || !img.isConnected || index >= upgradeCandidates.length) {
              return;
            }
            const candidate = upgradeCandidates[index];
            const probe = new Image();
            probe.referrerPolicy = 'no-referrer';
            probe.onload = () => {
              if (!img || !img.isConnected) {
                return;
              }
              setFaviconSrcWithAnimation(img, candidate);
              resolvedFaviconUrlCache.set(cacheKey, candidate);
            };
            probe.onerror = () => {
              tryUpgrade(index + 1);
            };
            probe.src = candidate;
          };
          tryUpgrade(0);
        }
      );
    }

    function refreshOverlayThemeAwareFavicons() {
      if (!overlay) {
        return;
      }
      overlay.querySelectorAll('img[data-x-ov-theme-favicon="1"]').forEach((img) => {
        if (!img || !img.isConnected) {
          return;
        }
        const pageUrl = img.getAttribute('data-x-ov-favicon-page-url') || '';
        if (!pageUrl) {
          return;
        }
        const hostKey = img.getAttribute('data-x-ov-favicon-host') || '';
        const fallbackUrl = img.getAttribute('data-x-ov-favicon-fallback-url') || '';
        attachResolvedFaviconWithFallbacks(img, pageUrl, hostKey, fallbackUrl);
      });
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
          const siteFavicon = getSiteFaviconUrl(hostKeyForTheme);
          if (siteFavicon) {
            requestFaviconData(siteFavicon).then((dataUrl) => {
              if (dataUrl) {
                preloadThemeFromFavicon(siteFavicon, dataUrl, hostKeyForTheme);
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
      icon.innerHTML = getRiSvg('ri-link', 'ri-size-16');
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
      return isOverlayDarkMode() ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF';
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
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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

    function getThemeSourceForSuggestion(suggestion) {
      if (suggestion && suggestion.url) {
        try {
          const hostname = normalizeHost(new URL(suggestion.url).hostname);
          if (hostname) {
            if (isLocalNetworkHost(hostname)) {
              return '';
            }
            return getGoogleFaviconUrl(hostname) || getFaviconIsUrl(hostname);
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

    const siteSearchPrefix = document.createElement('span');
    siteSearchPrefix.id = '_x_extension_site_search_prefix_2024_unique_';
    siteSearchPrefix.style.cssText = `
      all: unset !important;
      position: absolute !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      left: 50px !important;
      display: none !important;
      white-space: nowrap !important;
      font-size: 16px !important;
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      line-height: 1 !important;
      color: var(--x-ov-subtext, #6B7280) !important;
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
      const prefixText = formatMessage('search_in_site_prefix', '在 {site} 中搜索｜', {
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

    window.addEventListener('resize', updateSiteSearchPrefixLayout);

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

    function normalizeTabMatchUrl(url) {
      if (!url) {
        return '';
      }
      try {
        const parsed = new URL(url);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
          return String(url).trim().toLowerCase();
        }
        const host = normalizeHost(parsed.hostname);
        let path = parsed.pathname || '/';
        path = path.replace(/\/+$/, '');
        if (!path) {
          path = '/';
        }
        return `${host}${path}${parsed.search || ''}`;
      } catch (e) {
        return String(url).trim().toLowerCase();
      }
    }

    function getMatchedOpenTabIdForSuggestion(suggestion) {
      if (!suggestion || !suggestion.url || !Array.isArray(tabs) || tabs.length === 0) {
        return null;
      }
      const target = normalizeTabMatchUrl(suggestion.url);
      if (!target) {
        return null;
      }
      for (let i = 0; i < tabs.length; i += 1) {
        const tab = tabs[i];
        if (!tab || typeof tab.id !== 'number' || !tab.url) {
          continue;
        }
        const current = normalizeTabMatchUrl(tab.url);
        if (current && current === target) {
          return tab.id;
        }
      }
      return null;
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
      const rawQuery = latestRawInputValue;
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
      if (searchInput.selectionStart !== searchInput.value.length || searchInput.selectionEnd !== searchInput.value.length) {
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
      searchInput.value = displayText;
      searchInput.setSelectionRange(rawQuery.length, displayText.length);
      autocompleteState = {
        completion: candidate.completion,
        displayText: displayText,
        url: candidate.url || '',
        rawQuery: rawQuery,
        title: candidate.title || '',
        type: candidate.type || ''
      };
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
        return getGoogleFaviconUrl(hostname) || getFaviconIsUrl(hostname);
      } catch (e) {
        return '';
      }
    }

    function mergeCustomProvidersLocal(baseItems, customItems) {
      const merged = [];
      const seen = new Set();
      (customItems || []).forEach((item) => {
        if (item && item.disabled) {
          return;
        }
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
      const localUrl = chrome.runtime.getURL('assets/data/site-search.json');
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

    getSiteSearchProviders();

    siteSearchStorageListener = (changes, areaName) => {
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
        if (latestOverlayQuery) {
          chrome.runtime.sendMessage({
            action: 'getSearchSuggestions',
            query: latestOverlayQuery
          }, function(response) {
            if (response && response.suggestions) {
              updateSearchSuggestions(response.suggestions, latestOverlayQuery);
            } else {
              updateSearchSuggestions([], latestOverlayQuery);
            }
          });
        }
      });
    };
    chrome.storage.onChanged.addListener(siteSearchStorageListener);

    function getSiteSearchDisplayName(provider) {
      if (!provider) {
        return t('site_search_default', '站内');
      }
      return provider.name || provider.key || t('site_search_default', '站内');
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
      searchInput.value = '';
      latestRawInputValue = '';
      latestOverlayQuery = '';
      clearAutocomplete();
      setSiteSearchPrefix(provider, defaultTheme);
      const providerIcon = getProviderIcon(provider);
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

    // Add input event for search suggestions
    searchInput.addEventListener('compositionstart', function() {
      isComposing = true;
      clearAutocomplete();
    });

    searchInput.addEventListener('compositionend', function(e) {
      isComposing = false;
      const rawValue = e.target.value || '';
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      if (selectedIndex >= 0) {
        selectedIndex = -1;
        updateSelection();
      }
      latestOverlayQuery = query;
      latestRawInputValue = rawValue;
      clearAutocomplete();
      if (query.length > 0) {
        if (isModeCommand(query) || getCommandMatch(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        chrome.runtime.sendMessage({
          action: 'getSearchSuggestions',
          query: query
        }, function(response) {
          if (response && response.suggestions) {
            updateSearchSuggestions(response.suggestions, query);
          }
        });
      } else {
        clearSearchSuggestions();
      }
    });

    searchInput.addEventListener('input', function(event) {
      const rawValue = this.value;
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      const inputType = event && event.inputType;
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType && inputType.startsWith('delete');
      if (isDelete) {
        lastDeletionAt = Date.now();
      }
      if (isComposing) {
        latestRawInputValue = rawValue;
        latestOverlayQuery = query;
        return;
      }
      if (selectedIndex >= 0) {
        selectedIndex = -1;
        updateSelection();
      }
      if (!query && siteSearchState) {
        latestOverlayQuery = '';
        latestRawInputValue = '';
        clearAutocomplete();
        clearSearchSuggestions();
        return;
      }
      latestOverlayQuery = query;
      latestRawInputValue = rawValue;
      clearAutocomplete();
      if (query.length > 0) {
        if (isPaste || getDirectUrlSuggestion(query)) {
          updateSearchSuggestions([], query);
        }
        if (isModeCommand(query) || getCommandMatch(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        // Get search suggestions
        chrome.runtime.sendMessage({
          action: 'getSearchSuggestions',
          query: query
        }, function(response) {
          if (response && response.suggestions) {
            updateSearchSuggestions(response.suggestions, query);
          }
        });
      } else {
        // Clear suggestions and show tabs
        clearSearchSuggestions();
      }
    });
    
    // Add click outside to close functionality
    clickOutsideHandler = function(e) {
      if (!overlay.contains(e.target)) {
        removeOverlay(overlay);
        document.removeEventListener('click', clickOutsideHandler);
      }
    };
    document.addEventListener('click', clickOutsideHandler);
    
    function handleTabKey(e) {
      if (siteSearchState) {
        return false;
      }
      const rawValue = searchInput.value;
      const rawTrigger = latestRawInputValue || rawValue;
      const triggerInput = (rawTrigger || rawValue).trim();
      if (siteSearchTriggerState &&
          siteSearchTriggerState.rawInput === triggerInput &&
          siteSearchTriggerState.provider) {
        e.preventDefault();
        activateSiteSearch(siteSearchTriggerState.provider);
        return true;
      }
      if (triggerInput) {
        e.preventDefault();
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
            searchInput.value = autocompleteState.completion;
            searchInput.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
            latestRawInputValue = autocompleteState.completion;
            latestOverlayQuery = autocompleteState.completion.trim();
            autocompleteState = null;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        return true;
      }
      if (autocompleteState && autocompleteState.completion) {
        e.preventDefault();
        searchInput.value = autocompleteState.completion;
        searchInput.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
        latestRawInputValue = autocompleteState.completion;
        latestOverlayQuery = autocompleteState.completion.trim();
        autocompleteState = null;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }

    captureTabHandler = function(e) {
      if (e.key !== 'Tab') {
        return;
      }
      if (document.activeElement !== searchInput) {
        return;
      }
      handleTabKey(e);
    };
    document.addEventListener('keydown', captureTabHandler, true);

    searchInput.addEventListener('keydown', function(e) {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
      if (e.key !== 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        latestRawInputValue = searchInput.value;
        latestOverlayQuery = searchInput.value.trim();
      }
      if (e.key === 'Escape' && siteSearchState) {
        e.preventDefault();
        e.stopPropagation();
        clearSiteSearch();
        return;
      }
      if (e.key === 'Backspace' && siteSearchState && !searchInput.value) {
        clearSiteSearch();
        return;
      }
      if (isComposing) {
        return;
      }
      if (e.key === 'Tab') {
        handleTabKey(e);
      }
    });
    searchInput.addEventListener('keypress', function(e) {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
    });
    searchInput.addEventListener('keyup', function(e) {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
    });

    // Add keyboard navigation
    let selectedIndex = -1; // -1 means input is focused, 0+ means suggestion is selected
    const suggestionItems = [];
    let currentSuggestions = []; // Store current suggestions for keyboard navigation
    let lastRenderedQuery = '';

    function getAutoHighlightIndex() {
      return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
    }

    function shouldSwitchMatchedTabSuggestion(suggestion, index) {
      if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
        return false;
      }
      if (!overlayTabQuickSwitchEnabled) {
        return false;
      }
      return index === 0;
    }
    
    keydownHandler = function(e) {
      if (e && (e.isComposing || isComposing)) {
        return;
      }
      if (e.key === 'Escape' && overlay) {
        removeOverlay(overlay);
        document.removeEventListener('keydown', keydownHandler);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestionItems.length === 0) {
          return;
        }
        if (selectedIndex === -1) {
          // Move from auto highlight (or input) to next suggestion
          const autoIndex = getAutoHighlightIndex();
          selectedIndex = autoIndex >= 0
            ? (autoIndex + 1) % suggestionItems.length
            : 0;
        } else {
          // Move to next suggestion
          selectedIndex = (selectedIndex + 1) % suggestionItems.length;
        }
        updateSelection();
        searchInput.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestionItems.length === 0) {
          return;
        }
        if (selectedIndex === 0) {
          // Move from first suggestion back to input
          selectedIndex = -1;
          searchInput.focus();
        } else if (selectedIndex === -1) {
          const autoIndex = getAutoHighlightIndex();
          if (autoIndex > 0) {
            selectedIndex = autoIndex - 1;
          } else if (autoIndex === 0) {
            selectedIndex = -1;
            searchInput.focus();
          } else {
            // Move from input to last suggestion
            selectedIndex = suggestionItems.length - 1;
          }
        } else {
          // Move to previous suggestion
          selectedIndex = selectedIndex - 1;
        }
        updateSelection();
        searchInput.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        const commandMatch = getCommandMatch(query);
        if (commandMatch && selectedIndex === -1) {
          if (commandMatch.command.type === 'commandNewTab') {
            chrome.runtime.sendMessage({ action: 'openNewTab' });
          } else if (commandMatch.command.type === 'commandSettings') {
            chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          }
          removeOverlay(overlay);
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
          document.removeEventListener('keydown', captureTabHandler, true);
          return;
        }
        if (isModeCommand(query) && selectedIndex === -1) {
          applyThemeModeChange(getNextThemeMode(overlayThemeMode || 'system'));
          return;
        }
        
        const activeSuggestionIndex = selectedIndex >= 0
          ? selectedIndex
          : (query.length > 0 ? getAutoHighlightIndex() : -1);
        if (activeSuggestionIndex >= 0 && suggestionItems[activeSuggestionIndex]) {
          // Check if we're showing search suggestions or tab suggestions
          const isSearchSuggestion = query.length > 0;
          
          if (isSearchSuggestion && currentSuggestions[activeSuggestionIndex]) {
            const selectedSuggestion = currentSuggestions[activeSuggestionIndex];
            if (selectedSuggestion.type === 'modeSwitch') {
              applyThemeModeChange(selectedSuggestion.nextMode);
              searchInput.focus();
              return;
            }
            if (selectedSuggestion.type === 'commandNewTab') {
              chrome.runtime.sendMessage({ action: 'openNewTab' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (selectedSuggestion.type === 'commandSettings') {
              chrome.runtime.sendMessage({ action: 'openOptionsPage' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
              activateSiteSearch(selectedSuggestion.provider);
              searchInput.focus();
              return;
            }
            if (shouldSwitchMatchedTabSuggestion(selectedSuggestion, activeSuggestionIndex)) {
              chrome.runtime.sendMessage({
                action: 'switchToTab',
                tabId: selectedSuggestion._xMatchedTabId
              });
            } else if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: selectedSuggestion.searchQuery,
                forceSearch: true
              });
            } else {
              // Navigate to the suggested URL
              console.log('Opening URL from keyboard:', selectedSuggestion.url);
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: selectedSuggestion.url
              });
            }
          } else if (!isSearchSuggestion && selectedIndex >= 0) {
            // Switch to existing tab
            chrome.runtime.sendMessage({
              action: 'switchToTab',
              tabId: tabs[selectedIndex].id
            });
          }
          removeOverlay(overlay);
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
          document.removeEventListener('keydown', captureTabHandler, true);
        } else if (query) {
          if (siteSearchState) {
            const siteUrl = buildSearchUrl(siteSearchState.template, query);
            if (siteUrl) {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: siteUrl
              });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
          }
          const currentRawInput = (latestRawInputValue || searchInput.value || '').trim();
          if (inlineSearchState && inlineSearchState.isAuto &&
              inlineSearchState.url && inlineSearchState.rawInput === currentRawInput) {
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: inlineSearchState.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
            return;
          }
          if (autocompleteState && autocompleteState.url) {
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: autocompleteState.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
            return;
          }
          resolveQuickNavigation(query).then((targetUrl) => {
            if (targetUrl) {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: targetUrl
              });
            } else {
              // Handle search or URL navigation
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: query
              });
            }
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
          });
        }
      }
    };

    overlayKeyCaptureHandler = function(e) {
      if (!overlay || !overlay.isConnected) {
        return;
      }
      if (document.activeElement !== searchInput) {
        return;
      }
      if (e && (e.isComposing || isComposing)) {
        return;
      }
      if (e.key === 'Tab') {
        handleTabKey(e);
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
        keydownHandler(e);
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener('keydown', overlayKeyCaptureHandler, true);
    document.addEventListener('keydown', keydownHandler);
    
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
      if (item._xVisitButton) {
        const shouldHide = Boolean(item._xAlwaysHideVisitButton || (isActive && item._xHasActionTags));
        item._xVisitButton.style.setProperty('display', shouldHide ? 'none' : 'inline-flex', 'important');
        if (shouldHide) {
          item._xVisitButton.style.setProperty('background-color', 'transparent', 'important');
          item._xVisitButton.style.setProperty('border', '1px solid transparent', 'important');
        }
        if (isActive) {
          item._xVisitButton.style.setProperty('color', resolvedTheme.buttonText, 'important');
          item._xVisitButton.style.setProperty('background-color', resolvedTheme.buttonBg, 'important');
          item._xVisitButton.style.setProperty('border', `1px solid ${resolvedTheme.buttonBorder}`, 'important');
        } else {
          item._xVisitButton.style.setProperty('color', 'var(--x-ov-subtext, #9CA3AF)', 'important');
          item._xVisitButton.style.setProperty('background-color', 'transparent', 'important');
          item._xVisitButton.style.setProperty('border', '1px solid transparent', 'important');
        }
      }
      if (item._xHistoryTag) {
        if (isActive) {
          item._xHistoryTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
          item._xHistoryTag.style.setProperty('color', resolvedTheme.tagText, 'important');
          item._xHistoryTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
        } else {
          item._xHistoryTag.style.setProperty('background', item._xHistoryTag._xDefaultBg || 'var(--x-ov-tag-bg, #F3F4F6)', 'important');
          item._xHistoryTag.style.setProperty('color', item._xHistoryTag._xDefaultText || 'var(--x-ov-tag-text, #6B7280)', 'important');
          item._xHistoryTag.style.setProperty('border', `1px solid ${item._xHistoryTag._xDefaultBorder || 'transparent'}`, 'important');
        }
      }
      if (item._xBookmarkTag) {
        if (isActive) {
          item._xBookmarkTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
          item._xBookmarkTag.style.setProperty('color', resolvedTheme.tagText, 'important');
          item._xBookmarkTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
        } else {
          item._xBookmarkTag.style.setProperty('background', item._xBookmarkTag._xDefaultBg || 'var(--x-ov-bookmark-tag-bg, #FEF3C7)', 'important');
          item._xBookmarkTag.style.setProperty('color', item._xBookmarkTag._xDefaultText || 'var(--x-ov-bookmark-tag-text, #D97706)', 'important');
          item._xBookmarkTag.style.setProperty('border', `1px solid ${item._xBookmarkTag._xDefaultBorder || 'transparent'}`, 'important');
        }
      }
      if (item._xTopSiteTag) {
        if (isActive) {
          item._xTopSiteTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
          item._xTopSiteTag.style.setProperty('color', resolvedTheme.tagText, 'important');
          item._xTopSiteTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
        } else {
          item._xTopSiteTag.style.setProperty('background', item._xTopSiteTag._xDefaultBg || 'var(--x-ov-tag-bg, #F3F4F6)', 'important');
          item._xTopSiteTag.style.setProperty('color', item._xTopSiteTag._xDefaultText || 'var(--x-ov-tag-text, #6B7280)', 'important');
          item._xTopSiteTag.style.setProperty('border', `1px solid ${item._xTopSiteTag._xDefaultBorder || 'transparent'}`, 'important');
        }
      }
      if (item._xTagContainer) {
        const shouldShow = isActive && item._xHasActionTags;
        item._xTagContainer.style.setProperty('display', shouldShow ? 'inline-flex' : 'none', 'important');
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
          const shouldUseBlue = !(theme && theme._xIsBrand) && (isSelected || item._xIsAutocompleteTop);
          const highlightTheme = shouldUseBlue ? urlHighlightTheme : theme;
          if (isHighlighted) {
            applySearchSuggestionHighlight(item, highlightTheme);
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
              shouldShow ? resolvedTheme.accent : 'var(--x-ov-subtext, #9CA3AF)',
              'important'
            );
          }
          return;
        }
        setNonFaviconIconBg(item, Boolean(isHighlighted || item._xIsHovering));
        const theme = item._xTheme || defaultTheme;
        const shouldUseBlue = !(theme && theme._xIsBrand) && isSelected;
        const highlightTheme = shouldUseBlue ? urlHighlightTheme : theme;
        if (isSelected) {
          applySearchSuggestionHighlight(item, highlightTheme);
          if (item._xSwitchButton) {
            item._xSwitchButton.style.setProperty('color', 'var(--x-ov-text, #1F2937)', 'important');
          }
        } else {
          resetSearchSuggestion(item);
          if (item._xSwitchButton) {
            item._xSwitchButton.style.setProperty('color', 'var(--x-ov-subtext, #9CA3AF)', 'important');
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
      list.forEach((tab) => {
        if (tab && tab.favIconUrl) {
          preloadIcon(tab.favIconUrl);
        }
      });
      list.forEach((tab, index) => {
        const suggestionItem = document.createElement('div');
        applyNoTranslate(suggestionItem);
        suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
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
          margin: 0 0 ${isLastItem ? '0' : '4px'} 0 !important;
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
        
        // Store reference to suggestion item
        suggestionItems.push(suggestionItem);
        suggestionItem._xTheme = defaultTheme;

        // Create left side with icon and title
        const leftSide = document.createElement('div');
        leftSide.id = `_x_extension_left_side_${index}_2024_unique_`;
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

        // Create favicon
        let favicon = null;
        let hostForTab = '';
        try {
          hostForTab = tab && tab.url ? new URL(tab.url).hostname : '';
        } catch (e) {
          hostForTab = '';
        }
        const useFallback = !tab.favIconUrl || isLocalNetworkHost(hostForTab);
        let iconNode = null;
        let isFaviconIcon = false;
        if (useFallback) {
          iconNode = createLinkIcon();
        } else {
          favicon = document.createElement('img');
          favicon.id = `_x_extension_favicon_${index}_2024_unique_`;
          favicon.decoding = 'async';
          favicon.loading = 'eager';
          favicon.referrerPolicy = 'no-referrer';
          if (index < 4) {
            favicon.fetchPriority = 'high';
          }
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
          `;
          attachResolvedFaviconWithFallbacks(
            favicon,
            tab && tab.url ? tab.url : '',
            hostForTab,
            tab.favIconUrl || '',
            () => {
              if (favicon && favicon.parentNode) {
                favicon.parentNode.replaceChild(createLinkIcon(), favicon);
              }
            }
          );
          iconNode = favicon;
          isFaviconIcon = true;
        }
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
          color: var(--x-ov-subtext, #9CA3AF) !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;
        iconSlot.appendChild(iconNode);
        suggestionItem._xIconWrap = iconSlot;
        suggestionItem._xIconIsFavicon = isFaviconIcon;

        // Create title
        const title = document.createElement('span');
        applyNoTranslate(title);
        title.id = `_x_extension_title_${index}_2024_unique_`;
        title.textContent = sanitizeDisplayText(tab.title || t('untitled', '无标题'));
        title.style.cssText = `
          all: unset !important;
          color: var(--x-ov-text, #111827) !important;
          font-size: 14px !important;
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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

        // Create switch button
        const switchButton = document.createElement('button');
        applyNoTranslate(switchButton);
        switchButton.id = `_x_extension_switch_button_${index}_2024_unique_`;
        switchButton.innerHTML = `${t('switch_to_tab', '切换到标签页')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
        switchButton.style.cssText = `
          all: unset !important;
          background: transparent !important;
          color: var(--x-ov-subtext, #4B5563) !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 12px !important;
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          height: 26px !important;
          padding: 0 12px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          vertical-align: baseline !important;
        `;
        suggestionItem._xSwitchButton = switchButton;

        // Add hover effects
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
              this.style.setProperty('background-color', 'var(--x-ov-hover-bg)', 'important');
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

        // Add click handler to switch to tab
        switchButton.addEventListener('click', function(e) {
          e.stopPropagation();
          chrome.runtime.sendMessage({
            action: 'switchToTab',
            tabId: tab.id
          });
          removeOverlay(overlay);
          document.removeEventListener('keydown', keydownHandler);
        });

        // Add click handler to select item
        suggestionItem.addEventListener('click', function() {
          chrome.runtime.sendMessage({
            action: 'switchToTab',
            tabId: tab.id
          });
          removeOverlay(overlay);
          document.removeEventListener('keydown', keydownHandler);
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
    }

    function requestTabsAndRender() {
      chrome.runtime.sendMessage({ action: 'getTabsForOverlay' }, (response) => {
        const freshTabs = response && Array.isArray(response.tabs) ? response.tabs : [];
        if (freshTabs.length === 0) {
          return;
        }
        tabs = freshTabs;
        renderTabSuggestions(freshTabs);
      });
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
      const cacheKey = '_x_extension_shortcut_rules_2024_unique_';
      const promiseKey = '_x_extension_shortcut_rules_promise_2024_unique_';
      if (window[cacheKey]) {
        return Promise.resolve(window[cacheKey]);
      }
      if (window[promiseKey]) {
        return window[promiseKey];
      }
      const rulesUrl = chrome.runtime.getURL('assets/data/shortcut-rules.json');
      const rulesPromise = fetch(rulesUrl)
        .then((response) => response.json())
        .then((data) => {
          const items = data && Array.isArray(data.items) ? data.items : [];
          window[cacheKey] = items;
          return items;
        })
        .catch(() => new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
            const items = response && Array.isArray(response.items) ? response.items : [];
            window[cacheKey] = items;
            resolve(items);
          });
        }));
      window[promiseKey] = rulesPromise;
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

    function getDirectUrlSuggestion(input) {
      const targetUrl = getDirectNavigationUrl(input);
      if (!targetUrl) {
        return null;
      }
      let isLocalNetwork = isLocalNetworkInput(input);
      if (!isLocalNetwork) {
        const host = getHostFromUrl(targetUrl);
        isLocalNetwork = isLocalNetworkHost(host);
      }
      return {
        type: 'directUrl',
        title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
        url: targetUrl,
        favicon: '',
        isLocalNetwork: isLocalNetwork
      };
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

    function updateSearchSuggestions(suggestions, query) {
      if (query !== latestOverlayQuery) {
        return;
      }
      lastSuggestionResponse = Array.isArray(suggestions) ? suggestions : [];
      const rawTagInput = (latestRawInputValue || query || '').trim();
      const modeCommandActive = isModeCommand(rawTagInput);
      if (modeCommandActive) {
        if (storageArea) {
          storageArea.get([THEME_STORAGE_KEY], (result) => {
            const storedMode = result[THEME_STORAGE_KEY] || 'system';
            if (storedMode !== overlayThemeMode && query === latestOverlayQuery) {
              applyOverlayTheme(storedMode);
              updateSearchSuggestions([], query);
            }
          });
        }
      }
      
      // Add New Tab suggestion as first item
      const newTabSuggestion = modeCommandActive
        ? null
        : {
          type: 'newtab',
          title: formatMessage('search_query', '搜索 "{query}"', {
            query: query
          }),
          url: buildDefaultSearchUrlForOverlay(query),
          favicon: getDefaultSearchEngineFaviconUrlForOverlay(),
          searchQuery: query,
          forceSearch: true
        };

      // Add ChatGPT suggestion as second item
      // const chatGptSuggestion = {
      //   type: 'chatgpt',
      //   title: `Ask ChatGPT: "${query}"`,
      //   url: `https://chatgpt.com/?q=${encodeURIComponent(query)}`,
      //   favicon: 'https://img.icons8.com/?size=100&id=fO5yVwARGUEB&format=png&color=ffffff'
      // };

      // Add Perplexity suggestion as third item
      // const perplexitySuggestion = {
      //   type: 'perplexity',
      //   title: `Ask Perplexity: "${query}"`,
      //   url: `https://perplexity.ai/search?q=${encodeURIComponent(query)}`,
      //   favicon: 'https://img.icons8.com/?size=100&id=kzJWN5jCDzpq&format=png&color=000000'
      // };

      function buildUrlLine(url) {
        if (!url) {
          return null;
        }
        const urlLine = document.createElement('span');
        urlLine.textContent = url;
        urlLine.style.cssText = `
          all: unset !important;
          color: var(--x-ov-link, #2563EB) !important;
          font-size: 12px !important;
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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

      getShortcutRules().then((rules) => {
        if (query !== latestOverlayQuery) {
          return;
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
            if (query !== latestOverlayQuery) {
              return;
            }
            siteSearchProvidersCache = items;
            updateSearchSuggestions(suggestions, query);
          });
        }
        const rawTagInputForInline = (latestRawInputValue || searchInput.value || '').trim();
        const inlineCandidate = (!siteSearchState && !modeCommandActive && !hasCommand)
          ? getInlineSiteSearchCandidate(rawTagInputForInline, providersForTags)
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

        // Add New Tab, ChatGPT and Perplexity suggestions to the beginning
        let allSuggestions = modeCommandActive
          ? [...preSuggestions]
          : [...preSuggestions, newTabSuggestion, /*chatGptSuggestion, perplexitySuggestion,*/ ...suggestions];
        allSuggestions.forEach((item) => {
          if (!item || !item.url) {
            return;
          }
          const matchedTabId = getMatchedOpenTabIdForSuggestion(item);
          if (typeof matchedTabId === 'number') {
            item._xMatchedTabId = matchedTabId;
            return;
          }
          if (Object.prototype.hasOwnProperty.call(item, '_xMatchedTabId')) {
            delete item._xMatchedTabId;
          }
        });
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
        const inlineEnabled = Boolean(inlineSuggestion);
        let siteSearchTrigger = null;
        let mergedProvider = null;
        let primarySuggestion = null;
        if (!modeCommandActive && !hasCommand) {
          if (!siteSearchState && !inlineEnabled) {
            topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawInputValue.trim());
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
            autocompleteCandidate = getAutocompleteCandidate(allSuggestions, latestRawInputValue);
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
          if (!siteSearchState && query && overlayTabQuickSwitchEnabled) {
            const openTabMatchIndex = allSuggestions.findIndex((item) =>
              item &&
              item.type !== 'newtab' &&
              typeof item._xMatchedTabId === 'number'
            );
            if (openTabMatchIndex >= 0) {
              if (openTabMatchIndex > 0) {
                const [openTabMatch] = allSuggestions.splice(openTabMatchIndex, 1);
                allSuggestions.unshift(openTabMatch);
              }
              primaryHighlightIndex = 0;
              primaryHighlightReason = 'openTab';
            }
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
            ? { url: inlineSuggestion.url, rawInput: rawTagInputForInline, isAuto: inlineAutoHighlight }
            : null;
          const resolvedProvider = mergedProvider || siteSearchTrigger;
          siteSearchTriggerState = resolvedProvider
            ? { provider: resolvedProvider, rawInput: rawTagInputForInline }
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
          // Clear existing suggestions
          suggestionsContainer.innerHTML = '';
          suggestionItems.length = 0;
          selectedIndex = -1;
        } else {
          suggestionItems.forEach((item, index) => {
            item._xIsAutocompleteTop = index === primaryHighlightIndex;
          });
        }

        currentSuggestions = allSuggestions; // Store current suggestions including ChatGPT
        lastRenderedQuery = query;
        warmIconCache(allSuggestions);
        
        // Add search suggestions
        allSuggestions.forEach((suggestion, index) => {
          if (index < startIndex) {
            return;
          }
          const suggestionItem = document.createElement('div');
          applyNoTranslate(suggestionItem);
          suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
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
            const engineAccent = getBrandAccentForUrl(getDefaultSearchEngineThemeUrlForOverlay());
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
            background: ${isPrimaryHighlight ? initialHighlight.bg : 'transparent'} !important;
            border: ${isPrimaryHighlight ? `1px solid ${initialHighlight.border}` : '1px solid transparent'} !important;
            border-radius: 16px !important;
            margin-bottom: ${isLastItem ? '0' : '4px'} !important;
            cursor: pointer !important;
            transition: background-color 0.2s ease !important;
            box-sizing: border-box !important;
            margin: 0 0 ${isLastItem ? '0' : '4px'} 0 !important;
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
          suggestionItem._xIsAutocompleteTop = isPrimaryHighlight;
          suggestionItem._xTheme = immediateTheme;
          applyThemeVariables(suggestionItem, immediateTheme);
          
          // Create left side with icon and title
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
            themedIcon.innerHTML = getRiSvg('ri-link', 'ri-size-16');
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
            const directUrlHost = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
            const isLocalDirectUrl = Boolean(
              suggestion && suggestion.isLocalNetwork
            ) || (directUrlHost && isLocalNetworkHost(directUrlHost));
            iconNode = isLocalDirectUrl
              ? createLinkIcon()
              : createSearchIcon();
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
              color: var(--x-ov-subtext, #9CA3AF) !important;
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
              color: var(--x-ov-subtext, #9CA3AF) !important;
              font-size: 100% !important;
              font: inherit !important;
              vertical-align: baseline !important;
            `;
            iconNode = gearIcon;
          } else if (suggestion.type === 'newtab' || suggestion.type === 'googleSuggest') {
            const searchIcon = createSearchIcon();
            searchIcon.style.setProperty('color', 'var(--x-ov-subtext, #9CA3AF)', 'important');
            iconNode = searchIcon;
          } else {
            const suggestionHost = suggestion.url ? getHostFromUrl(suggestion.url) : '';
            if (suggestionHost && isLocalNetworkHost(suggestionHost)) {
              iconNode = createLinkIcon();
            } else if (suggestion.favicon) {
              // Create icon for suggestions - always use img for all types
              const favicon = document.createElement('img');
              favicon.decoding = 'async';
              favicon.loading = 'eager';
              favicon.referrerPolicy = 'no-referrer';
              if (index < 4) {
                favicon.fetchPriority = 'high';
              }
              attachFaviconData(
                favicon,
                suggestion.favicon || '',
                suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : ''
              );
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
              const replaceWithFallbackIcon = function() {
                const fallbackDiv = createLinkIcon();
                if (favicon.parentNode) {
                  favicon.parentNode.replaceChild(fallbackDiv, favicon);
                }
              };
              attachResolvedFaviconWithFallbacks(
                favicon,
                suggestion && suggestion.url ? suggestion.url : '',
                suggestionHost,
                suggestion.favicon || '',
                replaceWithFallbackIcon
              );
              iconNode = favicon;
            } else {
              const searchIcon = createSearchIcon();
              searchIcon.style.setProperty('color', 'var(--x-ov-subtext, #9CA3AF)', 'important');
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
              color: var(--x-ov-subtext, #9CA3AF) !important;
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
          
          // Create text wrapper for title and tag
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
          
          // Create title with highlighted query
          const title = document.createElement('span');
          applyNoTranslate(title);
          let highlightedTitle;
          if (isPrimarySearchSuggest ||
              suggestion.type === 'chatgpt' ||
              suggestion.type === 'perplexity' ||
              suggestion.type === 'newtab' ||
              suggestion.type === 'siteSearch' ||
              suggestion.type === 'inlineSiteSearch' ||
              suggestion.type === 'siteSearchPrompt' ||
              suggestion.type === 'modeSwitch') {
            // For ChatGPT, Perplexity, and New Tab, don't highlight the query part
            highlightedTitle = suggestion.title;
          } else {
            // For other suggestions, highlight the query
            highlightedTitle = suggestion.title;
          }
          title.textContent = '';
          renderHighlightedText(title, highlightedTitle, query, {
            background: 'var(--x-ext-mark-bg, #CFE8FF)',
            color: 'var(--x-ext-mark-text, #1E3A8A)'
          });
          title.style.cssText = `
            all: unset !important;
            color: var(--x-ov-text, #111827) !important;
            font-size: 14px !important;
            font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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
          
          // Add history tag if type is history
          if (suggestion.type === 'history' && !suggestion.isTopSite) {
            const urlLine = buildUrlLine(suggestion.url || '');
            if (urlLine) {
              textWrapper.appendChild(urlLine);
            }
            const historyTag = document.createElement('span');
            historyTag.textContent = t('search_tag_history', '历史');
            historyTag._xDefaultBg = 'var(--x-ov-tag-bg, #F3F4F6)';
            historyTag._xDefaultText = 'var(--x-ov-tag-text, #6B7280)';
            historyTag._xDefaultBorder = 'transparent';
            historyTag.style.cssText = `
              all: unset !important;
              background: var(--x-ov-tag-bg, #F3F4F6) !important;
              color: var(--x-ov-tag-text, #6B7280) !important;
              font-size: 10px !important;
              font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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
          
          // Add topSite tag if type is topSite
          if (suggestion.type === 'topSite' || suggestion.isTopSite) {
            const urlLine = buildUrlLine(suggestion.url || '');
            if (urlLine) {
              textWrapper.appendChild(urlLine);
            }
            const topSiteTag = document.createElement('span');
            topSiteTag.textContent = t('search_tag_top_site', '常用');
            topSiteTag._xDefaultBg = 'var(--x-ov-tag-bg, #F3F4F6)';
            topSiteTag._xDefaultText = 'var(--x-ov-tag-text, #6B7280)';
            topSiteTag._xDefaultBorder = 'transparent';
            topSiteTag.style.cssText = `
              all: unset !important;
              background: var(--x-ov-tag-bg, #F3F4F6) !important;
              color: var(--x-ov-tag-text, #6B7280) !important;
              font-size: 10px !important;
              font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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
          
          // Add bookmark tag if type is bookmark
          if (suggestion.type === 'bookmark') {
            if (suggestion.path) {
              const bookmarkPath = document.createElement('span');
              bookmarkPath.textContent = suggestion.path;
              bookmarkPath.style.cssText = `
                all: unset !important;
                color: var(--x-ov-link, #2563EB) !important;
                font-size: 12px !important;
                font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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
          bookmarkTag._xDefaultBg = 'var(--x-ov-bookmark-tag-bg, #FEF3C7)';
          bookmarkTag._xDefaultText = 'var(--x-ov-bookmark-tag-text, #D97706)';
          bookmarkTag._xDefaultBorder = 'transparent';
          bookmarkTag.style.cssText = `
            all: unset !important;
            background: var(--x-ov-bookmark-tag-bg, #FEF3C7) !important;
            color: var(--x-ov-bookmark-tag-text, #D97706) !important;
            font-size: 10px !important;
              font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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
            gap: 8px !important;
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
          const shouldSwitchMatchedTab = isPrimaryHighlight &&
            primaryHighlightReason === 'openTab' &&
            shouldSwitchMatchedTabSuggestion(suggestion, index);
          const shouldShowEnterTag = !isPrimarySearchSuggest && isPrimaryHighlight &&
            !onlyKeywordSuggestions &&
            (primaryHighlightReason === 'topSite' ||
              primaryHighlightReason === 'inline' ||
              primaryHighlightReason === 'autocomplete' ||
              primaryHighlightReason === 'openTab' ||
              isDirectHighlight ||
              isMergedHighlight);
          const shouldShowSiteSearchTag = !isPrimarySearchSuggest && isPrimaryHighlight &&
            ((siteSearchTrigger && (primaryHighlightReason === 'siteSearchPrompt' || isTopSiteMatch)) ||
              isMergedHighlight);
          if (shouldShowEnterTag) {
            actionTags.appendChild(createActionTag(
              shouldSwitchMatchedTab ? t('action_switch', '切换') : t('visit_label', '访问'),
              'Enter'
            ));
          }
          if (shouldShowSiteSearchTag) {
            actionTags.appendChild(createActionTag(t('action_search', '搜索'), 'Tab'));
          }
          if (isPrimaryHighlight && onlyKeywordSuggestions && suggestion.type === 'newtab') {
            actionTags.appendChild(createActionTag(getSearchActionLabel(), 'Enter'));
          }

          // Create visit button
          const visitButton = document.createElement('button');
          applyNoTranslate(visitButton);
          visitButton.style.cssText = `
            all: unset !important;
            background: transparent !important;
            color: var(--x-ov-subtext, #9CA3AF) !important;
            border: 1px solid transparent !important;
            border-radius: 16px !important;
            font-size: 12px !important;
            font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            cursor: pointer !important;
            transition: background-color 0.2s ease !important;
            padding: 6px 12px !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            vertical-align: baseline !important;
          `;
          suggestionItem._xAlwaysHideVisitButton = suggestion.type === 'siteSearchPrompt' || suggestion.type === 'modeSwitch';
          if (suggestionItem._xAlwaysHideVisitButton) {
            visitButton.style.setProperty('display', 'none', 'important');
          }
          
          if (suggestion.type === 'newtab') {
            visitButton.innerHTML = `${getSearchActionLabel()} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else if (suggestion.type === 'commandNewTab') {
            visitButton.innerHTML = `${t('command_newtab', '新建标签页')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else if (suggestion.type === 'commandSettings') {
            visitButton.innerHTML = `${formatMessage('command_settings', '打开 Lumno 设置', { name: 'Lumno' })} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else if (shouldSwitchMatchedTab) {
            visitButton.innerHTML = `${t('action_switch', '切换')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else if (suggestion.type === 'siteSearch') {
            visitButton.innerHTML = `${t('action_search', '搜索')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else if (suggestion.type === 'directUrl' || suggestion.type === 'browserPage') {
            visitButton.innerHTML = `${t('action_open', '打开')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else if (suggestion.type === 'googleSuggest') {
            visitButton.innerHTML = `${getSearchActionLabel()} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          } else {
            visitButton.innerHTML = `${t('visit_label', '访问')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
          }
          
          // Add hover effects
          suggestionItem.addEventListener('mouseenter', function() {
            if (suggestionItems.indexOf(this) !== selectedIndex) {
              this._xIsHovering = true;
              setNonFaviconIconBg(this, true);
              if (selectedIndex === -1 && this._xIsAutocompleteTop) {
                return;
              }
              this.style.setProperty('background', 'var(--x-ov-hover-bg)', 'important');
              this.style.setProperty('border', '1px solid transparent', 'important');
            }
          });
          
          suggestionItem.addEventListener('mouseleave', function() {
            if (suggestionItems.indexOf(this) !== selectedIndex) {
              this._xIsHovering = false;
              updateSelection();
            }
          });
          
          // Add click handler to visit URL
          visitButton.addEventListener('click', function(e) {
            e.stopPropagation();
            if (suggestion.type === 'commandNewTab') {
              chrome.runtime.sendMessage({ action: 'openNewTab' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (suggestion.type === 'commandSettings') {
              chrome.runtime.sendMessage({ action: 'openOptionsPage' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
              activateSiteSearch(suggestion.provider);
              searchInput.focus();
              return;
            }
            if (shouldSwitchMatchedTabSuggestion(suggestion, index)) {
              chrome.runtime.sendMessage({
                action: 'switchToTab',
                tabId: suggestion._xMatchedTabId
              });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (suggestion.forceSearch && suggestion.searchQuery) {
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: suggestion.searchQuery,
                forceSearch: true
              });
            } else {
              console.log('Opening URL:', suggestion.url);
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: suggestion.url
              });
            }
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
          });
          
          // Add click handler to select item
          suggestionItem.addEventListener('click', function() {
            if (suggestion.type === 'commandNewTab') {
              chrome.runtime.sendMessage({ action: 'openNewTab' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (suggestion.type === 'commandSettings') {
              chrome.runtime.sendMessage({ action: 'openOptionsPage' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
              activateSiteSearch(suggestion.provider);
              searchInput.focus();
              return;
            }
            if (suggestion.type === 'modeSwitch') {
              applyThemeModeChange(suggestion.nextMode);
              searchInput.focus();
              return;
            }
            if (shouldSwitchMatchedTabSuggestion(suggestion, index)) {
              chrome.runtime.sendMessage({
                action: 'switchToTab',
                tabId: suggestion._xMatchedTabId
              });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (suggestion.forceSearch && suggestion.searchQuery) {
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: suggestion.searchQuery,
                forceSearch: true
              });
            } else {
              console.log('Opening URL:', suggestion.url);
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: suggestion.url
              });
            }
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
          });
          
          leftSide.appendChild(iconNode);
          leftSide.appendChild(textWrapper);
          suggestionItem.appendChild(leftSide);
          rightSide.appendChild(actionTags);
          rightSide.appendChild(visitButton);
          suggestionItem.appendChild(rightSide);
          suggestionItem._xVisitButton = visitButton;
          suggestionItem._xTagContainer = actionTags;
          suggestionItem._xHasActionTags = actionTags.childNodes.length > 0;
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
      
      // Update keyboard navigation
      if (!canAppend) {
        selectedIndex = -1;
      }
      });
    }
    
    function clearSearchSuggestions() {
      inlineSearchState = null;
      siteSearchTriggerState = null;
      lastSuggestionResponse = [];
      if (Array.isArray(tabs) && tabs.length > 0) {
        renderTabSuggestions(tabs);
      }

      requestTabsAndRender();
    }
    
    // Focus the input when created
    setTimeout(() => searchInput.focus(), 100);
    

    
    // Create suggestions container
    const suggestionsContainer = document.createElement('div');
    applyNoTranslate(suggestionsContainer);
    suggestionsContainer.id = '_x_extension_suggestions_container_2024_unique_';
    suggestionsContainer.style.cssText = `
      all: unset !important;
      width: 100% !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
      max-height: 50vh !important;
      overflow-y: auto !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      background: transparent !important;
      border-radius: 0 0 28px 28px !important;
      padding: 12px !important;
      box-sizing: border-box !important;
      display: block !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;

    renderTabSuggestions(tabs);
    
    overlay.appendChild(inputContainer);
    overlay.appendChild(suggestionsContainer);
    document.body.appendChild(overlay);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      overlay.style.setProperty('opacity', '1', 'important');
      overlay.style.setProperty('transform', 'translateX(-50%) translateY(0) scale(1)', 'important');
      overlay.style.setProperty('filter', 'blur(0)', 'important');
    } else {
      clearOverlayEnterAnimationFrames();
      // Flush initial style state before starting transition to avoid skipped enter animations.
      void overlay.offsetHeight;
      overlayEnterAnimationRafA = requestAnimationFrame(() => {
        overlayEnterAnimationRafA = null;
        overlayEnterAnimationRafB = requestAnimationFrame(() => {
          overlayEnterAnimationRafB = null;
          if (!overlay.isConnected) {
            return;
          }
          overlay.style.setProperty('opacity', '1', 'important');
          overlay.style.setProperty('transform', 'translateX(-50%) translateY(0) scale(1)', 'important');
          overlay.style.setProperty('filter', 'blur(0)', 'important');
        });
      });
    }
  }
}
