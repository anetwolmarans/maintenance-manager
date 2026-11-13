import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

function addMonths(date: Date, months: number): Date {
  const x = new Date(date)
  x.setMonth(x.getMonth() + months)
  return x
}

// GET: types + schedules (with records)
export async function GET() {
  const [types, schedules] = await Promise.all([
    db.maintenanceType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.maintenanceSchedule.findMany({
      include: {
        type: true, unit: { select: { code: true, description: true } },
        records: { orderBy: { date: 'desc' }, take: 8 },
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    }),
  ])
  return Response.json({ types, schedules })
}

// POST: create a schedule (or auto-create per-unit standard set via action=generate_for_unit)
export async function POST(req: NextRequest) {
  const b = await req.json()

  if (b.action === 'generate_for_unit') {
    const unitId: string = b.unitId
    const types = await db.maintenanceType.findMany({ where: { active: true, key: { not: 'fleet_service' } } })
    const unit = await db.unit.findUnique({ where: { id: unitId } })
    if (!unit) return Response.json({ error: 'unit not found' }, { status: 404 })
    const skip = ['yard_cleaning'] // yard cleaning is a single global schedule
    let created = 0
    for (const t of types) {
      if (skip.includes(t.key)) continue
      // aircon schedules are created per aircon equipment, not per unit
      if (t.category === 'Aircon') continue
      const exists = await db.maintenanceSchedule.findFirst({ where: { unitId, typeId: t.id, active: true } })
      if (exists) continue
      const last = unit.buildDate ?? new Date()
      await db.maintenanceSchedule.create({
        data: {
          name: `${t.name.replace(' – container / outside building', '')} – ${unit.code}`, typeId: t.id, scope: 'UNIT',
          unitId, intervalMonths: t.defaultIntervalMonths, lastDone: last, nextDue: addMonths(last, t.defaultIntervalMonths),
        },
      })
      created++
    }
    // one schedule per aircon on this unit
    const equipment = await db.unitEquipment.findMany({ where: { unitId, kind: 'AIRCON' }, include: { airconModel: true } })
    for (const eq of equipment) {
      const svcType = types.find((t) => t.key === 'aircon_service')!
      const fltType = types.find((t) => t.key === 'aircon_filter_clean')!
      const label = `${eq.name}${eq.serial ? ` (${eq.serial})` : ''}`
      const last = eq.installedDate ?? unit.buildDate ?? new Date()
      if (!(await db.maintenanceSchedule.findFirst({ where: { equipmentId: eq.id, typeId: svcType.id } }))) {
        const months = eq.airconModel?.serviceIntervalMonths ?? svcType.defaultIntervalMonths
        await db.maintenanceSchedule.create({ data: { name: `Aircon service – ${unit.code} ${label}`, typeId: svcType.id, scope: 'EQUIPMENT', unitId, equipmentId: eq.id, intervalMonths: months, lastDone: last, nextDue: addMonths(last, months), notes: eq.airconModel ? `Per model interval: ${months} months.` : null } })
        created++
      }
      if (!(await db.maintenanceSchedule.findFirst({ where: { equipmentId: eq.id, typeId: fltType.id } }))) {
        const months = eq.airconModel?.filterCleanMonths ?? fltType.defaultIntervalMonths
        await db.maintenanceSchedule.create({ data: { name: `Aircon filter clean – ${unit.code} ${label} (monthly)`, typeId: fltType.id, scope: 'EQUIPMENT', unitId, equipmentId: eq.id, intervalMonths: months, lastDone: last, nextDue: addMonths(last, months) } })
        created++
      }
    }
    return Response.json({ ok: true, created })
  }

  const type = await db.maintenanceType.findUnique({ where: { id: b.typeId } })
  const months = Number(b.intervalMonths) || type?.defaultIntervalMonths || 12
  const last = b.lastDone ? new Date(b.lastDone) : null
  const schedule = await db.maintenanceSchedule.create({
    data: {
      name: b.name, typeId: b.typeId, scope: b.scope || 'UNIT', unitId: b.unitId || null,
      equipmentId: b.equipmentId || null, intervalMonths: months, lastDone: last,
      nextDue: last ? addMonths(last, months) : null, responsible: b.responsible || null, notes: b.notes || null,
    },
  })
  return Response.json(schedule)
}

// PUT: update schedule; action=complete logs a record and rolls the due date forward
export async function PUT(req: NextRequest) {
  const b = await req.json()

  if (b.action === 'complete') {
    const sch = await db.maintenanceSchedule.findUnique({ where: { id: b.scheduleId } })
    if (!sch) return Response.json({ error: 'schedule not found' }, { status: 404 })
    const date = b.date ? new Date(b.date) : new Date()
    await db.maintenanceRecord.create({
      data: { scheduleId: sch.id, date, performedBy: b.performedBy || null, cost: b.cost ?? null, findings: b.findings || null, notes: b.notes || null },
    })
    const next = addMonths(date, sch.intervalMonths)
    await db.maintenanceSchedule.update({ where: { id: sch.id }, data: { lastDone: date, nextDue: next } })
    if (sch.unitId) {
      await db.unitHistory.create({
        data: { unitId: sch.unitId, date, type: 'MAINTENANCE', refId: sch.id, person: b.performedBy || null, description: `${sch.name} completed (next due ${next.toLocaleDateString('en-GB')})` },
      })
    }
    return Response.json({ ok: true, nextDue: next })
  }

  const months = Number(b.intervalMonths) || 12
  const last = b.lastDone ? new Date(b.lastDone) : null
  const schedule = await db.maintenanceSchedule.update({
    where: { id: b.id },
    data: {
      name: b.name, typeId: b.typeId, intervalMonths: months, lastDone: last,
      nextDue: last ? addMonths(last, months) : null, responsible: b.responsible || null, notes: b.notes || null, active: b.active ?? true,
    },
  })
  return Response.json(schedule)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.maintenanceSchedule.delete({ where: { id } })
  return Response.json({ ok: true })
}
