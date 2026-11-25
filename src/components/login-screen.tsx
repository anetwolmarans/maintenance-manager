'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { signInStaff } from '@/lib/auth'

/** Full-screen splash while a saved session is restored. */
export function AuthSplash() {
  // if restoring hangs (e.g. first run with no internet), tell the user instead
  // of spinning forever – that screen looks like "the app is not opening"
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#0c231d] via-[#0a1d18] to-[#071410]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-950/50 ring-1 ring-inset ring-white/25">
        <Building2 className="h-7 w-7 text-white" />
      </div>
      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
      <p className="text-xs text-slate-400">Restoring session…</p>
      {slow && (
        <p className="max-w-xs text-center text-xs text-amber-300/90">
          This is taking longer than usual. Connect to the internet once (the first sign-in on a device needs it) and restart the app if this screen does not clear.
        </p>
      )}
    </div>
  )
}

/** Staff sign-in gate – the app is only usable with a valid staff account. */
export function LoginScreen() {
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // observeAuth flips the whole app to signed-in on success
      await signInStaff(staffId, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0c231d] via-[#0a1d18] to-[#071410] px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-950/50 ring-1 ring-inset ring-white/25">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-bold text-white">Maintenance Manager</p>
            <p className="text-xs text-slate-400">Prefab &amp; container maintenance · Windhoek, Namibia</p>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Staff sign in</CardTitle>
            <CardDescription>Use the staff ID and password you were given.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3">
              <div>
                <Label htmlFor="staffid">Staff ID</Label>
                <Input
                  id="staffid"
                  autoFocus
                  autoComplete="username"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="e.g. juan"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LogIn className="h-4 w-4 mr-1" />}
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-xs text-muted-foreground">
                No account yet? Ask the owner to add you in Firebase console → Authentication → Users.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
