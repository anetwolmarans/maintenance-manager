import { NextRequest } from 'next/server'
import { collectReminders, runReminders } from '@/lib/reminders'

export async function GET() {
  const r = await collectReminders()
  return Response.json(r)
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const trigger = b.trigger || 'manual'
  const r = await runReminders(trigger)
  return Response.json(r)
}
