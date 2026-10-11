import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { DEMO_ACCOUNTS } from '../data'
import { homePath } from '../logic'
import { consumeSignedIn, useApp } from '../store'
import type { Role } from '../types'
import { Button, Field, Logo, useTitle } from '../components/ui'

function Frame({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  const { tx } = useApp()
  return (
    <div className="grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="hidden flex-col justify-between bg-teal-900 p-10 text-paper lg:flex">
        <Logo light />
        <div>
          <p className="max-w-sm font-display text-4xl leading-tight">{tx('The campus desk, with the noise taken out.', 'ক্যাম্পাস ডেস্ক, অতিরিক্ত শোরগোল ছাড়া।')}</p>
          <p className="mt-4 max-w-sm text-sm text-paper/75">{tx('Padma University. With Supabase connected, reports are stored in the campus database.', 'পদ্মা বিশ্ববিদ্যালয়। Supabase যুক্ত থাকলে রিপোর্ট ক্যাম্পাস ডেটাবেসে থাকে।')}</p>
        </div>
      </aside>
      <div className="px-5 py-8 sm:px-10">
        <Link to="/" className="lg:hidden"><Logo /></Link>
        <h1 className="mt-8 font-display text-4xl">{title}</h1>
        <p className="mt-2 max-w-md text-ink/70">{lede}</p>
        <div className="mt-6 max-w-md">{children}</div>
      </div>
    </div>
  )
}

function goHome(role: Role, from: string | undefined) {
  const home = homePath(role)
  if (from && from.startsWith(home)) return from
  return home
}

export function Login() {
  const { tx, login, loginDirect, remote } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  useTitle(tx('Sign in', 'সাইন ইন'))
  const from = (location.state as { from?: string } | null)?.from

  const finish = async (address: string, direct: boolean) => {
    const result = await (direct ? loginDirect(address) : login(address, password))
    if (result) {
      const copy = {
        unknown: tx('No Padma account uses that email.', 'এই ইমেইলে কোনো পদ্মা অ্যাকাউন্ট নেই।'),
        suspended: tx('This account is suspended.', 'এই অ্যাকাউন্ট স্থগিত।'),
        unverified: tx('Verify the university email before signing in.', 'সাইন ইনের আগে বিশ্ববিদ্যালয় ইমেইল যাচাই করুন।'),
        password: remote
          ? tx('That password does not match. Demo accounts use padma1234.', 'পাসওয়ার্ড মেলেনি। ডেমো অ্যাকাউন্টের পাসওয়ার্ড padma1234।')
          : tx('Use at least 8 characters. This preview accepts any such password.', 'কমপক্ষে ৮ অক্ষর দিন। এই প্রিভিউ সেই পাসওয়ার্ডই নেয়।'),
      }[result]
      setError(copy)
      return
    }
    const user = consumeSignedIn()
    if (user) navigate(goHome(user.role, from))
  }

  return (
    <Frame title={tx('Sign in', 'সাইন ইন')} lede={remote
      ? tx('Use your Padma University email. Demo buttons sign in with the password padma1234.', 'পদ্মা বিশ্ববিদ্যালয়ের ইমেইল ব্যবহার করুন। ডেমো বোতাম padma1234 পাসওয়ার্ডে ঢোকে।')
      : tx('Use your Padma University email. Demo desks are listed below and skip the password.', 'পদ্মা বিশ্ববিদ্যালয়ের ইমেইল ব্যবহার করুন। নিচের ডেমো ডেস্কে পাসওয়ার্ড লাগে না।')}>
      <form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); finish(email, false) }}>
        <Field label={tx('University email', 'বিশ্ববিদ্যালয় ইমেইল')}>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label={tx('Password', 'পাসওয়ার্ড')} hint={remote ? tx('Demo password: padma1234', 'ডেমো পাসওয়ার্ড: padma1234') : tx('Any password of 8 or more characters works in this preview.', 'এই প্রিভিউতে ৮ বা তার বেশি অক্ষরের যেকোনো পাসওয়ার্ড চলে।')}>
          <div className="flex gap-2">
            <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <Button variant="secondary" onClick={() => setShow((value) => !value)}>{show ? tx('Hide', 'লুকান') : tx('Show', 'দেখুন')}</Button>
          </div>
        </Field>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
        <Button type="submit" className="w-full">{tx('Sign in', 'সাইন ইন')}</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/forgot" className="font-semibold text-teal-800">{tx('Forgot password', 'পাসওয়ার্ড ভুলেছেন')}</Link>
        <Link to="/register" className="font-semibold text-teal-800">{tx('Create an account', 'অ্যাকাউন্ট খুলুন')}</Link>
      </div>
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{tx('Demo accounts', 'ডেমো অ্যাকাউন্ট')}</p>
        <div className="mt-3 space-y-2">
          {DEMO_ACCOUNTS.slice(0, 5).map((account) => (
            <button key={account.email} type="button" onClick={() => finish(account.email, true)} className="panel block w-full px-3 py-2 text-left hover:border-teal-700">
              <span className="block text-sm font-semibold">{account.email}</span>
              <span className="block text-xs text-ink/60">{tx(account.noteEn, account.noteBn)}</span>
            </button>
          ))}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">{tx('More desks', 'আরও ডেস্ক')}</summary>
          <div className="mt-2 space-y-2">
            {DEMO_ACCOUNTS.slice(5).map((account) => (
              <button key={account.email} type="button" onClick={() => finish(account.email, true)} className="panel block w-full px-3 py-2 text-left hover:border-teal-700">
                <span className="block text-sm font-semibold">{account.email}</span>
                <span className="block text-xs text-ink/60">{tx(account.noteEn, account.noteBn)}</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    </Frame>
  )
}

export function Register() {
  const { tx, register } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', role: 'student' as Role, unit: '', identifier: '', password: '', confirm: '', privacy: false })
  const [error, setError] = useState('')
  useTitle(tx('Create an account', 'অ্যাকাউন্ট খুলুন'))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.password.length < 8) return setError(tx('Use at least 8 characters.', 'কমপক্ষে ৮ অক্ষর দিন।'))
    if (form.password !== form.confirm) return setError(tx('Those passwords do not match.', 'পাসওয়ার্ড দুটি মেলেনি।'))
    if (!form.privacy) return setError(tx('Read the privacy note and confirm it.', 'গোপনীয়তার নোট পড়ে নিশ্চিত করুন।'))
    const result = await register({ ...form, password: form.password })
    if (result === 'domain') return setError(tx('Use a @padma.edu email.', '@padma.edu ইমেইল ব্যবহার করুন।'))
    if (result === 'exists') return setError(tx('That email is already registered.', 'এই ইমেইল আগেই নিবন্ধিত।'))
    if (result === 'role') return setError(tx('Department accounts are issued by the university.', 'বিভাগীয় অ্যাকাউন্ট বিশ্ববিদ্যালয় দেয়।'))
    if (result === 'signed-in') {
      const user = consumeSignedIn()
      navigate(homePath(user?.role ?? form.role))
      return
    }
    navigate(`/verify?email=${encodeURIComponent(form.email.trim().toLowerCase())}`)
  }

  return (
    <Frame title={tx('Create an account', 'অ্যাকাউন্ট খুলুন')} lede={tx('Students, teachers, and staff can register. Department and admin desks are issued by the university.', 'শিক্ষার্থী, শিক্ষক ও কর্মকর্তারা নিবন্ধন করতে পারেন। বিভাগ ও অ্যাডমিন অ্যাকাউন্ট বিশ্ববিদ্যালয় দেয়।')}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label={tx('Full name', 'পূর্ণ নাম')}>
          <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        <Field label={tx('University email', 'বিশ্ববিদ্যালয় ইমেইল')} hint="@padma.edu">
          <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tx('Role', 'ভূমিকা')}>
            <select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
              <option value="student">{tx('Student', 'শিক্ষার্থী')}</option>
              <option value="teacher">{tx('Teacher', 'শিক্ষক')}</option>
              <option value="staff">{tx('Staff', 'কর্মকর্তা')}</option>
            </select>
          </Field>
          <Field label={tx('ID', 'আইডি')}>
            <input className="input" value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} required />
          </Field>
        </div>
        <Field label={tx('Department or office', 'বিভাগ বা দপ্তর')}>
          <input className="input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required />
        </Field>
        <Field label={tx('Password', 'পাসওয়ার্ড')}>
          <input className="input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        </Field>
        <Field label={tx('Confirm password', 'পাসওয়ার্ড নিশ্চিত করুন')}>
          <input className="input" type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} required />
        </Field>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={form.privacy} onChange={(event) => setForm({ ...form, privacy: event.target.checked })} />
          <span>{tx('I understand Safely is not an emergency service, harassment reports are restricted, and this preview keeps data in the browser.', 'আমি বুঝেছি সেইফলি জরুরি সেবা নয়, হয়রানির রিপোর্ট সীমিত, এবং এই প্রিভিউ ডেটা ব্রাউজারে রাখে।')}</span>
        </label>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
        <Button type="submit" className="w-full">{tx('Create account', 'অ্যাকাউন্ট তৈরি')}</Button>
      </form>
      <p className="mt-4 text-sm"><Link to="/login" className="font-semibold text-teal-800">{tx('I already have an account', 'আমার অ্যাকাউন্ট আছে')}</Link></p>
    </Frame>
  )
}

