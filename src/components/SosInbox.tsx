import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { GooglePlaceMap } from './GooglePlaceMap'
import { formatWhen, sosDeskStatus } from '../logic'
import { LIVE_MAX_M, sosLiveOpen } from '../lib/sos'
import { useApp } from '../store'
import { Button } from './ui'
import type { SosAlert } from '../types'

export function SosInbox({ limit, linked = false }: { limit?: number; linked?: boolean }) {
  const { currentUser, state, tx, markSosSeen, refreshSosAlerts } = useApp()
  const markRef = useRef(markSosSeen)
  const refreshRef = useRef(refreshSosAlerts)
  markRef.current = markSosSeen
  refreshRef.current = refreshSosAlerts
  const desk = currentUser?.role === 'admin' || currentUser?.role === 'security'
  const rows = (state.sosAlerts ?? [])
    .filter((item) => (desk ? true : item.userId === currentUser?.id))
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const open = rows.filter((item) => !item.resolvedAt)
  const solved = rows.filter((item) => item.resolvedAt)
  const shown = typeof limit === 'number' ? open.slice(0, limit) : open
  const unseenOpen = open.some((item) => !item.seenAt)

  useEffect(() => {
    if (!desk || !unseenOpen) return
    void markRef.current()
  }, [desk, unseenOpen])

  useEffect(() => {
    if (!open.length) return
    const tick = () => { void refreshRef.current() }
    tick()
    const timer = window.setInterval(tick, 4_000)
    return () => window.clearInterval(timer)
  }, [open.length])

  if (!currentUser) return null

  return (
    <section className={`rounded-2xl border p-5 ${open.length ? 'border-clay bg-clay/5' : 'border-line bg-white'}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{desk ? tx('SOS help messages', 'এসওএস সাহায্যের বার্তা') : tx('Your SOS alerts', 'আপনার এসওএস')}</h2>
          <p className="mt-1 text-sm text-ink/70">
            {desk
              ? tx('Open alerts are counted on the SOS button. Mark one as solved and that count drops by one.', 'খোলা সতর্কতা SOS বোতামে গোনা হয়। একটি সমাধান চিহ্ন দিলে সংখ্যা এক কমে।')
              : tx('Each alert shows whether the desk has it, has seen it, or has marked it solved.', 'প্রতিটি সতর্কতায় দেখা যায় ডেস্ক পেয়েছে, দেখেছে, নাকি সমাধান করেছে।')}
          </p>
        </div>
        {linked && open.length > shown.length ? (
          <Link to="/admin/sos" className="text-sm font-semibold text-dusk">{tx('See all', 'সব দেখুন')}</Link>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">{tx('No open SOS messages.', 'কোনো খোলা এসওএস বার্তা নেই।')}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {shown.map((item) => <SosCard key={item.id} item={item} desk={!!desk} />)}
        </ul>
      )}
      {solved.length > 0 && typeof limit !== 'number' ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-dusk">{tx(`Solved (${solved.length})`, `সমাধান হয়েছে (${solved.length})`)}</summary>
          <ul className="mt-3 space-y-4">
            {solved.map((item) => <SosCard key={item.id} item={item} desk={false} />)}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

function statusLabel(item: SosAlert, tx: (en: string, bn: string) => string) {
  const status = sosDeskStatus(item)
  if (status === 'solved') return tx('Solved', 'সমাধান হয়েছে')
  if (status === 'seen') return tx('Seen by desk', 'ডেস্ক দেখেছে')
  return tx('Sent', 'পাঠানো হয়েছে')
}

function SosCard({ item, desk }: { item: SosAlert; desk: boolean }) {
  const { tx, lang, resolveSos } = useApp()
  const hasPlace = typeof item.lat === 'number' && typeof item.lng === 'number'
  const rough = typeof item.accuracyM === 'number' && item.accuracyM > LIVE_MAX_M
  const status = sosDeskStatus(item)
  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{item.senderName}</p>
        <time className="text-xs text-ink/50" dateTime={item.createdAt}>{formatWhen(item.createdAt, lang)}</time>
      </div>
      <p className={`mt-2 text-sm font-semibold ${status === 'solved' ? 'text-moss' : status === 'seen' ? 'text-dusk' : 'text-steel'}`}>
        {statusLabel(item, tx)}
      </p>
      <p className="mt-2 text-sm text-ink/80">{item.message}</p>
      {hasPlace ? (
        <p className="mt-1 text-xs text-ink/55">
          {item.lat!.toFixed(6)}, {item.lng!.toFixed(6)}
          {typeof item.accuracyM === 'number' ? ` · ${Math.round(item.accuracyM)} m` : ''}
          {rough ? ` · ${tx('approximate', 'আনুমানিক')}` : ''}
          {!rough && sosLiveOpen(item.createdAt) && !item.resolvedAt ? ` · ${tx('live', 'লাইভ')}` : ''}
        </p>
      ) : null}
      {hasPlace ? (
        <div className="mt-3">
          <GooglePlaceMap lat={item.lat!} lng={item.lng!} label={item.senderName} note={rough ? tx('This older pin is too wide to find someone. A new SOS only sends a close device location.', 'এই পুরোনো পিন কাউকে খুঁজে পাওয়ার মতো কাছের নয়। নতুন SOS শুধু কাছের ডিভাইস লোকেশন পাঠায়।') : sosLiveOpen(item.createdAt) && !item.resolvedAt ? tx('Live pin — it follows them for three minutes.', 'লাইভ পিন — তিন মিনিট তাদের অনুসরণ করে।') : tx('Location sent with the help message', 'সাহায্যের বার্তার সাথে পাঠানো লোকেশন')} eager />
        </div>
      ) : (
        <p className="mt-3 text-sm text-clay">{tx('Location was not available.', 'লোকেশন পাওয়া যায়নি।')}</p>
      )}
      {desk && !item.resolvedAt ? (
        <Button className="mt-3" variant="secondary" onClick={() => void resolveSos(item.id)}>{tx('Mark as solved', 'সমাধান হয়েছে')}</Button>
      ) : null}
    </li>
  )
}
