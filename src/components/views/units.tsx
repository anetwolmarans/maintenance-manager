'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend, fmtDate, dateInput, todayInput } from '@/lib/api'
import { downloadInspectionSheet, downloadUnitHistoryReport } from '@/lib/pdf'
import type { Unit, UnitEquipment, InspectionTemplate, AirconModel, Inspection } from '@/lib/types'
import { ViewTitle, StatusBadge, DueBadge } from '@/components/views/shared'
import { InspectionForm } from '@/components/inspection-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Boxes, Plus, Search, Pencil, Trash2, Eye, History as HistoryIcon, ArrowUpRight, ArrowDownLeft, FileDown, Wrench, Package, Upload } from 'lucide-react'
import { ImportDialog } from '@/components/import-dialog'

const emptyUnit = {
  id: '', code: '', serial: '', type: 'CONTAINER', size: '', description: '', status: 'IN_STOCK',
  client: '', site: '', dueBack: '', buildDate: '',
  builder: '', electrician: '', plumber: '', painter: '', glazier: '', roofer: '', otherTrade: '', notes: '',
}

export function UnitsView({ refreshKey, onNavigate }: { refreshKey: number; onNavigate: (v: string) => void }) {
  const [units, setUnits] = useState<Unit[]>([])
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [aircons, setAircons] = useState<AirconModel[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<typeof emptyUnit>(emptyUnit)
  const [importOpen, setImportOpen] = useState(false)
  const [detail, setDetail] = useState<Unit | null>(null)
  const [detailTab, setDetailTab] = useState('overview')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [inspOpen, setInspOpen] = useState(false)
  const [inspType, setInspType] = useState<'OUTGOING' | 'RETURN' | 'QCP'>('OUTGOING')
  const [inspUnitId, setInspUnitId] = useState('')
  const [eqEdit, setEqEdit] = useState<Partial<UnitEquipment> | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [u, t, a] = await Promise.all([
        apiGet<Unit[]>('/api/units'),
        apiGet<InspectionTemplate[]>('/api/qcp'),
        apiGet<AirconModel[]>('/api/aircons'),
      ])
      setUnits(u); setTemplates(t); setAircons(a)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const filtered = useMemo(() => units.filter((u) => {
    const hay = `${u.code} ${u.description} ${u.client} ${u.site} ${u.serial}`.toLowerCase()
    return (statusFilter === 'ALL' || u.status === statusFilter) && hay.includes(q.toLowerCase())
  }), [units, q, statusFilter])

  const saveUnit = async () => {
    if (!form.code.trim()) { toast.error('Unit code is required'); return }
    try {
      if (form.id) await apiSend('/api/units', 'PUT', form)
      else await apiSend('/api/units', 'POST', form)
      toast.success(form.id ? 'Unit updated' : 'Unit added')
      setEditOpen(false)
      load()
    } catch (e) { toast.error(e.message) }
  }

  const del = async () => {
    if (!deleteId) return
    try { await apiSend(`/api/units?id=${deleteId}`, 'DELETE'); toast.success('Unit deleted'); setDeleteId(null); load() }
    catch (e) { toast.error(e.message) }
  }

  const generateSchedules = async (unit: Unit) => {
    setGenerating(true)
    try {
      const r = await apiSend<{ created: number }>('/api/maintenance', 'POST', { action: 'generate_for_unit', unitId: unit.id })
      toast.success(`Created ${r.created} maintenance schedule(s) for ${unit.code}`)
      load()
      // refresh detail
      const fresh = await apiGet<Unit[]>('/api/units')
      setDetail(fresh.find((x) => x.id === unit.id) || null)
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const saveEquipment = async () => {
    if (!eqEdit || !detail) return
    if (!eqEdit.name?.trim()) { toast.error('Item name required'); return }
    try {
      if (eqEdit.id) await apiSend('/api/units', 'PUT', { ...eqEdit }) // not used – equipment has own API? keep below
    } catch { /* noop */ }
    // Equipment is managed via dedicated endpoint below
    try {
      const payload = { ...eqEdit, unitId: detail.id, qty: Number(eqEdit.qty) || 1, installedDate: eqEdit.installedDate || null }
      if (eqEdit.id) await apiSend('/api/equipment', 'PUT', payload)
      else await apiSend('/api/equipment', 'POST', payload)
      toast.success('Contents saved')
      setEqEdit(null)
      const fresh = await apiGet<Unit[]>('/api/units')
      setUnits(fresh)
      setDetail(fresh.find((x) => x.id === detail.id) || null)
    } catch (e) { toast.error(e.message) }
  }

  const delEquipment = async (id: string) => {
    try {
      await apiSend(`/api/equipment?id=${id}`, 'DELETE')
      const fresh = await apiGet<Unit[]>('/api/units')
      setUnits(fresh)
      setDetail(fresh.find((x) => x.id === detail!.id) || null)
      toast.success('Item removed')
    } catch (e) { toast.error(e.message) }
  }

  const nextDue = (u: Unit) => {
    const dues = (u.schedules || []).map((s) => s.nextDue).filter(Boolean) as string[]
    return dues.length ? dues.sort()[0] : null
  }

  const openInsp = (unit: Unit, type: 'OUTGOING' | 'RETURN' | 'QCP') => {
    setInspUnitId(unit.id); setInspType(type); setInspOpen(true)
  }

  const downloadInsp = (insp: Inspection, unit?: Unit) => {
    downloadInspectionSheet(
      { ...insp, unit: unit ? { code: unit.code, description: unit.description } : insp.unit } as never,
      'Maintenance',
      unit,
    )
  }

  return (
    <div>
      <ViewTitle
        title="Units register & stock take"
        subtitle="Every container / prefab unit, its build team, contents and history"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Import</Button>
            <Button size="sm" onClick={() => { setForm({ ...emptyUnit }); setEditOpen(true) }}><Plus className="h-4 w-4 mr-1" /> Add unit</Button>
          </div>
        }
      />

      <ImportDialog
        open={importOpen} onOpenChange={setImportOpen} title="Import units (CSV)"
        config={{
          filename: 'units-import-template.csv',
          headers: ['Code', 'Serial', 'Type', 'Size', 'Description', 'Status', 'Build date', 'Builder', 'Electrician', 'Plumber', 'Painter', 'Glazier', 'Roofer', 'Other trade', 'Notes'],
          example: ['C-0142', 'SN00142', 'CONTAINER', '6m', 'Site office container', 'IN_STOCK', '2026-01-15', 'Walvis Steelworks', 'J. Nangolo', '', '', '', '', '', 'Delivered to yard 3'],
          required: ['Code'],
        }}
        importer={async (r) => {
          if (!r['Code']) throw new Error('Code is required')
          await apiSend('/api/units', 'POST', {
            code: r['Code'], serial: r['Serial'], type: r['Type'] || undefined, size: r['Size'],
            description: r['Description'], status: r['Status'] || undefined, buildDate: r['Build date'],
            builder: r['Builder'], electrician: r['Electrician'], plumber: r['Plumber'], painter: r['Painter'],
            glazier: r['Glazier'], roofer: r['Roofer'], otherTrade: r['Other trade'], notes: r['Notes'],
          })
        }}
        onDone={load}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search code, client, serial…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="IN_STOCK">In stock</SelectItem>
            <SelectItem value="CLIENT_SITE">At client</SelectItem>
            <SelectItem value="MAINTENANCE">In maintenance</SelectItem>
            <SelectItem value="RETIRED">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-4">
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No units found.</TableCell></TableRow>
              ) : filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.code}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{u.type} {u.size}</TableCell>
                  <TableCell className="text-sm max-w-56 truncate">{u.description}</TableCell>
                  <TableCell className="hidden md:table-cell"><StatusBadge status={u.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{u.client || '-'}</TableCell>
                  <TableCell><div className="flex items-center gap-1.5">{nextDue(u) && <DueBadge date={nextDue(u)} />}<span className="text-xs text-muted-foreground">{fmtDate(nextDue(u))}</span></div></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => { setDetail(u); setDetailTab('overview') }}><Eye className="h-4 w-4" /></Button>
                      {u.status !== 'CLIENT_SITE' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-700" title="Sign out to client" onClick={() => openInsp(u, 'OUTGOING')}><ArrowUpRight className="h-4 w-4" /></Button>
                      )}
                      {u.status === 'CLIENT_SITE' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-700" title="Receive back from client" onClick={() => openInsp(u, 'RETURN')}><ArrowDownLeft className="h-4 w-4" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setForm({ ...emptyUnit, ...u, buildDate: dateInput(u.buildDate), dueBack: dateInput(u.dueBack) } as typeof emptyUnit); setEditOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete" onClick={() => setDeleteId(u.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / edit unit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? `Edit unit ${form.code}` : 'Add unit'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Unit code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PC-006" /></div>
            <div><Label>Serial no.</Label><Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CONTAINER">Container</SelectItem><SelectItem value="PREFAB">Prefab building</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Size</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 6 m, 12 m, 3x6 m" /></div>
            <div className="sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Converted container – site office" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="IN_STOCK">In stock</SelectItem><SelectItem value="CLIENT_SITE">At client</SelectItem><SelectItem value="MAINTENANCE">In maintenance</SelectItem><SelectItem value="RETIRED">Retired</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Build date</Label><Input type="date" value={form.buildDate} onChange={(e) => setForm({ ...form, buildDate: e.target.value })} /></div>
            <div className="sm:col-span-2 mt-1">
              <p className="text-sm font-semibold mb-1.5 flex items-center gap-1.5"><Wrench className="h-4 w-4" /> Build team – who built what</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Builder / fabricator</Label><Input value={form.builder} onChange={(e) => setForm({ ...form, builder: e.target.value })} /></div>
                <div><Label>Electrician</Label><Input value={form.electrician} onChange={(e) => setForm({ ...form, electrician: e.target.value })} /></div>
                <div><Label>Plumber</Label><Input value={form.plumber} onChange={(e) => setForm({ ...form, plumber: e.target.value })} /></div>
                <div><Label>Painter</Label><Input value={form.painter} onChange={(e) => setForm({ ...form, painter: e.target.value })} /></div>
                <div><Label>Glazier (windows)</Label><Input value={form.glazier} onChange={(e) => setForm({ ...form, glazier: e.target.value })} /></div>
                <div><Label>Roofer</Label><Input value={form.roofer} onChange={(e) => setForm({ ...form, roofer: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Other trade / contractor</Label><Input value={form.otherTrade} onChange={(e) => setForm({ ...form, otherTrade: e.target.value })} placeholder="e.g. tiler, carpenter" /></div>
              </div>
            </div>
            {form.status === 'CLIENT_SITE' && (
              <>
                <div><Label>Client</Label><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
                <div><Label>Site</Label><Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></div>
                <div><Label>Due back</Label><Input type="date" value={form.dueBack} onChange={(e) => setForm({ ...form, dueBack: e.target.value })} /></div>
              </>
            )}
            <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveUnit}>Save unit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unit detail */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">{detail.code} <StatusBadge status={detail.status} /></DialogTitle>
              </DialogHeader>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="flex-wrap h-auto [&>[data-slot=tabs-trigger]]:h-auto [&>[data-slot=tabs-trigger]]:flex-none">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="contents">Contents ({detail.equipment.length})</TabsTrigger>
                  <TabsTrigger value="maintenance">Maintenance ({(detail.schedules || []).length})</TabsTrigger>
                  <TabsTrigger value="inspections">Inspections ({(detail.inspections || []).length})</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <p><span className="text-muted-foreground">Type / size:</span> {detail.type} {detail.size || ''}</p>
                    <p><span className="text-muted-foreground">Serial:</span> {detail.serial || '-'}</p>
                    <p><span className="text-muted-foreground">Built:</span> {fmtDate(detail.buildDate)}</p>
                    <p><span className="text-muted-foreground">Client / site:</span> {detail.client || '-'}{detail.site ? ` / ${detail.site}` : ''}</p>
                    {detail.outDate && <p><span className="text-muted-foreground">Out since:</span> {fmtDate(detail.outDate)}</p>}
                    {detail.dueBack && <p><span className="text-muted-foreground">Due back:</span> {fmtDate(detail.dueBack)}</p>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1.5">Build team</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[['Builder', detail.builder], ['Electrician', detail.electrician], ['Plumber', detail.plumber], ['Painter', detail.painter], ['Glazier', detail.glazier], ['Roofer', detail.roofer], ['Other', detail.otherTrade]].map(([k, v]) => (
                        <div key={k as string} className="rounded-md border p-2 text-sm"><span className="block text-xs text-muted-foreground">{k}</span>{(v as string) || '-'}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => generateSchedules(detail)} disabled={generating}><Wrench className="h-4 w-4 mr-1" /> Generate standard maintenance schedule</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadUnitHistoryReport(detail as never, 'Maintenance')}><FileDown className="h-4 w-4 mr-1" /> History report (PDF)</Button>
                    <Button size="sm" variant="outline" onClick={() => openInsp(detail, 'QCP')}><Plus className="h-4 w-4 mr-1" /> QCP inspection</Button>
                  </div>
                  {detail.notes && <p className="text-sm text-muted-foreground">Notes: {detail.notes}</p>}
                </TabsContent>

                <TabsContent value="contents" className="mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-muted-foreground">Aircons, doors, windows and other contents of this unit.</p>
                    <Button size="sm" onClick={() => setEqEdit({ kind: 'AIRCON', qty: 1 })}><Plus className="h-4 w-4 mr-1" /> Add item</Button>
                  </div>
                  <div className="rounded-lg border divide-y">
                    {detail.equipment.length === 0 && <p className="p-3 text-sm text-muted-foreground">No contents recorded yet.</p>}
                    {detail.equipment.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{e.name} {e.qty > 1 && <span className="text-muted-foreground">x{e.qty}</span>}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.kind === 'AIRCON' && e.airconModel ? `${e.airconModel.brand} · service every ${e.airconModel.serviceIntervalMonths} mo` : e.kind}
                            {e.serial ? ` · SN ${e.serial}` : ''} {e.installedDate ? `· fitted ${fmtDate(e.installedDate)}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEqEdit({ ...e, installedDate: dateInput(e.installedDate) })}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => delEquipment(e.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="maintenance" className="mt-3">
                  <div className="rounded-lg border divide-y max-h-96 overflow-y-auto">
                    {(detail.schedules || []).length === 0 && <p className="p-3 text-sm text-muted-foreground">No schedules yet – use “Generate standard maintenance schedule”.</p>}
                    {(detail.schedules || []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                        <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.type.name} · every {s.intervalMonths} months · {s.responsible || 'unassigned'}</p></div>
                        <div className="text-right"><DueBadge date={s.nextDue} /><p className="text-xs text-muted-foreground mt-0.5">{fmtDate(s.nextDue)}</p></div>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="link" className="mt-2 px-0" onClick={() => onNavigate('maintenance')}>Open maintenance module →</Button>
                </TabsContent>

                <TabsContent value="inspections" className="mt-3">
                  <div className="rounded-lg border divide-y max-h-96 overflow-y-auto">
                    {(detail.inspections || []).length === 0 && <p className="p-3 text-sm text-muted-foreground">No inspections recorded yet.</p>}
                    {(detail.inspections || []).map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                        <div>
                          <p className="font-medium">{i.type.replaceAll('_', ' ')} {i.type === 'QCP' && i.template ? `– ${i.template.name}` : ''}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(i.date)} · inspector {i.inspectorName}{i.clientName ? ` · client ${i.clientName}` : ''} {i.signature ? '· signed' : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={i.status} />
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Download inspection sheet" onClick={() => downloadInsp(i, detail)}><FileDown className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-3">
                  <ol className="relative border-l ml-3 max-h-96 overflow-y-auto">
                    {(detail.history || []).length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
                    {(detail.history || []).map((h) => (
                      <li key={h.id} className="ml-4 pb-4 border-l-2 border-transparent">
                        <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-emerald-500" />
                        <p className="text-sm"><span className="font-medium">{h.type.replaceAll('_', ' ')}</span> <span className="text-xs text-muted-foreground">· {fmtDate(h.date)}</span></p>
                        <p className="text-sm text-muted-foreground">{h.description}{h.person ? ` – ${h.person}` : ''}</p>
                      </li>
                    ))}
                  </ol>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Equipment dialog */}
      <Dialog open={Boolean(eqEdit)} onOpenChange={(v) => !v && setEqEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{eqEdit?.id ? 'Edit contents item' : 'Add contents item'}</DialogTitle></DialogHeader>
          {eqEdit && (
            <div className="grid gap-3">
              <div>
                <Label>Kind</Label>
                <Select value={eqEdit.kind} onValueChange={(v) => setEqEdit({ ...eqEdit, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AIRCON">Aircon</SelectItem>
                    <SelectItem value="DOOR">Door</SelectItem>
                    <SelectItem value="WINDOW">Window</SelectItem>
                    <SelectItem value="FRIDGE">Fridge / appliance</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {eqEdit.kind === 'AIRCON' && (
                <div>
                  <Label>Model (service interval comes from the model)</Label>
                  <Select value={eqEdit.airconModelId || ''} onValueChange={(v) => setEqEdit({ ...eqEdit, airconModelId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose aircon model" /></SelectTrigger>
                    <SelectContent>{aircons.map((a) => <SelectItem key={a.id} value={a.id}>{a.brand} {a.model} – {a.btu} BTU</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Name</Label><Input value={eqEdit.name || ''} onChange={(e) => setEqEdit({ ...eqEdit, name: e.target.value })} placeholder="e.g. Samsung AR12 12000 BTU" /></div>
              <div><Label>Serial</Label><Input value={eqEdit.serial || ''} onChange={(e) => setEqEdit({ ...eqEdit, serial: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Qty</Label><Input type="number" min={1} value={eqEdit.qty ?? 1} onChange={(e) => setEqEdit({ ...eqEdit, qty: Number(e.target.value) })} /></div>
                <div><Label>Fitted on</Label><Input type="date" value={(eqEdit.installedDate as string) || ''} onChange={(e) => setEqEdit({ ...eqEdit, installedDate: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEqEdit(null)}>Cancel</Button><Button onClick={saveEquipment}>Save</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inspection form for sign-out / return / QCP */}
      <InspectionForm
        open={inspOpen}
        onOpenChange={setInspOpen}
        templates={templates}
        units={units}
        vehicles={[]}
        fixedType={inspType}
        fixedUnitId={inspUnitId}
        onSaved={() => { load(); }}
      />

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete unit?</AlertDialogTitle><AlertDialogDescription>This removes the unit with all its contents, schedules, inspections and history. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
