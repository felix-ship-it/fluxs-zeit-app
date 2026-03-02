/**
 * FLUXS Zeit App — IndexedDB Storage Layer
 * Persistent local storage for API keys, offline queue, and cache.
 * Max 500 lines.
 */

'use strict';

const DB_NAME = 'fluxs-zeit-app';
const DB_VERSION = 2;

// Store names
export const STORES = {
  CREDENTIALS: 'credentials',   // Personio API key
  OFFLINE_QUEUE: 'offlineQueue', // Pending clock in/out actions
  CACHE: 'cache',               // Employee data, absences
  SETTINGS: 'settings',         // User preferences
};

let _db = null;

// ─── Open Database ──────────────────────────────────────────────────────────

function _open() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      Object.values(STORES).forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      });
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => {
      console.error('[Storage] IndexedDB open failed:', e.target.error);
      reject(e.target.error);
    };
  });
}

// ─── Generic CRUD ───────────────────────────────────────────────────────────

export async function get(store, key) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function set(store, key, value) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function remove(store, key) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllKeys(store) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clear(store) {
  const db = await _open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Convenience: Credentials ───────────────────────────────────────────────

export async function getApiKey() {
  return get(STORES.CREDENTIALS, 'personio-api-key');
}

export async function setApiKey(clientId, clientSecret) {
  return set(STORES.CREDENTIALS, 'personio-api-key', { clientId, clientSecret });
}

export async function removeApiKey() {
  return remove(STORES.CREDENTIALS, 'personio-api-key');
}

// ─── Convenience: Offline Queue ─────────────────────────────────────────────

export async function addToOfflineQueue(action) {
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await set(STORES.OFFLINE_QUEUE, id, { ...action, id, createdAt: new Date().toISOString() });
  return id;
}

export async function getOfflineQueue() {
  const keys = await getAllKeys(STORES.OFFLINE_QUEUE);
  const items = [];
  for (const key of keys) {
    const item = await get(STORES.OFFLINE_QUEUE, key);
    if (item) items.push(item);
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromOfflineQueue(id) {
  return remove(STORES.OFFLINE_QUEUE, id);
}

export async function clearOfflineQueue() {
  return clear(STORES.OFFLINE_QUEUE);
}

// ─── Feature Detection ──────────────────────────────────────────────────────

export function isAvailable() {
  return typeof indexedDB !== 'undefined';
}
