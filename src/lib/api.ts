'use client'

export async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`GET ${url} failed (${r.status})`)
  return r.json()
}

export async function apiSend<T = unknown>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = `Request failed (${r.status})`
    try { const j = await r.json(); if (j.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  return r.json()
}

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (24 * 3600 * 1000))
}

export function dueStatus(d: string | Date | null | undefined): 'OVERDUE' | 'DUE SOON' | 'OK' | 'NOT SET' {
  const x = daysUntil(d)
  if (x == null) return 'NOT SET'
  if (x < 0) return 'OVERDUE'
  if (x <= 30) return 'DUE SOON'
  return 'OK'
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dateInput(d: string | Date | null | undefined): string {
  if (!d) return ''
  const x = new Date(d)
  const off = x.getTimezoneOffset()
  return new Date(x.getTime() - off * 60 * 1000).toISOString().slice(0, 10)
}
