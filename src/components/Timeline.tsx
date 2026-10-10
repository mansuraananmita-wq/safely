import { formatWhen } from '../logic'
import { useApp } from '../store'
import type { Report } from '../types'

export function Timeline({ report, includeInternal }: { report: Report; includeInternal: boolean }) {
  const { lang, tx } = useApp()
  const items = report.activities
    .filter((item) => includeInternal || item.visibility === 'public')
    .sort((a, b) => +new Date(a.at) - +new Date(b.at))
  if (!items.length) return <p className="text-sm text-ink/60">{tx('No updates yet.', 'এখনও কোনো আপডেট নেই।')}</p>
  return (
    <ol className="space-y-4 border-l border-line pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-teal-700" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
            <span className="font-semibold text-ink/80">{item.actor}</span>
            <span>{formatWhen(item.at, lang)}</span>
            {item.visibility === 'internal' ? <span className="rounded-full bg-ink/5 px-2 py-0.5">{tx('Internal', 'অভ্যন্তরীণ')}</span> : null}
          </div>
          <p className="mt-1 text-sm">{item.message}</p>
        </li>
      ))}
    </ol>
  )
}
