'use client'

/**
 * Staff authentication – Firebase Email/Password sign-in.
 *
 * Staff sign in with their staff ID and password (e.g. `juan`); the app
 * signs in to Firebase as `juan@mm.local`. Accounts (and password resets)
 * are created by the owner in Firebase console → Authentication → Users.
 *
 * This module owns the Firebase app initialisation so the login screen can
 * run before any Firestore sync starts, and it exposes the signed-in staff
 * member so every synced write can be stamped with who made it.
 */

export type StaffUser = { uid: string; email: string; name: string }

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDdPMrA_Xn6jXKN2uJHqYoQM0HXyr-zi1s',
  authDomain: 'mm-namibia.firebaseapp.com',
  projectId: 'mm-namibia',
  storageBucket: 'mm-namibia.firebasestorage.app',
  messagingSenderId: '261575975549',
  appId: '1:261575975549:web:f49becc5aed725366c0714',
}

/** Staff IDs map to `<id>@mm.local` accounts unless a full email is typed. */
const STAFF_DOMAIN = '@mm.local'

let cached: StaffUser | null = null
let observing = false
const observers = new Set<(u: StaffUser | null) => void>()

/** Initialise (or reuse) the Firebase app – safe to call many times. */
export async function ensureApp() {
  const { initializeApp, getApps } = await import('firebase/app')
  return getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
}

function toStaff(u: { uid: string; email: string | null; displayName: string | null }): StaffUser {
  const email = u.email ?? ''
  return { uid: u.uid, email, name: u.displayName || email.split('@')[0] || 'staff' }
}

/** Subscribe to signed-in staff changes; returns an unsubscribe function. */
export function observeAuth(cb: (u: StaffUser | null) => void): () => void {
  observers.add(cb)
  // deliver a known session immediately; otherwise wait for Firebase's
  // initial onAuthStateChanged event (avoids a login-screen flash on reload)
  if (cached) cb(cached)
  if (!observing && typeof window !== 'undefined') {
    observing = true
    void (async () => {
      const { getAuth, onAuthStateChanged } = await import('firebase/auth')
      onAuthStateChanged(getAuth(await ensureApp()), (u) => {
        cached = u ? toStaff(u) : null
        for (const fn of observers) {
          try { fn(cached) } catch { /* observer errors must not break auth */ }
        }
      })
    })()
  }
  return () => { observers.delete(cb) }
}

/** Current staff member (null when signed out) – used to stamp synced writes. */
export function currentStaff(): StaffUser | null {
  return cached
}

/** Sign in with a staff ID (or full email) and password. */
export async function signInStaff(staffId: string, password: string): Promise<StaffUser> {
  const id = staffId.trim().toLowerCase()
  if (!id || !password) throw new Error('Enter the staff ID and password')
  const email = id.includes('@') ? id : `${id}${STAFF_DOMAIN}`
  try {
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
    const cred = await signInWithEmailAndPassword(getAuth(await ensureApp()), email, password)
    return toStaff(cred.user)
  } catch (e) {
    throw new Error(friendlyAuthError(e))
  }
}

export async function signOutStaff(): Promise<void> {
  const { getAuth, signOut } = await import('firebase/auth')
  await signOut(getAuth(await ensureApp()))
}

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const msgs: Record<string, string> = {
    'auth/invalid-credential': 'Wrong staff ID or password',
    'auth/invalid-login-credentials': 'Wrong staff ID or password',
    'auth/wrong-password': 'Wrong staff ID or password',
    'auth/user-not-found': 'No account for that staff ID – ask the owner to create one',
    'auth/invalid-email': 'That staff ID does not look right',
    'auth/operation-not-allowed': 'Sign-in is not enabled yet – enable Email/Password in Firebase console → Authentication',
    'auth/network-request-failed': 'No connection – signing in needs internet the first time on a device',
    'auth/too-many-requests': 'Too many attempts – wait a minute and try again',
  }
  return msgs[code] ?? 'Sign-in failed – check the staff ID and password'
}
