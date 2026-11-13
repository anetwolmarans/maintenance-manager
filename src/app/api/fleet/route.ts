import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const vehicles = await db.fleetVehicle.findMany({
    include: { records: { orderBy: { date: 'desc' } }, inspections: { orderBy: { date: 'desc' } } },
    orderBy: { regNo: 'asc' },
  })
  return Response.json(vehicles)
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  if (b.entity === 'record') {
    const rec = await db.fleetRecord.create({
      data: {
        vehicleId: b.vehicleId, date: b.date ? new Date(b.date) : new Date(), type: b.type || 'SERVICE',
        description: b.description, odometerKm: b.odometerKm ?? null, cost: b.cost ?? null,
        workshop: b.workshop || null, performedBy: b.performedBy || null,
        nextServiceDate: b.nextServiceDate ? new Date(b.nextServiceDate) : null, nextServiceKm: b.nextServiceKm ?? null,
      },
    })
    // keep vehicle odometer and last-service fields in sync
    const veh = await db.fleetVehicle.findUnique({ where: { id: b.vehicleId } })
    if (veh) {
      const patch: Record<string, unknown> = {}
      if (b.odometerKm && b.odometerKm > veh.odometerKm) patch.odometerKm = b.odometerKm
      if (b.type === 'SERVICE') {
        patch.lastServiceDate = rec.date
        patch.lastServiceOdometerKm = b.odometerKm ?? veh.odometerKm
      }
      if (b.type === 'SERVICE' || b.type === 'REPAIR') patch.status = 'ACTIVE'
      if (Object.keys(patch).length) await db.fleetVehicle.update({ where: { id: veh.id }, data: patch })
    }
    return Response.json(rec)
  }
  const veh = await db.fleetVehicle.create({
    data: {
      regNo: b.regNo, make: b.make, model: b.model, type: b.type || 'LDV', year: b.year ? Number(b.year) : null,
      odometerKm: Number(b.odometerKm) || 0, status: b.status || 'ACTIVE', assignedTo: b.assignedTo || null,
      serviceIntervalKm: b.serviceIntervalKm ? Number(b.serviceIntervalKm) : null,
      serviceIntervalMonths: b.serviceIntervalMonths ? Number(b.serviceIntervalMonths) : null,
      lastServiceDate: b.lastServiceDate ? new Date(b.lastServiceDate) : null,
      lastServiceOdometerKm: b.lastServiceOdometerKm ? Number(b.lastServiceOdometerKm) : null,
      notes: b.notes || null,
    },
  })
  return Response.json(veh)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const veh = await db.fleetVehicle.update({
    where: { id: b.id },
    data: {
      regNo: b.regNo, make: b.make, model: b.model, type: b.type, year: b.year ? Number(b.year) : null,
      odometerKm: Number(b.odometerKm) || 0, status: b.status, assignedTo: b.assignedTo || null,
      serviceIntervalKm: b.serviceIntervalKm ? Number(b.serviceIntervalKm) : null,
      serviceIntervalMonths: b.serviceIntervalMonths ? Number(b.serviceIntervalMonths) : null,
      lastServiceDate: b.lastServiceDate ? new Date(b.lastServiceDate) : null,
      lastServiceOdometerKm: b.lastServiceOdometerKm ? Number(b.lastServiceOdometerKm) : null,
      notes: b.notes || null,
    },
  })
  return Response.json(veh)
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const entity = url.searchParams.get('entity')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  if (entity === 'record') await db.fleetRecord.delete({ where: { id } })
  else await db.fleetVehicle.delete({ where: { id } })
  return Response.json({ ok: true })
}
