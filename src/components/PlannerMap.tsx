import { useEffect } from 'react'
import { Map, Marker, useMap } from '@vis.gl/react-google-maps'
import type { PlaceSearchResult } from './PlaceSearchRunner'
import { useMapsStatus } from './MapsProvider'

type PlannerMapProps = {
  latitude: number
  longitude: number
  zoom: number
  places: PlaceSearchResult[]
  selectedPlaceId: string | null
  focus: 'results' | 'place'
  onSelectPlace: (placeId: string) => void
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
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null

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
      >
        <MapCamera latitude={latitude} longitude={longitude} zoom={zoom} />
        <MapPlaces places={places} selectedPlaceId={selectedPlaceId} focus={focus} onSelectPlace={onSelectPlace} />
      </Map>
      {selectedPlace && (
        <article className="planner-place-card">
          <span>{places.findIndex((place) => place.id === selectedPlace.id) + 1}</span>
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
