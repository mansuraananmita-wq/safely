import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ExternalLink, Navigation } from 'lucide-react'
import { mapsDirectionsHref, mapsPinHref } from '../lib/sos'
import { useApp } from '../store'

const pin = L.divIcon({
  className: 'safely-pin',
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
})

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
  const { tx } = useApp()
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const directions = mapsDirectionsHref(lat, lng)
  const open = mapsPinHref(lat, lng, zoom)
  void eager

  useEffect(() => {
    const root = node.current
    if (!root || mapRef.current) return
    const map = L.map(root, { zoomControl: true, attributionControl: true }).setView([lat, lng], zoomRef.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    markerRef.current = L.marker([lat, lng], { icon: pin, keyboard: false }).addTo(map)
    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Created once; later lat/lng updates move the same marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    marker.setLatLng([lat, lng])
    map.setView([lat, lng], zoomRef.current)
  }, [lat, lng, zoom])

  return (
    <figure id={mapId} className="overflow-hidden rounded-2xl border border-haze/80 bg-white" data-lat={lat} data-lng={lng}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
        <span>
          <span className="block font-semibold">{label}</span>
          {note ? <span className="mt-0.5 block text-xs text-slate">{note}</span> : null}
          <span className="mt-0.5 block font-mono text-xs text-ink/55">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
        </span>
        <span className="flex flex-wrap gap-2">
          <a className="inline-flex items-center gap-1 rounded-full bg-dusk px-3 py-1.5 text-xs font-semibold text-frost" href={directions} target="_blank" rel="noreferrer">
            <Navigation className="h-3.5 w-3.5" />
            {tx('Directions', 'দিকনির্দেশ')}
          </a>
          <a className="inline-flex items-center gap-1 rounded-full border border-haze bg-white px-3 py-1.5 text-xs font-semibold text-dusk" href={open} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            {tx('Open in Google Maps', 'গুগল ম্যাপে খুলুন')}
          </a>
        </span>
      </figcaption>
      <div ref={node} className={compact ? 'pin-map z-0 h-40 w-full' : 'pin-map z-0 h-56 w-full sm:h-80'} />
    </figure>
  )
}
