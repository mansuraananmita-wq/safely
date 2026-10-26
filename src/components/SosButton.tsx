import { useEffect, useRef, useState } from 'react'
import { isGpsFix, isPreciseFix, nearbyPlaceName, preferLiveFix, watchLiveLocation, type LiveFix } from '../lib/sos'
import { useApp } from '../store'
import { Button, Modal } from './ui'
import { GooglePlaceMap } from './GooglePlaceMap'

export function SosButton({ large = false }: { large?: boolean }) {
  const { currentUser, state, tx, sendSos, startSosLiveShare } = useApp()
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(3)
  const [phase, setPhase] = useState<'locating' | 'confirm' | 'count' | 'sending' | 'blocked' | 'done'>('locating')
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [result, setResult] = useState<'sent' | 'desk' | 'sms-failed' | 'soon' | 'empty' | 'rejected' | null>(null)
  const [resultDetail, setResultDetail] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const startedRef = useRef(false)
  const [denied, setDenied] = useState(false)
  const fixRef = useRef<LiveFix | null>(null)
  const sendRef = useRef(sendSos)
  const shareRef = useRef(startSosLiveShare)
  const stopWatch = useRef<(() => void) | null>(null)
  sendRef.current = sendSos
  shareRef.current = startSosLiveShare
  const [fix, setFix] = useState<LiveFix | null>(null)
  const mine = (state.emergencyContacts ?? []).filter((item) => item.userId === currentUser?.id)

  const acceptFix = (next: LiveFix) => {
    const chosen = preferLiveFix(fixRef.current, next)
    if (!chosen) return
    fixRef.current = chosen
    setFix(chosen)
  }

  useEffect(() => () => stopWatch.current?.(), [])

  useEffect(() => {
    if (!open || phase !== 'locating') return
    const timer = window.setTimeout(() => {
      if (isPreciseFix(fixRef.current)) return
      setPhase('blocked')
    }, denied ? 8_000 : 25_000)
    return () => window.clearTimeout(timer)
  }, [open, phase, denied])

  useEffect(() => {
    if (!open || !isPreciseFix(fix)) return
    if (phase !== 'locating' && phase !== 'confirm') return
    if (isGpsFix(fix)) {
      setLeft(3)
      setPhase('count')
      return
    }
    if (phase === 'locating') setPhase('confirm')
  }, [open, phase, fix])

  useEffect(() => {
    if (!open || !isPreciseFix(fix)) {
      setPlaceName(null)
      return
    }
    let alive = true
    void nearbyPlaceName(fix.lat, fix.lng).then((name) => {
      if (alive) setPlaceName(name)
    })
    return () => { alive = false }
  }, [open, fix])

  useEffect(() => {
    if (!open || phase !== 'count' || left <= 0) return
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [open, phase, left])

  useEffect(() => {
    if (!open || phase !== 'count' || left > 0 || startedRef.current) return
    startedRef.current = true
    setPhase('sending')
  }, [open, phase, left])

  useEffect(() => {
    if (!open || phase !== 'sending') return
    if (cancelRef.current) return
    const place = fixRef.current
    if (!isPreciseFix(place)) {
      setPhase('blocked')
      return
    }
    const reading = { lat: place.lat, lng: place.lng, accuracy: place.accuracy }
    void sendRef.current(reading).then((outcome) => {
      if (cancelRef.current) return
      stopWatch.current?.()
      stopWatch.current = null
      if (outcome.id) shareRef.current(outcome.id, place)
      setResult(outcome.status)
      setResultDetail(outcome.detail ?? null)
      setPhase('done')
    })
  }, [open, phase])

  if (!currentUser) return null

  const start = () => {
    cancelRef.current = false
    startedRef.current = false
    setDenied(false)
    fixRef.current = null
    setFix(null)
    setResult(null)
    setResultDetail(null)
    setLeft(3)
    setPlaceName(null)
    setPhase('locating')
    stopWatch.current?.()
    stopWatch.current = watchLiveLocation(acceptFix, () => setDenied(true))
    setOpen(true)
  }

  const cancel = () => {
    cancelRef.current = true
    stopWatch.current?.()
    stopWatch.current = null
    setOpen(false)
    setPhase('count')
  }

  const sendWithoutLocation = () => {
    stopWatch.current?.()
    stopWatch.current = null
    void sendRef.current(null).then((outcome) => {
      if (cancelRef.current) return
      setResult(outcome.status)
      setResultDetail(outcome.detail ?? null)
      setPhase('done')
    })
  }

  const outcome = resultDetail
    ? resultDetail
    : result === 'sent'
      ? tx('Help texts were sent with your location. The campus desk has the same alert. The pin follows you for three minutes.', 'লোকেশনসহ সাহায্যের বার্তা পাঠানো হয়েছে। ক্যাম্পাস ডেস্কও একই সতর্কতা পেয়েছে। পিন তিন মিনিট আপনাকে অনুসরণ করে।')
      : result === 'sms-failed'
        ? tx('The desk has the alert. One or more phone texts did not go through.', 'ডেস্ক সতর্কতা পেয়েছে। এক বা একাধিক ফোন বার্তা যায়নি।')
        : result === 'soon'
          ? tx('Wait a minute before sending another SOS.', 'আরেকটি SOS পাঠানোর আগে এক মিনিট অপেক্ষা করুন।')
          : result === 'rejected'
            ? tx('The alert was not saved. Try again in a moment.', 'সতর্কতা সেভ হয়নি। একটু পরে আবার চেষ্টা করুন।')
            : tx('The campus desk has the alert. The pin follows you for three minutes. Phone texts start after Twilio is connected. See BACKEND.md.', 'ক্যাম্পাস ডেস্ক সতর্কতা পেয়েছে। পিন তিন মিনিট আপনাকে অনুসরণ করে। Twilio যুক্ত হলে ফোন বার্তা যাবে। BACKEND.md দেখুন।')

  const pin = isPreciseFix(fix) ? (
    <GooglePlaceMap
      lat={fix.lat}
      lng={fix.lng}
      zoom={18}
      compact
      eager
      label={tx('This pin will be sent', 'এই পিন যাবে')}
      note={placeName
        ? tx(`${placeName} · ${Math.round(fix.accuracy)} m (${isGpsFix(fix) ? 'GPS' : 'Wi-Fi'})`, `${placeName} · ${Math.round(fix.accuracy)} মি (${isGpsFix(fix) ? 'GPS' : 'Wi-Fi'})`)
        : tx(`${Math.round(fix.accuracy)} m · ${isGpsFix(fix) ? 'GPS' : 'Wi-Fi — check the map'}`, `${Math.round(fix.accuracy)} মি · ${isGpsFix(fix) ? 'GPS' : 'Wi-Fi — ম্যাপ দেখুন'}`)}
    />
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={large
          ? 'w-full rounded-2xl bg-clay px-4 py-4 font-display text-3xl text-white'
          : 'rounded-full bg-clay px-3 py-1.5 text-sm font-semibold text-white'}
      >
        SOS
      </button>
      <Modal open={open} title={tx('SOS', 'এসওএস')} onClose={() => { if (phase === 'sending') return; cancel() }}>
        {phase === 'locating' ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold">{tx('Reading your live location…', 'আপনার লাইভ লোকেশন পড়া হচ্ছে…')}</p>
            <p className="text-sm text-ink/75">
              {tx(
                'Waiting for GPS. Laptop Wi-Fi often pins a nearby campus hall, not you — that pin will not send until you check the map. Allow location if Chrome asks.',
                'GPS-এর জন্য অপেক্ষা। ল্যাপটপের Wi-Fi কাছের ক্যাম্পাস হলে বসে, আপনাতে নয় — ম্যাপ না দেখে সেই পিন যাবে না। Chrome চাইলে লোকেশন অনুমতি দিন।',
              )}
            </p>
            <Button variant="secondary" className="w-full" onClick={cancel} autoFocus>{tx('Cancel', 'বাতিল')}</Button>
          </div>
        ) : null}
        {phase === 'confirm' ? (
          <div className="space-y-4">
            {pin}
            <p className="text-sm font-semibold text-clay">
              {tx('This pin is from Wi-Fi, not GPS. On a laptop it often sits on a nearby campus hall — not where you are standing.', 'এই পিন Wi-Fi থেকে, GPS থেকে নয়। ল্যাপটপে এটা কাছের ক্যাম্পাস হলে বসে, আপনি যেখানে দাঁড়িয়ে আছেন সেখানে নয়।')}
            </p>
            <p className="text-sm text-ink/75">
              {tx('Look at the map. If it is wrong, wait or send without a map. Only send this pin if it really is you.', 'ম্যাপ দেখুন। ভুল হলে অপেক্ষা করুন, অথবা ম্যাপ ছাড়া পাঠান। পিনটা সত্যি আপনি হলেই পাঠান।')}
            </p>
            <Button className="w-full" onClick={() => { startedRef.current = true; setPhase('sending') }}>{tx('Send this pin anyway', 'তবু এই পিন পাঠান')}</Button>
            <Button variant="secondary" className="w-full" onClick={sendWithoutLocation}>{tx('Alert the desk without a map', 'ম্যাপ ছাড়া ডেস্ককে জানান')}</Button>
            <Button variant="secondary" className="w-full" onClick={cancel}>{tx('Cancel', 'বাতিল')}</Button>
          </div>
        ) : null}
        {phase === 'count' ? (
          <div className="space-y-4">
            <p className="font-display text-6xl text-clay">{left}</p>
            {pin}
            <p className="text-sm text-ink/75">
              {mine.length
                ? tx(
                    `Cancel to stop. After this, the campus desk gets a help message with your live location. ${mine.length} saved number${mine.length === 1 ? '' : 's'} get a text too. This does not call 999.`,
                    `বাতিল করলে থেমে যাবে। এরপর ক্যাম্পাস ডেস্ক লাইভ লোকেশনসহ সাহায্যের বার্তা পায়। সেভ করা ${mine.length}টি নম্বরেও বার্তা যায়। এতে ৯৯৯-এ কল হয় না।`,
                  )
                : tx(
                    'Cancel to stop. After this, the campus desk gets a help message with your live location. This does not call 999.',
                    'বাতিল করলে থেমে যাবে। এরপর ক্যাম্পাস ডেস্ক লাইভ লোকেশনসহ সাহায্যের বার্তা পায়। এতে ৯৯৯-এ কল হয় না।',
                  )}
            </p>
            <Button variant="secondary" className="w-full" onClick={cancel} autoFocus>{tx('Cancel', 'বাতিল')}</Button>
          </div>
        ) : null}
        {phase === 'sending' ? (
          <div className="space-y-4">
            {pin}
            <p className="text-sm">
              {isPreciseFix(fix)
                ? tx(`Sending ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}.`, `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)} পাঠানো হচ্ছে।`)
                : tx('Still reading your location.', 'লোকেশন এখনও পড়া হচ্ছে।')}
            </p>
          </div>
        ) : null}
        {phase === 'blocked' ? (
          <div className="space-y-4">
            <p className="text-sm">{tx('A close location did not arrive, so nothing was sent. Click the lock in the address bar, set Location to Allow, and turn on Windows location for Chrome. Then press SOS again.', 'কাছের লোকেশন আসেনি, তাই কিছু পাঠানো হয়নি। ঠিকানার তালা চিহ্নে Location Allow করুন, এবং Windows-এ Chrome-এর লোকেশন চালু করুন। তারপর আবার SOS চাপুন।')}</p>
            <Button className="w-full" onClick={sendWithoutLocation}>{tx('Alert the desk without a map', 'ম্যাপ ছাড়া ডেস্ককে জানান')}</Button>
            <Button variant="secondary" className="w-full" onClick={cancel}>{tx('Cancel', 'বাতিল')}</Button>
          </div>
        ) : null}
        {phase === 'done' ? (
          <div className="space-y-4">
            <p className="text-sm">{outcome}</p>
            {pin}
            <Button className="w-full" onClick={cancel}>{tx('Close', 'বন্ধ')}</Button>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
