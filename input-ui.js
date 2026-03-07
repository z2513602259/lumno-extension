(function() {
  if (window._x_extension_createSearchInput_2024_unique_) {
    return;
  }

  function applyStyleOverrides(element, overrides) {
    if (!overrides) {
      return;
    }
    Object.keys(overrides).forEach((property) => {
      element.style.setProperty(property, overrides[property], 'important');
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


  window._x_extension_createSearchInput_2024_unique_ = function(options) {
    const config = options || {};
    const input = document.createElement('input');
    applyNoTranslate(input);
    input.id = config.inputId || '_x_extension_search_input_2024_unique_';
    input.autocomplete = 'off';
    input.type = 'text';
    input.placeholder = config.placeholder || '搜索或输入网址...';
    input.style.cssText = `
      all: unset !important;
      width: 100% !important;
      padding: 20px 64px 20px 50px !important;
      background: transparent !important;
      border: none !important;
      border-bottom: none !important;
      color: var(--x-ext-input-text, #1F2937) !important;
      font-size: 16px !important;
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      font-weight: 500 !important;
      outline: none !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      display: block !important;
      text-align: left !important;
      cursor: text !important;
      vertical-align: baseline !important;
      caret-color: var(--x-ext-input-caret, #7DB7FF) !important;
    `;
    applyStyleOverrides(input, config.inputStyleOverrides);

    const hasBorderOverride = Boolean(
      config.inputStyleOverrides &&
      Object.prototype.hasOwnProperty.call(config.inputStyleOverrides, 'border-bottom')
    );
    const showUnderlineWhenEmpty = Boolean(config.showUnderlineWhenEmpty);

    const divider = document.createElement('div');
    applyNoTranslate(divider);
    divider.id = config.dividerId || '_x_extension_input_divider_2024_unique_';
    divider.style.cssText = `
      all: unset !important;
      position: absolute !important;
      left: var(--x-ext-input-divider-inset, 20px) !important;
      right: var(--x-ext-input-divider-inset, 20px) !important;
      bottom: 0 !important;
      height: 1px !important;
      background: var(--x-ext-input-underline, #E5E7EB) !important;
      opacity: var(--x-ext-input-divider-opacity, 0.55) !important;
      pointer-events: none !important;
      display: block !important;
    `;
    applyStyleOverrides(divider, config.dividerStyleOverrides);

    function updateInputUnderline(value) {
      if (hasBorderOverride) {
        divider.style.setProperty('display', 'none', 'important');
        return;
      }
      if (showUnderlineWhenEmpty) {
        divider.style.setProperty('display', 'block', 'important');
        return;
      }
      const isEmpty = !value || !value.trim();
      divider.style.setProperty('display', isEmpty ? 'none' : 'block', 'important');
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

    function ensureRemixIconStyles() {
      if (!chrome || !chrome.runtime || !chrome.runtime.getURL) {
        return;
      }
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
      link.href = chrome.runtime.getURL('assets/remixicon/fonts/remixicon.css');
      host.appendChild(link);
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
    ensureRemixIconStyles();
    const icon = document.createElement('div');
    applyNoTranslate(icon);
    icon.id = config.iconId || '_x_extension_search_icon_2024_unique_';
    icon.innerHTML = '<i class="_x_extension_svg_2024_unique_ ri-icon ri-size-16 ri-search-line" aria-hidden="true"></i>';
    icon.style.cssText = `
      all: unset !important;
      position: absolute !important;
      left: 20px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      color: var(--x-ext-input-icon, #9CA3AF) !important;
      pointer-events: none !important;
      z-index: 1 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 6px 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;
    applyStyleOverrides(icon, config.iconStyleOverrides);

    const rightIcon = document.createElement('button');
    applyNoTranslate(rightIcon);
    rightIcon.id = config.rightIconId || '_x_extension_search_right_icon_2024_unique_';
    rightIcon.type = 'button';
    rightIcon.innerHTML = config.rightIconHtml || '<i class="_x_extension_svg_2024_unique_ ri-icon ri-size-16 ri-settings-6-line" aria-hidden="true"></i>';
    rightIcon.setAttribute('aria-label', config.rightIconAlt || 'Settings');
    rightIcon.style.cssText = `
      all: unset !important;
      position: absolute !important;
      right: 14px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      width: 30px !important;
      height: 30px !important;
      border-radius: 8px !important;
      z-index: 2 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: var(--x-ext-input-icon, #9CA3AF) !important;
      cursor: pointer !important;
      transition: background-color 140ms ease, color 140ms ease, transform 160ms ease !important;
    `;
    applyStyleOverrides(rightIcon, config.rightIconStyleOverrides);
    const resetRightIconVisualState = () => {
      rightIcon.style.setProperty('background', 'transparent', 'important');
      rightIcon.style.setProperty('color', 'var(--x-ext-input-icon, #9CA3AF)', 'important');
      rightIcon.style.setProperty('transform', 'translateY(-50%)', 'important');
    };
    resetRightIconVisualState();
    rightIcon.addEventListener('mouseenter', () => {
      rightIcon.style.setProperty('background', 'var(--x-ext-input-icon-hover-bg, rgba(148, 163, 184, 0.16))', 'important');
      rightIcon.style.setProperty('color', 'var(--x-ext-input-icon-hover, #4B5563)', 'important');
      rightIcon.style.setProperty('transform', 'translateY(-50%) scale(1.06)', 'important');
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

    const container = document.createElement('div');
    applyNoTranslate(container);
    container.id = config.containerId || '_x_extension_input_container_2024_unique_';
    container.style.cssText = `
      all: unset !important;
      position: relative !important;
      width: 100% !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
      display: block !important;
      background: transparent !important;
      border-radius: 28px 28px 0 0 !important;
      overflow: hidden !important;
    `;
    applyStyleOverrides(container, config.containerStyleOverrides);

    container.appendChild(icon);
    container.appendChild(input);
    container.appendChild(divider);
    if (config.showRightIcon !== false) {
      container.appendChild(rightIcon);
    }

    return { container: container, input: input, icon: icon, rightIcon: rightIcon, divider: divider };
  };
})();
