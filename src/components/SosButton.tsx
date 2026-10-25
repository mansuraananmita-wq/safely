import { useEffect, useRef, useState } from 'react'
import { isPreciseFix, preferLiveFix, watchLiveLocation, type LiveFix } from '../lib/sos'
import { useApp } from '../store'
import { Button, Modal } from './ui'
import { GooglePlaceMap } from './GooglePlaceMap'

export function SosButton({ large = false }: { large?: boolean }) {
  const { currentUser, state, tx, sendSos, refineSosLocation } = useApp()
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(3)
  const [phase, setPhase] = useState<'locating' | 'count' | 'sending' | 'blocked' | 'done'>('locating')
  const [result, setResult] = useState<'sent' | 'desk' | 'sms-failed' | 'soon' | 'empty' | 'rejected' | null>(null)
  const [resultDetail, setResultDetail] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const startedRef = useRef(false)
  const [denied, setDenied] = useState(false)
  const fixRef = useRef<LiveFix | null>(null)
  const sentRef = useRef<{ id: string; accuracy: number } | null>(null)
  const sendRef = useRef(sendSos)
  const refineRef = useRef(refineSosLocation)
  const stopWatch = useRef<(() => void) | null>(null)
  sendRef.current = sendSos
  refineRef.current = refineSosLocation
  const [fix, setFix] = useState<LiveFix | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const mine = (state.emergencyContacts ?? []).filter((item) => item.userId === currentUser?.id)

  const acceptFix = (next: LiveFix) => {
    const chosen = preferLiveFix(fixRef.current, next)
    if (!chosen) return
    fixRef.current = chosen
    setFix(chosen)
  }

  useEffect(() => () => stopWatch.current?.(), [])

  useEffect(() => {
    if (!trackingId || !fix) return
    const sent = sentRef.current
    if (!sent || sent.id !== trackingId) return
    if (fix.accuracy + 20 >= sent.accuracy) return
    sentRef.current = { id: sent.id, accuracy: fix.accuracy }
    void refineRef.current(sent.id, { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy })
  }, [trackingId, fix])

  useEffect(() => {
    if (!trackingId) return
    const timer = window.setTimeout(() => {
      stopWatch.current?.()
      stopWatch.current = null
      setTrackingId(null)
    }, 90_000)
    return () => window.clearTimeout(timer)
  }, [trackingId])

  useEffect(() => {
    if (!open || phase !== 'locating') return
    const timer = window.setTimeout(() => {
      if (isPreciseFix(fixRef.current)) return
      setPhase('blocked')
    }, denied ? 8_000 : 25_000)
    return () => window.clearTimeout(timer)
  }, [open, phase, denied])

  useEffect(() => {
    if (!open || phase !== 'locating' || !isPreciseFix(fix)) return
    setLeft(3)
    setPhase('count')
  }, [open, phase, fix])

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
      sentRef.current = outcome.id ? { id: outcome.id, accuracy: place.accuracy } : null
      if (outcome.id) setTrackingId(outcome.id)
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
    setPhase('locating')
    stopWatch.current?.()
    stopWatch.current = watchLiveLocation(acceptFix, () => setDenied(true))
    setOpen(true)
  }

  const cancel = () => {
    cancelRef.current = true
    if (!sentRef.current) {
      stopWatch.current?.()
      stopWatch.current = null
    }
    setOpen(false)
    setPhase('count')
  }

  const sendWithoutLocation = () => {
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
      ? tx('Help texts were sent with your location. The campus desk has the same alert.', 'লোকেশনসহ সাহায্যের বার্তা পাঠানো হয়েছে। ক্যাম্পাস ডেস্কও একই সতর্কতা পেয়েছে।')
      : result === 'sms-failed'
        ? tx('The desk has the alert. One or more phone texts did not go through.', 'ডেস্ক সতর্কতা পেয়েছে। এক বা একাধিক ফোন বার্তা যায়নি।')
        : result === 'soon'
          ? tx('Wait a minute before sending another SOS.', 'আরেকটি SOS পাঠানোর আগে এক মিনিট অপেক্ষা করুন।')
          : result === 'rejected'
            ? tx('The alert was not saved. Try again in a moment.', 'সতর্কতা সেভ হয়নি। একটু পরে আবার চেষ্টা করুন।')
            : tx('The campus desk has the alert. Phone texts start after Twilio is connected. See BACKEND.md.', 'ক্যাম্পাস ডেস্ক সতর্কতা পেয়েছে। Twilio যুক্ত হলে ফোন বার্তা যাবে। BACKEND.md দেখুন।')

  const pin = isPreciseFix(fix) ? (
    <GooglePlaceMap
      lat={fix.lat}
      lng={fix.lng}
      zoom={18}
      compact
      eager
      label={tx('This pin will be sent', 'এই পিন যাবে')}
      note={tx(`Within ${Math.round(fix.accuracy)} m of you`, `আপনার ${Math.round(fix.accuracy)} মিটারের মধ্যে`)}
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
                'The desk receives the pin only when it is close enough to find you. Allow location if Chrome asks. A city or IP location is not sent.',
                'পিনটা আপনাকে খুঁজে পাওয়ার মতো কাছে এলেই ডেস্ক পায়। Chrome চাইলে লোকেশন অনুমতি দিন। শহর বা আইপি লোকেশন পাঠানো হয় না।',
              )}
            </p>
            <Button variant="secondary" className="w-full" onClick={cancel} autoFocus>{tx('Cancel', 'বাতিল')}</Button>
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
