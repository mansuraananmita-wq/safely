import { formatWhen } from '../logic'
import { useApp } from '../store'
import type { Report, Status } from '../types'

const PATH = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed'] as const
type StepId = (typeof PATH)[number]
type Phase = 'done' | 'now' | 'later' | 'stopped'

const TITLES: Record<StepId, [string, string]> = {
  submitted: ['Report submitted', 'রিপোর্ট জমা হয়েছে'],
  under_review: ['Under review', 'পর্যালোচনাধীন'],
  assigned: ['Assigned to office', 'দপ্তরে বরাদ্দ'],
  in_progress: ['In progress', 'কাজ চলছে'],
  resolved: ['Resolved', 'সমাধান হয়েছে'],
  closed: ['Closed', 'বন্ধ'],
}

function phases(status: Status): Phase[] {
  if (status === 'draft') return PATH.map(() => 'later')
  if (status === 'rejected') return ['done', 'stopped', 'later', 'later', 'later', 'later']
  if (status === 'reopened') return ['done', 'done', 'done', 'done', 'now', 'later']
  const index = PATH.indexOf(status as StepId)
  if (index < 0) return PATH.map(() => 'later')
  return PATH.map((_, step) => (step < index ? 'done' : step === index ? 'now' : 'later'))
}

function activityTime(report: Report, test: (message: string) => boolean): number | undefined {
  const hit = report.activities.find((item) => test(item.message.toLowerCase()))
  return hit ? new Date(hit.at).getTime() : undefined
}

function stepMoments(report: Report, phase: Phase[]): { at?: string; sample: boolean }[] {
  const created = new Date(report.createdAt).getTime()
  const updated = new Date(report.updatedAt).getTime()
  const known: ({ t: number; sample: boolean } | undefined)[] = PATH.map(() => undefined)
  known[0] = { t: created, sample: false }

  const assigned = activityTime(report, (message) => message.includes('assigned'))
  const progress = activityTime(report, (message) => message.includes('in progress'))
  const resolved = report.resolvedAt
    ? new Date(report.resolvedAt).getTime()
    : activityTime(report, (message) => message.includes('resolved'))
  const closed = report.closedAt
    ? new Date(report.closedAt).getTime()
    : activityTime(report, (message) => message.includes('closed'))
  const rejected = activityTime(report, (message) => message.includes('rejected'))

  if (assigned) known[2] = { t: assigned, sample: false }
  if (progress) known[3] = { t: progress, sample: false }
  if (resolved) known[4] = { t: resolved, sample: false }
  if (closed) known[5] = { t: closed, sample: false }
  if (report.status === 'under_review') known[1] = { t: updated, sample: false }
  if (report.status === 'assigned' && !known[2]) known[2] = { t: updated, sample: false }
  if (report.status === 'in_progress' && !known[3]) known[3] = { t: updated, sample: false }
  if (report.status === 'rejected') known[1] = { t: rejected ?? updated, sample: rejected == null }
  if (report.status === 'reopened' && !known[4]) known[4] = { t: updated, sample: false }

  let last = -1
  phase.forEach((item, index) => {
    if (item !== 'later') last = index
  })

  const end = Math.max(updated, ...known.map((item) => item?.t ?? 0))
  for (let index = 1; index <= last; index += 1) {
    if (known[index]) continue
    let prev = index - 1
    while (prev > 0 && !known[prev]) prev -= 1
    let next = index + 1
    while (next <= last && !known[next]) next += 1
    const prevTime = known[prev]?.t ?? created
    const nextTime = next <= last && known[next] ? known[next]!.t : end
    const nextIndex = next <= last && known[next] ? next : Math.max(last, index)
    const gap = Math.max(1, nextIndex - prev)
    known[index] = { t: prevTime + ((nextTime - prevTime) * (index - prev)) / gap, sample: true }
  }

  return known.map((item, index) =>
    index <= last && item ? { at: new Date(item.t).toISOString(), sample: item.sample } : { sample: false },
  )
}

