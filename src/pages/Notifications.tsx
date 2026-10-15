import { Link } from 'react-router-dom'
import { Button, Empty, useTitle } from '../components/ui'
import { timeAgo } from '../logic'
import { useApp } from '../store'
import type { AppNotification, NoticeKind } from '../types'

const TITLES: Record<NoticeKind, [string, string]> = {
  received: ['Your report has been received.', 'আপনার রিপোর্ট গৃহীত হয়েছে।'],
  assigned: ['Your report has been assigned.', 'আপনার রিপোর্ট বরাদ্দ হয়েছে।'],
  info: ['More information is needed.', 'আরও তথ্য দরকার।'],
  resolved: ['Your report has been resolved.', 'আপনার রিপোর্টের সমাধান হয়েছে।'],
}

function reportId(href: string) {
  return href.split('/').filter(Boolean).pop() ?? ''
}

function noticeTitle(item: AppNotification) {
  return item.kind ? TITLES[item.kind] : null
}

export function NotificationsPage() {
  const { currentUser, state, tx, lang, remote, markRead, markAllRead } = useApp()
  useTitle(tx('Notifications', 'নোটিফিকেশন'))
  const items = state.notifications
    .filter((item) => item.userId === currentUser?.id)
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const unread = items.filter((item) => !item.read).length
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{tx('Notifications', 'নোটিফিকেশন')}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {unread > 0 ? tx(`${unread} unread`, `${unread}টি অপঠিত`) : tx('All caught up', 'সব পড়া হয়েছে')}
          </p>
        </div>
        {unread > 0 ? <Button variant="secondary" onClick={markAllRead}>{tx('Mark all as read', 'সব পড়া হয়েছে')}</Button> : null}
      </div>
      <p className="mb-4 text-sm text-ink/60">{remote ? tx('Alerts in the app come from the campus database. Email and phone push are not sent yet.', 'অ্যাপের নোটিশ ক্যাম্পাস ডেটাবেস থেকে আসে। ইমেইল ও ফোন পুশ এখনও যায় না।') : tx('In-app alerts are live in this preview. Email and phone push start when the server is connected.', 'এই প্রিভিউতে অ্যাপের ভেতরের নোটিশ চালু। ইমেইল ও ফোন পুশ সার্ভার যুক্ত হলে শুরু হবে।')}</p>
      {items.length === 0 ? <Empty title={tx('Nothing waiting', 'কিছু অপেক্ষা করছে না')} body={tx('Status changes, assignments, and campus alerts will land here.', 'স্ট্যাটাস, বরাদ্দ, এবং ক্যাম্পাস সতর্কতা এখানে আসবে।')} /> : (
        <ul className="space-y-2">
          {items.map((item) => {
            const pair = noticeTitle(item)
            const id = reportId(item.href)
            const title = pair ? tx(pair[0], pair[1]) : item.title
            const body = item.kind === 'received'
              ? tx(`${id} is with the campus desk.`, `${id} ক্যাম্পাস ডেস্কের কাছে আছে।`)
              : item.kind === 'assigned'
                ? tx(item.body, `${id} একটি দপ্তরে পাঠানো হয়েছে।`)
                : item.kind === 'info'
                  ? tx(`${id} needs a reply.`, `${id}-এর জন্য একটি উত্তর দরকার।`)
                  : item.kind === 'resolved'
                    ? tx(`${id} is marked resolved. You can rate the work.`, `${id}-এর সমাধান হয়েছে। কাজটি মূল্যায়ন করতে পারেন।`)
                    : item.body
            return (
              <li key={item.id} className={`panel p-4 ${item.read ? '' : 'border-l-4 border-teal-700'}`}>
                <div className="flex items-start justify-between gap-3">
                  <Link to={item.href} onClick={() => markRead(item.id)} className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
                    <div className="flex items-center gap-2">
                      {!item.read ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-clay" title={tx('Unread', 'অপঠিত')} /> : null}
                      <p className="font-semibold">{title === 'SOS help request' ? tx('SOS help request', 'এসওএস সাহায্যের বার্তা') : title}</p>
                    </div>
                    {!item.read ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-clay">{tx('Unread', 'অপঠিত')}</p> : null}
                    <p className="mt-1 text-sm text-ink/70">{body}</p>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-xs text-ink/50">{timeAgo(item.createdAt, lang)}</span>
                    {!item.read ? (
                      <button type="button" onClick={() => markRead(item.id)} className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline">
                        {tx('Mark as read', 'পড়া হয়েছে')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
