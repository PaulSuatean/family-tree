(function (global) {
  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      return document.getElementById(target);
    }
    return target;
  }

  function syncBodyScrollLock() {
    const anyOpen = !!document.querySelector(
      '.modal:not([hidden]), .modal.open, .help-modal.open, .add-member-modal.show'
    );
    document.body.classList.toggle('scroll-locked', anyOpen);
  }

  function setDisplay(target, displayValue) {
    const el = resolveElement(target);
    if (!el) return null;
    if (displayValue === 'none') {
      el.setAttribute('hidden', '');
      el.style.display = '';
    } else {
      el.removeAttribute('hidden');
      el.style.display = displayValue;
    }
    syncBodyScrollLock();
    return el;
  }

  function show(target, displayValue = 'block') {
    return setDisplay(target, displayValue);
  }

  function hide(target) {
    return setDisplay(target, 'none');
  }

  function isInlineVisible(target) {
    const el = resolveElement(target);
    if (!el) return false;
    return !el.hasAttribute('hidden') && el.style.display !== 'none';
  }

  function toggle(target, visible, displayValue = 'block') {
    return visible ? show(target, displayValue) : hide(target);
  }

  global.AncestrioDomDisplay = {
    resolveElement,
    setDisplay,
    show,
    hide,
    isInlineVisible,
    toggle
  };
})(window);
