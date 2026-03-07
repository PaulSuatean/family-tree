window.FIREBASE_TREE_DATA = null;
window.FIREBASE_TREE_NAME = null;
window.FIREBASE_TREE_SETTINGS = null;
window.FIREBASE_TREE_ID = null;
window.FIREBASE_TREE_PRIVACY = null;
window.FIREBASE_TREE_OWNER_ID = null;
window.FIREBASE_CURRENT_USER_ID = null;
window.FIREBASE_TREE_LOAD_MODE = 'idle';
window.FIREBASE_TREE_LOAD_ERROR = '';
window.IS_LOCAL_PREVIEW = false;
const DEFAULT_TREE_VIEW_BACKGROUND = 'theme-default';
const DEFAULT_TREE_VIEW_BUBBLE = 'bubble-classic';
const TREE_VIEW_BACKGROUND_IDS = new Set([
  'theme-default',
  'parchment-classic',
  'parchment-vintage',
  'parchment-minimal',
  'parchment-photo'
]);
const TREE_VIEW_BUBBLE_IDS = new Set([
  'bubble-classic',
  'bubble-heraldic',
  'bubble-ink',
  'bubble-soft'
]);

function parseTreeFeatureFlag(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }
  return fallback;
}

function sanitizeTreeViewStyleValue(value, fallback, allowedValues) {
  const normalized = String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return allowedValues.has(normalized) ? normalized : fallback;
}

function resolveTreeViewerSettings(source) {
  const calendarFlag = (source && Object.prototype.hasOwnProperty.call(source, 'enableCalendarDates'))
    ? source.enableCalendarDates
    : source?.enableBirthdays;
  const nested = (source && source.viewStyle && typeof source.viewStyle === 'object')
    ? source.viewStyle
    : null;

  return {
    enableCalendarDates: parseTreeFeatureFlag(calendarFlag, true),
    enableGlobeCountries: parseTreeFeatureFlag(source?.enableGlobeCountries, true),
    viewBackground: sanitizeTreeViewStyleValue(
      source?.viewBackground ?? source?.background ?? nested?.background,
      DEFAULT_TREE_VIEW_BACKGROUND,
      TREE_VIEW_BACKGROUND_IDS
    ),
    viewBubble: sanitizeTreeViewStyleValue(
      source?.viewBubble ?? source?.bubble ?? nested?.bubble,
      DEFAULT_TREE_VIEW_BUBBLE,
      TREE_VIEW_BUBBLE_IDS
    )
  };
}

function setTreeName(value) {
  const treeNameEl = document.getElementById('treeName');
  if (treeNameEl) {
    treeNameEl.textContent = value;
  }
}

function setTreeLoadFailure(mode, title, message) {
  window.FIREBASE_TREE_DATA = null;
  window.FIREBASE_TREE_LOAD_MODE = mode;
  window.FIREBASE_TREE_LOAD_ERROR = message;
  setTreeName(title);
}

