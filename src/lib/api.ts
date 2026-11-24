'use client'

/**
 * Data gateway – same apiGet/apiSend signatures as the old server-backed
 * version, but every call is served from the on-device store
 * (IndexedDB + optional Firebase Firestore sync). URL strings stay
 * identical ('/api/...') so the views did not need to change.
 */

import { storeReady, list, get, upsert, remove, uid, type Doc, type Collection } from '@/lib/store'
import { defaultCheckTemplates } from '@/lib/sample-data'

/** Fresh database: seed the built-in fleet / driver-check templates once so walk-around checks work out of the box.
 *  Also upgrades an existing built-in template when its checklist changes between app versions (items only). */
async function ensureCheckTemplates() {
  for (const t of defaultCheckTemplates()) {
    const cur = list('inspectionTemplates').find((x) => x.category === t.category)
    if (!cur) await upsert('inspectionTemplates', t)
    else if (cur.items !== t.items) await upsert('inspectionTemplates', { ...cur, items: t.items })
  }
}

// ---------- helpers (used by views, kept exactly as before) ----------

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (24 * 3600 * 1000))
}

export function dueStatus(d: string | Date | null | undefined): 'OVERDUE' | 'DUE SOON' | 'OK' | 'NOT SET' {
  const x = daysUntil(d)
  if (x == null) return 'NOT SET'
  if (x < 0) return 'OVERDUE'
  if (x <= 30) return 'DUE SOON'
  return 'OK'
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

/** True when the given date falls on the same calendar day as `ref` (defaults to now). */
export function isSameDay(d: string | Date | null | undefined, ref: Date = new Date()): boolean {
  if (!d) return false
  const a = new Date(d)
  return a.getFullYear() === ref.getFullYear() && a.getMonth() === ref.getMonth() && a.getDate() === ref.getDate()
}

export function dateInput(d: string | Date | null | undefined): string {
  if (!d) return ''
  const x = new Date(d)
  const off = x.getTimezoneOffset()
  return new Date(x.getTime() - off * 60 * 1000).toISOString().slice(0, 10)
}

// ---------- internal helpers ----------

const iso = (x: unknown): string | null => {
  if (x === undefined || x === null || x === '') return null
  const d = new Date(x as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const num = (x: unknown, fallback = 0): number => {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}
const opt = (x: unknown): string | null => (x === undefined || x === null || x === '' ? null : String(x))

function addMonths(date: Date, months: number): Date {
  const x = new Date(date)
  x.setMonth(x.getMonth() + months)
  return x
}

const byDateDesc = (a: Doc, b: Doc) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime()

function settingsMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const s of list('settings')) map[s.id] = (s.value as string) ?? ''
  return map
}

async function setSetting(key: string, value: string) {
  await upsert('settings', { id: key, value })
}

function failedCount(items: unknown): number {
  if (!Array.isArray(items)) return 0
  return items.filter((x: { result?: string }) => x.result === 'FAIL').length
}

// ---------- collection assemblers (same shapes the old API returned) ----------

function airconModelDoc(id: string | null | undefined): Doc | null {
  return id ? get('airconModels', id) : null
}

function assembleUnit(u: Doc): Doc {
  const equipment = list('unitEquipment')
    .filter((e) => e.unitId === u.id)
    .map((e) => ({ ...e, airconModel: airconModelDoc(e.airconModelId as string | null) }))
  const schedules = list('maintenanceSchedules')
    .filter((s) => s.unitId === u.id)
    .map((s) => ({
      ...s,
      type: get('maintenanceTypes', s.typeId as string) ?? null,
      records: list('maintenanceRecords').filter((r) => r.scheduleId === s.id).sort(byDateDesc).slice(0, 5),
    }))
  return {
    ...u,
    equipment,
    schedules,
    history: list('unitHistories').filter((h) => h.unitId === u.id).sort(byDateDesc),
    inspections: list('inspections').filter((i) => i.unitId === u.id).sort(byDateDesc),
  }
}

function assembleInspection(i: Doc): Doc {
  const u = i.unitId ? get('units', i.unitId as string) : null
  const v = i.vehicleId ? get('fleetVehicles', i.vehicleId as string) : null
  return {
    ...i,
    unit: u ? { code: u.code as string, description: (u.description as string) ?? undefined, client: (u.client as string) ?? undefined } : null,
    vehicle: v ? { regNo: v.regNo as string, make: v.make as string, model: v.model as string } : null,
    template: i.templateId ? get('inspectionTemplates', i.templateId as string) ?? null : null,
  }
}

function assembleVehicle(v: Doc): Doc {
  return {
    ...v,
    records: list('fleetRecords').filter((r) => r.vehicleId === v.id).sort(byDateDesc),
    inspections: list('inspections').filter((i) => i.vehicleId === v.id).sort(byDateDesc),
  }
}

// ---------- reminder digest (client-side port of the old reminder engine) ----------

export interface ReminderSection { title: string; lines: string[] }

export function collectReminders(): { sections: ReminderSection[]; daysAhead: number; emails: string[] } {
  const s = settingsMap()
  const daysAhead = Number(s.reminder_days_ahead || 14)
  const today = new Date()
  const soon = new Date(Date.now() + daysAhead * 24 * 3600 * 1000)
  const sections: ReminderSection[] = []

  const due = list('maintenanceSchedules')
    .filter((x) => x.active && x.nextDue && new Date(x.nextDue as string) <= soon)
    .sort((a, b) => new Date(a.nextDue as string).getTime() - new Date(b.nextDue as string).getTime())
  if (due.length) {
    sections.push({
      title: `Maintenance due in the next ${daysAhead} days (or overdue): ${due.length}`,
      lines: due.map((x) => {
        const over = x.nextDue && new Date(x.nextDue as string) < today ? ' OVERDUE' : ''
        const t = get('maintenanceTypes', x.typeId as string)
        void t
        return `- ${x.name} | due ${fmtDate(x.nextDue as string)}${over} | every ${x.intervalMonths} months | responsible: ${x.responsible || '-'}`
      }),
    })
  }

  const low = list('stockItems').filter((i) => num(i.qtyOnHand) <= num(i.reorderPoint))
  if (low.length) {
    sections.push({
      title: `Stock items at / below reorder point: ${low.length}`,
      lines: low.map((i) => {
        const sup = i.supplierId ? get('suppliers', i.supplierId as string) : null
        const lead = sup ? num(sup.leadTimeDays) : null
        const arrive = lead != null ? fmtDate(new Date(Date.now() + lead * 24 * 3600 * 1000).toISOString()) : '?'
        return `- ${i.name}: on hand ${i.qtyOnHand} ${i.unit}, reorder point ${i.reorderPoint} → order ${i.reorderQty} ${i.unit} from ${sup?.name || 'no supplier set'} (lead time ${lead ?? '-'} days → arrives ~${arrive})`
      }),
    })
  }

  const fleetDue: string[] = []
  for (const v of list('fleetVehicles')) {
    if (v.status === 'RETIRED') continue
    const intervalKm = v.serviceIntervalKm as number | null
    const intervalMonths = v.serviceIntervalMonths as number | null
    const lastOdo = v.lastServiceOdometerKm as number | null
    const lastDate = v.lastServiceDate as string | null
    const kmDue = intervalKm && lastOdo != null ? num(v.odometerKm) >= lastOdo + intervalKm : false
    const kmSoon = intervalKm && lastOdo != null
      ? num(v.odometerKm) >= lastOdo + intervalKm - Math.min(2000, Math.ceil(intervalKm * 0.1))
      : false
    const dateDue = intervalMonths && lastDate ? addMonths(new Date(lastDate), intervalMonths) <= soon : false
    if (kmDue || dateDue) {
      fleetDue.push(`- ${v.regNo} ${v.make} ${v.model}: service DUE (odometer ${num(v.odometerKm).toLocaleString('en')} km, last service ${lastOdo?.toLocaleString('en') ?? '-'} km on ${fmtDate(lastDate)})`)
    } else if (kmSoon) {
      fleetDue.push(`- ${v.regNo} ${v.make} ${v.model}: service coming up (odometer ${num(v.odometerKm).toLocaleString('en')} km, next at ${(lastOdo! + intervalKm!).toLocaleString('en')} km)`)
    }
  }
  if (fleetDue.length) sections.push({ title: `Fleet services due: ${fleetDue.length}`, lines: fleetDue })

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const defectLines: string[] = []
  for (const c of list('inspections').filter((i) => i.type === 'DRIVER_CHECK' && new Date(i.date as string) >= weekAgo && i.status !== 'PASS').sort(byDateDesc)) {
    let failed: { text?: string; notes?: string }[] = []
    try { failed = (JSON.parse((c.items as string) || '[]') as { text?: string; notes?: string; result?: string }[]).filter((x) => x.result === 'FAIL') } catch { /* ignore bad JSON */ }
    if (!failed.length) continue
    const v = c.vehicleId ? get('fleetVehicles', c.vehicleId as string) : null
    const reg = v?.regNo || 'unknown vehicle'
    defectLines.push(`- ${reg}: ${failed.map((x) => `${x.text}${x.notes ? ` (${x.notes})` : ''}`).join('; ')} — reported by ${c.inspectorName} on ${fmtDate(c.date as string)}`)
  }
  if (defectLines.length) sections.push({ title: `Vehicle defects reported by drivers (last 7 days): ${defectLines.length}`, lines: defectLines })

  const overdueOut = list('units').filter((u) => u.status === 'CLIENT_SITE' && u.dueBack && new Date(u.dueBack as string) < today)
  if (overdueOut.length) {
    sections.push({
      title: `Units at clients past their due-back date: ${overdueOut.length}`,
      lines: overdueOut.map((u) => `- ${u.code} at ${u.client || '-'} (${u.site || '-'}) was due back ${fmtDate(u.dueBack as string)}`),
    })
  }

  return { sections, daysAhead, emails: (s.reminder_emails || '').split(/[,;]+/).map((x) => x.trim()).filter(Boolean) }
}

// ---------- public gateway ----------

export async function apiGet<T>(url: string): Promise<T> {
  await storeReady()
  const path = new URL(url, 'http://local').pathname
  const q = new URL(url, 'http://local').searchParams

  if (path === '/api/units') return list('units').sort((a, b) => String(a.code).localeCompare(String(b.code))).map(assembleUnit) as T

  if (path === '/api/inspections') return list('inspections').sort(byDateDesc).map(assembleInspection) as T

  if (path === '/api/fleet') return list('fleetVehicles').sort((a, b) => String(a.regNo).localeCompare(String(b.regNo))).map(assembleVehicle) as T

  if (path === '/api/stock') {
    const items = list('stockItems')
      .sort((a, b) => String(a.category).localeCompare(String(b.category)))
      .map((i) => ({ ...i, supplier: i.supplierId ? get('suppliers', i.supplierId as string) : null }))
    const suppliers = list('suppliers').sort((a, b) => String(a.name).localeCompare(String(b.name)))
    const bom = list('bomItems').sort((a, b) => String(a.id).localeCompare(String(b.id))).map((b) => {
      const stockItem = get('stockItems', b.stockItemId as string) ?? { id: '', name: '', qtyOnHand: 0 }
      const canBuild = num(stockItem.qtyOnHand) > 0 ? Math.floor(num(stockItem.qtyOnHand) / Math.max(1, num(b.qtyPerUnit, 1))) : 0
      return { ...b, stockItem, canBuild }
    })
    const containersBuildable = bom.length ? Math.min(...bom.map((b) => b.canBuild)) : 0
    return { items, suppliers, bom, containersBuildable } as T
  }

  if (path === '/api/suppliers') {
    return list('suppliers')
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((s) => ({ ...s, stockItems: list('stockItems').filter((i) => i.supplierId === s.id) })) as T
  }

  if (path === '/api/maintenance') {
    const types = list('maintenanceTypes').filter((t) => t.active).sort((a, b) => String(a.name).localeCompare(String(b.name)))
    const schedules = list('maintenanceSchedules')
      .sort((a, b) => String(a.scope).localeCompare(String(b.scope)) || String(a.name).localeCompare(String(b.name)))
      .map((s) => ({
        ...s,
        type: get('maintenanceTypes', s.typeId as string) ?? null,
        unit: s.unitId ? (() => { const u = get('units', s.unitId as string); return u ? { code: u.code, description: u.description } : null })() : null,
        records: list('maintenanceRecords').filter((r) => r.scheduleId === s.id).sort(byDateDesc).slice(0, 8),
      }))
    return { types, schedules } as T
  }

  if (path === '/api/qcp') {
    await ensureCheckTemplates()
    return list('inspectionTemplates')
      .sort((a, b) => String(a.category).localeCompare(String(b.category)) || num(a.stageOrder) - num(b.stageOrder)) as T
  }

  if (path === '/api/aircons') {
    return list('airconModels')
      .sort((a, b) => String(a.brand).localeCompare(String(b.brand)) || String(a.model).localeCompare(String(b.model)))
      .map((a) => ({ ...a, equipment: list('unitEquipment').filter((e) => e.airconModelId === a.id) })) as T
  }

  if (path === '/api/settings') {
    const emailLogs = list('emailLogs').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 20)
    return { settings: settingsMap(), emailLogs } as T
  }

  if (path === '/api/dashboard') {
    const s = settingsMap()
    const today = new Date()
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    const units = list('units')
    const schedules = list('maintenanceSchedules').filter((x) => x.active && x.nextDue)
      .sort((a, b) => new Date(a.nextDue as string).getTime() - new Date(b.nextDue as string).getTime())
    const overdue = schedules.filter((x) => new Date(x.nextDue as string) < today)
    const dueSoon = schedules.filter((x) => new Date(x.nextDue as string) >= today && new Date(x.nextDue as string) <= in30)
    const lowStock = list('stockItems').filter((i) => num(i.qtyOnHand) <= num(i.reorderPoint))
    const unitsByStatus: Record<string, number> = {}
    for (const u of units) unitsByStatus[u.status as string] = (unitsByStatus[u.status as string] || 0) + 1
    const fleetDue = list('fleetVehicles').filter((v) => {
      if (v.status === 'RETIRED') return false
      const kmDue = v.serviceIntervalKm && v.lastServiceOdometerKm != null ? num(v.odometerKm) >= num(v.lastServiceOdometerKm) + num(v.serviceIntervalKm) : false
      const dateDue = v.serviceIntervalMonths && v.lastServiceDate ? addMonths(new Date(v.lastServiceDate as string), num(v.serviceIntervalMonths)) <= in30 : false
      return kmDue || dateDue
    })
    const recentInspections = list('inspections').sort(byDateDesc).slice(0, 6).map((i) => {
      const u = i.unitId ? get('units', i.unitId as string) : null
      const v = i.vehicleId ? get('fleetVehicles', i.vehicleId as string) : null
      return { id: i.id, type: i.type, date: i.date, status: i.status, unit: u?.code ?? null, vehicle: v?.regNo ?? null, inspector: i.inspectorName }
    })
    const recentEmails = list('emailLogs').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5)
      .map((e) => ({ id: e.id, to: e.to, subject: e.subject, status: e.status, createdAt: e.createdAt }))
    const scheduleName = (x: Doc) => {
      const t = get('maintenanceTypes', x.typeId as string)
      const u = x.unitId ? get('units', x.unitId as string) : null
      return { id: x.id, name: x.name, nextDue: x.nextDue, type: t?.name ?? '', unit: u?.code ?? null }
    }
    return {
      company: s.company_name || '',
      reminderDaysAhead: Number(s.reminder_days_ahead || 14),
      reminderEmails: s.reminder_emails || '',
      smtpConfigured: Boolean(s.smtp_host),
      remindersEnabled: s.reminders_enabled !== 'false',
      lastReminderRun: s.last_reminder_run || '',
      unitsTotal: units.length,
      unitsByStatus,
      equipmentTotal: list('unitEquipment').length,
      schedulesTotal: schedules.length,
      overdue: overdue.map(scheduleName),
      dueSoon: dueSoon.map(scheduleName),
      lowStock: lowStock.map((i) => {
        const sup = i.supplierId ? get('suppliers', i.supplierId as string) : null
        return { id: i.id, name: i.name, qtyOnHand: i.qtyOnHand, reorderPoint: i.reorderPoint, unit: i.unit, supplier: sup?.name ?? null, leadTimeDays: sup?.leadTimeDays ?? null }
      }),
      fleetDue: fleetDue.map((v) => ({ id: v.id, regNo: v.regNo, make: v.make, model: v.model, odometerKm: v.odometerKm })),
      recentInspections,
      recentEmails,
    } as T
  }

  if (path === '/api/reminders') {
    const r = collectReminders()
    return r as T
  }

  throw new Error(`GET ${url} failed (unknown route in offline mode)`)
}

