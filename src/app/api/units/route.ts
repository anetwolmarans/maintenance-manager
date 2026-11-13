import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const units = await db.unit.findMany({
    include: {
      equipment: { include: { airconModel: true } },
      schedules: { include: { type: true, records: { orderBy: { date: 'desc' }, take: 5 } } },
      history: { orderBy: { date: 'desc' } },
      inspections: { orderBy: { date: 'desc' } },
    },
    orderBy: { code: 'asc' },
  })
  return Response.json(units)
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  const unit = await db.unit.create({
    data: {
      code: b.code, serial: b.serial || null, type: b.type || 'CONTAINER', size: b.size || null,
      description: b.description || null, status: b.status || 'IN_STOCK',
      buildDate: b.buildDate ? new Date(b.buildDate) : null,
      builder: b.builder || null, electrician: b.electrician || null, plumber: b.plumber || null,
      painter: b.painter || null, glazier: b.glazier || null, roofer: b.roofer || null, otherTrade: b.otherTrade || null,
      notes: b.notes || null,
    },
  })
  await db.unitHistory.create({
    data: { unitId: unit.id, date: new Date(), type: 'CREATED', description: 'Unit registered', person: b._by || null },
  })
  return Response.json(unit)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const unit = await db.unit.update({
    where: { id: b.id },
    data: {
      code: b.code, serial: b.serial || null, type: b.type, size: b.size || null,
      description: b.description || null, status: b.status,
      client: b.client || null, site: b.site || null, dueBack: b.dueBack ? new Date(b.dueBack) : null,
      buildDate: b.buildDate ? new Date(b.buildDate) : null,
      builder: b.builder || null, electrician: b.electrician || null, plumber: b.plumber || null,
      painter: b.painter || null, glazier: b.glazier || null, roofer: b.roofer || null, otherTrade: b.otherTrade || null,
      notes: b.notes || null,
    },
  })
  return Response.json(unit)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.unit.delete({ where: { id } })
  return Response.json({ ok: true })
}
