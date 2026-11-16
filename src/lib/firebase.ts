'use client'

/**
 * Firebase Firestore sync bridge.
 *
 * The web-app config is hardcoded below on purpose: every build (GitHub
 * Pages and APK) ships with sync enabled and no device needs any setup.
 * A Firebase web API key is a public identifier by design – it selects the
 * project but does not grant access; data is protected by the Firestore
 * security rules (`request.auth != null` via anonymous sign-in).
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

const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: 'AIzaSyB-sI9oyzvJZdqGPLaOryhK9qX5MrF18_4',
  authDomain: 'maintenance-manager-463fc.firebaseapp.com',
  projectId: 'maintenance-manager-463fc',
  storageBucket: 'maintenance-manager-463fc.firebasestorage.app',
  messagingSenderId: '691671070047',
  appId: '1:691671070047:web:b67031b54326798d2c32ea',
}

export function getConfig(): FirebaseConfig {
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
  const cfg = getConfig()

  void (async () => {
    const { initializeApp, getApps } = await import('firebase/app')
    const fs = await import('firebase/firestore')
    const app = getApps().length ? getApps()[0] : initializeApp(cfg)
    // Sign in anonymously so the locked-down Firestore rules
    // (`request.auth != null`) accept this device with no login screen.
    // Requires Anonymous to be enabled once in Firebase console →
    // Authentication → Sign-in method; until then sync stays offline.
    try {
      const { getAuth, signInAnonymously } = await import('firebase/auth')
      await signInAnonymously(getAuth(app))
    } catch (e) {
      console.error(
        '[sync] anonymous sign-in failed – enable it in Firebase console → Authentication → Sign-in method → Anonymous. Retrying on next reload.',
        e,
      )
    }
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
