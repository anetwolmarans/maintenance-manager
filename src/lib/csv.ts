/**
 * Minimal CSV support for bulk imports: RFC4180-style parsing (quoted fields,
 * escaped quotes, CRLF, BOM) and template downloads for the import dialog.
 */

/** Parse CSV text into a table of string cells. */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

/** Normalise a header for tolerant matching (case, spaces, punctuation). */
export const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Parse CSV text into objects keyed by the file's header row. */
export function csvObjects(text: string): Record<string, string>[] {
  const table = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''))
  if (table.length < 2) return []
  const heads = table[0].map(normHeader)
  return table.slice(1).map((r) => {
    const o: Record<string, string> = {}
    heads.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
    return o
  })
}

/** Download a CSV template (headers + one example row) for an import dialog. */
export function downloadTemplate(filename: string, headers: string[], example: string[]): void {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [headers, example].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Coerce a CSV cell to a number, or undefined when blank/invalid. */
export const csvNum = (v?: string): number | undefined => {
  const t = (v ?? '').trim()
  if (t === '' || isNaN(Number(t.replace(',', '.')))) return undefined
  return Number(t.replace(',', '.'))
}
