import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GooglePlaceMap } from '../../components/GooglePlaceMap'
import { ReportCard } from '../../components/ReportCard'
import { SignOutDialog } from '../../components/AccountTools'
import { Button, Empty, Field, Modal, buttonClass, useTitle } from '../../components/ui'
import { PLACES, reportPoint } from '../../data'
import { isOpen, roleLabel } from '../../logic'
import { useApp } from '../../store'
import { useNavigate } from 'react-router-dom'

export function MapPage() {
  const { state, tx, lang } = useApp()
  const pins = state.reports.filter((report) => !report.confidential && !report.anonymous && report.category !== 'harassment' && report.category !== 'safety' && isOpen(report.status))
  const counts = Object.fromEntries(PLACES.map((place) => [place.id, pins.filter((report) => report.locationId === place.id).length]))
  const busiest = PLACES.reduce((best, place) => ((counts[place.id] ?? 0) > (counts[best] ?? 0) ? place.id : best), PLACES[0].id)
  const [selected, setSelected] = useState(busiest)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  useTitle(tx('Campus map', 'ক্যাম্পাস ম্যাপ'))
  const safety = PLACES.map((place) => ({
    place,
    value: state.reports.filter((report) => report.locationId === place.id && report.category === 'safety' && !report.anonymous && !report.confidential && isOpen(report.status)).length,
  })).filter((item) => item.value > 0)
  const here = pins.filter((report) => report.locationId === selected)
  const place = PLACES.find((item) => item.id === selected) ?? PLACES[0]
  const focused = here.find((report) => report.id === focusedId) ?? null
  const point = focused ? reportPoint(focused) : { lat: place.lat, lng: place.lng }
  const exact = Boolean(
    focused &&
      focused.lat != null &&
      focused.lng != null &&
      (Math.abs(focused.lat - place.lat) > 0.0002 || Math.abs(focused.lng - place.lng) > 0.0002),
  )
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-4xl">{tx('Campus map', 'ক্যাম্পাস ম্যাপ')}</h1>
      <p className="max-w-2xl text-sm text-ink/70">{tx('Choose a place. Its open reports show on Google Maps. Sensitive reports stay off this map.', 'একটি স্থান বেছে নিন। খোলা রিপোর্ট গুগল ম্যাপে দেখা যাবে। সংবেদনশীল রিপোর্ট এই ম্যাপে আসে না।')}</p>
      <div className="flex flex-wrap gap-2">
        {[...PLACES].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0)).map((item) => (
          <button key={item.id} type="button" onClick={() => { setSelected(item.id); setFocusedId(null) }} className={`rounded-full px-3 py-2 text-sm ${selected === item.id ? 'bg-teal-800 text-white' : 'bg-white'}`}>
            {lang === 'bn' ? item.bn : item.en} · {counts[item.id] ?? 0}
          </button>
        ))}
      </div>
      {point ? (
        <GooglePlaceMap
          mapId="campus-google-map"
          lat={point.lat}
          lng={point.lng}
          zoom={exact ? 17 : 16}
          label={focused ? focused.title : (lang === 'bn' ? place.bn : place.en)}
          note={focused ? (exact ? tx('This report has its own pin.', 'এই রিপোর্টের নিজস্ব পিন আছে।') : tx('Same building pin as the other reports here.', 'এখানকার অন্য রিপোর্টের মতোই এই ভবনের পিন।')) : tx(`${counts[place.id] ?? 0} open reports at this building.`, `এই ভবনে ${counts[place.id] ?? 0}টি খোলা রিপোর্ট।`)}
        />
      ) : null}
      {here.length === 0 ? (
        <Empty
          title={tx('Nothing open here', 'এখানে কিছু খোলা নেই')}
          body={tx('Pick another place, or file a report if you can see the problem.', 'অন্য স্থান বেছে নিন, অথবা সমস্যা দেখতে পেলে রিপোর্ট দিন।')}
          action={<Link to="/app/report/new" className={buttonClass('primary')}>{tx('Report a problem', 'সমস্যা জানান')}</Link>}
        />
      ) : (
        <div className="space-y-3">
          {here.map((report) => {
            const spot = reportPoint(report)
            const ownPin = Boolean(spot && (Math.abs(spot.lat - place.lat) > 0.0002 || Math.abs(spot.lng - place.lng) > 0.0002))
            return (
              <div key={report.id} className={focused?.id === report.id ? 'rounded-2xl ring-2 ring-teal-700' : ''}>
                {ownPin ? (
                  <button type="button" onClick={() => { setFocusedId(report.id); document.getElementById('campus-google-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className="mb-1 text-sm font-semibold text-teal-800">
                    {focused?.id === report.id ? tx('Showing this exact pin', 'এই সঠিক পিন দেখানো হচ্ছে') : tx('Show the exact pin', 'সঠিক পিন দেখুন')}
                  </button>
                ) : null}
                <ReportCard report={report} base="/app/reports" />
              </div>
            )
          })}
        </div>
      )}
      <section className="panel p-4">
        <h2 className="font-display text-2xl">{tx('Safety notes by area', 'এলাকা অনুযায়ী নিরাপত্তা নোট')}</h2>
        <p className="mt-1 text-sm text-ink/65">{tx('Descriptions stay with the security office.', 'বিবরণ নিরাপত্তা দপ্তরে থাকে।')}</p>
        {safety.length === 0 ? <p className="mt-3 text-sm">{tx('No open safety notes on the public count.', 'প্রকাশ্য গণনায় কোনো খোলা নিরাপত্তা নোট নেই।')}</p> : (
          <ul className="mt-3 space-y-1 text-sm">{safety.map((item) => <li key={item.place.id}>{lang === 'bn' ? item.place.bn : item.place.en}: {item.value}</li>)}</ul>
        )}
      </section>
    </div>
  )
}

export function AlertsPage() {
  const { state, tx, lang } = useApp()
  useTitle(tx('Alerts', 'সতর্কতা'))
  const items = state.announcements.filter((item) => item.active)
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-4xl">{tx('Campus alerts', 'ক্যাম্পাস সতর্কতা')}</h1>
      <p className="text-sm text-ink/70">{tx('Planned work and safety notices. If your problem is different, file a report anyway.', 'পরিকল্পিত কাজ ও নিরাপত্তা নোটিশ। সমস্যা আলাদা হলে তবু রিপোর্ট দিন।')}</p>
      {items.length === 0 ? <Empty title={tx('No active alerts', 'কোনো সক্রিয় সতর্কতা নেই')} body={tx('The desk will post tank cleaning, outages, and patrols here.', 'ট্যাংক পরিষ্কার, বিভ্রাট, এবং প্যাট্রোল এখানে আসবে।')} /> : items.map((item) => {
        const place = PLACES.find((entry) => entry.id === item.locationId)
        return (
          <article key={item.id} className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{item.kind}</p>
            <h2 className="mt-1 font-display text-2xl">{item.title}</h2>
            <p className="mt-2 text-sm">{item.body}</p>
            {place ? <p className="mt-2 text-xs text-ink/55">{lang === 'bn' ? place.bn : place.en}</p> : null}
          </article>
        )
      })}
      <Link to="/app/report/new" className="inline-block text-sm font-semibold text-teal-800">{tx('My problem is not on this list', 'আমার সমস্যা এই তালিকায় নেই')}</Link>
    </div>
  )
}

