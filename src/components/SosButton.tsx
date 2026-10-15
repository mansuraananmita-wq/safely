import { useEffect, useRef, useState } from 'react'
import { preferLiveFix, sendDecision, watchLiveLocation, type LiveFix } from '../lib/sos'
import { useApp } from '../store'
import { Button, Modal } from './ui'

export function SosButton({ large = false }: { large?: boolean }) {
  const { currentUser, state, tx, sendSos, refineSosLocation } = useApp()
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(3)
  const [phase, setPhase] = useState<'count' | 'sending' | 'blocked' | 'done'>('count')
  const [result, setResult] = useState<'sent' | 'desk' | 'sms-failed' | 'soon' | 'empty' | 'rejected' | null>(null)
  const cancelRef = useRef(false)
  const startedRef = useRef(false)
  const deniedRef = useRef(false)
  const fixRef = useRef<LiveFix | null>(null)
  const sentRef = useRef<{ id: string; accuracy: number } | null>(null)
  const sendRef = useRef(sendSos)
  const refineRef = useRef(refineSosLocation)
  sendRef.current = sendSos
  refineRef.current = refineSosLocation
  const [fix, setFix] = useState<LiveFix | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const mine = (state.emergencyContacts ?? []).filter((item) => item.userId === currentUser?.id)

  useEffect(() => {
    if (!open) return
    deniedRef.current = false
    return watchLiveLocation((next) => {
      const chosen = preferLiveFix(fixRef.current, next)
      fixRef.current = chosen
      setFix(chosen)
    }, () => {
      deniedRef.current = true
    })
  }, [open])

  useEffect(() => {
    if (!trackingId) return
    const started = Date.now()
    const stop = watchLiveLocation((next) => {
      const sent = sentRef.current
      if (!sent || sent.id !== trackingId || Date.now() - started > 90_000) return
      if (next.accuracy + 20 >= sent.accuracy) return
      sentRef.current = { id: sent.id, accuracy: next.accuracy }
      void refineRef.current(sent.id, next)
    })
    const timer = window.setTimeout(() => setTrackingId(null), 90_000)
    return () => {
      stop()
      window.clearTimeout(timer)
    }
  }, [trackingId])

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
    let stopped = false
    const started = Date.now()
    const finish = (outcome: 'sent' | 'desk' | 'sms-failed' | 'soon' | 'empty' | 'rejected', id: string | null, accuracy: number) => {
      if (cancelRef.current) return
      if (id) {
        sentRef.current = { id, accuracy }
        setTrackingId(id)
      }
      setResult(outcome)
      setPhase('done')
    }
    const attempt = () => {
      if (stopped || cancelRef.current) return
      const decision = sendDecision(fixRef.current, Date.now() - started, deniedRef.current)
      if (decision === 'wait') return
      stopped = true
      if (decision === 'blocked') {
        setPhase('blocked')
        return
      }
      const place = fixRef.current
      const reading = place ? { lat: place.lat, lng: place.lng, accuracy: place.accuracy } : null
      void sendRef.current(reading).then((outcome) => finish(outcome.status, outcome.id, place?.accuracy ?? 99_999))
    }
    attempt()
    const timer = window.setInterval(attempt, 300)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [open, phase])

  if (!currentUser) return null

  const start = () => {
    cancelRef.current = false
    startedRef.current = false
    deniedRef.current = false
    fixRef.current = null
    setFix(null)
    setResult(null)
    setLeft(3)
    setPhase('count')
    setOpen(true)
  }

  const cancel = () => {
    cancelRef.current = true
    setOpen(false)
    setPhase('count')
  }

  const sendWithoutLocation = () => {
    void sendRef.current(null).then((outcome) => {
      if (cancelRef.current) return
      setResult(outcome.status)
      setPhase('done')
    })
  }

  const outcome = result === 'sent'
    ? tx('Help texts were sent with your location. The campus desk has the same alert.', 'লোকেশনসহ সাহায্যের বার্তা পাঠানো হয়েছে। ক্যাম্পাস ডেস্কও একই সতর্কতা পেয়েছে।')
    : result === 'sms-failed'
      ? tx('The desk has the alert. One or more phone texts did not go through.', 'ডেস্ক সতর্কতা পেয়েছে। এক বা একাধিক ফোন বার্তা যায়নি।')
      : result === 'soon'
        ? tx('Wait a minute before sending another SOS.', 'আরেকটি SOS পাঠানোর আগে এক মিনিট অপেক্ষা করুন।')
        : result === 'rejected'
          ? tx('The alert was not saved. Try again in a moment.', 'সতর্কতা সেভ হয়নি। একটু পরে আবার চেষ্টা করুন।')
          : tx('The campus desk has the alert. Phone texts start after Twilio is connected. See BACKEND.md.', 'ক্যাম্পাস ডেস্ক সতর্কতা পেয়েছে। Twilio যুক্ত হলে ফোন বার্তা যাবে। BACKEND.md দেখুন।')

  const liveLine = fix
    ? tx(
        `Live location ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)} · ${Math.round(fix.accuracy)} m`,
        `লাইভ লোকেশন ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)} · ${Math.round(fix.accuracy)} মি`,
      )
    : tx('Finding your live location… Allow location if the browser asks.', 'আপনার লাইভ লোকেশন খোঁজা হচ্ছে… ব্রাউজার চাইলে লোকেশন অনুমতি দিন।')

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
        {phase === 'count' ? (
          <div className="space-y-4">
            <p className="font-display text-6xl text-clay">{left}</p>
            <p className="text-sm font-semibold">{liveLine}</p>
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
          <p className="text-sm">
            {fix && fix.accuracy <= 100
              ? tx(
                  `Sending the live location ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}.`,
                  `লাইভ লোকেশন ${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)} পাঠানো হচ্ছে।`,
                )
              : tx(
                  'Waiting for a close GPS fix. A rough network location is not sent as your live position.',
                  'কাছের জিপিএস ফিক্সের অপেক্ষা। মোটা নেটওয়ার্ক লোকেশনকে লাইভ লোকেশন হিসেবে পাঠানো হচ্ছে না।',
                )}
          </p>
        ) : null}
        {phase === 'blocked' ? (
          <div className="space-y-4">
            <p className="text-sm">{tx('The browser did not share a live location. Allow location for this site, then press SOS again. You can still alert the desk without a map.', 'ব্রাউজার লাইভ লোকেশন দেয়নি। এই সাইটে লোকেশন অনুমতি দিন, তারপর আবার SOS চাপুন। ম্যাপ ছাড়াও ডেস্ককে জানানো যায়।')}</p>
            <Button className="w-full" onClick={sendWithoutLocation}>{tx('Alert the desk without a map', 'ম্যাপ ছাড়া ডেস্ককে জানান')}</Button>
            <Button variant="secondary" className="w-full" onClick={cancel}>{tx('Cancel', 'বাতিল')}</Button>
          </div>
        ) : null}
        {phase === 'done' ? (
          <div className="space-y-4">
            <p className="text-sm">{outcome}</p>
            {fix ? <p className="text-sm font-semibold">{liveLine}</p> : null}
            <Button className="w-full" onClick={cancel}>{tx('Close', 'বন্ধ')}</Button>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
