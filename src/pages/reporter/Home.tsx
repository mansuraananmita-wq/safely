import { Link } from 'react-router-dom'
import { LiveLocationMap } from '../../components/LiveLocationMap'
import { ReportCard } from '../../components/ReportCard'
import { buttonClass, useTitle } from '../../components/ui'
import { isMapPin, isOpen, isOverdue } from '../../logic'
import { useApp } from '../../store'

export function HomePage() {
  const { currentUser, state, tx } = useApp()
  useTitle(tx('Home', 'হোম'))
  const mine = state.reports.filter((report) => report.reporterId === currentUser?.id)
  const open = mine.filter((report) => isOpen(report.status))
  const drafts = mine.filter((report) => report.status === 'draft')
  const waiting = mine.filter((report) => report.infoRequested || ((report.status === 'resolved' || report.status === 'closed') && !report.rating))
  const alerts = state.announcements.filter((item) => item.active)
  const nearby = state.reports.filter(isMapPin).slice(0, 3)
  const hour = new Date().getHours()
  const hello = hour < 12 ? tx('Good morning', 'সুপ্রভাত') : hour < 17 ? tx('Good afternoon', 'শুভ অপরাহ্ন') : tx('Good evening', 'শুভ সন্ধ্যা')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink/60">{hello}</p>
          <h1 className="font-display text-4xl">{currentUser?.name}</h1>
          <p className="mt-1 text-sm text-ink/70">{currentUser?.unit}</p>
        </div>
        <Link to="/app/report/new" className={buttonClass('primary')}>{tx('Report a problem', 'সমস্যা জানান')}</Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          [tx('Open', 'খোলা'), open.length, '/app/reports'],
          [tx('Needs you', 'আপনার দরকার'), waiting.length, '/app/reports'],
          [tx('Drafts', 'খসড়া'), drafts.length, '/app/reports'],
        ].map(([label, value, to]) => (
          <Link key={String(label)} to={String(to)} className="panel p-3 hover:border-teal-700">
            <p className="text-xs uppercase tracking-wide text-ink/45">{label}</p>
            <p className="font-display text-3xl">{value}</p>
          </Link>
        ))}
      </div>
      {alerts[0] ? (
        <Link to="/app/alerts" className="block rounded-2xl border border-marigold/30 bg-marigold/15 px-4 py-3 text-sm">
          <span className="font-semibold">{alerts[0].title}. </span>
          <span className="line-clamp-2 text-ink/75">{alerts[0].body}</span>
        </Link>
      ) : null}
      <section>
        <h2 className="mb-3 font-display text-2xl">{tx('Your active reports', 'আপনার চলমান রিপোর্ট')}</h2>
        <div className="space-y-3">
          {open.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-sm text-ink/60">{tx('Nothing open. A draft can wait until you are ready.', 'কিছু খোলা নেই। খসড়া প্রস্তুত না হওয়া পর্যন্ত থাকতে পারে।')}</p> : open.map((report) => <ReportCard key={report.id} report={report} base="/app/reports" />)}
          {open.some(isOverdue) ? <p className="text-sm text-clay">{tx('A report outlined in red is past its target time. The desk can still see it.', 'লাল বর্ডারের রিপোর্ট লক্ষ্য সময় পেরিয়েছে। ডেস্ক সেটি দেখতে পায়।')}</p> : null}
        </div>
      </section>
      {drafts.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-2xl">{tx('Drafts', 'খসড়া')}</h2>
          <div className="space-y-3">{drafts.map((report) => <ReportCard key={report.id} report={report} base="/app/reports" />)}</div>
        </section>
      ) : null}
      <section>
        <h2 className="mb-3 font-display text-2xl">{tx('Your location', 'আপনার লোকেশন')}</h2>
        <LiveLocationMap />
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl">{tx('Open around campus', 'ক্যাম্পাসে যা খোলা')}</h2>
          <Link to="/app/map" className="text-sm font-semibold text-teal-800">{tx('Map', 'ম্যাপ')}</Link>
        </div>
        <div className="space-y-3">{nearby.map((report) => <ReportCard key={report.id} report={report} base="/app/reports" />)}</div>
      </section>
    </div>
  )
}
