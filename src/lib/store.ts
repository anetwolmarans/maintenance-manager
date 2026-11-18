'use client'

/**
 * Client-side data store.
 *
 * Replaces the old server API + SQLite: all collections live in memory,
 * are persisted to IndexedDB (instant, works offline), and are mirrored to
 * Firestore for real-time sync between the web app on GitHub Pages and the
 * Android APK (after staff sign-in – see src/lib/auth.ts).
 *
 * Documents keep the same JSON shapes the old API returned (dates as ISO
 * strings), so the views need no changes.
 */

export type Doc = { id: string } & Record<string, unknown>

export const COLLECTIONS = [
  'settings',
  'suppliers',
  'stockItems',
  'bomItems',
  'airconModels',
  'units',
  'unitEquipment',
  'maintenanceTypes',
  'maintenanceSchedules',
  'maintenanceRecords',
  'inspectionTemplates',
  'inspections',
  'unitHistories',
  'fleetVehicles',
  'fleetRecords',
  'emailLogs',
] as const

export type Collection = (typeof COLLECTIONS)[number]

const data = COLLECTIONS.reduce((acc, c) => {
  acc[c] = new Map<string, Doc>()
  return acc
}, {} as Record<Collection, Map<string, Doc>>)

const listeners = new Set<(col: Collection) => void>()

let readyPromise: Promise<void> | null = null
let initialized = false

/** Generate an id (UUID where available, compact fallback otherwise). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Firestore (and IndexedDB) refuse `undefined` – convert to null recursively. */
function sanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map((x) => sanitize(x)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = v === undefined ? null : sanitize(v)
    }
    return out as T
  }
  return value
}

function notify(col: Collection) {
  for (const fn of listeners) {
    try { fn(col) } catch { /* listener errors must not break writes */ }
  }
}

export function subscribe(fn: (col: Collection) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---------- IndexedDB (offline persistence) ----------

const DB_NAME = 'mm-store'
const STORE = 'collections'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAll(): Promise<Partial<Record<Collection, Doc[]>>> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    const keys = tx.objectStore(STORE).getAllKeys()
    req.onerror = keys.onerror = () => reject(req.error)
    req.onsuccess = () => {
      keys.onsuccess = () => {
        const out: Partial<Record<Collection, Doc[]>> = {};
        (keys.result as string[]).forEach((k, i) => {
          if (COLLECTIONS.includes(k as Collection)) out[k as Collection] = req.result[i] as Doc[]
        })
        resolve(out)
      }
    }
  })
}

async function idbPut(col: Collection, docs: Doc[]) {
  const db = await idb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(docs, col)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------- public read/write API ----------

export function list(col: Collection): Doc[] {
  return [...data[col].values()]
}

export function get(col: Collection, id: string): Doc | null {
  return data[col].get(id) ?? null
}

export function size(col: Collection): number {
  return data[col].size
}

/** Insert or update one document (memory + IndexedDB + Firestore). */
export async function upsert(col: Collection, doc: Doc): Promise<Doc> {
  const clean = sanitize(doc)
  data[col].set(clean.id, clean)
  await idbPut(col, list(col)).catch(() => {})
  fsSet(col, clean)
  notify(col)
  return clean
}

/** Replace the whole contents of a collection (used by import & sample data). */
export async function bulkReplace(col: Collection, docs: Doc[]): Promise<void> {
  data[col].clear()
  for (const d of docs) {
    const clean = sanitize(d)
    data[col].set(clean.id, clean)
  }
  await idbPut(col, list(col)).catch(() => {})
  fsReplace(col, list(col))
  notify(col)
}

export async function remove(col: Collection, id: string): Promise<void> {
  data[col].delete(id)
  await idbPut(col, list(col)).catch(() => {})
  fsDelete(col, id)
  notify(col)
}

/** Empty every collection (sample data / import start from a clean slate). */
export async function wipeAll(): Promise<void> {
  for (const col of COLLECTIONS) await bulkReplace(col, [])
}

export function exportAll(): { version: number; exportedAt: string; collections: Record<Collection, Doc[]> } {
  const collections = {} as Record<Collection, Doc[]>
  for (const col of COLLECTIONS) collections[col] = list(col)
  return { version: 1, exportedAt: new Date().toISOString(), collections }
}

export async function importAll(snapshot: { collections?: Partial<Record<Collection, Doc[]>> }): Promise<void> {
  for (const col of COLLECTIONS) {
    const docs = snapshot.collections?.[col]
    if (Array.isArray(docs)) await bulkReplace(col, docs)
  }
}

export function snapshotCounts(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const col of COLLECTIONS) out[col] = data[col].size
  return out
}

// ---------- init ----------

/** Load from IndexedDB, then attach Firestore listeners when a config exists. */
export function storeReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (initialized) return
      initialized = true
      if (typeof indexedDB !== 'undefined') {
        const stored = await idbGetAll().catch(() => ({}))
        for (const col of COLLECTIONS) {
          for (const d of stored[col] ?? []) data[col].set(d.id, d)
        }
      }
      // Firestore sync (no-op when unconfigured)
      const { initSync } = await import('@/lib/firebase')
      initSync((col, docs) => {
        data[col].clear()
        for (const d of docs) data[col].set(d.id, d)
        idbPut(col, docs).catch(() => {})
        notify(col)
      })
    })()
  }
  return readyPromise
}

// ---------- Firestore bridge (lazy imports keep the local bundle light) ----------

function fsSet(col: Collection, doc: Doc) {
  void (async () => {
    const { fsSet: set } = await import('@/lib/firebase')
    set(col, doc)
  })().catch(() => {})
}

function fsDelete(col: Collection, id: string) {
  void (async () => {
    const { fsDelete: del } = await import('@/lib/firebase')
    del(col, id)
  })().catch(() => {})
}

function fsReplace(col: Collection, docs: Doc[]) {
  void (async () => {
    const { fsReplace: rep } = await import('@/lib/firebase')
    rep(col, docs)
  })().catch(() => {})
}
