import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { categoryIcon } from '../../categoryUi'
import { GooglePlaceMap } from '../../components/GooglePlaceMap'
import { PinPicker } from '../../components/PinPicker'
import { Button, Field, useTitle } from '../../components/ui'
import { PLACES, SUBCATEGORIES, subcategoryLabel } from '../../data'
import { mediaProblem } from '../../lib/reportMedia'
import { readCloseLocation } from '../../lib/sos'
import { stripImageMeta } from '../../lib/stripImageMeta'
import { isMapPin, isOpen, isPublicFeed, priorityLabel } from '../../logic'
import { useApp, type ReportInput } from '../../store'
import type { CategoryId, Photo, Priority } from '../../types'

type FormState = {
  id: string
  title: string
  description: string
  category: CategoryId | ''
  subcategory: string
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
  pinFromDevice: boolean
  pinMoved: boolean
}

const empty = (): FormState => ({
  id: '',
  title: '',
  description: '',
  category: '',
  subcategory: '',
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
  pinFromDevice: false,
  pinMoved: false,
})

export function NewReportPage() {
  const { state, tx, lang, toast, saveDraft, submitReport, confirm } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const draftId = params.get('draft') ?? ''
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [voice, setVoice] = useState<{ blob: Blob; mime: string; seconds: number } | null>(null)
  const [video, setVideo] = useState<{ file: File; mime: string; seconds: number } | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
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
      subcategory: draft.subcategory ?? '',
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
      pinFromDevice: false,
      pinMoved: false,
    })
  }, [draftId, state.reports])

  const requestedCategory = params.get('category') ?? ''
  useEffect(() => {
    if (draftId || !requestedCategory) return
    if (!state.categories.some((item) => item.id === requestedCategory)) return
    setForm((current) => (current.category ? current : { ...current, category: requestedCategory as CategoryId }))
  }, [draftId, requestedCategory, state.categories])

  const steps = [tx('Report', 'রিপোর্ট'), tx('Photos', 'ছবি'), tx('Location', 'স্থান'), tx('Privacy', 'গোপনীয়তা'), tx('Review', 'পর্যালোচনা')]
  const subs = form.category ? SUBCATEGORIES[form.category] : []
  const category = state.categories.find((item) => item.id === form.category)
  const sensitive = category?.sensitive || form.category === 'harassment'
  const place = PLACES.find((item) => item.id === form.locationId)
  const planned = state.announcements.find((item) => item.active && item.kind === 'maintenance' && item.locationId === form.locationId)
  const similar = state.reports.filter((report) => form.category && report.category === form.category && report.locationId === form.locationId && report.id !== form.id && isPublicFeed(report) && isOpen(report.status)).slice(0, 3)
  const counts = Object.fromEntries(PLACES.map((item) => [item.id, state.reports.filter((report) => report.locationId === item.id && isMapPin(report)).length]))
  const places = [...PLACES].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))

  const gaps = (): string[] => {
    const items: string[] = []
    const title = form.title.trim().length
    const description = form.description.trim().length
    if (step === 0) {
      if (title < 8) items.push(tx(`Title (${title}/8 characters)`, `শিরোনাম (${title}/৮ অক্ষর)`))
      if (!form.category) items.push(tx('Category', 'বিভাগ'))
      else if (!form.subcategory) items.push(tx('Subcategory', 'উপবিভাগ'))
      if (description < 20) items.push(tx(`Description (${description}/20 characters)`, `বিবরণ (${description}/২০ অক্ষর)`))
    }
    if (step === 2) {
      if (!form.locationId) items.push(tx('Campus building', 'ক্যাম্পাস ভবন'))
      if (form.locationDetail.trim().length < 3) items.push(tx('Exact location', 'ঠিকানা'))
      if (form.lat == null || form.lng == null) items.push(tx('Map pin', 'ম্যাপের পিন'))
    }
    if (step === 3) {
      if ((sensitive || form.confidential) && !form.privacyAck) items.push(tx('The confidential confirmation', 'গোপন রিপোর্টের নিশ্চিতকরণ'))
      if (form.anonymous && !form.anonAck) items.push(tx('The anonymous confirmation', 'বেনামি নিশ্চিতকরণ'))
    }
    return items
  }

  const payload = (): ReportInput | null => {
    if (!form.category) return null
    return {
      id: form.id || undefined,
      title: form.title,
      description: form.description,
      category: form.category,
      subcategory: form.subcategory,
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
      subcategory: '',
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
      try {
        const cleaned = await stripImageMeta(file)
        next.push({ name: cleaned.name, url: cleaned.url })
      } catch {
        toast(tx('That photo could not be prepared. Try another file.', 'ছবি প্রস্তুত করা যায়নি। অন্য ফাইল চেষ্টা করুন।'))
      }
    }
    setForm((current) => ({ ...current, photos: [...current.photos, ...next].slice(0, 3) }))
  }

  const stopRecording = () => {
    recorder.current?.stop()
    recorder.current = null
    setRecording(false)
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast(tx('This browser cannot record audio.', 'এই ব্রাউজার অডিও রেকর্ড করতে পারে না।'))
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    const rec = new MediaRecorder(stream)
    const chunks: Blob[] = []
    const started = Date.now()
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      const seconds = Math.max(1, Math.min(60, Math.round((Date.now() - started) / 1000)))
      const blob = new Blob(chunks, { type: mime })
      const problem = mediaProblem('voice', mime, blob.size, seconds)
      if (problem) toast(problem)
      else setVoice({ blob, mime, seconds })
    }
    rec.start()
    recorder.current = rec
    setRecordSeconds(0)
    setRecording(true)
    window.setTimeout(() => {
      if (recorder.current === rec) stopRecording()
    }, 60_000)
    const tick = window.setInterval(() => {
      const seconds = Math.min(60, Math.round((Date.now() - started) / 1000))
      setRecordSeconds(seconds)
      if (seconds >= 60) window.clearInterval(tick)
    }, 250)
  }

  const addVideo = async (file: File) => {
    try {
      const mime = file.type || 'video/mp4'
      const seconds = await clipDuration(file)
      const problem = mediaProblem('video', mime, file.size, seconds)
      if (problem) {
        toast(problem)
        return
      }
      setVideo({ file, mime, seconds })
    } catch {
      toast(tx('That video could not be read. Try an MP4, WebM, or MOV.', 'ভিডিও পড়া যায়নি। MP4, WebM, বা MOV চেষ্টা করুন।'))
    }
  }

  const choosePlace = (id: string) => {
    const item = PLACES.find((place) => place.id === id)
    setForm((current) => ({
      ...current,
      locationId: id,
      lat: item?.lat,
      lng: item?.lng,
      pinFromDevice: false,
      pinMoved: false,
    }))
  }

  const locate = () => {
    if (!form.locationId) {
      toast(tx('Choose the building first.', 'আগে ভবনটি বেছে নিন।'))
      return
    }
    if (!navigator.geolocation) {
      toast(tx('This browser cannot share a location. The building pin is enough.', 'এই ব্রাউজার লোকেশন দিতে পারে না। ভবনের পিনই যথেষ্ট।'))
      return
    }
    toast(tx('Reading a close device location…', 'কাছের ডিভাইস লোকেশন পড়া হচ্ছে…'))
    readCloseLocation(
      (fix) => {
        setForm((current) => ({
          ...current,
          lat: fix.lat,
          lng: fix.lng,
          pinFromDevice: true,
          pinMoved: false,
        }))
        toast(tx(`The pin moved to this device (${Math.round(fix.accuracy)} m). That is what the office will see.`, `পিন এই ডিভাইসে গেছে (${Math.round(fix.accuracy)} মি)। দপ্তর সেটিই দেখবে।`))
      },
      (reason) => {
        if (reason === 'denied') {
          toast(tx('Location was blocked. The building pin is enough.', 'লোকেশন বন্ধ আছে। ভবনের পিনই যথেষ্ট।'))
          return
        }
        toast(tx('GPS did not arrive, so the pin stayed on the building. Laptop Wi-Fi often pins a nearby hall, not you — drag the pin yourself.', 'GPS আসেনি, তাই পিন ভবনেই আছে। ল্যাপটপের Wi-Fi কাছের হলে বসে, আপনাতে নয় — পিন নিজে সরিয়ে নিন।'))
      },
    )
  }

  const movePin = (lat: number, lng: number) => {
    setForm((current) => ({ ...current, lat, lng, pinFromDevice: false, pinMoved: true }))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">{tx('New report', 'নতুন রিপোর্ট')}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink/65">{tx('If someone is in danger, call 999 first. This form is for the campus desk.', 'কেউ বিপদে থাকলে আগে ৯৯৯-এ কল করুন। এই ফর্ম ক্যাম্পাস ডেস্কের জন্য।')}</p>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink/55">
          <span>{steps[step]}</span>
          <span>{step + 1} / {steps.length}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-teal-800" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {steps.map((label, index) => (
            <li key={label} className="shrink-0">
              <button type="button" onClick={() => index < step && setStep(index)} className={`rounded-full px-3 py-1 text-xs font-semibold ${index === step ? 'bg-teal-800 text-white' : index < step ? 'bg-white text-teal-800' : 'bg-white/70 text-ink/40'}`}>
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 space-y-4">
        {step === 0 ? (
          <div className="space-y-4">
            <Field label={tx('Report title', 'রিপোর্টের শিরোনাম')} hint={tx(`At least 8 characters (${form.title.trim().length}/8). Say the problem in one line.`, `কমপক্ষে ৮ অক্ষর (${form.title.trim().length}/৮)। এক লাইনে সমস্যাটি বলুন।`)}>
              <input className="input" maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium">{tx('Category', 'বিভাগ')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {state.categories.filter((item) => item.active).map((item) => {
                  const Icon = categoryIcon[item.id]
                  const active = form.category === item.id
                  return (
                    <button key={item.id} type="button" onClick={() => pickCategory(item.id)} className={`rounded-2xl border p-4 text-left shadow-card ${active ? 'border-teal-800 bg-teal-50 ring-2 ring-teal-800' : 'border-line bg-white'}`}>
                      <Icon className="h-4 w-4 text-teal-800" />
                      <span className="mt-2 block font-semibold">{lang === 'bn' ? item.bn : item.en}</span>
                      <span className="mt-1 block text-sm text-ink/65">{lang === 'bn' ? item.hintBn : item.hintEn}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {subs.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">{tx('Subcategory', 'উপবিভাগ')}</p>
                <div className="flex flex-wrap gap-2">
                  {subs.map((item) => (
                    <button key={item.id} type="button" onClick={() => setForm({ ...form, subcategory: item.id })} className={`rounded-full border px-3 py-2 text-sm ${form.subcategory === item.id ? 'border-teal-700 bg-teal-800 text-white' : 'border-line bg-white'}`}>
                      {lang === 'bn' ? item.bn : item.en}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Field label={tx('Description', 'বিবরণ')} hint={tx(`At least 20 characters (${form.description.trim().length}/20). Leave out gossip and other people’s full names if you can.`, `কমপক্ষে ২০ অক্ষর (${form.description.trim().length}/২০)। সম্ভব হলে গুজব ও অন্যের পুরো নাম বাদ দিন।`)}>
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

        {step === 1 ? (
          <div className="space-y-4">
            <Field label={tx('Photos', 'ছবি')} hint={tx('Optional. Up to 3. JPG, PNG, or WebP. 5 MB each. EXIF and GPS in the file are removed before upload. The map pin is chosen separately on the next step.', 'ঐচ্ছিক। সর্বোচ্চ ৩টি। JPG, PNG বা WebP। প্রতিটি ৫ এমবি। আপলোডের আগে ফাইলের EXIF ও GPS সরানো হয়। ম্যাপের পিন পরের ধাপে আলাদা বেছে নিন।')}>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const list = event.target.files; if (list) void addPhotos(Array.from(list)); event.target.value = '' }} />
            </Field>
            {form.photos.length === 0 ? <p className="text-sm text-ink/60">{tx('No photo yet. You can continue without one.', 'এখনও ছবি নেই। ছবি ছাড়াও এগোনো যায়।')}</p> : <PhotoPreviews photos={form.photos} onRemove={(index) => setForm({ ...form, photos: form.photos.filter((_, item) => item !== index) })} removeLabel={tx('Remove', 'সরান')} />}
            <div className="space-y-2">
              <p className="text-sm font-semibold">{tx('Voice note', 'ভয়েস নোট')}</p>
              <p className="text-sm text-ink/60">{tx('Optional. Up to 60 seconds and 10 MB. Recorded in the browser. ID3 tags are removed from MP3 files.', 'ঐচ্ছিক। সর্বোচ্চ ৬০ সেকেন্ড ও ১০ এমবি। ব্রাউজারে রেকর্ড হয়। MP3-এর ID3 ট্যাগ সরানো হয়।')}</p>
              {recording ? (
                <Button type="button" variant="secondary" onClick={stopRecording}>{tx(`Stop (${recordSeconds}s)`, `থামান (${recordSeconds} সে.)`)}</Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => void startRecording()}>{tx('Record voice note', 'ভয়েস নোট রেকর্ড')}</Button>
              )}
              {voice ? <p className="text-sm">{tx(`Voice note ready · ${voice.seconds}s`, `ভয়েস নোট প্রস্তুত · ${voice.seconds} সে.`)} <button type="button" className="font-semibold text-clay" onClick={() => setVoice(null)}>{tx('Remove', 'সরান')}</button></p> : null}
            </div>
            <Field label={tx('Short video', 'ছোট ভিডিও')} hint={tx('Optional. Up to 30 seconds and 20 MB. MP4, WebM, or MOV.', 'ঐচ্ছিক। সর্বোচ্চ ৩০ সেকেন্ড ও ২০ এমবি। MP4, WebM, বা MOV।')}>
              <input className="input" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addVideo(file); event.target.value = '' }} />
            </Field>
            {video ? <p className="text-sm">{tx(`Video ready · ${Math.round(video.seconds)}s`, `ভিডিও প্রস্তুত · ${Math.round(video.seconds)} সে.`)} <button type="button" className="font-semibold text-clay" onClick={() => setVideo(null)}>{tx('Remove', 'সরান')}</button></p> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <Field label={tx('Campus building', 'ক্যাম্পাস ভবন')}>
              <div className="flex flex-wrap gap-2">
                {places.map((item) => (
                  <button key={item.id} type="button" onClick={() => choosePlace(item.id)} className={`rounded-full border px-3 py-2 text-sm ${form.locationId === item.id ? 'border-teal-700 bg-teal-800 text-white' : 'border-line bg-white'}`}>
                    {lang === 'bn' ? item.bn : item.en}
                    {counts[item.id] ? ` · ${counts[item.id]}` : ''}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={tx('Exact location', 'ঠিকানা')} hint={tx('Room, pole, gate, or side of the building.', 'কক্ষ, খুঁটি, গেট, বা ভবনের কোন পাশ।')}>
              <input className="input" value={form.locationDetail} onChange={(event) => setForm({ ...form, locationDetail: event.target.value })} placeholder={tx('Example: west gate, beside the water tap', 'যেমন: পশ্চিম গেট, পানির ট্যাপের পাশে')} />
            </Field>
            {place && form.lat != null && form.lng != null ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{tx('Move the pin', 'পিন সরান')}</p>
                <p className="text-sm text-ink/70">{tx('Drag the pin, or tap the map, until it sits on the problem. The review step shows this spot on Google Maps.', 'পিন টেনে, বা ম্যাপে টোকা দিয়ে, সমস্যার উপর আনুন। পরের ধাপে এই জায়গা গুগল ম্যাপে দেখা যাবে।')}</p>
                <PinPicker lat={form.lat} lng={form.lng} onMove={movePin} />
                <p className="text-xs text-ink/55">
                  {form.pinMoved ? tx('You moved this pin.', 'আপনি এই পিন সরিয়েছেন।') : form.pinFromDevice ? tx('Pin from this device.', 'পিন এই ডিভাইস থেকে।') : tx('Pin starts at the building you chose.', 'পিন আপনার বেছে নেওয়া ভবন থেকে শুরু।')}
                </p>
              </div>
            ) : (
              <div className="panel px-5 py-8 text-sm text-ink/70">{tx('Choose a building and the pin appears for you to move.', 'ভবন বেছে নিলে পিন আসবে, তারপর সেটি সরাতে পারবেন।')}</div>
            )}
            <Button variant="secondary" onClick={locate} disabled={!form.locationId}>{tx('I am standing here', 'আমি এখানে দাঁড়িয়ে আছি')}</Button>
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
            <p className="text-sm text-ink/70">{tx('These two choices are separate. Read both before you continue.', 'এই দুটি আলাদা। এগোনোর আগে দুটোই পড়ুন।')}</p>
            <label className="panel block space-y-2 p-4 text-sm">
              <span className="flex gap-3">
                <input type="checkbox" checked={sensitive || form.confidential} disabled={sensitive} onChange={(event) => setForm({ ...form, confidential: event.target.checked, anonymous: event.target.checked ? form.anonymous : false })} />
                <span className="font-semibold">{tx('Confidential', 'গোপন')}</span>
              </span>
              <span className="block pl-7 text-ink/75">{tx('The story is hidden from the public map, other students, and ordinary offices. Security, Student Affairs, and the operations desk can still read it. Your name stays visible to that desk unless you also hide it. Harassment reports are always confidential.', 'বিবরণ প্রকাশ্য ম্যাপ, অন্য শিক্ষার্থী, এবং সাধারণ দপ্তরের কাছ থেকে লুকানো থাকে। নিরাপত্তা, শিক্ষার্থী বিষয়ক দপ্তর, এবং অপারেশন ডেস্ক পড়তে পারে। নাম না লুকালে সেই ডেস্ক আপনার নাম দেখে। হয়রানির রিপোর্ট সবসময় গোপন।')}</span>
            </label>
            <label className="panel block space-y-2 p-4 text-sm">
              <span className="flex gap-3">
                <input type="checkbox" checked={form.anonymous} onChange={(event) => setForm({ ...form, anonymous: event.target.checked, confidential: event.target.checked ? true : form.confidential })} />
                <span className="font-semibold">{tx('Anonymous', 'বেনামি')}</span>
              </span>
              <span className="block space-y-2 pl-7 text-ink/75">
                <span className="block">{tx('Admin, security, and department desks see only “Anonymous” — not your name, email, or avatar.', 'অ্যাডমিন, নিরাপত্তা এবং দপ্তর শুধু “বেনামি” দেখে — আপনার নাম, ইমেইল বা ছবি নয়।')}</span>
                <span className="block">{tx('You still see the report under My reports and can reply to information requests. Those replies are labeled “Reporter”, not your name.', 'আপনি My reports-এ রিপোর্ট দেখবেন এবং তথ্যের অনুরোধে উত্তর দিতে পারবেন। উত্তরে “Reporter” লেখা থাকে, আপনার নাম নয়।')}</span>
                <span className="block">{tx('Only operations or Student Affairs can reveal your identity for a harassment or safety emergency, and that step is written to the audit log.', 'শুধু অপারেশন বা শিক্ষার্থী বিষয়ক দপ্তর হয়রানি বা নিরাপত্তা জরুরি অবস্থায় পরিচয় খুলতে পারে, এবং সেটি অডিট লগে লেখা হয়।')}</span>
                <span className="block">{tx('Anonymous also turns Confidential on, so the story stays off the public map and away from ordinary offices.', 'বেনামি চালু করলে গোপনও চালু হয়, তাই বিবরণ প্রকাশ্য ম্যাপ ও সাধারণ দপ্তর থেকে দূরে থাকে।')}</span>
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
                {tx('I understand who can read a confidential report.', 'গোপন রিপোর্ট কে পড়তে পারে তা আমি বুঝেছি।')}
              </label>
            ) : null}
            {form.anonymous ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-clay/10 p-4 text-sm text-ink/80">
                  {tx(
                    'Photos, a voice note, or a video can still identify you. Faces, uniforms, and the sound of a voice may reveal who filed the report even when your name is hidden.',
                    'ছবি, ভয়েস নোট, বা ভিডিও থেকেও পরিচয় ফাঁস হতে পারে। মুখ, ইউনিফর্ম, এবং কণ্ঠস্বর নাম লুকানো থাকলেও রিপোর্টকারীকে চেনা দিতে পারে।',
                  )}
                </div>
                <label className="flex gap-2 text-sm">
                  <input type="checkbox" checked={form.anonAck} onChange={(event) => setForm({ ...form, anonAck: event.target.checked })} />
                  {tx('I understand staff see Anonymous only, I keep My reports access, and reveal needs two desk officers plus an audited emergency reason.', 'আমি বুঝেছি কর্মকর্তারা শুধু বেনামি দেখেন, আমি My reports রাখি, এবং পরিচয় খুলতে দুইজন ডেস্ক কর্মকর্তা ও অডিটসহ জরুরি কারণ লাগে।')}
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="panel space-y-3 p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{tx('Review before you submit', 'জমা দেওয়ার আগে দেখে নিন')}</p>
            <p className="font-display text-3xl">{form.title}</p>
            <p>{lang === 'bn' ? category?.bn : category?.en}{form.subcategory ? ` · ${subcategoryLabel(form.category, form.subcategory, lang)}` : ''} · {place ? (lang === 'bn' ? place.bn : place.en) : ''}{form.locationDetail ? ` · ${form.locationDetail}` : ''}</p>
            <p className="whitespace-pre-wrap text-ink/80">{form.description}</p>
            {form.photos.length > 0 ? <PhotoPreviews photos={form.photos} /> : <p className="text-ink/55">{tx('No photos attached.', 'কোনো ছবি যোগ হয়নি।')}</p>}
            <p className="text-ink/70">{voice ? tx(`Voice note · ${voice.seconds}s`, `ভয়েস নোট · ${voice.seconds} সে.`) : tx('No voice note.', 'ভয়েস নোট নেই।')} · {video ? tx(`Video · ${Math.round(video.seconds)}s`, `ভিডিও · ${Math.round(video.seconds)} সে.`) : tx('No video.', 'ভিডিও নেই।')}</p>
            {place && form.lat != null && form.lng != null ? (
              <GooglePlaceMap
                lat={form.lat}
                lng={form.lng}
                label={lang === 'bn' ? place.bn : place.en}
                note={form.pinMoved ? tx('Pin you placed. Check it on Google Maps.', 'আপনার বসানো পিন। গুগল ম্যাপে দেখে নিন।') : tx('Check this pin before you submit.', 'জমা দেওয়ার আগে এই পিন দেখে নিন।')}
              />
            ) : null}
            <p>{form.confidential || sensitive ? tx('Confidential — limited desk', 'গোপন — সীমিত ডেস্ক') : tx('Ordinary campus report', 'সাধারণ ক্যাম্পাস রিপোর্ট')} · {form.anonymous ? tx('Anonymous — staff see Anonymous only', 'বেনামি — কর্মকর্তারা শুধু বেনামি দেখেন') : tx('Name visible to the assigned office', 'বরাদ্দকৃত দপ্তর নাম দেখতে পাবে')}</p>
            <p className="text-ink/60">{tx('An officer confirms the department. Safely only suggests one.', 'কর্মকর্তা বিভাগ নিশ্চিত করেন। সেইফলি শুধু পরামর্শ দেয়।')} {lang === 'bn' ? state.departments.find((item) => item.id === category?.suggestedDepartmentId)?.bn : state.departments.find((item) => item.id === category?.suggestedDepartmentId)?.en}</p>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-24 z-20 -mx-4 mt-6 rounded-t-2xl border border-line bg-white px-4 py-3 shadow-card md:bottom-4">
      {gaps().length > 0 ? <p className="mb-3 text-sm text-clay">{tx('Still needed before you can continue:', 'এগোনোর আগে এগুলো দরকার:')} {gaps().join(' · ')}</p> : null}
      <div className="flex flex-wrap gap-2">
        {step > 0 ? <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>{tx('Back', 'পেছনে')}</Button> : null}
        {step < 4 ? <Button onClick={() => {
          const missing = gaps()
          if (missing.length) {
            toast(tx(`Still needed: ${missing.join(', ')}.`, `এখনও দরকার: ${missing.join(', ')}।`))
            return
          }
          setStep((value) => value + 1)
        }}>{tx('Continue', 'এগিয়ে যান')}</Button> : null}
        {step > 0 ? (
          <Button variant="ghost" onClick={() => {
            const body = payload()
            if (!body) return
            void saveDraft(body).then((id) => {
              if (!id) return
              setForm((current) => ({ ...current, id }))
              setParams({ draft: id })
            })
          }}>{tx('Save draft', 'খসড়া সেভ')}</Button>
        ) : null}
        {step === 4 ? (
          <Button disabled={sending} onClick={() => {
            const body = payload()
            if (!body || form.title.trim().length < 8 || form.description.trim().length < 20 || !form.subcategory || !form.locationId || form.locationDetail.trim().length < 3) {
              toast(tx('Go back and finish the title, description, category, and place.', 'পেছনে গিয়ে শিরোনাম, বিবরণ, বিভাগ, এবং স্থান শেষ করুন।'))
              return
            }
            setSending(true)
            void submitReport(body, {
              voice: voice ? { file: voice.blob, mime: voice.mime, seconds: voice.seconds, name: 'voice' } : undefined,
              video: video ? { file: video.file, mime: video.mime, seconds: video.seconds, name: video.file.name } : undefined,
            }).then((id) => {
              setSending(false)
              if (id) navigate(`/app/reports/${id}`, { state: { submitted: true } })
            })
          }}>{tx('Submit report', 'রিপোর্ট জমা দিন')}</Button>
        ) : null}
      </div>
      </div>
    </div>
  )
}

function clipDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const seconds = video.duration
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(seconds) ? seconds : 0)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    video.src = url
  })
}

function PhotoPreviews({ photos, onRemove, removeLabel }: { photos: Photo[]; onRemove?: (index: number) => void; removeLabel?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo, index) => (
        <figure key={`${photo.name}-${index}`} className="overflow-hidden rounded-xl border border-line bg-white">
          {photo.url ? <img src={photo.url} alt={photo.name} className="h-32 w-full object-cover" /> : <div className="flex h-32 items-end p-3 text-xs">{photo.name}</div>}
          <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
            <span className="truncate">{photo.name}</span>
            {onRemove && removeLabel ? <button type="button" className="shrink-0 font-semibold text-teal-800" onClick={() => onRemove(index)}>{removeLabel}</button> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

