import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

// GET: items (with supplier), BOM (with stock item), suppliers, plus computed container-build availability
export async function GET() {
  const [items, suppliers, bom] = await Promise.all([
    db.stockItem.findMany({ include: { supplier: true }, orderBy: { category: 'asc' } }),
    db.supplier.findMany({ orderBy: { name: 'asc' } }),
    db.bomItem.findMany({ include: { stockItem: true }, orderBy: { id: 'asc' } }),
  ])
  const bomItems = bom.map((b) => ({
    ...b,
    canBuild: b.stockItem.qtyOnHand > 0 ? Math.floor(b.stockItem.qtyOnHand / b.qtyPerUnit) : 0,
  }))
  const containersBuildable = bomItems.length ? Math.min(...bomItems.map((b) => b.canBuild)) : 0
  return Response.json({ items, suppliers, bom: bomItems, containersBuildable })
}

export async function POST(req: NextRequest) {
  const b = await req.json()
  if (b.entity === 'bom') {
    const row = await db.bomItem.create({ data: { stockItemId: b.stockItemId, qtyPerUnit: Number(b.qtyPerUnit) || 1, buildType: 'standard_container' } })
    return Response.json(row)
  }
  const row = await db.stockItem.create({
    data: {
      name: b.name, sku: b.sku || null, category: b.category || 'General', unit: b.unit || 'ea',
      qtyOnHand: Number(b.qtyOnHand) || 0, reorderPoint: Number(b.reorderPoint) || 0,
      reorderQty: Number(b.reorderQty) || 0, unitCost: Number(b.unitCost) || 0,
      location: b.location || null, supplierId: b.supplierId || null, notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  if (b.entity === 'bom') {
    const row = await db.bomItem.update({ where: { id: b.id }, data: { qtyPerUnit: Number(b.qtyPerUnit) || 1 } })
    return Response.json(row)
  }
  const row = await db.stockItem.update({
    where: { id: b.id },
    data: {
      name: b.name, sku: b.sku || null, category: b.category, unit: b.unit,
      qtyOnHand: Number(b.qtyOnHand) || 0, reorderPoint: Number(b.reorderPoint) || 0,
      reorderQty: Number(b.reorderQty) || 0, unitCost: Number(b.unitCost) || 0,
      location: b.location || null, supplierId: b.supplierId || null, notes: b.notes || null,
    },
  })
  return Response.json(row)
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const entity = url.searchParams.get('entity')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  if (entity === 'bom') await db.bomItem.delete({ where: { id } })
  else await db.stockItem.delete({ where: { id } })
  return Response.json({ ok: true })
}
