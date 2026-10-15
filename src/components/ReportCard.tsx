import { Lock, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLACES } from '../data'
import { dueLabel, isOverdue } from '../logic'
import { useApp } from '../store'
import type { Report } from '../types'
import { StatusPill, cx } from './ui'

export function ReportCard({ report, base }: { report: Report; base: string }) {
  const { state, lang, tx } = useApp()
  const category = state.categories.find((item) => item.id === report.category)
  const place = PLACES.find((item) => item.id === report.locationId)
  const overdue = isOverdue(report)
  const due = dueLabel(report, lang)
  return (
    <Link to={`${base}/${report.id}`} className={cx('panel block p-4 transition hover:border-teal-700', overdue && 'border-clay bg-clay/5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-teal-800">{report.id}</p>
          <p className="mt-1 font-display text-xl leading-snug">{report.title}</p>
        </div>
        <StatusPill status={report.status} />
      </div>
      <p className="mt-3 text-sm text-ink/65">
        {lang === 'bn' ? category?.bn : category?.en}
        {place ? ` · ${lang === 'bn' ? place.bn : place.en}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {report.confidential ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-plum/10 px-2 py-1 text-xs font-semibold text-plum">
            <Lock className="h-3 w-3" />
            {tx('Restricted', 'সীমিত')}
          </span>
        ) : null}
        {overdue ? <span className="text-xs font-semibold text-clay">{due}</span> : due ? <span className="text-xs text-ink/50">{due}</span> : null}
        {report.confirmations.length > 0 && !report.confidential ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/70">
            <ThumbsUp className="h-3.5 w-3.5" />
            {tx(`${report.confirmations.length} others see this too`, `আর ${report.confirmations.length} জন একই জায়গায় দেখেছেন`)}
          </span>
        ) : null}
      </div>
    </Link>
  )
}
