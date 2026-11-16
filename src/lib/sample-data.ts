'use client'

/**
 * Sample data – ported from the original Prisma seed script so a fresh
 * install (web or APK) can load the same realistic Namibian demo dataset
 * from Settings → Data & sync → "Load sample data".
 */

import { uid, wipeAll, upsert, type Doc } from '@/lib/store'

const d = (offsetMonths: number, day = 1) => {
  const x = new Date()
  x.setMonth(x.getMonth() + offsetMonths)
  x.setDate(day)
  return x.toISOString()
}

const tpl = (name: string, category: string, stageOrder: number, description: string, items: string[]): Doc => ({
  id: uid(), name, category, stageOrder, description,
  items: JSON.stringify(items.map((text, i) => ({ id: `i${i + 1}`, text }))),
  active: true,
})

/** Wipe everything and load the sample dataset. */
export async function loadSampleData(): Promise<void> {
  await wipeAll()

  const settings: Doc[] = [
    { id: 'company_name', value: 'My Prefab & Container Business' },
    { id: 'company_slogan', value: 'Prefab & container units – built, maintained and tracked' },
    { id: 'reminder_days_ahead', value: '14' },
    { id: 'reminder_emails', value: '' },
    { id: 'reminders_enabled', value: 'true' },
    { id: 'smtp_host', value: '' },
    { id: 'smtp_port', value: '587' },
    { id: 'smtp_user', value: '' },
    { id: 'smtp_pass', value: '' },
    { id: 'smtp_from', value: '' },
    { id: 'smtp_secure', value: 'false' },
    { id: 'last_reminder_run', value: '' },
  ]
  for (const s of settings) await upsert('settings', s)

  const sup = (name: string, contactName: string, email: string, phone: string, leadTimeDays: number, notes: string) =>
    ({ id: uid(), name, contactName, email, phone, leadTimeDays, notes })
  const suppliers = [
    sup('Pupkewitz Megabuild – Windhoek', 'Sales counter', 'sales@megabuild.com.na', '+264 61 384 400', 7, 'Building materials, ply, paint, hardware. Special-order Samsung aircons.'),
    sup('Cold Air Technologies cc (Gree Namibia)', 'Gree distributor', 'info@gree-namibia.com', '', 14, 'Gree aircon distributor for Namibia (gree-namibia.com). Service kits & filters.'),
    sup('Paint & Hardware Supplier (sample)', '', '', '', 10, 'Sample supplier – edit details. Anti-corrosive & container paint.'),
    sup('Electrical Wholesaler (sample)', '', '', '', 5, 'Sample supplier – edit details. DB boards, wire, lights, sockets.'),
    sup('Steel & Profiles Supplier (sample)', '', '', '', 21, 'Sample supplier – edit details. Box tubing, door frames, welding consumables. Long lead time – order early.'),
  ]
  const [megabuild, gree, paint, elec, steel] = suppliers
  for (const s of suppliers) await upsert('suppliers', s)

  const airconModels: Doc[] = [
    { id: uid(), brand: 'Samsung', model: 'AR09 Inverter Split', type: 'Split inverter', btu: 9000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Pupkewitz Megabuild', source: 'shop.megabuild.com.na', notes: '9 000 BTU inverter split – suited to small prefab offices (~18 m2).' },
    { id: uid(), brand: 'Samsung', model: 'AR12 Inverter Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Pupkewitz Megabuild', source: 'shop.megabuild.com.na', notes: '12 000 BTU inverter split – standard unit aircon in dusty Namibian conditions, service every 6 months.' },
    { id: uid(), brand: 'Samsung', model: 'AR24 Inverter Split', type: 'Split inverter', btu: 24000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Pupkewitz Megabuild', source: 'shop.megabuild.com.na', notes: '24 000 BTU inverter split for larger units (~48 m2).' },
    { id: uid(), brand: 'Gree', model: 'Amber / G-Boost Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Cold Air Technologies', source: 'gree-namibia.com', notes: 'Distributed in Namibia by Cold Air Technologies cc.' },
    { id: uid(), brand: 'Hisense', model: 'Smart Inverter Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Retail Namibia', source: 'Regional retail chains', notes: 'Widely available; good value for prefab units.' },
    { id: uid(), brand: 'Midea', model: 'Xtreme Save Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Retail Namibia', source: 'Regional retail chains', notes: 'Energy-saving range common in the region.' },
    { id: uid(), brand: 'Alliance', model: 'Jetman Air Split', type: 'Split', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'Alliance dealers', source: 'Regional HVAC dealers', notes: 'Alliance (Jetman Air) sold through regional HVAC dealers.' },
    { id: uid(), brand: 'Daikin', model: 'Sensira Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 12, filterCleanMonths: 1, supplier: 'HVAC importers', source: 'Regional HVAC dealers', notes: 'Premium option – residential-duty interval 12 months, shorten if dusty site.' },
    { id: uid(), brand: 'LG', model: 'Dual Inverter Split', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 12, filterCleanMonths: 1, supplier: 'HVAC importers', source: 'Regional HVAC dealers', notes: 'Dual inverter; 12-month light-duty interval.' },
    { id: uid(), brand: 'GMC', model: 'Standard Split', type: 'Split', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: 'GMC Airconditioning', source: 'gmcaircon.co.za', notes: 'GMC has a Namibia agent in Windhoek – commercial duty, 6-month service.' },
  ]
  for (const a of airconModels) await upsert('airconModels', a)
  const air = (brand: string, btu?: number) =>
    airconModels.find((a) => a.brand === brand && (btu == null || a.btu === btu))!

  const typeDefs: { key: string; name: string; category: string; months: number; description: string }[] = [
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
  const types: Doc[] = typeDefs.map((t) => ({ id: uid(), key: t.key, name: t.name, category: t.category, defaultIntervalMonths: t.months, description: t.description, active: true }))
  for (const t of types) await upsert('maintenanceTypes', t)
  const typeByKey = (key: string) => types.find((t) => t.key === key)!

  const templates: Doc[] = [
    tpl('QCP Stage 1 – Frame & chassis', 'QCP_STAGE', 1, 'Steel work, welds and corrosion protection before lining starts.', ['Chassis straight, level and per drawing', 'All welds sound and cleaned', 'Rust removed and treated (converter + primer)', 'Cross-members / joists secure', 'Underside corrosion protection applied', 'Frame dimensions checked against spec']),
    tpl('QCP Stage 2 – Insulation & lining', 'QCP_STAGE', 2, 'Thermal envelope and internal lining.', ['Insulation installed without gaps', 'Vapour barrier / foil seams sealed', 'Ply lining fixed, joints tight', 'Ceiling panels secured', 'Cavity sealed against dust and moisture']),
    tpl('QCP Stage 3 – Doors & windows', 'QCP_STAGE', 3, 'Openings, hardware and sealing.', ['Door frames plumb and secure', 'Doors open / close freely', 'Lockset operates and keys tested', 'Hinges and stays fixed', 'Weather / door seals fitted', 'Windows secured and sealed', 'Glass free of cracks or scratches']),
    tpl('QCP Stage 4 – Electrical', 'QCP_STAGE', 4, 'Wiring, DB board and compliance.', ['DB board labelled and secured', 'Earth leakage trips tested', 'Wiring correctly sized and neat', 'Sockets and switches secure', 'All lights working', 'Earthing / bonding complete', 'Certificate of compliance (CoC) obtained']),
    tpl('QCP Stage 5 – Plumbing (if applicable)', 'QCP_STAGE', 5, 'Water and drainage for ablution / kitchen units.', ['Pipes pressure-tested', 'No leaks at joints', 'Geyser fitted with blanket & tray (if fitted)', 'Drains free-flowing', 'Taps and fittings secure']),
    tpl('QCP Stage 6 – Painting & finishing', 'QCP_STAGE', 6, 'Exterior and interior finish.', ['Surfaces prepared and primed', 'Top coat even – no runs or misses', 'Corners and edges covered', 'Interior painted / sealed', 'Touch-ups completed', 'Signage / branding applied']),
    tpl('QCP Stage 7 – Aircon & final fit-out', 'QCP_STAGE', 7, 'Cooling and final trim.', ['Aircon mounted level and secure', 'Condensate drainage sloped and tested', 'Unit cools / heats to spec', 'Filters fitted and clean', 'Electrical connection to DB done', 'Remotes and manuals handed over']),
    tpl('QCP Final – QC & handover', 'QCP_STAGE', 8, 'Close-out before the unit leaves the yard.', ['All punch-list items closed', 'Unit cleaned inside and out', 'Serial numbers recorded', 'Photos taken for file', "Owner's pack / manuals on board", 'Final QC sign-off']),
    tpl('Outgoing (dispatch) inspection', 'OUTGOING', 0, 'Completed when a unit is signed out to a client.', ['Walls free of dents / rust', 'Roof sound – no ponding or leaks', 'Paint intact', 'Chassis / underside rust check', 'Door locks work', 'Hinges and door seals OK', 'Windows intact and sealed', 'Floor clean and undamaged', 'Walls / ceiling clean', 'No water or moisture damage', 'Lights working', 'Sockets working', 'DB / earth leakage test OK', 'Aircon cools / heats', 'Aircon filter clean', 'No unusual noise or drips', 'Fire extinguisher present (if fitted)', 'CoC available (if required)', 'Unit clean and ready', 'Keys count noted', 'Meter / hours reading noted', 'Client briefed on operation', 'Photos taken']),
    tpl('Return (receiving) inspection', 'RETURN', 0, 'Completed when a unit is received back from a client.', ['Unit received at yard gate', 'Keys returned – count matches', 'Walls / roof checked for new damage', 'Doors and locks still working', 'Windows intact', 'Interior clean / contents removed', 'Electrical still working', 'Aircon still working', 'Water / moisture damage check', 'Damage noted and photographed', 'Deposit assessment done']),
    tpl('Fleet daily / weekly inspection', 'FLEET', 0, 'Driver or supervisor walk-around.', ['Tyres & pressure OK', 'Lights & indicators OK', 'Brakes OK', 'Fluids (oil / coolant / brake) OK', 'Battery secure', 'Body / canopy damage check', 'Load bed clean & secure', 'Spare wheel & jack present', 'Licence disc valid', 'Fire extinguisher present', 'Odometer reading noted']),
    tpl('Driver daily walk-around check', 'DRIVER_CHECK', 0, 'Quick pre-trip check done by the driver – any FAIL flags a defect for the office.', ['Licence disc & papers valid', 'Tyres (condition & pressure) incl. spare', 'Lights, indicators & hazard OK', 'Brakes & handbrake OK', 'Oil / coolant / washer fluid OK', 'Battery secure, no corrosion', 'Windscreen, mirrors & wipers OK', 'Horn working', 'Seatbelts intact', 'Load / canopy closed & strapped', 'Fire extinguisher present', 'No new dents, scratches or leaks', 'Cab clean, tools & jack on board', 'Odometer reading noted']),
  ]
  for (const t of templates) await upsert('inspectionTemplates', t)
  const outTpl = templates.find((t) => t.category === 'OUTGOING')!

  const si = (name: string, sku: string, category: string, unit: string, qtyOnHand: number, reorderPoint: number, reorderQty: number, unitCost: number, supplierId: string, location = 'Yard store'): Doc =>
    ({ id: uid(), name, sku, category, unit, qtyOnHand, reorderPoint, reorderQty, unitCost, supplierId, location, notes: null })
  const stockItems = [
    si('Plywood sheet 2440x1220 6mm', 'PLY-6', 'Lining', 'sheet', 40, 12, 24, 350, megabuild.id),
    si('Isotherm ceiling insulation 50mm roll', 'INS-50', 'Insulation', 'roll', 8, 3, 6, 650, megabuild.id),
    si('Steel box tubing 50x50x2 – 6 m', 'STL-5050', 'Steel', 'length', 26, 8, 16, 280, steel.id),
    si('Exterior paint 5L', 'PNT-EXT5', 'Paint', 'tin', 10, 4, 8, 450, paint.id),
    si('Anti-corrosive primer 5L', 'PNT-PR5', 'Paint', 'tin', 6, 2, 4, 380, paint.id),
    si('Rust converter 1L', 'PNT-RUST', 'Paint', 'tin', 5, 2, 4, 180, paint.id),
    si('Silicone sealant 280 ml', 'SEA-280', 'Sealing', 'cartridge', 8, 9, 18, 65, paint.id),
    si('Self-tapping screws box 500', 'FST-SCR', 'Fasteners', 'box', 10, 4, 8, 120, megabuild.id),
    si('Pop rivets 250 pack', 'FST-RIV', 'Fasteners', 'pack', 7, 3, 6, 85, megabuild.id),
    si('DB board 8-way', 'ELC-DB8', 'Electrical', 'ea', 4, 2, 4, 385, elec.id),
    si('16 A socket outlet', 'ELC-SKT', 'Electrical', 'ea', 18, 8, 16, 55, elec.id),
    si('Light switch 1-lever', 'ELC-SW1', 'Electrical', 'ea', 12, 5, 10, 45, elec.id),
    si('LED batten light 4 ft', 'ELC-LED4', 'Electrical', 'ea', 14, 6, 12, 110, elec.id),
    si('Surfix wire 1.5 mm² 100 m', 'ELC-W15', 'Electrical', 'roll', 5, 2, 4, 520, elec.id),
    si('Surfix wire 2.5 mm² 100 m', 'ELC-W25', 'Electrical', 'roll', 4, 2, 4, 760, elec.id),
    si('Door 813x2032 + frame', 'DOR-813', 'Doors & windows', 'ea', 1, 2, 4, 1250, megabuild.id),
    si('Lockset + cylinder', 'DOR-LCK', 'Doors & windows', 'ea', 4, 2, 4, 320, megabuild.id),
    si('Door hinge 100 mm', 'DOR-HNG', 'Doors & windows', 'ea', 15, 6, 12, 35, megabuild.id),
    si('Aluminium window 900x600', 'WIN-906', 'Doors & windows', 'ea', 2, 3, 6, 780, megabuild.id),
    si('Welding rods 2.5 mm 5 kg', 'WLD-ROD', 'Consumables', 'pack', 6, 2, 4, 390, steel.id),
  ]
  for (const s of stockItems) await upsert('stockItems', s)
  const item = (sku: string) => stockItems.find((s) => s.sku === sku)!
  const bomQty: [string, number][] = [
    ['PLY-6', 8], ['INS-50', 1], ['STL-5050', 4], ['PNT-EXT5', 2], ['PNT-PR5', 1], ['PNT-RUST', 1],
    ['SEA-280', 3], ['FST-SCR', 2], ['FST-RIV', 1], ['ELC-DB8', 1], ['ELC-SKT', 4], ['ELC-SW1', 2],
    ['ELC-LED4', 3], ['ELC-W15', 1], ['ELC-W25', 1], ['DOR-813', 1], ['DOR-LCK', 1], ['DOR-HNG', 3],
    ['WIN-906', 2], ['WLD-ROD', 1],
  ]
  for (const [sku, qtyPerUnit] of bomQty) {
    await upsert('bomItems', { id: uid(), buildType: 'standard_container', stockItemId: item(sku).id, qtyPerUnit })
  }

  const u1: Doc = { id: uid(), code: 'PC-001', serial: null, type: 'CONTAINER', size: '6 m', description: 'Converted container – site office', status: 'IN_STOCK', client: null, site: null, outDate: null, dueBack: null, buildDate: d(-20, 15), builder: 'T. Shikongo', electrician: 'J. van Wyk', plumber: 'P. Nangolo', painter: 'M. Gawanas', glazier: 'K. Beukes', roofer: 'T. Shikongo', otherTrade: null, notes: 'Sample data – edit or delete.' }
  const u2: Doc = { id: uid(), code: 'PC-002', serial: null, type: 'CONTAINER', size: '12 m', description: 'Converted container – ablution block', status: 'IN_STOCK', client: null, site: null, outDate: null, dueBack: null, buildDate: d(-14, 8), builder: 'T. Shikongo', electrician: 'J. van Wyk', plumber: 'P. Nangolo', painter: 'M. Gawanas', glazier: null, roofer: null, otherTrade: null, notes: null }
  const u3: Doc = { id: uid(), code: 'PC-003', serial: null, type: 'CONTAINER', size: '6 m', description: 'Converted container – storeroom', status: 'CLIENT_SITE', client: 'B2Gold Otjikoto (sample)', site: 'Otjikoto mine camp', outDate: d(-2, 20), dueBack: d(4, 20), buildDate: d(-26, 3), builder: 'L. Amupolo', electrician: 'J. van Wyk', plumber: null, painter: 'M. Gawanas', glazier: null, roofer: null, otherTrade: null, notes: null }
  const u4: Doc = { id: uid(), code: 'PB-001', serial: null, type: 'PREFAB', size: '3x6 m', description: 'Prefab site office', status: 'IN_STOCK', client: null, site: null, outDate: null, dueBack: null, buildDate: d(-9, 22), builder: 'L. Amupolo', electrician: 'D. Gawaseb', plumber: null, painter: 'S. Tjipuka', glazier: null, roofer: 'L. Amupolo', otherTrade: null, notes: null }
  const u5: Doc = { id: uid(), code: 'PB-002', serial: null, type: 'PREFAB', size: '6x3 m', description: 'Prefab classroom unit', status: 'MAINTENANCE', client: null, site: null, outDate: null, dueBack: null, buildDate: d(-30, 11), builder: 'T. Shikongo', electrician: 'D. Gawaseb', plumber: 'P. Nangolo', painter: 'S. Tjipuka', glazier: null, roofer: null, otherTrade: null, notes: 'In workshop: roof leak repair + repaint.' }
  for (const u of [u1, u2, u3, u4, u5]) await upsert('units', u)

  const eq = (unitId: string, kind: string, name: string, airconModelId: string | null, serial: string | null, qty: number, installedDate: string | null): Doc =>
    ({ id: uid(), unitId, kind, name, airconModelId, serial, qty, installedDate, notes: null })
  const eq1 = eq(u1.id, 'AIRCON', 'Samsung AR12 12000 BTU', air('Samsung', 12000).id, 'SN-A11234', 1, d(-20, 15))
  const eq2 = eq(u2.id, 'AIRCON', 'Gree Amber 12000 BTU', air('Gree').id, 'GR-99821', 1, d(-14, 8))
  const eq3 = eq(u3.id, 'AIRCON', 'Midea Xtreme Save 12000 BTU', air('Midea').id, 'MD-45510', 1, d(-26, 3))
  const eq4 = eq(u4.id, 'AIRCON', 'Samsung AR09 9000 BTU', air('Samsung', 9000).id, 'SN-A11009', 1, d(-9, 22))
  const equipment = [
    eq1,
    eq(u1.id, 'DOOR', 'Steel door 813 front', null, null, 1, null),
    eq(u1.id, 'WINDOW', 'Aluminium window 900x600', null, null, 2, null),
    eq2,
    eq(u2.id, 'WINDOW', 'Aluminium window 900x600 (frosted)', null, null, 2, null),
    eq3,
    eq(u3.id, 'DOOR', 'Security bar door', null, null, 1, null),
    eq4,
    eq(u4.id, 'WINDOW', 'Aluminium window 900x600', null, null, 2, null),
  ]
  for (const e of equipment) await upsert('unitEquipment', e)

  const hist = (unitId: string, date: string, type: string, description: string, person?: string): Doc =>
    ({ id: uid(), unitId, date, type, description, person: person ?? null })
  const histories = [
    hist(u1.id, d(-20, 15), 'CREATED', 'Unit registered and build team assigned'),
    hist(u1.id, d(-20, 16), 'BUILT', 'Build completed – QC passed, ready for rental'),
    hist(u2.id, d(-14, 8), 'CREATED', 'Unit registered and build team assigned'),
    hist(u3.id, d(-26, 3), 'CREATED', 'Unit registered and build team assigned'),
    hist(u3.id, d(-2, 20), 'SIGNED_OUT', 'Signed out to B2Gold Otjikoto (sample) – outgoing inspection passed', 'Dispatcher: R. Nekundi'),
  ]
  for (const h of histories) await upsert('unitHistories', h)

  await upsert('inspections', {
    id: uid(), unitId: u3.id, vehicleId: null, templateId: outTpl.id, type: 'OUTGOING', date: d(-2, 20),
    inspectorName: 'R. Nekundi', clientName: 'B2Gold Otjikoto (sample)', signature: null, status: 'PASS',
    findings: 'No defects. Keys: 2. Photos on file.', odometerKm: null,
    items: JSON.stringify(JSON.parse(outTpl.items as string).map((x: { text: string }) => ({ text: x.text, result: 'PASS', notes: '' }))),
  })

  const sched = (name: string, typeKey: string, scope: string, opts: { unitId?: string; equipmentId?: string; months?: number; last?: string; responsible?: string; notes?: string }): Doc => {
    const months = opts.months ?? typeByKey(typeKey).defaultIntervalMonths as number
    const last = opts.last ?? null
    const next = last ? new Date(new Date(last).getTime() + months * 30.44 * 24 * 3600 * 1000).toISOString() : null
    return { id: uid(), name, typeId: typeByKey(typeKey).id, scope, unitId: opts.unitId ?? null, equipmentId: opts.equipmentId ?? null, vehicleId: null, intervalMonths: months, lastDone: last, nextDue: next, responsible: opts.responsible ?? null, notes: opts.notes ?? null, active: true }
  }
  const schedules = [
    sched('Yard & outside building cleaning – whole yard', 'yard_cleaning', 'GLOBAL', { last: d(-2, 5), responsible: 'Yard team' }),
    sched('Exterior painting – PC-001 container office', 'exterior_painting', 'UNIT', { unitId: u1.id, last: d(-19, 20), responsible: 'M. Gawanas' }),
    sched('Exterior painting – PC-002 ablution block', 'exterior_painting', 'UNIT', { unitId: u2.id, last: d(-13, 18), responsible: 'M. Gawanas' }),
    sched('Exterior painting – PC-003 storeroom', 'exterior_painting', 'UNIT', { unitId: u3.id, last: d(-25, 12), responsible: 'M. Gawanas' }),
    sched('Preventative repair check – PC-001', 'preventative_check', 'UNIT', { unitId: u1.id, last: d(-4, 2), responsible: 'Workshop' }),
    sched('Preventative repair check – PC-002', 'preventative_check', 'UNIT', { unitId: u2.id, last: d(-1, 25), responsible: 'Workshop' }),
    sched('Preventative repair check – PC-003 (at client)', 'preventative_check', 'UNIT', { unitId: u3.id, last: d(-4, 10), responsible: 'Workshop' }),
    sched('Frame & structure – PC-001', 'frame_inspection', 'UNIT', { unitId: u1.id, last: d(-7, 15), responsible: 'Workshop' }),
    sched('Frame & structure – PC-002', 'frame_inspection', 'UNIT', { unitId: u2.id, last: d(-5, 15), responsible: 'Workshop' }),
    sched('Doors, locks & seals – PC-001', 'doors_inspection', 'UNIT', { unitId: u1.id, last: d(-7, 15), responsible: 'Workshop' }),
    sched('Doors, locks & seals – PC-003', 'doors_inspection', 'UNIT', { unitId: u3.id, last: d(-8, 15), responsible: 'Workshop' }),
    sched('General unit inspection – PC-001', 'unit_general', 'UNIT', { unitId: u1.id, last: d(-4, 2), responsible: 'Workshop' }),
    sched('Window cleaning – PC-001', 'window_cleaning', 'UNIT', { unitId: u1.id, last: d(-1, 10), responsible: 'Yard team' }),
    sched('Window cleaning – PC-002', 'window_cleaning', 'UNIT', { unitId: u2.id, last: d(-2, 10), responsible: 'Yard team' }),
    sched('Aircon service – PC-001 Samsung AR12 (SN-A11234)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq1.id, unitId: u1.id, last: d(-7, 1), responsible: 'HVAC contractor', notes: 'Per model interval: 6 months (dusty conditions).' }),
    sched('Aircon service – PC-002 Gree Amber (GR-99821)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq2.id, unitId: u2.id, last: d(-5, 1), responsible: 'HVAC contractor' }),
    sched('Aircon service – PC-003 Midea (MD-45510)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq3.id, unitId: u3.id, last: d(-2, 1), responsible: 'HVAC contractor' }),
    sched('Aircon service – PB-001 Samsung AR09 (SN-A11009)', 'aircon_service', 'EQUIPMENT', { equipmentId: eq4.id, unitId: u4.id, last: d(-9, 22), responsible: 'HVAC contractor' }),
    sched('Aircon filter clean – PC-001 (monthly)', 'aircon_filter_clean', 'EQUIPMENT', { equipmentId: eq1.id, unitId: u1.id, last: d(-1, 3), responsible: 'Workshop' }),
    sched('Aircon filter clean – PC-002 (monthly)', 'aircon_filter_clean', 'EQUIPMENT', { equipmentId: eq2.id, unitId: u2.id, last: d(-2, 3), responsible: 'Workshop' }),
  ]
  for (const s of schedules) await upsert('maintenanceSchedules', s)

  const airSch = schedules.find((s) => (s.name as string).includes('PC-001 Samsung'))!
  await upsert('maintenanceRecords', { id: uid(), scheduleId: airSch.id, date: d(-7, 1), performedBy: 'Cool Breeze HVAC (sample)', cost: 850, findings: 'Gas OK, coils washed, drain cleared.', notes: null })

  const veh = (regNo: string, make: string, model: string, type: string, year: number, odometerKm: number, lastServiceDate: string, lastServiceOdometerKm: number, assignedTo: string, notes?: string): Doc =>
    ({ id: uid(), regNo, make, model, type, year, odometerKm, status: 'ACTIVE', assignedTo, serviceIntervalKm: 10000, serviceIntervalMonths: 6, lastServiceDate, lastServiceOdometerKm, notes: notes ?? null })
  const v1 = veh('N 12345 W', 'Toyota', 'Hilux 2.4 GD-6 SRX', 'LDV', 2021, 98500, d(-5, 12), 91000, 'Site team A', 'Sample data – edit or delete.')
  const v2 = veh('N 45678 W', 'Nissan', 'NP200 1.6i', 'LDV', 2019, 152300, d(-8, 3), 145000, 'Maintenance team')
  const v3 = veh('N 90211 W', 'Toyota', 'Dyna 150 dropside', 'TRUCK', 2018, 210450, d(-3, 9), 203000, 'Delivery team')
  // the Dyna gets a longer interval
  v3.serviceIntervalKm = 15000
  for (const v of [v1, v2, v3]) await upsert('fleetVehicles', v)

  const frec = (vehicleId: string, date: string, type: string, description: string, odometerKm: number | null, cost: number | null, workshop: string, performedBy?: string, nextServiceKm?: number): Doc =>
    ({ id: uid(), vehicleId, date, type, description, odometerKm, cost, workshop, performedBy: performedBy ?? null, nextServiceDate: null, nextServiceKm: nextServiceKm ?? null })
  const fleetRecords = [
    frec(v1.id, d(-5, 12), 'SERVICE', 'Scheduled 90 000 km service – oil, filters, checks', 91000, 3200, 'Auto Care Windhoek (sample)', 'Workshop', 101000),
    frec(v1.id, d(-3, 14), 'REPAIR', 'Front brake pads replaced', 96200, 2850, 'Auto Care Windhoek (sample)'),
    frec(v2.id, d(-8, 3), 'SERVICE', 'Scheduled 145 000 km service', 145000, 2900, 'Auto Care Windhoek (sample)', undefined, 155000),
    frec(v2.id, d(-2, 6), 'TYRES', '2 new tyres fitted (front)', 151000, 3400, 'Tyre Centre Windhoek (sample)'),
    frec(v3.id, d(-3, 9), 'SERVICE', 'Scheduled 200 000 km service + COF checks', 203000, 5600, 'Truck Centre (sample)', undefined, 218000),
  ]
  for (const r of fleetRecords) await upsert('fleetRecords', r)
}
