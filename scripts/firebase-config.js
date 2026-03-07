// Firebase Configuration
// Replace these values with your actual Firebase project credentials
// Get these from Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration

const firebaseConfig = {
  apiKey: "AIzaSyDrWuTxMHuoGQvt9DWxelDl-3lDn0Sf20g",
  authDomain: "ancestrio.firebaseapp.com",
  projectId: "ancestrio",
  messagingSenderId: "1029073457660",
  appId: "1:1029073457660:web:6c2a2ad532e96ba4bee279"
};

// Initialize Firebase (will be used by other scripts)
let app, auth, db;

// Check if running locally
const LOCAL_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const isLocalhost = LOCAL_LOOPBACK_HOSTS.has(window.location.hostname);
const emulatorFlag = new URLSearchParams(window.location.search).get('emulator');
const useEmulator = isLocalhost && (emulatorFlag === '1' || emulatorFlag === 'true');
const isDevelopment = useEmulator;
const emulatorHost = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
const authEmulatorUrl = `http://${emulatorHost}:9099`;

window.AncestrioFirebase = window.AncestrioFirebase || {};
window.AncestrioFirebase.isDevelopment = isDevelopment;
window.AncestrioFirebase.authEmulatorUrl = authEmulatorUrl;
window.AncestrioFirebase.authEmulatorReachable = null;

function notifyUser(message, type = 'error', options = {}) {
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

function probeAuthEmulator(url) {
  if (typeof fetch !== 'function') return;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    if (controller) {
      controller.abort();
    }
  }, 2000);

  fetch(`${url}/`, {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    signal: controller ? controller.signal : undefined
  }).then(() => {
    window.AncestrioFirebase.authEmulatorReachable = true;
  }).catch((error) => {
    window.AncestrioFirebase.authEmulatorReachable = false;
    const detail = error && error.message ? error.message : String(error || 'unknown error');
    console.warn(`Auth emulator probe failed at ${url}: ${detail}`);
    notifyUser(
      `Auth emulator is not reachable at ${url}. Start it with "firebase emulators:start --only auth,firestore".`,
      'warning',
      { duration: 9000 }
    );
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

function initializeFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded - script tag missing or blocked');
    notifyUser('Firebase SDK failed to load. Please check your internet connection and disable ad blockers.');
    return false;
  }

  try {
    if (firebase.apps && firebase.apps.length) {
      app = firebase.app();
    } else {
      app = firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    // Connect to emulators if running locally
    if (isDevelopment) {
      // Disable SSL error bypass for emulator
      auth.settings.appVerificationDisabledForTesting = true;

      try {
        // Configure Auth Emulator endpoint.
        auth.useEmulator(authEmulatorUrl);
        probeAuthEmulator(authEmulatorUrl);
      } catch (e) {
        console.error('Auth emulator connection failed:', e.message);
      }

      try {
        // Configure Firestore Emulator endpoint.
        db.useEmulator(emulatorHost, 8080);
      } catch (e) {
        console.error('Firestore emulator connection failed:', e.message);
      }
    }
    try {
      document.dispatchEvent(new CustomEvent('ancestrio:firebase-ready', {
        detail: { auth, db, app }
      }));
    } catch (_) {
      // Ignore event dispatch failures in older browsers.
    }
    return true;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    notifyUser('Firebase initialization failed: ' + error.message, 'error', { duration: 7000 });
    return false;
  }
}
