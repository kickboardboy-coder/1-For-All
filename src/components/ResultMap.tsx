import { useEffect } from 'react'
import { Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { useMapsStatus } from './MapsProvider'
import { itineraryStopBadge, type Itinerary } from '../types/itinerary'
import type { Place } from '../types/place'

export const dayColors = [
  '#27846e',
  '#c4514a',
  '#2f6fed',
  '#e67e22',
  '#6b5ea8',
  '#1aa6a6',
  '#c2185b',
  '#8d6e3f',
  '#5c8a2b',
  '#d4a017',
  '#3d5a80',
  '#e07a9a',
  '#4a7c59',
  '#7b4b94',
  '#2a9d8f',
  '#b5651d',
  '#457b9d',
  '#9b2226',
  '#588157',
  '#6d597a',
  '#00a8e8',
  '#bc6c25',
  '#264653',
  '#e63946',
]
export const dayColorNames = [
  '민트',
  '살구',
  '파랑',
  '주황',
  '라벤더',
  '청록',
  '자홍',
  '갈색',
  '연두',
  '노랑',
  '남색',
  '분홍',
  '숲녹',
  '보라',
  '옥색',
  '황토',
  '하늘',
  '와인',
  '올리브',
  '자주',
  '시안',
  '호박',
  '먹색',
  '선홍',
]

export type RouteStop = {
  placeId: string
  name: string
  latitude: number
  longitude: number
  label: string
}

export type DayRoute = {
  day: number
  color: string
  stops: RouteStop[]
}

export function dayColorIndex(day: number, indexes: Record<number, number> = {}) {
  return indexes[day] ?? (day - 1) % dayColors.length
}

export function dayColorOf(day: number, indexes: Record<number, number> = {}) {
  return dayColors[dayColorIndex(day, indexes)]
}

export function dayColorNameOf(day: number, indexes: Record<number, number> = {}) {
  return dayColorNames[dayColorIndex(day, indexes)]
}

export function dayRoutesFrom(
  itinerary: Itinerary | null,
  places: Place[],
  extras: Array<Omit<RouteStop, 'label'>> = [],
): DayRoute[] {
  if (!itinerary) {
    return []
  }

  return itinerary.days.flatMap((day) => {
    let visitNumber = 0
    const stops = day.stops.flatMap((stop) => {
      const place = places.find((item) => item.id === stop.placeId)
      const extra = extras.find((item) => item.placeId === stop.placeId)
      const located = place
        ? { placeId: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude }
        : extra ?? null

      if (!located) {
        return []
      }

      const label = itineraryStopBadge(stop.kind, stop.kind === 'visit' ? ++visitNumber : visitNumber)
      return [{ ...located, label }]
    })

    if (stops.length === 0) {
      return []
    }

    return [{ day: day.day, color: dayColors[(day.day - 1) % dayColors.length], stops }]
  })
}

function RouteLines({ routes }: { routes: DayRoute[] }) {
  const map = useMap()

  useEffect(() => {
    const Polyline = (window as Window & { google?: { maps?: { Polyline?: new (options: object) => { setMap: (value: null) => void } } } }).google?.maps?.Polyline

    if (!map || typeof Polyline !== 'function') {
      return
    }

    const lines = routes.flatMap((route) => {
      if (route.stops.length < 2) {
        return []
      }

      const line = new Polyline({
        map,
        path: route.stops.map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),
        geodesic: true,
        strokeColor: route.color,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        zIndex: route.day,
      })

      return [line]
    })

    const points = routes.flatMap((route) => route.stops)

    if (points.length === 1) {
      map.moveCamera({ center: { lat: points[0].latitude, lng: points[0].longitude }, zoom: 14 })
    } else if (points.length > 1) {
      const latitudes = points.map((point) => point.latitude)
      const longitudes = points.map((point) => point.longitude)
      map.fitBounds({
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      })
    }

    return () => {
      lines.forEach((line) => line.setMap(null))
    }
  }, [map, routes])

  return null
}

type ResultMapProps = {
  latitude: number
  longitude: number
  zoom: number
  routes: DayRoute[]
}

function ResultMap({ latitude, longitude, zoom, routes }: ResultMapProps) {
  const status = useMapsStatus()

  if (status !== 'ready') {
    return (
      <div className="result-map-canvas" role="alert">
        <p>
          {status === 'missing'
            ? '구글 지도 API 키를 설정해 주세요.'
            : '지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
        </p>
      </div>
    )
  }

  return (
    <div className="result-map-canvas">
      <Map
        className="result-map-google"
        defaultCenter={{ lat: latitude, lng: longitude }}
        defaultZoom={zoom}
        gestureHandling="greedy"
        colorScheme="LIGHT"
        disableDefaultUI
        zoomControl
      >
        <RouteLines routes={routes} />
        {routes.flatMap((route) => {
          const markers = route.stops.filter((stop, index) => stop.label !== '숙소' || route.stops.findIndex((item) => item.label === '숙소' && item.placeId === stop.placeId) === index)

          return markers.map((stop, index) => (
            <Marker
              key={`${route.day}-${stop.placeId}-${stop.label}-${index}`}
              position={{ lat: stop.latitude, lng: stop.longitude }}
              title={`${route.day}일차 · ${stop.label} ${stop.name}`}
              label={{
                text: stop.label,
                color: '#ffffff',
                fontSize: stop.label === '숙소' ? '10px' : '12px',
                fontWeight: '700',
              }}
              zIndex={route.day * 10 + index}
            />
          ))
        })}
      </Map>
      <p className="result-map-note">동선은 방문 순서를 이은 선이에요. 실제 길찾기 경로가 아니에요.</p>
    </div>
  )
}

export default ResultMap
