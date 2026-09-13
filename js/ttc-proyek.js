/* ============================================================
   TTC — Penyimpanan Proyek Browser
   Menyimpan beberapa proyek di IndexedDB. Fallback ke localStorage
   bila IndexedDB tidak tersedia.
   ============================================================ */
(function (global) {
'use strict';

const DB_NAME = 'TTC-Project-Library';
const DB_VERSION = 1;
const STORE = 'projects';
const FALLBACK_KEY = 'ttc-project-library-fallback-v1';
let dbPromise = null;
let useFallback = false;

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function buatId() {
  if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
  return 'prj-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}
function hitung(data) {
  const p = data && data.prasarana ? data.prasarana : {};
  return {
    stasiun: Array.isArray(p.stasiun) ? p.stasiun.length : 0,
    petak: Array.isArray(p.petakJalan) ? p.petakJalan.length : 0,
    sarana: data && Array.isArray(data.sarana) ? data.sarana.length : 0,
    ka: data && data.jadwal && Array.isArray(data.jadwal.ka) ? data.jadwal.ka.length : 0
  };
}
function ringkas(record) {
  const c = hitung(record.data);
  return {
    id: record.id,
    nama: record.nama || (record.data && record.data.namaProyek) || 'Proyek TTC',
    dibuat: record.dibuat,
    diubah: record.diubah,
    stasiun: c.stasiun,
    petak: c.petak,
    sarana: c.sarana,
    ka: c.ka
  };
}

function bukaDb() {
  if (useFallback) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!('indexedDB' in global)) { useFallback = true; resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { useFallback = true; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { useFallback = true; resolve(null); };
  });
  return dbPromise;
}

function fallbackBaca() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    const x = raw ? JSON.parse(raw) : [];
    return Array.isArray(x) ? x : [];
  } catch (e) { return []; }
}
function fallbackTulis(list) {
  try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(list)); return true; }
  catch (e) { return false; }
}

async function semua() {
  const db = await bukaDb();
  let list;
  if (!db) list = fallbackBaca();
  else list = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return list.map(ringkas).sort((a, b) => String(b.diubah || '').localeCompare(String(a.diubah || '')));
}

async function ambil(id) {
  const db = await bukaDb();
  if (!db) {
    const r = fallbackBaca().find(x => x.id === id);
    return r ? clone(r.data) : null;
  }
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ? clone(req.result.data) : null);
    req.onerror = () => reject(req.error);
  });
}

async function simpan(id, data) {
  id = id || buatId();
  const sekarang = new Date().toISOString();
  const db = await bukaDb();
  let dibuat = data && data.dibuat ? data.dibuat : sekarang;
  if (!db) {
    const list = fallbackBaca();
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) dibuat = list[i].dibuat || dibuat;
    const rec = { id, nama: (data && data.namaProyek) || 'Proyek TTC', dibuat, diubah: sekarang, data: clone(data) };
    if (i >= 0) list[i] = rec; else list.push(rec);
    fallbackTulis(list);
    return id;
  }
  const lama = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
  if (lama && lama.dibuat) dibuat = lama.dibuat;
  const rec = { id, nama: (data && data.namaProyek) || 'Proyek TTC', dibuat, diubah: sekarang, data: clone(data) };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return id;
}

async function buat(data) { return simpan(null, data); }

async function hapus(id) {
  const db = await bukaDb();
  if (!db) {
    const list = fallbackBaca().filter(x => x.id !== id);
    fallbackTulis(list); return true;
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return true;
}

async function duplikat(id) {
  const data = await ambil(id);
  if (!data) return null;
  data.namaProyek = (data.namaProyek || 'Proyek TTC') + ' — Salinan';
  data.dibuat = new Date().toISOString();
  return buat(data);
}

async function migrasiLegacy(data) {
  const list = await semua();
  if (list.length) return null;
  return buat(data);
}

async function init() { await bukaDb(); return true; }

Object.assign(global, {
  TTCProjectStore: { init, semua, ambil, simpan, buat, hapus, duplikat, migrasiLegacy }
});
})(window);
