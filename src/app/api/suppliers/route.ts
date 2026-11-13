import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const suppliers = await db.supplier.findMany({ include: { stockItems: true }, orderBy: { name: 'asc' } })
  return Response.json(suppliers)
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  const row = await db.supplier.create({
    data: {
      name: b.name, contactName: b.contactName || null, email: b.email || null, phone: b.phone || null,
      leadTimeDays: Number(b.leadTimeDays) || 14, notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const row = await db.supplier.update({
    where: { id: b.id },
    data: {
      name: b.name, contactName: b.contactName || null, email: b.email || null, phone: b.phone || null,
      leadTimeDays: Number(b.leadTimeDays) || 14, notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.supplier.delete({ where: { id } })
  return Response.json({ ok: true })
}
