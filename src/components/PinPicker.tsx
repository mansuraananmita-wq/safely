import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pin = L.divIcon({
  className: 'safely-pin',
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 26],
})

export function PinPicker({
  lat,
  lng,
  onMove,
}: {
  lat: number
  lng: number
  onMove: (lat: number, lng: number) => void
}) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    const root = node.current
    if (!root || mapRef.current) return
    const map = L.map(root, { zoomControl: true }).setView([lat, lng], 17)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const marker = L.marker([lat, lng], { draggable: true, icon: pin, autoPan: true }).addTo(map)
    const publish = (next: L.LatLng) => onMoveRef.current(Number(next.lat.toFixed(5)), Number(next.lng.toFixed(5)))
    marker.on('dragend', () => publish(marker.getLatLng()))
    map.on('click', (event) => {
      marker.setLatLng(event.latlng)
      publish(event.latlng)
    })
    mapRef.current = map
    markerRef.current = marker
    window.setTimeout(() => map.invalidateSize(), 0)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // The map is created once. Later coordinate changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const current = marker.getLatLng()
    if (Math.abs(current.lat - lat) < 0.00002 && Math.abs(current.lng - lng) < 0.00002) return
    marker.setLatLng([lat, lng])
    map.setView([lat, lng])
  }, [lat, lng])

  return <div ref={node} className="pin-map z-0 h-80 w-full overflow-hidden rounded-2xl border border-line" />
}
