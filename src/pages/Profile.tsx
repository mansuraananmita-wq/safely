import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, IdCard, Mail, ShieldCheck } from 'lucide-react'
import { SignOutDialog } from '../components/AccountTools'
import { Button, Field, Modal, cx, useTitle } from '../components/ui'
import { homePath, isMember, roleLabel } from '../logic'
import { useApp } from '../store'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-haze/80 py-3 first:border-t-0 first:pt-0">
      <dt className="shrink-0 text-sm text-slate">{label}</dt>
      <dd className="text-right text-sm font-medium text-night">{value}</dd>
    </div>
  )
}

export function ProfilePage() {
  const { currentUser, state, tx, lang, toast, remote, updateProfile, changePassword, setLang, setTextSize, setContrast, resetDemo } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(currentUser?.name ?? '')
  const [unit, setUnit] = useState(currentUser?.unit ?? '')
  const [identifier, setIdentifier] = useState(currentUser?.identifier ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [signOut, setSignOut] = useState(false)
  useEffect(() => {
    setName(currentUser?.name ?? '')
    setUnit(currentUser?.unit ?? '')
    setIdentifier(currentUser?.identifier ?? '')
  }, [currentUser?.id])
  useTitle(tx('Profile', 'প্রোফাইল'))
  if (!currentUser) return null

  const member = isMember(currentUser.role)
  const desk = homePath(currentUser.role)
  const sosTo = member ? '/app/sos' : '/admin/sos'
  const reportsTo = member ? '/app/reports' : '/admin/reports'
  const office = state.departments.find((item) => item.id === currentUser.departmentId)
  const contacts = (state.emergencyContacts ?? []).filter((item) => item.userId === currentUser.id)
  const notices = [
    ['notifyInApp', tx('In the app', 'অ্যাপের ভেতরে'), tx('Status changes appear in the notification center.', 'স্ট্যাটাস বদলালে নোটিফিকেশন সেন্টারে দেখা যাবে।')] as const,
    ['notifyEmail', tx('Email', 'ইমেইল'), tx('Used when mail delivery is turned on.', 'ইমেইল চালু থাকলে এই পছন্দ কাজ করে।')] as const,
    ['notifyPush', tx('Phone push', 'ফোন পুশ'), tx('Used when phone alerts are turned on.', 'ফোন অ্যালার্ট চালু থাকলে এই পছন্দ কাজ করে।')] as const,
  ]

  const save = (event: FormEvent) => {
    event.preventDefault()
    const nextName = name.trim()
    const nextUnit = unit.trim()
    if (nextName.length < 2 || nextUnit.length < 2) {
      toast(tx('Add your name and department.', 'নাম ও বিভাগ লিখুন।'))
      return
    }
    void updateProfile({ name: nextName, unit: nextUnit, identifier: identifier.trim() }).then((error) => {
      if (error) return
      toast(remote ? tx('Profile saved.', 'প্রোফাইল সেভ হয়েছে।') : tx('Profile saved in this browser.', 'প্রোফাইল এই ব্রাউজারে সেভ হয়েছে।'))
    })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-sm text-slate">{tx('Account', 'অ্যাকাউন্ট')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-night">{tx('Profile', 'প্রোফাইল')}</h1>
        <p className="mt-2 max-w-xl text-sm text-steel">
          {tx(
            'This page is your campus identity and settings. Open reports stay on Home.',
            'এই পাতা আপনার ক্যাম্পাস পরিচয় ও সেটিংস। খোলা রিপোর্ট হোমে থাকে।',
          )}
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,16.5rem)_1fr]">
        <aside className="overflow-hidden rounded-lg border border-haze bg-white">
          <div className="bg-dusk px-5 pb-8 pt-6 text-center text-frost">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/10 text-3xl font-semibold ring-2 ring-white/20">
              {initials(currentUser.name)}
            </div>
            <h2 className="mt-4 text-xl font-semibold leading-tight">{currentUser.name}</h2>
            <p className="mt-1 text-sm text-frost/75">{roleLabel(currentUser.role, lang)}</p>
            {currentUser.verified ? (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                {tx('Verified campus account', 'যাচাই করা ক্যাম্পাস অ্যাকাউন্ট')}
              </p>
            ) : (
              <p className="mt-3 text-xs text-amber-100">{tx('Email is not confirmed yet.', 'ইমেইল এখনও নিশ্চিত নয়।')}</p>
            )}
          </div>
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div className="flex gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate" />
              <div>
                <dt className="text-xs text-slate">{tx('Department', 'বিভাগ')}</dt>
                <dd className="mt-0.5 text-night">{currentUser.unit}{office ? ` · ${lang === 'bn' ? office.bn : office.en}` : ''}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <IdCard className="mt-0.5 h-4 w-4 shrink-0 text-slate" />
              <div>
                <dt className="text-xs text-slate">{tx('Campus ID', 'ক্যাম্পাস আইডি')}</dt>
                <dd className="mt-0.5 text-night">{currentUser.identifier || tx('Not added yet', 'এখনও যোগ হয়নি')}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate" />
              <div>
                <dt className="text-xs text-slate">{tx('Email', 'ইমেইল')}</dt>
                <dd className="mt-0.5 break-all text-night">{currentUser.email}</dd>
              </div>
            </div>
          </dl>
          <div className="space-y-1 border-t border-haze px-3 py-3">
            <Link to={desk} className="block rounded-md px-2 py-2 text-sm font-medium text-dusk hover:bg-frost">
              {member ? tx('Back to Home', 'হোমে ফিরুন') : tx('Go to the desk', 'ডেস্কে যান')}
            </Link>
            <Link to={reportsTo} className="block rounded-md px-2 py-2 text-sm font-medium text-dusk hover:bg-frost">
              {tx('My reports', 'আমার রিপোর্ট')}
            </Link>
            <Link to={sosTo} className="block rounded-md px-2 py-2 text-sm font-medium text-dusk hover:bg-frost">
              {tx('SOS numbers', 'SOS নম্বর')}
            </Link>
            <button type="button" className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium text-clay hover:bg-clay/5" onClick={() => setSignOut(true)}>
              {tx('Sign out', 'সাইন আউট')}
            </button>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-lg border border-haze bg-white p-5">
            <h2 className="text-lg font-semibold text-night">{tx('Personal information', 'ব্যক্তিগত তথ্য')}</h2>
            <p className="mt-1 text-sm text-slate">{tx('The campus desk uses this to know who you are. Email cannot be changed here.', 'ক্যাম্পাস ডেস্ক আপনাকে এভাবে চেনে। ইমেইল এখান থেকে বদলানো যায় না।')}</p>
            <form className="mt-5 max-w-lg space-y-3" onSubmit={save}>
              <Field label={tx('Full name', 'পূর্ণ নাম')}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </Field>
              <Field label={tx('Department or office', 'বিভাগ বা দপ্তর')}>
                <input className="input" value={unit} onChange={(event) => setUnit(event.target.value)} />
              </Field>
              <Field label={tx('Campus ID', 'ক্যাম্পাস আইডি')} hint={tx('Student ID, staff ID, or another ID you use.', 'শিক্ষার্থী আইডি, কর্মকর্তা আইডি, বা আপনার ব্যবহৃত আইডি।')}>
                <input className="input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
              </Field>
              <Button type="submit" className="rounded-md">{tx('Save changes', 'পরিবর্তন সেভ')}</Button>
            </form>
          </section>

          <section className="rounded-lg border border-haze bg-white p-5">
            <h2 className="text-lg font-semibold text-night">{tx('Account record', 'অ্যাকাউন্ট রেকর্ড')}</h2>
            <dl className="mt-3">
              <Row label={tx('Role', 'ভূমিকা')} value={roleLabel(currentUser.role, lang)} />
              <Row label={tx('Email', 'ইমেইল')} value={currentUser.email} />
              <Row label={tx('Status', 'অবস্থা')} value={currentUser.suspended ? tx('Suspended', 'স্থগিত') : tx('Active', 'সক্রিয়')} />
              <Row label={tx('SOS numbers saved', 'সেভ করা SOS নম্বর')} value={String(contacts.length)} />
            </dl>
          </section>

          <section className="rounded-lg border border-haze bg-white p-5">
            <h2 className="text-lg font-semibold text-night">{tx('Notifications', 'নোটিফিকেশন')}</h2>
            <p className="mt-1 text-sm text-slate">{tx('Choose how Safely tells you when a report or SOS status changes.', 'রিপোর্ট বা SOS-এর স্ট্যাটাস বদলালে সেইফলি কীভাবে জানাবে, সেটি বেছে নিন।')}</p>
            <div className="mt-2 divide-y divide-haze">
              {notices.map(([key, label, hint]) => (
                <label key={key} className="flex items-start justify-between gap-4 py-4">
                  <span>
                    <span className="block text-sm font-semibold text-night">{label}</span>
                    <span className="mt-1 block text-sm text-slate">{hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="mt-1 h-5 w-5"
                    checked={currentUser[key]}
                    aria-label={label}
                    onChange={(event) => {
                      void updateProfile({ [key]: event.target.checked }).then((error) => {
                        if (!error) toast(tx('Notification preference saved.', 'নোটিফিকেশনের পছন্দ সেভ হয়েছে।'))
                      })
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          {remote ? (
            <section className="rounded-lg border border-haze bg-white p-5">
              <h2 className="text-lg font-semibold text-night">{tx('Password', 'পাসওয়ার্ড')}</h2>
              <p className="mt-1 text-sm text-slate">{tx('This replaces the password you use to sign in.', 'সাইন ইনের পাসওয়ার্ড এটি দিয়ে বদলে যাবে।')}</p>
              <form
                className="mt-5 max-w-lg space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (password !== confirmPassword) {
                    toast(tx('Those passwords do not match.', 'পাসওয়ার্ড দুটি মেলেনি।'))
                    return
                  }
                  void changePassword(password).then((ok) => {
                    if (!ok) return
                    setPassword('')
                    setConfirmPassword('')
                  })
                }}
              >
                <Field label={tx('New password', 'নতুন পাসওয়ার্ড')}>
                  <input className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </Field>
                <Field label={tx('Confirm password', 'পাসওয়ার্ড নিশ্চিত করুন')}>
                  <input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </Field>
                <Button type="submit" className="rounded-md">{tx('Update password', 'পাসওয়ার্ড আপডেট')}</Button>
              </form>
            </section>
          ) : null}

          <section className="rounded-lg border border-haze bg-white p-5">
            <h2 className="text-lg font-semibold text-night">{tx('Display', 'প্রদর্শন')}</h2>
            <div className="mt-4 space-y-5">
              <div>
                <p className="text-sm font-semibold text-night">{tx('Language', 'ভাষা')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={cx('rounded-md px-3 py-1.5 text-sm font-semibold', lang === 'en' ? 'bg-dusk text-frost' : 'border border-haze bg-white text-night')} onClick={() => setLang('en')}>English</button>
                  <button type="button" className={cx('rounded-md px-3 py-1.5 text-sm font-semibold', lang === 'bn' ? 'bg-dusk text-frost' : 'border border-haze bg-white text-night')} onClick={() => setLang('bn')}>বাংলা</button>
                </div>
              </div>
              <div className="border-t border-haze pt-5">
                <p className="text-sm font-semibold text-night">{tx('Text size', 'অক্ষরের আকার')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={cx('rounded-md px-3 py-1.5 text-sm font-semibold', state.prefs.textSize === 'default' ? 'bg-dusk text-frost' : 'border border-haze bg-white text-night')} onClick={() => setTextSize('default')}>{tx('Default', 'সাধারণ')}</button>
                  <button type="button" className={cx('rounded-md px-3 py-1.5 text-sm font-semibold', state.prefs.textSize === 'large' ? 'bg-dusk text-frost' : 'border border-haze bg-white text-night')} onClick={() => setTextSize('large')}>{tx('Large', 'বড়')}</button>
                </div>
              </div>
              <label className="flex items-start justify-between gap-4 border-t border-haze pt-5">
                <span>
                  <span className="block text-sm font-semibold text-night">{tx('High contrast', 'বেশি কনট্রাস্ট')}</span>
                  <span className="mt-1 block text-sm text-slate">{tx('Black text, a white page, and stronger borders.', 'কালো লেখা, সাদা পাতা, এবং ঘন বর্ডার।')}</span>
                </span>
                <input type="checkbox" role="switch" className="mt-1 h-5 w-5" checked={state.prefs.contrast} aria-label={tx('High contrast', 'বেশি কনট্রাস্ট')} onChange={(event) => setContrast(event.target.checked)} />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-haze bg-white p-5">
            <h2 className="text-lg font-semibold text-night">{tx('Session', 'সেশন')}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" className="rounded-md" onClick={() => setSignOut(true)}>{tx('Sign out', 'সাইন আউট')}</Button>
              <Button variant="ghost" className="rounded-md text-slate" onClick={() => setConfirm(true)}>
                {remote ? tx('Reload campus data', 'ক্যাম্পাস ডেটা আবার লোড') : tx('Restore preview data', 'প্রিভিউ ডেটা ফেরান')}
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal open={confirm} title={remote ? tx('Reload from the campus database?', 'ক্যাম্পাস ডেটাবেস থেকে আবার লোড করবেন?') : tx('Restore the original preview?', 'আসল প্রিভিউ ফেরাবেন?')} onClose={() => setConfirm(false)}>
        <p className="text-sm">{remote ? tx('This loads the current campus records again. It does not delete them.', 'এতে ক্যাম্পাসের বর্তমান রেকর্ড আবার লোড হয়। কিছু মুছে যায় না।') : tx('Reports you filed in this browser will be replaced by the sample campus.', 'এই ব্রাউজারে আপনি যে রিপোর্ট দিয়েছেন, সেগুলো নমুনা ক্যাম্পাস দিয়ে বদলে যাবে।')}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="rounded-md" onClick={() => { resetDemo(); setConfirm(false); navigate('/') }}>{remote ? tx('Reload', 'আবার লোড') : tx('Restore', 'ফেরান')}</Button>
          <Button variant="secondary" className="rounded-md" onClick={() => setConfirm(false)}>{tx('Cancel', 'বাতিল')}</Button>
        </div>
      </Modal>
      <SignOutDialog open={signOut} onClose={() => setSignOut(false)} />
    </div>
  )
}
