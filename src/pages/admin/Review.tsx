import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReportStory } from '../../components/ReportStory'
import { Button, Field, useTitle } from '../../components/ui'
import { allowedTransitions, assignmentBlocked, canView, priorityLabel, statusLabel } from '../../logic'
import { useApp } from '../../store'
import type { Photo, Priority, Status } from '../../types'

export function ReviewPage() {
  const { id } = useParams()
  const { currentUser, state, tx, lang, setStatus, assign, addComment, requestInfo, extendDue } = useApp()
  const report = state.reports.find((item) => item.id === id)
  const category = state.categories.find((item) => item.id === report?.category)
  const [status, setNext] = useState<Status | ''>('')
  const [note, setNote] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriorityValue] = useState<Priority>('medium')
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState('')
  const [photoName, setPhotoName] = useState('')
  useTitle(report?.id ?? tx('Review', 'পর্যালোচনা'))

  useEffect(() => {
    if (!report) return
    setDepartmentId(report.departmentId || category?.suggestedDepartmentId || '')
    setAssignee(report.assignee || '')
    setPriorityValue(report.priority)
    setNext('')
    setNote('')
  }, [report, category?.suggestedDepartmentId])

  if (!currentUser || !report || report.status === 'draft' || !canView(currentUser, report)) {
    return <p className="text-sm">{tx('That report is not on this desk.', 'এই রিপোর্ট এই ডেস্কে নেই।')}</p>
  }

  const transitions = allowedTransitions(currentUser, report)
  const canAssign = currentUser.role === 'admin' || currentUser.role === 'security'
  const blocked = departmentId ? assignmentBlocked(report, departmentId) : false
  const suggested = state.departments.find((item) => item.id === category?.suggestedDepartmentId)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div>
        <Link to="/admin/reports" className="text-sm font-semibold text-teal-800">{tx('All reports', 'সব রিপোর্ট')}</Link>
        <div className="mt-3">
          <ReportStory report={report} internal />
        </div>
      </div>
      <div className="no-print space-y-3">
        {report.anonymous ? <div className="rounded-2xl bg-plum/10 p-4 text-sm text-plum">{report.reporterId ? tx('The name is hidden. Status updates still reach the reporter’s own account in this preview.', 'নাম লুকানো। এই প্রিভিউতে স্ট্যাটাস রিপোর্টকারীর নিজের অ্যাকাউন্টে যায়।') : tx('No reply channel was collected.', 'উত্তরের কোনো পথ রাখা হয়নি।')}</div> : null}
        {canAssign ? (
          <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); if (departmentId) assign(report.id, departmentId, assignee, priority) }}>
            <h2 className="font-display text-2xl">{tx('Assign', 'বরাদ্দ')}</h2>
            <p className="text-xs text-ink/55">{tx('Suggested office:', 'প্রস্তাবিত দপ্তর:')} {suggested ? (lang === 'bn' ? suggested.bn : suggested.en) : '—'}. {tx('Nothing is sent until you confirm.', 'নিশ্চিত না করা পর্যন্ত কিছু যায় না।')}</p>
            <Field label={tx('Office', 'দপ্তর')}>
              <select className="input" value={departmentId} onChange={(event) => {
                const next = event.target.value
                setDepartmentId(next)
                const office = state.departments.find((item) => item.id === next)
                if (office && !assignee) setAssignee(office.lead)
              }}>
                <option value="">{tx('Choose', 'বেছে নিন')}</option>
                {state.departments.map((item) => <option key={item.id} value={item.id}>{lang === 'bn' ? item.bn : item.en}</option>)}
              </select>
            </Field>
            <Field label={tx('Person', 'ব্যক্তি')}>
              <input className="input" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
            </Field>
            <Field label={tx('Priority', 'অগ্রাধিকার')}>
              <select className="input" value={priority} onChange={(event) => setPriorityValue(event.target.value as Priority)}>
                {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((item) => <option key={item} value={item}>{priorityLabel(item, lang)}</option>)}
              </select>
            </Field>
            {blocked ? <p className="text-sm text-clay">{tx('Confidential reports stay with Security or Student Affairs.', 'গোপন রিপোর্ট নিরাপত্তা বা শিক্ষার্থী বিষয়ক দপ্তরে থাকবে।')}</p> : null}
            {report.blocksAccess ? <p className="text-sm">{tx('The reporter says daily access is blocked.', 'রিপোর্টকারী বলেছেন দৈনন্দিন চলাচল আটকে আছে।')}</p> : null}
            <Button type="submit" className="w-full" disabled={!departmentId || blocked}>{tx('Assign office', 'দপ্তর বরাদ্দ')}</Button>
          </form>
        ) : null}

        <form className="panel space-y-3 p-4" onSubmit={(event) => {
          event.preventDefault()
          if (!status) return
          const photo: Photo | undefined = photoName ? { name: photoName } : undefined
          if (setStatus(report.id, status, note, photo)) {
            setNote('')
            setPhotoName('')
          }
        }}>
          <h2 className="font-display text-2xl">{tx('Status', 'স্ট্যাটাস')}</h2>
          <Field label={tx('Next status', 'পরের স্ট্যাটাস')}>
            <select className="input" value={status} onChange={(event) => setNext(event.target.value as Status | '')}>
              <option value="">{tx('Choose', 'বেছে নিন')}</option>
              {transitions.map((item) => <option key={item} value={item}>{statusLabel(item, lang)}</option>)}
            </select>
          </Field>
          <Field label={tx('Note', 'নোট')} hint={tx('Required when resolving, rejecting, or reopening.', 'সমাধান, প্রত্যাখ্যান, বা আবার খোলার সময় দরকার।')}>
            <textarea className="input min-h-20" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {status === 'resolved' ? (
            <Field label={tx('After-photo name', 'পরের ছবির নাম')}>
              <input className="input" value={photoName} onChange={(event) => setPhotoName(event.target.value)} placeholder="after.jpg" />
            </Field>
          ) : null}
          <Button type="submit" className="w-full" disabled={!status}>{tx('Update status', 'স্ট্যাটাস আপডেট')}</Button>
          <Button variant="secondary" className="w-full" onClick={() => extendDue(report.id)}>{tx('Add 24 hours to the target', 'লক্ষ্যে ২৪ ঘণ্টা যোগ')}</Button>
        </form>

        <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); requestInfo(report.id, reply); setReply('') }}>
          <h2 className="font-display text-2xl">{tx('Ask the reporter', 'রিপোর্টকারীকে জিজ্ঞাসা')}</h2>
          <textarea className="input min-h-20" value={reply} onChange={(event) => setReply(event.target.value)} />
          <Button type="submit" variant="secondary" className="w-full">{tx('Request information', 'তথ্য চান')}</Button>
        </form>
        <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); addComment(report.id, internal, 'internal'); setInternal('') }}>
          <h2 className="font-display text-2xl">{tx('Internal note', 'অভ্যন্তরীণ নোট')}</h2>
          <textarea className="input min-h-20" value={internal} onChange={(event) => setInternal(event.target.value)} />
          <Button type="submit" variant="quiet" className="w-full">{tx('Save note', 'নোট সেভ')}</Button>
        </form>
      </div>
    </div>
  )
}
