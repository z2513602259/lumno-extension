(function() {
  if (window._x_extension_createSearchInput_2024_unique_) {
    return;
  }

  function applyStyleOverrides(element, overrides) {
    if (!overrides) {
      return;
    }
    Object.keys(overrides).forEach((property) => {
      element.style.setProperty(property, overrides[property]);
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

  function getMessage(key, fallback) {
    try {
      if (chrome && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
        const value = chrome.i18n.getMessage(key);
        if (value) {
          return value;
        }
      }
    } catch (error) {
      // Ignore i18n failures in page context.
    }
    return fallback;
  }
  const SEARCH_INPUT_CONTAINER_CLASS = '_x_extension_input_container_base_2026_unique_';
  const SEARCH_INPUT_SURFACE_CLASS = '_x_extension_input_surface_base_2026_unique_';
  const SEARCH_INPUT_ACCESSORY_LAYER_CLASS = '_x_extension_input_accessory_layer_base_2026_unique_';
  const SEARCH_INPUT_FIELD_CLASS = '_x_extension_search_input_base_2026_unique_';
  const SEARCH_INPUT_DIVIDER_CLASS = '_x_extension_input_divider_base_2026_unique_';
  const SEARCH_INPUT_LEFT_ICON_CLASS = '_x_extension_search_icon_base_2026_unique_';
  const SEARCH_INPUT_RIGHT_ICON_CLASS = '_x_extension_search_right_icon_base_2026_unique_';

  function clampNumber(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }
  function buildSearchInputShadowCss() {
    return `
      :host {
        all: initial;
        position: relative;
        width: 100%;
        flex-shrink: 0;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        display: block;
        background: transparent;
        border: none;
        border-radius: 28px 28px 0 0;
        outline: none;
        overflow: visible;
        contain: layout style paint;
        isolation: isolate;
      }
      .${SEARCH_INPUT_SURFACE_CLASS} {
        all: initial;
        position: relative;
        width: 100%;
        height: 100%;
        min-height: inherit;
        max-height: inherit;
        display: block;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: inherit;
        overflow: hidden;
      }
      .${SEARCH_INPUT_ACCESSORY_LAYER_CLASS} {
        all: initial;
        position: absolute;
        inset: 0;
        display: block;
        box-sizing: border-box;
        pointer-events: none;
        z-index: 3;
      }
      .${SEARCH_INPUT_FIELD_CLASS} {
        all: unset;
        width: 100%;
        padding: 20px 64px 20px 50px;
        background: transparent;
        border: none;
        border-bottom: none;
        border-radius: 0;
        color: var(--x-ext-input-text, #1F2937);
        font-size: 16px;
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-weight: 500;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        margin: 0;
        line-height: 1;
        text-decoration: none;
        list-style: none;
        display: block;
        text-align: left;
        cursor: text;
        vertical-align: baseline;
        caret-color: var(--x-ext-input-caret, #7DB7FF);
      }
      .${SEARCH_INPUT_FIELD_CLASS}::placeholder,
      .${SEARCH_INPUT_FIELD_CLASS}::-webkit-input-placeholder {
        color: var(--x-ov-placeholder, #9CA3AF);
        opacity: 0.68;
        text-align: left;
      }
      .${SEARCH_INPUT_FIELD_CLASS}::selection {
        background: #CFE8FF;
        color: #1E3A8A;
      }
      .${SEARCH_INPUT_DIVIDER_CLASS} {
        all: unset;
        position: absolute;
        left: var(--x-ext-input-divider-inset, 20px);
        right: var(--x-ext-input-divider-inset, 20px);
        bottom: 0;
        height: 1px;
        background: var(--x-ext-input-underline, #E5E7EB);
        opacity: var(--x-ext-input-divider-opacity, 0.55);
        pointer-events: none;
        display: block;
      }
      .${SEARCH_INPUT_LEFT_ICON_CLASS} {
        all: unset;
        position: absolute;
        left: 20px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--x-ext-input-icon, #9CA3AF);
        pointer-events: none;
        z-index: 1;
        box-sizing: border-box;
        margin: 0;
        padding: 6px 0;
        line-height: 1;
        outline: none;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .${SEARCH_INPUT_RIGHT_ICON_CLASS},
      .x-ov-toolbar-button {
        all: unset;
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        z-index: 2;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        line-height: 1;
        outline: none;
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0;
        color: var(--x-ext-input-icon, #9CA3AF);
        cursor: pointer;
        pointer-events: auto;
        transition: background-color 140ms ease, color 140ms ease, transform 160ms ease;
      }
      .${SEARCH_INPUT_LEFT_ICON_CLASS} svg,
      .${SEARCH_INPUT_RIGHT_ICON_CLASS} svg,
      .x-ov-toolbar-button svg,
      .${SEARCH_INPUT_LEFT_ICON_CLASS} img,
      .${SEARCH_INPUT_RIGHT_ICON_CLASS} img,
      .x-ov-toolbar-button img {
        width: 16px;
        height: 16px;
        display: block;
        flex-shrink: 0;
        pointer-events: none;
      }
      .${SEARCH_INPUT_RIGHT_ICON_CLASS} > *,
      .x-ov-toolbar-button > * {
        pointer-events: none;
      }
      .x-ov-mode-badge,
      .x-nt-mode-badge {
        all: unset;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--x-ov-tag-bg, var(--x-nt-tag-bg, #F3F4F6));
        color: var(--x-ov-tag-text, var(--x-nt-tag-text, #6B7280));
        border: 1px solid var(--x-ov-border, var(--x-nt-panel-border, rgba(0, 0, 0, 0.08)));
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
        pointer-events: none;
        z-index: 2;
      }
      .x-ov-mode-badge { right: 86px; }
      .x-nt-mode-badge { right: 52px; }
      .x-ov-site-search-prefix,
      .x-nt-site-search-prefix {
        all: unset;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        left: 50px;
        display: inline-flex;
        align-items: center;
        max-width: 0;
        padding: 0 8px;
        height: 22px;
        border-radius: 8px;
        border: none;
        background: var(--x-ext-tag-bg, #EEF6FF);
        color: #FFFFFF;
        box-sizing: border-box;
        overflow: hidden;
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        pointer-events: none;
        z-index: 1;
      }
      .x-ov-site-search-prefix-label,
      .x-nt-site-search-prefix-label {
        all: unset;
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1;
      }
      .x-ov-mode-badge[hidden],
      .x-nt-mode-badge[hidden],
      .x-ov-site-search-prefix[hidden],
      .x-nt-site-search-prefix[hidden] {
        display: none;
      }
    `;
  }

  function buildSearchIconSvgMarkup() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="M20 20l-3.5-3.5"></path>
      </svg>
    `;
  }

  function buildSettingsIconSvgMarkup() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z"></path>
      </svg>
    `;
  }
  window._x_extension_createSearchInput_2024_unique_ = function(options) {
    const config = options || {};
    const container = document.createElement('div');
    applyNoTranslate(container);
    container.id = config.containerId || '_x_extension_input_container_2024_unique_';
    container.className = SEARCH_INPUT_CONTAINER_CLASS;
    container.style.setProperty('all', 'initial');
    container.style.setProperty('position', 'relative');
    container.style.setProperty('display', 'block');
    container.style.setProperty('width', '100%');
    container.style.setProperty('box-sizing', 'border-box');
    container.style.setProperty('margin', '0');
    container.style.setProperty('padding', '0');
    container.style.setProperty('background', 'transparent');
    container.style.setProperty('border', 'none');
    container.style.setProperty('outline', 'none');
    container.style.setProperty('overflow', 'visible');
    container.style.setProperty('contain', 'layout style paint');
    container.style.setProperty('isolation', 'isolate');

    const shadowRoot = container.attachShadow({ mode: 'open' });
    const shadowStyle = document.createElement('style');
    shadowStyle.textContent = buildSearchInputShadowCss();
    shadowRoot.appendChild(shadowStyle);

    const surface = document.createElement('div');
    applyNoTranslate(surface);
    surface.className = SEARCH_INPUT_SURFACE_CLASS;
    shadowRoot.appendChild(surface);

    const accessoryLayer = document.createElement('div');
    applyNoTranslate(accessoryLayer);
    accessoryLayer.className = SEARCH_INPUT_ACCESSORY_LAYER_CLASS;
    shadowRoot.appendChild(accessoryLayer);

    const input = document.createElement('input');
    applyNoTranslate(input);
    input.id = config.inputId || '_x_extension_search_input_2024_unique_';
    input.className = SEARCH_INPUT_FIELD_CLASS;
    input.autocomplete = 'off';
    input.type = 'text';
    input.placeholder = config.placeholder || getMessage('search_placeholder', '搜索或输入网址...');
    applyStyleOverrides(input, config.inputStyleOverrides);

    const hasBorderOverride = Boolean(
      config.inputStyleOverrides &&
      Object.prototype.hasOwnProperty.call(config.inputStyleOverrides, 'border-bottom')
    );
    const showUnderlineWhenEmpty = Boolean(config.showUnderlineWhenEmpty);

    const divider = document.createElement('div');
    applyNoTranslate(divider);
    divider.id = config.dividerId || '_x_extension_input_divider_2024_unique_';
    divider.className = SEARCH_INPUT_DIVIDER_CLASS;
    applyStyleOverrides(divider, config.dividerStyleOverrides);

    function updateInputUnderline(value) {
      if (hasBorderOverride) {
        divider.style.display = 'none';
        return;
      }
      if (showUnderlineWhenEmpty) {
        divider.style.display = 'block';
        return;
      }
      const isEmpty = !value || !value.trim();
      divider.style.display = isEmpty ? 'none' : 'block';
    }

    updateInputUnderline(input.value);

    if (typeof config.onInput === 'function') {
      input.addEventListener('input', config.onInput);
    }
    input.addEventListener('input', function(event) {
      updateInputUnderline(event.target.value);
    });
    if (typeof config.onFocus === 'function') {
      input.addEventListener('focus', config.onFocus);
    }
    if (typeof config.onBlur === 'function') {
      input.addEventListener('blur', config.onBlur);
    }
    if (typeof config.onKeyDown === 'function') {
      input.addEventListener('keydown', config.onKeyDown);
    }

    function ensureOpenSansStyles() {
      if (!chrome || !chrome.runtime || !chrome.runtime.getURL) {
        return;
      }
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
      link.href = chrome.runtime.getURL('assets/fonts/open-sans/open-sans.css');
      host.appendChild(link);
    }

    ensureOpenSansStyles();
    const icon = document.createElement('div');
    applyNoTranslate(icon);
    icon.id = config.iconId || '_x_extension_search_icon_2024_unique_';
    icon.className = SEARCH_INPUT_LEFT_ICON_CLASS;
    icon.innerHTML = buildSearchIconSvgMarkup();
    applyStyleOverrides(icon, config.iconStyleOverrides);

    const rightIcon = document.createElement('button');
    applyNoTranslate(rightIcon);
    rightIcon.id = config.rightIconId || '_x_extension_search_right_icon_2024_unique_';
    rightIcon.className = SEARCH_INPUT_RIGHT_ICON_CLASS;
    rightIcon.type = 'button';
    rightIcon.innerHTML = config.rightIconHtml || buildSettingsIconSvgMarkup();
    rightIcon.setAttribute('aria-label', config.rightIconAlt || getMessage('settings_button_aria', 'Settings'));
    applyStyleOverrides(rightIcon, config.rightIconStyleOverrides);
    const resetRightIconVisualState = () => {
      rightIcon.style.background = 'transparent';
      rightIcon.style.color = 'var(--x-ext-input-icon, #9CA3AF)';
      rightIcon.style.transform = 'translateY(-50%)';
    };
    resetRightIconVisualState();
    rightIcon.addEventListener('mouseenter', () => {
      rightIcon.style.background = 'var(--x-ext-input-icon-hover-bg, rgba(148, 163, 184, 0.16))';
      rightIcon.style.color = 'var(--x-ext-input-icon-hover, #4B5563)';
      rightIcon.style.transform = 'translateY(-50%) scale(1.06)';
    });
    rightIcon.addEventListener('mouseleave', resetRightIconVisualState);
    rightIcon.addEventListener('blur', resetRightIconVisualState);
    rightIcon.addEventListener('pointerup', resetRightIconVisualState);
    rightIcon.addEventListener('pointercancel', resetRightIconVisualState);
    rightIcon.addEventListener('click', () => {
      resetRightIconVisualState();
      if (typeof rightIcon.blur === 'function') {
        rightIcon.blur();
      }
    });

    applyStyleOverrides(container, config.containerStyleOverrides);

    surface.appendChild(icon);
    surface.appendChild(input);
    surface.appendChild(divider);
    if (config.showRightIcon !== false) {
      surface.appendChild(rightIcon);
    }

    return {
      container: container,
      input: input,
      icon: icon,
      rightIcon: rightIcon,
      divider: divider,
      chromeLayer: accessoryLayer,
      shadowRoot: shadowRoot
    };
  };
})();
