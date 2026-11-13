'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { dueStatus } from '@/lib/api'
import type { LucideIcon } from 'lucide-react'

export function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="py-3">
      <CardContent className="px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-semibold leading-tight">{value}</p>
            {hint ? <p className="text-[11px] text-muted-foreground truncate">{hint}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DueBadge({ date }: { date?: string | null }) {
  const st = dueStatus(date)
  if (st === 'NOT SET') return <Badge variant="outline">no date</Badge>
  if (st === 'OVERDUE') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>
  if (st === 'DUE SOON') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Due soon</Badge>
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">On track</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    IN_STOCK: 'bg-emerald-100 text-emerald-800',
    CLIENT_SITE: 'bg-amber-100 text-amber-800',
    MAINTENANCE: 'bg-orange-100 text-orange-800',
    RETIRED: 'bg-slate-200 text-slate-700',
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    IN_WORKSHOP: 'bg-orange-100 text-orange-800',
    PASS: 'bg-emerald-100 text-emerald-800',
    FAIL: 'bg-red-100 text-red-800',
    CONDITIONAL: 'bg-amber-100 text-amber-800',
  }
  const label = status.replaceAll('_', ' ').toLowerCase()
  return <Badge className={map[status] || 'bg-slate-100 text-slate-700'}>{label}</Badge>
}

export function ViewTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
