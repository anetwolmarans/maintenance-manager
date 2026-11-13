'use client'

import { useEffect, useState } from 'react'
import { apiGet, fmtDate } from '@/lib/api'
import { downloadMaintenancePlan, downloadUnitStockTake, downloadUnitHistoryReport, downloadInspectionSheet, downloadStockReport, downloadFleetReport, downloadQcpPlan } from '@/lib/pdf'
import type { Unit, Inspection, StockData, FleetVehicle, InspectionTemplate, MaintenanceSchedule } from '@/lib/types'
import { ViewTitle } from '@/components/views/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { FileDown, ClipboardList, Boxes, Wrench, Package, Truck, ShieldCheck, History } from 'lucide-react'

export function ReportsView({ refreshKey }: { refreshKey: number }) {
  const [units, setUnits] = useState<Unit[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [stock, setStock] = useState<StockData | null>(null)
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [templates, setTemplates] = useState<InspectionTemplate[]>([])
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [unitPick, setUnitPick] = useState('')
  const [inspPick, setInspPick] = useState('')

  useEffect(() => {
    Promise.all([
      apiGet<Unit[]>('/api/units'),
      apiGet<Inspection[]>('/api/inspections'),
      apiGet<StockData>('/api/stock'),
      apiGet<FleetVehicle[]>('/api/fleet'),
      apiGet<InspectionTemplate[]>('/api/qcp'),
      apiGet<{ types: MaintenanceType[]; schedules: MaintenanceSchedule[] }>('/api/maintenance'),
    ]).then(([u, i, s, v, t, m]) => {
      setUnits(u); setInspections(i); setStock(s); setVehicles(v); setTemplates(t); setSchedules(m.schedules)
      if (u[0]) setUnitPick(u[0].id)
      if (i[0]) setInspPick(i[0].id)
    }).catch((e) => toast.error(e.message))
  }, [refreshKey])

  const dl = (fn: () => void, name: string) => { try { fn(); toast.success(`${name} downloaded`) } catch (e) { toast.error(String(e)) } }

  return (
    <div>
      <ViewTitle title="Reports & downloads" subtitle="Every inspection sheet and report is a downloadable PDF for printing or emailing" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-emerald-700" /> Inspection sheet</CardTitle><CardDescription>Signed checklist for any inspection (outgoing, return, QCP, fleet).</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Select value={inspPick} onValueChange={setInspPick}>
              <SelectTrigger><SelectValue placeholder="Choose inspection" /></SelectTrigger>
              <SelectContent>
                {inspections.map((i) => <SelectItem key={i.id} value={i.id}>{fmtDate(i.date)} – {i.type.replaceAll('_', ' ')} – {i.unit?.code || i.vehicle?.regNo}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={!inspPick} onClick={() => {
              const i = inspections.find((x) => x.id === inspPick); if (!i) return
              const unit = units.find((u) => u.id === i.unitId)
              dl(() => downloadInspectionSheet({ ...i, unit: unit ? { code: unit.code, description: unit.description } : i.unit } as never, 'Maintenance', unit), 'Inspection sheet')
            }}><FileDown className="h-4 w-4 mr-1" /> Download inspection sheet</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-emerald-700" /> Unit history report</CardTitle><CardDescription>Build team, contents, inspections, sign-outs, maintenance log.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Select value={unitPick} onValueChange={setUnitPick}>
              <SelectTrigger><SelectValue placeholder="Choose unit" /></SelectTrigger>
              <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.code} – {u.description || u.type}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="w-full" disabled={!unitPick} onClick={() => {
              const u = units.find((x) => x.id === unitPick); if (!u) return
              dl(() => downloadUnitHistoryReport(u as never, 'Maintenance'), 'Unit history report')
            }}><FileDown className="h-4 w-4 mr-1" /> Download history report</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-emerald-700" /> Maintenance plan</CardTitle><CardDescription>All schedules, intervals, next due dates and the maintenance log.</CardDescription></CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => dl(() => downloadMaintenancePlan(schedules as never, 'Maintenance'), 'Maintenance plan')}><FileDown className="h-4 w-4 mr-1" /> Download plan (PDF)</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4 text-emerald-700" /> Unit stock take</CardTitle><CardDescription>How many units you have and what is inside each one.</CardDescription></CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => dl(() => downloadUnitStockTake(units as never, 'Maintenance'), 'Unit stock take')}><FileDown className="h-4 w-4 mr-1" /> Download stock take (PDF)</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-emerald-700" /> Stock & reorder report</CardTitle><CardDescription>On-hand levels, reorder list with supplier lead times, container BOM.</CardDescription></CardHeader>
          <CardContent>
            <Button className="w-full" disabled={!stock} onClick={() => stock && dl(() => downloadStockReport(stock as never, 'Maintenance'), 'Stock report')}><FileDown className="h-4 w-4 mr-1" /> Download stock report</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-700" /> Fleet report</CardTitle><CardDescription>Vehicles, service history, repairs and inspections.</CardDescription></CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => dl(() => downloadFleetReport(vehicles as never, 'Maintenance'), 'Fleet report')}><FileDown className="h-4 w-4 mr-1" /> Download fleet report</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Quality Control Plan</CardTitle><CardDescription>The QCP document with all stages and hold points.</CardDescription></CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => dl(() => downloadQcpPlan(templates as never, 'Maintenance'), 'QCP document')}><FileDown className="h-4 w-4 mr-1" /> Download QCP (PDF)</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
