import { Link } from 'react-router-dom'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, Field, useTitle } from '../../components/ui'
import { PLACES } from '../../data'
import { average, hoursBetween, isOpen, isOverdue } from '../../logic'
import { useApp } from '../../store'
import type { Announcement, Role, SupportCategory, SupportContact, User } from '../../types'

const SUPPORT_CATEGORIES: SupportCategory[] = [
  'emergency',
  'counseling',
  'women_safety',
  'legal',
  'health',
  'proctor',
  'anti_harassment_committee',
]

function supportCategoryLabel(category: SupportCategory, lang: 'en' | 'bn') {
  const labels: Record<SupportCategory, [string, string]> = {
    emergency: ['Emergency', 'জরুরি'],
    counseling: ['Counseling', 'কাউন্সেলিং'],
    women_safety: ['Women safety', 'নারী নিরাপত্তা'],
    legal: ['Legal', 'আইনি'],
    health: ['Health', 'স্বাস্থ্য'],
    proctor: ['Proctor', 'প্রক্টর'],
    anti_harassment_committee: ['Anti-harassment', 'হয়রানি বিরোধী'],
  }
  return lang === 'bn' ? labels[category][1] : labels[category][0]
}

const emptySupportForm = {
  id: '',
  nameEn: '',
  nameBn: '',
  category: 'counseling' as SupportCategory,
  phone: '',
  email: '',
  hours: '',
  descriptionEn: '',
  descriptionBn: '',
  sortOrder: 80,
  isActive: true,
}

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
          const overdue = queue.filter((report) => isOverdue(report))
          const done = queue.filter((report) => report.resolvedAt)
          const avg = done.length ? average(done.map((report) => hoursBetween(report.createdAt, report.resolvedAt!))) / 24 : 0
          return (
            <article key={department.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl">{lang === 'bn' ? department.bn : department.en}</h2>
                {department.sensitive ? <span className="rounded-full bg-plum/10 px-2 py-1 text-xs font-semibold text-plum">{tx('Sensitive', 'সংবেদনশীল')}</span> : null}
              </div>
              <p className="mt-2 text-sm">{tx('Open', 'খোলা')} {open.length} · {tx('Overdue', 'সময়োত্তীর্ণ')} {overdue.length} · {tx('Avg. resolution', 'গড় সমাধান')} {done.length ? `${avg.toFixed(1)}d` : '—'}</p>
              <Link to={`/admin/queues?office=${department.id}`} className="mt-3 inline-block text-sm font-semibold text-teal-800">{tx('Open this queue', 'এই সারি খুলুন')}</Link>
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
  const { currentUser, state, tx } = useApp()
  const [query, setQuery] = useState('')
  useTitle(tx('People', 'ব্যবহারকারী'))
  if (!currentUser) return null
  const people = state.users.filter((user) => `${user.name} ${user.email} ${user.identifier}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div>
      <h1 className="font-display text-4xl">{tx('People', 'ব্যবহারকারী')}</h1>
      <input className="input mt-4 max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Search name, email, or ID', 'নাম, ইমেইল, বা আইডি')} />
      <div className="mt-4 space-y-3 lg:hidden">
        {people.map((user) => (
          <article key={user.id} className="panel space-y-3 p-4">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-ink/50">{user.email} · {user.identifier}{user.verified ? '' : ` · ${tx('unverified', 'অযাচাই')}`}</p>
            </div>
            <PersonControls user={user} />
          </article>
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] text-left text-sm">
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
                <td className="py-2 pr-3"><RoleSelect user={user} /></td>
                <td className="py-2 pr-3"><OfficeSelect user={user} /></td>
                <td className="py-2"><AccessButton user={user} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PersonControls({ user }: { user: User }) {
  const { tx } = useApp()
  return (
    <div className="grid gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink/45">{tx('Role', 'ভূমিকা')}</span>
        <RoleSelect user={user} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink/45">{tx('Office', 'দপ্তর')}</span>
        <OfficeSelect user={user} />
      </label>
      <AccessButton user={user} />
    </div>
  )
}

function RoleSelect({ user }: { user: User }) {
  const { updateUser } = useApp()
  return (
    <select className="input" aria-label={user.name} value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as Role })}>
      {(['student', 'teacher', 'staff', 'department', 'security', 'admin'] as Role[]).map((role) => <option key={role} value={role}>{role}</option>)}
    </select>
  )
}

function OfficeSelect({ user }: { user: User }) {
  const { state, tx, lang, updateUser } = useApp()
  return (
    <select className="input" aria-label={tx('Office', 'দপ্তর')} value={user.departmentId ?? ''} onChange={(event) => updateUser(user.id, { departmentId: event.target.value || undefined })}>
      <option value="">{tx('None', 'নেই')}</option>
      {state.departments.map((department) => <option key={department.id} value={department.id}>{lang === 'bn' ? department.bn : department.en}</option>)}
    </select>
  )
}

function AccessButton({ user }: { user: User }) {
  const { currentUser, tx, updateUser } = useApp()
  if (!currentUser) return null
  return (
    <Button variant={user.suspended ? 'primary' : 'danger'} disabled={user.id === currentUser.id} onClick={() => updateUser(user.id, { suspended: !user.suspended })}>
      {user.suspended ? tx('Restore', 'ফেরান') : tx('Suspend', 'স্থগিত')}
    </Button>
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

export function SupportContactsPage() {
  const { currentUser, state, tx, lang, saveSupportContact, setSupportContactActive, saveAppSetting } = useApp()
  const [form, setForm] = useState(emptySupportForm)
  const [securitySms, setSecuritySms] = useState(state.appSettings?.security_sms_number ?? '')
  useEffect(() => {
    setSecuritySms(state.appSettings?.security_sms_number ?? '')
  }, [state.appSettings?.security_sms_number])
  useTitle(tx('Get help contacts', 'সাহায্যের যোগাযোগ'))
  if (!currentUser || currentUser.role !== 'admin') return null
  const rows = state.supportContacts.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    saveSupportContact({
      id: form.id || undefined,
      nameEn: form.nameEn,
      nameBn: form.nameBn,
      category: form.category,
      phone: form.phone,
      email: form.email,
      hours: form.hours,
      descriptionEn: form.descriptionEn,
      descriptionBn: form.descriptionBn,
      sortOrder: form.sortOrder,
      isActive: form.isActive,
    })
    setForm(emptySupportForm)
  }
  const edit = (item: SupportContact) => {
    setForm({
      id: item.id,
      nameEn: item.nameEn,
      nameBn: item.nameBn,
      category: item.category,
      phone: item.phone,
      email: item.email,
      hours: item.hours,
      descriptionEn: item.descriptionEn,
      descriptionBn: item.descriptionBn,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    })
  }
  return (
    <div className="space-y-6">
      <form
        className="panel space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          saveAppSetting('security_sms_number', securitySms)
        }}
      >
        <h2 className="font-display text-2xl">{tx('Offline SOS SMS number', 'অফলাইন SOS SMS নম্বর')}</h2>
        <p className="text-sm text-ink/60">
          {tx(
            'When the phone cannot reach the server, Safely opens the SMS app to this campus security number. The person still has to press Send. Does not replace 999.',
            'ফোন সার্ভারে না পৌঁছালে Safely এই ক্যাম্পাস সিকিউরিটি নম্বরে SMS অ্যাপ খোলে। পাঠাতে এখনও Send চাপতে হয়। ৯৯৯-এর বিকল্প নয়।',
          )}
        </p>
        <Field label={tx('Campus security SMS number', 'ক্যাম্পাস সিকিউরিটি SMS নম্বর')}>
          <input
            className="input"
            value={securitySms}
            onChange={(event) => setSecuritySms(event.target.value)}
            placeholder="01XXXXXXXXX"
            inputMode="tel"
          />
        </Field>
        <Button type="submit">{tx('Save number', 'নম্বর সেভ')}</Button>
      </form>
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form className="panel space-y-3 p-4" onSubmit={submit}>
        <h1 className="font-display text-3xl">{form.id ? tx('Edit contact', 'যোগাযোগ সম্পাদনা') : tx('Add contact', 'যোগাযোগ যোগ')}</h1>
        <p className="text-sm text-ink/60">{tx('These numbers appear on Get help for every signed-in member.', 'এই নম্বরগুলো সাইন-ইন করা সবার সাহায্য নিন পাতায় দেখায়।')}</p>
        <Field label={tx('Name (English)', 'নাম (ইংরেজি)')}><input className="input" value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} required /></Field>
        <Field label={tx('Name (Bangla)', 'নাম (বাংলা)')}><input className="input" value={form.nameBn} onChange={(event) => setForm({ ...form, nameBn: event.target.value })} required /></Field>
        <Field label={tx('Category', 'ক্যাটাগরি')}>
          <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as SupportCategory })}>
            {SUPPORT_CATEGORIES.map((category) => <option key={category} value={category}>{supportCategoryLabel(category, lang)}</option>)}
          </select>
        </Field>
        <Field label={tx('Phone', 'ফোন')}><input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
        <Field label={tx('Email', 'ইমেইল')}><input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label={tx('Hours', 'সময়')}><input className="input" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} /></Field>
        <Field label={tx('Description (English)', 'বিবরণ (ইংরেজি)')}><textarea className="input min-h-20" value={form.descriptionEn} onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })} /></Field>
        <Field label={tx('Description (Bangla)', 'বিবরণ (বাংলা)')}><textarea className="input min-h-20" value={form.descriptionBn} onChange={(event) => setForm({ ...form, descriptionBn: event.target.value })} /></Field>
        <Field label={tx('Sort order', 'ক্রম')}><input className="input" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          {tx('Visible on Get help', 'সাহায্য নিন-এ দেখাবে')}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{form.id ? tx('Save changes', 'পরিবর্তন সেভ') : tx('Add contact', 'যোগাযোগ যোগ')}</Button>
          {form.id ? <Button type="button" variant="secondary" onClick={() => setForm(emptySupportForm)}>{tx('Cancel edit', 'সম্পাদনা বাতিল')}</Button> : null}
        </div>
      </form>
      <div className="space-y-3">
        {rows.map((item) => (
          <article key={item.id} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-teal-800">
              {supportCategoryLabel(item.category, lang)} · {item.isActive ? tx('Showing', 'দেখাচ্ছে') : tx('Hidden', 'লুকানো')} · #{item.sortOrder}
            </p>
            <h2 className="font-display text-2xl">{lang === 'bn' ? item.nameBn : item.nameEn}</h2>
            <a href={`tel:${item.phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-block text-lg font-semibold text-night">{item.phone}</a>
            <p className="mt-1 text-sm text-ink/70">{lang === 'bn' ? item.descriptionBn : item.descriptionEn}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => edit(item)}>{tx('Edit', 'সম্পাদনা')}</Button>
              <Button variant="secondary" onClick={() => setSupportContactActive(item.id, !item.isActive)}>
                {item.isActive ? tx('Hide', 'লুকান') : tx('Show again', 'আবার দেখান')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
    </div>
  )
}
