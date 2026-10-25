import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReportStory } from '../../components/ReportStory'
import { AssignOffice } from '../../components/AssignOffice'
import { Button, Field, useTitle } from '../../components/ui'
import { allowedTransitions, canView, isRestrictedDesk, statusLabel } from '../../logic'
import { useApp } from '../../store'
import type { Photo, Status } from '../../types'

export function ReviewPage() {
  const { id } = useParams()
  const { currentUser, state, tx, lang, setStatus, addComment, requestInfo, extendDue, revealReporter } = useApp()
  const report = state.reports.find((item) => item.id === id)
  const [status, setNext] = useState<Status | ''>('')
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [revealReason, setRevealReason] = useState('')
  const [revealed, setRevealed] = useState<{ name: string; email: string } | null>(null)
  const [revealError, setRevealError] = useState<string | null>(null)
  const visible = Boolean(currentUser && report && report.status !== 'draft' && canView(currentUser, report, state.reportIdentities))
  useTitle(visible && report ? report.id : tx('Review', 'পর্যালোচনা'))

  useEffect(() => {
    setNext('')
    setNote('')
    setRevealed(null)
    setRevealError(null)
    setRevealReason('')
  }, [report])

  if (!currentUser || !report || report.status === 'draft' || !canView(currentUser, report, state.reportIdentities)) {
    return <p className="text-sm">{tx('That report is not on this desk.', 'এই রিপোর্ট এই ডেস্কে নেই।')}</p>
  }

  const transitions = allowedTransitions(currentUser, report, state.reportIdentities)
  const operations = currentUser.role === 'admin'
  const canReveal = report.anonymous && (report.category === 'harassment' || report.category === 'safety') && (operations || currentUser.departmentId === 'd-affairs')
  const restricted = isRestrictedDesk(currentUser)
  const waiting = !report.departmentId

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div>
        <Link to={operations ? '/admin/reports' : '/admin/queues'} className="text-sm font-semibold text-teal-800">
          {operations ? tx('All reports', 'সব রিপোর্ট') : restricted ? tx('Restricted queue', 'সীমিত সারি') : tx('Assigned queue', 'বরাদ্দকৃত সারি')}
        </Link>
        <h1 className="mt-3 font-display text-3xl">{restricted ? tx('Authorized report', 'অনুমোদিত রিপোর্ট') : tx('Report details', 'রিপোর্টের বিবরণ')}</h1>
        <div className="mt-3">
          <ReportStory report={report} internal />
        </div>
      </div>
      <div className="no-print space-y-3">
        {report.anonymous ? (
          <div className="rounded-2xl bg-plum/10 p-4 text-sm text-plum">
            {tx(
              'Anonymous. Staff see no name, email, or avatar. Status updates and information requests still reach the reporter’s own account. Replies appear as “Reporter”.',
              'বেনামি। কর্মকর্তারা নাম, ইমেইল বা ছবি দেখেন না। স্ট্যাটাস ও তথ্যের অনুরোধ রিপোর্টকারীর অ্যাকাউন্টে যায়। উত্তরে “Reporter” দেখায়।',
            )}
          </div>
        ) : null}
        {canReveal ? (
          <form
            className="panel space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void revealReporter(report.id, revealReason).then((result) => {
                if (typeof result === 'string') {
                  setRevealError(result)
                  setRevealed(null)
                  return
                }
                setRevealError(null)
                setRevealed(result)
                setRevealReason('')
              })
            }}
          >
            <h2 className="font-display text-2xl">{tx('Reveal reporter', 'রিপোর্টকারী দেখান')}</h2>
            <p className="text-sm text-ink/70">{tx('Harassment or safety emergency only. The reason is written to the audit log.', 'শুধু হয়রানি বা নিরাপত্তা জরুরি অবস্থায়। কারণ অডিট লগে লেখা হয়।')}</p>
            <Field label={tx('Reason', 'কারণ')}>
              <textarea className="input min-h-20" value={revealReason} onChange={(event) => setRevealReason(event.target.value)} />
            </Field>
            {revealError ? <p className="text-sm text-clay">{revealError}</p> : null}
            {revealed ? <p className="text-sm font-semibold">{revealed.name} · {revealed.email}</p> : null}
            <Button type="submit" variant="secondary" className="w-full">{tx('Reveal with audit', 'অডিটসহ দেখান')}</Button>
          </form>
        ) : null}

        {operations ? <AssignOffice report={report} /> : null}

        {transitions.length > 0 ? (
          <form className="panel space-y-3 p-4" onSubmit={(event) => {
            event.preventDefault()
            if (!status) return
            const photo: Photo | undefined = photoName ? { name: photoName } : undefined
            if (setStatus(report.id, status, note, photo)) {
              setNote('')
              setPhotoName('')
            }
          }}>
            <h2 className="font-display text-2xl">{restricted ? tx('Case update', 'কেস আপডেট') : tx('Update status', 'স্ট্যাটাস আপডেট')}</h2>
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
            <Button type="submit" className="w-full" disabled={!status}>{restricted ? tx('Save case update', 'কেস আপডেট সেভ') : tx('Update status', 'স্ট্যাটাস আপডেট')}</Button>
            {operations ? <Button variant="secondary" className="w-full" onClick={() => extendDue(report.id)}>{tx('Add 24 hours to the target', 'লক্ষ্যে ২৪ ঘণ্টা যোগ')}</Button> : null}
          </form>
        ) : (
          <div className="panel p-4 text-sm text-ink/70">
            {waiting
              ? tx('This case is waiting for the operations desk to assign an office. You can still leave an internal note.', 'এই কেস অপারেশন ডেস্কের বরাদ্দের অপেক্ষায়। অভ্যন্তরীণ নোট রাখা যাবে।')
              : tx('No status change is available on this case.', 'এই কেসে স্ট্যাটাস বদলানোর সুযোগ নেই।')}
          </div>
        )}

        {operations ? (
          <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); requestInfo(report.id, reply); setReply('') }}>
            <h2 className="font-display text-2xl">{tx('Ask the reporter', 'রিপোর্টকারীকে জিজ্ঞাসা')}</h2>
            <textarea className="input min-h-20" value={reply} onChange={(event) => setReply(event.target.value)} />
            <Button type="submit" variant="secondary" className="w-full">{tx('Request information', 'তথ্য চান')}</Button>
          </form>
        ) : null}
        <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); addComment(report.id, internal, 'internal'); setInternal('') }}>
          <h2 className="font-display text-2xl">{tx('Internal note', 'অভ্যন্তরীণ নোট')}</h2>
          <textarea className="input min-h-20" value={internal} onChange={(event) => setInternal(event.target.value)} />
          <Button type="submit" variant="quiet" className="w-full">{tx('Save note', 'নোট সেভ')}</Button>
        </form>
      </div>
    </div>
  )
}
