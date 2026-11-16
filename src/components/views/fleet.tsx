'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend, fmtDate, dateInput, todayInput } from '@/lib/api'
import { downloadFleetReport, downloadInspectionSheet } from '@/lib/pdf'
import type { FleetVehicle, FleetRecord, InspectionTemplate, Inspection } from '@/lib/types'
import { ViewTitle, StatusBadge, DueBadge } from '@/components/views/shared'
import { InspectionForm } from '@/components/inspection-form'
import { DriverCheckForm } from '@/components/driver-check-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, FileDown, Truck, Wrench, ClipboardCheck, Eye, Gauge, CarFront } from 'lucide-react'

const emptyVeh = { id: '', regNo: '', make: '', model: '', type: 'LDV', year: '', odometerKm: 0, status: 'ACTIVE', assignedTo: '', serviceIntervalKm: '', serviceIntervalMonths: '', lastServiceDate: '', lastServiceOdometerKm: '', notes: '' }
const emptyRec = { vehicleId: '', date: todayInput(), type: 'SERVICE', description: '', odometerKm: '', cost: '', workshop: '', performedBy: '', nextServiceDate: '', nextServiceKm: '' }

export function FleetView({ refreshKey }: { refreshKey: number }) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<typeof emptyVeh>(emptyVeh)
  const [detail, setDetail] = useState<FleetVehicle | null>(null)
  const [detailTab, setDetailTab] = useState('overview')
  const [recOpen, setRecOpen] = useState(false)
  const [rec, setRec] = useState<typeof emptyRec>({ ...emptyRec })
  const [inspOpen, setInspOpen] = useState(false)
  const [dcOpen, setDcOpen] = useState(false)
  const [odoOpen, setOdoOpen] = useState(false)
  const [odoForm, setOdoForm] = useState({ vehicleId: '', km: '' })
  const [deleteId, setDeleteId] = useState<{ id: string; entity?: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [v, t] = await Promise.all([apiGet<FleetVehicle[]>('/api/fleet'), apiGet<InspectionTemplate[]>('/api/qcp')])
      setVehicles(v); setTemplates(t)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const nextDueInfo = (v: FleetVehicle) => {
    const nextKm = v.lastServiceOdometerKm != null && v.serviceIntervalKm ? v.lastServiceOdometerKm + v.serviceIntervalKm : null
    const nextDate = v.lastServiceDate && v.serviceIntervalMonths
      ? (() => { const x = new Date(v.lastServiceDate); x.setMonth(x.getMonth() + v.serviceIntervalMonths!); return x.toISOString() })()
      : null
    const kmDue = nextKm != null && v.odometerKm >= nextKm
    const dateDue = nextDate ? new Date(nextDate) < new Date() : false
    const due = kmDue || dateDue
    const soon = nextDate ? new Date(nextDate).getTime() - Date.now() < 30 * 86400000 : nextKm != null && nextKm - v.odometerKm < 2000
    return { nextKm, nextDate, badge: due ? 'OVERDUE' : soon ? 'DUE SOON' : nextKm != null || nextDate ? 'OK' : 'NOT SET' }
  }

  const filtered = useMemo(() => vehicles, [vehicles])

  // vehicles with a service OVERDUE or DUE SOON (by km or months, whichever first)
  const reminderList = useMemo(
    () => vehicles
      .filter((v) => v.status !== 'RETIRED')
      .map((v) => ({ v, nd: nextDueInfo(v) }))
      .filter(({ nd }) => nd.badge === 'OVERDUE' || nd.badge === 'DUE SOON'),
    [vehicles],
  )

  const openOdo = (vehicleId: string, km: number) => { setOdoForm({ vehicleId, km: String(km) }); setOdoOpen(true) }

  const saveOdometer = async () => {
    const v = vehicles.find((x) => x.id === odoForm.vehicleId)
    const km = Number(odoForm.km)
    if (!v || !odoForm.km || Number.isNaN(km)) { toast.error('Choose a vehicle and enter the odometer reading'); return }
    try {
      await apiSend('/api/fleet', 'PUT', { ...v, odometerKm: Math.max(km, v.odometerKm) })
      toast.success(`Odometer updated to ${km.toLocaleString('en')} km`)
      setOdoOpen(false); load()
      if (detail) { const fresh = await apiGet<FleetVehicle[]>('/api/fleet'); setDetail(fresh.find((x) => x.id === detail.id) || null) }
    } catch (e) { toast.error(e.message) }
  }

  const save = async () => {
    if (!form.regNo.trim() || !form.make.trim()) { toast.error('Reg no and make are required'); return }
    try {
      if (form.id) await apiSend('/api/fleet', 'PUT', { ...form, lastServiceDate: form.lastServiceDate || null })
      else await apiSend('/api/fleet', 'POST', { ...form, lastServiceDate: form.lastServiceDate || null })
      toast.success('Vehicle saved'); setEditOpen(false); load()
    } catch (e) { toast.error(e.message) }
  }

  const saveRecord = async () => {
    if (!detail && !rec.vehicleId) return
    if (!rec.description.trim()) { toast.error('Description required'); return }
    try {
      await apiSend('/api/fleet', 'POST', {
        entity: 'record', vehicleId: detail?.id || rec.vehicleId, date: rec.date, type: rec.type,
        description: rec.description, odometerKm: rec.odometerKm ? Number(rec.odometerKm) : null,
        cost: rec.cost ? Number(rec.cost) : null, workshop: rec.workshop, performedBy: rec.performedBy,
        nextServiceDate: rec.nextServiceDate || null, nextServiceKm: rec.nextServiceKm ? Number(rec.nextServiceKm) : null,
      })
      toast.success('Record logged'); setRecOpen(false)
      load()
      if (detail) {
        const fresh = await apiGet<FleetVehicle[]>('/api/fleet')
        setDetail(fresh.find((x) => x.id === detail.id) || null)
      }
    } catch (e) { toast.error(e.message) }
  }

  const del = async () => {
    if (!deleteId) return
    try {
      await apiSend(`/api/fleet?id=${deleteId.id}${deleteId.entity ? `&entity=${deleteId.entity}` : ''}`, 'DELETE')
      setDeleteId(null); toast.success('Deleted'); load(); setDetail(null)
    } catch (e) { toast.error(e.message) }
  }

  const downloadInsp = (i: Inspection, v: FleetVehicle) => {
    downloadInspectionSheet({ ...i, vehicle: { regNo: v.regNo, make: v.make, model: v.model } } as never, 'Maintenance')
  }

  const totalCost = useMemo(() => vehicles.reduce((n, v) => n + (v.records || []).reduce((m, r) => m + (r.cost || 0), 0), 0), [vehicles])

  return (
    <div>
      <ViewTitle
        title="Fleet management"
        subtitle="Vehicles, services by km or months, repairs, inspections and running costs"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadFleetReport(vehicles as never, 'Maintenance')}><FileDown className="h-4 w-4 mr-1" /> Fleet report (PDF)</Button>
            <Button size="sm" onClick={() => setInspOpen(true)}><ClipboardCheck className="h-4 w-4 mr-1" /> Fleet inspection</Button>
            <Button size="sm" variant="outline" onClick={() => { setForm({ ...emptyVeh }); setEditOpen(true) }}><Plus className="h-4 w-4 mr-1" /> Add vehicle</Button>
          </div>
        }
      />

      {reminderList.length > 0 && (
        <Alert className="mb-4 border-amber-300/70 bg-amber-50/60">
          <Wrench className="h-4 w-4 text-amber-600" />
          <AlertTitle>Service reminders – {reminderList.length} vehicle(s) due or overdue</AlertTitle>
          <AlertDescription>
            <ul className="mt-1.5 space-y-1.5">
              {reminderList.map(({ v, nd }) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-amber-200/60 pb-1.5 last:border-0">
                  <Badge className={`rounded-full ${nd.badge === 'OVERDUE' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' : 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25'}`}>{nd.badge}</Badge>
                  <span>
                    <b>{v.regNo}</b> {v.make} {v.model} – next service {nd.nextKm ? `at ${nd.nextKm.toLocaleString('en')} km` : ''}{nd.nextDate ? `${nd.nextKm ? ' / ' : ''}${fmtDate(nd.nextDate)}` : ''}{!nd.nextKm && !nd.nextDate ? '(interval not set – add one in vehicle settings)' : ''}
                  </span>
                  <span className="ml-auto flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs bg-card" onClick={() => { setRec({ ...emptyRec, vehicleId: v.id, date: todayInput(), odometerKm: String(v.odometerKm), nextServiceKm: v.lastServiceOdometerKm != null && v.serviceIntervalKm ? String(v.lastServiceOdometerKm + v.serviceIntervalKm) : '' }); setRecOpen(true) }}><Wrench className="h-3.5 w-3.5 mr-1" /> Log service</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs bg-card" onClick={() => openOdo(v.id, v.odometerKm)}><Gauge className="h-3.5 w-3.5 mr-1" /> Update km</Button>
                  </span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg no</TableHead>
                <TableHead className="hidden sm:table-cell">Vehicle</TableHead>
                <TableHead className="hidden md:table-cell">Odometer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next service</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned to</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No vehicles yet.</TableCell></TableRow>
                  : filtered.map((v) => {
                    const nd = nextDueInfo(v)
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.regNo}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{v.make} {v.model}<span className="block text-xs text-muted-foreground">{v.type} {v.year || ''}</span></TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{v.odometerKm.toLocaleString('en')} km</TableCell>
                        <TableCell><StatusBadge status={v.status} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <DueBadge date={
                              nd.badge === 'NOT SET' ? null
                                : nd.badge === 'OVERDUE' ? new Date(Date.now() - 86400000).toISOString()
                                  : nd.badge === 'DUE SOON' ? new Date(Date.now() + 20 * 86400000).toISOString()
                                    : new Date(Date.now() + 60 * 86400000).toISOString()
                            } />
                            <span className="text-xs text-muted-foreground">{nd.nextKm ? `${nd.nextKm.toLocaleString('en')} km` : ''} {nd.nextDate ? fmtDate(nd.nextDate) : ''}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{v.assignedTo || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Open" onClick={() => { setDetail(v); setDetailTab('overview') }}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Update odometer" onClick={() => openOdo(v.id, v.odometerKm)}><Gauge className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setForm({ ...emptyVeh, ...v, year: String(v.year || ''), serviceIntervalKm: String(v.serviceIntervalKm || ''), serviceIntervalMonths: String(v.serviceIntervalMonths || ''), lastServiceDate: dateInput(v.lastServiceDate), lastServiceOdometerKm: String(v.lastServiceOdometerKm || '') } as typeof emptyVeh); setEditOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Delete" onClick={() => setDeleteId({ id: v.id })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mb-6">Total logged fleet cost: <b>N$ {totalCost.toLocaleString('en')}</b> across {vehicles.length} vehicle(s).</p>

      {/* Vehicle dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Reg no *</Label><Input value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} placeholder="e.g. N 12345 W" /></div>
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
              <div><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="LDV">LDV / bakkie</SelectItem><SelectItem value="TRUCK">Truck</SelectItem><SelectItem value="TRAILER">Trailer</SelectItem><SelectItem value="PLANT">Plant / machinery</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="IN_WORKSHOP">In workshop</SelectItem><SelectItem value="RETIRED">Retired</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Odometer (km)</Label><Input type="number" value={form.odometerKm} onChange={(e) => setForm({ ...form, odometerKm: Number(e.target.value) })} /></div>
              <div><Label>Assigned to</Label><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></div>
              <div><Label>Service interval (km)</Label><Input type="number" value={form.serviceIntervalKm} onChange={(e) => setForm({ ...form, serviceIntervalKm: e.target.value })} placeholder="e.g. 10000" /></div>
              <div><Label>Service interval (months)</Label><Input type="number" value={form.serviceIntervalMonths} onChange={(e) => setForm({ ...form, serviceIntervalMonths: e.target.value })} placeholder="e.g. 6" /></div>
              <div><Label>Last service date</Label><Input type="date" value={form.lastServiceDate} onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })} /></div>
              <div><Label>Service odometer (km)</Label><Input type="number" value={form.lastServiceOdometerKm} onChange={(e) => setForm({ ...form, lastServiceOdometerKm: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={save}>Save vehicle</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vehicle detail */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> {detail.regNo} – {detail.make} {detail.model} <StatusBadge status={detail.status} /></DialogTitle></DialogHeader>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="flex-wrap h-auto [&>[data-slot=tabs-trigger]]:h-auto [&>[data-slot=tabs-trigger]]:flex-none"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="records">Service & repairs ({detail.records.length})</TabsTrigger><TabsTrigger value="inspections">Inspections ({(detail.inspections || []).length})</TabsTrigger></TabsList>

                <TabsContent value="overview" className="mt-3 space-y-2 text-sm">
                  {(() => {
                    const lastDC = (detail.inspections || []).find((i) => i.type === 'DRIVER_CHECK')
                    return (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <p><span className="text-muted-foreground">Odometer:</span> {detail.odometerKm.toLocaleString('en')} km</p>
                          <p><span className="text-muted-foreground">Assigned to:</span> {detail.assignedTo || '-'}</p>
                          <p><span className="text-muted-foreground">Service interval:</span> {detail.serviceIntervalKm || '-'} km / {detail.serviceIntervalMonths || '-'} months</p>
                          <p><span className="text-muted-foreground">Last service:</span> {fmtDate(detail.lastServiceDate)} at {detail.lastServiceOdometerKm?.toLocaleString('en') || '-'} km</p>
                          <p className="sm:col-span-2"><span className="text-muted-foreground">Last driver check:</span> {lastDC ? <>{fmtDate(lastDC.date)} by {lastDC.inspectorName} <StatusBadge status={lastDC.status} /></> : 'none yet'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" onClick={() => { setRec({ ...emptyRec, vehicleId: detail.id, odometerKm: String(detail.odometerKm), nextServiceKm: detail.lastServiceOdometerKm != null && detail.serviceIntervalKm ? String(detail.lastServiceOdometerKm + detail.serviceIntervalKm) : '' }); setRecOpen(true) }}><Wrench className="h-4 w-4 mr-1" /> Log service / repair</Button>
                          <Button size="sm" variant="outline" onClick={() => setInspOpen(true)}><ClipboardCheck className="h-4 w-4 mr-1" /> Inspect (signed)</Button>
                          <Button size="sm" variant="outline" onClick={() => setDcOpen(true)}><CarFront className="h-4 w-4 mr-1" /> Driver check</Button>
                          <Button size="sm" variant="outline" onClick={() => openOdo(detail.id, detail.odometerKm)}><Gauge className="h-4 w-4 mr-1" /> Update km</Button>
                        </div>
                      </>
                    )
                  })()}
                  {detail.notes && <p className="text-muted-foreground">Notes: {detail.notes}</p>}
                </TabsContent>

                <TabsContent value="records" className="mt-3">
                  <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
                    {detail.records.length === 0 && <p className="p-3 text-sm text-muted-foreground">No records yet.</p>}
                    {detail.records.map((r: FleetRecord) => (
                      <div key={r.id} className="flex items-start justify-between gap-2 p-2.5 text-sm">
                        <div>
                          <p className="font-medium">{r.type.replaceAll('_', ' ')} – {r.description}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · {r.odometerKm ? `${r.odometerKm.toLocaleString('en')} km` : 'no odometer'} · {r.workshop || r.performedBy || '-'}{r.nextServiceKm ? ` · next at ${r.nextServiceKm.toLocaleString('en')} km` : ''}{r.nextServiceDate ? ` / ${fmtDate(r.nextServiceDate)}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.cost != null && <span className="text-xs">N$ {r.cost.toLocaleString('en')}</span>}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId({ id: r.id, entity: 'record' })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="inspections" className="mt-3">
                  <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
                    {(detail.inspections || []).length === 0 && <p className="p-3 text-sm text-muted-foreground">No inspections yet.</p>}
                    {(detail.inspections || []).map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                        <div><p className="font-medium">{i.type.replaceAll('_', ' ')}</p><p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.inspectorName} {i.signature ? '· signed' : ''}</p></div>
                        <div className="flex items-center gap-2"><StatusBadge status={i.status} /><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadInsp(i, detail)}><FileDown className="h-4 w-4" /></Button></div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record dialog */}
      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log service / repair</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {!detail && (
              <div>
                <Label>Vehicle</Label>
                <Select value={rec.vehicleId} onValueChange={(v) => setRec({ ...rec, vehicleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.regNo} – {v.make} {v.model}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={rec.type} onValueChange={(v) => setRec({ ...rec, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="SERVICE">Service</SelectItem><SelectItem value="REPAIR">Repair</SelectItem><SelectItem value="TYRES">Tyres</SelectItem><SelectItem value="INCIDENT">Incident / accident</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} /></div>
            </div>
            <div><Label>Description *</Label><Input value={rec.description} onChange={(e) => setRec({ ...rec, description: e.target.value })} placeholder="e.g. 100 000 km major service" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Odometer (km)</Label><Input type="number" value={rec.odometerKm} onChange={(e) => setRec({ ...rec, odometerKm: e.target.value })} /></div>
              <div><Label>Cost (N$)</Label><Input type="number" value={rec.cost} onChange={(e) => setRec({ ...rec, cost: e.target.value })} /></div>
              <div><Label>Workshop</Label><Input value={rec.workshop} onChange={(e) => setRec({ ...rec, workshop: e.target.value })} /></div>
              <div><Label>Done by</Label><Input value={rec.performedBy} onChange={(e) => setRec({ ...rec, performedBy: e.target.value })} /></div>
              <div><Label>Next service (km)</Label><Input type="number" value={rec.nextServiceKm} onChange={(e) => setRec({ ...rec, nextServiceKm: e.target.value })} /></div>
              <div><Label>Next service (date)</Label><Input type="date" value={rec.nextServiceDate} onChange={(e) => setRec({ ...rec, nextServiceDate: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRecOpen(false)}>Cancel</Button><Button onClick={saveRecord}>Save record</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fleet inspection (target vehicle chosen inside the form) */}
      <InspectionForm open={inspOpen} onOpenChange={setInspOpen} templates={templates} units={[]} vehicles={vehicles} fixedType="FLEET" fixedVehicleId={detail?.id} onSaved={() => { load(); if (detail) apiGet<FleetVehicle[]>('/api/fleet').then((f) => setDetail(f.find((x) => x.id === detail.id) || null)) }} />

      {/* Driver pre-trip check for the open vehicle */}
      <DriverCheckForm open={dcOpen} onOpenChange={setDcOpen} vehicles={vehicles} templates={templates.filter((t) => t.category === 'DRIVER_CHECK')} fixedVehicleId={detail?.id} onSaved={() => { load(); if (detail) apiGet<FleetVehicle[]>('/api/fleet').then((f) => setDetail(f.find((x) => x.id === detail.id) || null)) }} />

      {/* Quick odometer update */}
      <Dialog open={odoOpen} onOpenChange={setOdoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" /> Update odometer</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {!detail && (
              <div>
                <Label>Vehicle</Label>
                <Select value={odoForm.vehicleId} onValueChange={(v) => setOdoForm({ ...odoForm, vehicleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.regNo} – {v.make} {v.model}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Odometer reading (km)</Label>
              <Input type="number" inputMode="numeric" value={odoForm.km} onChange={(e) => setOdoForm({ ...odoForm, km: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">Service reminders are calculated from this reading. Drivers also update it automatically when they submit a driver check.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOdoOpen(false)}>Cancel</Button><Button onClick={saveOdometer}>Save reading</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
