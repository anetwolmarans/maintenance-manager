// Runs once when the Next.js server starts – checks reminders every 30 minutes.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { runReminders } = await import('@/lib/reminders')
  const check = async () => {
    try {
      const r = await runReminders('scheduled check')
      console.log(`[reminders] ${new Date().toISOString()} status=${r.status} sections=${r.sections.length}`)
    } catch (e) {
      console.error('[reminders] failed', e)
    }
  }
  // first check shortly after boot, then every 30 minutes
  setTimeout(check, 30 * 1000)
  setInterval(check, 30 * 60 * 1000)
}
