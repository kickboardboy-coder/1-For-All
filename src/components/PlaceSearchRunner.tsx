import { useEffect, useRef } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { summarizeOpeningHours, type OpeningPeriod } from '../utils/placeSchedule'
import { categoryFromPlaceTypes, placeRole } from '../utils/placeCategory'
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
  iconUrl: string | null
  iconBackgroundColor: string | null
  photoUrl: string | null
}

export type PlaceSearchType = 'airport' | 'train_station'

type PlaceSearchRequest = {
  id: number
  query: string
  includedType?: PlaceSearchType
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
  displayName?: string | { text?: string } | null
  formattedAddress?: string | null
  location?: { lat: number | (() => number); lng: number | (() => number) } | null
  rating?: number | null
  primaryType?: string | null
  types?: string[] | null
  regularOpeningHours?: { periods?: OpeningPeriod[] } | null
  svgIconMaskURI?: string | null
  iconMaskBaseUri?: string | null
  iconBackgroundColor?: string | null
  photos?: Array<{ getURI?: (options?: { maxWidth?: number; maxHeight?: number }) => string }> | null
}

function locationValue(value: number | (() => number)) {
  return typeof value === 'function' ? value() : value
}

function photoUrlOf(photos?: SearchedPlace['photos']) {
  const photo = photos?.[0]

  if (!photo || typeof photo.getURI !== 'function') {
    return null
  }

  try {
    return photo.getURI({ maxWidth: 240, maxHeight: 240 }) || null
  } catch {
    return null
  }
}

function displayNameOf(value: SearchedPlace['displayName']) {
  if (typeof value === 'string') {
    return value
  }

  return value?.text ?? null
}

const shownResultCount = 5
const hubResultCount = 20

function asSearchedPlace(place: SearchedPlace) {
  return {
    id: place.id,
    displayName: place.displayName,
    formattedAddress: place.formattedAddress,
    location: place.location,
    rating: place.rating,
    primaryType: place.primaryType,
    types: place.types,
    regularOpeningHours: place.regularOpeningHours,
    svgIconMaskURI: place.svgIconMaskURI,
    iconMaskBaseUri: place.iconMaskBaseUri,
    iconBackgroundColor: place.iconBackgroundColor,
    photos: place.photos,
  }
}

function namedResults(found: SearchedPlace[]) {
  return found
    .flatMap((place) => {
      const result = toPlaceSearchResult(asSearchedPlace(place))
      return result ? [result] : []
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'ko'))
}

function matchesHubType(place: SearchedPlace, includedType: PlaceSearchType) {
  const types = [place.primaryType, ...(place.types ?? [])].filter(Boolean)
  const name = displayNameOf(place.displayName) ?? ''

  if (includedType === 'airport') {
    return types.includes('airport') || types.includes('international_airport') || /공항|airport/i.test(name)
  }

  return (
    types.includes('train_station') ||
    types.includes('transit_station') ||
    /기차역|철도역|train station/i.test(name) ||
    (name.endsWith('역') && !name.includes('버스'))
  )
}

function topRated(found: SearchedPlace[]) {
  return found
    .map((place, index) => ({ place, index }))
    .sort((left, right) => {
      const ratingDiff = (right.place.rating ?? -1) - (left.place.rating ?? -1)
      return ratingDiff === 0 ? left.index - right.index : ratingDiff
    })
    .slice(0, shownResultCount)
    .flatMap(({ place }) => {
      const result = toPlaceSearchResult(place)
      return result ? [result] : []
    })
}

export function toPlaceSearchResult(place: SearchedPlace): PlaceSearchResult | null {
  const name = displayNameOf(place.displayName)

  if (!place.id || !name || !place.location) {
    return null
  }

  const schedule = summarizeOpeningHours(place.regularOpeningHours?.periods)

  return {
    id: place.id,
    name,
    address: place.formattedAddress ?? null,
    latitude: locationValue(place.location.lat),
    longitude: locationValue(place.location.lng),
    category: placeRole({ name, category: categoryFromPlaceTypes(place.primaryType, place.types) }),
    openingHours: schedule.openingHours,
    closedDays: schedule.closedDays,
    breakTime: schedule.breakTime,
    iconUrl: place.svgIconMaskURI ?? (place.iconMaskBaseUri ? `${place.iconMaskBaseUri}.svg` : null),
    iconBackgroundColor: place.iconBackgroundColor ?? null,
    photoUrl: photoUrlOf(place.photos),
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
    const isHubSearch = Boolean(request.includedType)
    const locationBias =
      latitude === null || longitude === null
        ? undefined
        : { center: { lat: latitude, lng: longitude }, radius: isHubSearch ? 50000 : 25000 }
    const requestSearch = (withType: boolean) =>
      places.Place.searchByText({
        textQuery,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'primaryType', 'types', 'regularOpeningHours', 'photos'],
        language: 'ko',
        region: 'KR',
        maxResultCount: 20,
        locationBias,
        ...(withType && request.includedType ? { includedType: request.includedType } : {}),
      })

    const finish = (found: SearchedPlace[]) => {
      if (ignore) {
        return
      }

      if (!isHubSearch) {
        onSuccessRef.current(request.query, topRated(found))
        return
      }

      const typed = found.filter((place) => matchesHubType(place, request.includedType ?? 'airport'))
      onSuccessRef.current(request.query, namedResults(typed.length > 0 ? typed : found).slice(0, hubResultCount))
    }

    requestSearch(isHubSearch)
      .then(({ places: found }: { places: SearchedPlace[] }) => finish(found))
      .catch(() => {
        if (!isHubSearch) {
          if (!ignore) {
            onErrorRef.current(request.query)
          }
          return
        }

        requestSearch(false)
          .then(({ places: found }: { places: SearchedPlace[] }) => finish(found))
          .catch(() => {
            if (!ignore) {
              onErrorRef.current(request.query)
            }
          })
      })

    return () => {
      ignore = true
    }
  }, [request, places, latitude, longitude, regionName])

  return null
}

export default PlaceSearchRunner