window.FIREBASE_TREE_READY = (async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const treeId = urlParams.get('id');
  const previewKey = urlParams.get('previewKey');
  const maxPreviewAgeMs = 6 * 60 * 60 * 1000;

  window.FIREBASE_TREE_ID = treeId || '';

  if (previewKey) {
    try {
      const rawPreview = localStorage.getItem(previewKey);
      if (rawPreview) {
        const preview = JSON.parse(rawPreview);
        const previewData = preview && typeof preview === 'object' ? preview.data : null;
        const previewName = preview && typeof preview.name === 'string' ? preview.name : 'Family Tree Preview';
        const createdAt = Number(preview && preview.createdAt);
        const isFresh = Number.isFinite(createdAt) && (Date.now() - createdAt) <= maxPreviewAgeMs;

        if (previewData && isFresh) {
          window.FIREBASE_TREE_DATA = previewData;
          window.FIREBASE_TREE_NAME = previewName;
          window.FIREBASE_TREE_SETTINGS = resolveTreeViewerSettings(preview);
          window.FIREBASE_TREE_PRIVACY = typeof preview.privacy === 'string' ? preview.privacy : 'private';
          window.FIREBASE_TREE_OWNER_ID = '';
          window.FIREBASE_CURRENT_USER_ID = '';
          window.FIREBASE_TREE_LOAD_MODE = 'preview';
          window.FIREBASE_TREE_LOAD_ERROR = '';
          window.IS_LOCAL_PREVIEW = true;
          setTreeName(previewName);
          return;
        }
      }
    } catch (previewError) {
      console.warn('Failed to load local preview draft:', previewError);
    }
  }

  // If no tree ID, use default name and let main.js load from rfamily.json
  if (!treeId) {
    window.FIREBASE_TREE_LOAD_MODE = 'local-default';
    window.FIREBASE_TREE_LOAD_ERROR = '';
    setTreeName('Family Tree');
    window.FIREBASE_TREE_PRIVACY = 'private';
    window.FIREBASE_TREE_OWNER_ID = '';
    window.FIREBASE_CURRENT_USER_ID = '';
    return;
  }

  try {
    window.FIREBASE_TREE_LOAD_MODE = 'loading';
    window.FIREBASE_TREE_LOAD_ERROR = '';

    // Initialize Firebase only for non-local previews.
    if (typeof initializeFirebase === 'function') {
      initializeFirebase();
    }

    const waitForAuthState = () => new Promise((resolve) => {
      if (!firebase.auth) {
        resolve(null);
        return;
      }

      const authInstance = firebase.auth();
      let settled = false;
      let unsubscribe = null;

      const finish = (user) => {
        if (settled) return;
        settled = true;
        if (unsubscribe) unsubscribe();
        clearTimeout(timeoutId);
        resolve(user || null);
      };

      const timeoutId = setTimeout(() => {
        finish(authInstance.currentUser);
      }, 3000);

      unsubscribe = authInstance.onAuthStateChanged(
        (user) => finish(user),
        () => finish(authInstance.currentUser)
      );
    });

    const currentUser = await waitForAuthState();
    window.FIREBASE_CURRENT_USER_ID = currentUser?.uid || '';
    const docRef = firebase.firestore().collection('trees').doc(treeId);
    let doc = null;

    try {
      doc = await docRef.get({ source: 'server' });
    } catch (serverError) {
      console.warn('Server fetch failed, trying default source:', serverError);
      doc = await docRef.get();
    }

    if (!doc.exists) {
      setTreeLoadFailure('missing', 'Tree not found', 'This family tree could not be found.');
      console.warn('Tree not found:', treeId);
      return;
    }

    const tree = doc.data();
    window.FIREBASE_TREE_PRIVACY = tree.privacy || 'private';
    window.FIREBASE_TREE_OWNER_ID = tree.userId || '';

    if (tree.privacy === 'private' && (!currentUser || currentUser.uid !== tree.userId)) {
      setTreeLoadFailure('private', 'Private tree', 'This family tree is private.');
      console.warn('Tree is private');
      return;
    }

    window.FIREBASE_TREE_DATA = tree.data;
    window.FIREBASE_TREE_NAME = tree.name;
    window.FIREBASE_TREE_SETTINGS = resolveTreeViewerSettings(tree);
    window.FIREBASE_TREE_LOAD_MODE = 'remote';
    window.FIREBASE_TREE_LOAD_ERROR = '';
    setTreeName(tree.name);
  } catch (error) {
    console.error('Error loading tree:', error);
    setTreeLoadFailure('error', 'Error loading tree', 'Unable to load this family tree right now.');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('backBtn')?.addEventListener('click', (event) => {
    event.preventDefault();

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    // Fallback when there is no browser history entry.
    if (window.IS_LOCAL_PREVIEW) {
      const urlParams = new URLSearchParams(window.location.search);
      const fallbackTreeId = urlParams.get('id');
      window.location.href = fallbackTreeId ? `editor.html?id=${encodeURIComponent(fallbackTreeId)}` : 'editor.html';
      return;
    }

    // Directly opened public links should fall back to the public site, not auth.
    const hasFirebaseApp = typeof firebase !== 'undefined' && Array.isArray(firebase.apps) && firebase.apps.length > 0;
    const loggedIn = hasFirebaseApp && firebase.auth().currentUser;
    window.location.href = loggedIn ? 'dashboard.html' : '../index.html';
  });
});
