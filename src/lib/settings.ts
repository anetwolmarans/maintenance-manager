import { db } from '@/lib/db'

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value ?? ''
  return map
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 3600 * 1000)
}
