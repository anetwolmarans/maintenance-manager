import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSettings, setSetting } from '@/lib/settings'
import { sendMail } from '@/lib/mail'

export async function GET() {
  const [settings, emailLogs] = await Promise.all([
    getSettings(),
    db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ])
  return Response.json({ settings, emailLogs })
}

export async function PUT(req: NextRequest) {
  const b = await req.json()
  const map: Record<string, string> = b.settings || {}
  for (const [k, v] of Object.entries(map)) await setSetting(k, String(v ?? ''))
  return Response.json({ ok: true })
}

// POST: send a test email using current SMTP settings
export async function POST(req: NextRequest) {
  const b = await req.json()
  if (b.action === 'test_email') {
    const s = await getSettings()
    const to = (b.to || s.reminder_emails || '').split(/[,;]+/)[0]?.trim()
    if (!to) return Response.json({ ok: false, error: 'No recipient – set reminder emails in Settings first.' }, { status: 400 })
    const r = await sendMail(to, `Test email – ${s.company_name || 'Maintenance app'}`, 'SMTP settings work. Reminder emails will arrive from this address.')
    return Response.json(r)
  }
  return Response.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
