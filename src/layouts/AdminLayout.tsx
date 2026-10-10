import { Building2, ClipboardList, LayoutDashboard, Megaphone, Menu, ScrollText, Tags, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AccountTools } from '../components/AccountTools'
import { Logo, cx } from '../components/ui'
import { useApp } from '../store'

export function AdminLayout() {
  const { currentUser, lang, tx } = useApp()
  const [open, setOpen] = useState(false)
  const role = currentUser?.role
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items = [
    { to: '/admin', end: true, icon: LayoutDashboard, en: 'Overview', bn: 'সারাংশ', show: true },
    { to: '/admin/reports', icon: ClipboardList, en: 'Reports', bn: 'রিপোর্ট', show: true },
    { to: '/admin/departments', icon: Building2, en: 'Departments', bn: 'বিভাগ', show: true },
    { to: '/admin/alerts', icon: Megaphone, en: 'Alerts', bn: 'সতর্কতা', show: role === 'admin' || role === 'security' },
    { to: '/admin/users', icon: Users, en: 'People', bn: 'ব্যবহারকারী', show: role === 'admin' },
    { to: '/admin/categories', icon: Tags, en: 'Categories', bn: 'ক্যাটাগরি', show: role === 'admin' },
    { to: '/admin/audit', icon: ScrollText, en: 'Audit', bn: 'অডিট', show: role === 'admin' || role === 'security' },
  ].filter((item) => item.show)

  const nav = (
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => cx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm', isActive ? 'bg-teal-50 font-semibold text-teal-900' : 'text-ink/75 hover:bg-white')}>
          <item.icon className="h-4 w-4" />
          {lang === 'bn' ? item.bn : item.en}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button type="button" className="rounded-full border border-line bg-white p-2 lg:hidden" onClick={() => setOpen(true)} aria-label={tx('Open menu', 'মেনু খুলুন')}>
            <Menu className="h-4 w-4" />
          </button>
          <Logo />
          <p className="hidden text-sm text-ink/50 sm:block">{tx('Campus desk', 'ক্যাম্পাস ডেস্ক')}</p>
          <AccountTools bellTo="/admin/notifications" profileTo="/admin/profile" />
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[230px_1fr]">
        <aside className="no-print hidden px-3 py-6 lg:block">{nav}</aside>
        <main id="main" className="px-4 py-6">
          <Outlet />
        </main>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label={tx('Close menu', 'মেনু বন্ধ')} onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-paper p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label={tx('Close menu', 'মেনু বন্ধ')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
    </div>
  )
}
