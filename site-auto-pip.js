(function () {
  if (window._x_lumno_site_auto_pip_2026_unique_) {
    return;
  }
  window._x_lumno_site_auto_pip_2026_unique_ = true;

  if (window.top !== window.self) {
    return;
  }

  const state = {
    activeVideo: null,
    lastManagedVideo: null,
    enteringPiP: false,
    exitingPiP: false,
    managedPiP: false,
    enterRetryTimer: null,
    recoveryTimer: null,
    suppressEnterUntil: 0,
    lastVisibleAt: 0,
    hadUserGesture: false,
    mediaSessionHandlerBound: false,
    hiddenRetryBudget: 0
  };

  const ENTER_SUPPRESS_AFTER_EXIT_MS = 1100;
  const ENTER_SUPPRESS_AFTER_VISIBLE_MS = 1300;
  const QUICK_REHIDE_BYPASS_MS = 900;
  const DEFAULT_HIDDEN_RETRY_LIMIT = 4;
  const DEFAULT_HIDDEN_RETRY_DELAY_MS = 220;
  const MIN_VISIBLE_WIDTH = 220;
  const MIN_VISIBLE_HEIGHT = 124;
  const MIN_VISIBLE_AREA = 60000;
  const PAGE_BRIDGE_SCRIPT_ID = "__lumno_site_auto_pip_page_bridge_script_2026__";
  const PAGE_BRIDGE_REQUEST_EVENT = "__lumno_yt_force_exit_pip_req_2026__";
  const PAGE_BRIDGE_RESPONSE_EVENT = "__lumno_yt_force_exit_pip_res_2026__";
  let pageBridgeRequestSeq = 0;

  const host = String(location.hostname || "").toLowerCase();
  const AUTO_PIP_ENABLED_STORAGE_KEY = "_x_extension_auto_pip_enabled_2026_unique_";
  let autoPipEnabled = true;
  function normalizeAutoPipEnabled(value) {
    return value !== false;
  }
  function setAutoPipEnabled(value) {
    autoPipEnabled = normalizeAutoPipEnabled(value);
  }
  function syncAutoPipEnabledSetting() {
    if (!chrome || !chrome.storage) {
      return;
    }
    const storageArea = chrome.storage.sync || chrome.storage.local;
    if (!storageArea || typeof storageArea.get !== "function") {
      return;
    }
    storageArea.get([AUTO_PIP_ENABLED_STORAGE_KEY], (result) => {
      const rawValue = result ? result[AUTO_PIP_ENABLED_STORAGE_KEY] : undefined;
      const normalized = normalizeAutoPipEnabled(rawValue);
      setAutoPipEnabled(normalized);
      if (rawValue !== normalized && typeof storageArea.set === "function") {
        storageArea.set({ [AUTO_PIP_ENABLED_STORAGE_KEY]: normalized });
      }
    });
    if (!chrome.storage.onChanged || typeof chrome.storage.onChanged.addListener !== "function") {
      return;
    }
    chrome.storage.onChanged.addListener((changes) => {
      if (!changes || !changes[AUTO_PIP_ENABLED_STORAGE_KEY]) {
        return;
      }
      setAutoPipEnabled(changes[AUTO_PIP_ENABLED_STORAGE_KEY].newValue);
      if (!autoPipEnabled && (state.managedPiP || document.pictureInPictureElement)) {
        maybeExitPiP().catch(() => {});
      }
    });
  }
  syncAutoPipEnabledSetting();
  const autoPipBlacklist = window.__lumnoAutoPipBlacklist2026;
  if (host && autoPipBlacklist && Array.isArray(autoPipBlacklist.hostRules)) {
    const isBlacklisted = autoPipBlacklist.hostRules.some((rule) => {
      if (!(rule instanceof RegExp)) {
        return false;
      }
      return rule.test(host);
    });
    if (isBlacklisted) {
      return;
    }
  }
  const hostProfiles = [
    {
      test: /(^|\.)douyin\.com$/,
      selectors: [
        ".xgplayer video",
        ".xgplayer-video-wrap video",
        ".xg-video-container video",
        "[class*='videoPlayer'] video",
        "[class*='Player'] video",
        "video"
      ],
      rejectSelectors: [
        ".discover-video-card-item video",
        ".waterfall-videoCardContainer video",
        ".jingxuanVideoCard video"
      ],
      allowDisablePiP: true,
      minVisibleArea: 24000,
      allowEnterWhenHiddenVideo: true,
      autoResumeOnHiddenEnter: true,
      allowNoUserGesture: true,
      allowEnterWhenNotPlaying: true,
      hiddenRetryLimit: 24,
      hiddenRetryDelayMs: 180
    },
    {
      test: /(^|\.)bilibili\.com$/,
      selectors: [
        ".bpx-player-video-wrap video",
        ".bilibili-player-video-wrap video",
        ".bilibili-player-video video",
        "#bilibili-player video",
        "#player video"
      ]
    },
    {
      test: /(^|\.)youku\.com$/,
      selectors: [
        ".html5player-video video",
        ".youku-player video",
        "#player video",
        "#ykPlayer video"
      ]
    },
    {
      test: /(^|\.)v\.qq\.com$/,
      selectors: [
        ".txp_video_container video",
        ".txp-player video",
        "#mod_player video",
        "#player video"
      ]
    },
    {
      test: /(^|\.)iqiyi\.com$/,
      selectors: [
        ".iqp-player video",
        ".iqp-player-videolayer video",
        "#flashbox video",
        "#player video"
      ],
      rejectSelectors: [
        ".player_outer_video video",
        "video[outer='1']"
      ],
      allowDisablePiP: true,
      minVisibleArea: 38000,
      allowEnterWhenHiddenVideo: true,
      autoResumeOnHiddenEnter: true,
      allowNoUserGesture: true
    }
  ];

  function getMatchedProfile() {
    const matched = hostProfiles.find((profile) => profile.test.test(host));
    return matched && typeof matched === "object" ? matched : null;
  }

  const matchedProfile = getMatchedProfile();
  const profileSelectors = matchedProfile && Array.isArray(matchedProfile.selectors)
    ? matchedProfile.selectors
    : [];
  const profileRejectSelectors = matchedProfile && Array.isArray(matchedProfile.rejectSelectors)
    ? matchedProfile.rejectSelectors
    : [];

  function isIqiyiHost() {
    return host.endsWith(".iqiyi.com") || host === "iqiyi.com" || host.includes(".iqiyi.");
  }

  function isDouyinHost() {
    return host.endsWith(".douyin.com") || host === "douyin.com";
  }

  function getHiddenRetryLimit() {
    const value = Number(matchedProfile && matchedProfile.hiddenRetryLimit);
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    return DEFAULT_HIDDEN_RETRY_LIMIT;
  }

  function getHiddenRetryDelayMs() {
    const value = Number(matchedProfile && matchedProfile.hiddenRetryDelayMs);
    if (Number.isFinite(value) && value >= 40) {
      return Math.floor(value);
    }
    return DEFAULT_HIDDEN_RETRY_DELAY_MS;
  }

  function canEnterPiP() {
    return typeof document !== "undefined" &&
      document.pictureInPictureEnabled === true;
  }

  function canExitPiP() {
    return typeof document !== "undefined" &&
      typeof document.exitPictureInPicture === "function";
  }

  function isVideoPlaying(video) {
    if (!video) {
      return false;
    }
    return !video.paused && !video.ended && Number(video.readyState || 0) >= 2;
  }

  function isProbablyHiddenByStyles(element) {
    if (!element || !(element instanceof Element)) {
      return true;
    }
    const style = window.getComputedStyle(element);
    if (!style) {
      return false;
    }
    return style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity || 1) === 0;
  }

  function getVisibleArea(video) {
    if (!video || typeof video.getBoundingClientRect !== "function") {
      return 0;
    }
    const rect = video.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (vw <= 0 || vh <= 0) {
      return 0;
    }
    const left = Math.max(0, Math.min(vw, rect.left));
    const right = Math.max(0, Math.min(vw, rect.right));
    const top = Math.max(0, Math.min(vh, rect.top));
    const bottom = Math.max(0, Math.min(vh, rect.bottom));
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    return width * height;
  }

  function getRectArea(video) {
    if (!video || typeof video.getBoundingClientRect !== "function") {
      return 0;
    }
    const rect = video.getBoundingClientRect();
    const width = Math.max(0, Number(rect.width || 0));
    const height = Math.max(0, Number(rect.height || 0));
    return width * height;
  }

  function isVideoVisibleEnough(video) {
    if (!video || !video.isConnected || isProbablyHiddenByStyles(video)) {
      return false;
    }
    const rect = video.getBoundingClientRect();
    const width = Number(rect.width || 0);
    const height = Number(rect.height || 0);
    if (width < MIN_VISIBLE_WIDTH || height < MIN_VISIBLE_HEIGHT) {
      return false;
    }
    const minArea = Number(matchedProfile && matchedProfile.minVisibleArea) > 0
      ? Number(matchedProfile.minVisibleArea)
      : MIN_VISIBLE_AREA;
    return getVisibleArea(video) >= minArea;
  }

  function isLikelyAudible(video) {
    if (!video) {
      return false;
    }
    if (video.muted || Number(video.volume || 0) === 0) {
      return false;
    }
    if (typeof video.audioTracks === "object" && video.audioTracks && video.audioTracks.length > 0) {
      for (let i = 0; i < video.audioTracks.length; i += 1) {
        if (video.audioTracks[i] && video.audioTracks[i].enabled !== false) {
          return true;
        }
      }
      return false;
    }
    return true;
  }

  function isRejectedByProfile(video) {
    if (!video || profileRejectSelectors.length === 0) {
      return false;
    }
    for (const selector of profileRejectSelectors) {
      try {
        if (video.matches(selector)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selector and continue.
      }
      try {
        const node = document.querySelector(selector);
        if (!node) {
          continue;
        }
        if (node === video) {
          return true;
        }
        if (typeof node.contains === "function" && node.contains(video)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selector and continue.
      }
    }
    return false;
  }

  function isVideoCandidate(video) {
    if (isRejectedByProfile(video)) {
      return false;
    }
    const allowDisablePiP = Boolean(matchedProfile && matchedProfile.allowDisablePiP);
    return video instanceof HTMLVideoElement &&
      video.isConnected &&
      (allowDisablePiP || !video.disablePictureInPicture) &&
      Number(video.videoWidth || 0) > 0 &&
      Number(video.videoHeight || 0) > 0;
  }

  function hasProfileBoost(video) {
    if (!video || profileSelectors.length === 0) {
      return false;
    }
    for (const selector of profileSelectors) {
      try {
        const node = document.querySelector(selector);
        if (!node) {
          continue;
        }
        if (node === video) {
          return true;
        }
        if (typeof node.contains === "function" && node.contains(video)) {
          return true;
        }
      } catch (error) {
        // Ignore invalid selector and continue.
      }
    }
    return false;
  }

  function pickPrimaryVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (!videos.length) {
      return null;
    }

    let best = null;
    let bestScore = -1;
    for (const video of videos) {
      if (!isVideoCandidate(video)) {
        continue;
      }
      const visibleArea = getVisibleArea(video);
      const area = Math.max(visibleArea, getRectArea(video));
      if (area <= 0) {
        continue;
      }
      const playingBoost = isVideoPlaying(video) ? 1_000_000_000 : 0;
      const audibleBoost = isLikelyAudible(video) ? 250_000_000 : 0;
      const profileBoost = hasProfileBoost(video) ? 180_000_000 : 0;
      const lastManagedBoost = video === state.lastManagedVideo ? 20_000_000 : 0;
      const activeBoost = video === state.activeVideo ? 10_000_000 : 0;
      const score = playingBoost + audibleBoost + profileBoost + lastManagedBoost + activeBoost + area;
      if (score > bestScore) {
        bestScore = score;
        best = video;
      }
    }

    return best || videos[0] || null;
  }

  function syncActiveVideo(preferred) {
    if (isVideoCandidate(preferred)) {
      state.activeVideo = preferred;
      return state.activeVideo;
    }
    state.activeVideo = pickPrimaryVideo();
    return state.activeVideo;
  }

  function clearEnterRetryTimer() {
    if (!state.enterRetryTimer) {
      return;
    }
    clearTimeout(state.enterRetryTimer);
    state.enterRetryTimer = null;
  }

  function clearRecoveryTimer() {
    if (!state.recoveryTimer) {
      return;
    }
    clearTimeout(state.recoveryTimer);
    state.recoveryTimer = null;
  }

  function scheduleDeferredEnterPiP(reason) {
    if (!autoPipEnabled) {
      return;
    }
    clearEnterRetryTimer();
    if (document.visibilityState !== "hidden") {
      return;
    }
    const now = Date.now();
    const suppressUntil = Number(state.suppressEnterUntil || 0);
    const baseDelay = getHiddenRetryDelayMs();
    const delay = suppressUntil > now ? (suppressUntil - now + 40) : baseDelay;
    state.enterRetryTimer = setTimeout(async () => {
      state.enterRetryTimer = null;
      if (document.visibilityState !== "hidden") {
        return;
      }
      const entered = await maybeEnterPiP(reason || "deferred_hidden_retry");
      if (entered || document.visibilityState !== "hidden") {
        return;
      }
      if (state.enterRetryTimer) {
        return;
      }
      if (Number(state.hiddenRetryBudget || 0) <= 0) {
        return;
      }
      state.hiddenRetryBudget = Math.max(0, Number(state.hiddenRetryBudget || 0) - 1);
      scheduleDeferredEnterPiP(`${reason || "deferred_hidden_retry"}_loop`);
    }, Math.max(40, delay));
  }

  function bindMediaSessionAutoPiP() {
    if (state.mediaSessionHandlerBound) {
      return;
    }
    if (!navigator.mediaSession || typeof navigator.mediaSession.setActionHandler !== "function") {
      return;
    }
    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", async () => {
        await maybeEnterPiP("media_session_action");
      });
      state.mediaSessionHandlerBound = true;
    } catch (error) {
      // Older Chromium versions may not support this action.
    }
  }

  function ensurePageBridgeInjected() {
    if (document.getElementById(PAGE_BRIDGE_SCRIPT_ID)) {
      return;
    }
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : null;
    if (!runtime || typeof runtime.getURL !== "function") {
      return;
    }
    const script = document.createElement("script");
    script.id = PAGE_BRIDGE_SCRIPT_ID;
    script.src = runtime.getURL("youtube-auto-pip-page.js");
    script.async = false;
    const target = document.documentElement || document.head || document.body;
    if (!target) {
      return;
    }
    target.appendChild(script);
  }

  function requestPageBridgeExitPiP(timeoutMs) {
    return new Promise((resolve) => {
      if (typeof window.CustomEvent !== "function") {
        resolve({ ok: false, reason: "no-custom-event" });
        return;
      }
      ensurePageBridgeInjected();
      const requestId = ++pageBridgeRequestSeq;
      let done = false;
      const finish = (result) => {
        if (done) {
          return;
        }
        done = true;
        window.removeEventListener(PAGE_BRIDGE_RESPONSE_EVENT, onResponse, true);
        if (timer) {
          clearTimeout(timer);
        }
        resolve(result || { ok: false });
      };
      const onResponse = (event) => {
        const detail = event && event.detail ? event.detail : {};
        if (Number(detail.requestId || 0) !== requestId) {
          return;
        }
        finish({
          ok: true,
          attempted: Boolean(detail.attempted),
          before: Boolean(detail.before),
          after: Boolean(detail.after),
          error: String(detail.error || "")
        });
      };
      window.addEventListener(PAGE_BRIDGE_RESPONSE_EVENT, onResponse, true);
      const timer = setTimeout(() => {
        finish({ ok: false, reason: "timeout" });
      }, Math.max(120, Number(timeoutMs || 520)));
      window.dispatchEvent(new CustomEvent(PAGE_BRIDGE_REQUEST_EVENT, {
        detail: { requestId: requestId }
      }));
    });
  }

  function requestBackgroundMainWorldExitPiP(timeoutMs) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
        resolve({ ok: false, reason: "no-runtime-sendMessage" });
        return;
      }
      let done = false;
      const finish = (result) => {
        if (done) {
          return;
        }
        done = true;
        if (timer) {
          clearTimeout(timer);
        }
        resolve(result || { ok: false });
      };
      const timer = setTimeout(() => {
        finish({ ok: false, reason: "timeout" });
      }, Math.max(160, Number(timeoutMs || 760)));
      try {
        chrome.runtime.sendMessage({ action: "forceExitPiPInMainWorld" }, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            finish({
              ok: false,
              reason: chrome.runtime.lastError.message || "runtime-lastError"
            });
            return;
          }
          finish(response && typeof response === "object"
            ? response
            : { ok: false, reason: "empty-response" });
        });
      } catch (error) {
        finish({ ok: false, reason: String(error) });
      }
    });
  }

  function requestBackgroundMainWorldEnterPiP(timeoutMs, actionName) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
        resolve({ ok: false, reason: "no-runtime-sendMessage" });
        return;
      }
      let done = false;
      const finish = (result) => {
        if (done) {
          return;
        }
        done = true;
        if (timer) {
          clearTimeout(timer);
        }
        resolve(result || { ok: false });
      };
      const timer = setTimeout(() => {
        finish({ ok: false, reason: "timeout" });
      }, Math.max(160, Number(timeoutMs || 900)));
      try {
        chrome.runtime.sendMessage({ action: actionName || "siteTryEnterPiPInMainWorld" }, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            finish({
              ok: false,
              reason: chrome.runtime.lastError.message || "runtime-lastError"
            });
            return;
          }
          finish(response && typeof response === "object"
            ? response
            : { ok: false, reason: "empty-response" });
        });
      } catch (error) {
        finish({ ok: false, reason: String(error) });
      }
    });
  }

  function requestBackgroundSetupIqiyiAutoPiP(timeoutMs) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
        resolve({ ok: false, reason: "no-runtime-sendMessage" });
        return;
      }
      let done = false;
      const finish = (result) => {
        if (done) {
          return;
        }
        done = true;
        if (timer) {
          clearTimeout(timer);
        }
        resolve(result || { ok: false });
      };
      const timer = setTimeout(() => {
        finish({ ok: false, reason: "timeout" });
      }, Math.max(200, Number(timeoutMs || 1000)));
      try {
        chrome.runtime.sendMessage({ action: "iqiyiSetupAutoPiPInMainWorld" }, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            finish({
              ok: false,
              reason: chrome.runtime.lastError.message || "runtime-lastError"
            });
            return;
          }
          finish(response && typeof response === "object"
            ? response
            : { ok: false, reason: "empty-response" });
        });
      } catch (error) {
        finish({ ok: false, reason: String(error) });
      }
    });
  }

  async function requestVideoPictureInPicture(video) {
    if (!video || typeof video.requestPictureInPicture !== "function") {
      return false;
    }
    const allowDisablePiP = Boolean(matchedProfile && matchedProfile.allowDisablePiP);
    const hadDisableAttr = video.hasAttribute("disablepictureinpicture");
    const previousDisable = Boolean(video.disablePictureInPicture);
    if (allowDisablePiP && previousDisable) {
      try {
        video.disablePictureInPicture = false;
        if (hadDisableAttr) {
          video.removeAttribute("disablepictureinpicture");
        }
      } catch (error) {
        // Ignore property/attribute write errors.
      }
    }
    try {
      await video.requestPictureInPicture();
      return true;
    } finally {
      if (allowDisablePiP && previousDisable) {
        try {
          video.disablePictureInPicture = previousDisable;
          if (hadDisableAttr) {
            video.setAttribute("disablepictureinpicture", "");
          }
        } catch (error) {
          // Ignore restore errors.
        }
      }
    }
  }

  async function maybeEnterPiP(reason) {
    if (!autoPipEnabled) {
      return false;
    }
    if (!canEnterPiP() || !canExitPiP() || state.enteringPiP || state.exitingPiP) {
      return false;
    }
    const allowNoUserGesture = Boolean(matchedProfile && matchedProfile.allowNoUserGesture);
    if (!state.hadUserGesture && !allowNoUserGesture && reason !== "media_session_action") {
      return false;
    }
    if (Date.now() < Number(state.suppressEnterUntil || 0)) {
      scheduleDeferredEnterPiP(`${reason || "enter"}_suppressed_retry`);
      return false;
    }
    if (document.visibilityState !== "hidden") {
      return false;
    }
    if (document.pictureInPictureElement) {
      return true;
    }

    if (isIqiyiHost() || isDouyinHost()) {
      if (isIqiyiHost()) {
        await requestBackgroundSetupIqiyiAutoPiP(960);
      }
      await requestBackgroundMainWorldEnterPiP(
        920,
        isIqiyiHost() ? "iqiyiTryEnterPiPInMainWorld" : "siteTryEnterPiPInMainWorld"
      );
      if (document.pictureInPictureElement) {
        state.managedPiP = true;
        if (document.pictureInPictureElement instanceof HTMLVideoElement) {
          state.lastManagedVideo = document.pictureInPictureElement;
        }
        state.hiddenRetryBudget = 0;
        clearEnterRetryTimer();
        return true;
      }
    }

    let activeVideo = syncActiveVideo();
    if ((!activeVideo || !isVideoPlaying(activeVideo)) &&
        isVideoCandidate(state.lastManagedVideo)) {
      activeVideo = syncActiveVideo(state.lastManagedVideo);
    }

    const allowAutoResumeOnHiddenEnter = Boolean(
      matchedProfile &&
      matchedProfile.autoResumeOnHiddenEnter &&
      document.visibilityState === "hidden"
    );
    if (allowAutoResumeOnHiddenEnter &&
        activeVideo &&
        !isVideoPlaying(activeVideo) &&
        !activeVideo.ended) {
      try {
        await activeVideo.play();
      } catch (error) {
        // Ignore autoplay policy or transient resume errors.
      }
    }

    const allowEnterWhenNotPlaying = Boolean(
      matchedProfile &&
      matchedProfile.allowEnterWhenNotPlaying &&
      document.visibilityState === "hidden"
    );
    if (!isVideoPlaying(activeVideo) && !allowEnterWhenNotPlaying) {
      return false;
    }

    const allowEnterWhenHiddenVideo = Boolean(
      matchedProfile &&
      matchedProfile.allowEnterWhenHiddenVideo &&
      document.visibilityState === "hidden"
    );
    if (!allowEnterWhenHiddenVideo && !isVideoVisibleEnough(activeVideo)) {
      return false;
    }

    state.enteringPiP = true;
    try {
      const entered = await requestVideoPictureInPicture(activeVideo);
      if (!entered) {
        return false;
      }
      state.managedPiP = true;
      state.lastManagedVideo = activeVideo;
      state.hiddenRetryBudget = 0;
      clearEnterRetryTimer();
      return true;
    } catch (error) {
      return false;
    } finally {
      state.enteringPiP = false;
    }
  }

  async function maybeExitPiP() {
    if (!canExitPiP() || state.enteringPiP || state.exitingPiP) {
      return false;
    }
    if (!state.managedPiP && !document.pictureInPictureElement) {
      return true;
    }
    state.exitingPiP = true;
    state.suppressEnterUntil = Date.now() + ENTER_SUPPRESS_AFTER_EXIT_MS;
    try {
      await requestBackgroundMainWorldExitPiP(760);
      if (document.pictureInPictureElement) {
        await requestPageBridgeExitPiP(520);
      }
      if (!document.pictureInPictureElement) {
        return true;
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      return !document.pictureInPictureElement;
    } catch (error) {
      return false;
    } finally {
      state.exitingPiP = false;
      state.managedPiP = false;
    }
  }

  function recoverInlinePlaybackIfNeeded() {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (document.pictureInPictureElement) {
      return;
    }
    const video = syncActiveVideo(state.lastManagedVideo || state.activeVideo);
    if (video && video.paused && !video.ended) {
      video.play().catch(() => {
        // Best effort only.
      });
    }
  }

  function scheduleVisibleRecovery() {
    clearRecoveryTimer();
    if (!state.managedPiP && !document.pictureInPictureElement) {
      recoverInlinePlaybackIfNeeded();
      return;
    }

    let attempts = 0;
    const run = async () => {
      attempts += 1;
      await maybeExitPiP();
      recoverInlinePlaybackIfNeeded();
      if (document.visibilityState !== "visible") {
        clearRecoveryTimer();
        return;
      }
      if (document.pictureInPictureElement && attempts < 5) {
        state.recoveryTimer = setTimeout(run, attempts < 3 ? 120 : 280);
        return;
      }
      clearRecoveryTimer();
    };
    run();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      state.hiddenRetryBudget = getHiddenRetryLimit();
      if (isIqiyiHost()) {
        requestBackgroundSetupIqiyiAutoPiP(960).catch(() => {});
      }
      const now = Date.now();
      const visibleSuppressStart = Number(state.lastVisibleAt || 0);
      const isQuickRehide = visibleSuppressStart > 0 &&
        (now - visibleSuppressStart) <= QUICK_REHIDE_BYPASS_MS;
      if (isQuickRehide && Number(state.suppressEnterUntil || 0) > now) {
        state.suppressEnterUntil = 0;
      }
      clearRecoveryTimer();
      scheduleDeferredEnterPiP("visibility_hidden_retry");
      maybeEnterPiP("visibility_hidden");
      return;
    }
    if (document.visibilityState === "visible") {
      state.hiddenRetryBudget = 0;
      state.lastVisibleAt = Date.now();
      clearEnterRetryTimer();
      state.suppressEnterUntil = Date.now() + ENTER_SUPPRESS_AFTER_VISIBLE_MS;
      scheduleVisibleRecovery();
    }
  }

  function onVideoEvent(event) {
    const target = event && event.target;
    if (!(target instanceof HTMLVideoElement)) {
      return;
    }
    syncActiveVideo(target);
    if ((event.type === "play" || event.type === "playing") && !state.hadUserGesture) {
      state.hadUserGesture = true;
    }
    if ((event.type === "play" || event.type === "playing") && document.visibilityState === "hidden") {
      maybeEnterPiP("video_play_hidden");
      return;
    }
    if ((event.type === "pause" || event.type === "ended") &&
        target === document.pictureInPictureElement &&
        state.managedPiP) {
      maybeExitPiP();
    }
  }

  function onEnterPictureInPicture(event) {
    if (state.enteringPiP || document.visibilityState === "hidden") {
      state.managedPiP = true;
      return;
    }
    const target = event && event.target;
    state.managedPiP = Boolean(target && target === state.lastManagedVideo);
  }

  function onLeavePictureInPicture() {
    state.managedPiP = false;
    if (document.visibilityState === "visible") {
      scheduleVisibleRecovery();
    }
  }

  function markUserGesture() {
    state.hadUserGesture = true;
  }

  function init() {
    if (!canExitPiP()) {
      return;
    }
    if (isIqiyiHost()) {
      requestBackgroundSetupIqiyiAutoPiP(960).catch(() => {});
    }
    syncActiveVideo();
    ensurePageBridgeInjected();
    bindMediaSessionAutoPiP();

    document.addEventListener("pointerdown", markUserGesture, true);
    document.addEventListener("keydown", markUserGesture, true);
    document.addEventListener("touchstart", markUserGesture, true);
    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("play", onVideoEvent, true);
    document.addEventListener("playing", onVideoEvent, true);
    document.addEventListener("pause", onVideoEvent, true);
    document.addEventListener("ended", onVideoEvent, true);
    document.addEventListener("loadedmetadata", onVideoEvent, true);
    document.addEventListener("enterpictureinpicture", onEnterPictureInPicture, true);
    document.addEventListener("leavepictureinpicture", onLeavePictureInPicture, true);

    window.addEventListener("focus", () => {
      state.suppressEnterUntil = Date.now() + ENTER_SUPPRESS_AFTER_VISIBLE_MS;
      clearEnterRetryTimer();
      scheduleVisibleRecovery();
    }, true);
    window.addEventListener("pageshow", () => {
      state.suppressEnterUntil = Date.now() + ENTER_SUPPRESS_AFTER_VISIBLE_MS;
      clearEnterRetryTimer();
      scheduleVisibleRecovery();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }
  init();
})();