export function Verify() {
  const { tx, state, verify, resend } = useApp()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email') ?? ''
  const code = state.codes[`verify:${email.toLowerCase()}`]
  const [value, setValue] = useState('')
  useTitle(tx('Verify email', 'ইমেইল যাচাই'))
  useEffect(() => {
    if (email && code === undefined) resend(email)
  }, [email, code, resend])

  if (!email) return <Frame title={tx('Verify email', 'ইমেইল যাচাই')} lede=""><Link to="/register">{tx('Start registration', 'নিবন্ধন শুরু')}</Link></Frame>

  return (
    <Frame title={tx('Check your campus mail', 'ক্যাম্পাস মেইল দেখুন')} lede={tx('No mail server is connected yet. The code is shown in the demo inbox so this screen can be reviewed.', 'এখনও কোনো মেইল সার্ভার যুক্ত নেই। স্ক্রিনটি দেখার জন্য কোড ডেমো ইনবক্সে দেখানো হচ্ছে।')}>
      <div className="panel p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">{tx('Demo inbox', 'ডেমো ইনবক্স')}</p>
        <p className="mt-1 text-sm">To: {email}</p>
        <p className="mt-2 font-display text-4xl tracking-widest">{code || '······'}</p>
      </div>
      <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); if (verify(email, value)) navigate(`/login?email=${encodeURIComponent(email)}`) }}>
        <Field label={tx('Six-digit code', 'ছয় অঙ্কের কোড')}>
          <input className="input" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} required />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{tx('Verify', 'যাচাই')}</Button>
          <Button variant="secondary" onClick={() => setValue(code)}>{tx('Fill the demo code', 'ডেমো কোড বসান')}</Button>
          <Button variant="ghost" onClick={() => resend(email)}>{tx('Resend', 'আবার পাঠান')}</Button>
        </div>
      </form>
    </Frame>
  )
}

