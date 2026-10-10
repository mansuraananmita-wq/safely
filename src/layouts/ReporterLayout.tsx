import { ClipboardList, Home, KeyRound, LifeBuoy, Map, Megaphone, Plus, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { AccountTools } from '../components/AccountTools'
import { Logo, cx } from '../components/ui'
import { useApp } from '../store'

const items = [
  { to: '/app', end: true, icon: Home, en: 'Home', bn: 'হোম' },
  { to: '/app/reports', icon: ClipboardList, en: 'My reports', bn: 'আমার রিপোর্ট' },
  { to: '/app/report/new', icon: Plus, en: 'New report', bn: 'নতুন রিপোর্ট' },
  { to: '/app/map', icon: Map, en: 'Campus map', bn: 'ক্যাম্পাস ম্যাপ' },
  { to: '/app/alerts', icon: Megaphone, en: 'Alerts', bn: 'সতর্কতা' },
  { to: '/app/lost', icon: KeyRound, en: 'Lost & found', bn: 'হারানো ও পাওয়া' },
  { to: '/app/help', icon: LifeBuoy, en: 'Help', bn: 'সহায়তা' },
  { to: '/app/profile', icon: UserRound, en: 'Profile', bn: 'প্রোফাইল' },
]

export function ReporterLayout() {
  const { lang } = useApp()
  const bottom = items.filter((item) => ['/app', '/app/reports', '/app/report/new', '/app/map', '/app/alerts'].includes(item.to))
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-3 focus:py-2">
        {lang === 'bn' ? 'মূল অংশে যান' : 'Skip to content'}
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Logo />
          <AccountTools bellTo="/app/notifications" profileTo="/app/profile" />
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl md:grid-cols-[220px_1fr]">
        <aside className="no-print hidden px-3 py-6 md:block">
          <nav className="space-y-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm', isActive ? 'bg-teal-50 font-semibold text-teal-900' : 'text-ink/75 hover:bg-white')}>
                <item.icon className="h-4 w-4" />
                {lang === 'bn' ? item.bn : item.en}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main id="main" className="px-4 py-6 pb-36 md:pb-10">
          <Outlet />
        </main>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 px-2 py-2">
          {bottom.map((item) =>
            item.to === '/app/report/new' ? (
              <NavLink key={item.to} to={item.to} className="grid place-items-center" aria-label={lang === 'bn' ? item.bn : item.en}>
                <span className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-teal-800 text-white shadow-card">
                  <Plus />
                </span>
              </NavLink>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx('grid place-items-center gap-1 py-1 text-[11px]', isActive ? 'font-semibold text-teal-800' : 'text-ink/60')}>
                <item.icon className="h-4 w-4" />
                {lang === 'bn' ? item.bn : item.en}
              </NavLink>
            ),
          )}
        </div>
      </nav>
    </div>
  )
}
