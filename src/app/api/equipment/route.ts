import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const b = await req.json()
  const row = await db.unitEquipment.create({
    data: {
      unitId: b.unitId, kind: b.kind || 'AIRCON', name: b.name,
      airconModelId: b.airconModelId || null, serial: b.serial || null,
      qty: Number(b.qty) || 1, installedDate: b.installedDate ? new Date(b.installedDate) : null,
      notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const row = await db.unitEquipment.update({
    where: { id: b.id },
    data: {
      kind: b.kind, name: b.name, airconModelId: b.airconModelId || null, serial: b.serial || null,
      qty: Number(b.qty) || 1, installedDate: b.installedDate ? new Date(b.installedDate) : null,
      notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.unitEquipment.delete({ where: { id } })
  return Response.json({ ok: true })
}
