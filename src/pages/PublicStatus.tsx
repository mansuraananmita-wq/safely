import { useEffect, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { Bars, useTitle } from '../components/ui'
import { barRank, loadPublicStatus, localizeCountLabel, statusRowLabel, type PublicStatusSnapshot } from '../lib/publicStatus'
import { useApp } from '../store'

export default function PublicStatus() {
  const { tx, lang, state } = useApp()
  useTitle(tx('Public figures', 'প্রকাশ্য হিসাব'))
  const [snapshot, setSnapshot] = useState<PublicStatusSnapshot | null>(null)

  useEffect(() => {
    let alive = true
    void loadPublicStatus({
      reports: state.reports,
      categories: state.categories,
      departments: state.departments,
    }).then((next) => {
      if (alive) setSnapshot(next)
    })
    return () => {
      alive = false
    }
  }, [state.reports, state.categories, state.departments])

  const summary = snapshot?.summary
  const categories = (snapshot?.categories ?? [])
    .filter((row) => row.openLabel !== '0' || row.resolvedLabel !== '0')
    .sort((a, b) => barRank(b.openLabel, b.openCount) - barRank(a.openLabel, a.openCount))
  const offices = (snapshot?.offices ?? [])
    .filter((row) => row.openLabel !== '0' || row.resolvedLabel !== '0')
    .sort((a, b) => barRank(b.openLabel, b.openCount) - barRank(a.openLabel, a.openCount))

  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-slate">{tx('Public desk', 'প্রকাশ্য ডেস্ক')}</p>
      <h1 className="mt-2 max-w-2xl font-display text-5xl leading-tight">{tx('What the campus can see.', 'ক্যাম্পাস যা দেখতে পায়।')}</h1>
      <p className="mt-4 max-w-2xl text-ink/70">
        {tx(
          'Harassment, confidential, anonymous, and safety reports are left out. Counts under 5 show as “fewer than 5”. Average resolution uses the last 30 days. Figures come from a database view when Supabase is connected.',
          'হয়রানি, গোপন, বেনামি, এবং নিরাপত্তার রিপোর্ট বাদ। ৫-এর কম সংখ্যা “fewer than 5” হিসেবে দেখায়। গড় সমাধান শেষ ৩০ দিনের। Supabase যুক্ত থাকলে হিসাব ডেটাবেস ভিউ থেকে আসে।',
        )}
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-ink/45">{tx('Open', 'খোলা')}</p>
          <p className="mt-2 font-display text-4xl">{summary ? localizeCountLabel(summary.openLabel, lang) : '—'}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-ink/45">{tx('Resolved (30 days)', 'সমাধান (৩০ দিন)')}</p>
          <p className="mt-2 font-display text-4xl">{summary ? localizeCountLabel(summary.resolved30dLabel, lang) : '—'}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-ink/45">{tx('Resolved (all)', 'সমাধান (সব)')}</p>
          <p className="mt-2 font-display text-4xl">{summary ? localizeCountLabel(summary.resolvedLabel, lang) : '—'}</p>
        </article>
        <article className="panel p-4">
          <p className="text-xs uppercase tracking-wide text-ink/45">{tx('Avg. resolution (30 days)', 'গড় সমাধান (৩০ দিন)')}</p>
          <p className="mt-2 font-display text-4xl">{summary?.avgResolutionDays30d != null ? `${summary.avgResolutionDays30d}d` : '—'}</p>
        </article>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('By category', 'বিভাগ অনুযায়ী')}</h2>
          <p className="mt-1 text-sm text-ink/60">{tx('Open and resolved counts. Bars follow open volume.', 'খোলা ও সমাধান সংখ্যা। বার খোলার পরিমাণ অনুসরণ করে।')}</p>
          <div className="mt-4">
            <Bars
              rows={categories.map((row) => ({
                label: statusRowLabel(row, lang),
                display: tx(
                  `Open ${localizeCountLabel(row.openLabel, 'en')} · Resolved ${localizeCountLabel(row.resolvedLabel, 'en')}${row.avgResolutionDays30d != null ? ` · Avg ${row.avgResolutionDays30d}d` : ''}`,
                  `খোলা ${localizeCountLabel(row.openLabel, 'bn')} · সমাধান ${localizeCountLabel(row.resolvedLabel, 'bn')}${row.avgResolutionDays30d != null ? ` · গড় ${row.avgResolutionDays30d} দিন` : ''}`,
                ),
                value: barRank(row.openLabel, row.openCount),
              }))}
            />
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('By office', 'দপ্তর অনুযায়ী')}</h2>
          <p className="mt-1 text-sm text-ink/60">{tx('Ordinary offices only. Sensitive desks stay off this page.', 'শুধু সাধারণ দপ্তর। সংবেদনশীল ডেস্ক এই পাতায় নেই।')}</p>
          <div className="mt-4">
            <Bars
              rows={offices.map((row) => ({
                label: statusRowLabel(row, lang),
                display: tx(
                  `Open ${localizeCountLabel(row.openLabel, 'en')} · Resolved ${localizeCountLabel(row.resolvedLabel, 'en')}${row.avgResolutionDays30d != null ? ` · Avg ${row.avgResolutionDays30d}d` : ''}`,
                  `খোলা ${localizeCountLabel(row.openLabel, 'bn')} · সমাধান ${localizeCountLabel(row.resolvedLabel, 'bn')}${row.avgResolutionDays30d != null ? ` · গড় ${row.avgResolutionDays30d} দিন` : ''}`,
                ),
                value: barRank(row.openLabel, row.openCount),
              }))}
            />
          </div>
        </section>
      </div>
      {snapshot?.source === 'preview' ? (
        <p className="mt-4 text-xs text-ink/50">{tx('Preview mode: local sample data with the same count rules.', 'প্রিভিউ: একই গণনার নিয়মে স্থানীয় নমুনা ডেটা।')}</p>
      ) : null}
      </div>
    </div>
  )
}
