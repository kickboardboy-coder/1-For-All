import { useEffect, useRef } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { summarizeOpeningHours, type OpeningPeriod } from '../utils/placeSchedule'
import { categoryFromPlaceTypes } from '../utils/placeCategory'
import type { PlaceCategory } from '../types/place'

export type PlaceSearchResult = {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  category: PlaceCategory
  openingHours: string | null
  closedDays: string | null
  breakTime: string | null
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
  rating?: number | null
  primaryType?: string | null
  types?: string[] | null
  regularOpeningHours?: { periods?: OpeningPeriod[] } | null
}

const shownResultCount = 5

function topRated(found: SearchedPlace[]) {
  return found
    .map((place, index) => ({ place, index }))
    .sort((left, right) => {
      const ratingDiff = (right.place.rating ?? -1) - (left.place.rating ?? -1)
      return ratingDiff === 0 ? left.index - right.index : ratingDiff
    })
    .slice(0, shownResultCount)
    .flatMap(({ place }) => {
      const result = toResult(place)
      return result ? [result] : []
    })
}

function toResult(place: SearchedPlace): PlaceSearchResult | null {
  if (!place.id || !place.displayName || !place.location) {
    return null
  }

  const schedule = summarizeOpeningHours(place.regularOpeningHours?.periods)

  return {
    id: place.id,
    name: place.displayName,
    address: place.formattedAddress ?? null,
    latitude: place.location.lat(),
    longitude: place.location.lng(),
    category: categoryFromPlaceTypes(place.primaryType, place.types),
    openingHours: schedule.openingHours,
    closedDays: schedule.closedDays,
    breakTime: schedule.breakTime,
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
      fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'primaryType', 'types', 'regularOpeningHours'],
      language: 'ko',
      maxResultCount: 20,
      locationBias,
    })
      .then(({ places: found }: { places: SearchedPlace[] }) => {
        if (ignore) {
          return
        }

        onSuccessRef.current(request.query, topRated(found))
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
