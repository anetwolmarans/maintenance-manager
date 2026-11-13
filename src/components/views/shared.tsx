'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { dueStatus } from '@/lib/api'
import type { LucideIcon } from 'lucide-react'

export type StatTone = 'emerald' | 'teal' | 'amber' | 'orange' | 'red' | 'slate'

const TONE_CHIP: Record<StatTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15',
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'emerald' }: { icon: LucideIcon; label: string; value: string | number; hint?: string; tone?: StatTone }) {
  return (
    <Card className="shadow-soft shadow-soft-hover py-4">
      <CardContent className="px-5">
        <div className="flex items-center gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${TONE_CHIP[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            <p className="font-display text-2xl font-bold leading-tight tracking-tight">{value}</p>
            {hint ? <p className="text-[11px] text-muted-foreground truncate mt-0.5">{hint}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${className}`} />
}

export function DueBadge({ date }: { date?: string | null }) {
  const st = dueStatus(date)
  if (st === 'NOT SET')
    return (
      <Badge variant="outline" className="rounded-full text-muted-foreground"><Dot className="bg-slate-400" /> no date</Badge>
    )
  if (st === 'OVERDUE')
    return <Badge className="rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 hover:bg-red-50"><Dot className="bg-red-500" /> Overdue</Badge>
  if (st === 'DUE SOON')
    return <Badge className="rounded-full bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25 hover:bg-amber-50"><Dot className="bg-amber-500" /> Due soon</Badge>
  return <Badge className="rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-50"><Dot className="bg-emerald-500" /> On track</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    IN_STOCK: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20|bg-emerald-500',
    CLIENT_SITE: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25|bg-amber-500',
    MAINTENANCE: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25|bg-orange-500',
    RETIRED: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15|bg-slate-400',
    ACTIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20|bg-emerald-500',
    IN_WORKSHOP: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/25|bg-orange-500',
    PASS: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20|bg-emerald-500',
    FAIL: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20|bg-red-500',
    CONDITIONAL: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25|bg-amber-500',
  }
  const spec = map[status]
  const [cls, dot] = spec ? spec.split('|') : ['bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15', 'bg-slate-400']
  const label = status.replaceAll('_', ' ').toLowerCase()
  return (
    <Badge className={`rounded-full ${cls}`}><Dot className={dot} /> {label}</Badge>
  )
}

export function ViewTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function CardIcon({ icon: Icon, tone = 'emerald' }: { icon: LucideIcon; tone?: StatTone }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TONE_CHIP[tone]}`}>
      <Icon className="h-4 w-4" />
    </span>
  )
}
