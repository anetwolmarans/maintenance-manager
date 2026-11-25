'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Top-level safety net: if anything in the app throws while rendering, the
 * user still gets a readable screen (with the error text) instead of a blank
 * white screen that looks like "the app is not opening".
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render crash:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#0c231d] via-[#0a1d18] to-[#071410] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-400/30">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-white">The app hit an unexpected error</p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">Your saved data is safe on this device. Restarting the app usually fixes it.</p>
        </div>
        <pre className="max-w-md overflow-x-auto rounded-lg bg-black/30 p-3 text-left text-[11px] text-red-200 whitespace-pre-wrap">{this.state.error.message}</pre>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload() }}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          <RotateCw className="h-4 w-4" /> Restart app
        </button>
      </div>
    )
  }
}
