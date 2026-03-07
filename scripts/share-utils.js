(function (global) {
  const DEFAULT_SHARE_PATH = 'tree.html';

  function normalizeTreeId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function buildTreeShareUrl(treeId, path) {
    const safeTreeId = normalizeTreeId(treeId);
    if (!safeTreeId) return '';
    const sharePath = typeof path === 'string' && path.trim() ? path.trim() : DEFAULT_SHARE_PATH;
    try {
      const url = new URL(sharePath, global.location && global.location.href ? global.location.href : undefined);
      url.searchParams.set('id', safeTreeId);
      return url.toString();
    } catch (_) {
      return `${sharePath}?id=${encodeURIComponent(safeTreeId)}`;
    }
  }

  async function copyToClipboard(text) {
    const value = typeof text === 'string' ? text : '';
    if (!value) return false;

    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
      try {
        await global.navigator.clipboard.writeText(value);
        return true;
      } catch (_) {
        // Fall back to execCommand path.
      }
    }

    if (!global.document || !global.document.body) return false;
    const field = global.document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.style.pointerEvents = 'none';
    field.style.left = '-9999px';
    global.document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, value.length);

    let success = false;
    try {
      success = global.document.execCommand('copy');
    } catch (_) {
      success = false;
    } finally {
      global.document.body.removeChild(field);
    }

    return success;
  }

  function notifyShare(message, type) {
    const safeMessage = typeof message === 'string' ? message : '';
    const safeType = typeof type === 'string' ? type : 'info';
    if (global.AncestrioRuntime && typeof global.AncestrioRuntime.notify === 'function') {
      global.AncestrioRuntime.notify(safeMessage, safeType);
      return;
    }
    if (safeType === 'error') {
      console.error(safeMessage);
      return;
    }
    console.log(safeMessage);
  }

  global.AncestrioShareUtils = {
    buildTreeShareUrl,
    copyToClipboard,
    notifyShare
  };
})(window);