export function LostFoundPage() {
  const { state, tx, addLost, setLostStatus, currentUser } = useApp()
  const [form, setForm] = useState({ title: '', place: '', detail: '', kind: 'lost' as 'lost' | 'found', contact: currentUser?.name ?? '' })
  useTitle(tx('Lost and found', 'হারানো ও পাওয়া'))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    addLost(form)
    setForm({ ...form, title: '', detail: '' })
  }
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
      <div>
        <h1 className="font-display text-4xl">{tx('Lost and found', 'হারানো ও পাওয়া')}</h1>
        <div className="mt-4 space-y-3">
          {state.lostFound.map((item) => (
            <article key={item.id} className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{item.kind === 'lost' ? tx('Lost', 'হারানো') : tx('Found', 'পাওয়া')} · {item.status}</p>
              <h2 className="font-display text-2xl">{item.title}</h2>
              <p className="text-sm text-ink/70">{item.place}</p>
              <p className="mt-2 text-sm">{item.detail}</p>
              <p className="mt-2 text-xs text-ink/50">{item.contact}</p>
              {item.status === 'open' && (item.reporterId === currentUser?.id || currentUser?.role === 'admin') ? (
                <Button className="mt-3" variant="secondary" onClick={() => setLostStatus(item.id, 'resolved')}>{tx('Mark resolved', 'সমাধান হয়েছে')}</Button>
              ) : null}
            </article>
          ))}
        </div>
      </div>
      <form className="panel space-y-3 p-4" onSubmit={submit}>
        <h2 className="font-display text-2xl">{tx('Post', 'পোস্ট')}</h2>
        <Field label={tx('Item', 'জিনিস')}><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
        <Field label={tx('Place', 'স্থান')}><input className="input" value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} required /></Field>
        <Field label={tx('Detail', 'বিস্তারিত')}><textarea className="input min-h-20" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></Field>
        <Field label={tx('Kind', 'ধরন')}>
          <select className="input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as 'lost' | 'found' })}>
            <option value="lost">{tx('Lost', 'হারানো')}</option>
            <option value="found">{tx('Found', 'পাওয়া')}</option>
          </select>
        </Field>
        <Button type="submit" className="w-full">{tx('Post to the board', 'বোর্ডে দিন')}</Button>
      </form>
    </div>
  )
}

