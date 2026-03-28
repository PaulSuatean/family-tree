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

  function buildSocialShareUrl(platform, shareUrl, title) {
    const encodedUrl = encodeURIComponent(shareUrl || '');
    const encodedTitle = encodeURIComponent(title || 'Family tree');

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      case 'x':
        return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
      default:
        return '';
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
    }
  }

  function setSocialShareLinks(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const shareUrl = typeof opts.shareUrl === 'string' ? opts.shareUrl : '';
    const treeName = typeof opts.treeName === 'string' ? opts.treeName : 'Family tree';
    const isPublic = opts.isPublic === true;
    const links = Array.from(
      opts.links || (global.document ? global.document.querySelectorAll('[data-share-platform]') : [])
    );

    links.forEach((link) => {
      const platform = link && link.dataset ? link.dataset.sharePlatform : '';
      if (!link || !platform) return;

      if (!isPublic || !shareUrl) {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.tabIndex = -1;
        link.classList.add('is-disabled');
        return;
      }

      const platformUrl = buildSocialShareUrl(platform, shareUrl, treeName);
      if (platformUrl) {
        link.href = platformUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      link.removeAttribute('aria-disabled');
      link.tabIndex = 0;
      link.classList.remove('is-disabled');
    });
  }

  async function copyShareLink(shareUrl, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const safeShareUrl = typeof shareUrl === 'string' ? shareUrl : '';
    if (!safeShareUrl) {
      notifyShare(opts.unavailableMessage || 'Share link is not available.', 'warning');
      return false;
    }

    const copied = await copyToClipboard(safeShareUrl);
    if (copied) {
      notifyShare(opts.successMessage || 'Share link copied.', 'success');
      return true;
    }

    notifyShare(opts.failureMessage || 'Unable to copy link. Please copy it manually.', 'warning');
    return false;
  }

  global.AncestrioShareUtils = {
    buildTreeShareUrl,
    buildSocialShareUrl,
    setSocialShareLinks,
    copyToClipboard,
    copyShareLink,
    notifyShare
  };
})(window);
