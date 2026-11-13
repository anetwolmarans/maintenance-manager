'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend, fmtDate, dateInput, todayInput } from '@/lib/api'
import { downloadMaintenancePlan } from '@/lib/pdf'
import type { MaintenanceSchedule, MaintenanceType, Unit, MaintenanceRecord } from '@/lib/types'
import { ViewTitle, DueBadge } from '@/components/views/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, FileDown, CheckCircle2 } from 'lucide-react'

const emptySch = { id: '', name: '', typeId: '', scope: 'UNIT', unitId: '', intervalMonths: 12, lastDone: '', responsible: '', notes: '' }

export function MaintenanceView({ refreshKey }: { refreshKey: number }) {
  const [types, setTypes] = useState<MaintenanceType[]>([])
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overdue')
  const [q, setQ] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<typeof emptySch>(emptySch)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [completeSch, setCompleteSch] = useState<MaintenanceSchedule | null>(null)
  const [cForm, setCForm] = useState({ date: todayInput(), performedBy: '', cost: '', findings: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [m, u] = await Promise.all([
        apiGet<{ types: MaintenanceType[]; schedules: MaintenanceSchedule[] }>('/api/maintenance'),
        apiGet<Unit[]>('/api/units'),
      ])
      setTypes(m.types); setSchedules(m.schedules); setUnits(u)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const statusOf = (s: MaintenanceSchedule) => {
    if (!s.nextDue) return 'NONE'
    const diff = Math.ceil((new Date(s.nextDue).getTime() - Date.now()) / 86400000)
    if (diff < 0) return 'OVERDUE'
    if (diff <= 30) return 'SOON'
    return 'OK'
  }

  const filtered = useMemo(() => schedules.filter((s) => {
    const hay = `${s.name} ${s.type.name} ${s.unit?.code || ''} ${s.responsible || ''}`.toLowerCase()
    if (hay.includes(q.toLowerCase())) return true
    return false
  }), [schedules, q])

  const byTab = useMemo(() => filtered.filter((s) => {
    const st = statusOf(s)
    if (tab === 'overdue') return st === 'OVERDUE'
    if (tab === 'soon') return st === 'SOON'
    if (tab === 'yard') return s.scope === 'GLOBAL'
    if (tab === 'aircon') return s.type.category === 'Aircon'
    if (tab === 'units') return s.scope === 'UNIT'
    return true
  }), [filtered, tab])

  const save = async () => {
    if (!form.name.trim() || !form.typeId) { toast.error('Task name and type are required'); return }
    try {
      if (form.id) await apiSend('/api/maintenance', 'PUT', { ...form, lastDone: form.lastDone || null })
      else await apiSend('/api/maintenance', 'POST', { ...form, scope: form.scope, lastDone: form.lastDone || null })
      toast.success('Schedule saved'); setEditOpen(false); load()
    } catch (e) { toast.error(e.message) }
  }

  const del = async () => {
    if (!deleteId) return
    try { await apiSend(`/api/maintenance?id=${deleteId}`, 'DELETE'); setDeleteId(null); toast.success('Schedule deleted'); load() }
    catch (e) { toast.error(e.message) }
  }

  const complete = async () => {
    if (!completeSch) return
    try {
      await apiSend('/api/maintenance', 'PUT', {
        action: 'complete', scheduleId: completeSch.id, date: cForm.date,
        performedBy: cForm.performedBy, cost: cForm.cost ? Number(cForm.cost) : null, findings: cForm.findings,
      })
      toast.success(`Logged. Next due in ${completeSch.intervalMonths} months.`)
      setCompleteSch(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const recentRecords = useMemo(() => {
    const all: (MaintenanceRecord & { task: string })[] = []
    for (const s of schedules) for (const r of s.records || []) all.push({ ...r, task: s.name })
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30)
  }, [schedules])

  return (
    <div>
      <ViewTitle
        title="Preventative maintenance"
        subtitle="Aircon services, painting, yard & window cleaning, frame/door checks – with intervals and reminders"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadMaintenancePlan(schedules as never, 'Maintenance')}><FileDown className="h-4 w-4 mr-1" /> Plan (PDF)</Button>
            <Button size="sm" onClick={() => { setForm({ ...emptySch }); setEditOpen(true) }}><Plus className="h-4 w-4 mr-1" /> Add schedule</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto [&>[data-slot=tabs-trigger]]:h-auto [&>[data-slot=tabs-trigger]]:flex-none">
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="soon">Due ≤30 days</TabsTrigger>
            <TabsTrigger value="yard">Yard & cleaning</TabsTrigger>
            <TabsTrigger value="aircon">Aircon</TabsTrigger>
            <TabsTrigger value="units">Unit schedules</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Unit</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead className="hidden lg:table-cell">Last done</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : byTab.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nothing here.</TableCell></TableRow>
              ) : byTab.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.name}</p>
                    {s.responsible && <p className="text-xs text-muted-foreground">{s.responsible}</p>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{s.type.category}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{s.unit?.code || (s.scope === 'GLOBAL' ? 'Whole yard' : '-')}</TableCell>
                  <TableCell className="text-sm">{s.intervalMonths} mo</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{fmtDate(s.lastDone)}</TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><DueBadge date={s.nextDue} /><span className="text-xs text-muted-foreground">{fmtDate(s.nextDue)}</span></div></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => { setCompleteSch(s); setCForm({ date: todayInput(), performedBy: s.responsible || '', cost: '', findings: '' }) }}>
                        <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> Log done
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setForm({ id: s.id, name: s.name, typeId: s.typeId, scope: s.scope, unitId: s.unitId || '', intervalMonths: s.intervalMonths, lastDone: dateInput(s.lastDone), responsible: s.responsible || '', notes: s.notes || '' }); setEditOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h3 className="font-semibold mt-6 mb-2">Recent maintenance log</h3>
      <Card>
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Task</TableHead><TableHead className="hidden sm:table-cell">Done by</TableHead><TableHead className="hidden md:table-cell">Cost (N$)</TableHead><TableHead>Findings</TableHead></TableRow></TableHeader>
            <TableBody>
              {recentRecords.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No maintenance logged yet.</TableCell></TableRow>
              ) : recentRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{fmtDate(r.date)}</TableCell>
                  <TableCell className="text-sm font-medium">{r.task}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{r.performedBy || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{r.cost ?? '-'}</TableCell>
                  <TableCell className="text-sm max-w-72 truncate">{r.findings || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Schedule dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Edit schedule' : 'Add maintenance schedule'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Task name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Window cleaning – PC-003" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.typeId} onValueChange={(v) => {
                const t = types.find((x) => x.id === v)
                setForm({ ...form, typeId: v, intervalMonths: t?.defaultIntervalMonths || form.intervalMonths })
              }}>
                <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} (every {t.defaultIntervalMonths} mo)</SelectItem>)}</SelectContent>
              </Select>
              {types.find((t) => t.id === form.typeId)?.description && <p className="text-xs text-muted-foreground mt-1">{types.find((t) => t.id === form.typeId)!.description}</p>}
            </div>
            <div>
              <Label>Applies to</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v, unitId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIT">A specific unit</SelectItem>
                  <SelectItem value="GLOBAL">Whole yard / all units</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === 'UNIT' && (
              <div>
                <Label>Unit</Label>
                <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose unit" /></SelectTrigger>
                  <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.code} – {u.description || u.type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Interval (months)</Label><Input type="number" min={1} value={form.intervalMonths} onChange={(e) => setForm({ ...form, intervalMonths: Number(e.target.value) })} /></div>
              <div><Label>Last done</Label><Input type="date" value={form.lastDone} onChange={(e) => setForm({ ...form, lastDone: e.target.value })} /></div>
              <div><Label>Responsible</Label><Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log completion */}
      <Dialog open={Boolean(completeSch)} onOpenChange={(v) => !v && setCompleteSch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log maintenance done</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">{completeSch?.name}</p>
          <div className="grid gap-3">
            <div><Label>Date</Label><Input type="date" value={cForm.date} onChange={(e) => setCForm({ ...cForm, date: e.target.value })} /></div>
            <div><Label>Done by</Label><Input value={cForm.performedBy} onChange={(e) => setCForm({ ...cForm, performedBy: e.target.value })} placeholder="Person / contractor" /></div>
            <div><Label>Cost (N$)</Label><Input type="number" value={cForm.cost} onChange={(e) => setCForm({ ...cForm, cost: e.target.value })} /></div>
            <div><Label>Findings / what was done</Label><Input value={cForm.findings} onChange={(e) => setCForm({ ...cForm, findings: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCompleteSch(null)}>Cancel</Button><Button onClick={complete}>Log & roll next due date</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete schedule?</AlertDialogTitle><AlertDialogDescription>Its logged history will also be removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
