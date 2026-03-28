(function () {
  'use strict';

  const STORAGE_KEY = 'ancestrio-consent-optional';
  const CONSENT_ACCEPTED = 'accepted';
  const CONSENT_REJECTED = 'rejected';
  const OPTIONAL_SCRIPT_SELECTOR = 'script[type="text/plain"][data-consent="optional"][data-src]';
  const PANEL_ID = 'cookie-buddy-panel';
  const LAUNCHER_ID = 'cookie-buddy-launcher';
  const OPTIONAL_TOGGLE_ID = 'cookie-buddy-optional-toggle';
  const STYLE_ID = 'cookie-buddy-style';
  const OPEN_CLASS = 'is-open';
  const ESC_KEY = 'Escape';

  let inMemoryConsent = null;

  function getConsentValue() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (_error) {
      return inMemoryConsent;
    }
  }

  function setConsentValue(value) {
    inMemoryConsent = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (_error) {
      // Ignore storage errors (private mode, blocked storage, etc.).
    }
  }

  function hasOptionalScripts() {
    return Boolean(document.querySelector(OPTIONAL_SCRIPT_SELECTOR));
  }

  function optionalScriptsLoaded() {
    if (document.querySelector('script[data-optional-loaded="true"]')) {
      return true;
    }
    return Boolean(document.querySelector(`${OPTIONAL_SCRIPT_SELECTOR}[data-optional-loaded="true"]`));
  }

  function escapeHtmlAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function shouldSkipPlaceholderAttribute(name) {
    return (
      name === 'type' ||
      name === 'data-consent' ||
      name === 'data-src' ||
      name === 'data-optional-loaded'
    );
  }

  function applyPlaceholderAttributes(targetScript, placeholder) {
    Array.from(placeholder.attributes).forEach((attribute) => {
      if (shouldSkipPlaceholderAttribute(attribute.name)) {
        return;
      }
      targetScript.setAttribute(attribute.name, attribute.value);
    });
  }

  function buildExecutableScriptTag(placeholder) {
    const attrs = [];

    Array.from(placeholder.attributes).forEach((attribute) => {
      const name = attribute.name;
      if (shouldSkipPlaceholderAttribute(name)) {
        return;
      }
      attrs.push(`${name}="${escapeHtmlAttr(attribute.value)}"`);
    });

    const dataSrc = placeholder.getAttribute('data-src');
    if (dataSrc) {
      attrs.push(`src="${escapeHtmlAttr(dataSrc)}"`);
    }

    return `<script ${attrs.join(' ')}><\/script>`;
  }

  function resolveThemedOptionalWidgetColor() {
    const root = document.documentElement;
    const body = document.body;
    if (!root && !body) return '#efb55f';

    const rootStyles = root ? window.getComputedStyle(root) : null;
    const bodyStyles = body ? window.getComputedStyle(body) : null;
    const themedColor = (
      (bodyStyles ? bodyStyles.getPropertyValue('--accent-3') : '') ||
      (rootStyles ? rootStyles.getPropertyValue('--accent-3') : '')
    ).trim();

    return themedColor || '#efb55f';
  }

  function applyOptionalWidgetThemeAttributes(placeholder) {
    if (!(placeholder instanceof HTMLElement)) return;

    const widgetName = placeholder.getAttribute('data-name');
    const colorValue = (placeholder.getAttribute('data-color') || '').trim().toLowerCase();
    if (widgetName !== 'BMC-Widget') return;
    if (colorValue && colorValue !== 'auto') return;

    placeholder.setAttribute('data-color', resolveThemedOptionalWidgetColor());
  }

  function loadOptionalScripts() {
    const placeholders = document.querySelectorAll(OPTIONAL_SCRIPT_SELECTOR);
    const canWriteSync = document.readyState === 'loading' && typeof document.write === 'function';

    placeholders.forEach((placeholder) => {
      if (placeholder.dataset.optionalLoaded === 'true') {
        return;
      }

      applyOptionalWidgetThemeAttributes(placeholder);

      if (canWriteSync) {
        var markup = buildExecutableScriptTag(placeholder);
        placeholder.dataset.optionalLoaded = 'true';
        var temp = document.createElement('div');
        temp.innerHTML = markup;
        var fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          if (temp.firstChild.tagName === 'SCRIPT') {
            var oldScript = temp.firstChild;
            var newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(function(attr) {
              newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            temp.removeChild(oldScript);
            fragment.appendChild(newScript);
          } else {
            fragment.appendChild(temp.firstChild);
          }
        }
        (document.head || document.documentElement).appendChild(fragment);
        return;
      }

      const loadedScript = document.createElement('script');
      applyPlaceholderAttributes(loadedScript, placeholder);

      loadedScript.src = placeholder.getAttribute('data-src');
      loadedScript.async = false;
      loadedScript.dataset.optionalLoaded = 'true';
      placeholder.dataset.optionalLoaded = 'true';
      placeholder.parentNode.insertBefore(loadedScript, placeholder.nextSibling);
    });
  }

  function injectConsentStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${LAUNCHER_ID} {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 2147483646;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: var(--radius-pill);
        width: 44px;
        height: 44px;
        padding: 0;
        color: var(--cookie-launcher-text);
        background: linear-gradient(135deg, var(--cookie-launcher-bg-start) 0%, var(--cookie-launcher-bg-end) 100%);
        box-shadow: none;
        cursor: pointer;
        transition: transform var(--transition-base, 200ms) ease, box-shadow var(--transition-base, 200ms) ease;
        font-family: var(--font-body, "Inter", "Segoe UI", sans-serif);
        font-size: 14px;
        font-weight: 700;
      }

      #${LAUNCHER_ID}::after {
        display: none !important;
      }

      #${LAUNCHER_ID}:hover {
        transform: translateY(-1px);
        box-shadow: none;
      }

      #${LAUNCHER_ID} .cookie-buddy-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
      }

      #${LAUNCHER_ID} .cookie-buddy-glyph {
        font-size: 24px;
      }

      #bmc-wbtn {
        width: 44px !important;
        height: 44px !important;
        border-radius: var(--radius-pill) !important;
      }

      #bmc-wbtn img {
        width: 24px !important;
        height: 24px !important;
      }

      #${PANEL_ID} {
        position: fixed;
        left: 12px;
        bottom: 64px;
        z-index: 2147483647;
        width: min(390px, calc(100vw - 24px));
        border-radius: var(--radius-surface);
        background: var(--cookie-panel-bg);
        border: none;
        box-shadow: none;
        color: var(--text);
        font-family: var(--font-body, "Inter", "Segoe UI", sans-serif);
        transform: translateY(14px) scale(0.98);
        opacity: 0;
        pointer-events: none;
        transition: transform var(--transition-base, 200ms) ease, opacity var(--transition-base, 200ms) ease;
      }

      #${PANEL_ID}.${OPEN_CLASS} {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }

      #${PANEL_ID} .buddy-card {
        padding: 14px;
      }

      #${PANEL_ID} .buddy-header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
      }

      #${PANEL_ID} .buddy-header-icon {
        width: 30px;
        height: 30px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--cookie-btn-accent-bg);
        color: var(--cookie-btn-accent-text);
        font-size: 18px;
        box-shadow: none;
        flex: 0 0 auto;
      }

      #${PANEL_ID} .buddy-header-icon .material-symbols-outlined {
        font-size: 18px;
      }

      #${PANEL_ID} .buddy-header-copy {
        flex: 1;
        min-width: 0;
      }

      #${PANEL_ID} .buddy-title {
        margin: 0;
        font-family: var(--font-display, "Space Grotesk", "Inter", sans-serif);
        font-size: 20px;
        line-height: 1.1;
      }

      #${PANEL_ID} .buddy-subtitle {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.35;
      }

      #${PANEL_ID} .buddy-close {
        appearance: none;
        border: none;
        background: var(--cookie-chip-bg);
        color: var(--text);
        width: 28px;
        height: 28px;
        border-radius: var(--radius-button-icon);
        font-size: 16px;
        cursor: pointer;
        flex: 0 0 auto;
      }

      #${PANEL_ID} .buddy-options {
        display: grid;
        gap: 8px;
      }

      #${PANEL_ID} .buddy-option {
        border: none;
        border-radius: var(--radius-control);
        background: var(--cookie-chip-bg);
        padding: 10px 12px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
      }

      #${PANEL_ID} .buddy-option-title {
        margin: 0;
        font-weight: 700;
        font-size: 15px;
        line-height: 1.2;
      }

      #${PANEL_ID} .buddy-option-desc {
        margin: 2px 0 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.3;
      }

      #${PANEL_ID} .buddy-switch {
        position: relative;
        display: inline-block;
        width: 48px;
        height: 28px;
        flex: 0 0 auto;
      }

      #${PANEL_ID} .buddy-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      #${PANEL_ID} .buddy-slider {
        position: absolute;
        inset: 0;
        background: var(--cookie-switch-track);
        border-radius: var(--radius-pill);
        transition: background var(--transition-base, 200ms) ease;
      }

      #${PANEL_ID} .buddy-slider::before {
        content: "";
        position: absolute;
        width: 22px;
        height: 22px;
        left: 3px;
        top: 3px;
        border-radius: 50%;
        background: var(--cookie-switch-thumb);
        box-shadow: none;
        transition: transform var(--transition-base, 200ms) ease;
      }

      #${PANEL_ID} .buddy-switch input:checked + .buddy-slider {
        background: var(--accent);
      }

      #${PANEL_ID} .buddy-switch input:checked + .buddy-slider::before {
        transform: translateX(20px);
      }

      #${PANEL_ID} .buddy-switch input:disabled + .buddy-slider {
        opacity: 0.72;
      }

      #${PANEL_ID} .buddy-actions {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      #${PANEL_ID} .buddy-btn {
        appearance: none;
        border-radius: var(--radius-button);
        border: none;
        background: var(--cookie-btn-bg);
        color: var(--cookie-btn-text);
        padding: 10px 12px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      #${PANEL_ID} .buddy-btn--accent {
        background: var(--cookie-btn-accent-bg);
        border-color: transparent;
        color: var(--cookie-btn-accent-text);
      }

      #${PANEL_ID} .buddy-btn--decline {
        margin-top: 8px;
        width: 100%;
        background: var(--cookie-btn-accent-bg);
        border-color: transparent;
        color: var(--cookie-btn-accent-text);
      }

      #${PANEL_ID} .buddy-btn::after,
      #${PANEL_ID} .buddy-close::after {
        display: none !important;
      }

      @media (max-width: 1120px) {
        #${LAUNCHER_ID} {
          top: calc(12px + env(safe-area-inset-top));
          bottom: auto;
        }

        #${PANEL_ID} {
          top: calc(64px + env(safe-area-inset-top));
          bottom: auto;
        }
      }

      @media (max-width: 640px) {
        #${PANEL_ID} {
          top: calc(58px + env(safe-area-inset-top));
          bottom: auto;
          border-radius: var(--radius-modal);
        }

        #${PANEL_ID} .buddy-title {
          font-size: 18px;
        }

        #${PANEL_ID} .buddy-actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setPanelOpen(panel, launcher, isOpen) {
    panel.classList.toggle(OPEN_CLASS, isOpen);
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    launcher.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function createLauncher() {
    const launcher = document.createElement('button');
    launcher.id = LAUNCHER_ID;
    launcher.type = 'button';
    launcher.setAttribute('aria-controls', PANEL_ID);
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', 'Cookie settings');
    launcher.innerHTML = `
      <span class="cookie-buddy-badge" aria-hidden="true">
        <span class="material-symbols-outlined cookie-buddy-glyph" aria-hidden="true">cookie</span>
      </span>
    `;
    document.body.appendChild(launcher);
    return launcher;
  }

  function createPanel(optionalEnabled) {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Cookie settings');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="buddy-card">
        <div class="buddy-header">
          <span class="buddy-header-icon" aria-hidden="true"><span class="material-symbols-outlined">cookie</span></span>
          <div class="buddy-header-copy">
            <h2 class="buddy-title">Cookie Buddy</h2>
            <p class="buddy-subtitle">Choose which optional tools can run. Core site features are always active.</p>
          </div>
          <button type="button" class="buddy-close" data-action="close" aria-label="Close cookie settings">x</button>
        </div>
        <div class="buddy-options">
          <div class="buddy-option">
            <div>
              <p class="buddy-option-title">Necessary</p>
              <p class="buddy-option-desc">Always on for login and core site behavior.</p>
            </div>
            <label class="buddy-switch" aria-label="Necessary cookies always on">
              <input type="checkbox" checked disabled />
              <span class="buddy-slider" aria-hidden="true"></span>
            </label>
          </div>
          <div class="buddy-option">
            <div>
              <p class="buddy-option-title">Optional widgets</p>
              <p class="buddy-option-desc">Buy Me a Coffee floating widget.</p>
            </div>
            <label class="buddy-switch" aria-label="Optional widgets">
              <input id="${OPTIONAL_TOGGLE_ID}" type="checkbox" ${optionalEnabled ? 'checked' : ''} />
              <span class="buddy-slider" aria-hidden="true"></span>
            </label>
          </div>
        </div>
        <div class="buddy-actions">
          <button type="button" class="buddy-btn buddy-btn--accent" data-action="accept-all">Accept all</button>
          <button type="button" class="buddy-btn" data-action="save">Save</button>
        </div>
        <button type="button" class="buddy-btn buddy-btn--decline" data-action="decline">Decline non-essential</button>
      </div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function initConsent() {
    if (!hasOptionalScripts()) {
      return;
    }

    injectConsentStyles();
    const consentValue = getConsentValue();
    const optionalEnabled = consentValue === CONSENT_ACCEPTED;
    const panel = createPanel(optionalEnabled);
    const launcher = createLauncher();
    const optionalToggle = panel.querySelector(`#${OPTIONAL_TOGGLE_ID}`);

    if (!optionalToggle) {
      return;
    }

    if (optionalEnabled) {
      loadOptionalScripts();
    }

    launcher.addEventListener('click', function () {
      const currentlyOpen = panel.classList.contains(OPEN_CLASS);
      if (!currentlyOpen) {
        optionalToggle.checked = getConsentValue() === CONSENT_ACCEPTED;
      }
      setPanelOpen(panel, launcher, !currentlyOpen);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === ESC_KEY && panel.classList.contains(OPEN_CLASS)) {
        setPanelOpen(panel, launcher, false);
      }
    });

    function saveChoice(enableOptional) {
      const previousConsent = getConsentValue();
      const hadLoadedOptional = optionalScriptsLoaded();

      if (enableOptional) {
        setConsentValue(CONSENT_ACCEPTED);
        loadOptionalScripts();
        if (previousConsent !== CONSENT_ACCEPTED && document.readyState !== 'loading') {
          window.setTimeout(function () {
            window.location.reload();
          }, 120);
        }
        return;
      }

      setConsentValue(CONSENT_REJECTED);
      if (hadLoadedOptional) {
        window.setTimeout(function () {
          window.location.reload();
        }, 120);
      }
    }

    panel.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.getAttribute('data-action');
      if (!action) {
        return;
      }

      if (action === 'close') {
        setPanelOpen(panel, launcher, false);
        return;
      }

      if (action === 'accept-all') {
        optionalToggle.checked = true;
        saveChoice(true);
        setPanelOpen(panel, launcher, false);
        return;
      }

      if (action === 'save') {
        saveChoice(optionalToggle.checked);
        setPanelOpen(panel, launcher, false);
        return;
      }

      if (action === 'decline') {
        optionalToggle.checked = false;
        saveChoice(false);
        setPanelOpen(panel, launcher, false);
      }
    });

    const firstVisit = consentValue !== CONSENT_ACCEPTED && consentValue !== CONSENT_REJECTED;
    if (firstVisit) {
      setPanelOpen(panel, launcher, true);
    }
  }

  initConsent();
})();

