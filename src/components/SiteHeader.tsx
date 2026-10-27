import { Link } from 'react-router-dom'
import { homePath } from '../logic'
import { useApp } from '../store'
import { Logo, buttonClass, cx } from './ui'

const links = [
  { href: '/#how', en: 'How it works', bn: 'কীভাবে কাজ করে' },
  { href: '/#privacy', en: 'Privacy', bn: 'গোপনীয়তা' },
  { href: '/status', en: 'Public figures', bn: 'প্রকাশ্য হিসাব' },
] as const

export function SiteHeader() {
  const { currentUser, tx, lang, setLang } = useApp()
  const desk = currentUser ? homePath(currentUser.role) : null

  return (
    <header className="sticky top-0 z-40 border-b border-haze/80 bg-white/95 backdrop-blur">
      <div className="border-b border-haze/60 bg-frost/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 text-xs text-slate">
          <p>{tx('Padma University campus desk', 'পদ্মা বিশ্ববিদ্যালয় ক্যাম্পাস ডেস্ক')}</p>
          <a href="tel:999" className="font-semibold text-clay hover:underline">
            {tx('Emergency: call 999', 'জরুরি: ৯৯৯-এ কল')}
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link to="/" aria-label="Safely" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex" aria-label={tx('Site', 'সাইট')}>
          {links.map((item) => (
            item.href.startsWith('/') && !item.href.includes('#') ? (
              <Link key={item.href} to={item.href} className="text-steel hover:text-night">
                {lang === 'bn' ? item.bn : item.en}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className="text-steel hover:text-night">
                {lang === 'bn' ? item.bn : item.en}
              </a>
            )
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            className="rounded-md border border-haze bg-white px-2.5 py-1.5 text-xs font-semibold text-dusk"
          >
            {lang === 'en' ? 'বাংলা' : 'EN'}
          </button>
          {desk ? (
            <Link to={desk} className={buttonClass('primary', 'rounded-md')}>
              {tx('Open desk', 'ডেস্ক খুলুন')}
            </Link>
          ) : (
            <>
              <Link to="/login" className={cx('hidden text-sm font-semibold text-dusk sm:inline', 'px-2')}>
                {tx('Sign in', 'সাইন ইন')}
              </Link>
              <Link to="/login" state={{ from: '/app/report/new' }} className={buttonClass('primary', 'rounded-md')}>
                {tx('Report a problem', 'সমস্যা জানান')}
              </Link>
            </>
          )}
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-haze/60 px-4 py-2 text-sm md:hidden" aria-label={tx('Sections', 'বিভাগ')}>
        {links.map((item) => (
          item.href.startsWith('/') && !item.href.includes('#') ? (
            <Link key={item.href} to={item.href} className="shrink-0 text-steel">
              {lang === 'bn' ? item.bn : item.en}
            </Link>
          ) : (
            <a key={item.href} href={item.href} className="shrink-0 text-steel">
              {lang === 'bn' ? item.bn : item.en}
            </a>
          )
        ))}
      </nav>
    </header>
  )
}
