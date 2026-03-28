/**
 * Shared utility functions used across multiple pages.
 * Loaded after runtime.js, before page-specific scripts.
 */
(function () {
  'use strict';

  function debounce(fn, ms) {
    let id;
    return function (...args) {
      clearTimeout(id);
      id = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function sanitizeViewStyleValue(value, fallback, allowedValues) {
    const normalized = String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    return allowedValues.has(normalized) ? normalized : fallback;
  }

  function parseBooleanFlag(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
      if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
    }
    return !!fallback;
  }

  function notifyUser(message, type, options) {
    if (window.AncestrioRuntime && typeof window.AncestrioRuntime.notify === 'function') {
      window.AncestrioRuntime.notify(message, type, options);
      return;
    }
    if (type === 'error') {
      console.error(message);
    } else {
      console.warn(message);
    }
  }

  function toSafeText(value) {
    return value == null ? '' : String(value);
  }

  function getUtf8Size(value) {
    if (value === null || value === undefined) return 0;
    const text = String(value);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function isImageDataUrl(value) {
    return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value);
  }

  function normalizeEditorAssetPath(value) {
    const cleaned = toSafeText(value).trim();
    if (!cleaned) return '';
    if (
      isImageDataUrl(cleaned) ||
      /^blob:/i.test(cleaned) ||
      /^(?:https?:)?\/\//i.test(cleaned) ||
      cleaned.startsWith('../') ||
      cleaned.startsWith('./') ||
      cleaned.startsWith('/')
    ) {
      return cleaned;
    }
    if (cleaned.startsWith('images/')) {
      return `../${cleaned}`;
    }
    return cleaned;
  }

  function deriveEditorThumbPath(value) {
    const normalized = normalizeEditorAssetPath(value);
    if (
      !normalized ||
      isImageDataUrl(normalized) ||
      /^blob:/i.test(normalized) ||
      /^(?:https?:)?\/\//i.test(normalized)
    ) {
      return normalized;
    }
    if (normalized.startsWith('../images/thumbs/')) return normalized;
    if (normalized.startsWith('../images/')) {
      return `../images/thumbs/${normalized.slice('../images/'.length)}`;
    }
    return normalized;
  }

  function resolveEditorAvatarImage(value) {
    const full = normalizeEditorAssetPath(value);
    const thumb = deriveEditorThumbPath(value);
    return {
      full,
      preferred: thumb || full || ''
    };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = typeof event.target?.result === 'string' ? event.target.result : '';
        resolve(result);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        resolve(result);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to convert blob'));
      reader.readAsDataURL(blob);
    });
  }

  function loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image data'));
      img.src = dataUrl;
    });
  }

  window.AncUtils = {
    debounce: debounce,
    sanitizeViewStyleValue: sanitizeViewStyleValue,
    parseBooleanFlag: parseBooleanFlag,
    notifyUser: notifyUser
  };

  window.AncestrioEditorMediaUtils = {
    getUtf8Size: getUtf8Size,
    formatBytes: formatBytes,
    isImageDataUrl: isImageDataUrl,
    normalizeEditorAssetPath: normalizeEditorAssetPath,
    deriveEditorThumbPath: deriveEditorThumbPath,
    resolveEditorAvatarImage: resolveEditorAvatarImage,
    readFileAsDataUrl: readFileAsDataUrl,
    blobToDataUrl: blobToDataUrl,
    loadImageElement: loadImageElement
  };
})();
