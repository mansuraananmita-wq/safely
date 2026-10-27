import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GooglePlaceMap } from '../../components/GooglePlaceMap'
import { ReportCard } from '../../components/ReportCard'
import { Button, Empty, Field, buttonClass, useTitle } from '../../components/ui'
import { PLACES, reportPoint } from '../../data'
import { isOpen } from '../../logic'
import { useApp } from '../../store'

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
  const { state, tx, lang } = useApp()
  useTitle(tx('Get help', 'সাহায্য নিন'))
  const contacts = state.supportContacts
    .filter((item) => item.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  const faqs = [
    [tx('Is this for emergencies?', 'এটা কি জরুরি সেবা?'), tx('Call 999 if someone is in danger. SOS messages your saved numbers and the campus desk with your location. It does not call 999.', 'কেউ বিপদে থাকলে ৯৯৯-এ কল করুন। SOS আপনার সেভ করা নম্বরে ও ক্যাম্পাস ডেস্কে লোকেশনসহ বার্তা পাঠায়। এতে ৯৯৯-এ কল হয় না।')],
    [tx('Who sees an ordinary report?', 'সাধারণ রিপোর্ট কে দেখে?'), tx('The operations desk, the office it is assigned to, and other members can see the problem. They see your role, not a public profile.', 'অপারেশন ডেস্ক, যে দপ্তরে বরাদ্দ হয়, এবং অন্য সদস্যরা সমস্যা দেখতে পান। তারা আপনার ভূমিকা দেখেন, প্রকাশ্য প্রোফাইল নয়।')],
    [tx('Who sees a harassment report?', 'হয়রানির রিপোর্ট কে দেখে?'), tx('Campus security, student affairs, and the operations desk. Facilities offices do not.', 'ক্যাম্পাস নিরাপত্তা, শিক্ষার্থী বিষয়ক দপ্তর, এবং অপারেশন ডেস্ক। রক্ষণাবেক্ষণ দপ্তর দেখে না।')],
    [tx('What does hiding my name mean here?', 'নাম লুকানোর অর্থ কী?'), tx('Officers do not see your name. Your report stays on your account so you can follow it and reply.', 'কর্মকর্তারা আপনার নাম দেখেন না। রিপোর্ট আপনার অ্যাকাউন্টে থাকে যাতে আপনি ফলো করতে ও জবাব দিতে পারেন।')],
    [tx('Can I save a draft?', 'খসড়া সেভ করা যাবে?'), tx('Yes. Drafts stay on this device until you submit or delete them.', 'হ্যাঁ। জমা বা মুছে ফেলার আগে খসড়া এই ডিভাইসে থাকে।')],
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-4xl">{tx('Get help', 'সাহায্য নিন')}</h1>
      <div className="rounded-2xl bg-clay/10 p-4 text-sm">{tx('If you can, call 999. The SOS button messages the numbers you save and the campus desk. It does not call 999 and it cannot send a rescue.', 'পারলে ৯৯৯-এ কল করুন। SOS বোতাম আপনার সেভ করা নম্বরে ও ক্যাম্পাস ডেস্কে বার্তা পাঠায়। এতে ৯৯৯-এ কল হয় না এবং উদ্ধার পাঠানো যায় না।')}</div>
      <div className="space-y-3">
        {contacts.map((item) => {
          const name = lang === 'bn' ? item.nameBn : item.nameEn
          const description = lang === 'bn' ? item.descriptionBn : item.descriptionEn
          const tel = item.phone.replace(/[^\d+]/g, '')
          return (
            <article key={item.id} className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{supportCategoryLabel(item.category, lang)}</p>
              <h2 className="mt-1 font-display text-2xl">{name}</h2>
              {description ? <p className="mt-1 text-sm text-ink/75">{description}</p> : null}
              <a href={`tel:${tel}`} className="mt-3 inline-block font-display text-3xl text-night underline-offset-4 hover:underline">
                {item.phone}
              </a>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
                {item.hours ? <span>{item.hours}</span> : null}
                {item.email ? <a href={`mailto:${item.email}`} className="font-semibold text-teal-800">{item.email}</a> : null}
              </div>
            </article>
          )
        })}
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

function supportCategoryLabel(category: string, lang: 'en' | 'bn') {
  const labels: Record<string, [string, string]> = {
    emergency: ['Emergency', 'জরুরি'],
    counseling: ['Counseling', 'কাউন্সেলিং'],
    women_safety: ['Women safety', 'নারী নিরাপত্তা'],
    legal: ['Legal', 'আইনি'],
    health: ['Health', 'স্বাস্থ্য'],
    proctor: ['Proctor', 'প্রক্টর'],
    anti_harassment_committee: ['Anti-harassment', 'হয়রানি বিরোধী'],
  }
  const pair = labels[category]
  if (!pair) return category
  return lang === 'bn' ? pair[1] : pair[0]
}

export { ProfilePage } from '../Profile'
