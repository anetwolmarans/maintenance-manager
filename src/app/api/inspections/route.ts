import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

// GET: all inspections (with unit + vehicle names)
export async function GET() {
  const inspections = await db.inspection.findMany({
    include: { unit: { select: { code: true, description: true, client: true } }, vehicle: { select: { regNo: true, make: true, model: true } }, template: true },
    orderBy: { date: 'desc' },
  })
  return Response.json(inspections)
}

// POST: save an inspection. For OUTGOING/RETURN it also updates the unit status and writes history.
export async function POST(req: NextRequest) {
  const b = await req.json()
  const date = b.date ? new Date(b.date) : new Date()
  const inspection = await db.inspection.create({
    data: {
      unitId: b.unitId || null, vehicleId: b.vehicleId || null, templateId: b.templateId || null,
      type: b.type, date,
      inspectorName: b.inspectorName, clientName: b.clientName || null,
      signature: b.signature || null, status: b.status || 'PASS',
      findings: b.findings || null, items: b.items ? JSON.stringify(b.items) : '[]',
    },
  })
  const failed = (b.items || []).filter((x: { result: string }) => x.result === 'FAIL').length

  if (b.type === 'OUTGOING' && b.unitId) {
    await db.unit.update({ where: { id: b.unitId }, data: { status: 'CLIENT_SITE', client: b.clientName || null, outDate: date } })
    await db.unitHistory.create({
      data: { unitId: b.unitId, date, type: 'SIGNED_OUT', refId: inspection.id, person: b.inspectorName, description: `Signed out to ${b.clientName || '-'} – outgoing inspection ${b.status}${failed ? `, ${failed} item(s) flagged` : ''}` },
    })
  } else if (b.type === 'RETURN' && b.unitId) {
    await db.unit.update({ where: { id: b.unitId }, data: { status: 'IN_STOCK' } })
    await db.unitHistory.create({
      data: { unitId: b.unitId, date, type: 'RETURNED', refId: inspection.id, person: b.inspectorName, description: `Received back from ${b.clientName || 'client'} – return inspection ${b.status}${failed ? `, ${failed} defect(s) recorded` : ''}` },
    })
  } else if (b.type === 'QCP' && b.unitId) {
    const tpl = b.templateId ? await db.inspectionTemplate.findUnique({ where: { id: b.templateId } }) : null
    await db.unitHistory.create({
      data: { unitId: b.unitId, date, type: 'QCP', refId: inspection.id, person: b.inspectorName, description: `QCP: ${tpl?.name || b.templateName || 'stage'} – ${b.status}${failed ? `, ${failed} item(s) failed` : ''}` },
    })
  } else if (b.type === 'FLEET' && b.vehicleId) {
    if (b.odometerKm) await db.fleetVehicle.update({ where: { id: b.vehicleId }, data: { odometerKm: b.odometerKm } })
  }
  return Response.json(inspection)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.inspection.delete({ where: { id } })
  return Response.json({ ok: true })
}
