'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DashboardView } from '@/components/views/dashboard'
import { UnitsView } from '@/components/views/units'
import { MaintenanceView } from '@/components/views/maintenance'
import { InspectionsView } from '@/components/views/inspections'
import { QcpView } from '@/components/views/qcp'
import { StockView } from '@/components/views/stock'
import { FleetView } from '@/components/views/fleet'
import { DriverChecksView } from '@/components/views/driver-checks'
import { ReportsView } from '@/components/views/reports'
import { SettingsView } from '@/components/views/settings'
import {
  LayoutDashboard, Boxes, Wrench, ClipboardCheck, ShieldCheck, Package,
  Truck, FileDown, Settings as SettingsIcon, Menu, RefreshCw, Building2,
  MapPin, CarFront,
} from 'lucide-react'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Operations', desc: 'Today\u2019s overview of units, upkeep and reminders' },
  { key: 'units', label: 'Units', icon: Boxes, group: 'Operations', desc: 'Register, contents, build team and unit history' },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, group: 'Operations', desc: 'Aircon, paint and cleaning schedules by interval' },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck, group: 'Operations', desc: 'Signed outgoing & return checks on tablet' },
  { key: 'qcp', label: 'QCP', icon: ShieldCheck, group: 'Operations', desc: 'Quality control plan with hold points' },
  { key: 'stock', label: 'Stock', icon: Package, group: 'Stock & fleet', desc: 'Inventory, reorder points and supplier lead times' },
  { key: 'fleet', label: 'Fleet', icon: Truck, group: 'Stock & fleet', desc: 'Vehicles, services, repairs and inspections' },
  { key: 'driverchecks', label: 'Driver checks', icon: CarFront, group: 'Stock & fleet', desc: 'Daily pre-trip walk-arounds, signed by drivers' },
  { key: 'reports', label: 'Reports', icon: FileDown, group: 'Office', desc: 'Downloadable reports and inspection sheets' },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, group: 'Office', desc: 'Company details, email reminders and install guide' },
]

const GROUPS = ['Operations', 'Stock & fleet', 'Office'] as const

export default function Home() {
  const [view, setView] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [company, setCompany] = useState('Maintenance Manager')
  const [slogan, setSlogan] = useState('Prefab & container maintenance')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    apiGet<{ settings: Record<string, string> }>('/api/settings')
      .then((d) => {
        if (d.settings.company_name) setCompany(d.settings.company_name)
        if (d.settings.company_slogan) setSlogan(d.settings.company_slogan)
      })
      .catch(() => {})
    // register service worker for PWA install (relative path: works on GitHub
    // Pages sub-paths, localhost and inside the Capacitor APK)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {})
    }
  }, [])

  const go = (v: string) => { setView(v); setNavOpen(false) }
  const refresh = () => setRefreshKey((k) => k + 1)

  const renderBrand = () => (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-950/50 ring-1 ring-inset ring-white/25">
        <Building2 className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-white truncate">{company}</p>
        <p className="text-[11px] text-slate-400 truncate">{slogan}</p>
      </div>
    </div>
  )

  const navList = (onClick: (k: string) => void, active: string) => (
    <nav className="flex flex-col px-3 pb-2">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400/50">
            {group}
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV.filter((n) => n.group === group).map((n) => {
              const Icon = n.icon
              const isActive = active === n.key
              return (
                <button key={n.key} onClick={() => onClick(n.key)} aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-all duration-150 ${
                    isActive
                      ? 'bg-white/[0.09] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'font-medium text-slate-300/60 hover:bg-white/[0.05] hover:text-slate-100'
                  }`}>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  )}
                  <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400/70 group-hover:text-slate-200'}`} />
                  {n.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const sidebarFooter = (
    <div className="px-5 pb-1">
      <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] px-3 py-2.5">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-300 leading-tight">Windhoek · Namibia</p>
          <p className="text-[10px] text-slate-500 leading-tight">Works offline · installable PWA</p>
        </div>
      </div>
    </div>
  )

  const current = NAV.find((n) => n.key === view)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col sticky top-0 h-screen bg-gradient-to-b from-[#0c231d] via-[#0a1d18] to-[#071410] overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(16,185,129,0.16),transparent_70%)]" />
          <div className="relative px-5 pt-5 pb-3">
            {renderBrand()}
          </div>
          <div className="relative flex-1 overflow-y-auto">
            {navList(go, view)}
          </div>
          <div className="relative pt-2">{sidebarFooter}</div>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col bg-dotgrid">
          {/* Mobile header */}
          <header className="md:hidden bg-gradient-to-r from-[#0c231d] to-[#0a1d18] px-3 py-2.5 flex items-center gap-2 sticky top-0 z-40">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-[#0a1d18] border-white/10 p-0 w-72">
                <SheetHeader className="px-5 pt-5 pb-1">
                  <SheetTitle className="text-left text-white">
                    {renderBrand()}
                  </SheetTitle>
                </SheetHeader>
                <div className="h-[calc(100%-4.5rem)] overflow-y-auto">
                  {navList(go, view)}
                  {sidebarFooter}
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-white truncate">{company}</p>
              <p className="text-[11px] text-slate-400 truncate">{current?.label}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={refresh} aria-label="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </header>

          {/* Desktop top bar */}
          <div className="hidden md:flex items-center justify-between px-8 py-4 bg-card/70 backdrop-blur-sm border-b sticky top-0 z-40">
            <div>
              <p className="font-display text-[15px] font-bold leading-tight">{current?.label}</p>
              <p className="text-xs text-muted-foreground">{current?.desc}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground rounded-full border px-3 py-1.5 bg-card/60">
                <MapPin className="h-3 w-3 text-emerald-600" /> Windhoek, Namibia
              </span>
              <Button variant="outline" size="sm" className="rounded-lg bg-card" onClick={refresh}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          <main className="flex-1 px-3 sm:px-8 py-4 sm:py-7 max-w-7xl w-full mx-auto">
            {view === 'dashboard' && <DashboardView onNavigate={go} />}
            {view === 'units' && <UnitsView refreshKey={refreshKey} onNavigate={go} />}
            {view === 'maintenance' && <MaintenanceView refreshKey={refreshKey} />}
            {view === 'inspections' && <InspectionsView refreshKey={refreshKey} />}
            {view === 'qcp' && <QcpView refreshKey={refreshKey} />}
            {view === 'stock' && <StockView refreshKey={refreshKey} onNavigate={go} />}
            {view === 'fleet' && <FleetView refreshKey={refreshKey} />}
            {view === 'driverchecks' && <DriverChecksView refreshKey={refreshKey} />}
            {view === 'reports' && <ReportsView refreshKey={refreshKey} />}
            {view === 'settings' && <SettingsView refreshKey={refreshKey} />}
          </main>

          <footer className="mt-auto border-t bg-card/70 backdrop-blur-sm px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
            {company} · preventative maintenance, inspections & fleet · built for Namibian conditions
          </footer>
        </div>
      </div>
    </div>
  )
}
