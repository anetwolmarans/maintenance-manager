import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const models = await db.airconModel.findMany({ include: { equipment: true }, orderBy: [{ brand: 'asc' }, { model: 'asc' } ] })
  return Response.json(models)
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  const row = await db.airconModel.create({
    data: {
      brand: b.brand, model: b.model, type: b.type || 'Split inverter', btu: Number(b.btu) || 12000,
      serviceIntervalMonths: Number(b.serviceIntervalMonths) || 6, filterCleanMonths: Number(b.filterCleanMonths) || 1,
      supplier: b.supplier || null, source: b.source || null, notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const row = await db.airconModel.update({
    where: { id: b.id },
    data: {
      brand: b.brand, model: b.model, type: b.type, btu: Number(b.btu),
      serviceIntervalMonths: Number(b.serviceIntervalMonths), filterCleanMonths: Number(b.filterCleanMonths),
      supplier: b.supplier || null, source: b.source || null, notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.airconModel.delete({ where: { id } })
  return Response.json({ ok: true })
}
