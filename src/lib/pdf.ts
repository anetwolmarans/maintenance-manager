'use client'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, fmtDateTime, dueStatus } from '@/lib/api'

const NAVY: [number, number, number] = [23, 42, 58]
const ACCENT: [number, number, number] = [0, 123, 94]
const LIGHT: [number, number, number] = [241, 245, 248]

type Row = Record<string, unknown>

function header(doc: jsPDF, company: string, title: string, subtitle?: string) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, w, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text(company || 'Maintenance System', 14, 9)
  doc.setFontSize(10)
  doc.text(title, 14, 16)
  doc.setTextColor(90, 90, 90)
  doc.setFontSize(8)
  doc.text(`Generated ${fmtDateTime(new Date())}  |  Windhoek, Namibia`, w - 14, 16, { align: 'right' })
  if (subtitle) {
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(9)
    doc.text(subtitle, 14, 28)
    return 34
  }
  return 28
}

function footer(doc: jsPDF) {
  const count = doc.getNumberOfPages()
  for (let i = 1; i <= count; i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(7.5)
    doc.setTextColor(130, 130, 130)
    doc.text(`Page ${i} of ${count}`, w / 2, h - 6, { align: 'center' })
  }
}

function table(doc: jsPDF, head: string[], body: Row[][], startY: number, extra: Record<string, unknown> = {}): number {
  autoTable(doc, {
    head: [head],
    body: body.map((r) => Object.values(r)),
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    alternateRowStyles: { fillColor: LIGHT },
    margin: { left: 14, right: 14 },
    ...extra,
  } as Record<string, unknown>)
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

export interface InspectionPdfData {
  id: string
  type: string
  date: string
  inspectorName: string
  clientName?: string | null
  signature?: string | null
  status: string
  findings?: string | null
  items: string
  unit?: { code?: string; description?: string; client?: string } | null
  vehicle?: { regNo?: string; make?: string; model?: string } | null
  template?: { name?: string } | null
}

export function downloadInspectionSheet(insp: InspectionPdfData, company: string, unitFull?: { builder?: string; electrician?: string; plumber?: string; painter?: string }) {
  const doc = new jsPDF()
  const typeLabel: Record<string, string> = { OUTGOING: 'Outgoing (dispatch) inspection sheet', RETURN: 'Return (receiving) inspection sheet', QCP: 'Quality Control inspection sheet', FLEET: 'Fleet inspection sheet' }
  let y = header(doc, company, typeLabel[insp.type] || 'Inspection sheet', insp.template?.name || undefined)

  const subject = insp.unit ? `${insp.unit.code ?? ''} ${insp.unit.description ?? ''}`.trim() : insp.vehicle ? `${insp.vehicle.regNo} ${insp.vehicle.make} ${insp.vehicle.model}` : '-'
  y = table(doc, ['Field', 'Detail'], [
    { a: insp.unit ? 'Unit' : 'Vehicle', b: subject },
    { a: 'Date', b: fmtDate(insp.date) },
    { a: insp.type === 'OUTGOING' ? 'Signed out to' : insp.type === 'RETURN' ? 'Received from' : 'Client / reference', b: insp.clientName || '-' },
    { a: 'Inspector', b: insp.inspectorName },
    { a: 'Overall result', b: insp.status },
    ...(unitFull && insp.unit ? [
      { a: 'Builder', b: unitFull.builder || '-' },
      { a: 'Electrician', b: unitFull.electrician || '-' },
      { a: 'Plumber', b: unitFull.plumber || '-' },
      { a: 'Painter', b: unitFull.painter || '-' },
    ] : []),
  ] as Row[][], y)

  const items = JSON.parse(insp.items || '[]') as { text: string; result: string; notes?: string }[]
  y = table(doc, ['#', 'Check item', 'Result', 'Notes'],
    items.map((it, i) => ({ n: String(i + 1), t: it.text, r: it.result || '-', nt: it.notes || '' })) as Row[][],
    y + 4,
    { didParseCell: (d: { column: { index: number }; cell: { styles: Record<string, unknown> } }) => {
      if (d.column.index === 2) {
        const v = String(d.cell.raw ?? '')
        if (v === 'FAIL') d.cell.styles.textColor = [180, 30, 30]
        else if (v === 'PASS') d.cell.styles.textColor = [0, 123, 94]
      }
    } })

  if (insp.findings) {
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text('Findings / notes:', 14, y + 8)
    doc.setFontSize(8)
    doc.text(doc.splitTextToSize(insp.findings, 180), 14, y + 13)
    y += 13 + doc.splitTextToSize(insp.findings, 180).length * 4
  }

  if (insp.signature) {
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text('Signature (signed on tablet):', 14, y)
    try { doc.addImage(insp.signature, 'PNG', 14, y + 3, 70, 30) } catch { /* bad image */ }
    doc.setDrawColor(150)
    doc.rect(14, y + 3, 70, 30)
    doc.setFontSize(8)
    doc.text(`${insp.inspectorName}  –  ${fmtDate(insp.date)}`, 14, y + 38)
  }

  footer(doc)
  doc.save(`inspection_${insp.type}_${subject.replace(/\s+/g, '_') || insp.id.slice(0, 6)}_${fmtDate(insp.date).replace(/\s/g, '')}.pdf`)
}

export function downloadUnitHistoryReport(unit: Row, company: string) {
  const doc = new jsPDF()
  let y = header(doc, company, `Unit history report – ${unit.code}`, String(unit.description || ''))
  y = table(doc, ['Field', 'Detail'], [
    { a: 'Code / serial', b: `${unit.code}${unit.serial ? ` / ${unit.serial}` : ''}` },
    { a: 'Type / size', b: `${unit.type} ${unit.size || ''}` },
    { a: 'Status', b: unit.status },
    { a: 'Client / site', b: `${unit.client || '-'} / ${unit.site || '-'}` },
    { a: 'Built on', b: fmtDate(unit.buildDate as string) },
  ] as Row[][], y)

  doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Build team (who built what)', 14, y + 8)
  y = table(doc, ['Trade', 'Person'], [
    { a: 'Builder / fabricator', b: unit.builder || '-' },
    { a: 'Electrician', b: unit.electrician || '-' },
    { a: 'Plumber', b: unit.plumber || '-' },
    { a: 'Painter', b: unit.painter || '-' },
    { a: 'Glazier', b: unit.glazier || '-' },
    { a: 'Roofer', b: unit.roofer || '-' },
    { a: 'Other', b: unit.otherTrade || '-' },
  ] as Row[][], y + 10)

  const equipment = (unit.equipment || []) as Row[]
  if (equipment.length) {
    doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text('Unit contents (stock take)', 14, y + 8)
    y = table(doc, ['Item', 'Kind', 'Serial', 'Qty', 'Installed'],
      equipment.map((e) => ({ n: String(e.name), k: String(e.kind), s: String(e.serial || '-'), q: String(e.qty), i: fmtDate(e.installedDate as string) })) as Row[][],
      y + 10)
  }

  const inspections = (unit.inspections || []) as Row[]
  doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Inspections & sign-outs', 14, y + 8)
  y = table(doc, ['Date', 'Type', 'Inspector', 'Client', 'Result'],
    inspections.map((i) => ({ d: fmtDate(i.date as string), t: String(i.type), by: String(i.inspectorName), c: String(i.clientName || '-'), r: String(i.status) })) as Row[][],
    y + 10)

  const maintenance = ([] as Row[]).concat(...((unit.schedules || []) as Row[]).map((s) => ((s.records || []) as Row[]).map((r) => ({ ...r, schedule: s.name }))))
  if (maintenance.length) {
    doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text('Maintenance history', 14, y + 8)
    y = table(doc, ['Date', 'Task', 'Done by', 'Cost (N$)', 'Findings'],
      maintenance.sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime()).slice(0, 25).map((m) => ({ d: fmtDate(m.date as string), t: String(m.schedule), p: String(m.performedBy || '-'), c: m.cost != null ? String(m.cost) : '-', f: String(m.findings || '') })) as Row[][],
      y + 10)
  }

  const history = (unit.history || []) as Row[]
  doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Full history timeline', 14, y + 8)
  y = table(doc, ['Date', 'Event', 'Detail', 'Person'],
    history.map((h) => ({ d: fmtDate(h.date as string), t: String(h.type), x: String(h.description), p: String(h.person || '') })) as Row[][],
    y + 10)

  footer(doc)
  doc.save(`unit_history_${unit.code}.pdf`)
}

