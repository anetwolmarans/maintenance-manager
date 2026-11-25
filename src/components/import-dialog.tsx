'use client'

/**
 * Generic CSV bulk-import wizard: download a column template, pick the filled-in
 * file, preview it, then run each row through the view's importer with a
 * per-row error report. The view supplies the column config and the importer.
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CircleCheck, Download, FileUp, XCircle } from 'lucide-react'
import { csvNum, downloadTemplate, normHeader, parseCsv } from '@/lib/csv'

export interface ImportConfig {
  filename: string
  headers: string[]
  example: string[]
  required: string[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  config: ImportConfig
  /** Import one row (n = spreadsheet row number, for error messages). */
  importer: (row: Record<string, string>, n: number) => Promise<void>
  onDone: () => void
}

export function ImportDialog({ open, onOpenChange, title, config, importer, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [doing, setDoing] = useState(false)
  const [at, setAt] = useState(0)
  const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null)

  const reset = () => { setFileName(''); setRows([]); setMissing([]); setDoing(false); setAt(0); setResult(null); if (fileRef.current) fileRef.current.value = '' }

  const pick = async (file: File | undefined) => {
    if (!file) return
    reset()
    try {
      const table = parseCsv(await file.text()).filter((r) => r.some((c) => c.trim() !== ''))
      if (table.length < 2) { toast.error('No data rows found – keep the header row and put your rows below it'); return }
      const heads = table[0].map(normHeader)
      const reqMiss = config.required.filter((h) => !heads.includes(normHeader(h)))
      setMissing(reqMiss)
      setFileName(file.name)
      setRows(table.slice(1).map((r) => {
        const o: Record<string, string> = {}
        config.headers.forEach((h) => {
          const i = heads.indexOf(normHeader(h))
          if (i >= 0) o[h] = (r[i] ?? '').trim()
        })
        return o
      }))
    } catch { toast.error('Could not read that file – save it as CSV (.csv) and try again') }
  }

  const run = async () => {
    setDoing(true)
    const errors: string[] = []
    let ok = 0
    for (let n = 0; n < rows.length; n++) {
      setAt(n + 1)
      try { await importer(rows[n], n + 2); ok++ } catch (e) { errors.push(`Row ${n + 2}: ${(e as Error).message}`) }
    }
    setDoing(false)
    setResult({ ok, errors })
    if (ok > 0) onDone()
  }

  const preview = rows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!doing) { onOpenChange(v); if (!v) reset() } }}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-teal-700" /> {title}</DialogTitle></DialogHeader>

        {!rows.length && (
          <div className="space-y-3 text-sm">
            <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
              <li>Download the template – it has the exact columns this import expects.</li>
              <li>Fill in your rows below the header row (Excel/Google Sheets: Save as → CSV).</li>
              <li>Choose the saved .csv file here and check the preview, then import.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(config.filename, config.headers, config.example)}>
                <Download className="h-4 w-4 mr-1" /> Download template
              </Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                <FileUp className="h-4 w-4 mr-1" /> Choose CSV file
              </Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {rows.length > 0 && !result && (
          <div className="space-y-3 text-sm">
            <p><span className="font-medium">{rows.length}</span> row(s) found in <span className="font-medium">{fileName}</span>.</p>
            {missing.length > 0 && (
              <p className="text-red-600 text-sm font-medium">This file is missing the required column(s): {missing.join(', ')}. Download the template and make sure the header row spells them exactly like that.</p>
            )}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/50">{config.headers.slice(0, 4).map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t">
                      {config.headers.slice(0, 4).map((h) => <td key={h} className="px-2 py-1.5 max-w-40 truncate">{r[h] || <span className="text-muted-foreground">–</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && <p className="text-xs text-muted-foreground">Showing the first 5 of {rows.length} rows.</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Pick a different file</Button>
              <Button size="sm" disabled={doing || missing.length > 0 || rows.length === 0} onClick={run}>
                {doing ? `Importing… ${at}/${rows.length}` : `Import ${rows.length} row(s)`}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><CircleCheck className="h-5 w-5 text-emerald-600" /> Imported {result.ok} row(s){result.errors.length ? `, ${result.errors.length} failed` : ''}.</p>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-700 flex gap-1"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{e}</p>)}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Import another file</Button>
              <Button size="sm" onClick={() => { onOpenChange(false); reset() }}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
