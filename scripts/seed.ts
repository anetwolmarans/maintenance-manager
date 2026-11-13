/* Seed script – run: bun scripts/seed.ts
 * Data grounded in research:
 *  - Samsung split units sold at Pupkewitz Megabuild, Windhoek (shop.megabuild.com.na)
 *  - Gree distributed in Namibia by Cold Air Technologies cc (gree-namibia.com)
 *  - GMC Airconditioning has a Namibia agent in Windhoek (gmcaircon.co.za)
 *  - Service intervals: residential 6-12 months, commercial 2x/yr; filter clean 30-60 days
 *    (simplyair.com.au, lexity.com.au, houlkair.co.uk, bchadenver.com)
 *  - Container exterior repaint every 3-5 years; roof & doors inspect every 3-6 months
 *    (onsitestorage.com, containermgt.com)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const d = (offsetMonths: number, day = 1) => {
  const x = new Date()
  x.setMonth(x.getMonth() + offsetMonths)
  x.setDate(day)
  return x
}

async function main() {
  // ---- wipe (idempotent seed) ----
  await db.emailLog.deleteMany()
  await db.unitHistory.deleteMany()
  await db.inspection.deleteMany()
  await db.maintenanceRecord.deleteMany()
  await db.maintenanceSchedule.deleteMany()
  await db.fleetRecord.deleteMany()
  await db.fleetVehicle.deleteMany()
  await db.unitEquipment.deleteMany()
  await db.unit.deleteMany()
  await db.bomItem.deleteMany()
  await db.airconModel.deleteMany()
  await db.maintenanceType.deleteMany()
  await db.inspectionTemplate.deleteMany()
  await db.stockItem.deleteMany()
  await db.supplier.deleteMany()
  await db.setting.deleteMany()

  // ---- settings ----
  const settings: Record<string, string> = {
    company_name: 'My Prefab & Container Business',
    company_slogan: 'Prefab & container units – built, maintained and tracked',
    reminder_days_ahead: '14',
    reminder_emails: '',
    reminders_enabled: 'true',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    smtp_secure: 'false',
    last_reminder_run: '',
  }
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.create({ data: { key, value } })
  }

  // ---- suppliers ----
  const supMegabuild = await db.supplier.create({
    data: { name: 'Pupkewitz Megabuild – Windhoek', contactName: 'Sales counter', email: 'sales@megabuild.com.na', phone: '+264 61 384 400', leadTimeDays: 7, notes: 'Building materials, ply, paint, hardware. Special-order Samsung aircons.' },
  })
  const supGree = await db.supplier.create({
    data: { name: 'Cold Air Technologies cc (Gree Namibia)', contactName: 'Gree distributor', email: 'info@gree-namibia.com', phone: '', leadTimeDays: 14, notes: 'Gree aircon distributor for Namibia (gree-namibia.com). Service kits & filters.' },
  })
  const supPaint = await db.supplier.create({
    data: { name: 'Paint & Hardware Supplier (sample)', contactName: '', email: '', phone: '', leadTimeDays: 10, notes: 'Sample supplier – edit details. Anti-corrosive & container paint.' },
  })
  const supElec = await db.supplier.create({
    data: { name: 'Electrical Wholesaler (sample)', contactName: '', email: '', phone: '', leadTimeDays: 5, notes: 'Sample supplier – edit details. DB boards, wire, lights, sockets.' },
  })
  const supSteel = await db.supplier.create({
    data: { name: 'Steel & Profiles Supplier (sample)', contactName: '', email: '', phone: '', leadTimeDays: 21, notes: 'Sample supplier – edit details. Box tubing, door frames, welding consumables. Long lead time – order early.' },
  })

  // ---- aircon models available in Namibia ----
  const mkAir = (data: { brand: string; model: string; type: string; btu: number; serviceIntervalMonths: number; filterCleanMonths: number; supplier: string; source: string; notes: string }) =>
    db.airconModel.create({ data })
  await mkAir({ brand: 'Samsung', model: 'AR09 Inverter Split', type: 'Split inverter', btu: 9000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Pupkewitz Megabuild', source: 'shop.megabuild.com.na', notes: '9 000 BTU inverter split – suited to small prefab offices (~18 m2).' })
  await mkAir({ brand: 'Samsung', model: 'AR12 Inverter Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Pupkewitz Megabuild', source: 'shop.megabuild.com.na', notes: '12 000 BTU inverter split – standard unit aircon in dusty Namibian conditions, service every 6 months.' })
  await mkAir({ brand: 'Samsung', model: 'AR24 Inverter Split', type: 'Split inverter', btu: 24000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Pupkewitz Megabuild', source: 'shop.megabuild.com.na', notes: '24 000 BTU inverter split for larger units (~48 m2).' })
  await mkAir({ brand: 'Gree', model: 'Amber / G-Boost Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Cold Air Technologies', source: 'gree-namibia.com', notes: 'Distributed in Namibia by Cold Air Technologies cc.' })
  await mkAir({ brand: 'Hisense', model: 'Smart Inverter Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Retail Namibia', source: 'Regional retail chains', notes: 'Widely available; good value for prefab units.' })
  await mkAir({ brand: 'Midea', model: 'Xtreme Save Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Retail Namibia', source: 'Regional retail chains', notes: 'Energy-saving range common in the region.' })
  await mkAir({ brand: 'Alliance', model: 'Jetman Air Split', type: 'Split', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Alliance dealers', source: 'Regional HVAC dealers', notes: 'Alliance (Jetman Air) sold through regional HVAC dealers.' })
  await mkAir({ brand: 'Daikin', model: 'Sensira Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 12, filterCleanMonths: 1, supplier: 'HVAC importers', source: 'Regional HVAC dealers', notes: 'Premium option – residential-duty interval 12 months, shorten if dusty site.' })
  await mkAir({ brand: 'LG', model: 'Dual Inverter Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 12, filterCleanMonths: 1, supplier: 'HVAC importers', source: 'Regional HVAC dealers', notes: 'Dual inverter; 12-month light-duty interval.' })
  await mkAir({ brand: 'GMC', model: 'Standard Split', type: 'Split', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'GMC Airconditioning', source: 'gmcaircon.co.za', notes: 'GMC has a Namibia agent in Windhoek – commercial duty, 6-month service.' })
  console.log('aircon models seeded')

  // ---- maintenance types ----
  const types: { key: string; name: string; category: string; months: number; description: string }[] = [
    { key: 'aircon_service', name: 'Aircon full service', category: 'Aircon', months: 6, description: 'Full service: clean coils & fins, check gas, electricals, drainage. 6-12 months depending on duty; Namibian dust = 6 months.' },
    { key: 'aircon_filter_clean', name: 'Aircon filter clean', category: 'Aircon', months: 1, description: 'Filter wash/clean every 30-60 days in dusty conditions.' },
    { key: 'exterior_painting', name: 'Exterior painting – container / outside building', category: 'Painting', months: 36, description: 'Exterior repaint every 3-5 years depending on sun/rain exposure (industry guidance). Inspect annually and repaint earlier if chalking/rust.' },
    { key: 'yard_cleaning', name: 'Yard & outside building cleaning', category: 'Cleaning', months: 3, description: 'General yard and outside-of-building cleaning around all prefab units – every 3 months.' },
    { key: 'window_cleaning', name: 'Window cleaning', category: 'Cleaning', months: 4, description: 'Window cleaning 3 times per year (every 4 months).' },
    { key: 'preventative_check', name: 'Preventative repair check', category: 'Inspection', months: 4, description: 'Walk-through to find and fix what needs repair before it becomes wear & tear – 3 times per year.' },
    { key: 'frame_inspection', name: 'Frame & structure inspection', category: 'Unit inspection', months: 6, description: 'Chassis, welds, rust treatment and structure – every 6 months (container roofs & doors guidance: every 3-6 months).' },
    { key: 'doors_inspection', name: 'Doors, locks & seals inspection', category: 'Unit inspection', months: 6, description: 'Door alignment, locks, hinges, seals – every 6 months.' },
    { key: 'unit_general', name: 'General unit inspection (rest of unit)', category: 'Unit inspection', months: 12, description: 'Interior, floor, ceiling, plumbing, electrical – yearly or before/after rentals.' },
    { key: 'fleet_service', name: 'Fleet service', category: 'Fleet', months: 6, description: 'Vehicle service by km or months, whichever first.' },
  ]
  const typeMap: Record<string, { id: string }> = {}
  for (const t of types) {
    const row = await db.maintenanceType.create({
      data: { key: t.key, name: t.name, category: t.category, defaultIntervalMonths: t.months, description: t.description },
    })
    typeMap[t.key] = row
  }

  // ---- inspection / QCP templates ----
  const it = (name: string, category: string, stageOrder: number, description: string, items: string[]) =>
    db.inspectionTemplate.create({ data: { name, category, stageOrder, description, items: JSON.stringify(items.map((text, i) => ({ id: `i${i + 1}`, text }))) } })

  await it('QCP Stage 1 – Frame & chassis', 'QCP_STAGE', 1, 'Steel work, welds and corrosion protection before lining starts.', [
    'Chassis straight, level and per drawing', 'All welds sound and cleaned', 'Rust removed and treated (converter + primer)', 'Cross-members / joists secure', 'Underside corrosion protection applied', 'Frame dimensions checked against spec',
  ])
  await it('QCP Stage 2 – Insulation & lining', 'QCP_STAGE', 2, 'Thermal envelope and internal lining.', [
    'Insulation installed without gaps', 'Vapour barrier / foil seams sealed', 'Ply lining fixed, joints tight', 'Ceiling panels secured', 'Cavity sealed against dust and moisture',
  ])
  await it('QCP Stage 3 – Doors & windows', 'QCP_STAGE', 3, 'Openings, hardware and sealing.', [
    'Door frames plumb and secure', 'Doors open / close freely', 'Lockset operates and keys tested', 'Hinges and stays fixed', 'Weather / door seals fitted', 'Windows secured and sealed', 'Glass free of cracks or scratches',
  ])
  await it('QCP Stage 4 – Electrical', 'QCP_STAGE', 4, 'Wiring, DB board and compliance.', [
    'DB board labelled and secured', 'Earth leakage trips tested', 'Wiring correctly sized and neat', 'Sockets and switches secure', 'All lights working', 'Earthing / bonding complete', 'Certificate of compliance (CoC) obtained',
  ])
  await it('QCP Stage 5 – Plumbing (if applicable)', 'QCP_STAGE', 5, 'Water and drainage for ablution / kitchen units.', [
    'Pipes pressure-tested', 'No leaks at joints', 'Geyser fitted with blanket & tray (if fitted)', 'Drains free-flowing', 'Taps and fittings secure',
  ])
  await it('QCP Stage 6 – Painting & finishing', 'QCP_STAGE', 6, 'Exterior and interior finish.', [
    'Surfaces prepared and primed', 'Top coat even – no runs or misses', 'Corners and edges covered', 'Interior painted / sealed', 'Touch-ups completed', 'Signage / branding applied',
  ])
  await it('QCP Stage 7 – Aircon & final fit-out', 'QCP_STAGE', 7, 'Cooling and final trim.', [
    'Aircon mounted level and secure', 'Condensate drainage sloped and tested', 'Unit cools / heats to spec', 'Filters fitted and clean', 'Electrical connection to DB done', 'Remotes and manuals handed over',
  ])
  await it('QCP Final – QC & handover', 'QCP_STAGE', 8, 'Close-out before the unit leaves the yard.', [
    'All punch-list items closed', 'Unit cleaned inside and out', 'Serial numbers recorded', 'Photos taken for file', "Owner's pack / manuals on board", 'Final QC sign-off',
  ])
  const outTpl = await it('Outgoing (dispatch) inspection', 'OUTGOING', 0, 'Completed when a unit is signed out to a client.', [
    'Walls free of dents / rust', 'Roof sound – no ponding or leaks', 'Paint intact', 'Chassis / underside rust check', 'Door locks work', 'Hinges and door seals OK', 'Windows intact and sealed', 'Floor clean and undamaged', 'Walls / ceiling clean', 'No water or moisture damage', 'Lights working', 'Sockets working', 'DB / earth leakage test OK', 'Aircon cools / heats', 'Aircon filter clean', 'No unusual noise or drips', 'Fire extinguisher present (if fitted)', 'CoC available (if required)', 'Unit clean and ready', 'Keys count noted', 'Meter / hours reading noted', 'Client briefed on operation', 'Photos taken',
  ])
  const retTpl = await it('Return (receiving) inspection', 'RETURN', 0, 'Completed when a unit is received back from a client.', [
    'Unit received at yard gate', 'Keys returned – count matches', 'Walls / roof checked for new damage', 'Doors and locks still working', 'Windows intact', 'Interior clean / contents removed', 'Electrical still working', 'Aircon still working', 'Water / moisture damage check', 'Damage noted and photographed', 'Deposit assessment done',
  ])
  await it('Fleet daily / weekly inspection', 'FLEET', 0, 'Driver or supervisor walk-around.', [
    'Tyres & pressure OK', 'Lights & indicators OK', 'Brakes OK', 'Fluids (oil / coolant / brake) OK', 'Battery secure', 'Body / canopy damage check', 'Load bed clean & secure', 'Spare wheel & jack present', 'Licence disc valid', 'Fire extinguisher present', 'Odometer reading noted',
  ])

  // ---- stock items + BOM for a standard container build ----
  const si = (name: string, sku: string, category: string, unit: string, qty: number, rp: number, rq: number, cost: number, supplierId: string, location = 'Yard store') =>
    db.stockItem.create({ data: { name, sku, category, unit, qtyOnHand: qty, reorderPoint: rp, reorderQty: rq, unitCost: cost, supplierId, location } })

  const ply = await si('Plywood sheet 2440x1220 6mm', 'PLY-6', 'Lining', 'sheet', 40, 12, 24, 350, supMegabuild.id)
  const iso = await si('Isotherm ceiling insulation 50mm roll', 'INS-50', 'Insulation', 'roll', 8, 3, 6, 650, supMegabuild.id)
  const tube = await si('Steel box tubing 50x50x2 – 6 m', 'STL-5050', 'Steel', 'length', 26, 8, 16, 280, supSteel.id)
  const paint = await si('Exterior paint 5L', 'PNT-EXT5', 'Paint', 'tin', 10, 4, 8, 450, supPaint.id)
  const primer = await si('Anti-corrosive primer 5L', 'PNT-PR5', 'Paint', 'tin', 6, 2, 4, 380, supPaint.id)
  const rust = await si('Rust converter 1L', 'PNT-RUST', 'Paint', 'tin', 5, 2, 4, 180, supPaint.id)
  const seal = await si('Silicone sealant 280 ml', 'SEA-280', 'Sealing', 'cartridge', 8, 9, 18, 65, supPaint.id)
  const screws = await si('Self-tapping screws box 500', 'FST-SCR', 'Fasteners', 'box', 10, 4, 8, 120, supMegabuild.id)
  const rivets = await si('Pop rivets 250 pack', 'FST-RIV', 'Fasteners', 'pack', 7, 3, 6, 85, supMegabuild.id)
  const db8 = await si('DB board 8-way', 'ELC-DB8', 'Electrical', 'ea', 4, 2, 4, 385, supElec.id)
  const sock = await si('16 A socket outlet', 'ELC-SKT', 'Electrical', 'ea', 18, 8, 16, 55, supElec.id)
  const swit = await si('Light switch 1-lever', 'ELC-SW1', 'Electrical', 'ea', 12, 5, 10, 45, supElec.id)
  const led = await si('LED batten light 4 ft', 'ELC-LED4', 'Electrical', 'ea', 14, 6, 12, 110, supElec.id)
  const w15 = await si('Surfix wire 1.5 mm² 100 m', 'ELC-W15', 'Electrical', 'roll', 5, 2, 4, 520, supElec.id)
  const w25 = await si('Surfix wire 2.5 mm² 100 m', 'ELC-W25', 'Electrical', 'roll', 4, 2, 4, 760, supElec.id)
  const door = await si('Door 813x2032 + frame', 'DOR-813', 'Doors & windows', 'ea', 1, 2, 4, 1250, supMegabuild.id)
  const lock = await si('Lockset + cylinder', 'DOR-LCK', 'Doors & windows', 'ea', 4, 2, 4, 320, supMegabuild.id)
  const hing = await si('Door hinge 100 mm', 'DOR-HNG', 'Doors & windows', 'ea', 15, 6, 12, 35, supMegabuild.id)
  const win = await si('Aluminium window 900x600', 'WIN-906', 'Doors & windows', 'ea', 2, 3, 6, 780, supMegabuild.id)
  const rods = await si('Welding rods 2.5 mm 5 kg', 'WLD-ROD', 'Consumables', 'pack', 6, 2, 4, 390, supSteel.id)

  const bom = [
    { stockItemId: ply.id, qtyPerUnit: 8 }, { stockItemId: iso.id, qtyPerUnit: 1 },
    { stockItemId: tube.id, qtyPerUnit: 4 }, { stockItemId: paint.id, qtyPerUnit: 2 },
    { stockItemId: primer.id, qtyPerUnit: 1 }, { stockItemId: rust.id, qtyPerUnit: 1 },
    { stockItemId: seal.id, qtyPerUnit: 3 }, { stockItemId: screws.id, qtyPerUnit: 2 },
    { stockItemId: rivets.id, qtyPerUnit: 1 }, { stockItemId: db8.id, qtyPerUnit: 1 },
    { stockItemId: sock.id, qtyPerUnit: 4 }, { stockItemId: swit.id, qtyPerUnit: 2 },
    { stockItemId: led.id, qtyPerUnit: 3 }, { stockItemId: w15.id, qtyPerUnit: 1 },
    { stockItemId: w25.id, qtyPerUnit: 1 }, { stockItemId: door.id, qtyPerUnit: 1 },
    { stockItemId: lock.id, qtyPerUnit: 1 }, { stockItemId: hing.id, qtyPerUnit: 3 },
    { stockItemId: win.id, qtyPerUnit: 2 }, { stockItemId: rods.id, qtyPerUnit: 1 },
  ]
  for (const b of bom) await db.bomItem.create({ data: { buildType: 'standard_container', ...b } })
  console.log('stock & BOM seeded')

  // ---- units ----
  const u1 = await db.unit.create({
    data: {
      code: 'PC-001', type: 'CONTAINER', size: '6 m', description: 'Converted container – site office', status: 'IN_STOCK', buildDate: d(-20, 15),
      builder: 'T. Shikongo', electrician: 'J. van Wyk', plumber: 'P. Nangolo', painter: 'M. Gawanas', glazier: 'K. Beukes', roofer: 'T. Shikongo',
      notes: 'Sample data – edit or delete.',
    },
  })
  const u2 = await db.unit.create({
    data: {
      code: 'PC-002', type: 'CONTAINER', size: '12 m', description: 'Converted container – ablution block', status: 'IN_STOCK', buildDate: d(-14, 8),
      builder: 'T. Shikongo', electrician: 'J. van Wyk', plumber: 'P. Nangolo', painter: 'M. Gawanas',
    },
  })
  const u3 = await db.unit.create({
    data: {
      code: 'PC-003', type: 'CONTAINER', size: '6 m', description: 'Converted container – storeroom', status: 'CLIENT_SITE',
      client: 'B2Gold Otjikoto (sample)', site: 'Otjikoto mine camp', outDate: d(-2, 20), dueBack: d(4, 20), buildDate: d(-26, 3),
      builder: 'L. Amupolo', electrician: 'J. van Wyk', painter: 'M. Gawanas',
    },
  })
  const u4 = await db.unit.create({
    data: {
      code: 'PB-001', type: 'PREFAB', size: '3x6 m', description: 'Prefab site office', status: 'IN_STOCK', buildDate: d(-9, 22),
      builder: 'L. Amupolo', electrician: 'D. Gawaseb', painter: 'S. Tjipuka', roofer: 'L. Amupolo',
    },
  })
  const u5 = await db.unit.create({
    data: {
      code: 'PB-002', type: 'PREFAB', size: '6x3 m', description: 'Prefab classroom unit', status: 'MAINTENANCE', buildDate: d(-30, 11),
      builder: 'T. Shikongo', electrician: 'D. Gawaseb', plumber: 'P. Nangolo', painter: 'S. Tjipuka',
      notes: 'In workshop: roof leak repair + repaint.',
    },
  })

  const air1 = await db.airconModel.findFirst({ where: { brand: 'Samsung', btu: 12000 } })
  const air2 = await db.airconModel.findFirst({ where: { brand: 'Gree' } })
  const air3 = await db.airconModel.findFirst({ where: { brand: 'Midea' } })

  const eq1 = await db.unitEquipment.create({ data: { unitId: u1.id, kind: 'AIRCON', name: 'Samsung AR12 12000 BTU', airconModelId: air1?.id, serial: 'SN-A11234', qty: 1, installedDate: d(-20, 15) } })
  await db.unitEquipment.create({ data: { unitId: u1.id, kind: 'DOOR', name: 'Steel door 813 front', qty: 1 } })
  await db.unitEquipment.create({ data: { unitId: u1.id, kind: 'WINDOW', name: 'Aluminium window 900x600', qty: 2 } })
  const eq2 = await db.unitEquipment.create({ data: { unitId: u2.id, kind: 'AIRCON', name: 'Gree Amber 12000 BTU', airconModelId: air2?.id, serial: 'GR-99821', qty: 1, installedDate: d(-14, 8) } })
  await db.unitEquipment.create({ data: { unitId: u2.id, kind: 'WINDOW', name: 'Aluminium window 900x600 (frosted)', qty: 2 } })
  const eq3 = await db.unitEquipment.create({ data: { unitId: u3.id, kind: 'AIRCON', name: 'Midea Xtreme Save 12000 BTU', airconModelId: air3?.id, serial: 'MD-45510', qty: 1, installedDate: d(-26, 3) } })
  await db.unitEquipment.create({ data: { unitId: u3.id, kind: 'DOOR', name: 'Security bar door', qty: 1 } })
  const eq4 = await db.unitEquipment.create({ data: { unitId: u4.id, kind: 'AIRCON', name: 'Samsung AR09 9000 BTU', airconModelId: air1?.id, serial: 'SN-A11009', qty: 1, installedDate: d(-9, 22) } })
  await db.unitEquipment.create({ data: { unitId: u4.id, kind: 'WINDOW', name: 'Aluminium window 900x600', qty: 2 } })

  // ---- unit history ----
  const hist = (unitId: string, date: Date, type: string, description: string, person?: string) =>
    db.unitHistory.create({ data: { unitId, date, type, description, person } })
  await hist(u1.id, d(-20, 15), 'CREATED', 'Unit registered and build team assigned')
  await hist(u1.id, d(-20, 16), 'BUILT', 'Build completed – QC passed, ready for rental')
  await hist(u2.id, d(-14, 8), 'CREATED', 'Unit registered and build team assigned')
  await hist(u3.id, d(-26, 3), 'CREATED', 'Unit registered and build team assigned')
  await hist(u3.id, d(-2, 20), 'SIGNED_OUT', 'Signed out to B2Gold Otjikoto (sample) – outgoing inspection passed', 'Dispatcher: R. Nekundi')

  // ---- sample inspection for PC-003 outgoing ----
  await db.inspection.create({
    data: {
      unitId: u3.id, templateId: outTpl.id, type: 'OUTGOING', date: d(-2, 20), inspectorName: 'R. Nekundi', clientName: 'B2Gold Otjikoto (sample)',
      status: 'PASS', findings: 'No defects. Keys: 2. Photos on file.',
      items: JSON.stringify(JSON.parse(outTpl.items).map((x: { text: string }) => ({ text: x.text, result: 'PASS', notes: '' }))),
    },
  })

  // ---- maintenance schedules ----
  const sched = (name: string, typeKey: string, scope: string, opts: { unitId?: string; equipmentId?: string; months?: number; last?: Date; responsible?: string; notes?: string }) => {
    const months = opts.months ?? types.find((t) => t.key === typeKey)!.months
    const next = opts.last ? new Date(opts.last.getTime() + months * 30.44 * 24 * 3600 * 1000) : null
    return db.maintenanceSchedule.create({
      data: { name, typeId: typeMap[typeKey].id, scope, unitId: opts.unitId, equipmentId: opts.equipmentId, intervalMonths: months, lastDone: opts.last, nextDue: next, responsible: opts.responsible, notes: opts.notes },
    })
  }
  await sched('Yard & outside building cleaning – whole yard', 'yard_cleaning', 'GLOBAL', { last: d(-2, 5), responsible: 'Yard team' })
  await sched('Exterior painting – PC-001 container office', 'exterior_painting', 'UNIT', { unitId: u1.id, last: d(-19, 20), responsible: 'M. Gawanas' })
  await sched('Exterior painting – PC-002 ablution block', 'exterior_painting', 'UNIT', { unitId: u2.id, last: d(-13, 18), responsible: 'M. Gawanas' })
  await sched('Exterior painting – PC-003 storeroom', 'exterior_painting', 'UNIT', { unitId: u3.id, last: d(-25, 12), responsible: 'M. Gawanas' })
  await sched('Preventative repair check – PC-001', 'preventative_check', 'UNIT', { unitId: u1.id, last: d(-4, 2), responsible: 'Workshop' })
  await sched('Preventative repair check – PC-002', 'preventative_check', 'UNIT', { unitId: u2.id, last: d(-1, 25), responsible: 'Workshop' })
  await sched('Preventative repair check – PC-003 (at client)', 'preventative_check', 'UNIT', { unitId: u3.id, last: d(-4, 10), responsible: 'Workshop' })
  await sched('Frame & structure – PC-001', 'frame_inspection', 'UNIT', { unitId: u1.id, last: d(-7, 15), responsible: 'Workshop' })
  await sched('Frame & structure – PC-002', 'frame_inspection', 'UNIT', { unitId: u2.id, last: d(-5, 15), responsible: 'Workshop' })
  await sched('Doors, locks & seals – PC-001', 'doors_inspection', 'UNIT', { unitId: u1.id, last: d(-7, 15), responsible: 'Workshop' })
  await sched('Doors, locks & seals – PC-003', 'doors_inspection', 'UNIT', { unitId: u3.id, last: d(-8, 15), responsible: 'Workshop' })
  await sched('General unit inspection – PC-001', 'unit_general', 'UNIT', { unitId: u1.id, last: d(-4, 2), responsible: 'Workshop' })
  await sched('Window cleaning – PC-001', 'window_cleaning', 'UNIT', { unitId: u1.id, last: d(-1, 10), responsible: 'Yard team' })
  await sched('Window cleaning – PC-002', 'window_cleaning', 'UNIT', { unitId: u2.id, last: d(-2, 10), responsible: 'Yard team' })
  await sched('Aircon service – PC-001 Samsung AR12 (SN-A11234)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq1.id, unitId: u1.id, last: d(-7, 1), responsible: 'HVAC contractor', notes: 'Per model interval: 6 months (dusty conditions).' })
  await sched('Aircon service – PC-002 Gree Amber (GR-99821)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq2.id, unitId: u2.id, last: d(-5, 1), responsible: 'HVAC contractor' })
  await sched('Aircon service – PC-003 Midea (MD-45510)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq3.id, unitId: u3.id, last: d(-2, 1), responsible: 'HVAC contractor' })
  await sched('Aircon service – PB-001 Samsung AR09 (SN-A11009)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq4.id, unitId: u4.id, last: d(-9, 22), responsible: 'HVAC contractor' })
  await sched('Aircon filter clean – PC-001 (monthly)', 'aircon_filter_clean', 'EQUIPMENT', { equipmentId: eq1.id, unitId: u1.id, last: d(-1, 3), responsible: 'Workshop' })
  await sched('Aircon filter clean – PC-002 (monthly)', 'aircon_filter_clean', 'EQUIPMENT', { equipmentId: eq2.id, unitId: u2.id, last: d(-2, 3), responsible: 'Workshop' })

  // ---- maintenance records (history) ----
  const airSch = await db.maintenanceSchedule.findFirst({ where: { name: { contains: 'PC-001 Samsung' } } })
  if (airSch) {
    await db.maintenanceRecord.create({ data: { scheduleId: airSch.id, date: d(-7, 1), performedBy: 'Cool Breeze HVAC (sample)', cost: 850, findings: 'Gas OK, coils washed, drain cleared.' } })
  }

  // ---- fleet ----
  const v1 = await db.fleetVehicle.create({
    data: {
      regNo: 'N 12345 W', make: 'Toyota', model: 'Hilux 2.4 GD-6 SRX', type: 'LDV', year: 2021, odometerKm: 98500, status: 'ACTIVE', assignedTo: 'Site team A',
      serviceIntervalKm: 10000, serviceIntervalMonths: 6, lastServiceDate: d(-5, 12), lastServiceOdometerKm: 91000,
      notes: 'Sample data – edit or delete.',
    },
  })
  const v2 = await db.fleetVehicle.create({
    data: {
      regNo: 'N 45678 W', make: 'Nissan', model: 'NP200 1.6i', type: 'LDV', year: 2019, odometerKm: 152300, status: 'ACTIVE', assignedTo: 'Maintenance team',
      serviceIntervalKm: 10000, serviceIntervalMonths: 6, lastServiceDate: d(-8, 3), lastServiceOdometerKm: 145000,
    },
  })
  const v3 = await db.fleetVehicle.create({
    data: {
      regNo: 'N 90211 W', make: 'Toyota', model: 'Dyna 150 dropside', type: 'TRUCK', year: 2018, odometerKm: 210450, status: 'ACTIVE', assignedTo: 'Delivery team',
      serviceIntervalKm: 15000, serviceIntervalMonths: 6, lastServiceDate: d(-3, 9), lastServiceOdometerKm: 203000,
    },
  })
  await db.fleetRecord.create({ data: { vehicleId: v1.id, date: d(-5, 12), type: 'SERVICE', description: 'Scheduled 90 000 km service – oil, filters, checks', odometerKm: 91000, cost: 3200, workshop: 'Auto Care Windhoek (sample)', performedBy: 'Workshop', nextServiceKm: 101000 } })
  await db.fleetRecord.create({ data: { vehicleId: v1.id, date: d(-3, 14), type: 'REPAIR', description: 'Front brake pads replaced', odometerKm: 96200, cost: 2850, workshop: 'Auto Care Windhoek (sample)' } })
  await db.fleetRecord.create({ data: { vehicleId: v2.id, date: d(-8, 3), type: 'SERVICE', description: 'Scheduled 145 000 km service', odometerKm: 145000, cost: 2900, workshop: 'Auto Care Windhoek (sample)', nextServiceKm: 155000 } })
  await db.fleetRecord.create({ data: { vehicleId: v2.id, date: d(-2, 6), type: 'TYRES', description: '2 new tyres fitted (front)', odometerKm: 151000, cost: 3400, workshop: 'Tyre Centre Windhoek (sample)' } })
  await db.fleetRecord.create({ data: { vehicleId: v3.id, date: d(-3, 9), type: 'SERVICE', description: 'Scheduled 200 000 km service + COF checks', odometerKm: 203000, cost: 5600, workshop: 'Truck Centre (sample)', nextServiceKm: 218000 } })

  console.log('seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
