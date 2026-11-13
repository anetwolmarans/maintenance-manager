'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiSend, fmtDateTime } from '@/lib/api'
import type { AirconModel, EmailLog } from '@/lib/types'
import { ViewTitle } from '@/components/views/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, MailCheck, Smartphone, Download, Share2, Settings2, Save, Send, RefreshCw } from 'lucide-react'

const emptyAir = { id: '', brand: '', model: '', type: 'Split inverter', btu: 12000, serviceIntervalMonths: 6, filterCleanMonths: 1, supplier: '', source: '', notes: '' }

export function SettingsView({ refreshKey }: { refreshKey: number }) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [aircons, setAircons] = useState<AirconModel[]>([])
  const [airEdit, setAirEdit] = useState<typeof emptyAir | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [tab, setTab] = useState('company')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, a] = await Promise.all([
        apiGet<{ settings: Record<string, string>; emailLogs: EmailLog[] }>('/api/settings'),
        apiGet<AirconModel[]>('/api/aircons'),
      ])
      setSettings(s.settings); setEmailLogs(s.emailLogs); setAircons(a)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const set = (k: string, v: string | boolean) => setSettings((s) => ({ ...s, [k]: v === true ? 'true' : v === false ? 'false' : v }))

  const save = async () => {
    try { await apiSend('/api/settings', 'PUT', { settings }); toast.success('Settings saved') } catch (e) { toast.error(e.message) }
  }

  const testEmail = async () => {
    setTesting(true)
    try {
      await apiSend('/api/settings', 'PUT', { settings })
      const r = await apiSend<{ ok: boolean; status?: string; error?: string }>('/api/settings', 'POST', { action: 'test_email' })
      if (r.ok) toast.success('Test email sent – check the inbox')
      else toast.warning(r.error || 'Email failed – check SMTP settings')
      load()
    } catch (e) { toast.error(e.message) } finally { setTesting(false) }
  }

  const saveAir = async () => {
    if (!airEdit) return
    if (!airEdit.brand.trim() || !airEdit.model.trim()) { toast.error('Brand and model required'); return }
    try {
      if (airEdit.id) await apiSend('/api/aircons', 'PUT', airEdit)
      else await apiSend('/api/aircons', 'POST', airEdit)
      toast.success('Aircon model saved'); setAirEdit(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const del = async () => {
    if (!deleteId) return
    try { await apiSend(`/api/aircons?id=${deleteId}`, 'DELETE'); setDeleteId(null); toast.success('Model deleted'); load() } catch (e) { toast.error(e.message) }
  }

  const field = (k: string, label: string, placeholder?: string, type = 'text') => (
    <div key={k}>
      <Label>{label}</Label>
      <Input type={type} value={settings[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </div>
  )

  return (
    <div>
      <ViewTitle
        title="Settings"
        subtitle="Company details, email reminders, aircon model catalogue and mobile app install"
        action={<Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1" /> Save settings</Button>}
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex-wrap h-auto [&>[data-slot=tabs-trigger]]:h-auto [&>[data-slot=tabs-trigger]]:flex-none">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="email">Email reminders</TabsTrigger>
          <TabsTrigger value="aircons">Aircon models</TabsTrigger>
          <TabsTrigger value="mobile">Mobile / APK</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'company' && (
        <Card className="max-w-xl">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> Company details</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <>
                {field('company_name', 'Company name')}
                {field('company_slogan', 'Slogan (shown under the company name)')}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'email' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MailCheck className="h-4 w-4" /> Reminder emails</CardTitle><CardDescription>The app checks every 30 minutes and emails maintenance due soon, stock below reorder point (with supplier lead times) and fleet services due.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <div>
                <Label>Send reminders to (comma-separated)</Label>
                <Input value={settings.reminder_emails ?? ''} onChange={(e) => set('reminder_emails', e.target.value)} placeholder="owner@example.com, workshop@example.com" />
              </div>
              <div>
                <Label>Remind me this many days before due</Label>
                <Input type="number" min={1} value={settings.reminder_days_ahead ?? '14'} onChange={(e) => set('reminder_days_ahead', e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={settings.reminders_enabled !== 'false'} onCheckedChange={(v) => set('reminders_enabled', v)} id="reminders" />
                <Label htmlFor="reminders">Email reminders enabled</Label>
              </div>
              <p className="text-xs text-muted-foreground">Last automatic check: {settings.last_reminder_run ? fmtDateTime(settings.last_reminder_run) : 'never yet'}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testEmail} disabled={testing}><Send className="h-4 w-4 mr-1" /> Send test email</Button>
                <Button variant="outline" onClick={save}><RefreshCw className="h-4 w-4 mr-1" /> Save</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">SMTP server</CardTitle><CardDescription>Use your mailbox provider&apos;s SMTP details (e.g. Gmail app password, or your Namibian ISP/webmail SMTP).</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {field('smtp_host', 'SMTP host', 'smtp.example.com.na')}
              <div className="grid grid-cols-2 gap-3">
                {field('smtp_port', 'Port', '587')}
                <div>
                  <Label>Secure (TLS/SSL)</Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={settings.smtp_secure === 'true'} onCheckedChange={(v) => set('smtp_secure', v)} id="secure" />
                    <Label htmlFor="secure" className="text-sm text-muted-foreground">{settings.smtp_secure === 'true' ? 'SSL (port 465)' : 'STARTTLS (587)'}</Label>
                  </div>
                </div>
              </div>
              {field('smtp_user', 'SMTP username', 'you@example.com')}
              {field('smtp_pass', 'SMTP password / app password', '', 'password')}
              {field('smtp_from', 'From address', 'maintenance@example.com.na')}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Email log (last 20)</CardTitle></CardHeader>
            <CardContent className="px-2 sm:px-4">
              <Table>
                <TableHeader><TableRow><TableHead>Sent at</TableHead><TableHead>To</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {emailLogs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No emails sent yet.</TableCell></TableRow>
                    : emailLogs.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{fmtDateTime(e.createdAt)}</TableCell>
                        <TableCell className="text-sm">{e.to}</TableCell>
                        <TableCell className="text-sm max-w-72 truncate">{e.subject}</TableCell>
                        <TableCell><Badge variant="outline" className={e.status === 'SENT' ? 'text-emerald-700' : 'text-red-600'}>{e.status}</Badge>{e.error && <span className="block text-xs text-muted-foreground max-w-56 truncate">{e.error}</span>}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'aircons' && (
        <Card>
          <CardHeader className="pb-2 flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">Aircon model catalogue</CardTitle>
              <CardDescription>Models commonly available in Namibia with their service intervals. Sources: Pupkewitz Megabuild (shop.megabuild.com.na), Gree Namibia / Cold Air Technologies (gree-namibia.com), GMC Airconditioning Namibia. Intervals: 6–12 months for full service in dusty conditions, filter clean every 30–60 days. Edit to match your own units.</CardDescription>
            </div>
            <Button size="sm" className="shrink-0 self-start w-auto" onClick={() => setAirEdit({ ...emptyAir })}><Plus className="h-4 w-4 mr-1" /> Add model</Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <Table>
              <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Model</TableHead><TableHead className="hidden md:table-cell">Type</TableHead><TableHead>BTU</TableHead><TableHead>Service every</TableHead><TableHead className="hidden sm:table-cell">Filter clean</TableHead><TableHead className="hidden lg:table-cell">Source</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {aircons.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.brand}</TableCell>
                    <TableCell className="text-sm">{a.model}{a.equipment && a.equipment.length > 0 ? <span className="block text-xs text-muted-foreground">fitted on {a.equipment.length} unit(s)</span> : null}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{a.type}</TableCell>
                    <TableCell className="text-sm">{a.btu.toLocaleString('en')}</TableCell>
                    <TableCell className="text-sm">{a.serviceIntervalMonths} mo</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{a.filterCleanMonths} mo</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{a.source || ''}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAirEdit({ ...emptyAir, ...a })}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'mobile' && (
        <Card className="max-w-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" /> Install on phones & tablets (Android APK)</CardTitle>
            <CardDescription>The app is a PWA – it installs on any Android phone or tablet like a normal app, works full-screen and is touch-friendly (signature pad included).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium mb-1.5 flex items-center gap-2"><Download className="h-4 w-4 text-emerald-600" /> Install directly (no APK file needed)</p>
              <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                <li>Open this app in <b>Chrome</b> on your Android phone/tablet.</li>
                <li>Tap the <b>⋮ menu → “Add to Home screen” / “Install app”</b>.</li>
                <li>Confirm. The app icon appears in your app drawer and launches full-screen.</li>
              </ol>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium mb-1.5 flex items-center gap-2"><Settings2 className="h-4 w-4 text-emerald-600" /> Build a real APK file</p>
              <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                <li>Deploy the app to a public URL (e.g. Vercel, or your own server).</li>
                <li>Go to <b>pwabuilder.com</b>, paste your URL and choose <b>Android package</b>.</li>
                <li>Download the generated APK/AAB and install or publish it to Play Store.</li>
              </ol>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium mb-1.5 flex items-center gap-2"><Share2 className="h-4 w-4 text-emerald-600" /> Tips for tablet use</p>
              <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                <li>Inspection forms and the signature pad are sized for tablet screens – sign with finger or stylus.</li>
                <li>Reminders keep working while the app is installed, because they are checked on the server every 30 minutes.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aircon model dialog */}
      <Dialog open={Boolean(airEdit)} onOpenChange={(v) => !v && setAirEdit(null)}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{airEdit?.id ? 'Edit aircon model' : 'Add aircon model'}</DialogTitle></DialogHeader>
          {airEdit && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Brand *</Label><Input value={airEdit.brand} onChange={(e) => setAirEdit({ ...airEdit, brand: e.target.value })} placeholder="e.g. Samsung" /></div>
                <div><Label>Model *</Label><Input value={airEdit.model} onChange={(e) => setAirEdit({ ...airEdit, model: e.target.value })} /></div>
                <div><Label>Type</Label><Input value={airEdit.type} onChange={(e) => setAirEdit({ ...airEdit, type: e.target.value })} /></div>
                <div><Label>BTU</Label><Input type="number" value={airEdit.btu} onChange={(e) => setAirEdit({ ...airEdit, btu: Number(e.target.value) })} /></div>
                <div><Label>Service interval (months)</Label><Input type="number" value={airEdit.serviceIntervalMonths} onChange={(e) => setAirEdit({ ...airEdit, serviceIntervalMonths: Number(e.target.value) })} /></div>
                <div><Label>Filter clean (months)</Label><Input type="number" value={airEdit.filterCleanMonths} onChange={(e) => setAirEdit({ ...airEdit, filterCleanMonths: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Supplier</Label><Input value={airEdit.supplier} onChange={(e) => setAirEdit({ ...airEdit, supplier: e.target.value })} /></div>
              <div><Label>Where sold / source</Label><Input value={airEdit.source} onChange={(e) => setAirEdit({ ...airEdit, source: e.target.value })} placeholder="e.g. Pupkewitz Megabuild" /></div>
              <div><Label>Notes</Label><Input value={airEdit.notes} onChange={(e) => setAirEdit({ ...airEdit, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAirEdit(null)}>Cancel</Button><Button onClick={saveAir}>Save model</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete aircon model?</AlertDialogTitle><AlertDialogDescription>Units using this model keep their equipment entry, but lose the model link.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
