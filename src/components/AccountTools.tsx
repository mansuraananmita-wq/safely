import { Bell, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { inboxNotifications } from '../logic'
import { useApp } from '../store'
import { SosButton } from './SosButton'
import { Button, Modal, buttonClass, cx } from './ui'

export function SignOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tx, logout, remote } = useApp()
  const navigate = useNavigate()
  return (
    <Modal open={open} title={tx('Sign out?', 'সাইন আউট করবেন?')} onClose={onClose}>
      <p className="text-sm">{remote ? tx('You will leave this account. Campus reports stay in the database.', 'এই অ্যাকাউন্ট থেকে বের হবেন। ক্যাম্পাসের রিপোর্ট ডেটাবেসে থাকবে।') : tx('You will leave this account on this browser. Reports saved in the preview stay here.', 'এই ব্রাউজারে এই অ্যাকাউন্ট থেকে বের হবেন। প্রিভিউতে সেভ করা রিপোর্ট থাকবে।')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="danger"
          onClick={() => {
            onClose()
            logout()
            navigate('/')
          }}
        >
          {tx('Sign out', 'সাইন আউট')}
        </Button>
        <Button variant="secondary" onClick={onClose}>{tx('Stay signed in', 'সাইন ইন থাকুন')}</Button>
      </div>
    </Modal>
  )
}

export function AccountTools({ bellTo, profileTo }: { bellTo: string; profileTo: string }) {
  const { currentUser, state, tx, lang, setLang } = useApp()
  const [open, setOpen] = useState(false)
  const [signOut, setSignOut] = useState(false)
  const unread = inboxNotifications(currentUser, state.notifications).filter((item) => !item.read).length
  const desk = currentUser?.role === 'admin' || currentUser?.role === 'security'
  const sosCount = desk ? (state.sosAlerts ?? []).filter((item) => !item.resolvedAt).length : 0

  return (
    <div className="ml-auto flex items-center gap-2">
      {desk ? (
        <Link to="/admin/sos" className="relative rounded-full bg-clay px-3 py-1.5 text-sm font-semibold text-white">
          SOS
          {sosCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-night px-1 text-[11px] font-bold text-frost">{sosCount}</span> : null}
        </Link>
      ) : <SosButton />}
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
        className="rounded-full border border-haze bg-white px-3 py-1.5 text-sm font-semibold text-dusk"
      >
        {lang === 'en' ? 'বাংলা' : 'EN'}
      </button>
      <Link to={bellTo} className="relative rounded-full border border-haze bg-white p-2 text-dusk" aria-label={unread > 0 ? tx(`Notifications, ${unread} unread`, `নোটিফিকেশন, ${unread}টি অপঠিত`) : tx('Notifications', 'নোটিফিকেশন')}>
        <Bell className="h-4 w-4" />
        {unread > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[11px] font-bold text-white">{unread}</span> : null}
      </Link>
      <div className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full bg-dusk text-xs font-semibold text-frost" aria-label={tx('Account menu', 'অ্যাকাউন্ট মেনু')}>
          {(currentUser?.name ?? 'S').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'}
        </button>
        {open ? (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label={tx('Close menu', 'মেনু বন্ধ')} onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-haze bg-white p-2 shadow-card">
              <div className="border-b border-haze px-2 py-2">
                <p className="truncate text-sm font-semibold text-night">{currentUser?.name}</p>
                <p className="truncate text-xs text-slate">{currentUser?.email}</p>
              </div>
              <Link to={profileTo} onClick={() => setOpen(false)} className="mt-1 block rounded-md px-2 py-2 text-sm text-night hover:bg-frost">
                {tx('View profile', 'প্রোফাইল দেখুন')}
              </Link>
              <button
                type="button"
                className={cx(buttonClass('ghost'), 'w-full justify-start rounded-xl')}
                onClick={() => {
                  setOpen(false)
                  setSignOut(true)
                }}
              >
                <LogOut className="h-4 w-4" />
                {tx('Sign out', 'সাইন আউট')}
              </button>
            </div>
          </>
        ) : null}
      </div>
      <SignOutDialog open={signOut} onClose={() => setSignOut(false)} />
    </div>
  )
}