export async function apiSend<T = unknown>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  await storeReady()
  const parsed = new URL(url, 'http://local')
  const path = parsed.pathname
  const q = parsed.searchParams
  const b = (body ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  // ---------- POST ----------
  if (method === 'POST') {
    if (path === '/api/units') {
      const unit = await upsert('units', {
        id: uid(), code: b.code, serial: opt(b.serial), type: b.type || 'CONTAINER', size: opt(b.size),
        description: opt(b.description), status: b.status || 'IN_STOCK', client: null, site: null, outDate: null, dueBack: null,
        buildDate: iso(b.buildDate), builder: opt(b.builder), electrician: opt(b.electrician), plumber: opt(b.plumber),
        painter: opt(b.painter), glazier: opt(b.glazier), roofer: opt(b.roofer), otherTrade: opt(b.otherTrade), notes: opt(b.notes),
      })
      await upsert('unitHistories', { id: uid(), unitId: unit.id, date: now, type: 'CREATED', description: 'Unit registered', person: opt(b._by) })
      return unit as T
    }

    if (path === '/api/inspections') {
      const date = iso(b.date) ?? now
      const inspection = await upsert('inspections', {
        id: uid(), unitId: opt(b.unitId), vehicleId: opt(b.vehicleId), templateId: opt(b.templateId), type: b.type, date,
        inspectorName: b.inspectorName, clientName: opt(b.clientName), signature: opt(b.signature), status: b.status || 'PASS',
        findings: opt(b.findings), odometerKm: b.odometerKm ?? null,
        items: b.items ? JSON.stringify(b.items) : '[]',
      })
      const failed = failedCount(b.items)
      const failedTxt = failed ? `, ${failed} item(s) flagged` : ''
      if (b.type === 'OUTGOING' && b.unitId) {
        await upsert('units', { ...get('units', b.unitId as string)!, status: 'CLIENT_SITE', client: opt(b.clientName), outDate: date })
        await upsert('unitHistories', { id: uid(), unitId: b.unitId, date, type: 'SIGNED_OUT', refId: inspection.id, person: b.inspectorName, description: `Signed out to ${b.clientName || '-'} – outgoing inspection ${inspection.status}${failedTxt}` })
      } else if (b.type === 'RETURN' && b.unitId) {
        await upsert('units', { ...get('units', b.unitId as string)!, status: 'IN_STOCK' })
        await upsert('unitHistories', { id: uid(), unitId: b.unitId, date, type: 'RETURNED', refId: inspection.id, person: b.inspectorName, description: `Received back from ${b.clientName || 'client'} – return inspection ${inspection.status}${failedTxt}` })
      } else if (b.type === 'QCP' && b.unitId) {
        const tpl = b.templateId ? get('inspectionTemplates', b.templateId as string) : null
        await upsert('unitHistories', { id: uid(), unitId: b.unitId, date, type: 'QCP', refId: inspection.id, person: b.inspectorName, description: `QCP: ${tpl?.name || b.templateName || 'stage'} – ${inspection.status}${failedTxt}` })
      } else if ((b.type === 'FLEET' || b.type === 'DRIVER_CHECK') && b.vehicleId) {
        if (b.odometerKm) {
          const veh = get('fleetVehicles', b.vehicleId as string)
          // only move the odometer forward, never backwards
          if (veh && num(b.odometerKm) > num(veh.odometerKm)) await upsert('fleetVehicles', { ...veh, odometerKm: num(b.odometerKm) })
        }
      }
      return inspection as T
    }

    if (path === '/api/fleet') {
      if (b.entity === 'record') {
        const rec = await upsert('fleetRecords', {
          id: uid(), vehicleId: b.vehicleId, date: iso(b.date) ?? now, type: b.type || 'SERVICE',
          description: b.description, odometerKm: b.odometerKm ?? null, cost: b.cost ?? null,
          workshop: opt(b.workshop), performedBy: opt(b.performedBy),
          nextServiceDate: iso(b.nextServiceDate), nextServiceKm: b.nextServiceKm ?? null,
        })
        // keep vehicle odometer and last-service fields in sync
        const veh = get('fleetVehicles', b.vehicleId as string)
        if (veh) {
          const patch: Doc = { ...veh }
          if (b.odometerKm && num(b.odometerKm) > num(veh.odometerKm)) patch.odometerKm = num(b.odometerKm)
          if (b.type === 'SERVICE') {
            patch.lastServiceDate = rec.date
            patch.lastServiceOdometerKm = b.odometerKm ?? num(veh.odometerKm)
          }
          if (b.type === 'SERVICE' || b.type === 'REPAIR') patch.status = 'ACTIVE'
          await upsert('fleetVehicles', patch)
        }
        return rec as T
      }
      const veh = await upsert('fleetVehicles', {
        id: uid(), regNo: b.regNo, make: b.make, model: b.model, type: b.type || 'LDV', year: b.year ? num(b.year) : null,
        odometerKm: num(b.odometerKm), status: b.status || 'ACTIVE', assignedTo: opt(b.assignedTo),
        serviceIntervalKm: b.serviceIntervalKm ? num(b.serviceIntervalKm) : null,
        serviceIntervalMonths: b.serviceIntervalMonths ? num(b.serviceIntervalMonths) : null,
        lastServiceDate: iso(b.lastServiceDate), lastServiceOdometerKm: b.lastServiceOdometerKm ? num(b.lastServiceOdometerKm) : null,
        notes: opt(b.notes),
      })
      return veh as T
    }

    if (path === '/api/stock') {
      if (b.entity === 'bom') {
        const row = await upsert('bomItems', { id: uid(), stockItemId: b.stockItemId, qtyPerUnit: num(b.qtyPerUnit, 1) || 1, buildType: 'standard_container' })
        return row as T
      }
      const row = await upsert('stockItems', {
        id: uid(), name: b.name, sku: opt(b.sku), category: b.category || 'General', unit: b.unit || 'ea',
        qtyOnHand: num(b.qtyOnHand), reorderPoint: num(b.reorderPoint), reorderQty: num(b.reorderQty), unitCost: num(b.unitCost),
        location: opt(b.location), supplierId: opt(b.supplierId), notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/suppliers') {
      const row = await upsert('suppliers', {
        id: uid(), name: b.name, contactName: opt(b.contactName), email: opt(b.email), phone: opt(b.phone),
        leadTimeDays: num(b.leadTimeDays, 14) || 14, notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/maintenance') {
      if (b.action === 'generate_for_unit') {
        const unit = get('units', b.unitId as string)
        if (!unit) throw new Error('unit not found')
        const types = list('maintenanceTypes').filter((t) => t.active && t.key !== 'fleet_service')
        const skip = ['yard_cleaning'] // yard cleaning is a single global schedule
        let created = 0
        for (const t of types) {
          if (skip.includes(t.key as string)) continue
          if (t.category === 'Aircon') continue // aircon schedules are per aircon equipment, not per unit
          const exists = list('maintenanceSchedules').some((s) => s.unitId === unit.id && s.typeId === t.id && s.active)
          if (exists) continue
          const last = iso(unit.buildDate) ?? now
          await upsert('maintenanceSchedules', {
            id: uid(), name: `${String(t.name).replace(' – container / outside building', '')} – ${unit.code}`, typeId: t.id, scope: 'UNIT',
            unitId: unit.id, equipmentId: null, vehicleId: null, intervalMonths: num(t.defaultIntervalMonths),
            lastDone: last, nextDue: addMonths(new Date(last), num(t.defaultIntervalMonths)).toISOString(),
            responsible: null, notes: null, active: true,
          })
          created++
        }
        // one schedule per aircon on this unit
        for (const eqItem of list('unitEquipment').filter((e) => e.unitId === unit.id && e.kind === 'AIRCON')) {
          const svcType = types.find((t) => t.key === 'aircon_service')!
          const fltType = types.find((t) => t.key === 'aircon_filter_clean')!
          const label = `${eqItem.name}${eqItem.serial ? ` (${eqItem.serial})` : ''}`
          const last = iso(eqItem.installedDate) ?? iso(unit.buildDate) ?? now
          const model = airconModelDoc(eqItem.airconModelId as string)
          const svcMonths = num(model?.serviceIntervalMonths, num(svcType.defaultIntervalMonths))
          const fltMonths = num(model?.filterCleanMonths, num(fltType.defaultIntervalMonths))
          if (!list('maintenanceSchedules').some((s) => s.equipmentId === eqItem.id && s.typeId === svcType.id)) {
            await upsert('maintenanceSchedules', {
              id: uid(), name: `Aircon service – ${unit.code} ${label}`, typeId: svcType.id, scope: 'EQUIPMENT',
              unitId: unit.id, equipmentId: eqItem.id, vehicleId: null, intervalMonths: svcMonths, lastDone: last,
              nextDue: addMonths(new Date(last), svcMonths).toISOString(), responsible: null,
              notes: model ? `Per model interval: ${svcMonths} months.` : null, active: true,
            })
            created++
          }
          if (!list('maintenanceSchedules').some((s) => s.equipmentId === eqItem.id && s.typeId === fltType.id)) {
            await upsert('maintenanceSchedules', {
              id: uid(), name: `Aircon filter clean – ${unit.code} ${label} (monthly)`, typeId: fltType.id, scope: 'EQUIPMENT',
              unitId: unit.id, equipmentId: eqItem.id, vehicleId: null, intervalMonths: fltMonths, lastDone: last,
              nextDue: addMonths(new Date(last), fltMonths).toISOString(), responsible: null, notes: null, active: true,
            })
            created++
          }
        }
        return { ok: true, created } as T
      }
      const type = get('maintenanceTypes', b.typeId as string)
      const months = num(b.intervalMonths) || num(type?.defaultIntervalMonths, 12) || 12
      const last = iso(b.lastDone)
      const schedule = await upsert('maintenanceSchedules', {
        id: uid(), name: b.name, typeId: b.typeId, scope: b.scope || 'UNIT', unitId: opt(b.unitId),
        equipmentId: opt(b.equipmentId), vehicleId: null, intervalMonths: months, lastDone: last,
        nextDue: last ? addMonths(new Date(last), months).toISOString() : null,
        responsible: opt(b.responsible), notes: opt(b.notes), active: true,
      })
      return schedule as T
    }

    if (path === '/api/qcp') {
      const row = await upsert('inspectionTemplates', {
        id: uid(), name: b.name, category: b.category || 'QCP_STAGE', stageOrder: num(b.stageOrder),
        description: opt(b.description), active: true,
        items: JSON.stringify((b.items as string[]).map((text, i) => ({ id: `i${i + 1}`, text }))),
      })
      return row as T
    }

    if (path === '/api/aircons') {
      const row = await upsert('airconModels', {
        id: uid(), brand: b.brand, model: b.model, type: b.type || 'Split inverter', btu: num(b.btu, 12000),
        serviceIntervalMonths: num(b.serviceIntervalMonths, 6), filterCleanMonths: num(b.filterCleanMonths, 1),
        supplier: opt(b.supplier), source: opt(b.source), notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/equipment') {
      const row = await upsert('unitEquipment', {
        id: uid(), unitId: b.unitId, kind: b.kind || 'AIRCON', name: b.name,
        airconModelId: opt(b.airconModelId), serial: opt(b.serial), qty: num(b.qty, 1) || 1,
        installedDate: iso(b.installedDate), notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/settings') {
      if (b.action === 'test_email') {
        const s = settingsMap()
        const to = (b.to as string || s.reminder_emails || '').split(/[,;]+/)[0]?.trim()
        if (!to) throw new Error('No recipient – set reminder emails in Settings first.')
        const subject = `Test email – ${s.company_name || 'Maintenance app'}`
        const body = 'SMTP settings work. Reminder emails will arrive from this address.'
        // No SMTP server in the offline-first app – hand the message to the device mail client.
        window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        return { ok: true, status: 'MAILTO' } as T
      }
      return { ok: false, error: 'unknown action' } as T
    }

    if (path === '/api/reminders') {
      const trigger = (b.trigger as string) || 'manual'
      const { sections, emails } = collectReminders()
      const ranAt = now
      const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Windhoek' })
      const s = settingsMap()
      const company = s.company_name || 'Maintenance'
      const subject = `[Maintenance reminders] ${company} – ${stamp} (${trigger})`
      const body = [
        `Maintenance reminders for ${company} – generated ${stamp} (${trigger}).`,
        '',
        ...sections.flatMap((sec) => [sec.title, ...sec.lines, '']),
        sections.length === 0 ? 'Nothing due right now – everything is on track.' : '',
        'Open the maintenance app for details and to log completions.',
      ].join('\n')

      let status = 'DIGEST_READY'
      if (emails.length === 0) status = 'SKIPPED_NO_RECIPIENT'
      else if (sections.length === 0) status = 'NOTHING_DUE'
      await upsert('emailLogs', { id: uid(), to: emails.join(', '), subject, body, status, error: null, createdAt: ranAt })
      await setSetting('last_reminder_run', ranAt)
      return { collected: true, emailed: false, status, sections, ranAt, subject, body, recipients: emails } as T
    }
  }

  // ---------- PUT ----------
  if (method === 'PUT') {
    if (path === '/api/units') {
      const cur = get('units', b.id as string)
      if (!cur) throw new Error('unit not found')
      const unit = await upsert('units', {
        ...cur, code: b.code, serial: opt(b.serial), type: b.type, size: opt(b.size),
        description: opt(b.description), status: b.status, client: opt(b.client), site: opt(b.site),
        dueBack: iso(b.dueBack), buildDate: iso(b.buildDate), builder: opt(b.builder), electrician: opt(b.electrician),
        plumber: opt(b.plumber), painter: opt(b.painter), glazier: opt(b.glazier), roofer: opt(b.roofer),
        otherTrade: opt(b.otherTrade), notes: opt(b.notes),
      })
      return unit as T
    }

    if (path === '/api/fleet') {
      const cur = get('fleetVehicles', b.id as string)
      if (!cur) throw new Error('vehicle not found')
      const veh = await upsert('fleetVehicles', {
        ...cur, regNo: b.regNo, make: b.make, model: b.model, type: b.type, year: b.year ? num(b.year) : null,
        odometerKm: num(b.odometerKm), status: b.status, assignedTo: opt(b.assignedTo),
        serviceIntervalKm: b.serviceIntervalKm ? num(b.serviceIntervalKm) : null,
        serviceIntervalMonths: b.serviceIntervalMonths ? num(b.serviceIntervalMonths) : null,
        lastServiceDate: iso(b.lastServiceDate), lastServiceOdometerKm: b.lastServiceOdometerKm ? num(b.lastServiceOdometerKm) : null,
        notes: opt(b.notes),
      })
      return veh as T
    }

    if (path === '/api/stock') {
      if (b.entity === 'bom') {
        const cur = get('bomItems', b.id as string)
        if (!cur) throw new Error('BOM item not found')
        const row = await upsert('bomItems', { ...cur, qtyPerUnit: num(b.qtyPerUnit, 1) || 1 })
        return row as T
      }
      const cur = get('stockItems', b.id as string)
      if (!cur) throw new Error('stock item not found')
      const row = await upsert('stockItems', {
        ...cur, name: b.name, sku: opt(b.sku), category: b.category, unit: b.unit,
        qtyOnHand: num(b.qtyOnHand), reorderPoint: num(b.reorderPoint), reorderQty: num(b.reorderQty), unitCost: num(b.unitCost),
        location: opt(b.location), supplierId: opt(b.supplierId), notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/suppliers') {
      const cur = get('suppliers', b.id as string)
      if (!cur) throw new Error('supplier not found')
      const row = await upsert('suppliers', {
        ...cur, name: b.name, contactName: opt(b.contactName), email: opt(b.email), phone: opt(b.phone),
        leadTimeDays: num(b.leadTimeDays, 14) || 14, notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/maintenance') {
      if (b.action === 'complete') {
        const sch = get('maintenanceSchedules', b.scheduleId as string)
        if (!sch) throw new Error('schedule not found')
        const date = iso(b.date) ?? now
        await upsert('maintenanceRecords', {
          id: uid(), scheduleId: sch.id, date, performedBy: opt(b.performedBy), cost: b.cost ?? null,
          findings: opt(b.findings), notes: opt(b.notes),
        })
        const next = addMonths(new Date(date), num(sch.intervalMonths))
        await upsert('maintenanceSchedules', { ...sch, lastDone: date, nextDue: next.toISOString() })
        if (sch.unitId) {
          await upsert('unitHistories', {
            id: uid(), unitId: sch.unitId, date, type: 'MAINTENANCE', refId: sch.id, person: opt(b.performedBy),
            description: `${sch.name} completed (next due ${next.toLocaleDateString('en-GB')})`,
          })
        }
        return { ok: true, nextDue: next.toISOString() } as T
      }
      const cur = get('maintenanceSchedules', b.id as string)
      if (!cur) throw new Error('schedule not found')
      const months = num(b.intervalMonths, 12) || 12
      const last = iso(b.lastDone)
      const schedule = await upsert('maintenanceSchedules', {
        ...cur, name: b.name, typeId: b.typeId, intervalMonths: months, lastDone: last,
        nextDue: last ? addMonths(new Date(last), months).toISOString() : null,
        responsible: opt(b.responsible), notes: opt(b.notes), active: b.active ?? true,
      })
      return schedule as T
    }

    if (path === '/api/qcp') {
      const cur = get('inspectionTemplates', b.id as string)
      if (!cur) throw new Error('template not found')
      const row = await upsert('inspectionTemplates', {
        ...cur, name: b.name, category: b.category, stageOrder: num(b.stageOrder), description: opt(b.description), active: cur.active ?? true,
        items: JSON.stringify((b.items as string[]).map((text, i) => ({ id: `i${i + 1}`, text }))),
      })
      return row as T
    }

    if (path === '/api/aircons') {
      const cur = get('airconModels', b.id as string)
      if (!cur) throw new Error('aircon model not found')
      const row = await upsert('airconModels', {
        ...cur, brand: b.brand, model: b.model, type: b.type, btu: num(b.btu, 12000),
        serviceIntervalMonths: num(b.serviceIntervalMonths, 6), filterCleanMonths: num(b.filterCleanMonths, 1),
        supplier: opt(b.supplier), source: opt(b.source), notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/equipment') {
      const cur = get('unitEquipment', b.id as string)
      if (!cur) throw new Error('equipment not found')
      const row = await upsert('unitEquipment', {
        ...cur, kind: b.kind, name: b.name, airconModelId: opt(b.airconModelId), serial: opt(b.serial),
        qty: num(b.qty, 1) || 1, installedDate: iso(b.installedDate), notes: opt(b.notes),
      })
      return row as T
    }

    if (path === '/api/settings') {
      const map = (b.settings ?? {}) as Record<string, string>
      for (const [k, v] of Object.entries(map)) await setSetting(k, String(v ?? ''))
      return { ok: true } as T
    }
  }

  // ---------- DELETE ----------
  if (method === 'DELETE') {
    const id = q.get('id')
    const entity = q.get('entity')
    if (!id) throw new Error('id required')

    if (path === '/api/units') {
      for (const e of list('unitEquipment').filter((x) => x.unitId === id)) await remove('unitEquipment', e.id)
      for (const s of list('maintenanceSchedules').filter((x) => x.unitId === id)) await remove('maintenanceSchedules', s.id)
      for (const h of list('unitHistories').filter((x) => x.unitId === id)) await remove('unitHistories', h.id)
      for (const i of list('inspections').filter((x) => x.unitId === id)) await remove('inspections', i.id)
      await remove('units', id)
      return { ok: true } as T
    }

    if (path === '/api/inspections') {
      await remove('inspections', id)
      return { ok: true } as T
    }

    if (path === '/api/fleet') {
      if (entity === 'record') await remove('fleetRecords', id)
      else {
        for (const r of list('fleetRecords').filter((x) => x.vehicleId === id)) await remove('fleetRecords', r.id)
        for (const i of list('inspections').filter((x) => x.vehicleId === id)) await remove('inspections', i.id)
        await remove('fleetVehicles', id)
      }
      return { ok: true } as T
    }

    if (path === '/api/stock') {
      if (entity === 'bom') await remove('bomItems', id)
      else {
        for (const bom of list('bomItems').filter((x) => x.stockItemId === id)) await remove('bomItems', bom.id)
        await remove('stockItems', id)
      }
      return { ok: true } as T
    }

    if (path === '/api/suppliers') {
      for (const i of list('stockItems').filter((x) => x.supplierId === id)) await upsert('stockItems', { ...i, supplierId: null })
      await remove('suppliers', id)
      return { ok: true } as T
    }

    if (path === '/api/maintenance') {
      for (const r of list('maintenanceRecords').filter((x) => x.scheduleId === id)) await remove('maintenanceRecords', r.id)
      await remove('maintenanceSchedules', id)
      return { ok: true } as T
    }

    if (path === '/api/qcp') {
      await remove('inspectionTemplates', id)
      return { ok: true } as T
    }

    if (path === '/api/aircons') {
      for (const e of list('unitEquipment').filter((x) => x.airconModelId === id)) await upsert('unitEquipment', { ...e, airconModelId: null })
      await remove('airconModels', id)
      return { ok: true } as T
    }

    if (path === '/api/equipment') {
      await remove('unitEquipment', id)
      return { ok: true } as T
    }
  }

  throw new Error(`${method} ${url} failed (unknown route in offline mode)`)
}

export type { Collection }
