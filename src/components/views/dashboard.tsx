'use client'

import { useEffect, useState } from 'react'
import { apiGet, fmtDate, fmtDateTime } from '@/lib/api'
import type { DashboardData } from '@/lib/types'
import { StatCard, DueBadge, ViewTitle } from '@/components/views/shared'
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
      const r = await apiSend<{ status: string; error?: string; sections: { title: string }[] }>('/api/reminders', 'POST', { trigger: 'manual from dashboard' })
      if (r.status === 'SENT') toast.success(`Reminder email sent (${r.sections.length} section(s)).`)
      else if (r.status === 'NOTHING_DUE') toast.success('Nothing due right now – nothing to remind about.')
      else toast.warning(r.status === 'SKIPPED_NO_RECIPIENT' || r.status === 'SKIPPED_NO_SMTP' ? 'Email not sent: configure recipients/SMTP in Settings.' : r.error || r.status)
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
            <Button size="sm" onClick={runReminders} disabled={running}><Send className="h-4 w-4 mr-1" /> Run reminders now</Button>
          </div>
        }
      />

      {(!data.smtpConfigured || !data.reminderEmails) && (
        <Alert className="mb-4 border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Email reminders not fully configured</AlertTitle>
          <AlertDescription>
            {!data.reminderEmails ? 'Add recipient email addresses ' : 'Add your SMTP server details '}
            in <button className="underline font-medium" onClick={() => onNavigate('settings')}>Settings</button> so maintenance and stock reminders can be emailed.
            {data.lastReminderRun ? <> Last reminder check: {fmtDateTime(data.lastReminderRun)}.</> : null}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Boxes} label="Units on register" value={data.unitsTotal} hint={`${inStock} in stock · ${unitsAtClients} at clients · ${inMaint} in maintenance`} />
        <StatCard icon={Wrench} label="Maintenance schedules" value={data.schedulesTotal} hint={`${data.overdue.length} overdue · ${data.dueSoon.length} due in 30 days`} />
        <StatCard icon={Package} label="Stock items low" value={data.lowStock.length} hint="at or below reorder point" />
        <StatCard icon={Truck} label="Fleet services due" value={data.fleetDue.length} hint="by km or months interval" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /> Overdue maintenance</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-amber-600" /> Due in the next 30 days</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-orange-600" /> Stock to reorder</CardTitle></CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">All stock above reorder points.</p> : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {data.lowStock.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.supplier || 'no supplier'}{s.leadTimeDays != null ? ` · lead time ${s.leadTimeDays} days` : ''}</p></div>
                    <Badge className="bg-red-100 text-red-800">{s.qtyOnHand} / {s.reorderPoint} {s.unit}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-700" /> Recent inspections & sign-outs</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Last reminder emails</CardTitle></CardHeader>
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
