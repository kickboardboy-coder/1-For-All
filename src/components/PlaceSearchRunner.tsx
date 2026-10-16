import { useEffect, useRef } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'

export type PlaceSearchResult = {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
}

type PlaceSearchRequest = {
  id: number
  query: string
}

type PlaceSearchRunnerProps = {
  request: PlaceSearchRequest | null
  latitude: number | null
  longitude: number | null
  regionName: string | null
  onSuccess: (query: string, results: PlaceSearchResult[]) => void
  onError: (query: string) => void
}

type SearchedPlace = {
  id?: string
  displayName?: string | null
  formattedAddress?: string | null
  location?: { lat: () => number; lng: () => number } | null
}

function toResult(place: SearchedPlace): PlaceSearchResult | null {
  if (!place.id || !place.displayName || !place.location) {
    return null
  }

  return {
    id: place.id,
    name: place.displayName,
    address: place.formattedAddress ?? null,
    latitude: place.location.lat(),
    longitude: place.location.lng(),
  }
}

function PlaceSearchRunner({ request, latitude, longitude, regionName, onSuccess, onError }: PlaceSearchRunnerProps) {
  const places = useMapsLibrary('places')
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError

  useEffect(() => {
    if (!request || !places) {
      return
    }

    let ignore = false
    const textQuery = regionName && !request.query.includes(regionName) ? `${regionName} ${request.query}` : request.query
    const locationBias =
      latitude === null || longitude === null
        ? undefined
        : { center: { lat: latitude, lng: longitude }, radius: 25000 }

    places.Place.searchByText({
      textQuery,
      fields: ['id', 'displayName', 'formattedAddress', 'location'],
      language: 'ko',
      maxResultCount: 5,
      locationBias,
    })
      .then(({ places: found }: { places: SearchedPlace[] }) => {
        if (ignore) {
          return
        }

        onSuccessRef.current(
          request.query,
          found.flatMap((place) => {
            const result = toResult(place)
            return result ? [result] : []
          }),
        )
      })
      .catch(() => {
        if (!ignore) {
          onErrorRef.current(request.query)
        }
      })

    return () => {
      ignore = true
    }
  }, [request, places, latitude, longitude, regionName])

  return null
}

export default PlaceSearchRunner
