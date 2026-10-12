import { Bell, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
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
  const unread = state.notifications.filter((item) => item.userId === currentUser?.id && !item.read).length

  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
        className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold"
      >
        {lang === 'en' ? 'বাংলা' : 'EN'}
      </button>
      <Link to={bellTo} className="relative rounded-full border border-line bg-white p-2" aria-label={unread > 0 ? tx(`Notifications, ${unread} unread`, `নোটিফিকেশন, ${unread}টি অপঠিত`) : tx('Notifications', 'নোটিফিকেশন')}>
        <Bell className="h-4 w-4" />
        {unread > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[11px] font-bold text-white">{unread}</span> : null}
      </Link>
      <div className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">
          {currentUser?.name.split(' ')[0]}
        </button>
        {open ? (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label={tx('Close menu', 'মেনু বন্ধ')} onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-line bg-card p-2 shadow-card">
              <p className="px-2 py-1 text-xs text-ink/50">{currentUser?.email}</p>
              <Link to={profileTo} onClick={() => setOpen(false)} className="block rounded-xl px-2 py-2 text-sm hover:bg-teal-50">
                {tx('Profile and settings', 'প্রোফাইল ও সেটিংস')}
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
