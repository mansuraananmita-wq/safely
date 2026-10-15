import { Link } from 'react-router-dom'
import { useTitle } from '../../components/ui'
import { SosInbox } from '../../components/SosInbox'
import { deskReports, formatWhen, isOpen, isOverdue, isUnassigned, resolvedThisMonth, statusLabel } from '../../logic'
import { useApp } from '../../store'
import type { Status } from '../../types'

const STATUS_ORDER: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened']

const STATUS_COLOR: Record<Status, string> = {
  draft: 'bg-ink/30',
  submitted: 'bg-sky-700',
  under_review: 'bg-amber-600',
  assigned: 'bg-teal-700',
  in_progress: 'bg-teal-900',
  resolved: 'bg-moss',
  closed: 'bg-ink',
  rejected: 'bg-clay',
  reopened: 'bg-plum',
}

const CATEGORY_COLOR = ['bg-teal-900', 'bg-teal-700', 'bg-marigold', 'bg-plum', 'bg-moss', 'bg-clay', 'bg-sky-700', 'bg-amber-600', 'bg-teal-800', 'bg-ink']

function Metric({ to, label, value, hint, alert = false }: { to: string; label: string; value: number; hint: string; alert?: boolean }) {
  return (
    <Link to={to} className={`panel block p-4 hover:border-teal-700 ${alert ? 'border-clay' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">{label}</p>
      <p className={`mt-2 font-display text-4xl tabular-nums leading-none ${alert ? 'text-clay' : ''}`}>{value}</p>
      <p className="mt-2 text-sm text-ink/60">{hint}</p>
    </Link>
  )
}

function SplitChart({ rows, empty }: { rows: { label: string; value: number; color: string }[]; empty: string }) {
  const shown = rows.filter((row) => row.value > 0)
  const total = shown.reduce((sum, row) => sum + row.value, 0)
  if (!shown.length) return <p className="text-sm text-ink/60">{empty}</p>
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-teal-50" role="img" aria-label={shown.map((row) => `${row.label} ${row.value}`).join(', ')}>
        {shown.map((row) => (
          <div key={row.label} className={row.color} style={{ width: `${(row.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {shown.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.color}`} />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="tabular-nums text-ink/60">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OverviewPage() {
  const { currentUser, state, tx, lang } = useApp()
  useTitle(tx('Overview', 'সারাংশ'))
  if (!currentUser) return null
  const reports = deskReports(currentUser, state.reports)
  const open = reports.filter((report) => isOpen(report.status))
  const overdue = reports.filter((report) => isOverdue(report))
  const unassigned = reports.filter(isUnassigned)
  const resolvedMonth = reports.filter((report) => resolvedThisMonth(report))
  const monthName = new Date().toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { month: 'long', year: 'numeric' })
  const categories = state.categories.map((category, index) => ({
    label: lang === 'bn' ? category.bn : category.en,
    value: reports.filter((report) => report.category === category.id).length,
    color: CATEGORY_COLOR[index % CATEGORY_COLOR.length],
  }))
  const statuses = STATUS_ORDER.map((status) => ({
    label: statusLabel(status, lang),
    value: reports.filter((report) => report.status === status).length,
    color: STATUS_COLOR[status],
  }))
  const activity = reports
    .flatMap((report) => report.activities.map((item) => ({ ...item, reportId: report.id, title: report.confidential ? '' : report.title })))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 8)
  const scope = currentUser.role === 'admin'
    ? tx('Every report except private drafts.', 'ব্যক্তিগত খসড়া বাদে সব রিপোর্ট।')
    : currentUser.role === 'security'
      ? tx('Safety and confidential reports.', 'নিরাপত্তা ও গোপন রিপোর্ট।')
      : tx('Your office only.', 'শুধু আপনার দপ্তর।')
  const emptyChart = tx('No reports in this view yet.', 'এই দৃশ্যে এখনও রিপোর্ট নেই।')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{tx('Desk overview', 'ডেস্ক সারাংশ')}</h1>
        <p className="mt-1 text-sm text-ink/60">{scope}</p>
      </div>
      <SosInbox limit={3} linked />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric to="/admin/reports?focus=open" label={tx('Total open reports', 'মোট খোলা রিপোর্ট')} value={open.length} hint={tx('Still with the desk', 'এখনও ডেস্কের কাছে')} />
        <Metric to="/admin/reports?focus=overdue" label={tx('Overdue reports', 'সময়োত্তীর্ণ রিপোর্ট')} value={overdue.length} hint={tx('Past the target time', 'লক্ষ্য সময় পেরিয়েছে')} alert={overdue.length > 0} />
        <Metric to="/admin/reports?focus=unassigned" label={tx('Unassigned reports', 'বরাদ্দহীন রিপোর্ট')} value={unassigned.length} hint={tx('Open, and no office yet', 'খোলা, এখনও কোনো দপ্তর নেই')} />
        <Metric to="/admin/reports?focus=resolved-month" label={tx('Resolved this month', 'এই মাসে সমাধান')} value={resolvedMonth.length} hint={monthName} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('Category', 'বিভাগ')}</h2>
          <p className="mt-1 text-sm text-ink/60">{tx('How reports on this desk are spread.', 'এই ডেস্কের রিপোর্ট কীভাবে ভাগ হয়েছে।')}</p>
          <div className="mt-4"><SplitChart rows={categories} empty={emptyChart} /></div>
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('Status', 'স্ট্যাটাস')}</h2>
          <p className="mt-1 text-sm text-ink/60">{tx('Where those reports sit right now.', 'এই রিপোর্টগুলো এখন কোন ধাপে আছে।')}</p>
          <div className="mt-4"><SplitChart rows={statuses} empty={emptyChart} /></div>
        </section>
      </div>
      <section className="panel p-5">
        <h2 className="font-display text-2xl">{tx('Recent activity', 'সাম্প্রতিক কার্যকলাপ')}</h2>
        {activity.length === 0 ? <p className="mt-3 text-sm text-ink/60">{tx('Nothing has been recorded yet.', 'এখনও কিছু লেখা হয়নি।')}</p> : (
          <ul className="mt-3 divide-y divide-line">
            {activity.map((item) => (
              <li key={`${item.reportId}-${item.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <div className="min-w-0">
                  <Link to={`/admin/reports/${item.reportId}`} className="font-semibold text-teal-800">{item.reportId}</Link>
                  {item.title ? <span className="text-ink/70"> · {item.title}</span> : <span className="ml-2 text-xs font-semibold text-plum">{tx('Restricted', 'সীমিত')}</span>}
                  <p className="mt-1 text-ink/80">{item.message}</p>
                  <p className="mt-1 text-xs text-ink/50">{item.actor}{item.visibility === 'internal' ? ` · ${tx('Internal', 'অভ্যন্তরীণ')}` : ''}</p>
                </div>
                <time className="shrink-0 text-xs text-ink/50" dateTime={item.at}>{formatWhen(item.at, lang)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
