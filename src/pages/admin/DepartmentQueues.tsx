import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, Field, StatusPill, useTitle } from '../../components/ui'
import { QUEUE_OFFICES, allowedTransitions, assignedAt, formatWhen, isOverdue, isRestrictedDesk, officeCanRead, priorityLabel, restrictedVisible, statusLabel } from '../../logic'
import { useApp } from '../../store'
import type { Report, Status } from '../../types'

export function DepartmentQueuesPage() {
  const { currentUser, state, tx, lang } = useApp()
  const offices = visibleOffices(currentUser)
  const [office, setOffice] = useState(offices[0] ?? '')
  const selected = offices.includes(office) ? office : offices[0] ?? ''
  const restricted = isRestrictedDesk(currentUser)
  const assignedOnly = currentUser?.role === 'department' && !restricted
  const title = restricted ? tx('Restricted queue', 'সীমিত সারি') : assignedOnly ? tx('Assigned queue', 'বরাদ্দকৃত সারি') : tx('Department queue', 'দপ্তরের সারি')
  useTitle(title)
  if (!currentUser) return null

  const department = state.departments.find((item) => item.id === selected)
  const rows = (restricted ? state.reports.filter((report) => restrictedVisible(currentUser, report)) : state.reports.filter((report) => officeCanRead(selected, report)))
    .sort((a, b) => Number(Boolean(a.departmentId)) - Number(Boolean(b.departmentId)) || +new Date(a.dueAt) - +new Date(b.dueAt))

  return (
    <div>
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        {restricted
          ? tx(
              'Only the cases this office is allowed to see are listed. Unassigned confidential cases stay here until the operations desk assigns them.',
              'শুধু এই দপ্তর যে কেস দেখতে পারে, সেগুলো এখানে। বরাদ্দ না হওয়া গোপন কেস অপারেশন ডেস্ক বরাদ্দ না করা পর্যন্ত এখানে থাকে।',
            )
          : assignedOnly
            ? tx(
                'These are the reports assigned to your office. Update the status or leave an internal note from each card.',
                'এগুলো আপনার দপ্তরে বরাদ্দকৃত রিপোর্ট। প্রতিটি কার্ড থেকে স্ট্যাটাস আপডেট করুন বা অভ্যন্তরীণ নোট রাখুন।',
              )
            : tx(
                'Each office sees only the reports assigned to it. Confidential reports stay with Security and Student Affairs.',
                'প্রতিটি দপ্তর শুধু নিজের বরাদ্দকৃত রিপোর্ট দেখে। গোপন রিপোর্ট থাকে নিরাপত্তা ও শিক্ষার্থী বিষয়ক দপ্তরে।',
              )}
      </p>
      {offices.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {offices.map((id) => {
            const item = state.departments.find((entry) => entry.id === id)
            const count = state.reports.filter((report) => officeCanRead(id, report)).length
            return (
              <button key={id} type="button" onClick={() => setOffice(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${selected === id ? 'bg-teal-800 text-white' : 'bg-white text-ink'}`}>
                {item ? (lang === 'bn' ? item.bn : item.en) : id} · {count}
              </button>
            )
          })}
        </div>
      ) : department ? (
        <p className="mt-4 text-sm font-semibold text-teal-800">{lang === 'bn' ? department.bn : department.en}</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-4">
          <Empty title={tx('This queue is empty', 'এই সারি খালি')} body={tx('Nothing is assigned to this office.', 'এই দপ্তরে কিছু বরাদ্দ নেই।')} />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((report) => <QueueCard key={report.id} report={report} />)}
        </div>
      )}
    </div>
  )
}

function visibleOffices(user: { role: string; departmentId?: string } | null): string[] {
  if (!user) return []
  if (user.role === 'admin') return [...QUEUE_OFFICES]
  if (user.role === 'security') return ['d-sec']
  if (user.role === 'department' && user.departmentId) return [user.departmentId]
  return []
}

function QueueCard({ report }: { report: Report }) {
  const { currentUser, tx, lang, setStatus, addComment } = useApp()
  const [statusOpen, setStatusOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [next, setNext] = useState<Status | ''>('')
  const [statusNote, setStatusNote] = useState('')
  const [internal, setInternal] = useState('')
  if (!currentUser) return null
  const transitions = allowedTransitions(currentUser, report)
  const restricted = isRestrictedDesk(currentUser)
  const waiting = !report.departmentId
  const assigned = assignedAt(report)
  const notes = report.activities.filter((item) => item.visibility === 'internal')
  const overdue = isOverdue(report)

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/admin/reports/${report.id}`} className="font-semibold text-teal-800">{report.id}</Link>
        <StatusPill status={report.status} />
        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold">{priorityLabel(report.priority, lang)}</span>
        {report.confidential ? <span className="rounded-full bg-plum/10 px-2.5 py-1 text-xs font-semibold text-plum">{tx('Confidential', 'গোপন')}</span> : null}
      </div>
      <h2 className="mt-2 font-display text-2xl leading-tight">{report.title}</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Assigned', 'বরাদ্দ')}</dt>
          <dd className="mt-1 font-medium">{waiting ? tx('Waiting for assignment', 'বরাদ্দের অপেক্ষায়') : assigned ? formatWhen(assigned, lang) : tx('Not recorded', 'তারিখ নেই')}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Due', 'লক্ষ্য')}</dt>
          <dd className={`mt-1 font-medium ${overdue ? 'text-clay' : ''}`}>{formatWhen(report.dueAt, lang)}{overdue ? ` · ${tx('Overdue', 'সময়োত্তীর্ণ')}` : ''}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Priority', 'অগ্রাধিকার')}</dt>
          <dd className="mt-1 font-medium">{priorityLabel(report.priority, lang)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Current status', 'বর্তমান স্ট্যাটাস')}</dt>
          <dd className="mt-1 font-medium">{statusLabel(report.status, lang)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={transitions.length === 0} onClick={() => { setStatusOpen((open) => !open); setNoteOpen(false) }}>{restricted ? tx('Case update', 'কেস আপডেট') : tx('Update status', 'স্ট্যাটাস আপডেট')}</Button>
        <Button variant="ghost" onClick={() => { setNoteOpen((open) => !open); setStatusOpen(false) }}>{tx('Add internal note', 'অভ্যন্তরীণ নোট')}</Button>
      </div>
      {statusOpen ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => {
          event.preventDefault()
          if (!next) return
          if (setStatus(report.id, next, statusNote)) {
            setStatusNote('')
            setNext('')
            setStatusOpen(false)
          }
        }}>
          <Field label={tx('Next status', 'পরের স্ট্যাটাস')}>
            <select className="input" value={next} onChange={(event) => setNext(event.target.value as Status | '')}>
              <option value="">{tx('Choose', 'বেছে নিন')}</option>
              {transitions.map((item) => <option key={item} value={item}>{statusLabel(item, lang)}</option>)}
            </select>
          </Field>
          <Field label={tx('Note', 'নোট')} hint={tx('Required when resolving.', 'সমাধানের সময় দরকার।')}>
            <textarea className="input min-h-20" value={statusNote} onChange={(event) => setStatusNote(event.target.value)} />
          </Field>
          <Button type="submit" disabled={!next}>{tx('Save status', 'স্ট্যাটাস সেভ')}</Button>
        </form>
      ) : null}
      {noteOpen ? (
        <form className="mt-3 space-y-3" onSubmit={(event) => {
          event.preventDefault()
          if (internal.trim().length < 2) return
          addComment(report.id, internal, 'internal')
          setInternal('')
          setNoteOpen(false)
        }}>
          <Field label={tx('Internal note', 'অভ্যন্তরীণ নোট')} hint={tx('Only this office and the operations desk can read it.', 'শুধু এই দপ্তর ও অপারেশন ডেস্ক পড়তে পারবে।')}>
            <textarea className="input min-h-20" value={internal} onChange={(event) => setInternal(event.target.value)} />
          </Field>
          <Button type="submit">{tx('Save note', 'নোট সেভ')}</Button>
        </form>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {notes.slice(-2).map((item) => (
            <li key={item.id} className="rounded-xl bg-ink/5 px-3 py-2 text-sm">
              <span className="text-xs text-ink/50">{item.actor} · {formatWhen(item.at, lang)} · {tx('Internal', 'অভ্যন্তরীণ')}</span>
              <p className="mt-1">{item.message}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