export function HelpPage() {
  const { tx } = useApp()
  useTitle(tx('Help', 'সহায়তা'))
  const faqs = [
    [tx('Is this for emergencies?', 'এটা কি জরুরি সেবা?'), tx('No. If someone is in danger, call 999. Safely is for campus follow-up.', 'না। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন। সেইফলি ক্যাম্পাসের ফলোআপের জন্য।')],
    [tx('Who sees an ordinary report?', 'সাধারণ রিপোর্ট কে দেখে?'), tx('The operations desk, the office it is assigned to, and other members can see the problem. They see your role, not a public profile.', 'অপারেশন ডেস্ক, যে দপ্তরে বরাদ্দ হয়, এবং অন্য সদস্যরা সমস্যা দেখতে পান। তারা আপনার ভূমিকা দেখেন, প্রকাশ্য প্রোফাইল নয়।')],
    [tx('Who sees a harassment report?', 'হয়রানির রিপোর্ট কে দেখে?'), tx('Campus security, student affairs, and the operations desk. Facilities offices do not.', 'ক্যাম্পাস নিরাপত্তা, শিক্ষার্থী বিষয়ক দপ্তর, এবং অপারেশন ডেস্ক। রক্ষণাবেক্ষণ দপ্তর দেখে না।')],
    [tx('What does hiding my name mean here?', 'নাম লুকানোর অর্থ কী?'), tx('Officers do not see your name. This preview still keeps the report in your account. A full anonymity design needs the backend.', 'কর্মকর্তারা আপনার নাম দেখেন না। এই প্রিভিউতে রিপোর্ট আপনার অ্যাকাউন্টে থাকে। সম্পূর্ণ বেনামির জন্য ব্যাকএন্ড দরকার।')],
    [tx('Can I save a draft?', 'খসড়া সেভ করা যাবে?'), tx('Yes. Drafts stay on this device until you submit or delete them.', 'হ্যাঁ। জমা বা মুছে ফেলার আগে খসড়া এই ডিভাইসে থাকে।')],
  ]
  const contacts = [
    [tx('National emergency', 'জাতীয় জরুরি সেবা'), '999', tx('Use this if someone is in danger', 'কেউ বিপদে থাকলে এটি ব্যবহার করুন')],
    [tx('Campus security desk', 'ক্যাম্পাস নিরাপত্তা ডেস্ক'), '01700-110221', tx('Demo number', 'ডেমো নম্বর')],
    [tx('Medical center', 'মেডিকেল সেন্টার'), '01700-110119', tx('Demo number', 'ডেমো নম্বর')],
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-4xl">{tx('Help', 'সহায়তা')}</h1>
      <div className="rounded-2xl bg-clay/10 p-4 text-sm">{tx('Safely does not contact emergency services and cannot send a rescue.', 'সেইফলি জরুরি সেবায় খবর পাঠায় না এবং উদ্ধার পাঠাতে পারে না।')}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {contacts.map(([name, phone, note]) => (
          <a key={phone} href={`tel:${phone.replaceAll('-', '')}`} className="panel p-4">
            <p className="text-sm text-ink/60">{name}</p>
            <p className="font-display text-3xl">{phone}</p>
            <p className="text-xs text-ink/50">{note}</p>
          </a>
        ))}
      </div>
      <div className="space-y-2">
        {faqs.map(([q, a]) => (
          <details key={q} className="panel p-4">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-ink/75">{a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={buttonClass(pressed ? 'primary' : 'secondary')}>
      {children}
    </button>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
  return letters || 'S'
}

export function ProfilePage() {
  const { currentUser, state, tx, lang, toast, remote, updateProfile, changePassword, setLang, setTextSize, setContrast, resetDemo } = useApp()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
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
    setEditing(false)
  }, [currentUser?.id])
  useTitle(tx('Profile', 'প্রোফাইল'))
  if (!currentUser) return null
  const filed = state.reports.filter((report) => report.reporterId === currentUser.id && report.status !== 'draft')
  const openCount = filed.filter((report) => isOpen(report.status)).length
  const resolvedCount = filed.filter((report) => report.status === 'resolved' || report.status === 'closed').length
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
      setEditing(false)
      toast(remote ? tx('Profile saved.', 'প্রোফাইল সেভ হয়েছে।') : tx('Profile saved in this browser.', 'প্রোফাইল এই ব্রাউজারে সেভ হয়েছে।'))
    })
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="overflow-hidden rounded-3xl border border-line bg-white">
        <div className="bg-teal-900 px-5 py-7 text-paper sm:px-7">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/15 font-display text-2xl" aria-hidden="true">{initials(currentUser.name)}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-paper/70">{tx('Your account', 'আপনার অ্যাকাউন্ট')}</p>
              <h1 className="mt-1 truncate font-display text-4xl">{currentUser.name}</h1>
              <p className="mt-1 text-sm text-paper/80">{roleLabel(currentUser.role, lang)} · {currentUser.unit}</p>
            </div>
            {!editing ? <Button variant="secondary" className="sm:ml-auto" onClick={() => setEditing(true)}>{tx('Edit profile', 'প্রোফাইল সম্পাদনা')}</Button> : null}
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
          <div className="px-3 py-4">
            <dt className="text-xs text-ink/55">{tx('Filed', 'জমা')}</dt>
            <dd className="font-display text-3xl">{filed.length}</dd>
          </div>
          <div className="px-3 py-4">
            <dt className="text-xs text-ink/55">{tx('Open', 'খোলা')}</dt>
            <dd className="font-display text-3xl">{openCount}</dd>
          </div>
          <div className="px-3 py-4">
            <dt className="text-xs text-ink/55">{tx('Resolved', 'সমাধান')}</dt>
            <dd className="font-display text-3xl">{resolvedCount}</dd>
          </div>
        </dl>
        {editing ? (
          <form className="space-y-3 p-5" onSubmit={save}>
            <Field label={tx('Name', 'নাম')}><input className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></Field>
            <Field label={tx('Department or office', 'বিভাগ বা দপ্তর')}><input className="input" value={unit} onChange={(event) => setUnit(event.target.value)} /></Field>
            <Field label={tx('ID', 'আইডি')} hint={tx('Campus ID, staff ID, or another ID you use.', 'ক্যাম্পাস আইডি, কর্মকর্তা আইডি, বা আপনার ব্যবহৃত আইডি।')}><input className="input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></Field>
            <p className="text-xs text-ink/55">{tx('Email stays with this sign-in and cannot be changed here.', 'ইমেইল এই সাইন-ইনের সাথে থাকে, এখান থেকে বদলানো যায় না।')}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{tx('Save profile', 'প্রোফাইল সেভ')}</Button>
              <Button variant="secondary" onClick={() => { setName(currentUser.name); setUnit(currentUser.unit); setIdentifier(currentUser.identifier); setEditing(false) }}>{tx('Cancel', 'বাতিল')}</Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{tx('Email', 'ইমেইল')}</dt>
              <dd className="mt-1 break-all text-sm">{currentUser.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{tx('ID', 'আইডি')}</dt>
              <dd className="mt-1 text-sm">{currentUser.identifier || tx('Not added yet', 'এখনও যোগ হয়নি')}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="panel space-y-5 p-5">
        <h2 className="font-display text-2xl">{tx('Preferences', 'পছন্দ')}</h2>
        <div>
          <p className="text-sm font-semibold">{tx('Language', 'ভাষা')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice pressed={lang === 'en'} onClick={() => setLang('en')}>English</Choice>
            <Choice pressed={lang === 'bn'} onClick={() => setLang('bn')}>বাংলা</Choice>
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-sm font-semibold">{tx('Text size', 'অক্ষরের আকার')}</p>
          <p className="mt-1 text-sm text-ink/70">{tx('This sample line shows the size used across Safely.', 'এই নমুনা লাইনে সেইফলি জুড়ে ব্যবহৃত আকার দেখা যাচ্ছে।')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice pressed={state.prefs.textSize === 'default'} onClick={() => setTextSize('default')}>{tx('Default', 'সাধারণ')}</Choice>
            <Choice pressed={state.prefs.textSize === 'large'} onClick={() => setTextSize('large')}>{tx('Large', 'বড়')}</Choice>
          </div>
        </div>
        <label className="flex items-start justify-between gap-4 border-t border-line pt-4">
          <span>
            <span className="block text-sm font-semibold">{tx('High contrast', 'বেশি কনট্রাস্ট')}</span>
            <span className="mt-1 block text-sm text-ink/60">{tx('Black text, a white page, and stronger borders.', 'কালো লেখা, সাদা পাতা, এবং ঘন বর্ডার।')}</span>
          </span>
          <input type="checkbox" role="switch" className="mt-1 h-5 w-5" checked={state.prefs.contrast} aria-label={tx('High contrast', 'বেশি কনট্রাস্ট')} onChange={(event) => setContrast(event.target.checked)} />
        </label>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-2xl">{tx('Notifications', 'নোটিফিকেশন')}</h2>
        {notices.map(([key, label, hint]) => (
          <label key={key} className="flex items-start justify-between gap-4 border-t border-line pt-3 first:border-t-0 first:pt-0">
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-sm text-ink/60">{hint}</span>
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
      </section>

      {remote ? (
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-2xl">{tx('Password', 'পাসওয়ার্ড')}</h2>
          <p className="text-sm text-ink/70">{tx('Choose a new password for this account. It replaces the one you use to sign in.', 'এই অ্যাকাউন্টের নতুন পাসওয়ার্ড দিন। সাইন ইনের পাসওয়ার্ড এটি দিয়ে বদলে যাবে।')}</p>
          <form className="space-y-3" onSubmit={(event) => {
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
          }}>
            <Field label={tx('New password', 'নতুন পাসওয়ার্ড')}><input className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
            <Field label={tx('Confirm password', 'পাসওয়ার্ড নিশ্চিত করুন')}><input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
            <Button type="submit">{tx('Update password', 'পাসওয়ার্ড আপডেট')}</Button>
          </form>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setSignOut(true)}>{tx('Sign out', 'সাইন আউট')}</Button>
        <Button variant="ghost" onClick={() => setConfirm(true)}>{remote ? tx('Reload campus data', 'ক্যাম্পাস ডেটা আবার লোড') : tx('Restore preview data', 'প্রিভিউ ডেটা ফেরান')}</Button>
      </div>
      <Modal open={confirm} title={remote ? tx('Reload from the campus database?', 'ক্যাম্পাস ডেটাবেস থেকে আবার লোড করবেন?') : tx('Restore the original preview?', 'আসল প্রিভিউ ফেরাবেন?')} onClose={() => setConfirm(false)}>
        <p className="text-sm">{remote ? tx('This loads the current campus records again. It does not delete them.', 'এতে ক্যাম্পাসের বর্তমান রেকর্ড আবার লোড হয়। কিছু মুছে যায় না।') : tx('Reports you filed in this browser will be replaced by the sample campus.', 'এই ব্রাউজারে আপনি যে রিপোর্ট দিয়েছেন, সেগুলো নমুনা ক্যাম্পাস দিয়ে বদলে যাবে।')}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={() => { resetDemo(); setConfirm(false); navigate('/') }}>{remote ? tx('Reload', 'আবার লোড') : tx('Restore', 'ফেরান')}</Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>{tx('Cancel', 'বাতিল')}</Button>
        </div>
      </Modal>
      <SignOutDialog open={signOut} onClose={() => setSignOut(false)} />
    </div>
  )
}
