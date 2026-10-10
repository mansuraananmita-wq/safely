import { Bell, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { buttonClass, cx } from './ui'

export function AccountTools({ bellTo, profileTo }: { bellTo: string; profileTo: string }) {
  const { currentUser, state, tx, lang, setLang, logout } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
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
      <Link to={bellTo} className="relative rounded-full border border-line bg-white p-2" aria-label={tx('Notifications', 'নোটিফিকেশন')}>
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
                {tx('Profile and access', 'প্রোফাইল ও অ্যাক্সেস')}
              </Link>
              <button
                type="button"
                className={cx(buttonClass('ghost'), 'w-full justify-start rounded-xl')}
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                <LogOut className="h-4 w-4" />
                {tx('Sign out', 'সাইন আউট')}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
