'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiSend, fmtDate } from '@/lib/api'
import { downloadStockReport } from '@/lib/pdf'
import type { StockData, StockItem, Supplier, BomItem } from '@/lib/types'
import { ViewTitle } from '@/components/views/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, FileDown, PackageCheck, Mail } from 'lucide-react'

const emptyItem = { id: '', name: '', sku: '', category: 'General', unit: 'ea', qtyOnHand: 0, reorderPoint: 0, reorderQty: 0, unitCost: 0, location: 'Yard store', supplierId: '', notes: '' }
const emptySup = { id: '', name: '', contactName: '', email: '', phone: '', leadTimeDays: 14, notes: '' }

export function StockView({ refreshKey, onNavigate }: { refreshKey: number; onNavigate: (v: string) => void }) {
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('items')
  const [q, setQ] = useState('')
  const [itemEdit, setItemEdit] = useState<typeof emptyItem | null>(null)
  const [supEdit, setSupEdit] = useState<typeof emptySup | null>(null)
  const [bomAdd, setBomAdd] = useState<{ stockItemId: string; qtyPerUnit: number } | null>(null)
  const [bomEdit, setBomEdit] = useState<BomItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ id: string; entity?: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try { setData(await apiGet<StockData>('/api/stock')) } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const lowItems = useMemo(() => (data?.items || []).filter((i) => i.qtyOnHand <= i.reorderPoint), [data])
  const filteredItems = useMemo(() => (data?.items || []).filter((i) => `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q.toLowerCase())), [data, q])

  const saveItem = async () => {
    if (!itemEdit) return
    if (!itemEdit.name.trim()) { toast.error('Item name required'); return }
    try {
      if (itemEdit.id) await apiSend('/api/stock', 'PUT', itemEdit)
      else await apiSend('/api/stock', 'POST', itemEdit)
      toast.success('Stock item saved'); setItemEdit(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const saveSup = async () => {
    if (!supEdit) return
    if (!supEdit.name.trim()) { toast.error('Supplier name required'); return }
    try {
      if (supEdit.id) await apiSend('/api/suppliers', 'PUT', supEdit)
      else await apiSend('/api/suppliers', 'POST', supEdit)
      toast.success('Supplier saved'); setSupEdit(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const del = async () => {
    if (!deleteItem) return
    try {
      await apiSend(`/api/stock?id=${deleteItem.id}${deleteItem.entity ? `&entity=${deleteItem.entity}` : ''}`, 'DELETE')
      setDeleteItem(null); toast.success('Deleted'); load()
    } catch (e) { toast.error(e.message) }
  }

  const saveBom = async () => {
    if (bomEdit) {
      await apiSend('/api/stock', 'PUT', { entity: 'bom', id: bomEdit.id, qtyPerUnit: bomEdit.qtyPerUnit })
      setBomEdit(null); load(); toast.success('BOM updated')
    } else if (bomAdd) {
      if (!bomAdd.stockItemId) { toast.error('Choose an item'); return }
      await apiSend('/api/stock', 'POST', { entity: 'bom', ...bomAdd })
      setBomAdd(null); load(); toast.success('Added to BOM')
    }
  }

  const reorderValue = (i: StockItem) => i.reorderQty * i.unitCost

  return (
    <div>
      <ViewTitle
        title="Stock & purchasing"
        subtitle="Materials on hand, standard-container BOM, reorder points with supplier lead times"
        action={<Button variant="outline" size="sm" onClick={() => data && downloadStockReport(data as never, 'Maintenance')}><FileDown className="h-4 w-4 mr-1" /> Stock report (PDF)</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto [&>[data-slot=tabs-trigger]]:h-auto [&>[data-slot=tabs-trigger]]:flex-none">
            <TabsTrigger value="items">Stock items</TabsTrigger>
            <TabsTrigger value="reorder">Reorder ({lowItems.length})</TabsTrigger>
            <TabsTrigger value="bom">Standard container BOM</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'items' && (
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search stock…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </div>

      {tab === 'items' && (
        <Card>
          <CardContent className="px-2 sm:px-4 py-2">
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => setItemEdit({ ...emptyItem })}><Plus className="h-4 w-4 mr-1" /> Add item</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead className="hidden sm:table-cell">Reorder at</TableHead>
                    <TableHead className="hidden lg:table-cell">Supplier</TableHead>
                    <TableHead className="hidden lg:table-cell">Lead</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    : filteredItems.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.sku || ''} · N$ {i.unitCost}/{i.unit}</p></TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{i.category}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${i.qtyOnHand <= i.reorderPoint ? 'text-red-600' : ''}`}>{i.qtyOnHand} {i.unit}</span>
                          {i.qtyOnHand <= i.reorderPoint && <Badge className="ml-1.5 bg-red-100 text-red-800">order</Badge>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{i.reorderPoint} {i.unit}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{i.supplier?.name || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{i.supplier ? `${i.supplier.leadTimeDays} d` : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItemEdit({ ...emptyItem, ...i, supplierId: i.supplierId || '', id: i.id })}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteItem({ id: i.id })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'reorder' && (
        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5"><PackageCheck className="h-4 w-4 text-emerald-600" /> Items at or below reorder point. Arrival dates account for each supplier&apos;s <b>adjustable lead time</b>.</p>
              <Button size="sm" onClick={() => onNavigate('settings')}><Mail className="h-4 w-4 mr-1" /> Reminder settings</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Order qty</TableHead><TableHead>Supplier</TableHead><TableHead>Lead time</TableHead><TableHead>Expected arrival</TableHead><TableHead>Est. cost</TableHead></TableRow></TableHeader>
                <TableBody>
                  {lowItems.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nothing to reorder right now.</TableCell></TableRow>
                    : lowItems.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm font-medium">{i.name}<span className="block text-xs text-muted-foreground">on hand {i.qtyOnHand} / reorder at {i.reorderPoint} {i.unit}</span></TableCell>
                        <TableCell className="text-sm">{i.reorderQty} {i.unit}</TableCell>
                        <TableCell className="text-sm">{i.supplier?.name || <span className="text-red-600">set supplier</span>}</TableCell>
                        <TableCell className="text-sm">{i.supplier ? `${i.supplier.leadTimeDays} days` : '-'}</TableCell>
                        <TableCell className="text-sm">{i.supplier ? fmtDate(new Date(Date.now() + i.supplier.leadTimeDays * 86400000)) : '-'}</TableCell>
                        <TableCell className="text-sm">N$ {reorderValue(i).toLocaleString('en')}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {lowItems.length > 0 && (
              <p className="text-sm font-medium mt-3">Estimated reorder total: N$ {lowItems.reduce((n, i) => n + reorderValue(i), 0).toLocaleString('en')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'bom' && data && (
        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm text-muted-foreground">What is needed to build <b>one standard container</b>. With current stock you can complete <b className="text-emerald-700">{data.containersBuildable}</b> container build(s).</p>
              <Button size="sm" onClick={() => setBomAdd({ stockItemId: '', qtyPerUnit: 1 })}><Plus className="h-4 w-4 mr-1" /> Add BOM line</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty per container</TableHead><TableHead>On hand</TableHead><TableHead>Covers</TableHead><TableHead>Unit cost</TableHead><TableHead>Line total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.bom.map((b) => (
                    <TableRow key={b.id} className={b.canBuild === 0 ? 'bg-red-50/50' : ''}>
                      <TableCell className="text-sm font-medium">{b.stockItem.name}</TableCell>
                      <TableCell className="text-sm">{b.qtyPerUnit} {b.stockItem.unit}</TableCell>
                      <TableCell className="text-sm">{b.stockItem.qtyOnHand} {b.stockItem.unit}</TableCell>
                      <TableCell className="text-sm">{b.canBuild}</TableCell>
                      <TableCell className="text-sm">N$ {b.stockItem.unitCost}</TableCell>
                      <TableCell className="text-sm">N$ {(b.qtyPerUnit * b.stockItem.unitCost).toLocaleString('en')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBomEdit(b)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteItem({ id: b.id, entity: 'bom' })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'suppliers' && data && (
        <Card>
          <CardContent className="px-4 py-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setSupEdit({ ...emptySup })}><Plus className="h-4 w-4 mr-1" /> Add supplier</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {data.suppliers.map((s: Supplier) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.contactName || ''} {s.email || ''} {s.phone || ''}</p>
                      {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSupEdit({ ...emptySup, ...s })}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteItem({ id: s.id })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800">Lead time: {s.leadTimeDays} days (adjustable)</Badge>
                    <Badge variant="outline">{(s.stockItems || []).length} stock item(s)</Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Delete redirects items to “no supplier”. Adjust lead time any time – reorder dates and reminder emails use the new value immediately.</p>
          </CardContent>
        </Card>
      )}

      {/* Item dialog */}
      <Dialog open={Boolean(itemEdit)} onOpenChange={(v) => !v && setItemEdit(null)}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{itemEdit?.id ? 'Edit stock item' : 'Add stock item'}</DialogTitle></DialogHeader>
          {itemEdit && (
            <div className="grid gap-3">
              <div><Label>Item name *</Label><Input value={itemEdit.name} onChange={(e) => setItemEdit({ ...itemEdit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU</Label><Input value={itemEdit.sku} onChange={(e) => setItemEdit({ ...itemEdit, sku: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={itemEdit.category} onChange={(e) => setItemEdit({ ...itemEdit, category: e.target.value })} /></div>
                <div><Label>Unit</Label><Input value={itemEdit.unit} onChange={(e) => setItemEdit({ ...itemEdit, unit: e.target.value })} placeholder="ea / sheet / tin / roll" /></div>
                <div><Label>Location</Label><Input value={itemEdit.location} onChange={(e) => setItemEdit({ ...itemEdit, location: e.target.value })} /></div>
                <div><Label>Qty on hand</Label><Input type="number" value={itemEdit.qtyOnHand} onChange={(e) => setItemEdit({ ...itemEdit, qtyOnHand: Number(e.target.value) })} /></div>
                <div><Label>Reorder point</Label><Input type="number" value={itemEdit.reorderPoint} onChange={(e) => setItemEdit({ ...itemEdit, reorderPoint: Number(e.target.value) })} /></div>
                <div><Label>Reorder qty</Label><Input type="number" value={itemEdit.reorderQty} onChange={(e) => setItemEdit({ ...itemEdit, reorderQty: Number(e.target.value) })} /></div>
                <div><Label>Unit cost (N$)</Label><Input type="number" value={itemEdit.unitCost} onChange={(e) => setItemEdit({ ...itemEdit, unitCost: Number(e.target.value) })} /></div>
              </div>
              <div>
                <Label>Supplier</Label>
                <Select value={itemEdit.supplierId} onValueChange={(v) => setItemEdit({ ...itemEdit, supplierId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">– none –</SelectItem>
                    {(data?.suppliers || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.leadTimeDays} d)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Input value={itemEdit.notes} onChange={(e) => setItemEdit({ ...itemEdit, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setItemEdit(null)}>Cancel</Button><Button onClick={saveItem}>Save</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Supplier dialog */}
      <Dialog open={Boolean(supEdit)} onOpenChange={(v) => !v && setSupEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{supEdit?.id ? 'Edit supplier' : 'Add supplier'}</DialogTitle></DialogHeader>
          {supEdit && (
            <div className="grid gap-3">
              <div><Label>Name *</Label><Input value={supEdit.name} onChange={(e) => setSupEdit({ ...supEdit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact person</Label><Input value={supEdit.contactName} onChange={(e) => setSupEdit({ ...supEdit, contactName: e.target.value })} /></div>
                <div><Label>Lead time (days) *</Label><Input type="number" min={0} value={supEdit.leadTimeDays} onChange={(e) => setSupEdit({ ...supEdit, leadTimeDays: Number(e.target.value) })} /></div>
                <div><Label>Email</Label><Input type="email" value={supEdit.email} onChange={(e) => setSupEdit({ ...supEdit, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={supEdit.phone} onChange={(e) => setSupEdit({ ...supEdit, phone: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={supEdit.notes} onChange={(e) => setSupEdit({ ...supEdit, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSupEdit(null)}>Cancel</Button><Button onClick={saveSup}>Save</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BOM add/edit dialog */}
      <Dialog open={Boolean(bomAdd || bomEdit)} onOpenChange={(v) => { if (!v) { setBomAdd(null); setBomEdit(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{bomEdit ? 'Edit BOM quantity' : 'Add BOM line'}</DialogTitle></DialogHeader>
          {(bomAdd || bomEdit) && (
            <div className="grid gap-3">
              {!bomEdit && (
                <div>
                  <Label>Stock item</Label>
                  <Select value={bomAdd?.stockItemId || ''} onValueChange={(v) => setBomAdd({ ...(bomAdd || { qtyPerUnit: 1 }), stockItemId: v, qtyPerUnit: bomAdd?.qtyPerUnit || 1 })}>
                    <SelectTrigger><SelectValue placeholder="Choose stock item" /></SelectTrigger>
                    <SelectContent>{(data?.items || []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Qty per container</Label><Input type="number" min={0.5} step={0.5} value={bomEdit?.qtyPerUnit ?? bomAdd?.qtyPerUnit} onChange={(e) => {
                const v = Number(e.target.value)
                if (bomEdit) setBomEdit({ ...bomEdit, qtyPerUnit: v }); else setBomAdd({ ...(bomAdd as { stockItemId: string; qtyPerUnit: number }), qtyPerUnit: v })
              }} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setBomAdd(null); setBomEdit(null) }}>Cancel</Button><Button onClick={saveBom}>Save</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(v) => !v && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
