'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SignaturePad } from '@/components/signature-pad'
import { apiSend, todayInput } from '@/lib/api'
import type { InspectionItem, InspectionTemplate, Unit, FleetVehicle } from '@/lib/types'
import { toast } from 'sonner'
import { ScrollText } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: InspectionTemplate[]
  units: Unit[]
  vehicles: FleetVehicle[]
  fixedType?: 'OUTGOING' | 'RETURN' | 'QCP' | 'FLEET'
  fixedUnitId?: string
  fixedVehicleId?: string
  onSaved: () => void
}

const TYPE_LABEL: Record<string, string> = {
  OUTGOING: 'Outgoing (dispatch) inspection – sign unit out to client',
  RETURN: 'Return inspection – receive unit back from client',
  QCP: 'Quality Control (QCP) inspection',
  FLEET: 'Fleet inspection',
}

export function InspectionForm({ open, onOpenChange, templates, units, vehicles, fixedType, fixedUnitId, fixedVehicleId, onSaved }: Props) {
  const [type, setType] = useState<string>(fixedType || 'OUTGOING')
  const [unitId, setUnitId] = useState<string>(fixedUnitId || '')
  const [vehicleId, setVehicleId] = useState<string>(fixedVehicleId || '')
  const [templateId, setTemplateId] = useState<string>('')
  const [date, setDate] = useState(todayInput())
  const [inspector, setInspector] = useState('')
  const [client, setClient] = useState('')
  const [odometer, setOdometer] = useState('')
  const [findings, setFindings] = useState('')
  const [status, setStatus] = useState('PASS')
  const [signature, setSignature] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<InspectionItem[]>([])
  const [loadedTemplate, setLoadedTemplate] = useState('')

  const activeType = fixedType || type
  const unit = units.find((u) => u.id === unitId)
  const vehicle = vehicles.find((v) => v.id === vehicleId)

  const templateCategory = activeType === 'QCP' ? 'QCP_STAGE' : activeType
  const availableTemplates = useMemo(
    () => templates.filter((t) => t.category === templateCategory),
    [templates, templateCategory],
  )
  const chosenTemplate = availableTemplates.find((t) => t.id === templateId) || availableTemplates[0]

  // load checklist whenever the chosen template changes
  const tplKey = chosenTemplate?.id || ''
  if (open && tplKey && tplKey !== loadedTemplate) {
    setLoadedTemplate(tplKey)
    setTemplateId(tplKey)
    try {
      setItems((JSON.parse(chosenTemplate!.items) as { id: string; text: string }[]).map((x) => ({ ...x, result: undefined, notes: '' })))
    } catch { setItems([]) }
    setStatus('PASS')
  }
  if (!open && loadedTemplate) setLoadedTemplate('')
  // keep fixed unit / vehicle / type in sync when the dialog (re)opens
  if (open && fixedUnitId && unitId !== fixedUnitId) setUnitId(fixedUnitId)
  if (open && fixedVehicleId && vehicleId !== fixedVehicleId) setVehicleId(fixedVehicleId)
  if (open && fixedType && type !== fixedType) setType(fixedType)

  const setResult = (id: string, result: 'PASS' | 'FAIL' | 'N/A') => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, result } : x)))
    if (result === 'FAIL') setStatus('FAIL')
  }
  const setNotes = (id: string, notes: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, notes } : x)))

  const save = async () => {
    if (!inspector.trim()) { toast.error('Inspector name is required'); return }
    if (activeType === 'FLEET' && !vehicleId) { toast.error('Choose a vehicle'); return }
    if (activeType !== 'FLEET' && !unitId) { toast.error('Choose a unit'); return }
    if (items.some((x) => !x.result)) { toast.error('Mark every checklist item PASS, FAIL or N/A'); return }
    if (!signature) { toast.error('Signature required – sign on the pad'); return }
    setSaving(true)
    try {
      await apiSend('/api/inspections', 'POST', {
        unitId: activeType === 'FLEET' ? null : unitId,
        vehicleId: activeType === 'FLEET' ? vehicleId : null,
        templateId: chosenTemplate?.id || null,
        templateName: chosenTemplate?.name,
        type: activeType, date,
        inspectorName: inspector, clientName: client || (activeType === 'RETURN' ? unit?.client : null),
        signature, status,
        findings,
        odometerKm: odometer ? Number(odometer) : undefined,
        items,
      })
      toast.success('Inspection saved and signed')
      onOpenChange(false)
      onSaved()
      // reset partial state
      setInspector(''); setClient(''); setFindings(''); setSignature(null); setOdometer('')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const failCount = items.filter((x) => x.result === 'FAIL').length

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v) }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5" /> {TYPE_LABEL[activeType]}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {!fixedType && (
            <div>
              <Label>Inspection type</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setLoadedTemplate('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTGOING">Outgoing (sign out to client)</SelectItem>
                  <SelectItem value="RETURN">Return (receive from client)</SelectItem>
                  <SelectItem value="QCP">Quality Control (QCP)</SelectItem>
                  <SelectItem value="FLEET">Fleet inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {activeType === 'FLEET' ? (
            <div>
              <Label>Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
                <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.regNo} – {v.make} {v.model}</SelectItem>)}</SelectContent>
              </Select>
              <div className="mt-2">
                <Label>Odometer (km)</Label>
                <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="Current km" />
              </div>
            </div>
          ) : (
            <div>
              <Label>Unit</Label>
              <Select value={unitId} onValueChange={setUnitId} disabled={Boolean(fixedUnitId)}>
                <SelectTrigger><SelectValue placeholder="Choose unit" /></SelectTrigger>
                <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.code} – {u.description || u.type}</SelectItem>)}</SelectContent>
              </Select>
              {unit && (activeType === 'OUTGOING' || activeType === 'RETURN') && (
                <div className="mt-2">
                  <Label>{activeType === 'OUTGOING' ? 'Sign out to client' : 'Received from client'}</Label>
                  <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" defaultValue={activeType === 'RETURN' ? (unit.client || '') : undefined} key={unit.id + activeType} />
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Checklist</Label>
            <Select value={chosenTemplate?.id || ''} onValueChange={(v) => { setTemplateId(v); setLoadedTemplate('') }}>
              <SelectTrigger><SelectValue placeholder="Choose checklist" /></SelectTrigger>
              <SelectContent>{availableTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Inspector (name)</Label>
            <Input value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label>Overall result</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">PASS</SelectItem>
                <SelectItem value="FAIL">FAIL</SelectItem>
                <SelectItem value="CONDITIONAL">CONDITIONAL (minor defects)</SelectItem>
              </SelectContent>
            </Select>
            {failCount > 0 && <p className="text-xs text-red-600 mt-1">{failCount} item(s) marked FAIL</p>}
          </div>
        </div>

        <div className="mt-2">
          <Label className="mb-1.5 block">Checklist ({items.filter((x) => x.result).length}/{items.length} marked)</Label>
          <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
            {items.map((x, n) => (
              <div key={x.id} className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm flex-1">{n + 1}. {x.text}</p>
                  <div className="flex gap-1 shrink-0">
                    {(['PASS', 'FAIL', 'N/A'] as const).map((r) => (
                      <button key={r} type="button" onClick={() => setResult(x.id, r)}
                        className={`h-8 min-w-11 rounded-md border px-2 text-xs font-medium transition-colors ${x.result === r ? (r === 'PASS' ? 'bg-emerald-600 text-white border-emerald-600' : r === 'FAIL' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white hover:bg-slate-100'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {x.result && <Input className="mt-2 h-8 text-sm" placeholder="Notes (optional)" value={x.notes || ''} onChange={(e) => setNotes(x.id, e.target.value)} />}
              </div>
            ))}
            {items.length === 0 && <p className="p-3 text-sm text-muted-foreground">Choose a checklist to load its items.</p>}
          </div>
        </div>

        <div className="mt-2">
          <Label className="mb-1.5 block">Findings / remarks</Label>
          <Textarea rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Damages, defects, keys issued, meter readings…" />
        </div>

        <div className="mt-3">
          <Label className="mb-1.5 block">Signature (required)</Label>
          <SignaturePad value={signature} onChange={setSignature} width={560} height={170} />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save inspection'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
