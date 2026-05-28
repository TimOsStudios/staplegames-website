/**
 * TOS SDK Web — Storage wrapper.
 *
 * Direct port of TOSPersistence on iOS (NSUserDefaults). Falls back to an
 * in-memory Map when localStorage throws (private-browsing iOS Safari,
 * disk-full WebViews, etc.) so the rest of the SDK can keep running
 * without try/catches on every call site.
 *
 * Every key is automatically prefixed with `tos.` so SDK keys never
 * collide with the game's own `bc_*` keys.
 */

import { STORAGE_NS } from './TOSConstants.js';

const memStore = new Map();
let localStorageWorks = true;
let warnedOnce = false;

function _warn(msg) {
  if (warnedOnce) return;
  warnedOnce = true;
  try { console.warn('[TOSStorage]', msg); } catch (_) {}
}

function _key(k) { return STORAGE_NS + k; }

function _setRaw(k, v) {
  if (localStorageWorks) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (e) {
      localStorageWorks = false;
      _warn('localStorage unavailable, falling back to memory: ' + e);
    }
  }
  memStore.set(k, v);
  return true;
}
function _getRaw(k) {
  if (localStorageWorks) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    } catch (e) {
      localStorageWorks = false;
    }
  }
  return memStore.has(k) ? memStore.get(k) : null;
}
function _removeRaw(k) {
  if (localStorageWorks) {
    try { localStorage.removeItem(k); } catch (_) {}
  }
  memStore.delete(k);
}

export const TOSStorage = {
  /** @returns {string | null} */
  get(key) {
    return _getRaw(_key(key));
  },
  set(key, value) {
    return _setRaw(_key(key), String(value));
  },
  remove(key) {
    _removeRaw(_key(key));
  },
  /** Numeric getter with default. */
  getInt(key, def = 0) {
    const v = this.get(key);
    if (v === null) return def;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
  },
  getFloat(key, def = 0) {
    const v = this.get(key);
    if (v === null) return def;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
  },
  /** Increment a stored integer and persist. */
  incrementInt(key, by = 1) {
    const next = this.getInt(key, 0) + by;
    this.set(key, String(next));
    return next;
  },
  /** Float increment (used for cLTSeshTime accumulation). */
  incrementFloat(key, by) {
    const next = this.getFloat(key, 0) + by;
    this.set(key, String(next));
    return next;
  },
  /** Object getter: parses JSON, returns def on failure. */
  getObject(key, def = null) {
    const v = this.get(key);
    if (v === null) return def;
    try { return JSON.parse(v); } catch (_) { return def; }
  },
  setObject(key, value) {
    return this.set(key, JSON.stringify(value));
  },
  /** Bool getter — "1" / "0" canonical form. */
  getBool(key, def = false) {
    const v = this.get(key);
    if (v === null) return def;
    return v === '1' || v === 'true';
  },
  setBool(key, value) {
    return this.set(key, value ? '1' : '0');
  },
  /** Returns true if a key exists (vs default). Useful for first-launch detection. */
  has(key) {
    return this.get(key) !== null;
  },
  /** Diagnostic: are we on disk or in memory? */
  isPersistent() {
    return localStorageWorks;
  },
  /** Reset everything under the tos.* namespace. ONLY for "Delete My
   *  Data" legal flow. Other code should never call this. */
  resetAll() {
    if (localStorageWorks) {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(STORAGE_NS)) keysToRemove.push(k);
        }
        for (const k of keysToRemove) localStorage.removeItem(k);
      } catch (_) {}
    }
    for (const k of [...memStore.keys()]) {
      if (k.startsWith(STORAGE_NS)) memStore.delete(k);
    }
  },
};
