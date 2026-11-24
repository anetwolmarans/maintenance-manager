'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend, fmtDate, isSameDay } from '@/lib/api'
import { downloadInspectionSheet } from '@/lib/pdf'
import type { Inspection, InspectionTemplate, FleetVehicle } from '@/lib/types'
import { ViewTitle, StatusBadge, StatCard } from '@/components/views/shared'
import { DriverCheckForm } from '@/components/driver-check-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, CarFront, FileDown, Trash2, Eye, AlertTriangle, CircleCheck, PenLine } from 'lucide-react'

interface ParsedItem { text?: string; result?: string; notes?: string; type?: string; value?: string }

export function DriverChecksView({ refreshKey }: { refreshKey: number }) {
  const [checks, setChecks] = useState<Inspection[]>([])
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [view, setView] = useState<Inspection | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [i, v, t] = await Promise.all([
        apiGet<Inspection[]>('/api/inspections'),
        apiGet<FleetVehicle[]>('/api/fleet'),
        apiGet<InspectionTemplate[]>('/api/qcp'),
      ])
      setChecks(i.filter((x) => x.type === 'DRIVER_CHECK')); setVehicles(v); setTemplates(t)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const itemsOf = (i: Inspection): ParsedItem[] => {
    try { return JSON.parse(i.items || '[]') as ParsedItem[] } catch { return [] }
  }
  const vehicleOf = (i: Inspection) => vehicles.find((v) => v.id === i.vehicleId)

  const today = new Date()
  const checksToday = checks.filter((c) => isSameDay(c.date, today)).length
  const activeVehicles = vehicles.filter((v) => v.status !== 'RETIRED')
  const vehiclesCheckedToday = new Set(checks.filter((c) => isSameDay(c.date, today)).map((c) => c.vehicleId)).size

  const weekAgo = Date.now() - 7 * 86400000
  const defectChecks = useMemo(() => checks.filter((c) => c.status !== 'PASS' && new Date(c.date).getTime() >= weekAgo), [checks, weekAgo])

  const del = async () => {
    if (!deleteId) return
    try { await apiSend(`/api/inspections?id=${deleteId}`, 'DELETE'); setDeleteId(null); toast.success('Check deleted'); load() }
    catch (e) { toast.error(e.message) }
  }

  const download = (c: Inspection) => {
    const v = vehicleOf(c)
    downloadInspectionSheet({ ...c, vehicle: v ? { regNo: v.regNo, make: v.make, model: v.model } : c.vehicle } as never, 'Maintenance')
  }

  return (
    <div>
      <ViewTitle
        title="Driver checks"
        subtitle="Daily pre-trip walk-arounds done by drivers – signed on the phone, defects flagged to the office"
        action={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New driver check
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CircleCheck} tone="emerald" label="Checks today" value={checksToday} hint="pre-trip checks submitted today" />
        <StatCard icon={CarFront} tone="teal" label="Vehicles covered" value={`${vehiclesCheckedToday}/${activeVehicles.length}`} hint="checked today, of the active fleet" />
        <StatCard icon={AlertTriangle} tone="orange" label="Defects (7 days)" value={defectChecks.length} hint="checks that failed in the last week" />
        <StatCard icon={PenLine} tone="slate" label="Total checks" value={checks.length} hint="all signed driver checks on record" />
      </div>

      {/* defects reported by drivers */}
      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] flex items-center gap-2.5"><AlertTriangle className="h-4 w-4 text-orange-600" /> Defects to follow up (last 7 days)</CardTitle></CardHeader>
        <CardContent>
          {defectChecks.length === 0 ? <p className="text-sm text-muted-foreground">No defects reported – drivers are happy.</p> : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {defectChecks.flatMap((c) => itemsOf(c).filter((x) => x.result === 'FAIL').map((x, n) => (
                <li key={`${c.id}-${n}`} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{vehicleOf(c)?.regNo || c.vehicle?.regNo || 'Unknown'} – {x.text}</p>
                    <p className="text-xs text-muted-foreground">{x.notes ? `${x.notes} · ` : ''}reported by {c.inspectorName} · {fmtDate(c.date)}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setView(c)}>View check</Button>
                </li>
              )))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* history */}
      <Card className="mt-4">
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="hidden sm:table-cell">Driver</TableHead>
                <TableHead className="hidden md:table-cell">Odometer</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="hidden sm:table-cell">Signed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : checks.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No driver checks yet – tap “New driver check” to do the first walk-around.</TableCell></TableRow>
              ) : checks.map((c) => {
                const v = vehicleOf(c)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{fmtDate(c.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{v ? `${v.regNo}` : c.vehicle?.regNo || '-'}<span className="block text-xs text-muted-foreground">{v ? `${v.make} ${v.model}` : ''}</span></TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{c.inspectorName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.odometerKm != null ? `${c.odometerKm.toLocaleString('en')} km` : '-'}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="hidden sm:table-cell">{c.signature ? <PenLine className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-muted-foreground">no</span>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setView(c)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Download check sheet (PDF)" onClick={() => download(c)}><FileDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DriverCheckForm open={formOpen} onOpenChange={setFormOpen} vehicles={activeVehicles} templates={templates} onSaved={load} />

      {/* view check */}
      <Dialog open={Boolean(view)} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader>
                <DialogTitle>Driver check – {vehicleOf(view)?.regNo || view.vehicle?.regNo} · {fmtDate(view.date)}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-1.5 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Driver:</span> {view.inspectorName}</p>
                <p><span className="text-muted-foreground">Odometer:</span> {view.odometerKm != null ? `${view.odometerKm.toLocaleString('en')} km` : '-'}</p>
                <p><span className="text-muted-foreground">Result:</span> <StatusBadge status={view.status} /></p>
                <p><span className="text-muted-foreground">Checklist:</span> {view.template?.name || 'Driver daily walk-around check'}</p>
              </div>
              <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
                {itemsOf(view).map((x, n) => (
                  <div key={n} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <span className="flex-1">{n + 1}. {x.text}{x.type === 'date' && x.value ? <span className="block text-xs text-muted-foreground">Expires: {fmtDate(x.value)}</span> : x.notes ? <span className="block text-xs text-muted-foreground">{x.notes}</span> : null}</span>
                    <span className={`text-xs font-medium ${x.result === 'PASS' ? 'text-emerald-700' : x.result === 'FAIL' ? 'text-red-600' : 'text-slate-500'}`}>{x.type === 'date' ? (x.value ? fmtDate(x.value) : '-') : (x.result || '-')}</span>
                  </div>
                ))}
              </div>
              {view.findings && <p className="text-sm"><span className="text-muted-foreground">Reported:</span> {view.findings}</p>}
              {view.signature && (
                <div>
                  <p className="text-sm font-medium mb-1">Signature</p>
                  <img src={view.signature} alt={`Signature of ${view.inspectorName}`} className="rounded-lg border bg-white max-w-xs" />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => download(view)}><FileDown className="h-4 w-4 mr-1" /> Download sheet (PDF)</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete driver check?</AlertDialogTitle><AlertDialogDescription>This removes the signed check from the record.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
