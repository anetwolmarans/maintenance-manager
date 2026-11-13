import nodemailer from 'nodemailer'
import { getSettings } from '@/lib/settings'
import { db } from '@/lib/db'

export async function sendMail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string; status: string }> {
  const s = await getSettings()
  if ((s.reminders_enabled ?? 'true') !== 'true') {
    await db.emailLog.create({ data: { to, subject, body, status: 'SKIPPED_DISABLED' } })
    return { ok: false, status: 'SKIPPED_DISABLED', error: 'Reminders are disabled in Settings.' }
  }
  if (!s.smtp_host || !to) {
    await db.emailLog.create({ data: { to, subject, body, status: 'SKIPPED_NO_SMTP' } })
    return { ok: false, status: 'SKIPPED_NO_SMTP', error: 'SMTP host or recipient not configured in Settings.' }
  }
  try {
    const transport = nodemailer.createTransport({
      host: s.smtp_host,
      port: Number(s.smtp_port || 587),
      secure: (s.smtp_secure ?? 'false') === 'true' || Number(s.smtp_port) === 465,
      auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    })
    const from = s.smtp_from || s.smtp_user || 'maintenance@localhost'
    await transport.sendMail({ from, to, subject, text: body })
    await db.emailLog.create({ data: { to, subject, body, status: 'SENT' } })
    return { ok: true, status: 'SENT' }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await db.emailLog.create({ data: { to, subject, body, status: 'FAILED', error } })
    return { ok: false, status: 'FAILED', error }
  }
}
