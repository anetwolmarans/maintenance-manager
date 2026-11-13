import { db } from '@/lib/db'
import { getSettings, setSetting } from '@/lib/settings'
import { sendMail } from '@/lib/mail'

export interface ReminderSection {
  title: string
  lines: string[]
}

export interface ReminderResult {
  collected: boolean
  emailed: boolean
  status?: string
  error?: string
  sections: ReminderSection[]
  ranAt: string
}

function addMonths(date: Date, months: number): Date {
  const x = new Date(date)
  x.setMonth(x.getMonth() + months)
  return x
}

function fmt(d: Date | null | undefined): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Collect everything that needs attention right now (maintenance due, stock to reorder, fleet services due). */
export async function collectReminders(): Promise<{ sections: ReminderSection[]; daysAhead: number; emails: string[] }> {
  const s = await getSettings()
  const daysAhead = Number(s.reminder_days_ahead || 14)
  const today = new Date()
  const soon = new Date(Date.now() + daysAhead * 24 * 3600 * 1000)
  const sections: ReminderSection[] = []

  // 1) maintenance schedules due / overdue
  const schedules = await db.maintenanceSchedule.findMany({
    where: { active: true, nextDue: { not: null } },
    include: { unit: true, type: true },
  })
  const due = schedules.filter((x) => x.nextDue && x.nextDue <= soon)
    .sort((a, b) => (a.nextDue!.getTime() - b.nextDue!.getTime()))
  if (due.length) {
    sections.push({
      title: `Maintenance due in the next ${daysAhead} days (or overdue): ${due.length}`,
      lines: due.map((x) => {
        const overdue = x.nextDue! < today ? ' OVERDUE' : ''
        return `- ${x.name} | due ${fmt(x.nextDue)}${overdue} | every ${x.intervalMonths} months | responsible: ${x.responsible || '-'}`
      }),
    })
  }

  // 2) stock below reorder point (supplier lead time included)
  const items = await db.stockItem.findMany({ include: { supplier: true } })
  const low = items.filter((i) => i.qtyOnHand <= i.reorderPoint)
  if (low.length) {
    sections.push({
      title: `Stock items at / below reorder point: ${low.length}`,
      lines: low.map((i) => {
        const lead = i.supplier?.leadTimeDays ?? null
        const arrive = lead != null ? fmt(new Date(Date.now() + lead * 24 * 3600 * 1000)) : '?'
        return `- ${i.name}: on hand ${i.qtyOnHand} ${i.unit}, reorder point ${i.reorderPoint} → order ${i.reorderQty} ${i.unit} from ${i.supplier?.name || 'no supplier set'} (lead time ${lead ?? '-'} days → arrives ~${arrive})`
      }),
    })
  }

  // 3) fleet services due (by km or by months, whichever comes first)
  const vehicles = await db.fleetVehicle.findMany({ where: { status: { not: 'RETIRED' } } })
  const fleetDue: string[] = []
  for (const v of vehicles) {
    const kmDue = v.serviceIntervalKm && v.lastServiceOdometerKm != null
      ? v.odometerKm >= v.lastServiceOdometerKm + v.serviceIntervalKm
      : false
    const kmSoon = v.serviceIntervalKm && v.lastServiceOdometerKm != null
      ? v.odometerKm >= v.lastServiceOdometerKm + v.serviceIntervalKm - Math.min(2000, Math.ceil(v.serviceIntervalKm * 0.1))
      : false
    const dateDue = v.serviceIntervalMonths && v.lastServiceDate
      ? addMonths(v.lastServiceDate, v.serviceIntervalMonths) <= soon
      : false
    if (kmDue || dateDue) {
      fleetDue.push(`- ${v.regNo} ${v.make} ${v.model}: service DUE (odometer ${v.odometerKm.toLocaleString('en')} km, last service ${v.lastServiceOdometerKm?.toLocaleString('en') ?? '-'} km on ${fmt(v.lastServiceDate)})`)
    } else if (kmSoon) {
      fleetDue.push(`- ${v.regNo} ${v.make} ${v.model}: service coming up (odometer ${v.odometerKm.toLocaleString('en')} km, next at ${(v.lastServiceOdometerKm! + v.serviceIntervalKm!).toLocaleString('en')} km)`)
    }
  }
  if (fleetDue.length) sections.push({ title: `Fleet services due: ${fleetDue.length}`, lines: fleetDue })

  // 4) units overdue back from clients
  const out = await db.unit.findMany({ where: { status: 'CLIENT_SITE', dueBack: { not: null } } })
  const overdueOut = out.filter((u) => u.dueBack && u.dueBack < today)
  if (overdueOut.length) {
    sections.push({
      title: `Units at clients past their due-back date: ${overdueOut.length}`,
      lines: overdueOut.map((u) => `- ${u.code} at ${u.client || '-'} (${u.site || '-'}) was due back ${fmt(u.dueBack)}`),
    })
  }

  return { sections, daysAhead, emails: (s.reminder_emails || '').split(/[,;]+/).map((x) => x.trim()).filter(Boolean) }
}

/** Build the digest text and email it to all configured recipients. */
export async function runReminders(trigger: string): Promise<ReminderResult> {
  const { sections, emails } = await collectReminders()
  const ranAt = new Date().toISOString()
  const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Windhoek' })
  const s = await getSettings()
  const company = s.company_name || 'Maintenance'

  let status = 'SENT'
  let error: string | undefined
  let emailed = false

  if (emails.length === 0) {
    status = 'SKIPPED_NO_RECIPIENT'
  } else {
    const subject = `[Maintenance reminders] ${company} – ${stamp} (${trigger})`
    const body = [
      `Maintenance reminders for ${company} – generated ${stamp} (${trigger}).`,
      '',
      ...sections.flatMap((sec) => [sec.title, ...sec.lines, '']),
      sections.length === 0 ? 'Nothing due right now – everything is on track.' : '',
      'Open the maintenance app for details and to log completions.',
    ].join('\n')
    for (const to of emails) {
      const r = await sendMail(to, subject, body)
      if (!r.ok) { status = r.status; error = r.error }
    }
    emailed = status === 'SENT'
  }

  await setSetting('last_reminder_run', ranAt)
  if (sections.length === 0 && emails.length > 0) status = 'NOTHING_DUE'
  return { collected: true, emailed, status, error, sections, ranAt }
}
