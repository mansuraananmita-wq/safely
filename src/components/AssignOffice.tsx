import { useEffect, useState } from 'react'
import { Button, Field, Modal } from './ui'
import { assignmentBlocked, priorityLabel } from '../logic'
import { useApp } from '../store'
import type { Priority, Report } from '../types'

export function AssignOffice({ report }: { report: Report }) {
  const { currentUser, state, tx, lang, assign } = useApp()
  const category = state.categories.find((item) => item.id === report.category)
  const [departmentId, setDepartmentId] = useState(report.departmentId || category?.suggestedDepartmentId || '')
  const [assignee, setAssignee] = useState(report.assignee || '')
  const [priority, setPriority] = useState<Priority>(report.priority)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setDepartmentId(report.departmentId || category?.suggestedDepartmentId || '')
    setAssignee(report.assignee || '')
    setPriority(report.priority)
    setPending(false)
  }, [report, category?.suggestedDepartmentId])

  if (!currentUser || currentUser.role !== 'admin') return null

  const office = state.departments.find((item) => item.id === departmentId)
  const suggested = state.departments.find((item) => item.id === category?.suggestedDepartmentId)
  const blocked = departmentId ? assignmentBlocked(report, departmentId) : false
  const officeName = office ? (lang === 'bn' ? office.bn : office.en) : ''
  const person = assignee.trim() || office?.lead || ''

  return (
    <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); if (departmentId && !blocked) setPending(true) }}>
      <h2 className="font-display text-2xl">{tx('Assign', 'বরাদ্দ')}</h2>
      <p className="text-xs text-ink/55">
        {tx('Suggested office:', 'প্রস্তাবিত দপ্তর:')} {suggested ? (lang === 'bn' ? suggested.bn : suggested.en) : '—'}. {tx('Nothing is sent until you confirm.', 'নিশ্চিত না করা পর্যন্ত কিছু যায় না।')}
      </p>
      <Field label={tx('Office', 'দপ্তর')}>
        <select className="input" value={departmentId} onChange={(event) => {
          const next = event.target.value
          setDepartmentId(next)
          const chosen = state.departments.find((item) => item.id === next)
          if (chosen) setAssignee(chosen.lead)
        }}>
          <option value="">{tx('Choose', 'বেছে নিন')}</option>
          {state.departments.map((item) => <option key={item.id} value={item.id}>{lang === 'bn' ? item.bn : item.en}</option>)}
        </select>
      </Field>
      <Field label={tx('Person', 'ব্যক্তি')}>
        <input className="input" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
      </Field>
      <Field label={tx('Priority', 'অগ্রাধিকার')}>
        <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((item) => <option key={item} value={item}>{priorityLabel(item, lang)}</option>)}
        </select>
      </Field>
      {blocked ? <p className="text-sm text-clay">{tx('Confidential reports stay with Security or Student Affairs.', 'গোপন রিপোর্ট নিরাপত্তা বা শিক্ষার্থী বিষয়ক দপ্তরে থাকবে।')}</p> : null}
      {report.blocksAccess ? <p className="text-sm">{tx('The reporter says daily access is blocked.', 'রিপোর্টকারী বলেছেন দৈনন্দিন চলাচল আটকে আছে।')}</p> : null}
      <Button type="submit" className="w-full" disabled={!departmentId || blocked}>{tx('Review assignment', 'বরাদ্দ দেখুন')}</Button>
      <Modal open={pending} title={tx('Confirm this office', 'এই দপ্তর নিশ্চিত করুন')} onClose={() => setPending(false)}>
        <p className="text-sm">{lang === 'bn' ? `${report.id} পাঠানো হবে ${officeName} দপ্তরে।` : `Send ${report.id} to ${officeName}.`}</p>
        <p className="mt-2 text-sm text-ink/70">{person} · {priorityLabel(priority, lang)}</p>
        <p className="mt-2 text-sm text-ink/70">{tx('The office sees this report only after you confirm.', 'নিশ্চিত করলেই দপ্তর এই রিপোর্ট দেখতে পাবে।')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => { if (assign(report.id, departmentId, person, priority)) setPending(false) }}>{tx('Confirm assignment', 'বরাদ্দ নিশ্চিত')}</Button>
          <Button variant="secondary" onClick={() => setPending(false)}>{tx('Cancel', 'বাতিল')}</Button>
        </div>
      </Modal>
    </form>
  )
}
