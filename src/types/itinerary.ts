import type { PlaceCategory } from './place'

export const itineraryStopKinds = ['lodging', 'visit', 'breakfast', 'lunch', 'dinner'] as const

export type ItineraryStopKind = (typeof itineraryStopKinds)[number]

export type ItineraryStop = {
  placeId: string
  name: string
  category: PlaceCategory
  kind: ItineraryStopKind
  startTime: string
  endTime: string
  travelMinutes: number | null
}

export type ItineraryDay = {
  day: number
  date: string
  stops: ItineraryStop[]
}

export type Itinerary = {
  planId: string
  days: ItineraryDay[]
}
