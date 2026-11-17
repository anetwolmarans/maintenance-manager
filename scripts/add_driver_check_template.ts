/* One-off: add the DRIVER_CHECK template to an existing seeded DB. Run: bun scripts/add_driver_check_template.ts */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const items = [
  'Licence disc & papers valid',
  'Tyres (condition & pressure) incl. spare',
  'Lights, indicators & hazard OK',
  'Brakes & handbrake OK',
  'Oil / coolant / washer fluid OK',
  'Battery secure, no corrosion',
  'Windscreen, mirrors & wipers OK',
  'Horn working',
  'Seatbelts intact',
  'Load / canopy closed & strapped',
  'Fire extinguisher present',
  'No new dents, scratches or leaks',
  'Cab clean, tools & jack on board',
  'Odometer reading noted',
]

const name = 'Driver daily walk-around check'
const existing = await db.inspectionTemplate.findFirst({ where: { category: 'DRIVER_CHECK' } })
if (existing) {
  console.log('DRIVER_CHECK template already exists:', existing.name)
} else {
  const tpl = await db.inspectionTemplate.create({
    data: {
      name, category: 'DRIVER_CHECK', stageOrder: 0,
      description: 'Quick pre-trip check done by the driver – any FAIL flags a defect for the office.',
      items: JSON.stringify(items.map((text, i) => ({ id: `i${i + 1}`, text }))),
    },
  })
  console.log('Created DRIVER_CHECK template:', tpl.id)
}
await db.$disconnect()
