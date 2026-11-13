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
import { ReportsView } from '@/components/views/reports'
import { SettingsView } from '@/components/views/settings'
import {
  LayoutDashboard, Boxes, Wrench, ClipboardCheck, ShieldCheck, Package,
  Truck, FileDown, Settings as SettingsIcon, Menu, RefreshCw, Building2,
} from 'lucide-react'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'units', label: 'Units', icon: Boxes },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'qcp', label: 'QCP', icon: ShieldCheck },
  { key: 'stock', label: 'Stock', icon: Package },
  { key: 'fleet', label: 'Fleet', icon: Truck },
  { key: 'reports', label: 'Reports', icon: FileDown },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
]

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
    // register service worker for PWA install (APK-style install on Android)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const go = (v: string) => { setView(v); setNavOpen(false) }
  const refresh = () => setRefreshKey((k) => k + 1)

  const navList = (onClick: (k: string) => void, active: string, variant: 'desktop' | 'mobile') => (
    <nav className={variant === 'desktop' ? 'flex flex-col gap-1 px-3' : 'flex flex-col gap-1 p-2'}>
      {NAV.map((n) => {
        const Icon = n.icon
        const isActive = active === n.key
        return (
          <button key={n.key} onClick={() => onClick(n.key)} aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-200 hover:bg-slate-800'}`}>
            <Icon className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" />
            {n.label}
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col bg-slate-900 py-4 sticky top-0 h-screen">
          <div className="px-5 mb-4">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{company}</p>
                <p className="text-[11px] text-slate-400 truncate">{slogan}</p>
              </div>
            </div>
          </div>
          {navList(go, view, 'desktop')}
          <div className="mt-auto px-5 text-[11px] text-slate-500">Windhoek · Namibia</div>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile header */}
          <header className="md:hidden bg-slate-900 px-3 py-2.5 flex items-center gap-2 sticky top-0 z-40">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-slate-900 border-slate-800 p-0 w-64">
                <SheetHeader className="px-5 pt-5 pb-2">
                  <SheetTitle className="text-white text-left text-sm">{company}</SheetTitle>
                </SheetHeader>
                {navList(go, view, 'mobile')}
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate">{company}</p>
              <p className="text-[11px] text-slate-400 truncate">{slogan}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800" onClick={refresh} aria-label="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </header>

          {/* Desktop top bar */}
          <div className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b sticky top-0 z-40">
            <p className="text-sm text-muted-foreground">
              {NAV.find((n) => n.key === view)?.label}
            </p>
            <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>

          <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 max-w-7xl w-full mx-auto">
            {view === 'dashboard' && <DashboardView onNavigate={go} />}
            {view === 'units' && <UnitsView refreshKey={refreshKey} onNavigate={go} />}
            {view === 'maintenance' && <MaintenanceView refreshKey={refreshKey} />}
            {view === 'inspections' && <InspectionsView refreshKey={refreshKey} />}
            {view === 'qcp' && <QcpView refreshKey={refreshKey} />}
            {view === 'stock' && <StockView refreshKey={refreshKey} onNavigate={go} />}
            {view === 'fleet' && <FleetView refreshKey={refreshKey} />}
            {view === 'reports' && <ReportsView refreshKey={refreshKey} />}
            {view === 'settings' && <SettingsView refreshKey={refreshKey} />}
          </main>

          <footer className="mt-auto border-t bg-white px-4 py-3 text-center text-xs text-muted-foreground">
            {company} · preventative maintenance, inspections & fleet · built for Namibian conditions
          </footer>
        </div>
      </div>
    </div>
  )
}