export function downloadMaintenancePlan(schedules: Row[], company: string) {
  const doc = new jsPDF()
  let y = header(doc, company, 'Preventative maintenance plan', 'All recurring schedules with intervals and next due dates')
  y = table(doc, ['Task', 'Category', 'Unit', 'Interval', 'Last done', 'Next due', 'Status', 'Responsible'],
    schedules.map((s) => {
      const st = dueStatus(s.nextDue as string)
      return { n: String(s.name), c: String((s.type as Row)?.name || ''), u: String((s.unit as Row)?.code || s.scope || ''), i: `${s.intervalMonths} mo`, l: fmtDate(s.lastDone as string), x: fmtDate(s.nextDue as string), st, r: String(s.responsible || '-') }
    }) as Row[][],
    y,
    { didParseCell: (d: { column: { index: number }; cell: { styles: Record<string, unknown>; raw?: unknown } }) => {
      if (d.column.index === 6) {
        const v = String(d.cell.raw ?? '')
        if (v === 'OVERDUE') d.cell.styles.textColor = [180, 30, 30]
        else if (v === 'DUE SOON') d.cell.styles.textColor = [170, 110, 0]
        else if (v === 'OK') d.cell.styles.textColor = ACCENT
      }
    } })

  const records = ([] as Row[]).concat(...schedules.map((s) => ((s.records || []) as Row[]).map((r) => ({ ...r, task: s.name }))))
    .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())
  if (records.length) {
    doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text('Maintenance log (recent)', 14, y + 8)
    y = table(doc, ['Date', 'Task', 'Done by', 'Cost (N$)', 'Findings'],
      records.slice(0, 40).map((m) => ({ d: fmtDate(m.date as string), t: String(m.task), p: String(m.performedBy || '-'), c: m.cost != null ? String(m.cost) : '-', f: String(m.findings || '') })) as Row[][],
      y + 10)
  }
  footer(doc)
  doc.save('maintenance_plan.pdf')
}

