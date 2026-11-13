'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend, fmtDate } from '@/lib/api'
import { downloadInspectionSheet } from '@/lib/pdf'
import type { Inspection, InspectionTemplate, Unit, FleetVehicle } from '@/lib/types'
import { ViewTitle, StatusBadge } from '@/components/views/shared'
import { InspectionForm } from '@/components/inspection-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Search, FileDown, Trash2, Eye, PenLine } from 'lucide-react'

export function InspectionsView({ refreshKey }: { refreshKey: number }) {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [view, setView] = useState<Inspection | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [i, t, u, v] = await Promise.all([
        apiGet<Inspection[]>('/api/inspections'),
        apiGet<InspectionTemplate[]>('/api/qcp'),
        apiGet<Unit[]>('/api/units'),
        apiGet<FleetVehicle[]>('/api/fleet'),
      ])
      setInspections(i); setTemplates(t); setUnits(u); setVehicles(v)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const filtered = useMemo(() => inspections.filter((i) => {
    const hay = `${i.type} ${i.unit?.code || ''} ${i.vehicle?.regNo || ''} ${i.inspectorName} ${i.clientName || ''}`.toLowerCase()
    return (typeFilter === 'ALL' || i.type === typeFilter) && hay.includes(q.toLowerCase())
  }), [inspections, q, typeFilter])

  const itemsOf = (i: Inspection) => {
    try { return JSON.parse(i.items || '[]') as { text: string; result?: string; notes?: string }[] } catch { return [] }
  }

  const del = async () => {
    if (!deleteId) return
    try { await apiSend(`/api/inspections?id=${deleteId}`, 'DELETE'); setDeleteId(null); toast.success('Inspection deleted'); load() }
    catch (e) { toast.error(e.message) }
  }

  const download = (i: Inspection) => {
    const unit = units.find((u) => u.id === i.unitId)
    downloadInspectionSheet({ ...i, unit: unit ? { code: unit.code, description: unit.description } : i.unit } as never, 'Maintenance', unit)
  }

  return (
    <div>
      <ViewTitle
        title="Inspections & sign-outs"
        subtitle="Units going out and returning – checklists completed and signed on tablet"
        action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1" /> New inspection</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="OUTGOING">Outgoing (sign out)</SelectItem>
            <SelectItem value="RETURN">Return (receive back)</SelectItem>
            <SelectItem value="QCP">QCP</SelectItem>
            <SelectItem value="FLEET">Fleet</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search unit, vehicle, inspector, client…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit / vehicle</TableHead>
                <TableHead className="hidden md:table-cell">Inspector</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="hidden sm:table-cell">Signed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No inspections yet.</TableCell></TableRow>
              ) : filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-sm">{fmtDate(i.date)}</TableCell>
                  <TableCell className="text-sm font-medium">{i.type.replaceAll('_', ' ')}{i.template && i.type === 'QCP' ? <span className="block text-xs text-muted-foreground">{i.template.name}</span> : null}</TableCell>
                  <TableCell className="text-sm">{i.unit?.code || (i.vehicle ? `${i.vehicle.regNo}` : '-')}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{i.inspectorName}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{i.clientName || '-'}</TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                  <TableCell className="hidden sm:table-cell">{i.signature ? <PenLine className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-muted-foreground">no</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setView(i)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Download inspection sheet (PDF)" onClick={() => download(i)}><FileDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete" onClick={() => setDeleteId(i.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InspectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        templates={templates}
        units={units}
        vehicles={vehicles}
        onSaved={() => { load() }}
      />

      {/* View inspection */}
      <Dialog open={Boolean(view)} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.type.replaceAll('_', ' ')} – {view.unit?.code || view.vehicle?.regNo}</DialogTitle></DialogHeader>
              <div className="grid gap-1.5 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Date:</span> {fmtDate(view.date)}</p>
                <p><span className="text-muted-foreground">Inspector:</span> {view.inspectorName}</p>
                <p><span className="text-muted-foreground">Client:</span> {view.clientName || '-'}</p>
                <p><span className="text-muted-foreground">Result:</span> <StatusBadge status={view.status} /></p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Checklist:</span> {view.template?.name || '-'}</p>
              </div>
              <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
                {itemsOf(view).map((x, n) => (
                  <div key={n} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <span className="flex-1">{n + 1}. {x.text}{x.notes ? <span className="block text-xs text-muted-foreground">{x.notes}</span> : null}</span>
                    <span className={`text-xs font-medium ${x.result === 'PASS' ? 'text-emerald-700' : x.result === 'FAIL' ? 'text-red-600' : 'text-slate-500'}`}>{x.result || '-'}</span>
                  </div>
                ))}
              </div>
              {view.findings && <p className="text-sm"><span className="text-muted-foreground">Findings:</span> {view.findings}</p>}
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
          <AlertDialogHeader><AlertDialogTitle>Delete inspection?</AlertDialogTitle><AlertDialogDescription>This removes the inspection and its signature from the record.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
