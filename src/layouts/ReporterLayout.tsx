import { Bell, ClipboardList, Home, KeyRound, LifeBuoy, Map, Megaphone, MoreHorizontal, Plus, Siren, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountTools } from '../components/AccountTools'
import { Logo, cx, navClass } from '../components/ui'
import { useApp } from '../store'

const items = [
  { to: '/app', end: true, icon: Home, en: 'Home', bn: 'হোম', shortEn: 'Home', shortBn: 'হোম' },
  { to: '/app/reports', icon: ClipboardList, en: 'My reports', bn: 'আমার রিপোর্ট', shortEn: 'Reports', shortBn: 'রিপোর্ট' },
  { to: '/app/report/new', icon: Plus, en: 'New report', bn: 'নতুন রিপোর্ট', shortEn: 'New', shortBn: 'নতুন' },
  { to: '/app/map', icon: Map, en: 'Campus map', bn: 'ক্যাম্পাস ম্যাপ', shortEn: 'Map', shortBn: 'ম্যাপ' },
  { to: '/app/notifications', icon: Bell, en: 'Notifications', bn: 'নোটিফিকেশন', shortEn: 'Notes', shortBn: 'বার্তা' },
  { to: '/app/alerts', icon: Megaphone, en: 'Alerts', bn: 'সতর্কতা', shortEn: 'Alerts', shortBn: 'সতর্কতা' },
  { to: '/app/lost', icon: KeyRound, en: 'Lost & found', bn: 'হারানো ও পাওয়া', shortEn: 'Lost', shortBn: 'হারানো' },
  { to: '/app/help', icon: LifeBuoy, en: 'Help', bn: 'সহায়তা', shortEn: 'Help', shortBn: 'সহায়তা' },
  { to: '/app/sos', icon: Siren, en: 'SOS', bn: 'এসওএস', shortEn: 'SOS', shortBn: 'এসওএস' },
  { to: '/app/profile', icon: UserRound, en: 'Profile', bn: 'প্রোফাইল', shortEn: 'Profile', shortBn: 'প্রোফাইল' },
]

const bottomTo = ['/app', '/app/reports', '/app/map']

function onPath(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function ReporterLayout() {
  const { lang, tx } = useApp()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const bottom = items.filter((item) => bottomTo.includes(item.to))
  const more = items.filter((item) => item.to !== '/app/report/new' && !bottomTo.includes(item.to))
  const moreActive = more.some((item) => onPath(pathname, item.to, item.end))
  const label = (item: (typeof items)[number]) => (lang === 'bn' ? item.bn : item.en)

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-3 focus:py-2">
        {tx('Skip to content', 'মূল অংশে যান')}
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-haze/80 bg-frost/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/app" aria-label="Safely"><Logo /></Link>
          <AccountTools bellTo="/app/notifications" profileTo="/app/profile" />
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
        <aside className="no-print hidden md:block">
          <nav className="sticky top-20 space-y-1 px-3 py-6" aria-label={tx('Sections', 'বিভাগ')}>
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navClass(isActive)}>
                <item.icon className="h-4 w-4" />
                {label(item)}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main id="main" className="min-w-0 px-4 py-6 pb-36 md:pb-12">
          <Outlet />
        </main>
      </div>
      {moreOpen ? (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label={tx('Close menu', 'মেনু বন্ধ')} onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-3 bottom-20 rounded-2xl border border-haze bg-card p-2 shadow-card">
            <nav className="space-y-1" aria-label={tx('More', 'আরও')}>
              {more.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMoreOpen(false)} className={({ isActive }) => navClass(isActive)}>
                  <item.icon className="h-4 w-4" />
                  {label(item)}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-haze bg-frost/95 shadow-[0_-10px_30px_-18px_rgba(17,21,34,0.55)] backdrop-blur md:hidden" aria-label={tx('Sections', 'বিভাগ')} style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="grid grid-cols-5 px-1 pt-1">
          {bottom.slice(0, 2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMoreOpen(false)} className={({ isActive }) => cx('grid place-items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] leading-tight', isActive ? 'bg-white font-semibold text-dusk ring-1 ring-haze' : 'text-slate')}>
              <item.icon className="h-4 w-4" />
              {lang === 'bn' ? item.shortBn : item.shortEn}
            </NavLink>
          ))}
          <NavLink to="/app/report/new" onClick={() => setMoreOpen(false)} className="grid place-items-center" aria-label={tx('New report', 'নতুন রিপোর্ট')}>
            {({ isActive }) => (
              <span className={cx('-mt-6 grid h-14 w-14 place-items-center rounded-full bg-dusk text-frost shadow-card', isActive && 'ring-4 ring-haze')}>
                <Plus />
              </span>
            )}
          </NavLink>
          {bottom.slice(2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMoreOpen(false)} className={({ isActive }) => cx('grid place-items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] leading-tight', isActive ? 'bg-white font-semibold text-dusk ring-1 ring-haze' : 'text-slate')}>
              <item.icon className="h-4 w-4" />
              {lang === 'bn' ? item.shortBn : item.shortEn}
            </NavLink>
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            onClick={() => setMoreOpen((value) => !value)}
            className={cx('grid place-items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] leading-tight', moreActive || moreOpen ? 'bg-white font-semibold text-dusk ring-1 ring-haze' : 'text-slate')}
          >
            <MoreHorizontal className="h-4 w-4" />
            {tx('More', 'আরও')}
          </button>
        </div>
      </nav>
    </div>
  )
}
