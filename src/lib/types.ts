// Shared API data shapes (JSON from API routes)

export interface AirconModel {
  id: string
  brand: string
  model: string
  type: string
  btu: number
  serviceIntervalMonths: number
  filterCleanMonths: number
  supplier?: string | null
  source?: string | null
  notes?: string | null
  equipment?: UnitEquipment[]
}

export interface UnitEquipment {
  id: string
  unitId: string
  kind: string
  name: string
  airconModelId?: string | null
  airconModel?: AirconModel | null
  serial?: string | null
  qty: number
  installedDate?: string | null
  notes?: string | null
}

export interface MaintenanceRecord {
  id: string
  scheduleId: string
  date: string
  performedBy?: string | null
  cost?: number | null
  findings?: string | null
  notes?: string | null
}

export interface MaintenanceSchedule {
  id: string
  name: string
  typeId: string
  type: MaintenanceType
  scope: string
  unitId?: string | null
  unit?: { code: string; description?: string } | null
  equipmentId?: string | null
  vehicleId?: string | null
  intervalMonths: number
  lastDone?: string | null
  nextDue?: string | null
  responsible?: string | null
  notes?: string | null
  active: boolean
  records?: MaintenanceRecord[]
}

export interface MaintenanceType {
  id: string
  key: string
  name: string
  category: string
  defaultIntervalMonths: number
  description?: string | null
  active: boolean
}

export interface InspectionItem {
  id: string
  text: string
  result?: 'PASS' | 'FAIL' | 'N/A'
  notes?: string
}

export interface InspectionTemplate {
  id: string
  name: string
  category: string
  stageOrder: number
  description?: string | null
  items: string
  active: boolean
}

export interface Inspection {
  id: string
  unitId?: string | null
  vehicleId?: string | null
  templateId?: string | null
  template?: InspectionTemplate | null
  type: 'OUTGOING' | 'RETURN' | 'QCP' | 'FLEET' | 'DRIVER_CHECK'
  date: string
  inspectorName: string
  clientName?: string | null
  signature?: string | null
  status: string
  findings?: string | null
  odometerKm?: number | null
  items: string
  unit?: { code: string; description?: string; client?: string } | null
  vehicle?: { regNo: string; make: string; model: string } | null
}

export interface UnitHistory {
  id: string
  unitId: string
  date: string
  type: string
  description: string
  person?: string | null
}

export interface Unit {
  id: string
  code: string
  serial?: string | null
  type: string
  size?: string | null
  description?: string | null
  status: string
  client?: string | null
  site?: string | null
  outDate?: string | null
  dueBack?: string | null
  buildDate?: string | null
  builder?: string | null
  electrician?: string | null
  plumber?: string | null
  painter?: string | null
  glazier?: string | null
  roofer?: string | null
  otherTrade?: string | null
  notes?: string | null
  equipment: UnitEquipment[]
  schedules?: MaintenanceSchedule[]
  history?: UnitHistory[]
  inspections?: Inspection[]
}

export interface Supplier {
  id: string
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  leadTimeDays: number
  notes?: string | null
  stockItems?: StockItem[]
}

export interface StockItem {
  id: string
  name: string
  sku?: string | null
  category: string
  unit: string
  qtyOnHand: number
  reorderPoint: number
  reorderQty: number
  unitCost: number
  location?: string | null
  supplierId?: string | null
  supplier?: Supplier | null
  notes?: string | null
}

export interface BomItem {
  id: string
  buildType: string
  stockItemId: string
  stockItem: StockItem
  qtyPerUnit: number
  canBuild: number
}

export interface StockData {
  items: StockItem[]
  suppliers: Supplier[]
  bom: BomItem[]
  containersBuildable: number
}

export interface FleetRecord {
  id: string
  vehicleId: string
  date: string
  type: string
  description: string
  odometerKm?: number | null
  cost?: number | null
  workshop?: string | null
  performedBy?: string | null
  nextServiceDate?: string | null
  nextServiceKm?: number | null
}

export interface FleetVehicle {
  id: string
  regNo: string
  make: string
  model: string
  type: string
  year?: number | null
  odometerKm: number
  status: string
  assignedTo?: string | null
  serviceIntervalKm?: number | null
  serviceIntervalMonths?: number | null
  lastServiceDate?: string | null
  lastServiceOdometerKm?: number | null
  notes?: string | null
  records: FleetRecord[]
  inspections?: Inspection[]
}

export interface EmailLog {
  id: string
  to: string
  subject: string
  body?: string | null
  status: string
  error?: string | null
  createdAt: string
}

export interface DashboardData {
  company: string
  reminderDaysAhead: number
  reminderEmails: string
  smtpConfigured: boolean
  remindersEnabled: boolean
  lastReminderRun: string
  unitsTotal: number
  unitsByStatus: Record<string, number>
  equipmentTotal: number
  schedulesTotal: number
  overdue: { id: string; name: string; nextDue: string; type: string; unit?: string | null }[]
  dueSoon: { id: string; name: string; nextDue: string; type: string; unit?: string | null }[]
  lowStock: { id: string; name: string; qtyOnHand: number; reorderPoint: number; unit: string; supplier?: string | null; leadTimeDays?: number | null }[]
  fleetDue: { id: string; regNo: string; make: string; model: string; odometerKm: number }[]
  recentInspections: { id: string; type: string; date: string; status: string; unit?: string | null; vehicle?: string | null; inspector: string }[]
  recentEmails: { id: string; to: string; subject: string; status: string; createdAt: string }[]
}
