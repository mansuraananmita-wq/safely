import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, useTitle } from '../../components/ui'
import { PLACES } from '../../data'
import { deskReports, isOverdue, priorityLabel, statusLabel, toCsv } from '../../logic'
import { useApp } from '../../store'
import type { Priority, Status } from '../../types'

export function AdminReportsPage() {
  const { currentUser, state, tx, lang, setPriority, recordExport } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status | 'all' | 'overdue'>('all')
  const [category, setCategory] = useState('all')
  const [priority, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [department, setDepartment] = useState('all')
  const [picked, setPicked] = useState<string[]>([])
  useTitle(tx('Reports', 'রিপোর্ট'))
  const rows = useMemo(() => {
    if (!currentUser) return []
    return deskReports(currentUser, state.reports).filter((report) => {
      const blob = `${report.id} ${report.title} ${report.locationDetail}`.toLowerCase()
      if (query && !blob.includes(query.toLowerCase())) return false
      if (status === 'overdue') return isOverdue(report)
      if (status !== 'all' && report.status !== status) return false
      if (category !== 'all' && report.category !== category) return false
      if (priority !== 'all' && report.priority !== priority) return false
      if (department !== 'all' && report.departmentId !== department) return false
      return true
    })
  }, [currentUser, state.reports, query, status, category, priority, department])

  const exportCsv = () => {
    const header = ['id', 'title', 'category', 'status', 'priority', 'location', 'department', 'created', 'due', 'confidential', 'anonymous', 'rating']
    const body = rows.map((report) => {
      const place = PLACES.find((item) => item.id === report.locationId)?.en ?? ''
      const office = state.departments.find((item) => item.id === report.departmentId)?.en ?? ''
      return [
        report.id,
        report.confidential ? '' : report.title,
        report.category,
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
        <h1 className="font-display text-4xl">{tx('Reports', 'রিপোর্ট')}</h1>
        <Button variant="secondary" onClick={exportCsv}>{tx('Export CSV', 'CSV রপ্তানি')}</Button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        <input className="input md:col-span-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Search title or ID', 'শিরোনাম বা আইডি')} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value as Status | 'all' | 'overdue')}>
          <option value="all">{tx('Any status', 'যেকোনো স্ট্যাটাস')}</option>
          <option value="overdue">{tx('Overdue', 'সময়োত্তীর্ণ')}</option>
          {(['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'] as Status[]).map((item) => <option key={item} value={item}>{statusLabel(item, lang)}</option>)}
        </select>
        <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">{tx('Any category', 'যেকোনো বিভাগ')}</option>
          {state.categories.map((item) => <option key={item.id} value={item.id}>{lang === 'bn' ? item.bn : item.en}</option>)}
        </select>
        <select className="input" value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="all">{tx('Any office', 'যেকোনো দপ্তর')}</option>
          {state.departments.map((item) => <option key={item.id} value={item.id}>{lang === 'bn' ? item.bn : item.en}</option>)}
        </select>
      </div>
      <div className="mt-2">
        <select className="input max-w-xs" value={priority} onChange={(event) => setPriorityFilter(event.target.value as Priority | 'all')}>
          <option value="all">{tx('Any priority', 'যেকোনো অগ্রাধিকার')}</option>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((item) => <option key={item} value={item}>{priorityLabel(item, lang)}</option>)}
        </select>
      </div>
      {canBulk && picked.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((item) => (
            <Button key={item} variant="secondary" onClick={() => { setPriority(picked, item); setPicked([]) }}>{priorityLabel(item, lang)}</Button>
          ))}
        </div>
      ) : null}
      <div className="mt-4 space-y-2 lg:hidden">
        {rows.map((report) => (
          <Link key={report.id} to={`/admin/reports/${report.id}`} className="panel block p-3 text-sm">
            <span className="font-semibold text-teal-800">{report.id}</span>
            <span className="mt-1 block">{report.title}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="py-2 pr-2"></th>
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">{tx('Report', 'রিপোর্ট')}</th>
              <th className="py-2 pr-3">{tx('Status', 'স্ট্যাটাস')}</th>
              <th className="py-2 pr-3">{tx('Priority', 'অগ্রাধিকার')}</th>
              <th className="py-2">{tx('Office', 'দপ্তর')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => {
              const office = state.departments.find((item) => item.id === report.departmentId)
              return (
                <tr key={report.id} className="border-t border-line">
                  <td className="py-2 pr-2">
                    {canBulk ? <input type="checkbox" checked={picked.includes(report.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, report.id] : current.filter((item) => item !== report.id))} aria-label={report.id} /> : null}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-teal-800"><Link to={`/admin/reports/${report.id}`}>{report.id}</Link></td>
                  <td className="py-2 pr-3">{report.title}{report.confidential ? <span className="ml-2 text-xs font-semibold text-plum">{tx('Restricted', 'সীমিত')}</span> : null}{isOverdue(report) ? <span className="ml-2 text-xs font-semibold text-clay">{tx('Overdue', 'সময়োত্তীর্ণ')}</span> : null}</td>
                  <td className="py-2 pr-3">{statusLabel(report.status, lang)}</td>
                  <td className="py-2 pr-3">{priorityLabel(report.priority, lang)}</td>
                  <td className="py-2">{office ? (lang === 'bn' ? office.bn : office.en) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-ink/50">{rows.length} {tx('shown', 'দেখানো হয়েছে')}</p>
    </div>
  )
}