export function StatusProgress({ report, office }: { report: Report; office?: string }) {
  const { lang, tx } = useApp()
  const phase = phases(report.status)
  const moments = stepMoments(report, phase)
  const hasSample = moments.some((item) => item.sample)
  const person = report.assignee || office || tx('The office', 'দপ্তর')
  const place = office || tx('an office', 'একটি দপ্তর')

  const detail = (id: StepId, step: Phase): { description: string; next: string } => {
    if (id === 'submitted') {
      return {
        description:
          step === 'later'
            ? tx('You send the report and keep the ID.', 'আপনি রিপোর্ট পাঠান এবং আইডি রেখে দেন।')
            : tx('Safely has this report.', 'সেইফলি এই রিপোর্ট পেয়েছে।'),
        next: tx('An officer opens it for review.', 'একজন কর্মকর্তা এটি পর্যালোচনার জন্য খুলবেন।'),
      }
    }
    if (id === 'under_review') {
      if (step === 'stopped') {
        return {
          description: report.rejectReason || tx('The desk stopped this report.', 'ডেস্ক এই রিপোর্ট থামিয়েছে।'),
          next: tx('No office is assigned unless you send a new report.', 'নতুন রিপোর্ট না দিলে কোনো দপ্তর বরাদ্দ হয় না।'),
        }
      }
      return {
        description:
          step === 'later'
            ? tx('An officer checks the report before choosing an office.', 'দপ্তর বেছে নেওয়ার আগে একজন কর্মকর্তা রিপোর্ট দেখেন।')
            : step === 'now'
              ? tx('An officer is reading the report and the place.', 'একজন কর্মকর্তা রিপোর্ট ও জায়গাটি পড়ছেন।')
              : tx('An officer read the report.', 'একজন কর্মকর্তা রিপোর্ট পড়েছেন।'),
        next: tx('They name an office, or ask you for a missing detail.', 'তাঁরা একটি দপ্তর বেছে নেবেন, অথবা বাদ পড়া তথ্য চাইবেন।'),
      }
    }
    if (id === 'assigned') {
      return {
        description:
          step === 'later'
            ? tx('The desk names the office that will do the work.', 'ডেস্ক কাজের দপ্তরের নাম দেয়।')
            : tx(`Sent to ${place}.`, `${place}-এ পাঠানো হয়েছে।`),
        next: tx('That office starts the visit or the repair.', 'সেই দপ্তর পরিদর্শন বা মেরামত শুরু করে।'),
      }
    }
    if (id === 'in_progress') {
      return {
        description:
          step === 'later'
            ? tx('The office starts the work.', 'দপ্তর কাজ শুরু করে।')
            : tx(`${person} is working on it.`, `${person} কাজ করছেন।`),
        next: tx('They mark it resolved when the problem is fixed.', 'সমস্যা ঠিক হলে তাঁরা সমাধান চিহ্নিত করেন।'),
      }
    }
    if (id === 'resolved') {
      return {
        description:
          report.status === 'reopened'
            ? tx('It was marked fixed, then opened again.', 'সমাধান চিহ্নিত হয়েছিল, তারপর আবার খোলা হয়েছে।')
            : step === 'later'
              ? tx('The office records how it was fixed.', 'দপ্তর কীভাবে ঠিক করা হয়েছে তা লেখে।')
              : report.resolutionNote || tx('The office says the problem is fixed.', 'দপ্তর বলেছে সমস্যাটি ঠিক হয়েছে।'),
        next:
          report.status === 'reopened'
            ? tx('The office looks at it again.', 'দপ্তর আবার এটি দেখছে।')
            : tx('You can rate the work. The desk then closes the report.', 'আপনি কাজের রেটিং দিতে পারেন। তারপর ডেস্ক রিপোর্ট বন্ধ করে।'),
      }
    }
    return {
      description:
        step === 'later'
          ? tx('The desk closes it after the fix holds.', 'সমাধান টিকে থাকলে ডেস্ক এটি বন্ধ করে।')
          : tx('This report is finished.', 'এই রিপোর্ট শেষ।'),
      next: tx('Keep the ID. Ask to reopen if the problem comes back.', 'আইডি রাখুন। সমস্যা ফিরে এলে আবার খুলতে বলুন।'),
    }
  }

  return (
    <section>
      <h2 className="font-display text-2xl">{tx('Progress', 'অগ্রগতি')}</h2>
      <p className="mt-1 text-sm text-ink/60">
        {tx(
          'Six steps from submit to close. Each one shows when it happened, what it means, and what comes next.',
          'জমা থেকে বন্ধ পর্যন্ত ছয় ধাপ। প্রতিটিতে কখন হয়েছে, কী বোঝায়, এবং এরপর কী হবে।',
        )}
      </p>
      {report.status === 'draft' ? (
        <p className="mt-2 text-sm">{tx('Submit the draft to start this path.', 'খসড়া জমা দিলে এই পথ শুরু হয়।')}</p>
      ) : null}
      {report.status === 'reopened' ? (
        <p className="mt-2 text-sm font-medium text-plum">{tx('Reopened. The earlier fix did not hold.', 'আবার খোলা হয়েছে। আগের সমাধান টিকেনি।')}</p>
      ) : null}
      <ol className="mt-4 space-y-3">
        {PATH.map((id, index) => {
          const step = phase[index]
          const moment = moments[index]
          const copy = detail(id, step)
          const title = lang === 'bn' ? TITLES[id][1] : TITLES[id][0]
          const reached = step !== 'later'
          return (
            <li key={id} className={step === 'now' || step === 'stopped' ? 'rounded-2xl bg-white p-4 ring-1 ring-line' : 'px-4 py-2'}>
              <div className="flex items-start gap-3">
                <span
                  className={
                    step === 'done'
                      ? 'mt-1 h-3 w-3 shrink-0 rounded-full bg-teal-800'
                      : step === 'now'
                        ? 'mt-1 h-3 w-3 shrink-0 rounded-full bg-teal-700 ring-4 ring-teal-100'
                        : step === 'stopped'
                          ? 'mt-1 h-3 w-3 shrink-0 rounded-full bg-clay'
                          : 'mt-1 h-3 w-3 shrink-0 rounded-full bg-line'
                  }
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-semibold ${reached ? '' : 'text-ink/45'}`}>{title}</p>
                    {step === 'now' ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-900">{tx('Now', 'এখন')}</span> : null}
                    {step === 'stopped' ? <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs font-semibold text-clay">{tx('Stopped', 'থামানো')}</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink/55">
                    {moment?.at ? formatWhen(moment.at, lang) : tx('Not yet', 'এখনও হয়নি')}
                    {moment?.sample ? ` · ${tx('sample time', 'নমুনা সময়')}` : ''}
                  </p>
                  <p className={`mt-2 text-sm ${reached ? 'text-ink/80' : 'text-ink/45'}`}>{copy.description}</p>
                  <p className={`mt-1 text-sm ${reached ? 'text-ink/70' : 'text-ink/45'}`}>
                    <span className="font-semibold">{tx('Next', 'পরবর্তী')}: </span>
                    {copy.next}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {hasSample ? (
        <p className="mt-3 text-xs text-ink/50">
          {tx(
            'A sample time fills a step this preview does not have a saved date for. Submitted, resolved, and closed dates stay as recorded.',
            'যে ধাপে সেভ করা তারিখ নেই, সেখানে নমুনা সময় দেখানো হয়েছে। জমা, সমাধান, এবং বন্ধের তারিখ যেমন আছে তেমনই থাকে।',
          )}
        </p>
      ) : null}
    </section>
  )
}
