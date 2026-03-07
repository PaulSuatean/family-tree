/*
  Tree data loading helpers extracted from main.js.
  This module keeps data-fetch concerns separate from rendering concerns.
*/

(function () {
  function loadDataSequential(paths) {
    return new Promise((resolve, reject) => {
      const tryAt = (i) => {
        if (i >= paths.length) {
          const err = new Error('No data file found at any path: ' + paths.join(', '));
          console.error(err.message);
          return reject(err);
        }
        const url = paths[i];
        fetch(url)
          .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' at ' + paths[i]);
            return r.json();
          })
          .then((data) => {
            resolve(data);
          })
          .catch((err) => {
            console.warn(`Failed to load from ${url}:`, err.message);
            tryAt(i + 1);
          });
      };
      tryAt(0);
    });
  }

  async function loadTreeData() {
    if (typeof window !== 'undefined' && window.FIREBASE_TREE_READY) {
      try {
        await window.FIREBASE_TREE_READY;
      } catch (err) {
        console.warn('Firebase tree data loading failed:', err);
      }
    }

    if (typeof window !== 'undefined' && window.FIREBASE_TREE_DATA) {
      return Promise.resolve(window.FIREBASE_TREE_DATA);
    }

    if (
      typeof window !== 'undefined' &&
      ['missing', 'private', 'error'].includes(window.FIREBASE_TREE_LOAD_MODE)
    ) {
      throw new Error(window.FIREBASE_TREE_LOAD_ERROR || 'Family tree data is unavailable.');
    }

    return loadDataSequential(['../data/rfamily.json', '/data/rfamily.json']);
  }

  window.AncestrioDataLoader = window.AncestrioDataLoader || {};
  window.AncestrioDataLoader.loadDataSequential = loadDataSequential;
  window.AncestrioDataLoader.loadTreeData = loadTreeData;
})();
