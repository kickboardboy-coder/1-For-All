import { useEffect, useRef, useState } from 'react'
import { Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { toPlaceSearchResult, type PlaceSearchResult } from './PlaceSearchRunner'
import { useMapsStatus } from './MapsProvider'

const mapPlaceFields = ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'types', 'regularOpeningHours']
const mapPlaceIconFields = ['svgIconMaskURI', 'iconBackgroundColor']

type PlannerMapProps = {
  latitude: number
  longitude: number
  zoom: number
  places: PlaceSearchResult[]
  selectedPlaceId: string | null
  focus: 'results' | 'place'
  onSelectPlace: (placeId: string | null) => void
  savedPlaceNames: string[]
  isAddingPlace: boolean
  onAddPlace: (place: PlaceSearchResult) => void
}

function MapCamera({ latitude, longitude, zoom }: Pick<PlannerMapProps, 'latitude' | 'longitude' | 'zoom'>) {
  const map = useMap()

  useEffect(() => {
    map?.moveCamera({ center: { lat: latitude, lng: longitude }, zoom })
  }, [map, latitude, longitude, zoom])

  return null
}

function MapPlaceClicks({ onPick }: { onPick: (placeId: string, latitude: number | null, longitude: number | null) => void }) {
  const map = useMap()
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!map) {
      return
    }

    const listener = map.addListener('click', (event: { placeId?: string; latLng?: { lat: () => number; lng: () => number }; stop?: () => void }) => {
      if (!event.placeId) {
        return
      }

      event.stop?.()
      onPickRef.current(event.placeId, event.latLng?.lat() ?? null, event.latLng?.lng() ?? null)
    })

    return () => {
      listener.remove()
    }
  }, [map])

  return null
}

function MapPlaces({
  places,
  selectedPlaceId,
  focus,
  onSelectPlace,
}: Pick<PlannerMapProps, 'places' | 'selectedPlaceId' | 'focus' | 'onSelectPlace'>) {
  const map = useMap()

  useEffect(() => {
    if (!map || places.length === 0) {
      return
    }

    const selected = places.find((place) => place.id === selectedPlaceId)

    if (focus === 'place' && selected) {
      map.moveCamera({ center: { lat: selected.latitude, lng: selected.longitude }, zoom: 15 })
      return
    }

    if (places.length === 1) {
      map.moveCamera({ center: { lat: places[0].latitude, lng: places[0].longitude }, zoom: 15 })
      return
    }

    const latitudes = places.map((place) => place.latitude)
    const longitudes = places.map((place) => place.longitude)
    map.fitBounds({
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      west: Math.min(...longitudes),
    })
  }, [map, places, selectedPlaceId, focus])

  return (
    <>
      {places.map((place, index) => (
        <Marker
          key={place.id}
          position={{ lat: place.latitude, lng: place.longitude }}
          title={place.name}
          label={{ text: String(index + 1), color: '#ffffff', fontWeight: '700' }}
          zIndex={place.id === selectedPlaceId ? 2 : 1}
          onClick={() => onSelectPlace(place.id)}
        />
      ))}
    </>
  )
}

function PlannerMap({
  latitude,
  longitude,
  zoom,
  places,
  selectedPlaceId,
  focus,
  onSelectPlace,
  savedPlaceNames,
  isAddingPlace,
  onAddPlace,
}: PlannerMapProps) {
  const status = useMapsStatus()
  const placesLibrary = useMapsLibrary('places')
  const [mapPlace, setMapPlace] = useState<PlaceSearchResult | null>(null)
  const pickSeq = useRef(0)
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? mapPlace
  const selectedIndex = selectedPlace ? places.findIndex((place) => place.id === selectedPlace.id) : -1

  useEffect(() => {
    if (places.some((place) => place.id === selectedPlaceId)) {
      setMapPlace(null)
    }
  }, [places, selectedPlaceId])

  async function pickMapPlace(placeId: string, latitude: number | null, longitude: number | null) {
    const seq = ++pickSeq.current
    const searched = places.find((place) => place.id === placeId)

    if (searched) {
      setMapPlace(null)
      onSelectPlace(searched.id)
      return
    }

    setMapPlace(null)
    onSelectPlace(null)

    if (!placesLibrary) {
      return
    }

    try {
      const place = new placesLibrary.Place({ id: placeId })
      await place.fetchFields({ fields: mapPlaceFields })

      try {
        await place.fetchFields({ fields: mapPlaceIconFields })
      } catch {
        // 아이콘 필드는 없어도 이름만 있으면 카드를 연다.
      }

      if (seq !== pickSeq.current) {
        return
      }

      const result = toPlaceSearchResult({
        id: place.id || placeId,
        displayName: place.displayName,
        formattedAddress: place.formattedAddress,
        location: place.location ?? (latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null),
        primaryType: place.primaryType,
        types: place.types,
        regularOpeningHours: place.regularOpeningHours,
        svgIconMaskURI: place.svgIconMaskURI,
        iconBackgroundColor: place.iconBackgroundColor,
      })

      if (!result) {
        return
      }

      setMapPlace(result)
      onSelectPlace(result.id)
    } catch {
      // 이름·위치를 못 받으면 빈 카드는 열지 않는다.
    }
  }

  if (status !== 'ready') {
    return (
      <div className="planner-map" role="alert">
        <p>
          {status === 'missing'
            ? '구글 지도 API 키를 설정해 주세요.'
            : '지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
        </p>
      </div>
    )
  }

  return (
    <div className="planner-map">
      <Map
        className="planner-map-canvas"
        defaultCenter={{ lat: latitude, lng: longitude }}
        defaultZoom={zoom}
        gestureHandling="greedy"
        colorScheme="LIGHT"
        clickableIcons
      >
        <MapCamera latitude={latitude} longitude={longitude} zoom={zoom} />
        <MapPlaceClicks onPick={(placeId, latitude, longitude) => void pickMapPlace(placeId, latitude, longitude)} />
        <MapPlaces places={places} selectedPlaceId={selectedPlaceId} focus={focus} onSelectPlace={onSelectPlace} />
      </Map>
      {selectedPlace && (
        <article className="planner-place-card">
          {selectedIndex >= 0 ? (
            <span>{selectedIndex + 1}</span>
          ) : selectedPlace.iconUrl ? (
            <span
              className="planner-place-google-icon"
              style={{ background: selectedPlace.iconBackgroundColor ?? '#27846e' }}
            >
              <img src={selectedPlace.iconUrl} alt="" />
            </span>
          ) : (
            <span>·</span>
          )}
          <div>
            <strong>{selectedPlace.name}</strong>
            {selectedPlace.address && <p>{selectedPlace.address}</p>}
          </div>
          <button
            type="button"
            disabled={isAddingPlace || savedPlaceNames.includes(selectedPlace.name)}
            onClick={() => onAddPlace(selectedPlace)}
          >
            {savedPlaceNames.includes(selectedPlace.name) ? '담김' : '주머니에 담기'}
          </button>
        </article>
      )}
    </div>
  )
}

export default PlannerMap
