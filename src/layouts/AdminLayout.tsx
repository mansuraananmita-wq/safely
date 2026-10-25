import { Building2, ClipboardList, Inbox, LayoutDashboard, Megaphone, MoreHorizontal, ScrollText, Siren, Tags, UserRound, Users } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountTools } from '../components/AccountTools'
import { Logo, cx, navClass } from '../components/ui'
import { useApp } from '../store'

function onPath(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AdminLayout() {
  const { currentUser, lang, tx } = useApp()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const role = currentUser?.role
  const restricted = role === 'security' || currentUser?.departmentId === 'd-affairs'
  const items = role === 'admin'
    ? [
        { to: '/admin', end: true, icon: LayoutDashboard, en: 'Dashboard', bn: 'ড্যাশবোর্ড', shortEn: 'Home', shortBn: 'হোম', primary: true },
        { to: '/admin/sos', icon: Siren, en: 'SOS', bn: 'এসওএস', shortEn: 'SOS', shortBn: 'এসওএস', primary: true },
        { to: '/admin/reports', icon: ClipboardList, en: 'All reports', bn: 'সব রিপোর্ট', shortEn: 'Reports', shortBn: 'রিপোর্ট', primary: true },
        { to: '/admin/departments', icon: Building2, en: 'Departments', bn: 'বিভাগ', shortEn: 'Offices', shortBn: 'দপ্তর', primary: true },
        { to: '/admin/users', icon: Users, en: 'Users', bn: 'ব্যবহারকারী', shortEn: 'Users', shortBn: 'ব্যক্তি', primary: false },
        { to: '/admin/categories', icon: Tags, en: 'Categories', bn: 'ক্যাটাগরি', shortEn: 'Types', shortBn: 'ধরন', primary: false },
        { to: '/admin/alerts', icon: Megaphone, en: 'Alerts', bn: 'সতর্কতা', shortEn: 'Alerts', shortBn: 'সতর্কতা', primary: false },
        { to: '/admin/audit', icon: ScrollText, en: 'Audit log', bn: 'অডিট লগ', shortEn: 'Audit', shortBn: 'অডিট', primary: false },
        { to: '/admin/profile', icon: UserRound, en: 'Profile', bn: 'প্রোফাইল', shortEn: 'Profile', shortBn: 'প্রোফাইল', primary: false },
      ]
    : [
        {
          to: '/admin/queues',
          end: true,
          icon: Inbox,
          en: restricted ? 'Restricted queue' : 'Assigned queue',
          bn: restricted ? 'সীমিত সারি' : 'বরাদ্দকৃত সারি',
          shortEn: 'Queue',
          shortBn: 'সারি',
          primary: true,
        },
        { to: '/admin/profile', icon: UserRound, en: 'Profile', bn: 'প্রোফাইল', shortEn: 'Profile', shortBn: 'প্রোফাইল', primary: true },
        { to: '/admin/sos', icon: Siren, en: 'SOS', bn: 'এসওএস', shortEn: 'SOS', shortBn: 'এসওএস', primary: true },
      ]
  const bottom = items.filter((item) => item.primary)
  const more = items.filter((item) => !item.primary)
  const moreActive = more.some((item) => onPath(pathname, item.to, item.end))
  const label = (item: (typeof items)[number]) => (lang === 'bn' ? item.bn : item.en)

  const links = (list: typeof items, close: boolean) => (
    <nav className="space-y-1" aria-label={tx('Sections', 'বিভাগ')}>
      {list.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={() => close && setMoreOpen(false)} className={({ isActive }) => navClass(isActive || (item.to === '/admin/queues' && pathname.startsWith('/admin/reports/')))}>
          <item.icon className="h-4 w-4" />
          {label(item)}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-haze/80 bg-frost/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <p className="hidden text-sm text-slate sm:block">
            {role === 'admin' ? tx('Operations desk', 'অপারেশন ডেস্ক') : restricted ? tx('Restricted desk', 'সীমিত ডেস্ক') : tx('Department office', 'দপ্তর')}
          </p>
          <AccountTools bellTo="/admin/notifications" profileTo="/admin/profile" />
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl md:grid-cols-[200px_1fr] lg:grid-cols-[230px_1fr]">
        <aside className="no-print hidden md:block"><div className="sticky top-20 px-3 py-6">{links(items, false)}</div></aside>
        <main id="main" className="min-w-0 px-4 py-6 pb-36 md:pb-12">
          <Outlet />
        </main>
      </div>
      {moreOpen ? (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label={tx('Close menu', 'মেনু বন্ধ')} onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-3 bottom-20 max-h-[70vh] overflow-y-auto rounded-2xl border border-haze bg-card p-2 shadow-card">
            {links(more, true)}
          </div>
        </div>
      ) : null}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-haze bg-frost/95 shadow-[0_-10px_30px_-18px_rgba(17,21,34,0.55)] backdrop-blur md:hidden" aria-label={tx('Sections', 'বিভাগ')} style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="grid px-1 pt-1" style={{ gridTemplateColumns: `repeat(${bottom.length + (more.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}>
          {bottom.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMoreOpen(false)} className={({ isActive }) => cx('grid place-items-center gap-0.5 rounded-xl px-1 py-1 text-center text-[11px] leading-tight', isActive || (item.to === '/admin/queues' && pathname.startsWith('/admin/reports/')) ? 'bg-white font-semibold text-dusk ring-1 ring-haze' : 'text-slate')}>
              <item.icon className="h-4 w-4" />
              {lang === 'bn' ? item.shortBn : item.shortEn}
            </NavLink>
          ))}
          {more.length > 0 ? (
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
          ) : null}
        </div>
      </nav>
    </div>
  )
}
