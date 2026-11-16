'use client'

/**
 * Firebase Firestore sync bridge.
 *
 * Config resolution order:
 *   1. localStorage key `mm_fb_config` (JSON pasted in Settings → Sync) –
 *      lets the GitHub Pages build enable sync without rebuilding.
 *   2. NEXT_PUBLIC_FIREBASE_* environment variables set at build time
 *      (GitHub Actions / APK build secrets).
 *
 * When no config is found the app runs in local-only mode (IndexedDB),
 * which works fully offline with zero setup.
 */

import type { Collection, Doc } from '@/lib/store'
import type { DocumentData } from 'firebase/firestore'

export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

const LS_KEY = 'mm_fb_config'

function readEnvConfig(): FirebaseConfig | null {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null
  return cfg as FirebaseConfig
}

export function readStoredConfig(): FirebaseConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw)
    if (cfg?.apiKey && cfg?.projectId && cfg?.appId) return cfg as FirebaseConfig
  } catch { /* ignore malformed config */ }
  return null
}

export function getConfig(): FirebaseConfig | null {
  return readStoredConfig() ?? readEnvConfig()
}

export function saveConfig(cfg: FirebaseConfig | null) {
  if (typeof window === 'undefined') return
  if (cfg) window.localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  else window.localStorage.removeItem(LS_KEY)
}

export function syncMode(): 'local' | 'firebase' {
  return getConfig() ? 'firebase' : 'local'
}

export function projectId(): string {
  return getConfig()?.projectId ?? ''
}

type Handler = (col: Collection, docs: Doc[]) => void
type FirestoreBundle = {
  fsSet: (col: Collection, doc: Doc) => void
  fsDelete: (col: Collection, id: string) => void
  fsReplace: (col: Collection, docs: Doc[]) => void
}

let bundle: FirestoreBundle | null = null

// Writes queued while Firestore is still initialising (fire-and-forget).
const pendingOps: Array<() => void> = []

/** Called by the store on every upsert – mirrors the write to Firestore. */
export function fsSet(col: Collection, doc: Doc) {
  if (bundle) bundle.fsSet(col, doc)
  else pendingOps.push(() => bundle!.fsSet(col, doc))
}

/** Called by the store on every delete – mirrors the delete to Firestore. */
export function fsDelete(col: Collection, id: string) {
  if (bundle) bundle.fsDelete(col, id)
  else pendingOps.push(() => bundle!.fsDelete(col, id))
}

/** Replace a whole collection in Firestore (import / sample data). */
export function fsReplace(col: Collection, docs: Doc[]) {
  if (bundle) bundle.fsReplace(col, docs)
  else pendingOps.push(() => bundle!.fsReplace(col, docs))
}

/** Attach realtime listeners; returns false when running without Firebase. */
export function initSync(onData: Handler): boolean {
  if (bundle) return true
  const cfg = getConfig()
  if (!cfg || typeof window === 'undefined') return false

  void (async () => {
    const { initializeApp, getApps } = await import('firebase/app')
    const fs = await import('firebase/firestore')
    const app = getApps().length ? getApps()[0] : initializeApp(cfg)
    // Offline persistence + multi-tab support: Firestore queues writes while
    // offline and syncs when connectivity returns (yard Wi-Fi, tablet, APK).
    const db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    })

    const writeDoc = async (col: Collection, doc: Doc) => {
      try {
        await fs.setDoc(fs.doc(db, col, doc.id), doc as unknown as DocumentData, { merge: true })
      } catch (e) {
        console.error(`[sync] write ${col}/${doc.id} failed`, e)
      }
    }

    bundle = {
      fsSet: (col, doc) => { void writeDoc(col, doc) },
      fsDelete: (col, id) => { void fs.deleteDoc(fs.doc(db, col, id)).catch((e) => console.error(`[sync] delete ${col}/${id} failed`, e)) },
      fsReplace: (col, docs) => {
        void (async () => {
          const batch = fs.writeBatch(db)
          for (const d of docs) batch.set(fs.doc(db, col, d.id), d as unknown as DocumentData, { merge: true })
          await batch.commit().catch((e) => console.error(`[sync] replace ${col} failed`, e))
        })()
      },
    }
    // replay writes that happened while Firestore was still initialising
    while (pendingOps.length) pendingOps.shift()!()

    for (const col of (await import('@/lib/store')).COLLECTIONS) {
      fs.onSnapshot(
        fs.collection(db, col),
        (snap) => {
          const docs: Doc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
          onData(col, docs)
        },
        (err) => console.error(`[sync] listener ${col} failed`, err),
      )
    }
    console.info(`[sync] Firebase connected – project "${cfg.projectId}"`)
  })()

  return true
}