export function Forgot() {
  const { tx, requestReset, completeReset, state } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  useTitle(tx('Reset password', 'পাসওয়ার্ড রিসেট'))
  const inbox = state.codes[`reset:${email.trim().toLowerCase()}`] ?? ''

  const ask = async (event: FormEvent) => {
    event.preventDefault()
    if (!(await requestReset(email))) {
      setError(tx('No Padma account uses that email.', 'এই ইমেইলে কোনো পদ্মা অ্যাকাউন্ট নেই।'))
      return
    }
    setError('')
    setSent(true)
  }

  const finish = (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8 || password !== confirm) {
      setError(tx('Use matching passwords of at least 8 characters.', 'কমপক্ষে ৮ অক্ষরের মিল থাকা পাসওয়ার্ড দিন।'))
      return
    }
    if (completeReset(email, code)) navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`)
  }

  return (
    <Frame title={tx('Reset password', 'পাসওয়ার্ড রিসেট')} lede={tx('We will show the reset code in the demo inbox until email delivery is connected.', 'ইমেইল ডেলিভারি যুক্ত হওয়ার আগে রিসেট কোড ডেমো ইনবক্সে দেখা যাবে।')}>
      {!sent ? (
        <form className="space-y-4" onSubmit={ask}>
          <Field label={tx('University email', 'বিশ্ববিদ্যালয় ইমেইল')}>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
          <Button type="submit">{tx('Send reset code', 'রিসেট কোড পাঠান')}</Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={finish}>
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">{tx('Demo inbox', 'ডেমো ইনবক্স')}</p>
            <p className="mt-2 font-display text-4xl tracking-widest">{inbox}</p>
          </div>
          <Field label={tx('Code', 'কোড')}>
            <input className="input" value={code} onChange={(event) => setCode(event.target.value)} required />
          </Field>
          <Field label={tx('New password', 'নতুন পাসওয়ার্ড')}>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <Field label={tx('Confirm password', 'পাসওয়ার্ড নিশ্চিত করুন')}>
            <input className="input" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          </Field>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
          <Button type="submit">{tx('Update password', 'পাসওয়ার্ড আপডেট')}</Button>
        </form>
      )}
      <p className="mt-4 text-sm"><Link to="/login" className="font-semibold text-teal-800">{tx('Back to sign in', 'সাইন ইনে ফিরুন')}</Link></p>
    </Frame>
  )
}