export function downloadStockReport(data: Row, company: string) {
  const doc = new jsPDF()
  let y = header(doc, company, 'Stock report & reorder list', 'On-hand quantities, reorder points and supplier lead times')
  const items = (data.items || []) as Row[]
  const reorder = items.filter((i) => Number(i.qtyOnHand) <= Number(i.reorderPoint))
  y = table(doc, ['Item', 'SKU', 'Category', 'On hand', 'Reorder at', 'Order qty', 'Unit cost (N$)', 'Supplier', 'Lead (days)', 'Status'],
    items.map((i) => {
      const low = Number(i.qtyOnHand) <= Number(i.reorderPoint)
      return { n: String(i.name), s: String(i.sku || '-'), c: String(i.category), q: `${i.qtyOnHand} ${i.unit}`, r: String(i.reorderPoint), o: String(i.reorderQty), u: String(i.unitCost), sp: String((i.supplier as Row)?.name || '-'), l: String((i.supplier as Row)?.leadTimeDays ?? '-'), st: low ? 'ORDER NOW' : 'OK' }
    }) as Row[][],
    y,
    { didParseCell: (d: { column: { index: number }; cell: { styles: Record<string, unknown>; raw?: unknown } }) => {
      if (d.column.index === 9 && String(d.cell.raw ?? '') === 'ORDER NOW') d.cell.styles.textColor = [180, 30, 30]
    } })

  if (reorder.length) {
    doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text('Reorder list (considering supplier lead times)', 14, y + 8)
    const rows = reorder.map((i) => {
      const sup = i.supplier as Row | undefined
      const lead = Number(sup?.leadTimeDays ?? 7)
      const arrive = new Date(Date.now() + lead * 24 * 3600 * 1000)
      return { n: String(i.name), q: `${i.reorderQty} ${i.unit}`, s: String(sup?.name || '- set supplier -'), l: `${lead} days`, a: arrive.toLocaleDateString('en-GB'), est: `N$ ${(Number(i.reorderQty) * Number(i.unitCost)).toLocaleString('en')}` }
    })
    const total = reorder.reduce((n, i) => n + Number(i.reorderQty) * Number(i.unitCost), 0)
    y = table(doc, ['Item', 'Order qty', 'Supplier', 'Lead time', 'Expected arrival', 'Estimated cost'], rows as Row[][], y + 10)
    doc.setFontSize(9); doc.setTextColor(30)
    doc.text(`Estimated reorder total: N$ ${total.toLocaleString('en')}`, 14, y + 6)
    y += 10
  }

  const bom = (data.bom || []) as Row[]
  doc.addPage()
  y = header(doc, company, 'Bill of materials – standard container build', `Parts needed per standard container conversion. With current stock you can build ${data.containersBuildable} container(s).`)
  y = table(doc, ['Item', 'Qty per container', 'On hand', 'Containers coverable', 'Unit cost (N$)', 'Line total (N$)'],
    bom.map((b) => {
      const it = b.stockItem as Row
      return { n: String(it.name), q: `${b.qtyPerUnit} ${it.unit}`, o: String(it.qtyOnHand), c: String(b.canBuild), u: String(it.unitCost), t: (Number(b.qtyPerUnit) * Number(it.unitCost)).toLocaleString('en') }
    }) as Row[][],
    y)
  footer(doc)
  doc.save('stock_report.pdf')
}

