'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend } from '@/lib/api'
import { downloadQcpPlan, downloadInspectionSheet } from '@/lib/pdf'
import type { InspectionTemplate, Inspection, Unit } from '@/lib/types'
import { ViewTitle } from '@/components/views/shared'
import { InspectionForm } from '@/components/inspection-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { FileDown, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'

export function QcpView({ refreshKey }: { refreshKey: number }) {
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [qcpRuns, setQcpRuns] = useState<Inspection[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<{ id?: string; name: string; stageOrder: number; description: string; itemsText: string } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [runOpen, setRunOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, i, u] = await Promise.all([
        apiGet<InspectionTemplate[]>('/api/qcp'),
        apiGet<Inspection[]>('/api/inspections'),
        apiGet<Unit[]>('/api/units'),
      ])
      setTemplates(t)
      setQcpRuns(i.filter((x) => x.type === 'QCP'))
      setUnits(u)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const stages = useMemo(() => templates.filter((t) => t.category === 'QCP_STAGE').sort((a, b) => a.stageOrder - b.stageOrder), [templates])

  const save = async () => {
    if (!edit) return
    const items = edit.itemsText.split('\n').map((x) => x.trim()).filter(Boolean)
    if (!edit.name.trim() || items.length === 0) { toast.error('Stage name and at least one checklist item are required'); return }
    try {
      if (edit.id) await apiSend('/api/qcp', 'PUT', { id: edit.id, name: edit.name, category: 'QCP_STAGE', stageOrder: edit.stageOrder, description: edit.description, items })
      else await apiSend('/api/qcp', 'POST', { name: edit.name, category: 'QCP_STAGE', stageOrder: edit.stageOrder, description: edit.description, items })
      toast.success('QCP stage saved')
      setEdit(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const del = async () => {
    if (!deleteId) return
    try { await apiSend(`/api/qcp?id=${deleteId}`, 'DELETE'); setDeleteId(null); toast.success('Stage deleted'); load() }
    catch (e) { toast.error(e.message) }
  }

  const downloadRun = (i: Inspection) => {
    const unit = units.find((u) => u.id === i.unitId)
    downloadInspectionSheet({ ...i, unit: unit ? { code: unit.code, description: unit.description } : i.unit } as never, 'Maintenance', unit)
  }

  return (
    <div>
      <ViewTitle
        title="Quality Control Plan (QCP)"
        subtitle="Stage-by-stage hold points for building a standard container or prefab unit"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadQcpPlan(templates as never, 'Maintenance')}><FileDown className="h-4 w-4 mr-1" /> QCP document (PDF)</Button>
            <Button size="sm" onClick={() => { setEdit({ name: '', stageOrder: stages.length + 1, description: '', itemsText: '' }); setFormOpen(true) }}><Plus className="h-4 w-4 mr-1" /> Add stage</Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Stages of the QCP</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="space-y-3">
              {stages.map((t) => {
                const items = JSON.parse(t.items || '[]') as { id: string; text: string }[]
                return (
                  <div key={t.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> {t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEdit({ id: t.id, name: t.name, stageOrder: t.stageOrder, description: t.description || '', itemsText: items.map((i) => i.text).join('\n') })}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-sm text-muted-foreground">
                      {items.map((i) => <li key={i.id} className="flex gap-1.5"><span className="text-emerald-600">✓</span>{i.text}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">QCP inspections carried out</h3>
        <Button size="sm" onClick={() => setRunOpen(true)}><Plus className="h-4 w-4 mr-1" /> Run QCP inspection</Button>
      </div>
      <Card>
        <CardContent className="px-2 sm:px-4 py-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Unit</TableHead><TableHead>Stage</TableHead><TableHead className="hidden sm:table-cell">Inspector</TableHead><TableHead>Result</TableHead><TableHead className="text-right">Sheet</TableHead></TableRow></TableHeader>
            <TableBody>
              {qcpRuns.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No QCP inspections yet – run one from here or from a unit&apos;s page.</TableCell></TableRow>
              ) : qcpRuns.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-sm">{new Date(i.date).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell className="text-sm font-medium">{i.unit?.code || '-'}</TableCell>
                  <TableCell className="text-sm">{i.template?.name || '-'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{i.inspectorName}</TableCell>
                  <TableCell className="text-sm">{i.status}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadRun(i)}><FileDown className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stage edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit QCP stage' : 'Add QCP stage'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3"><Label>Stage name *</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. QCP Stage 8 – Tiling" /></div>
                <div><Label>Order</Label><Input type="number" value={edit.stageOrder} onChange={(e) => setEdit({ ...edit, stageOrder: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Description</Label><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div>
                <Label>Checklist items (one per line) *</Label>
                <Textarea rows={8} value={edit.itemsText} onChange={(e) => setEdit({ ...edit, itemsText: e.target.value })} placeholder={'Frame straight and level\nWelds cleaned\nRust treated'} />
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={save}>Save stage</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Run QCP inspection */}
      <InspectionForm open={runOpen} onOpenChange={setRunOpen} templates={templates} units={units} vehicles={[]} fixedType="QCP" onSaved={() => load()} />

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete QCP stage?</AlertDialogTitle><AlertDialogDescription>Past QCP inspections keep their saved copies, but this stage will no longer be available.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
