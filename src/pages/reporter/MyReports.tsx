import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { ReportCard } from '../../components/ReportCard'
import { Button, Empty, useTitle } from '../../components/ui'
import { useApp } from '../../store'
import type { Status } from '../../types'

const filters: Array<Status | 'all' | 'open'> = ['all', 'open', 'draft', 'submitted', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened']

export function MyReportsPage() {
  const { currentUser, state, tx, deleteDraft } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]>('all')
  useTitle(tx('My reports', 'আমার রিপোর্ট'))
  const mine = useMemo(
    () => state.reports.filter((report) => currentUser && (report.reporterId === currentUser.id || state.reportIdentities[report.id] === currentUser.id)),
    [state.reports, state.reportIdentities, currentUser],
  )
  const shown = mine.filter((report) => {
    const text = `${report.id} ${report.title} ${report.description}`.toLowerCase()
    if (query && !text.includes(query.toLowerCase())) return false
    if (filter === 'all') return true
    if (filter === 'open') return !['draft', 'resolved', 'closed', 'rejected'].includes(report.status)
    return report.status === filter
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl">{tx('My reports', 'আমার রিপোর্ট')}</h1>
        <Link to="/app/report/new" className="text-sm font-semibold text-teal-800">{tx('New report', 'নতুন রিপোর্ট')}</Link>
      </div>
      <input className="input mt-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Search by title or ID', 'শিরোনাম বা আইডি দিয়ে খুঁজুন')} />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === item ? 'border-teal-800 bg-teal-800 text-white' : 'border-line bg-white text-ink/70'}`}>
            {item === 'all' ? tx('All', 'সব') : item === 'open' ? tx('Open', 'খোলা') : item.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {shown.length === 0 ? <Empty title={tx('No reports here', 'এখানে রিপোর্ট নেই')} body={tx('Try another filter, or file the first one.', 'অন্য ফিল্টার দেখুন, অথবা প্রথম রিপোর্ট দিন।')} /> : shown.map((report) => (
          <div key={report.id} className="space-y-2">
            {state.identityRevealedAt[report.id] ? (
              <div className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-ink/80">
                {tx(
                  `Your anonymous identity on ${report.id} was revealed after a two-person campus approval.`,
                  `${report.id}-এ আপনার বেনামি পরিচয় দুইজনের অনুমোদনের পর খোলা হয়েছে।`,
                )}
              </div>
            ) : null}
            <ReportCard report={report} base="/app/reports" />
            {report.status === 'draft' ? (
              <div className="flex gap-2">
                <Link to={`/app/report/new?draft=${report.id}`} className="text-sm font-semibold text-teal-800">{tx('Continue draft', 'খসড়া চালিয়ে যান')}</Link>
                <Button variant="ghost" onClick={() => deleteDraft(report.id)}>{tx('Delete', 'মুছুন')}</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
