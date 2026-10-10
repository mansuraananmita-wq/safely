import { Link } from 'react-router-dom'
import { Bars, Stat, useTitle } from '../../components/ui'
import { PLACES } from '../../data'
import { average, awaitingFirstResponse, deskReports, firstResponseHours, hoursBetween, isOpen, isOverdue, monthKey } from '../../logic'
import { useApp } from '../../store'

export function OverviewPage() {
  const { currentUser, state, tx, lang } = useApp()
  useTitle(tx('Overview', 'সারাংশ'))
  if (!currentUser) return null
  const reports = deskReports(currentUser, state.reports)
  const open = reports.filter((report) => isOpen(report.status))
  const overdue = reports.filter(isOverdue)
  const waiting = reports.filter(awaitingFirstResponse)
  const month = new Date()
  const resolvedMonth = reports.filter((report) => report.resolvedAt && new Date(report.resolvedAt).getMonth() === month.getMonth() && new Date(report.resolvedAt).getFullYear() === month.getFullYear())
  const response = reports.map((report) => firstResponseHours(report)).filter((value): value is number => value !== null)
  const resolution = reports.filter((report) => report.resolvedAt).map((report) => hoursBetween(report.createdAt, report.resolvedAt!))
  const rated = reports.filter((report) => typeof report.rating === 'number')
  const categories = state.categories.map((category) => ({
    label: lang === 'bn' ? category.bn : category.en,
    value: open.filter((report) => report.category === category.id).length,
  })).filter((row) => row.value > 0)
  const places = PLACES.map((place) => ({ label: lang === 'bn' ? place.bn : place.en, value: open.filter((report) => report.locationId === place.id).length }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth() - (5 - index), 1)
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { month: 'short' }) }
  })
  const monthRows = months.map((item) => ({ label: item.label, value: reports.filter((report) => monthKey(report.createdAt) === item.key).length }))
  const dueSoon = [...open].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)).slice(0, 5)
  const scope = currentUser.role === 'admin'
    ? tx('Every report except private drafts.', 'ব্যক্তিগত খসড়া বাদে সব রিপোর্ট।')
    : currentUser.role === 'security'
      ? tx('Safety and confidential reports.', 'নিরাপত্তা ও গোপন রিপোর্ট।')
      : tx('Your office only.', 'শুধু আপনার দপ্তর।')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{tx('Desk overview', 'ডেস্ক সারাংশ')}</h1>
        <p className="mt-1 text-sm text-ink/60">{scope}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={tx('Open', 'খোলা')} value={open.length} />
        <Stat label={tx('Overdue', 'সময়োত্তীর্ণ')} value={overdue.length} hint={tx('Past the category target', 'বিভাগের লক্ষ্য সময় পেরিয়েছে')} />
        <Stat label={tx('No first reply', 'প্রথম উত্তর নেই')} value={waiting.length} />
        <Stat label={tx('Resolved this month', 'এই মাসে সমাধান')} value={resolvedMonth.length} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={tx('Avg. first reply', 'গড় প্রথম উত্তর')} value={response.length ? `${average(response).toFixed(0)}h` : '—'} />
        <Stat label={tx('Avg. resolution', 'গড় সমাধান')} value={resolution.length ? `${(average(resolution) / 24).toFixed(1)}d` : '—'} />
        <Stat label={tx('Avg. rating', 'গড় রেটিং')} value={rated.length ? `${average(rated.map((report) => report.rating ?? 0)).toFixed(1)}/5` : '—'} hint={tx(`${rated.length} ratings`, `${rated.length}টি রেটিং`)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5"><h2 className="font-display text-2xl">{tx('Open by category', 'বিভাগ অনুযায়ী খোলা')}</h2><div className="mt-4"><Bars rows={categories} /></div></section>
        <section className="panel p-5"><h2 className="font-display text-2xl">{tx('Reports filed', 'জমা হওয়া রিপোর্ট')}</h2><div className="mt-4"><Bars rows={monthRows} /></div></section>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('Needs a clock check', 'সময় দেখা দরকার')}</h2>
          <ul className="mt-3 divide-y divide-line">
            {dueSoon.map((report) => (
              <li key={report.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link to={`/admin/reports/${report.id}`} className="font-semibold text-teal-800">{report.id}</Link>
                <span className={isOverdue(report) ? 'text-clay' : 'text-ink/60'}>{report.title}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-5"><h2 className="font-display text-2xl">{tx('Places', 'স্থান')}</h2><div className="mt-4"><Bars rows={places} /></div></section>
      </div>
    </div>
  )
}
