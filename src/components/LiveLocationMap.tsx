import { useCallback, useEffect, useRef, useState } from 'react'
import { GooglePlaceMap } from './GooglePlaceMap'
import { Button } from './ui'
import { useApp } from '../store'

const campus = { lat: 23.7342, lng: 90.392 }

function round(value: number) {
  return Math.round(value * 10000) / 10000
}

export function LiveLocationMap() {
  const { tx } = useApp()
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [mode, setMode] = useState<'seeking' | 'live' | 'off'>('seeking')
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setMode('off')
      return
    }
    setMode('seeking')
    stop()
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: round(position.coords.latitude), lng: round(position.coords.longitude) }
        setPoint((current) => (current && current.lat === next.lat && current.lng === next.lng ? current : next))
        setMode('live')
      },
      () => setMode('off'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )
  }, [stop])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  const shown = point ?? campus
  const note =
    mode === 'live'
      ? tx('This pin follows your live location.', 'এই পিন আপনার লাইভ লোকেশন অনুসরণ করে।')
      : mode === 'seeking'
        ? tx('Finding your location…', 'আপনার লোকেশন খোঁজা হচ্ছে…')
        : tx('Location is off. The map stays on the campus until you allow it.', 'লোকেশন বন্ধ। অনুমতি না দেওয়া পর্যন্ত ম্যাপ ক্যাম্পাসেই থাকে।')

  return (
    <div className="space-y-2">
      <GooglePlaceMap lat={shown.lat} lng={shown.lng} zoom={mode === 'live' ? 16 : 14} label={mode === 'live' ? tx('You are here', 'আপনি এখানে') : tx('Campus', 'ক্যাম্পাস')} note={note} eager />
      {mode === 'off' ? <Button variant="secondary" onClick={start}>{tx('Show my live location', 'আমার লাইভ লোকেশন দেখান')}</Button> : null}
    </div>
  )
}
