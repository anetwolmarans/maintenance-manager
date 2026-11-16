'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiSend, fmtDate, fmtDateTime } from '@/lib/api'
import type { DashboardData } from '@/lib/types'
import { StatCard, DueBadge, ViewTitle, CardIcon } from '@/components/views/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Boxes, Wrench, ClipboardCheck, Package, Truck, Mail, AlertTriangle, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'

export function DashboardView({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [running, setRunning] = useState(false)

  const load = () => apiGet<DashboardData>('/api/dashboard').then(setData).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])

  const runReminders = async () => {
    setRunning(true)
    try {
      const r = await apiSend<{ status: string; error?: string; subject?: string; body?: string; sections: { title: string }[] }>('/api/reminders', 'POST', { trigger: 'manual from dashboard' })
      if (r.status === 'DIGEST_READY') {
        // no mail server in the offline-first app: copy the digest and hand it to the device email client
        try { await navigator.clipboard.writeText(`${r.subject}\n\n${r.body}`) } catch { /* clipboard unavailable */ }
        window.location.href = `mailto:?subject=${encodeURIComponent(r.subject || '')}&body=${encodeURIComponent((r.body || '').slice(0, 1800))}`
        toast.success(`Reminder digest built (${r.sections.length} section(s)) – copied and opened in your email app.`)
      } else if (r.status === 'NOTHING_DUE') toast.success('Nothing due right now – nothing to remind about.')
      else toast.warning(r.status === 'SKIPPED_NO_RECIPIENT' ? 'Digest built, but no recipients set – add emails in Settings.' : r.error || r.status)
      load()
    } catch (e) { toast.error(e.message) } finally { setRunning(false) }
  }

  if (!data) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  }

  const unitsAtClients = data.unitsByStatus['CLIENT_SITE'] || 0
  const inStock = data.unitsByStatus['IN_STOCK'] || 0
  const inMaint = data.unitsByStatus['MAINTENANCE'] || 0

  return (
    <div>
      <ViewTitle
        title="Dashboard"
        subtitle={`${data.company} – preventative maintenance overview (Namibia)`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
            <Button size="sm" onClick={runReminders} disabled={running}><Send className="h-4 w-4 mr-1" /> Build digest & email</Button>
          </div>
        }
      />

      {!data.reminderEmails && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Reminder recipients not set</AlertTitle>
          <AlertDescription>
            This offline-first app builds a reminder digest and hands it to your email app – no mail server needed.
            Add recipient addresses in <button className="underline font-medium" onClick={() => onNavigate('settings')}>Settings</button> so the digest is addressed to the office.
            {data.lastReminderRun ? <> Last digest built: {fmtDateTime(data.lastReminderRun)}.</> : null}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Boxes} tone="emerald" label="Units on register" value={data.unitsTotal} hint={`${inStock} in stock · ${unitsAtClients} at clients · ${inMaint} in maintenance`} />
        <StatCard icon={Wrench} tone="amber" label="Maintenance plans" value={data.schedulesTotal} hint={`${data.overdue.length} overdue · ${data.dueSoon.length} due in 30 days`} />
        <StatCard icon={Package} tone="orange" label="Stock items low" value={data.lowStock.length} hint="at or below reorder point" />
        <StatCard icon={Truck} tone="teal" label="Fleet services due" value={data.fleetDue.length} hint="by km or months interval" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[15px] flex items-center gap-2.5"><CardIcon icon={AlertTriangle} tone="red" /> Overdue maintenance</CardTitle></CardHeader>
          <CardContent>
            {data.overdue.length === 0 ? <p className="text-sm text-muted-foreground">Nothing overdue – good.</p> : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {data.overdue.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.type}{o.unit ? ` · ${o.unit}` : ''}</p></div>
                    <div className="text-right"><DueBadge date={o.nextDue} /><p className="text-xs text-muted-foreground mt-0.5">{fmtDate(o.nextDue)}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[15px] flex items-center gap-2.5"><CardIcon icon={Wrench} tone="amber" /> Due in the next 30 days</CardTitle></CardHeader>
          <CardContent>
            {data.dueSoon.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due soon.</p> : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {data.dueSoon.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.type}{o.unit ? ` · ${o.unit}` : ''}</p></div>
                    <div className="text-right"><DueBadge date={o.nextDue} /><p className="text-xs text-muted-foreground mt-0.5">{fmtDate(o.nextDue)}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[15px] flex items-center gap-2.5"><CardIcon icon={Package} tone="orange" /> Stock to reorder</CardTitle></CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">All stock above reorder points.</p> : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {data.lowStock.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.supplier || 'no supplier'}{s.leadTimeDays != null ? ` · lead time ${s.leadTimeDays} days` : ''}</p></div>
                    <Badge className="rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />{s.qtyOnHand} / {s.reorderPoint} {s.unit}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[15px] flex items-center gap-2.5"><CardIcon icon={ClipboardCheck} tone="emerald" /> Recent inspections & sign-outs</CardTitle></CardHeader>
          <CardContent>
            {data.recentInspections.length === 0 ? <p className="text-sm text-muted-foreground">No inspections yet.</p> : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {data.recentInspections.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div><p className="font-medium">{i.type.replaceAll('_', ' ')} {i.unit ? `· ${i.unit}` : i.vehicle ? `· ${i.vehicle}` : ''}</p><p className="text-xs text-muted-foreground">by {i.inspector} · {fmtDate(i.date)}</p></div>
                    <Badge variant="outline" className={i.status === 'PASS' ? 'text-emerald-700' : i.status === 'FAIL' ? 'text-red-700' : ''}>{i.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-[15px] flex items-center gap-2.5"><CardIcon icon={Mail} tone="slate" /> Last reminder emails</CardTitle></CardHeader>
          <CardContent>
            {data.recentEmails.length === 0 ? <p className="text-sm text-muted-foreground">No reminder emails sent yet.</p> : (
              <ul className="space-y-2">
                {data.recentEmails.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <span className="truncate">{e.subject}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{e.status}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{fmtDateTime(e.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
