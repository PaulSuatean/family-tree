(function () {
  const MOBILE_BREAKPOINT = 1120;
  const HEADER_AUTH_CACHE_KEY = 'ancestrio:header-auth-state:v1';
  const AUTH_PAGE_PATTERN = /(?:^|\/)auth\.html(?:[?#]|$)/i;
  const DASHBOARD_PAGE_PATTERN = /(?:^|\/)dashboard\.html(?:[?#]|$)/i;

  function writeCachedAuthState(user) {
    try {
      const payload = user && !user.isAnonymous ? {
        authenticated: true,
        isAnonymous: false,
        displayName: typeof user.displayName === 'string' ? user.displayName : '',
        email: typeof user.email === 'string' ? user.email : '',
        updatedAt: Date.now()
      } : {
        authenticated: false,
        isAnonymous: Boolean(user && user.isAnonymous),
        displayName: '',
        email: '',
        updatedAt: Date.now()
      };
      localStorage.setItem(HEADER_AUTH_CACHE_KEY, JSON.stringify(payload));
      return payload;
    } catch (_) {
      return {
        authenticated: Boolean(user && !user.isAnonymous),
        isAnonymous: Boolean(user && user.isAnonymous),
        displayName: typeof user?.displayName === 'string' ? user.displayName : '',
        email: typeof user?.email === 'string' ? user.email : ''
      };
    }
  }

  function resolveHeaderLinks(header) {
    const actions = header.querySelector('.site-header__actions');
    if (!actions) return {};

    const actionLinks = Array.from(actions.querySelectorAll('a[href]'));
    const signInLink = actionLinks.find((link) => AUTH_PAGE_PATTERN.test(link.getAttribute('href') || ''));
    const dashboardLink = actionLinks.find((link) => DASHBOARD_PAGE_PATTERN.test(link.getAttribute('href') || ''));

    return { actions, signInLink, dashboardLink };
  }

  function setHeaderLinkVisibility(link, visible) {
    if (!link) return;
    link.hidden = !visible;
    link.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) {
      link.removeAttribute('tabindex');
    } else {
      link.setAttribute('tabindex', '-1');
    }
  }

  function applyAuthStateToHeader(header, authState) {
    if (!header) return;

    const { signInLink, dashboardLink } = resolveHeaderLinks(header);
    const isAuthenticated = Boolean(authState && authState.authenticated && !authState.isAnonymous);

    header.classList.toggle('site-header--authenticated', isAuthenticated);
    setHeaderLinkVisibility(signInLink, !isAuthenticated);
    setHeaderLinkVisibility(dashboardLink, isAuthenticated);

    if (dashboardLink) {
      const identity = authState?.displayName || authState?.email || '';
      if (isAuthenticated && identity) {
        dashboardLink.setAttribute('title', `Dashboard for ${identity}`);
        dashboardLink.setAttribute('aria-label', `Dashboard for ${identity}`);
      } else {
        dashboardLink.removeAttribute('title');
        dashboardLink.setAttribute('aria-label', 'Dashboard');
      }
    }
  }

  function bindHeaderAuthState(header) {
    if (!header) return;

    const guestModeEnabled = (() => {
      try {
        return localStorage.getItem('guestMode') === 'true';
      } catch (_) {
        return false;
      }
    })();

    if (guestModeEnabled) {
      applyAuthStateToHeader(header, { authenticated: false, isAnonymous: true });
      return;
    }

    // Default to signed-out UI until Firebase confirms a real authenticated user.
    applyAuthStateToHeader(header, { authenticated: false, isAnonymous: false });

    let unsubscribe = null;
    let subscribed = false;

    function subscribeWithAuth(authInstance) {
      if (!authInstance || typeof authInstance.onAuthStateChanged !== 'function' || subscribed) return;
      subscribed = true;
      unsubscribe = authInstance.onAuthStateChanged((user) => {
        const nextState = writeCachedAuthState(user || null);
        applyAuthStateToHeader(header, nextState);
      });
    }

    if (window.auth) {
      subscribeWithAuth(window.auth);
    } else if (window.firebase?.auth && typeof window.firebase.auth === 'function') {
      try {
        subscribeWithAuth(window.firebase.auth());
      } catch (_) {
        // Ignore Firebase access failures and wait for readiness event.
      }
    }

    const handleFirebaseReady = (event) => {
      subscribeWithAuth(event?.detail?.auth || window.auth);
    };

    document.addEventListener('ancestrio:firebase-ready', handleFirebaseReady);

    window.addEventListener('beforeunload', () => {
      document.removeEventListener('ancestrio:firebase-ready', handleFirebaseReady);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }, { once: true });
  }

  function initSiteHeader(header) {
    if (!header) return;

    const menuBtn = header.querySelector('.site-menu-btn');
    const nav = header.querySelector('.site-header__nav');

    function setMenuOpen(isOpen) {
      header.classList.toggle('menu-open', isOpen);
      if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const icon = menuBtn.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = isOpen ? 'close' : 'menu';
        }
      }
    }

    menuBtn?.addEventListener('click', () => {
      setMenuOpen(!header.classList.contains('menu-open'));
    });

    nav?.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuOpen(false));
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        setMenuOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('menu-open')) {
        setMenuOpen(false);
      }
    });
  }

  function setFooterYears() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-site-footer-year]').forEach((node) => {
      node.textContent = year;
    });
  }

  function init() {
    document.querySelectorAll('.site-header').forEach((header) => {
      initSiteHeader(header);
      bindHeaderAuthState(header);
    });
    setFooterYears();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
