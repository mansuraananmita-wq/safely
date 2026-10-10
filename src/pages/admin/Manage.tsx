import { useState, type FormEvent } from 'react'
import { Button, Field, useTitle } from '../../components/ui'
import { PLACES } from '../../data'
import { average, hoursBetween, isOpen, isOverdue } from '../../logic'
import { useApp } from '../../store'
import type { Announcement, Role } from '../../types'

export function DepartmentsPage() {
  const { currentUser, state, tx, lang, updateDepartment } = useApp()
  useTitle(tx('Departments', 'বিভাগ'))
  if (!currentUser) return null
  return (
    <div>
      <h1 className="font-display text-4xl">{tx('Departments', 'বিভাগ')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">{tx('Offices follow the real university. A report is never sent automatically. An officer confirms the suggestion first.', 'দপ্তরগুলো বিশ্ববিদ্যালয়ের আসল কাঠামো অনুসরণ করে। রিপোর্ট কখনও নিজে থেকে যায় না। কর্মকর্তা আগে পরামর্শ নিশ্চিত করেন।')}</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {state.departments.map((department) => {
          const queue = state.reports.filter((report) => report.departmentId === department.id && report.status !== 'draft')
          const open = queue.filter((report) => isOpen(report.status))
          const overdue = queue.filter(isOverdue)
          const done = queue.filter((report) => report.resolvedAt)
          const avg = done.length ? average(done.map((report) => hoursBetween(report.createdAt, report.resolvedAt!))) / 24 : 0
          return (
            <article key={department.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl">{lang === 'bn' ? department.bn : department.en}</h2>
                {department.sensitive ? <span className="rounded-full bg-plum/10 px-2 py-1 text-xs font-semibold text-plum">{tx('Sensitive', 'সংবেদনশীল')}</span> : null}
              </div>
              <p className="mt-2 text-sm">{tx('Open', 'খোলা')} {open.length} · {tx('Overdue', 'সময়োত্তীর্ণ')} {overdue.length} · {tx('Avg. resolution', 'গড় সমাধান')} {done.length ? `${avg.toFixed(1)}d` : '—'}</p>
              {currentUser.role === 'admin' ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input className="input" defaultValue={department.lead} aria-label={tx('Lead', 'প্রধান')} onBlur={(event) => updateDepartment(department.id, { lead: event.target.value })} />
                  <input className="input" defaultValue={department.email} aria-label={tx('Email', 'ইমেইল')} onBlur={(event) => updateDepartment(department.id, { email: event.target.value })} />
                </div>
              ) : <p className="mt-2 text-sm text-ink/60">{department.lead} · {department.email}</p>}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export function UsersPage() {
  const { currentUser, state, tx, lang, updateUser } = useApp()
  const [query, setQuery] = useState('')
  useTitle(tx('People', 'ব্যবহারকারী'))
  if (!currentUser) return null
  const people = state.users.filter((user) => `${user.name} ${user.email} ${user.identifier}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div>
      <h1 className="font-display text-4xl">{tx('People', 'ব্যবহারকারী')}</h1>
      <input className="input mt-4 max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Search name, email, or ID', 'নাম, ইমেইল, বা আইডি')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink/45">
            <tr><th className="py-2">{tx('Person', 'ব্যক্তি')}</th><th>{tx('Role', 'ভূমিকা')}</th><th>{tx('Office', 'দপ্তর')}</th><th>{tx('Access', 'অ্যাক্সেস')}</th></tr>
          </thead>
          <tbody>
            {people.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="py-2 pr-3">
                  <span className="block font-semibold">{user.name}</span>
                  <span className="text-xs text-ink/50">{user.email} · {user.identifier}{user.verified ? '' : ` · ${tx('unverified', 'অযাচাই')}`}</span>
                </td>
                <td className="py-2 pr-3">
                  <select className="input" value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as Role })}>
                    {(['student', 'teacher', 'staff', 'department', 'security', 'admin'] as Role[]).map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select className="input" value={user.departmentId ?? ''} onChange={(event) => updateUser(user.id, { departmentId: event.target.value || undefined })}>
                    <option value="">{tx('None', 'নেই')}</option>
                    {state.departments.map((department) => <option key={department.id} value={department.id}>{lang === 'bn' ? department.bn : department.en}</option>)}
                  </select>
                </td>
                <td className="py-2">
                  <Button variant={user.suspended ? 'primary' : 'danger'} disabled={user.id === currentUser.id} onClick={() => updateUser(user.id, { suspended: !user.suspended })}>
                    {user.suspended ? tx('Restore', 'ফেরান') : tx('Suspend', 'স্থগিত')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CategoriesPage() {
  const { state, tx, lang, updateCategory } = useApp()
  useTitle(tx('Categories', 'ক্যাটাগরি'))
  return (
    <div>
      <h1 className="font-display text-4xl">{tx('Categories', 'ক্যাটাগরি')}</h1>
      <div className="mt-4 space-y-3">
        {state.categories.map((category) => (
          <article key={category.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{lang === 'bn' ? category.bn : category.en}</p>
              <p className="text-xs text-ink/50">{category.sensitive ? tx('Restricted', 'সীমিত') : tx('Ordinary', 'সাধারণ')}</p>
            </div>
            <label className="text-sm">
              {tx('Target hours', 'লক্ষ্য ঘণ্টা')}
              <input className="input mt-1 w-28" type="number" min={1} defaultValue={category.slaHours} onBlur={(event) => updateCategory(category.id, { slaHours: Number(event.target.value) || category.slaHours })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={category.active} onChange={(event) => updateCategory(category.id, { active: event.target.checked })} />
              {tx('Open for new reports', 'নতুন রিপোর্টে খোলা')}
            </label>
          </article>
        ))}
      </div>
    </div>
  )
}

export function AnnouncementsPage() {
  const { currentUser, state, tx, lang, publishAnnouncement, setAnnouncementActive } = useApp()
  const [form, setForm] = useState({ title: '', body: '', kind: 'info' as Announcement['kind'], locationId: '' })
  useTitle(tx('Alerts', 'সতর্কতা'))
  if (!currentUser) return null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    publishAnnouncement(form)
    setForm({ title: '', body: '', kind: 'info', locationId: '' })
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form className="panel space-y-3 p-4" onSubmit={submit}>
        <h1 className="font-display text-3xl">{tx('Post an alert', 'সতর্কতা দিন')}</h1>
        <Field label={tx('Title', 'শিরোনাম')}><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
        <Field label={tx('Body', 'বিবরণ')}><textarea className="input min-h-24" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></Field>
        <Field label={tx('Kind', 'ধরন')}>
          <select className="input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Announcement['kind'] })}>
            <option value="info">{tx('Info', 'তথ্য')}</option>
            <option value="maintenance">{tx('Planned work', 'পরিকল্পিত কাজ')}</option>
            <option value="safety">{tx('Safety', 'নিরাপত্তা')}</option>
          </select>
        </Field>
        <Field label={tx('Place', 'স্থান')}>
          <select className="input" value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}>
            <option value="">{tx('Whole campus', 'পুরো ক্যাম্পাস')}</option>
            {PLACES.map((place) => <option key={place.id} value={place.id}>{lang === 'bn' ? place.bn : place.en}</option>)}
          </select>
        </Field>
        <Button type="submit">{tx('Publish', 'প্রকাশ')}</Button>
      </form>
      <div className="space-y-3">
        {state.announcements.map((item) => (
          <article key={item.id} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-teal-800">{item.kind} · {item.active ? tx('Showing', 'দেখাচ্ছে') : tx('Hidden', 'লুকানো')}</p>
            <h2 className="font-display text-2xl">{item.title}</h2>
            <p className="mt-1 text-sm">{item.body}</p>
            {currentUser.role === 'admin' ? <Button className="mt-3" variant="secondary" onClick={() => setAnnouncementActive(item.id, !item.active)}>{item.active ? tx('Hide', 'লুকান') : tx('Show again', 'আবার দেখান')}</Button> : null}
          </article>
        ))}
      </div>
    </div>
  )
}

export function AuditPage() {
  const { state, tx } = useApp()
  const [query, setQuery] = useState('')
  useTitle(tx('Audit', 'অডিট'))
  const rows = state.audit.filter((item) => `${item.actor} ${item.action} ${item.target}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div>
      <h1 className="font-display text-4xl">{tx('Audit', 'অডিট')}</h1>
      <p className="mt-2 text-sm text-ink/60">{tx('Assignments, status changes, exports, alerts, and account changes.', 'বরাদ্দ, স্ট্যাটাস, রপ্তানি, সতর্কতা, এবং অ্যাকাউন্ট বদল।')}</p>
      <input className="input mt-4 max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Search the log', 'লগ খুঁজুন')} />
      <ul className="mt-4 divide-y divide-line">
        {rows.map((item) => (
          <li key={item.id} className="py-3 text-sm">
            <span className="font-semibold">{item.actor}</span> {item.action}
            <span className="block text-xs text-ink/50">{item.target} · {new Date(item.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
