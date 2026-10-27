import type { ReactNode } from 'react'
import { ArrowRight, Lock, ThumbsUp, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryIcon } from '../categoryUi'
import type { LucideIcon } from 'lucide-react'
import { SiteHeader } from '../components/SiteHeader'
import { Logo, StatusPill, buttonClass, cx, useTitle } from '../components/ui'
import { homePath, isMember, isPublicFeed, statusLabel } from '../logic'
import { useApp } from '../store'
import type { Status } from '../types'

const flow: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed']

function ReportLink({ category, className, children }: { category?: string; className?: string; children: ReactNode }) {
  const { currentUser } = useApp()
  const path = category ? `/app/report/new?category=${category}` : '/app/report/new'
  if (currentUser && isMember(currentUser.role)) return <Link to={path} className={className}>{children}</Link>
  if (currentUser) return <Link to={homePath(currentUser.role)} className={className}>{children}</Link>
  return <Link to="/login" state={{ from: path }} className={className}>{children}</Link>
}

export default function Landing() {
  const { tx, lang, state, remote } = useApp()
  useTitle(tx('Campus desk', 'ক্যাম্পাস ডেস্ক'))
  const publicCases = state.reports.filter((report) => isPublicFeed(report) && report.status !== 'draft').slice(0, 3)
  return (
    <div>
      <SiteHeader />

      <main>
        <section className="border-b border-haze/70 bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
            <div>
              <p className="text-sm text-slate">{tx('Padma University', 'পদ্মা বিশ্ববিদ্যালয়')}</p>
              <h1 className="mt-2 max-w-xl text-4xl font-semibold leading-tight tracking-tight text-night sm:text-[2.75rem]">
                {tx('Report a campus problem and follow the office that takes it.', 'ক্যাম্পাসের সমস্যা জানান, যে দপ্তর নেয় সেটি অনুসরণ করুন।')}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-steel">
                {tx(
                  'Students, teachers, and staff file one report. The right office gets the work, you keep the report ID, and sensitive cases stay with a smaller desk.',
                  'শিক্ষার্থী, শিক্ষক ও কর্মকর্তারা একটি রিপোর্ট দেন। সঠিক দপ্তর কাজ পায়, রিপোর্ট আইডি আপনার কাছে থাকে, আর সংবেদনশীল ঘটনা ছোট একটি ডেস্কে থাকে।',
                )}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <ReportLink className={buttonClass('primary', 'rounded-md')}>
                  {tx('File a report', 'রিপোর্ট দিন')}
                  <ArrowRight className="h-4 w-4" />
                </ReportLink>
                <Link to="/login" className="text-sm font-semibold text-dusk hover:underline">{tx('Sign in to your account', 'অ্যাকাউন্টে সাইন ইন')}</Link>
              </div>
              <p className="mt-5 max-w-md text-sm text-slate">
                {tx(
                  'Nothing is sent on its own. If someone is in danger, call 999. Safely is the follow-up desk, not rescue.',
                  'কিছুই নিজে থেকে যায় না। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন। সেইফলি ফলো-আপ ডেস্ক, উদ্ধারকারী দল নয়।',
                )}
              </p>
            </div>
            <aside className="overflow-hidden rounded-lg border border-haze bg-white">
              <div className="flex items-center justify-between border-b border-haze px-4 py-3">
                <h2 className="text-sm font-semibold text-night">{tx('Open public cases', 'খোলা প্রকাশ্য কেস')}</h2>
                <Link to="/status" className="text-xs font-semibold text-dusk hover:underline">{tx('All figures', 'সব হিসাব')}</Link>
              </div>
              <ul className="divide-y divide-haze/70">
                {publicCases.map((report) => (
                  <li key={report.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate">{report.id}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-night">{report.title}</p>
                      </div>
                      <StatusPill status={report.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="border-b border-haze/70 bg-frost/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <p className="text-steel">{tx('If someone is in danger, call 999. Safely does not replace campus security or emergency services.', 'কেউ বিপদে থাকলে ৯৯৯-এ কল করুন। সেইফলি ক্যাম্পাস নিরাপত্তা বা জরুরি সেবার বিকল্প নয়।')}</p>
            <a href="tel:999" className="font-semibold text-clay hover:underline">{tx('Call 999', '৯৯৯ কল')}</a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mb-4 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk">{tx('What you can report', 'যা জানাতে পারেন')}</p>
            <h2 className="mt-2 font-display text-4xl text-night">{tx('Pick the closest kind of problem.', 'সবচেয়ে কাছের সমস্যাটি বেছে নিন।')}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {state.categories.map((category) => {
              const Icon = categoryIcon[category.id]
              return (
                <ReportLink key={category.id} category={category.id} className="panel flex items-start gap-3 p-4 hover:border-steel">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-frost text-dusk ring-1 ring-haze/70">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-snug text-night">{lang === 'bn' ? category.bn : category.en}</span>
                    {category.sensitive ? <span className="mt-1 block text-xs text-steel">{tx('Restricted desk', 'সীমিত ডেস্ক')}</span> : null}
                  </span>
                </ReportLink>
              )
            })}
          </div>
        </section>

        <section id="how" className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk">{tx('The path of a report', 'একটি রিপোর্টের পথ')}</p>
            <h2 className="mt-2 font-display text-4xl text-night">{tx('Filed once. Handed to one office. Closed in the open.', 'একবার জমা। একটি দপ্তর। খোলাখুলি বন্ধ।')}</h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              [tx('1. Describe the place', '১. জায়গাটি লিখুন'), tx('Category, photo, building, and a note if the route is blocked.', 'বিভাগ, ছবি, ভবন, এবং পথ আটকে থাকলে একটি নোট।')],
              [tx('2. The desk assigns it', '২. ডেস্ক বরাদ্দ করে'), tx('Nothing is auto-sent. An officer confirms the department and the priority.', 'কিছুই নিজে থেকে যায় না। একজন কর্মকর্তা বিভাগ ও অগ্রাধিকার নিশ্চিত করেন।')],
              [tx('3. You watch the clock', '৩. আপনি সময় দেখেন'), tx('Target time, replies, resolution, and a rating when the work is done.', 'লক্ষ্য সময়, উত্তর, সমাধান, আর কাজ শেষে একটি রেটিং।')],
            ].map(([title, body]) => (
              <li key={title} className="panel p-4">
                <p className="font-display text-2xl leading-tight text-night">{title}</p>
                <p className="mt-2 text-sm text-steel">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="panel flex flex-wrap items-center gap-2 p-4">
            {flow.map((status, index) => (
              <div key={status} className="flex items-center gap-2">
                <StatusPill status={status} />
                {index < flow.length - 1 ? <span className="text-haze">→</span> : null}
              </div>
            ))}
            <p className="w-full pt-2 text-sm text-slate">{tx('Rejected and reopened sit beside this path when the work needs another look.', 'কাজ আরেকবার দেখতে হলে প্রত্যাখ্যান ও পুনরায় খোলার স্ট্যাটাসও থাকে।')} {statusLabel('rejected', lang)} · {statusLabel('reopened', lang)}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3">
          {([
            [Timer, tx('A clock on every report', 'প্রতিটি রিপোর্টে একটি সময়'), tx('Each category has a target. Work past that time rises to the top of the desk.', 'প্রতিটি বিভাগের একটি লক্ষ্য সময় আছে। সময় পেরোলে কাজ ডেস্কের উপরে ওঠে।')],
            [ThumbsUp, tx('One report for one problem', 'এক সমস্যা, একটি রিপোর্ট'), tx('Open reports at that building show before you file. Add your name instead of starting a copy.', 'জমা দেওয়ার আগে সেই ভবনের খোলা রিপোর্ট দেখায়। নতুন না খুলে আপনি সেটিতে যোগ দিতে পারেন।')],
            [Lock, tx('A smaller desk for sensitive cases', 'সংবেদনশীল ঘটনার জন্য ছোট ডেস্ক'), tx('Harassment stays confidential. The public map never shows those stories.', 'হয়রানির রিপোর্ট গোপন থাকে। প্রকাশ্য মানচিত্র সেই ঘটনা দেখায় না।')],
          ] as [LucideIcon, string, string][]).map(([Icon, title, body]) => (
            <article key={title} className="panel p-5">
              <Icon className="h-5 w-5 text-dusk" />
              <h3 className="mt-3 font-display text-2xl text-night">{title}</h3>
              <p className="mt-2 text-sm text-steel">{body}</p>
            </article>
          ))}
        </section>

        <section id="privacy" className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-[28px] bg-dusk px-6 py-8 text-frost sm:px-10">
            <h2 className="font-display text-4xl">{tx('Quiet where it has to be.', 'যেখানে দরকার, সেখানে চুপচাপ।')}</h2>
            <div className="mt-6 grid gap-6 text-haze md:grid-cols-3">
              <p>{tx('Ordinary maintenance reports show the problem, not a student’s full profile, on the campus feed.', 'সাধারণ রক্ষণাবেক্ষণের রিপোর্টে সমস্যা দেখা যায়, ক্যাম্পাস ফিডে শিক্ষার্থীর পুরো প্রোফাইল নয়।')}</p>
              <p>{tx('Harassment and other confidential reports are withheld from facilities offices.', 'হয়রানি ও অন্যান্য গোপন রিপোর্ট রক্ষণাবেক্ষণ দপ্তরের কাছে যায় না।')}</p>
              <p>{tx('Lost and found, alerts, and a public statistics page sit beside the report desk. Multi-campus routing waits until the university asks for it.', 'হারানো-পাওয়া, সতর্কতা, এবং প্রকাশ্য পরিসংখ্যান ডেস্কের পাশে আছে। একাধিক ক্যাম্পাস তখনই আসবে, যখন বিশ্ববিদ্যালয় চাইবে।')}</p>
            </div>
            <Link to="/status" className={cx(buttonClass('secondary'), 'mt-6')}>{tx('See the public figures', 'প্রকাশ্য হিসাব দেখুন')}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-haze px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <Logo />
            <p className="mt-2 max-w-md text-sm text-slate">{remote ? tx('Reports are stored in the campus database. Call 999 for an emergency.', 'রিপোর্ট ক্যাম্পাস ডেটাবেসে থাকে। জরুরি প্রয়োজনে ৯৯৯।') : tx('Preview only. Reports stay in this browser until the university server is connected. Call 999 for an emergency.', 'শুধু প্রিভিউ। বিশ্ববিদ্যালয়ের সার্ভার যুক্ত হওয়ার আগে রিপোর্ট এই ব্রাউজারে থাকে। জরুরি প্রয়োজনে ৯৯৯।')}</p>
          </div>
          <p className="text-sm text-slate">Safely · Padma University</p>
        </div>
      </footer>
    </div>
  )
}
