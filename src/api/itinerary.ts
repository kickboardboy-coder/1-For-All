import axios from 'axios'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { markPlanOptimized } from './plans'
import type { PlanLodging, PlanMeals } from './plans'
import { itineraryStopKinds, type Itinerary, type ItineraryDay, type ItineraryStop, type ItineraryStopKind } from '../types/itinerary'
import { placeCategories, type Place, type PlaceCategory } from '../types/place'

const model = 'gpt-4.1-mini'

type OptimizeInput = {
  planId: string
  country: string | null
  region: string
  nights: number
  startDate: string
  dayStart: string
  dayEnd: string
  meals: PlanMeals
  lodging: PlanLodging
  places: Place[]
}

type PromptPlace = {
  id: string
  name: string
  category: PlaceCategory
  latitude: number
  longitude: number
  openingHours: string | null
  closedDays: string | null
  breakTime: string | null
}

const itinerarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['days'],
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'date', 'stops'],
        properties: {
          day: { type: 'integer' },
          date: { type: 'string' },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['placeId', 'name', 'category', 'kind', 'startTime', 'endTime', 'travelMinutes'],
              properties: {
                placeId: { type: 'string' },
                name: { type: 'string' },
                category: { type: 'string', enum: [...placeCategories] },
                kind: { type: 'string', enum: [...itineraryStopKinds] },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                travelMinutes: { type: ['integer', 'null'] },
              },
            },
          },
        },
      },
    },
  },
} as const

function travelMinutes(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371
  const toRadians = (degree: number) => (degree * Math.PI) / 180
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2
  const kilometers = 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine))

  return Math.max(5, Math.round((kilometers / 20) * 60))
}

function promptPlaces(places: Place[], lodging: PlanLodging): PromptPlace[] {
  const listed = places.map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    latitude: place.latitude,
    longitude: place.longitude,
    openingHours: place.openingHours,
    closedDays: place.closedDays,
    breakTime: place.breakTime,
  }))

  if (listed.some((place) => place.id === lodging.lodgingPlaceId)) {
    return listed
  }

  return [
    ...listed,
    {
      id: lodging.lodgingPlaceId,
      name: lodging.lodgingName,
      category: 'stay',
      latitude: lodging.lodgingLatitude,
      longitude: lodging.lodgingLongitude,
      openingHours: null,
      closedDays: null,
      breakTime: null,
    },
  ]
}

function travelPairs(places: PromptPlace[]) {
  return places.flatMap((from, index) =>
    places.slice(index + 1).map((to) => ({
      from: from.id,
      to: to.id,
      minutes: travelMinutes(from, to),
    })),
  )
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isCategory(value: unknown): value is PlaceCategory {
  return placeCategories.some((category) => category === value)
}

function isKind(value: unknown): value is ItineraryStopKind {
  return itineraryStopKinds.some((kind) => kind === value)
}

function toStop(value: unknown, places: PromptPlace[]): ItineraryStop | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const stop = value as Record<string, unknown>
  const place = places.find((item) => item.id === stop.placeId)

  if (
    !place ||
    stop.name !== place.name ||
    !isCategory(stop.category) ||
    stop.category !== place.category ||
    !isKind(stop.kind) ||
    !isTime(stop.startTime) ||
    !isTime(stop.endTime) ||
    stop.startTime >= stop.endTime ||
    !(stop.travelMinutes === null || (typeof stop.travelMinutes === 'number' && Number.isInteger(stop.travelMinutes) && stop.travelMinutes >= 0))
  ) {
    return null
  }

  return {
    placeId: place.id,
    name: place.name,
    category: place.category,
    kind: stop.kind,
    startTime: stop.startTime,
    endTime: stop.endTime,
    travelMinutes: stop.travelMinutes,
  }
}

function toDays(value: unknown, places: PromptPlace[], dayCount: number, startDate: string): ItineraryDay[] | null {
  if (!Array.isArray(value) || value.length !== dayCount) {
    return null
  }

  const start = new Date(`${startDate}T00:00:00Z`)
  const days = value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return null
    }

    const day = item as Record<string, unknown>
    const expectedDate = new Date(start)
    expectedDate.setUTCDate(start.getUTCDate() + index)
    const date = expectedDate.toISOString().slice(0, 10)

    if (day.day !== index + 1 || day.date !== date || !isDate(day.date) || !Array.isArray(day.stops) || day.stops.length === 0) {
      return null
    }

    const stops = day.stops.map((stop) => toStop(stop, places))

    if (stops.some((stop) => !stop) || stops[0]?.travelMinutes !== null) {
      return null
    }

    return { day: index + 1, date, stops: stops.filter((stop): stop is ItineraryStop => Boolean(stop)) }
  })

  if (days.some((day) => !day)) {
    return null
  }

  return days.filter((day): day is ItineraryDay => Boolean(day))
}

