'use client'

/**
 * Firebase Firestore sync bridge.
 *
 * The Firebase app + web-app config live in `src/lib/auth.ts` (staff sign-in
 * must run before sync starts, so auth owns app initialisation). Firestore
 * listeners attach here after login; every write is stamped with the
 * signed-in staff member (_uid / _by) for accountability.
 */

import type { Collection, Doc } from '@/lib/store'
import type { DocumentData } from 'firebase/firestore'
import { ensureApp, currentStaff, FIREBASE_CONFIG } from '@/lib/auth'

export function getConfig() {
  return FIREBASE_CONFIG
}

export function syncMode(): 'local' | 'firebase' {
  return 'firebase'
}

export function projectId(): string {
  return FIREBASE_CONFIG.projectId
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
  if (typeof window === 'undefined') return false

  const start = async () => {
    const fs = await import('firebase/firestore')
    // the app + staff session are guaranteed by the login gate before this runs
    const app = await ensureApp()
    // Offline persistence + multi-tab support: Firestore queues writes while
    // offline and syncs when connectivity returns (yard Wi-Fi, tablet, APK).
    // Some Android WebViews / private-mode browsers refuse IndexedDB – fall
    // back to the in-memory cache so the app still opens (writes just don't
    // queue while offline on those devices).
    let db: import('firebase/firestore').Firestore
    try {
      db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      })
    } catch (e) {
      console.error('[sync] persistent cache unavailable – using memory cache', e)
      db = fs.getFirestore(app)
    }

    const writeDoc = async (col: Collection, doc: Doc) => {
      try {
        const s = currentStaff()
        await fs.setDoc(
          fs.doc(db, col, doc.id),
          { ...doc, _uid: s?.uid ?? null, _by: s?.email ?? null } as unknown as DocumentData,
          { merge: true },
        )
      } catch (e) {
        console.error(`[sync] write ${col}/${doc.id} failed`, e)
      }
    }

    bundle = {
      fsSet: (col, doc) => { void writeDoc(col, doc) },
      fsDelete: (col, id) => { void fs.deleteDoc(fs.doc(db, col, id)).catch((e) => console.error(`[sync] delete ${col}/${id} failed`, e)) },
      fsReplace: (col, docs) => {
        void (async () => {
          const s = currentStaff()
          const batch = fs.writeBatch(db)
          for (const d of docs) {
            batch.set(fs.doc(db, col, d.id), { ...d, _uid: s?.uid ?? null, _by: s?.email ?? null } as unknown as DocumentData, { merge: true })
          }
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
    console.info(`[sync] Firebase connected – project "${FIREBASE_CONFIG.projectId}"`)
  }
  // sync must never take the app down with it – log and continue on-device
  void start().catch((e) => console.error('[sync] Firestore sync failed to start – app keeps working on-device only', e))

  return true
}
