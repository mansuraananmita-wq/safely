import { ArrowRight, Lock, MapPinned, MessageSquare, ShieldAlert, ThumbsUp, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryIcon } from '../categoryUi'
import type { LucideIcon } from 'lucide-react'
import { Logo, StatusPill, buttonClass, cx, useTitle } from '../components/ui'
import { statusLabel } from '../logic'
import { useApp } from '../store'
import type { Status } from '../types'

const flow: Status[] = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed']

export default function Landing() {
  const { tx, lang, state } = useApp()
  useTitle(tx('Campus desk', 'ক্যাম্পাস ডেস্ক'))
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
        <Logo />
        <nav className="ml-auto hidden items-center gap-5 text-sm md:flex">
          <a href="#how" className="text-ink/70 hover:text-ink">{tx('How it works', 'কীভাবে কাজ করে')}</a>
          <a href="#privacy" className="text-ink/70 hover:text-ink">{tx('Privacy', 'গোপনীয়তা')}</a>
          <Link to="/status" className="text-ink/70 hover:text-ink">{tx('Public figures', 'প্রকাশ্য হিসাব')}</Link>
        </nav>
        <Link to="/login" className={buttonClass('secondary', 'ml-auto md:ml-0')}>{tx('Sign in', 'সাইন ইন')}</Link>
        <Link to="/register" className={cx(buttonClass('primary'), 'hidden sm:inline-flex')}>{tx('Report a problem', 'সমস্যা জানান')}</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">{tx('Padma University', 'পদ্মা বিশ্ববিদ্যালয়')}</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] sm:text-6xl">
              {tx('A broken light should not wait in a group chat.', 'একটি ভাঙা বাতি গ্রুপ চ্যাটে আটকে থাকবে না।')}
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink/75">
              {tx(
                'Students, teachers, and staff file one report. The right office gets the work, you see the status, and sensitive cases stay with a smaller desk.',
                'শিক্ষার্থী, শিক্ষক ও কর্মকর্তারা একটি রিপোর্ট দেন। সঠিক দপ্তর কাজ পায়, আপনি স্ট্যাটাস দেখেন, আর সংবেদনশীল ঘটনা ছোট একটি ডেস্কে থাকে।',
              )}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register" className={buttonClass('primary')}>
                {tx('File a campus report', 'ক্যাম্পাস রিপোর্ট দিন')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className={buttonClass('secondary')}>{tx('Open a demo desk', 'ডেমো ডেস্ক খুলুন')}</Link>
            </div>
            <p className="mt-4 max-w-md text-sm text-ink/55">
              {tx(
                'Campus members use the Safely phone app. This website is the operations desk. It is not an emergency service. If someone is in danger, call 999.',
                'ক্যাম্পাসের সদস্যরা সেইফলি ফোন অ্যাপ ব্যবহার করেন। এই ওয়েবসাইট অপারেশন ডেস্ক। এটি জরুরি সেবা নয়। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন।',
              )}
            </p>
          </div>
          <div className="relative">
            <div className="absolute -left-4 top-8 hidden w-64 rotate-[-4deg] rounded-2xl border border-line bg-white/80 p-4 shadow-card sm:block">
              <p className="text-xs font-semibold text-teal-800">SF-10510</p>
              <p className="mt-1 font-display text-xl leading-tight">{tx('Library wifi keeps dropping', 'লাইব্রেরির ওয়াইফাই বারবার ছুটে যাচ্ছে')}</p>
              <p className="mt-2 text-xs text-ink/60">{tx('Submitted · waiting for a first reply', 'জমা হয়েছে · প্রথম উত্তরের অপেক্ষায়')}</p>
            </div>
            <div className="ml-auto max-w-md rounded-[28px] bg-teal-900 p-4 text-paper shadow-card">
              <div className="rounded-[22px] bg-card p-5 text-ink">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-teal-800">SF-10482</p>
                  <StatusPill status="in_progress" />
                </div>
                <p className="mt-3 font-display text-3xl leading-tight">{tx('Broken asphalt at the main gate', 'প্রধান ফটকে ভাঙা রাস্তা')}</p>
                <p className="mt-3 text-sm text-ink/70">{tx('Maintenance has the crew on the west footpath.', 'রক্ষণাবেক্ষণ দল পশ্চিম ফুটপাতে কাজ করছে।')}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-paper p-3">
                    <p className="text-xs uppercase tracking-wide text-ink/45">{tx('Target', 'লক্ষ্য')}</p>
                    <p className="font-display text-3xl">22h</p>
                  </div>
                  <div className="rounded-2xl bg-paper p-3">
                    <p className="text-xs uppercase tracking-wide text-ink/45">{tx('Same spot', 'একই জায়গা')}</p>
                    <p className="font-display text-3xl">4</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {state.categories.map((category) => {
              const Icon = categoryIcon[category.id]
              return (
                <Link key={category.id} to="/register" className="panel flex items-start gap-3 p-4 hover:border-teal-700">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-snug">{lang === 'bn' ? category.bn : category.en}</span>
                    {category.sensitive ? <span className="mt-1 block text-xs text-plum">{tx('Restricted desk', 'সীমিত ডেস্ক')}</span> : null}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <section id="how" className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">{tx('The path of a report', 'একটি রিপোর্টের পথ')}</p>
            <h2 className="mt-2 font-display text-4xl">{tx('Filed once. Handed to one office. Closed in the open.', 'একবার জমা। একটি দপ্তর। খোলাখুলি বন্ধ।')}</h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              [tx('1. Describe the place', '১. জায়গাটি লিখুন'), tx('Category, photo, building, and a note if the route is blocked.', 'বিভাগ, ছবি, ভবন, এবং পথ আটকে থাকলে একটি নোট।')],
              [tx('2. The desk assigns it', '২. ডেস্ক বরাদ্দ করে'), tx('Nothing is auto-sent. An officer confirms the department and the priority.', 'কিছুই নিজে থেকে যায় না। একজন কর্মকর্তা বিভাগ ও অগ্রাধিকার নিশ্চিত করেন।')],
              [tx('3. You watch the clock', '৩. আপনি সময় দেখেন'), tx('Target time, replies, resolution, and a rating when the work is done.', 'লক্ষ্য সময়, উত্তর, সমাধান, আর কাজ শেষে একটি রেটিং।')],
            ].map(([title, body]) => (
              <li key={title} className="panel p-4">
                <p className="font-display text-2xl leading-tight">{title}</p>
                <p className="mt-2 text-sm text-ink/70">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="panel flex flex-wrap items-center gap-2 p-4">
            {flow.map((status, index) => (
              <div key={status} className="flex items-center gap-2">
                <StatusPill status={status} />
                {index < flow.length - 1 ? <span className="text-ink/30">→</span> : null}
              </div>
            ))}
            <p className="w-full pt-2 text-sm text-ink/60">{tx('Rejected and reopened sit beside this path when the work needs another look.', 'কাজ আরেকবার দেখতে হলে প্রত্যাখ্যান ও পুনরায় খোলার স্ট্যাটাসও থাকে।')} {statusLabel('rejected', lang)} · {statusLabel('reopened', lang)}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3">
          {([
            [Timer, tx('Target times', 'লক্ষ্য সময়'), tx('Every category has a clock. Overdue work rises to the top of the desk.', 'প্রতিটি বিভাগের একটি সময়সীমা আছে। সময় পেরোলে কাজ ডেস্কের উপরে ওঠে।')],
            [ThumbsUp, tx('Same problem, one report', 'এক সমস্যা, একটি রিপোর্ট'), tx('Before you file, Safely shows open reports at that place. You can add your name to one instead of starting a duplicate.', 'জমা দেওয়ার আগে সেই জায়গার খোলা রিপোর্ট দেখায়। নতুন না খুলে আপনি সেটিতে যোগ দিতে পারেন।')],
            [MapPinned, tx('Planned work', 'পরিকল্পিত কাজ'), tx('Tank cleaning and patrol notices sit next to the form, so a known outage is not filed as a surprise.', 'ট্যাংক পরিষ্কার বা প্যাট্রোলের নোটিশ ফর্মের পাশে থাকে, যাতে জানা বিভ্রাট নতুন সমস্যা না হয়।')],
            [ShieldAlert, tx('Safety without spectacle', 'প্রদর্শন ছাড়া নিরাপত্তা'), tx('The public map counts unsafe areas. It does not publish the story.', 'প্রকাশ্য মানচিত্র বিপজ্জনক এলাকা গোনে। ঘটনা প্রকাশ করে না।')],
            [Lock, tx('A smaller audience', 'ছোট পরিসর'), tx('Harassment reports are confidential by default. Anonymous ones keep no reply channel.', 'হয়রানির রিপোর্ট স্বয়ংক্রিয়ভাবে গোপন। বেনামি রিপোর্টে উত্তরের পথ থাকে না।')],
            [MessageSquare, tx('Bangla and English', 'বাংলা ও ইংরেজি'), tx('Switch language, enlarge the type, or raise contrast from any signed-in screen.', 'যেকোনো স্ক্রিন থেকে ভাষা, বড় অক্ষর, বা বেশি কনট্রাস্ট বেছে নিন।')],
          ] as [LucideIcon, string, string][]).map(([Icon, title, body]) => (
            <article key={title} className="panel p-5">
              <Icon className="h-5 w-5 text-teal-800" />
              <h3 className="mt-3 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-ink/70">{body}</p>
            </article>
          ))}
        </section>

        <section id="privacy" className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-[28px] bg-ink px-6 py-8 text-paper sm:px-10">
            <h2 className="font-display text-4xl">{tx('Quiet where it has to be.', 'যেখানে দরকার, সেখানে চুপচাপ।')}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <p>{tx('Ordinary maintenance reports show the problem, not a student’s full profile, on the campus feed.', 'সাধারণ রক্ষণাবেক্ষণের রিপোর্টে সমস্যা দেখা যায়, ক্যাম্পাস ফিডে শিক্ষার্থীর পুরো প্রোফাইল নয়।')}</p>
              <p>{tx('Harassment and other confidential reports are withheld from facilities offices.', 'হয়রানি ও অন্যান্য গোপন রিপোর্ট রক্ষণাবেক্ষণ দপ্তরের কাছে যায় না।')}</p>
              <p>{tx('Lost and found, alerts, and a public statistics page sit beside the report desk. Multi-campus routing waits until the university asks for it.', 'হারানো-পাওয়া, সতর্কতা, এবং প্রকাশ্য পরিসংখ্যান ডেস্কের পাশে আছে। একাধিক ক্যাম্পাস তখনই আসবে, যখন বিশ্ববিদ্যালয় চাইবে।')}</p>
            </div>
            <Link to="/status" className={cx(buttonClass('secondary'), 'mt-6')}>{tx('See the public figures', 'প্রকাশ্য হিসাব দেখুন')}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <Logo />
            <p className="mt-2 max-w-md text-sm text-ink/60">{tx('Preview only. Reports stay in this browser until the university server is connected. Call 999 for an emergency.', 'শুধু প্রিভিউ। বিশ্ববিদ্যালয়ের সার্ভার যুক্ত হওয়ার আগে রিপোর্ট এই ব্রাউজারে থাকে। জরুরি প্রয়োজনে ৯৯৯।')}</p>
          </div>
          <p className="text-sm text-ink/50">Safely · Padma University</p>
        </div>
      </footer>
    </div>
  )
}
