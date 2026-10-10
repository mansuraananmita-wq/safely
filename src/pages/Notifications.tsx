import { Link } from 'react-router-dom'
import { Button, Empty, useTitle } from '../components/ui'
import { timeAgo } from '../logic'
import { useApp } from '../store'

export function NotificationsPage() {
  const { currentUser, state, tx, lang, markRead, markAllRead } = useApp()
  useTitle(tx('Notifications', 'নোটিফিকেশন'))
  const items = state.notifications.filter((item) => item.userId === currentUser?.id)
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl">{tx('Notifications', 'নোটিফিকেশন')}</h1>
        {items.some((item) => !item.read) ? <Button variant="secondary" onClick={markAllRead}>{tx('Mark all read', 'সব পড়া হয়েছে')}</Button> : null}
      </div>
      <p className="mb-4 text-sm text-ink/60">{tx('In-app alerts are live in this preview. Email and phone push start when the server is connected.', 'এই প্রিভিউতে অ্যাপের ভেতরের নোটিশ চালু। ইমেইল ও ফোন পুশ সার্ভার যুক্ত হলে শুরু হবে।')}</p>
      {items.length === 0 ? <Empty title={tx('Nothing waiting', 'কিছু অপেক্ষা করছে না')} body={tx('Status changes, assignments, and campus alerts will land here.', 'স্ট্যাটাস, বরাদ্দ, এবং ক্যাম্পাস সতর্কতা এখানে আসবে।')} /> : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.href} onClick={() => markRead(item.id)} className={`panel block p-4 ${item.read ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <span className="text-xs text-ink/50">{timeAgo(item.createdAt, lang)}</span>
                </div>
                <p className="mt-1 text-sm text-ink/70">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
