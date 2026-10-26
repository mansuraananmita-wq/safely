import { useTitle } from '../../components/ui'
import { useApp } from '../../store'

function when(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(+date)) return value
  return date.toLocaleString()
}

export function SafeWalkPage() {
  const { currentUser, state, tx } = useApp()
  useTitle(tx('Safe Walk', 'সেইফ ওয়াক'))
  if (!currentUser) return null
  const desk = currentUser.role === 'admin' || currentUser.role === 'security'
  if (!desk) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-display text-4xl">{tx('Safe Walk', 'সেইফ ওয়াক')}</h1>
        <p className="text-sm text-ink/70">{tx('Only the campus desk can open this list.', 'শুধু ক্যাম্পাস ডেস্ক এই তালিকা খুলতে পারে।')}</p>
      </div>
    )
  }

  const expired = (state.safeWalks ?? [])
    .filter((item) => item.status === 'expired')
    .sort((a, b) => +new Date(b.endsAt) - +new Date(a.endsAt))

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-4xl">{tx('Safe Walk desk', 'সেইফ ওয়াক ডেস্ক')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          {tx(
            'Walks that ended without “I arrived”. The desk only sees expired walks. Shared pins are cleared 24 hours after the walk closes.',
            'যে হাঁটা “আমি পৌঁছেছি” ছাড়া শেষ হয়েছে। ডেস্ক শুধু মেয়াদোত্তীর্ণ হাঁটা দেখে। শেয়ার করা পিন হাঁটা বন্ধের ২৪ ঘণ্টা পর মুছে যায়।',
          )}
        </p>
      </div>
      <div className="rounded-2xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm font-semibold text-ink">
        {tx('Safe Walk does not replace 999. If someone is in danger, call 999.', 'সেইফ ওয়াক ৯৯৯-এর বিকল্প নয়। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন।')}
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {expired.length === 0 ? (
          <li className="px-5 py-8 text-sm text-ink/60">{tx('No expired Safe Walks right now.', 'এখন কোনো মেয়াদোত্তীর্ণ সেইফ ওয়াক নেই।')}</li>
        ) : (
          expired.map((item) => (
            <li key={item.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{item.senderName}</p>
                <p className="text-xs uppercase tracking-wide text-clay">{tx('Timer ended', 'টাইমার শেষ')}</p>
              </div>
              <p className="text-sm">
                <span className="font-semibold">{tx('Destination', 'গন্তব্য')}: </span>
                {item.destination}
              </p>
              <p className="text-sm text-ink/70">
                {tx('Started', 'শুরু')}: {when(item.startedAt)} · {tx('Due', 'শেষ সময়')}: {when(item.endsAt)}
              </p>
              {(item.contactName || item.contactPhone) ? (
                <p className="text-sm text-ink/70">
                  {tx('Trusted contact', 'বিশ্বস্ত যোগাযোগ')}: {item.contactName || '—'}
                  {item.contactPhone ? ` · ${item.contactPhone}` : ''}
                </p>
              ) : null}
              {item.shareLocation && item.lastLat != null && item.lastLng != null ? (
                <p className="text-sm">
                  <a
                    className="font-semibold text-teal-800"
                    href={`https://maps.google.com/?q=${item.lastLat},${item.lastLng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tx('Open last shared pin', 'শেষ শেয়ার করা পিন খুলুন')}
                  </a>
                  {item.lastAccuracyM != null ? (
                    <span className="text-ink/60"> · ±{Math.round(item.lastAccuracyM)} m</span>
                  ) : null}
                </p>
              ) : (
                <p className="text-sm text-ink/60">
                  {item.shareLocation
                    ? tx('Location was shared, but no pin is stored now.', 'লোকেশন শেয়ার ছিল, কিন্তু এখন কোনো পিন নেই।')
                    : tx('Location was not shared for this walk.', 'এই হাঁটায় লোকেশন শেয়ার করা হয়নি।')}
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
