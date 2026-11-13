import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const templates = await db.inspectionTemplate.findMany({ orderBy: [{ category: 'asc' }, { stageOrder: 'asc' }] })
  return Response.json(templates)
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  const row = await db.inspectionTemplate.create({
    data: {
      name: b.name, category: b.category || 'QCP_STAGE', stageOrder: Number(b.stageOrder) || 0,
      description: b.description || null,
      items: JSON.stringify((b.items as string[]).map((text, i) => ({ id: `i${i + 1}`, text }))),
    },
  })
  return Response.json(row)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const row = await db.inspectionTemplate.update({
    where: { id: b.id },
    data: {
      name: b.name, category: b.category, stageOrder: Number(b.stageOrder) || 0,
      description: b.description || null,
      items: JSON.stringify((b.items as string[]).map((text, i) => ({ id: `i${i + 1}`, text }))),
    },
  })
  return Response.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.inspectionTemplate.delete({ where: { id } })
  return Response.json({ ok: true })
}
