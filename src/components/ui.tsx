import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { statusLabel } from '../logic'
import { useApp } from '../store'
import type { Status } from '../types'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'

const variants: Record<Variant, string> = {
  primary: 'bg-dusk text-frost hover:bg-night',
  secondary: 'border border-haze bg-white text-night hover:border-steel hover:bg-frost',
  ghost: 'text-dusk hover:bg-frost',
  danger: 'bg-clay text-white hover:opacity-90',
  quiet: 'bg-night text-frost hover:bg-dusk',
}

const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50'

export function buttonClass(variant: Variant = 'primary', className = ''): string {
  return cx(buttonBase, variants[variant], className)
}

export function navClass(active: boolean): string {
  return cx('flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm', active ? 'bg-white font-semibold text-night shadow-card ring-1 ring-haze' : 'text-slate hover:bg-white/80 hover:text-dusk')
}

export function Button({ variant = 'primary', className, type, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type ?? 'button'} className={buttonClass(variant, className)} {...props} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{label}</div>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink/60">{hint}</p> : null}
    </div>
  )
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dusk">{children}</p>
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums leading-none text-night">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate">{hint}</p> : null}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel px-5 py-10 text-center">
      <p className="font-display text-3xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Bars({ rows }: { rows: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  if (!rows.length) return <p className="text-sm text-slate">No reports in this view yet.</p>
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="text-night">{row.label}</span>
            <span className="text-right tabular-nums text-slate">{row.display ?? row.value}</span>
          </div>
          <div className="h-2 rounded-full bg-frost">
            <div className="h-2 rounded-full bg-steel" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const STATUS_CLASS: Record<Status, string> = {
  draft: 'bg-frost text-slate',
  submitted: 'bg-haze/35 text-dusk',
  under_review: 'bg-amber-100 text-amber-950',
  assigned: 'bg-frost text-steel',
  in_progress: 'bg-haze/50 text-night',
  resolved: 'bg-moss/10 text-moss',
  closed: 'bg-dusk/10 text-dusk',
  rejected: 'bg-clay/10 text-clay',
  reopened: 'bg-steel/15 text-steel',
}

export function StatusPill({ status }: { status: Status }) {
  const { lang } = useApp()
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_CLASS[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status, lang)}
    </span>
  )
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const { tx } = useApp()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4" data-confirm="" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="panel w-full max-w-lg p-5 shadow-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1" aria-label={tx('Close', 'বন্ধ')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Safely`
  }, [title])
}

export function Logo({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/safely-logo.png"
        alt=""
        width={large ? 56 : 36}
        height={large ? 56 : 36}
        className={cx(
          'shrink-0 rounded-xl object-cover shadow-sm',
          large ? 'h-14 w-14' : 'h-9 w-9',
          light ? 'ring-1 ring-white/15' : 'ring-1 ring-haze/80',
        )}
      />
      <span className={cx('font-display leading-none tracking-tight', large ? 'text-3xl' : 'text-xl', light ? 'text-frost' : 'text-night')}>
        Safely
      </span>
    </span>
  )
}