export function downloadFleetReport(vehicles: Row[], company: string) {
  const doc = new jsPDF()
  let y = header(doc, company, 'Fleet report', 'Vehicles, services, repairs and inspections')
  y = table(doc, ['Reg no', 'Vehicle', 'Year', 'Odometer (km)', 'Status', 'Service interval', 'Last service', 'Next due'],
    vehicles.map((v) => {
      const last = v.lastServiceDate as string | null
      const nextKm = v.lastServiceOdometerKm != null && v.serviceIntervalKm ? Number(v.lastServiceOdometerKm) + Number(v.serviceIntervalKm) : null
      return { r: String(v.regNo), m: `${v.make} ${v.model}`, y: String(v.year || '-'), o: Number(v.odometerKm).toLocaleString('en'), s: String(v.status), i: `${v.serviceIntervalKm || '-'} km / ${v.serviceIntervalMonths || '-'} mo`, l: fmtDate(last), n: nextKm ? `${nextKm.toLocaleString('en')} km` : '-' }
    }) as Row[][],
    y)

  const records = ([] as Row[]).concat(...vehicles.map((v) => ((v.records || []) as Row[]).map((r) => ({ ...r, veh: `${v.regNo} ${v.make}` }))))
    .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())
  doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text('Service & repair log', 14, y + 8)
  y = table(doc, ['Date', 'Vehicle', 'Type', 'Description', 'Odometer', 'Cost (N$)', 'Workshop'],
    records.map((r) => ({ d: fmtDate(r.date as string), v: String(r.veh), t: String(r.type), x: String(r.description), o: r.odometerKm != null ? Number(r.odometerKm).toLocaleString('en') : '-', c: r.cost != null ? String(r.cost) : '-', w: String(r.workshop || '-') })) as Row[][],
    y + 10)

  const insp = ([] as Row[]).concat(...vehicles.map((v) => ((v.inspections || []) as Row[]).map((r) => ({ ...r, veh: `${v.regNo} ${v.make}` }))))
  if (insp.length) {
    doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text('Fleet inspections', 14, y + 8)
    y = table(doc, ['Date', 'Vehicle', 'Inspector', 'Result'],
      insp.map((i) => ({ d: fmtDate(i.date as string), v: String(i.veh), by: String(i.inspectorName), r: String(i.status) })) as Row[][],
      y + 10)
  }
  footer(doc)
  doc.save('fleet_report.pdf')
}

export function downloadUnitStockTake(units: Row[], company: string) {
  const doc = new jsPDF()
  let y = header(doc, company, 'Unit stock take', `Register of all ${units.length} unit(s) and what is in each`)
  y = table(doc, ['Code', 'Type', 'Size', 'Description', 'Status', 'Client / site'],
    units.map((u) => ({ c: String(u.code), t: String(u.type), s: String(u.size || '-'), d: String(u.description || '-'), st: String(u.status), cl: `${u.client || '-'}${u.site ? ` / ${u.site}` : ''}` })) as Row[][],
    y)
  for (const u of units) {
    const equipment = (u.equipment || []) as Row[]
    if (!equipment.length) continue
    doc.setFontSize(10); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text(`${u.code} – ${u.description || ''} (contents)`, 14, y + 8)
    y = table(doc, ['Item', 'Kind', 'Serial', 'Qty'],
      equipment.map((e) => ({ n: String(e.name), k: String(e.kind), s: String(e.serial || '-'), q: String(e.qty) })) as Row[][],
      y + 10)
  }
  footer(doc)
  doc.save('unit_stock_take.pdf')
}

export function downloadQcpPlan(templates: Row[], company: string) {
  const doc = new jsPDF()
  let y = header(doc, company, 'Quality Control Plan (QCP)', 'Stages and hold points for container / prefab builds')
  for (const t of templates) {
    if (t.category !== 'QCP_STAGE') continue
    doc.setFontSize(10)
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
    doc.text(String(t.name), 14, y + 7)
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text(doc.splitTextToSize(String(t.description || ''), 180), 14, y + 12)
    const items = JSON.parse(String(t.items) || '[]') as { text: string }[]
    y = table(doc, ['#', 'Inspection / acceptance item', 'Held by', 'Signature'],
      items.map((i, n) => ({ n: String(n + 1), t: i.text, h: '', s: '' })) as Row[][],
      y + 16)
    y += 4
    if (y > 240) { doc.addPage(); y = header(doc, company, 'Quality Control Plan (QCP)', '(continued)') }
  }
  footer(doc)
  doc.save('quality_control_plan.pdf')
}
