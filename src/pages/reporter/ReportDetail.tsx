import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ReportStory } from '../../components/ReportStory'
import { Button, Field, useTitle } from '../../components/ui'
import { canView, isPublicFeed } from '../../logic'
import { useApp } from '../../store'

export function ReportDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { currentUser, state, tx, toast, addComment, rate, reopen, confirm } = useApp()
  const report = state.reports.find((item) => item.id === id)
  const allowed = currentUser && report ? canView(currentUser, report, state.reportIdentities) : false
  const [reply, setReply] = useState('')
  const [stars, setStars] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [reason, setReason] = useState('')
  useTitle(report?.id ?? tx('Report', 'রিপোর্ট'))
  const just = Boolean((location.state as { submitted?: boolean } | null)?.submitted)

  if (!report || !allowed || !currentUser) {
    return <p className="text-sm">{tx('That report is not available on this account.', 'এই অ্যাকাউন্টে রিপোর্টটি নেই।')}</p>
  }

  const owner = report.reporterId === currentUser.id || state.reportIdentities[report.id] === currentUser.id
  const canRate = owner && (report.status === 'resolved' || report.status === 'closed') && !report.rating
  const canReopen = owner && (report.status === 'resolved' || report.status === 'closed')
  const publicFeed = isPublicFeed(report)

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {just ? <div className="rounded-2xl border border-moss/30 bg-moss/10 p-4 text-sm font-medium">{tx(`Received ${report.id}. Save this ID. The desk will assign a department after review.`, `${report.id} গৃহীত হয়েছে। এই আইডি রাখুন। পর্যালোচনার পর ডেস্ক একটি বিভাগ বরাদ্দ করবে।`)}</div> : null}
        {report.status === 'draft' ? <Link to={`/app/report/new?draft=${report.id}`} className="text-sm font-semibold text-teal-800">{tx('Continue this draft', 'এই খসড়া চালিয়ে যান')}</Link> : null}
        {report.infoRequested && owner ? <div className="rounded-2xl bg-amber-100 p-4 text-sm">{tx('The office asked for more information. Reply below.', 'দপ্তর আরও তথ্য চেয়েছে। নিচে উত্তর দিন।')}</div> : null}
        <ReportStory report={report} internal={false} />
      </div>
      <aside className="no-print space-y-3">
        <div className="panel space-y-2 p-4">
          <Button variant="secondary" className="w-full" onClick={() => { void navigator.clipboard.writeText(report.id).then(() => toast(tx('Report ID copied.', 'রিপোর্ট আইডি কপি হয়েছে।'))).catch(() => toast(report.id)) }}>{tx('Copy report ID', 'রিপোর্ট আইডি কপি')}</Button>
          <Button variant="ghost" className="w-full" onClick={() => window.print()}>{tx('Print', 'প্রিন্ট')}</Button>
        </div>
        {publicFeed && !owner ? (
          <div className="panel p-4">
            <p className="text-sm">{tx(`${report.confirmations.length} people have the same problem.`, `${report.confirmations.length} জনের একই সমস্যা।`)}</p>
            <Button className="mt-3 w-full" disabled={report.confirmations.includes(currentUser.id)} onClick={() => confirm(report.id)}>
              {report.confirmations.includes(currentUser.id) ? tx('You are counted', 'আপনাকে ধরা হয়েছে') : tx('I see this too', 'আমিও দেখছি')}
            </Button>
          </div>
        ) : null}
        {owner && report.status !== 'draft' ? (
          <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); addComment(report.id, reply, 'public'); setReply('') }}>
            <Field label={tx('Reply', 'উত্তর')}>
              <textarea className="input min-h-24" value={reply} onChange={(event) => setReply(event.target.value)} />
            </Field>
            <Button type="submit" className="w-full">{tx('Send reply', 'উত্তর পাঠান')}</Button>
          </form>
        ) : null}
        {canRate ? (
          <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); rate(report.id, stars, feedback) }}>
            <Field label={tx('How did the office do?', 'দপ্তর কেমন কাজ করেছে?')}>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setStars(value)} className={`h-9 w-9 rounded-full ${stars === value ? 'bg-teal-800 text-white' : 'bg-white'}`}>{value}</button>
                ))}
              </div>
            </Field>
            <textarea className="input min-h-20" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder={tx('Optional note', 'ঐচ্ছিক নোট')} />
            <Button type="submit" className="w-full">{tx('Save rating', 'রেটিং সেভ')}</Button>
          </form>
        ) : null}
        {canReopen ? (
          <form className="panel space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); reopen(report.id, reason); setReason('') }}>
            <Field label={tx('Ask to reopen', 'আবার খুলতে বলুন')}>
              <textarea className="input min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" className="w-full">{tx('Reopen', 'আবার খুলুন')}</Button>
          </form>
        ) : null}
      </aside>
    </div>
  )
}
