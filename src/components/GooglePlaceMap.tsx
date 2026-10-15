import { ExternalLink, Navigation } from 'lucide-react'
import { useApp } from '../store'

export function GooglePlaceMap({
  lat,
  lng,
  label,
  note,
  zoom = 17,
  mapId,
  eager = false,
  compact = false,
}: {
  lat: number
  lng: number
  label: string
  note?: string
  zoom?: number
  mapId?: string
  eager?: boolean
  compact?: boolean
}) {
  const { tx, lang } = useApp()
  const hl = lang === 'bn' ? 'bn' : 'en'
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=${hl}&output=embed`
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const open = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

  return (
    <figure id={mapId} className="overflow-hidden rounded-2xl border border-line bg-white">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
        <span>
          <span className="block font-semibold">{label}</span>
          {note ? <span className="mt-0.5 block text-xs text-ink/60">{note}</span> : null}
        </span>
        <span className="flex flex-wrap gap-2">
          <a className="inline-flex items-center gap-1 rounded-full bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white" href={directions} target="_blank" rel="noreferrer">
            <Navigation className="h-3.5 w-3.5" />
            {tx('Directions', 'দিকনির্দেশ')}
          </a>
          <a className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-teal-800" href={open} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            {tx('Open in Google Maps', 'গুগল ম্যাপে খুলুন')}
          </a>
        </span>
      </figcaption>
      <iframe
        title={label}
        src={src}
        className={compact ? 'h-40 w-full border-0' : 'h-56 w-full border-0 sm:h-80'}
        loading={eager ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </figure>
  )
}
