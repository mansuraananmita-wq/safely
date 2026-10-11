import { Link } from 'react-router-dom'
import { Bars, Logo, buttonClass, useTitle } from '../components/ui'
import { PLACES } from '../data'
import { average, firstResponseHours, hoursBetween, isOpen, isPublicFeed } from '../logic'
import { useApp } from '../store'

export default function PublicStatus() {
  const { tx, lang, state } = useApp()
  useTitle(tx('Public figures', 'প্রকাশ্য হিসাব'))
  const visible = state.reports.filter((report) => isPublicFeed(report) && report.category !== 'safety')
  const open = visible.filter((report) => isOpen(report.status))
  const month = new Date()
  const resolvedMonth = visible.filter((report) => {
    if (!report.resolvedAt) return false
    const date = new Date(report.resolvedAt)
    return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
  })
  const resolution = visible.filter((report) => report.resolvedAt).map((report) => hoursBetween(report.createdAt, report.resolvedAt!))
  const response = visible.map((report) => firstResponseHours(report)).filter((value): value is number => value !== null)
  const byCategory = state.categories
    .filter((category) => category.id !== 'harassment' && category.id !== 'safety')
    .map((category) => ({ label: lang === 'bn' ? category.bn : category.en, value: visible.filter((report) => report.category === category.id && isOpen(report.status)).length }))
    .filter((row) => row.value > 0)
  const places = PLACES.map((place) => ({ label: lang === 'bn' ? place.bn : place.en, value: open.filter((report) => report.locationId === place.id).length }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/"><Logo /></Link>
        <Link to="/login" className={buttonClass('primary')}>{tx('Sign in', 'সাইন ইন')}</Link>
      </header>
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">{tx('Public desk', 'প্রকাশ্য ডেস্ক')}</p>
      <h1 className="mt-2 max-w-2xl font-display text-5xl leading-tight">{tx('What the campus can see.', 'ক্যাম্পাস যা দেখতে পায়।')}</h1>
      <p className="mt-4 max-w-2xl text-ink/70">
        {tx(
          'Harassment, confidential, anonymous, and safety reports are left out. The figures come from the campus database when Supabase is connected, and from this browser otherwise.',
          'হয়রানি, গোপন, বেনামি, এবং নিরাপত্তার রিপোর্ট বাদ দেওয়া হয়েছে। Supabase যুক্ত থাকলে হিসাব ক্যাম্পাস ডেটাবেস থেকে আসে, না থাকলে এই ব্রাউজার থেকে।',
        )}
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="panel p-4"><p className="text-xs uppercase tracking-wide text-ink/45">{tx('Open', 'খোলা')}</p><p className="mt-2 font-display text-4xl">{open.length}</p></article>
        <article className="panel p-4"><p className="text-xs uppercase tracking-wide text-ink/45">{tx('Resolved this month', 'এই মাসে সমাধান')}</p><p className="mt-2 font-display text-4xl">{resolvedMonth.length}</p></article>
        <article className="panel p-4"><p className="text-xs uppercase tracking-wide text-ink/45">{tx('Avg. first reply', 'গড় প্রথম উত্তর')}</p><p className="mt-2 font-display text-4xl">{response.length ? `${average(response).toFixed(0)}h` : '—'}</p></article>
        <article className="panel p-4"><p className="text-xs uppercase tracking-wide text-ink/45">{tx('Avg. resolution', 'গড় সমাধান')}</p><p className="mt-2 font-display text-4xl">{resolution.length ? `${(average(resolution) / 24).toFixed(1)}d` : '—'}</p></article>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('Open by category', 'বিভাগ অনুযায়ী খোলা')}</h2>
          <div className="mt-4"><Bars rows={byCategory} /></div>
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-2xl">{tx('Places with open reports', 'যেখানে খোলা রিপোর্ট আছে')}</h2>
          <div className="mt-4"><Bars rows={places} /></div>
        </section>
      </div>
    </div>
  )
}
