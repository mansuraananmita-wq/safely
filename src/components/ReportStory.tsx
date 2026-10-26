import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { GooglePlaceMap } from './GooglePlaceMap'
import { PLACES, reportPoint, subcategoryLabel } from '../data'
import { dueLabel, identityMode, isOverdue, isReportOwner, priorityLabel, roleLabel, staffVisibleReporterId } from '../logic'
import { useApp } from '../store'
import type { Report, ReportMedia } from '../types'
import { StatusProgress } from './StatusProgress'
import { Timeline } from './Timeline'
import { StatusPill } from './ui'

export function ReportStory({ report, internal }: { report: Report; internal: boolean }) {
  const { currentUser, state, lang, tx } = useApp()
  const category = state.categories.find((item) => item.id === report.category)
  const sub = subcategoryLabel(report.category, report.subcategory, lang)
  const place = PLACES.find((item) => item.id === report.locationId)
  const department = state.departments.find((item) => item.id === report.departmentId)
  const visibleReporterId = staffVisibleReporterId(report)
  const owner = visibleReporterId ? state.users.find((item) => item.id === visibleReporterId) : undefined
  const mode = currentUser ? identityMode(currentUser, report, state.reportIdentities) : 'restricted'
  const due = dueLabel(report, lang)
  const overdue = isOverdue(report)
  const showPrivate = Boolean(currentUser && (internal || isReportOwner(currentUser, report, state.reportIdentities)))
  const point = reportPoint(report)
  const exact = Boolean(
    point &&
      place &&
      report.lat != null &&
      report.lng != null &&
      (Math.abs(report.lat - place.lat) > 0.0002 || Math.abs(report.lng - place.lng) > 0.0002),
  )

  let who = tx('Reporter', 'রিপোর্টকারী')
  if (mode === 'anonymous') who = tx('Anonymous', 'বেনামি')
  else if (mode === 'self-anonymous') who = tx('You · name hidden from officers', 'আপনি · নাম কর্মকর্তাদের কাছে গোপন')
  else if (mode === 'restricted') who = tx('Restricted', 'সীমিত')
  else if (mode === 'role-only') who = owner ? roleLabel(owner.role, lang) : tx('Campus member', 'ক্যাম্পাস সদস্য')
  else if (owner) who = owner.name

  return (
    <article className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-dusk">{report.id}</span>
          <StatusPill status={report.status} />
          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold">{priorityLabel(report.priority, lang)}</span>
          {due ? <span className={overdue ? 'text-sm font-semibold text-clay' : 'text-sm text-ink/60'}>{due}</span> : null}
        </div>
        <h1 className="mt-3 font-display text-4xl leading-tight">{report.title}</h1>
        <p className="mt-3 text-sm text-ink/70">
          {lang === 'bn' ? category?.bn : category?.en}
          {sub ? ` · ${sub}` : ''}
          {place ? ` · ${lang === 'bn' ? place.bn : place.en}` : ''}
          {report.locationDetail ? ` · ${report.locationDetail}` : ''}
        </p>
      </div>

      {report.confidential ? (
        <div className="flex gap-3 rounded-2xl bg-plum/10 p-4 text-sm text-plum">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {tx(
              'Restricted report. The story stays with campus security, student affairs, and the operations desk.',
              'সীমিত রিপোর্ট। বিবরণ শুধু ক্যাম্পাস নিরাপত্তা, শিক্ষার্থী বিষয়ক দপ্তর এবং অপারেশন ডেস্ক দেখতে পায়।',
            )}
          </p>
        </div>
      ) : null}

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{report.description}</p>

      {report.blocksAccess ? <p className="text-sm font-medium text-clay">{tx('The reporter says this blocks a class, dorm, or route.', 'রিপোর্টকারী বলেছেন এতে ক্লাস, হল বা পথ আটকে আছে।')}</p> : null}
      {point ? (
        <GooglePlaceMap
          lat={point.lat}
          lng={point.lng}
          label={place ? (lang === 'bn' ? place.bn : place.en) : report.id}
          note={
            exact
              ? tx('The reporter shared this device location.', 'রিপোর্টকারী এই ডিভাইসের লোকেশন দিয়েছেন।')
              : report.locationDetail || tx('Building pin on Google Maps.', 'গুগল ম্যাপে ভবনের পিন।')
          }
        />
      ) : null}

      <dl className="grid grid-cols-3 gap-2">
        <div className="panel p-3">
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Reporter', 'রিপোর্টকারী')}</dt>
          <dd className="mt-1 text-sm font-medium leading-snug">{who}</dd>
        </div>
        <div className="panel p-3">
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Office', 'দপ্তর')}</dt>
          <dd className="mt-1 text-sm font-medium leading-snug">{department ? (lang === 'bn' ? department.bn : department.en) : tx('Not assigned yet', 'এখনও বরাদ্দ হয়নি')}</dd>
        </div>
        <div className="panel p-3">
          <dt className="text-[11px] uppercase tracking-wide text-ink/45">{tx('Assignee', 'দায়িত্বে')}</dt>
          <dd className="mt-1 text-sm font-medium leading-snug">{report.assignee || tx('Waiting', 'অপেক্ষায়')}</dd>
        </div>
      </dl>
      {showPrivate && report.contactWindow ? <p className="text-sm">{tx('Best time to talk:', 'কথা বলার সময়:')} {report.contactWindow}</p> : null}

      {report.photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {report.photos.map((photo) =>
            photo.url ? (
              <img key={photo.name} src={photo.url} alt={photo.name} className="h-32 w-full rounded-xl object-cover" />
            ) : (
              <div key={photo.name} className="flex h-32 items-end rounded-xl bg-frost p-3 text-xs font-medium text-dusk ring-1 ring-haze/70">
                {photo.name}
              </div>
            ),
          )}
        </div>
      ) : null}

      {report.voiceNote ? <ClipPlayer kind="voice" media={report.voiceNote} label={tx('Voice note', 'ভয়েস নোট')} /> : null}
      {report.video ? <ClipPlayer kind="video" media={report.video} label={tx('Video', 'ভিডিও')} /> : null}

      {report.rejectReason ? (
        <div className="rounded-2xl bg-clay/10 p-4 text-sm">
          <p className="font-semibold text-clay">{tx('Why it was rejected', 'কেন প্রত্যাখ্যান')}</p>
          <p className="mt-1">{report.rejectReason}</p>
        </div>
      ) : null}

      {report.resolutionNote ? (
        <div className="rounded-2xl bg-moss/10 p-4 text-sm">
          <p className="font-semibold text-moss">{tx('Resolution', 'সমাধান')}</p>
          <p className="mt-1">{report.resolutionNote}</p>
          {report.resolutionPhoto ? <p className="mt-2 text-xs">{tx('After photo:', 'পরের ছবি:')} {report.resolutionPhoto.name}</p> : null}
        </div>
      ) : null}

      {report.rating ? (
        <p className="text-sm">
          {tx('Reporter rating', 'রিপোর্টকারীর রেটিং')}: {report.rating}/5
          {report.feedback ? ` — ${report.feedback}` : ''}
        </p>
      ) : null}

      <StatusProgress report={report} office={department ? (lang === 'bn' ? department.bn : department.en) : undefined} />

      <section>
        <h2 className="mb-3 font-display text-2xl">{tx('Updates', 'আপডেট')}</h2>
        <Timeline report={report} includeInternal={internal} />
      </section>
    </article>
  )
}

function ClipPlayer({ kind, media, label }: { kind: 'voice' | 'video'; media: ReportMedia; label: string }) {
  const [src, setSrc] = useState(media.url ?? '')
  useEffect(() => {
    if (media.url || !media.path || !supabase) return
    let alive = true
    void supabase.storage.from('report-media').createSignedUrl(media.path, 600).then(({ data }) => {
      if (alive && data?.signedUrl) setSrc(data.signedUrl)
    })
    return () => {
      alive = false
    }
  }, [media.path, media.url])
  if (!src) return <p className="text-sm text-ink/60">{label}</p>
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label} · {media.seconds}s</p>
      {kind === 'voice' ? <audio controls src={src} className="w-full" /> : <video controls src={src} className="max-h-80 w-full rounded-xl bg-black" />}
    </div>
  )
}