export async function requestItinerary({
  planId,
  country,
  region,
  nights,
  startDate,
  dayStart,
  dayEnd,
  meals,
  lodging,
  places,
}: OptimizeInput): Promise<Itinerary> {
  const listedPlaces = promptPlaces(places, lodging)
  const dayCount = nights + 1
  const request = {
    country,
    region,
    nights,
    days: dayCount,
    startDate,
    dayStart,
    dayEnd,
    meals,
    lodging: {
      placeId: lodging.lodgingPlaceId,
      name: lodging.lodgingName,
      latitude: lodging.lodgingLatitude,
      longitude: lodging.lodgingLongitude,
    },
    places: listedPlaces,
    travelMinutes: travelPairs(listedPlaces),
  }

  try {
    const response = await axios.post(
      '/openai/v1/chat/completions',
      {
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              '여행 일정을 JSON으로만 만든다. 주어진 장소 id만 쓴다. 휴무일에는 그 장소를 넣지 않고, 영업시간과 브레이크 타임을 피한다. 하루 일정은 dayStart와 dayEnd 안에 둔다. 숙소에서 시작해 숙소로 끝낸다. includeBreakfast, includeLunch, includeDinner가 true인 끼니만 맛집 방문으로 넣는다. travelMinutes는 같은 날 바로 앞 장소에서 이동하는 분이고, 하루의 첫 장소는 null이다. 장소 사이 이동은 travelMinutes 목록을 따른다. day는 1부터 시작하고 date는 startDate부터 하루씩 늘어난 YYYY-MM-DD다.',
          },
          { role: 'user', content: JSON.stringify(request) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'itinerary',
            strict: true,
            schema: itinerarySchema,
          },
        },
      },
      { timeout: 60000 },
    )
    const content = response.data?.choices?.[0]?.message?.content

    if (typeof content !== 'string') {
      throw new Error('최적화 결과를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }

    let parsed: { days?: unknown }

    try {
      parsed = JSON.parse(content) as { days?: unknown }
    } catch {
      throw new Error('최적화 결과를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    const days = toDays(parsed.days, listedPlaces, dayCount, startDate)

    if (!days) {
      throw new Error('최적화 결과가 여행 조건과 맞지 않아요. 잠시 후 다시 시도해 주세요.')
    }

    return { planId, days }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error('OpenAI API 키를 설정해 주세요.')
    }

    if (error instanceof Error && !axios.isAxiosError(error)) {
      throw error
    }

    throw new Error('최적화를 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

function itineraryCollection(planId: string) {
  return collection(db, 'plans', planId, 'itinerary')
}

function stopDocId(day: number, order: number) {
  return `${String(day).padStart(2, '0')}-${String(order).padStart(2, '0')}`
}

function requireUser() {
  if (!auth.currentUser) {
    throw new Error('로그인된 사용자가 없습니다.')
  }
}

async function commitRefs(operations: Array<{ kind: 'delete' | 'set'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }>) {
  const chunkSize = 400

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db)
    operations.slice(index, index + chunkSize).forEach((operation) => {
      if (operation.kind === 'delete') {
        batch.delete(operation.ref)
        return
      }

      batch.set(operation.ref, operation.data ?? {})
    })
    await batch.commit()
  }
}

export async function saveItinerary(itinerary: Itinerary) {
  requireUser()

  const existing = await getDocs(itineraryCollection(itinerary.planId))
  const operations: Array<{ kind: 'delete' | 'set'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }> = existing.docs.map((item) => ({
    kind: 'delete',
    ref: item.ref,
  }))

  itinerary.days.forEach((day) => {
    day.stops.forEach((stop, order) => {
      operations.push({
        kind: 'set',
        ref: doc(itineraryCollection(itinerary.planId), stopDocId(day.day, order)),
        data: {
          planId: itinerary.planId,
          day: day.day,
          date: day.date,
          order,
          placeId: stop.placeId,
          name: stop.name,
          category: stop.category,
          kind: stop.kind,
          startTime: stop.startTime,
          endTime: stop.endTime,
          travelMinutes: stop.travelMinutes,
        },
      })
    })
  })

  await commitRefs(operations)

  try {
    return await markPlanOptimized(itinerary.planId)
  } catch (error) {
    if (error instanceof Error && error.message === '로그인된 사용자가 없습니다.') {
      throw error
    }

    throw new Error('플랜 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

function savedStop(data: Record<string, unknown>): (ItineraryStop & { day: number; date: string; order: number }) | null {
  if (
    typeof data.day !== 'number' ||
    typeof data.date !== 'string' ||
    typeof data.order !== 'number' ||
    typeof data.placeId !== 'string' ||
    typeof data.name !== 'string' ||
    !isCategory(data.category) ||
    !isKind(data.kind) ||
    !isTime(data.startTime) ||
    !isTime(data.endTime) ||
    !(data.travelMinutes === null || typeof data.travelMinutes === 'number')
  ) {
    return null
  }

  return {
    day: data.day,
    date: data.date,
    order: data.order,
    placeId: data.placeId,
    name: data.name,
    category: data.category,
    kind: data.kind,
    startTime: data.startTime,
    endTime: data.endTime,
    travelMinutes: data.travelMinutes,
  }
}

export async function getItinerary(planId: string): Promise<Itinerary | null> {
  requireUser()

  const snapshot = await getDocs(itineraryCollection(planId))
  const stops = snapshot.docs
    .flatMap((item) => {
      const stop = savedStop(item.data())
      return stop ? [stop] : []
    })
    .sort((left, right) => left.day - right.day || left.order - right.order)

  if (stops.length === 0) {
    return null
  }

  const days: ItineraryDay[] = []

  stops.forEach((stop) => {
    const current = days.at(-1)
    const nextStop = {
      placeId: stop.placeId,
      name: stop.name,
      category: stop.category,
      kind: stop.kind,
      startTime: stop.startTime,
      endTime: stop.endTime,
      travelMinutes: stop.travelMinutes,
    }

    if (current && current.day === stop.day) {
      current.stops.push(nextStop)
      return
    }

    days.push({ day: stop.day, date: stop.date, stops: [nextStop] })
  })

  return { planId, days }
}
