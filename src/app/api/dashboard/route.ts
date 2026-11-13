import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'

function addMonths(date: Date, months: number): Date {
  const x = new Date(date)
  x.setMonth(x.getMonth() + months)
  return x
}

// Background reminder check: runs at most every 30 minutes while the app is in use.
let lastScheduledCheck = 0

export async function GET() {
  if (Date.now() - lastScheduledCheck > 30 * 60 * 1000) {
    lastScheduledCheck = Date.now()
    import('@/lib/reminders')
      .then(({ runReminders }) => runReminders('scheduled check'))
      .then((r) => console.log(`[reminders] scheduled: status=${r.status} sections=${r.sections.length}`))
      .catch((e) => console.error('[reminders] scheduled check failed', e))
  }

  const [units, schedules, stock, vehicles, inspections, emails, settings] = await Promise.all([
    db.unit.findMany({ include: { equipment: true } }),
    db.maintenanceSchedule.findMany({ where: { active: true, nextDue: { not: null } }, include: { type: true, unit: { select: { code: true } } }, orderBy: { nextDue: 'asc' } }),
    db.stockItem.findMany({ include: { supplier: true } }),
    db.fleetVehicle.findMany(),
    db.inspection.findMany({ orderBy: { date: 'desc' }, take: 6, include: { unit: { select: { code: true } }, vehicle: { select: { regNo: true } } } }),
    db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    getSettings(),
  ])

  const today = new Date()
  const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000)
  const overdue = schedules.filter((s) => s.nextDue && s.nextDue < today)
  const dueSoon = schedules.filter((s) => s.nextDue && s.nextDue >= today && s.nextDue <= in30)
  const lowStock = stock.filter((i) => i.qtyOnHand <= i.reorderPoint)

  const unitsByStatus: Record<string, number> = {}
  for (const u of units) unitsByStatus[u.status] = (unitsByStatus[u.status] || 0) + 1

  // fleet services due soon
  const fleetDue = vehicles.filter((v) => {
    if (v.status === 'RETIRED') return false
    const kmDue = v.serviceIntervalKm && v.lastServiceOdometerKm != null ? v.odometerKm >= v.lastServiceOdometerKm + v.serviceIntervalKm : false
    const dateDue = v.serviceIntervalMonths && v.lastServiceDate ? addMonths(v.lastServiceDate, v.serviceIntervalMonths) <= in30 : false
    return kmDue || dateDue
  })

  return Response.json({
    company: settings.company_name || '',
    reminderDaysAhead: Number(settings.reminder_days_ahead || 14),
    reminderEmails: settings.reminder_emails || '',
    smtpConfigured: Boolean(settings.smtp_host),
    remindersEnabled: settings.reminders_enabled !== 'false',
    lastReminderRun: settings.last_reminder_run || '',
    unitsTotal: units.length,
    unitsByStatus,
    equipmentTotal: units.reduce((n, u) => n + u.equipment.length, 0),
    schedulesTotal: schedules.length,
    overdue: overdue.map((s) => ({ id: s.id, name: s.name, nextDue: s.nextDue, type: s.type.name, unit: s.unit?.code || null })),
    dueSoon: dueSoon.map((s) => ({ id: s.id, name: s.name, nextDue: s.nextDue, type: s.type.name, unit: s.unit?.code || null })),
    lowStock: lowStock.map((i) => ({ id: i.id, name: i.name, qtyOnHand: i.qtyOnHand, reorderPoint: i.reorderPoint, unit: i.unit, supplier: i.supplier?.name || null, leadTimeDays: i.supplier?.leadTimeDays ?? null })),
    fleetDue: fleetDue.map((v) => ({ id: v.id, regNo: v.regNo, make: v.make, model: v.model, odometerKm: v.odometerKm })),
    recentInspections: inspections.map((i) => ({ id: i.id, type: i.type, date: i.date, status: i.status, unit: i.unit?.code || null, vehicle: i.vehicle?.regNo || null, inspector: i.inspectorName })),
    recentEmails: emails.map((e) => ({ id: e.id, to: e.to, subject: e.subject, status: e.status, createdAt: e.createdAt })),
  })
}
