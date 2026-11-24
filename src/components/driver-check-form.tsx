'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SignaturePad } from '@/components/signature-pad'
import { apiSend, todayInput } from '@/lib/api'
import type { InspectionItem, InspectionTemplate, FleetVehicle } from '@/lib/types'
import { toast } from 'sonner'
import { CarFront, KeyRound } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  vehicles: FleetVehicle[]
  templates: InspectionTemplate[]
  fixedVehicleId?: string
  onSaved: () => void
}

const RESULT_BTN = (active: boolean, r: string) =>
  `h-11 min-w-14 rounded-lg border text-sm font-semibold transition-colors ${active
    ? r === 'PASS' ? 'bg-emerald-600 text-white border-emerald-600' : r === 'FAIL' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-600 text-white border-slate-600'
    : 'bg-white hover:bg-slate-100'}`

/** Simple pre-trip check a driver completes on a phone/tablet: walk-around list, odometer, signature. */
export function DriverCheckForm({ open, onOpenChange, vehicles, templates, fixedVehicleId, onSaved }: Props) {
  const [vehicleId, setVehicleId] = useState('')
  const [driver, setDriver] = useState('')
  const [odometer, setOdometer] = useState('')
  const [date, setDate] = useState(todayInput())
  const [items, setItems] = useState<InspectionItem[]>([])
  const [loadedTpl, setLoadedTpl] = useState('')
  const [findings, setFindings] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const tpl = templates.find((t) => t.category === 'DRIVER_CHECK' && t.active) || null

  // remember the driver's name between checks (per device)
  useEffect(() => {
    if (open) {
      setDriver(window.localStorage.getItem('driver_name') || '')
      if (fixedVehicleId) setVehicleId(fixedVehicleId)
      const key = tpl?.id || ''
      if (key && key !== loadedTpl) {
        setLoadedTpl(key)
        try {
          setItems((JSON.parse(tpl!.items) as { id: string; text: string }[]).map((x) => ({ ...x, result: undefined, notes: '' })))
        } catch { setItems([]) }
      }
    } else if (loadedTpl) setLoadedTpl('')
  }, [open, tpl, loadedTpl, fixedVehicleId])

  const setResult = (id: string, result: 'PASS' | 'FAIL' | 'N/A') => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, result } : x)))
  const setNotes = (id: string, notes: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, notes } : x)))
  const setValue = (id: string, value: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, value } : x)))

  const failCount = items.filter((x) => x.result === 'FAIL').length
  const marked = items.filter((x) => (x.type === 'date' ? x.value : x.result)).length
  const vehicle = vehicles.find((v) => v.id === vehicleId)

  const save = async () => {
    if (!driver.trim()) { toast.error('Driver name is required'); return }
    if (!vehicleId) { toast.error('Choose your vehicle'); return }
    if (items.some((x) => (x.type === 'date' ? !x.value : !x.result))) { toast.error('Answer every item – PASS, FAIL, N/A or the expiry date'); return }
    if (!signature) { toast.error('Signature required – sign on the pad'); return }
    setSaving(true)
    try {
      window.localStorage.setItem('driver_name', driver.trim())
      const status = failCount > 0 ? 'FAIL' : 'PASS'
      await apiSend('/api/inspections', 'POST', {
        type: 'DRIVER_CHECK', vehicleId, date,
        inspectorName: driver.trim(),
        odometerKm: odometer ? Number(odometer) : undefined,
        templateId: tpl?.id || null,
        signature, status, findings,
        items,
      })
      toast.success(failCount > 0 ? `Check saved – ${failCount} defect(s) flagged for the office` : 'Check saved – vehicle is good to go')
      onOpenChange(false)
      onSaved()
      setOdometer(''); setFindings(''); setSignature(null)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CarFront className="h-5 w-5 text-teal-700" /> Driver pre-trip check</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Your vehicle *</Label>
            <Select value={vehicleId} onValueChange={(v) => { setVehicleId(v); setOdometer('') }}>
              <SelectTrigger className="h-11 [&>span]:block [&>span]:truncate"><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
              <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.regNo} – {v.make} {v.model}{v.assignedTo ? ` (${v.assignedTo})` : ''}</SelectItem>)}</SelectContent>
            </Select>
            {vehicle && <p className="mt-1 text-xs text-muted-foreground">Odometer last recorded: {vehicle.odometerKm.toLocaleString('en')} km</p>}
          </div>
          <div>
            <Label>Driver name *</Label>
            <Input className="h-11" value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Your full name" />
          </div>
          <div>
            <Label>Odometer now (km)</Label>
            <Input className="h-11" type="number" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder={vehicle ? String(vehicle.odometerKm) : 'Current km'} />
            <p className="mt-1 text-xs text-muted-foreground">Keeps service reminders accurate (next service is calculated from this).</p>
          </div>
          <div>
            <Label>Date</Label>
            <Input className="h-11" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-1">
          <Label className="mb-1.5 block">Walk-around checklist ({marked}/{items.length} answered)</Label>
          <div className="rounded-lg border divide-y max-h-[46vh] overflow-y-auto">
            {items.map((x, n) => (
              <div key={x.id} className="p-2.5">
                {x.type === 'date' ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm flex-1">{n + 1}. {x.text}</p>
                    <Input type="date" className="h-9 w-36 shrink-0 text-sm" value={x.value || ''} onChange={(e) => setValue(x.id, e.target.value)} />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm flex-1">{n + 1}. {x.text}</p>
                      <div className="flex gap-1 shrink-0">
                        {(['PASS', 'FAIL', 'N/A'] as const).map((r) => (
                          <button key={r} type="button" onClick={() => setResult(x.id, r)} className={RESULT_BTN(x.result === r, r)}>{r}</button>
                        ))}
                      </div>
                    </div>
                    {x.result && x.result !== 'PASS' && (
                      <Input className="mt-2 h-9 text-sm" placeholder={x.result === 'FAIL' ? 'What is wrong? (needed for the workshop)' : 'Note (optional)'} value={x.notes || ''} onChange={(e) => setNotes(x.id, e.target.value)} />
                    )}
                  </>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="p-3 text-sm text-muted-foreground">No checklist template yet – ask the office to set one up.</p>}
          </div>
          {failCount > 0 && (
            <p className="mt-2 text-sm font-medium text-red-600">{failCount} defect(s) marked FAIL – the office will see them in the reminder email.</p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">Anything else to report?</Label>
          <Textarea rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Warning lights, noises, damage noticed on the road…" />
        </div>

        <div>
          <Label className="mb-1.5 block flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Sign to confirm the check was done (required)</Label>
          <SignaturePad value={signature} onChange={setSignature} width={560} height={150} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Submit check'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
