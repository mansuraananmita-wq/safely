import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { AssignOffice } from '../../components/AssignOffice'
import { Button, Empty, StatusPill, useTitle } from '../../components/ui'
import { PLACES } from '../../data'
import { deskReports, formatWhen, isOpen, isOverdue, isUnassigned, priorityLabel, resolvedThisMonth, statusLabel, toCsv } from '../../logic'
import { useApp } from '../../store'
import type { Priority, Report, Status } from '../../types'

type Sort = 'newest' | 'oldest' | 'priority'

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function AdminReportsPage() {
  const { currentUser, state, tx, lang, setPriority, recordExport } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status | 'all' | 'overdue'>('all')
  const [category, setCategory] = useState('all')
  const [priority, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [department, setDepartment] = useState('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [picked, setPicked] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const focus = searchParams.get('focus')
  useTitle(tx('Reports', 'রিপোর্ট'))
  const releaseFocus = () => {
    if (searchParams.has('focus')) setSearchParams({}, { replace: true })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 450)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!openId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[data-confirm]')) setOpenId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  const focused = focus === 'open' || focus === 'overdue' || focus === 'unassigned' || focus === 'resolved-month'
  const filtered = query.trim() !== '' || status !== 'all' || category !== 'all' || priority !== 'all' || department !== 'all' || focused
  const rows = useMemo(() => {
    if (!currentUser) return []
    const list = deskReports(currentUser, state.reports).filter((report) => {
      const blob = `${report.id} ${report.title}`.toLowerCase()
      if (query.trim() && !blob.includes(query.trim().toLowerCase())) return false
      if (focus === 'open' && !isOpen(report.status)) return false
      if (focus === 'overdue' && !isOverdue(report)) return false
      if (focus === 'unassigned' && !isUnassigned(report)) return false
      if (focus === 'resolved-month' && !resolvedThisMonth(report)) return false
      if (status === 'overdue') return isOverdue(report)
      if (status !== 'all' && report.status !== status) return false
      if (category !== 'all' && report.category !== category) return false
      if (priority !== 'all' && report.priority !== priority) return false
      if (department !== 'all' && report.departmentId !== department) return false
      return true
    })
    return list.sort((a, b) => {
      if (sort === 'oldest') return +new Date(a.createdAt) - +new Date(b.createdAt)
      if (sort === 'priority') {
        const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (rank !== 0) return rank
      }
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
  }, [currentUser, state.reports, query, status, category, priority, department, sort, focus])

  const open = rows.find((report) => report.id === openId) ?? state.reports.find((report) => report.id === openId && report.status !== 'draft')

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setCategory('all')
    setPriorityFilter('all')
    setDepartment('all')
    setSort('newest')
    setSearchParams({}, { replace: true })
  }

  const exportCsv = () => {
    const header = ['id', 'title', 'category', 'subcategory', 'status', 'priority', 'location', 'department', 'created', 'due', 'confidential', 'anonymous', 'rating']
    const body = rows.map((report) => {
      const place = PLACES.find((item) => item.id === report.locationId)?.en ?? ''
      const office = state.departments.find((item) => item.id === report.departmentId)?.en ?? ''
      return [
        report.id,
        report.confidential ? '' : report.title,
        report.category,
        report.subcategory ?? '',
        report.status,
        report.priority,
        place,
        office,
        report.createdAt,
        report.dueAt,
        report.confidential ? 'yes' : 'no',
        report.anonymous ? 'yes' : 'no',
        report.rating ? String(report.rating) : '',
      ]
    })
    const blob = new Blob([toCsv([header, ...body])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'safely-reports.csv'
    link.click()
    URL.revokeObjectURL(url)
    recordExport()
  }

  if (!currentUser) return null
  const canBulk = currentUser.role === 'admin' || currentUser.role === 'security'

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{tx('Report queue', 'রিপোর্ট সারি')}</h1>
          <p className="mt-1 text-sm text-ink/60">{tx('Find a report by ID or title, then open it without leaving the queue.', 'আইডি বা শিরোনাম দিয়ে খুঁজে সারি ছাড়াই খুলুন।')}</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>{tx('Export CSV', 'CSV রপ্তানি')}</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/45">{tx('Search', 'খোঁজ')}</span>
          <input className="input" value={query} onChange={(event) => { releaseFocus(); setQuery(event.target.value) }} placeholder={tx('Report ID or title', 'রিপোর্ট আইডি বা শিরোনাম')} />
        </label>
        <Filter label={tx('Status', 'স্ট্যাটাস')}>
          <select className="input" value={status} onChange={(event) => { releaseFocus(); setStatus(event.target.value as Status | 'all' | 'overdue') }}>
            <option value="all">{tx('Any status', 'যেকোনো স্ট্যাটাস')}</option>
            <option value="overdue">{tx('Overdue', 'সময়োত্তীর্ণ')}</option>
            {(['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'] as Status[]).map((item) => <option key={item} value={item}>{statusLabel(item, lang)}</option>)}
          </select>
        </Filter>
        <Filter label={tx('Category', 'বিভাগ')}>
          <select className="input" value={category} onChange={(event) => { releaseFocus(); setCategory(event.target.value) }}>
            <option value="all">{tx('Any category', 'যেকোনো বিভাগ')}</option>
            {state.categories.map((item) => <option key={item.id} value={item.id}>{lang === 'bn' ? item.bn : item.en}</option>)}
          </select>
        </Filter>
        <Filter label={tx('Priority', 'অগ্রাধিকার')}>
          <select className="input" value={priority} onChange={(event) => { releaseFocus(); setPriorityFilter(event.target.value as Priority | 'all') }}>
            <option value="all">{tx('Any priority', 'যেকোনো অগ্রাধিকার')}</option>
            {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((item) => <option key={item} value={item}>{priorityLabel(item, lang)}</option>)}
          </select>
        </Filter>
        <Filter label={tx('Department', 'দপ্তর')}>
          <select className="input" value={department} onChange={(event) => { releaseFocus(); setDepartment(event.target.value) }}>
            <option value="all">{tx('Any office', 'যেকোনো দপ্তর')}</option>
            {state.departments.map((item) => <option key={item.id} value={item.id}>{lang === 'bn' ? item.bn : item.en}</option>)}
          </select>
        </Filter>
        <Filter label={tx('Sort', 'সাজান')}>
          <select className="input" value={sort} onChange={(event) => { releaseFocus(); setSort(event.target.value as Sort) }}>
            <option value="newest">{tx('Newest', 'নতুন আগে')}</option>
            <option value="oldest">{tx('Oldest', 'পুরোনো আগে')}</option>
            <option value="priority">{tx('Priority', 'অগ্রাধিকার')}</option>
          </select>
        </Filter>
      </div>
      {focused ? (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            {focus === 'open' ? tx('Showing total open reports.', 'মোট খোলা রিপোর্ট দেখানো হচ্ছে।') : null}
            {focus === 'overdue' ? tx('Showing overdue reports.', 'সময়োত্তীর্ণ রিপোর্ট দেখানো হচ্ছে।') : null}
            {focus === 'unassigned' ? tx('Showing open reports with no office yet.', 'যে খোলা রিপোর্টে এখনও দপ্তর নেই, সেগুলো দেখানো হচ্ছে।') : null}
            {focus === 'resolved-month' ? tx('Showing reports resolved this month.', 'এই মাসে সমাধান হওয়া রিপোর্ট দেখানো হচ্ছে।') : null}
          </span>
          <Button variant="secondary" onClick={clearFilters}>{tx('Show every report', 'সব রিপোর্ট দেখান')}</Button>
        </p>
      ) : null}
      {canBulk && picked.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((item) => (
            <Button key={item} variant="secondary" onClick={() => { setPriority(picked, item); setPicked([]) }}>{priorityLabel(item, lang)}</Button>
          ))}
        </div>
      ) : null}

      <div className="mt-4" aria-busy={loading}>
        {loading ? <QueueLoading label={tx('Loading the queue', 'সারি লোড হচ্ছে')} /> : rows.length === 0 ? (
          <Empty
            title={tx('No reports in this queue', 'এই সারিতে রিপোর্ট নেই')}
            body={filtered
              ? tx('Nothing matches that ID, title, or filter.', 'এই আইডি, শিরোনাম, বা ফিল্টারের সাথে কিছু মেলেনি।')
              : tx('Drafts stay with the reporter. Submitted reports will show up here.', 'খসড়া রিপোর্টকারীর কাছে থাকে। জমা হওয়া রিপোর্ট এখানে আসবে।')}
            action={filtered ? <Button variant="secondary" onClick={clearFilters}>{tx('Clear filters', 'ফিল্টার মুছুন')}</Button> : undefined}
          />
        ) : (
          <>
            <div className="space-y-2 lg:hidden">
              {rows.map((report) => {
                const office = state.departments.find((item) => item.id === report.departmentId)
                const categoryName = state.categories.find((item) => item.id === report.category)
                return (
                  <button key={report.id} type="button" onClick={() => setOpenId(report.id)} className="panel block w-full p-3 text-left text-sm">
                    <span className="font-semibold text-teal-800">{report.id}</span>
                    <span className="mt-1 block font-medium">{report.title}</span>
                    <span className="mt-2 grid gap-1 text-xs text-ink/60">
                      <span>{tx('Category', 'বিভাগ')}: {categoryName ? (lang === 'bn' ? categoryName.bn : categoryName.en) : '—'}</span>
                      <span>{tx('Status', 'স্ট্যাটাস')}: {statusLabel(report.status, lang)}</span>
                      <span>{tx('Priority', 'অগ্রাধিকার')}: {priorityLabel(report.priority, lang)}</span>
                      <span>{tx('Office', 'দপ্তর')}: {office ? (lang === 'bn' ? office.bn : office.en) : tx('Unassigned', 'বরাদ্দ হয়নি')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink/45">
                  <tr>
                    <th className="py-2 pr-2"></th>
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">{tx('Report', 'রিপোর্ট')}</th>
                    <th className="py-2 pr-3">{tx('Category', 'বিভাগ')}</th>
                    <th className="py-2 pr-3">{tx('Status', 'স্ট্যাটাস')}</th>
                    <th className="py-2 pr-3">{tx('Priority', 'অগ্রাধিকার')}</th>
                    <th className="py-2">{tx('Office', 'দপ্তর')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((report) => {
                    const office = state.departments.find((item) => item.id === report.departmentId)
                    const categoryName = state.categories.find((item) => item.id === report.category)
                    return (
                      <tr key={report.id} className={`cursor-pointer border-t border-line hover:bg-teal-50/70 ${openId === report.id ? 'bg-teal-50' : ''}`} onClick={() => setOpenId(report.id)}>
                        <td className="py-2 pr-2" onClick={(event) => event.stopPropagation()}>
                          {canBulk ? <input type="checkbox" checked={picked.includes(report.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, report.id] : current.filter((item) => item !== report.id))} aria-label={report.id} /> : null}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-teal-800">{report.id}</td>
                        <td className="py-2 pr-3">{report.title}{report.confidential ? <span className="ml-2 text-xs font-semibold text-plum">{tx('Restricted', 'সীমিত')}</span> : null}{isOverdue(report) ? <span className="ml-2 text-xs font-semibold text-clay">{tx('Overdue', 'সময়োত্তীর্ণ')}</span> : null}</td>
                        <td className="py-2 pr-3">{categoryName ? (lang === 'bn' ? categoryName.bn : categoryName.en) : '—'}</td>
                        <td className="py-2 pr-3">{statusLabel(report.status, lang)}</td>
                        <td className="py-2 pr-3">{priorityLabel(report.priority, lang)}</td>
                        <td className="py-2">{office ? (lang === 'bn' ? office.bn : office.en) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {!loading ? <p className="mt-3 text-sm text-ink/50">{rows.length} {tx('shown', 'দেখানো হয়েছে')}</p> : null}
      {open && openId ? <ReportDrawer report={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</span>
      {children}
    </label>
  )
}

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="panel space-y-3 p-4" role="status">
      <p className="text-sm font-medium text-ink/70">{label}</p>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-xl bg-ink/5" />
      ))}
    </div>
  )
}

function ReportDrawer({ report, onClose }: { report: Report; onClose: () => void }) {
  const { state, lang, tx } = useApp()
  const category = state.categories.find((item) => item.id === report.category)
  const place = PLACES.find((item) => item.id === report.locationId)
  const office = state.departments.find((item) => item.id === report.departmentId)
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label={tx('Close', 'বন্ধ')} onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={report.id} className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-paper p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-teal-800">{report.id}</p>
          <button type="button" onClick={onClose} className="rounded-full p-1" aria-label={tx('Close', 'বন্ধ')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-2 font-display text-3xl leading-tight">{report.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={report.status} />
          <span className="text-xs font-semibold text-ink/60">{priorityLabel(report.priority, lang)}</span>
        </div>
        <p className="mt-4 text-sm text-ink/70">
          {category ? (lang === 'bn' ? category.bn : category.en) : ''}
          {place ? ` · ${lang === 'bn' ? place.bn : place.en}` : ''}
          {report.locationDetail ? ` · ${report.locationDetail}` : ''}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{report.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-white p-3">
            <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Office', 'দপ্তর')}</dt>
            <dd className="mt-1 font-medium">{office ? (lang === 'bn' ? office.bn : office.en) : tx('Not assigned yet', 'এখনও বরাদ্দ হয়নি')}</dd>
          </div>
          <div className="rounded-xl bg-white p-3">
            <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Filed', 'জমা')}</dt>
            <dd className="mt-1 font-medium">{formatWhen(report.createdAt, lang)}</dd>
          </div>
        </dl>
        <Link to={`/admin/reports/${report.id}`} className="mt-4 text-sm font-semibold text-teal-800">{tx('Open the full page', 'পুরো পাতা খুলুন')}</Link>
        <div className="mt-4">
          <AssignOffice report={report} />
        </div>
      </aside>
    </div>
  )
}
