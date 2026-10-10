import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { categoryIcon } from '../../categoryUi'
import { CampusMap } from '../../components/CampusMap'
import { Button, Field, useTitle } from '../../components/ui'
import { PLACES } from '../../data'
import { isOpen, isPublicFeed, priorityLabel } from '../../logic'
import { useApp, type ReportInput } from '../../store'
import type { CategoryId, Photo, Priority } from '../../types'

type FormState = {
  id: string
  title: string
  description: string
  category: CategoryId | ''
  locationId: string
  locationDetail: string
  lat?: number
  lng?: number
  photos: Photo[]
  confidential: boolean
  anonymous: boolean
  priority: Priority
  blocksAccess: boolean
  contactWindow: string
  privacyAck: boolean
  anonAck: boolean
}

const empty = (): FormState => ({
  id: '',
  title: '',
  description: '',
  category: '',
  locationId: '',
  locationDetail: '',
  photos: [],
  confidential: false,
  anonymous: false,
  priority: 'medium',
  blocksAccess: false,
  contactWindow: '',
  privacyAck: false,
  anonAck: false,
})

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('unreadable'))
    reader.readAsDataURL(file)
  })
}

export function NewReportPage() {
  const { state, tx, lang, toast, saveDraft, submitReport, confirm } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const draftId = params.get('draft') ?? ''
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(empty)
  useTitle(tx('New report', 'নতুন রিপোর্ট'))

  useEffect(() => {
    if (!draftId) return
    const draft = state.reports.find((report) => report.id === draftId && report.status === 'draft')
    if (!draft) return
    setForm((current) => current.id === draft.id ? current : {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      category: draft.category,
      locationId: draft.locationId,
      locationDetail: draft.locationDetail,
      lat: draft.lat,
      lng: draft.lng,
      photos: draft.photos,
      confidential: draft.confidential,
      anonymous: draft.anonymous,
      priority: draft.priority,
      blocksAccess: draft.blocksAccess,
      contactWindow: draft.contactWindow,
      privacyAck: draft.confidential,
      anonAck: draft.anonymous,
    })
  }, [draftId, state.reports])

  const steps = [tx('Category', 'বিভাগ'), tx('Details', 'বিবরণ'), tx('Place', 'স্থান'), tx('Privacy', 'গোপনীয়তা'), tx('Review', 'পর্যালোচনা')]
  const category = state.categories.find((item) => item.id === form.category)
  const sensitive = category?.sensitive || form.category === 'harassment'
  const place = PLACES.find((item) => item.id === form.locationId)
  const planned = state.announcements.find((item) => item.active && item.kind === 'maintenance' && item.locationId === form.locationId)
  const similar = state.reports.filter((report) => form.category && report.category === form.category && report.locationId === form.locationId && report.id !== form.id && isPublicFeed(report) && isOpen(report.status)).slice(0, 3)
  const counts = Object.fromEntries(PLACES.map((item) => [item.id, state.reports.filter((report) => report.locationId === item.id && isMapOpen(report)).length]))

  const stepReady = [
    Boolean(form.category),
    form.title.trim().length >= 8 && form.description.trim().length >= 20,
    Boolean(form.locationId),
    ((!sensitive && !form.confidential) || form.privacyAck) && (!form.anonymous || form.anonAck),
    true,
  ][step]

  const payload = (): ReportInput | null => {
    if (!form.category) return null
    return {
      id: form.id || undefined,
      title: form.title,
      description: form.description,
      category: form.category,
      locationId: form.locationId,
      locationDetail: form.locationDetail,
      lat: form.lat,
      lng: form.lng,
      photos: form.photos,
      confidential: sensitive ? true : form.confidential,
      anonymous: form.anonymous,
      priority: form.priority,
      blocksAccess: form.blocksAccess,
      contactWindow: form.contactWindow,
    }
  }

  const pickCategory = (id: CategoryId) => {
    const next = state.categories.find((item) => item.id === id)
    setForm((current) => ({
      ...current,
      category: id,
      confidential: next?.sensitive ? true : current.confidential,
      priority: id === 'harassment' || id === 'safety' ? 'high' : current.priority,
    }))
  }

  const addPhotos = async (files: File[]) => {
    const room = 3 - form.photos.length
    const next: Photo[] = []
    for (const file of files.slice(0, room)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast(tx('Use a JPG, PNG, or WebP photo.', 'JPG, PNG বা WebP ছবি দিন।'))
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        toast(tx('Each photo must be under 5 MB.', 'প্রতিটি ছবি ৫ এমবির কম হতে হবে।'))
        continue
      }
      next.push({ name: file.name, url: await readFile(file) })
    }
    setForm((current) => ({ ...current, photos: [...current.photos, ...next].slice(0, 3) }))
  }

  const locate = () => {
    if (!navigator.geolocation) {
      toast(tx('This browser cannot share a location.', 'এই ব্রাউজার লোকেশন দিতে পারে না।'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setForm((current) => ({ ...current, lat: position.coords.latitude, lng: position.coords.longitude })),
      () => toast(tx('Location was blocked. The campus place is enough.', 'লোকেশন বন্ধ আছে। ক্যাম্পাসের স্থানই যথেষ্ট।')),
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">{tx('New report', 'নতুন রিপোর্ট')}</h1>
      <ol className="mt-4 flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => index < step && setStep(index)} className={`rounded-full px-3 py-1 text-xs font-semibold ${index === step ? 'bg-teal-800 text-white' : 'bg-white text-ink/60'}`}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-4">
        {step === 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {state.categories.filter((item) => item.active).map((item) => {
              const Icon = categoryIcon[item.id]
              const active = form.category === item.id
              return (
                <button key={item.id} type="button" onClick={() => pickCategory(item.id)} className={`panel p-4 text-left ${active ? 'border-teal-700 bg-teal-50' : ''}`}>
                  <Icon className="h-4 w-4 text-teal-800" />
                  <span className="mt-2 block font-semibold">{lang === 'bn' ? item.bn : item.en}</span>
                  <span className="mt-1 block text-sm text-ink/65">{lang === 'bn' ? item.hintBn : item.hintEn}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <Field label={tx('Title', 'শিরোনাম')} hint={tx('At least 8 characters.', 'কমপক্ষে ৮ অক্ষর।')}>
              <input className="input" maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label={tx('What happened', 'কী হয়েছে')} hint={tx('At least 20 characters. Leave out gossip and other people’s full names if you can.', 'কমপক্ষে ২০ অক্ষর। সম্ভব হলে গুজব ও অন্যের পুরো নাম বাদ দিন।')}>
              <textarea className="input min-h-36" maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <Field label={tx('Impact', 'প্রভাব')}>
              <select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>
                {(['low', 'medium', 'high'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityLabel(priority, lang)}</option>)}
                {form.category === 'safety' || form.category === 'harassment' ? <option value="urgent">{priorityLabel('urgent', lang)}</option> : null}
              </select>
            </Field>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={form.blocksAccess} onChange={(event) => setForm({ ...form, blocksAccess: event.target.checked })} />
              {tx('This blocks a class, a dorm, or a route.', 'এতে ক্লাস, হল, বা পথ আটকে আছে।')}
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <CampusMap counts={counts} selected={form.locationId} onSelect={(id) => setForm({ ...form, locationId: id })} labelFor={(item) => (lang === 'bn' ? item.bn : item.short)} />
            <div className="flex flex-wrap gap-2">
              {PLACES.map((item) => (
                <button key={item.id} type="button" onClick={() => setForm({ ...form, locationId: item.id })} className={`rounded-full border px-3 py-1.5 text-sm ${form.locationId === item.id ? 'border-teal-700 bg-teal-800 text-white' : 'border-line bg-white'}`}>
                  {lang === 'bn' ? item.bn : item.en}
                </button>
              ))}
            </div>
            <Field label={tx('Detail', 'বিস্তারিত')} hint={tx('Room, pole, or side of the building.', 'কক্ষ, খুঁটি, বা ভবনের কোন পাশ।')}>
              <input className="input" value={form.locationDetail} onChange={(event) => setForm({ ...form, locationDetail: event.target.value })} />
            </Field>
            <Button variant="secondary" onClick={locate}>{tx('Add this device’s location', 'এই ডিভাইসের লোকেশন যোগ করুন')}</Button>
            {form.lat ? <p className="text-sm text-ink/60">{form.lat.toFixed(5)}, {form.lng?.toFixed(5)}</p> : null}
            {planned ? <div className="rounded-2xl bg-marigold/20 p-4 text-sm"><p className="font-semibold">{planned.title}</p><p className="mt-1">{planned.body}</p></div> : null}
            {similar.length > 0 ? (
              <div className="panel p-4">
                <p className="font-semibold">{tx('Open reports at this place', 'এই জায়গায় খোলা রিপোর্ট')}</p>
                <ul className="mt-3 space-y-3">
                  {similar.map((report) => (
                    <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{report.id} · {report.title}</span>
                      <Button variant="secondary" onClick={() => { confirm(report.id); navigate(`/app/reports/${report.id}`) }}>{tx('Add me to this one', 'এতে আমাকে যোগ করুন')}</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <label className="panel flex gap-3 p-4 text-sm">
              <input type="checkbox" checked={sensitive || form.confidential} disabled={sensitive} onChange={(event) => setForm({ ...form, confidential: event.target.checked, anonymous: event.target.checked ? form.anonymous : false })} />
              <span>
                <span className="block font-semibold">{tx('Restricted audience', 'সীমিত পরিসর')}</span>
                {tx('Only security, student affairs, and the operations desk can read the story. Harassment reports always use this.', 'শুধু নিরাপত্তা, শিক্ষার্থী বিষয়ক দপ্তর এবং অপারেশন ডেস্ক বিবরণ পড়তে পারে। হয়রানির রিপোর্টে এটি বাধ্যতামূলক।')}
              </span>
            </label>
            <label className="panel flex gap-3 p-4 text-sm">
              <input type="checkbox" checked={form.anonymous} onChange={(event) => setForm({ ...form, anonymous: event.target.checked, confidential: event.target.checked ? true : form.confidential })} />
              <span>
                <span className="block font-semibold">{tx('Hide my name', 'আমার নাম লুকান')}</span>
                {tx('Officers will not see your name. In this preview the report still stays in your account so you can track it. A production system should keep that link in a separate restricted record. There is no direct reply channel for a fully anonymous report.', 'কর্মকর্তারা আপনার নাম দেখবেন না। এই প্রিভিউতে রিপোর্ট আপনার অ্যাকাউন্টে থাকে যাতে আপনি অনুসরণ করতে পারেন। আসল সিস্টেমে সেই যোগসূত্র আলাদা সীমিত রেকর্ডে থাকবে। সম্পূর্ণ বেনামি রিপোর্টে সরাসরি উত্তরের পথ থাকে না।')}
              </span>
            </label>
            {(sensitive || form.confidential) && !form.anonymous ? (
              <Field label={tx('Best time for the safety team to reach you in the app', 'অ্যাপে নিরাপত্তা দলের কথা বলার সময়')}>
                <input className="input" value={form.contactWindow} onChange={(event) => setForm({ ...form, contactWindow: event.target.value })} />
              </Field>
            ) : null}
            {sensitive || form.confidential ? (
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={form.privacyAck} onChange={(event) => setForm({ ...form, privacyAck: event.target.checked })} />
                {tx('I understand the limited audience.', 'আমি সীমিত পরিসর বুঝেছি।')}
              </label>
            ) : null}
            {form.anonymous ? (
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={form.anonAck} onChange={(event) => setForm({ ...form, anonAck: event.target.checked })} />
                {tx('I understand officers may not be able to ask follow-up questions.', 'আমি বুঝেছি কর্মকর্তারা হয়তো ফলোআপ প্রশ্ন করতে পারবেন না।')}
              </label>
            ) : null}
            <Field label={tx('Photos', 'ছবি')} hint={tx('Up to 3. JPG, PNG, or WebP. 5 MB each. Avoid faces of people who are not involved.', 'সর্বোচ্চ ৩টি। JPG, PNG বা WebP। প্রতিটি ৫ এমবি। যারা জড়িত নন, তাদের মুখ এড়িয়ে চলুন।')}>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const list = event.target.files; if (list) void addPhotos(Array.from(list)); event.target.value = '' }} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {form.photos.map((photo) => (
                <button key={photo.name} type="button" className="rounded-full bg-white px-3 py-1 text-xs" onClick={() => setForm({ ...form, photos: form.photos.filter((item) => item.name !== photo.name) })}>
                  {photo.name} ×
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="panel space-y-2 p-5 text-sm">
            <p className="font-display text-3xl">{form.title}</p>
            <p>{lang === 'bn' ? category?.bn : category?.en} · {place ? (lang === 'bn' ? place.bn : place.en) : ''}</p>
            <p className="whitespace-pre-wrap text-ink/80">{form.description}</p>
            <p>{form.confidential || sensitive ? tx('Restricted', 'সীমিত') : tx('Ordinary campus report', 'সাধারণ ক্যাম্পাস রিপোর্ট')} · {form.anonymous ? tx('Name hidden', 'নাম গোপন') : tx('Name visible to the assigned office', 'বরাদ্দকৃত দপ্তর নাম দেখতে পাবে')}</p>
            <p className="text-ink/60">{tx('An officer confirms the department. Safely only suggests one.', 'কর্মকর্তা বিভাগ নিশ্চিত করেন। সেইফলি শুধু পরামর্শ দেয়।')} {lang === 'bn' ? state.departments.find((item) => item.id === category?.suggestedDepartmentId)?.bn : state.departments.find((item) => item.id === category?.suggestedDepartmentId)?.en}</p>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-24 z-20 mt-6 flex flex-wrap gap-2 bg-paper/95 py-3 md:static md:bg-transparent">
        {step > 0 ? <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>{tx('Back', 'পেছনে')}</Button> : null}
        {step < 4 ? <Button disabled={!stepReady} onClick={() => setStep((value) => value + 1)}>{tx('Continue', 'এগিয়ে যান')}</Button> : null}
        {step > 0 ? (
          <Button variant="ghost" onClick={() => {
            const body = payload()
            if (!body) return
            const id = saveDraft(body)
            if (id) {
              setForm((current) => ({ ...current, id }))
              setParams({ draft: id })
            }
          }}>{tx('Save draft', 'খসড়া সেভ')}</Button>
        ) : null}
        {step === 4 ? (
          <Button disabled={!form.category || !form.locationId} onClick={() => {
            const body = payload()
            if (!body) return
            const id = submitReport(body)
            if (id) navigate(`/app/reports/${id}`, { state: { submitted: true } })
          }}>{tx('Submit report', 'রিপোর্ট জমা দিন')}</Button>
        ) : null}
      </div>
    </div>
  )
}

function isMapOpen(report: { locationId: string; status: string; confidential: boolean; anonymous: boolean; category: string }) {
  return !report.confidential && !report.anonymous && report.category !== 'harassment' && report.category !== 'safety' && report.status !== 'draft' && report.status !== 'rejected' && report.status !== 'closed'
}
