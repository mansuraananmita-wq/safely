import { PLACES } from '../data'
import type { Place } from '../types'

function pos(place: Place) {
  return { x: 78 + place.x * 7.15, y: 54 + place.y * 4.55 }
}

export function CampusMap({
  counts,
  selected,
  onSelect,
  labelFor,
}: {
  counts: Record<string, number>
  selected?: string
  onSelect: (id: string) => void
  labelFor: (place: Place) => string
}) {
  return (
    <svg viewBox="0 0 860 560" className="h-auto w-full rounded-2xl bg-[#d7efe4]" role="img" aria-label="Stylized map of Padma University">
      <rect width="860" height="560" fill="#d5efe3" />
      <path d="M0 470 C 140 430, 240 510, 390 468 S 640 430, 860 492 L 860 560 L 0 560 Z" fill="#8fcfcb" />
      <path d="M70 300 H 800" stroke="#f7f3ea" strokeWidth="22" fill="none" />
      <path d="M250 70 V 470" stroke="#f7f3ea" strokeWidth="16" fill="none" />
      <path d="M250 300 C 360 300, 470 250, 620 250 H 790" stroke="#f7f3ea" strokeWidth="12" fill="none" />
      <circle cx="140" cy="150" r="16" fill="#8dbe98" />
      <circle cx="520" cy="210" r="12" fill="#8dbe98" />
      <circle cx="700" cy="360" r="18" fill="#8dbe98" />
      <circle cx="180" cy="390" r="14" fill="#8dbe98" />
      <text x="36" y="40" fill="#0c4a46" fontFamily="Fraunces, Georgia, serif" fontSize="20">
        Padma University
      </text>
      <g transform="translate(790 42)" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#fffdf8" />
        <path d="M16 6 V26 M16 6 L11 13 M16 6 L21 13" fill="none" stroke="#0f5e59" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {PLACES.map((place) => {
        const point = pos(place)
        const active = selected === place.id
        const count = counts[place.id] ?? 0
        return (
          <g key={place.id} onClick={() => onSelect(place.id)} className="cursor-pointer">
            <rect x={point.x - 46} y={point.y - 18} width="92" height="36" rx="10" fill={active ? '#0f5e59' : '#fffdf8'} stroke="#0c4a46" strokeOpacity={active ? 1 : 0.15} />
            <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize="12" fontFamily="Outfit, sans-serif" fill={active ? '#f3f0e7' : '#1c2430'}>
              {labelFor(place)}
            </text>
            {count > 0 ? (
              <>
                <circle cx={point.x + 38} cy={point.y - 16} r="11" fill="#e09a12" />
                <text x={point.x + 38} y={point.y - 12} textAnchor="middle" fontSize="11" fontFamily="Outfit, sans-serif" fill="#1c2430">
                  {count}
                </text>
              </>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
