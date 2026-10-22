import axios from 'axios'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { markPlanOptimized } from './plans'
import type { PlanLodging, PlanMeals, PlanTransit } from './plans'
import { itineraryStopKinds, mealStopKinds, type Itinerary, type ItineraryDay, type ItineraryStop, type ItineraryStopKind, type MealStopKind } from '../types/itinerary'
import { placeCategories, type Place, type PlaceCategory } from '../types/place'
import { placeRole } from '../utils/placeCategory'
import { closedWeekdayIndexes, isClosedOnDate, weekdayIndexFromDate, weekdayLabels } from '../utils/placeSchedule'

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
  arrival: PlanTransit
  departure: PlanTransit
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
  closedWeekdays: number[]
  closedEveryDay: boolean
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

export const walkSpeedKmh = 4
export const driveSpeedKmh = 30

export function travelMinutes(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  kmPerHour = driveSpeedKmh,
) {
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

  return Math.max(1, Math.round((kilometers / kmPerHour) * 60))
}

function toPromptPlace(
  id: string,
  name: string,
  category: PlaceCategory,
  latitude: number,
  longitude: number,
  openingHours: string | null,
  closedDays: string | null,
  breakTime: string | null,
): PromptPlace {
  const closedWeekdays = closedWeekdayIndexes(closedDays)

  return {
    id,
    name,
    category,
    latitude,
    longitude,
    openingHours,
    closedDays,
    closedWeekdays,
    closedEveryDay: closedWeekdays.length === 7,
    breakTime,
  }
}

function addTransitPlace(listed: PromptPlace[], transit: PlanTransit) {
  if (listed.some((place) => place.id === transit.placeId)) {
    return listed
  }

  return [...listed, toPromptPlace(transit.placeId, transit.name, 'sight', transit.latitude, transit.longitude, null, null, null)]
}

function promptPlaces(places: Place[], lodging: PlanLodging, arrival: PlanTransit, departure: PlanTransit): PromptPlace[] {
  const listed = places.map((place) =>
    toPromptPlace(place.id, place.name, placeRole(place), place.latitude, place.longitude, place.openingHours, place.closedDays, place.breakTime),
  )
  const withLodging = listed.some((place) => place.id === lodging.lodgingPlaceId)
    ? listed
    : [...listed, toPromptPlace(lodging.lodgingPlaceId, lodging.lodgingName, 'stay', lodging.lodgingLatitude, lodging.lodgingLongitude, null, null, null)]

  return addTransitPlace(addTransitPlace(withLodging, arrival), departure)
}

function addCalendarDays(startDate: string, days: number) {
  const match = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return startDate
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)).toISOString().slice(0, 10)
}

function tripCalendar(startDate: string, dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = addCalendarDays(startDate, index)
    const weekdayIndex = weekdayIndexFromDate(date) ?? 0

    return {
      day: index + 1,
      date,
      weekday: weekdayLabels[weekdayIndex],
      weekdayIndex,
    }
  })
}

function closedDayViolations(days: ItineraryDay[], places: PromptPlace[]) {
  return days.flatMap((day) =>
    day.stops.flatMap((stop) => {
      if (stop.kind === 'lodging' || stop.kind === 'arrival' || stop.kind === 'departure') {
        return []
      }

      const place = places.find((item) => item.id === stop.placeId)

      if (!place || !isClosedOnDate(place.closedDays, day.date)) {
        return []
      }

      return [`${place.name}은 ${weekdayLabels[weekdayIndexFromDate(day.date) ?? 0]}요일 휴무인데 ${day.day}일차(${day.date})에 들어갔다.`]
    }),
  )
}

function requiredMealKinds(meals: PlanMeals): MealStopKind[] {
  return mealStopKinds.filter((kind) => {
    if (kind === 'breakfast') {
      return meals.includeBreakfast
    }

    if (kind === 'lunch') {
      return meals.includeLunch
    }

    return meals.includeDinner
  })
}

function clockFromMinutes(value: number) {
  const minutes = Math.max(0, Math.min(23 * 60 + 30, value))
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60 >= 30 ? 30 : 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function minutesFromClock(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function mealWindow(kind: MealStopKind, dayStart: string, dayEnd: string) {
  const startMinutes = minutesFromClock(dayStart)
  const endMinutes = minutesFromClock(dayEnd)
  const preferred =
    kind === 'breakfast'
      ? [startMinutes, startMinutes + 60]
      : kind === 'lunch'
        ? [Math.floor((startMinutes + endMinutes) / 2) - 45, Math.floor((startMinutes + endMinutes) / 2) + 45]
        : [endMinutes - 90, endMinutes]
  let start = Math.max(startMinutes, preferred[0])
  let end = Math.min(endMinutes, preferred[1])

  if (start >= end) {
    start = startMinutes
    end = Math.min(endMinutes, startMinutes + 60)
  }

  if (start >= end) {
    end = Math.min(23 * 60 + 30, start + 30)
  }

  return { startTime: clockFromMinutes(start), endTime: clockFromMinutes(Math.max(end, start + 30)) }
}

function placeCoords(placeId: string, places: PromptPlace[], lodging: PlanLodging) {
  const place = places.find((item) => item.id === placeId)

  if (place) {
    return { latitude: place.latitude, longitude: place.longitude }
  }

  if (placeId === lodging.lodgingPlaceId) {
    return { latitude: lodging.lodgingLatitude, longitude: lodging.lodgingLongitude }
  }

  return null
}

function withStopTravel(stops: ItineraryStop[], places: PromptPlace[], lodging: PlanLodging) {
  return stops.map((stop, index) => {
    if (index === 0) {
      return { ...stop, travelMinutes: null }
    }

    const from = placeCoords(stops[index - 1].placeId, places, lodging)
    const to = placeCoords(stop.placeId, places, lodging)

    if (!from || !to) {
      return stop
    }

    return { ...stop, travelMinutes: travelMinutes(from, to) }
  })
}

function dayClusterCoords(day: ItineraryDay, places: PromptPlace[], lodging: PlanLodging) {
  const preferred = day.stops.filter(
    (stop) => stop.kind === 'visit' || stop.kind === 'arrival' || stop.kind === 'departure' || mealStopKinds.includes(stop.kind as MealStopKind),
  )
  const source = preferred.length > 0 ? preferred : day.stops
  const coords = source
    .map((stop) => placeCoords(stop.placeId, places, lodging))
    .filter((point): point is { latitude: number; longitude: number } => Boolean(point))

  if (coords.length > 0) {
    return coords
  }

  return [{ latitude: lodging.lodgingLatitude, longitude: lodging.lodgingLongitude }]
}

function minutesToDay(place: PromptPlace, day: ItineraryDay, places: PromptPlace[], lodging: PlanLodging) {
  return Math.min(...dayClusterCoords(day, places, lodging).map((point) => travelMinutes(place, point)))
}

function mealStop(kind: MealStopKind, place: PromptPlace, dayStart: string, dayEnd: string): ItineraryStop {
  const window = mealWindow(kind, dayStart, dayEnd)

  return {
    placeId: place.id,
    name: place.name,
    category: place.category,
    kind,
    startTime: window.startTime,
    endTime: window.endTime,
    travelMinutes: 5,
  }
}

function insertMealStop(stops: ItineraryStop[], stop: ItineraryStop) {
  const firstKind = stops[0]?.kind
  const lastKind = stops.at(-1)?.kind
  const first = firstKind === 'lodging' || firstKind === 'arrival' ? 1 : 0
  const last = lastKind === 'lodging' || lastKind === 'departure' ? stops.length - 1 : stops.length

  if (stop.kind === 'breakfast') {
    stops.splice(first, 0, stop)
    return
  }

  if (stop.kind === 'dinner') {
    stops.splice(last, 0, stop)
    return
  }

  stops.splice(Math.min(last, first + Math.ceil((last - first) / 2)), 0, stop)
}

function addMinutesClock(value: string, add: number) {
  const total = minutesFromClock(value) + add

  if (total >= 24 * 60) {
    return '23:59'
  }

  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function transitStop(kind: 'arrival' | 'departure', transit: PlanTransit, places: PromptPlace[]): ItineraryStop {
  const place = places.find((item) => item.id === transit.placeId)
  let startTime = transit.time
  let endTime = addMinutesClock(startTime, 30)

  if (startTime >= endTime) {
    startTime = '23:00'
    endTime = '23:59'
  }

  return {
    placeId: transit.placeId,
    name: transit.name,
    category: place?.category ?? 'sight',
    kind,
    startTime,
    endTime,
    travelMinutes: kind === 'arrival' ? null : 5,
  }
}

function ensureTripAnchors(
  days: ItineraryDay[],
  places: PromptPlace[],
  lodging: PlanLodging,
  arrival: PlanTransit,
  departure: PlanTransit,
) {
  return days.map((day, index) => {
    const stops = day.stops.filter((stop) => stop.kind !== 'arrival' && stop.kind !== 'departure')

    if (index === 0) {
      while (stops[0]?.kind === 'lodging') {
        stops.shift()
      }

      stops.unshift(transitStop('arrival', arrival, places))
    }

    if (index === days.length - 1) {
      while (stops.at(-1)?.kind === 'lodging') {
        stops.pop()
      }

      stops.push(transitStop('departure', departure, places))
    }

    if (stops.length === 0) {
      return day
    }

    return { ...day, stops: withStopTravel(stops, places, lodging) }
  })
}

function lodgingStop(lodging: PlanLodging, edge: 'start' | 'end', dayStart: string, dayEnd: string): ItineraryStop {
  const startMinutes = minutesFromClock(dayStart)
  const endMinutes = minutesFromClock(dayEnd)
  const start = edge === 'start' ? startMinutes : Math.max(startMinutes, endMinutes - 30)
  const end = edge === 'start' ? Math.min(endMinutes, startMinutes + 30) : endMinutes

  return {
    placeId: lodging.lodgingPlaceId,
    name: lodging.lodgingName,
    category: 'stay',
    kind: 'lodging',
    startTime: clockFromMinutes(start),
    endTime: clockFromMinutes(Math.max(end, start + 30)),
    travelMinutes: edge === 'start' ? null : 5,
  }
}

function ensureLodgingStops(days: ItineraryDay[], places: PromptPlace[], lodging: PlanLodging, dayStart: string, dayEnd: string) {
  if (days.length <= 1) {
    return days
  }

  return days.map((day, index) => {
    const stops = day.stops.filter((stop) => stop.kind !== 'lodging')
    const isFirst = index === 0
    const isLast = index === days.length - 1

    if (!isFirst) {
      const insertAt = stops[0]?.kind === 'arrival' ? 1 : 0
      stops.splice(insertAt, 0, lodgingStop(lodging, 'start', dayStart, dayEnd))
    }

    if (!isLast) {
      const insertAt = stops.at(-1)?.kind === 'departure' ? stops.length - 1 : stops.length
      stops.splice(insertAt, 0, lodgingStop(lodging, 'end', dayStart, dayEnd))
    }

    return { ...day, stops: withStopTravel(stops, places, lodging) }
  })
}

function ensureDailyMeals(
  days: ItineraryDay[],
  places: PromptPlace[],
  lodging: PlanLodging,
  meals: PlanMeals,
  dayStart: string,
  dayEnd: string,
) {
  const required = requiredMealKinds(meals)
  const usedPlaceIds = new Set<string>()

  const cleaned = days.map((day) => {
    const seenMeals = new Set<MealStopKind>()
    const stops: ItineraryStop[] = []

    day.stops.forEach((stop) => {
      if (stop.kind === 'lodging') {
        usedPlaceIds.add(stop.placeId)
        stops.push(stop)
        return
      }

      if (mealStopKinds.includes(stop.kind as MealStopKind)) {
        if (!required.includes(stop.kind as MealStopKind) || seenMeals.has(stop.kind as MealStopKind)) {
          return
        }

        const place = places.find((item) => item.id === stop.placeId)
        const canKeep =
          place &&
          place.category === 'food' &&
          !usedPlaceIds.has(stop.placeId) &&
          !isClosedOnDate(place.closedDays, day.date)

        if (!canKeep) {
          return
        }

        seenMeals.add(stop.kind as MealStopKind)
        usedPlaceIds.add(stop.placeId)
        stops.push(stop)
        return
      }

      if (stop.kind === 'arrival' || stop.kind === 'departure') {
        usedPlaceIds.add(stop.placeId)
        stops.push(stop)
        return
      }

      if (stop.placeId === lodging.lodgingPlaceId || usedPlaceIds.has(stop.placeId)) {
        return
      }

      usedPlaceIds.add(stop.placeId)
      stops.push(stop)
    })

    return { ...day, stops }
  })

  const leftoverFoods = places.filter((place) => place.category === 'food' && !usedPlaceIds.has(place.id))

  while (leftoverFoods.length > 0) {
    let bestIndex = -1
    let bestDay: ItineraryDay | null = null
    let bestKind: MealStopKind | null = null
    let bestMinutes = Number.POSITIVE_INFINITY

    leftoverFoods.forEach((place, index) => {
      const openDays = cleaned.filter((day) => !isClosedOnDate(place.closedDays, day.date))

      if (openDays.length === 0) {
        return
      }

      const nearest = openDays.reduce((best, day) => {
        const nearestMinutes = minutesToDay(place, best, places, lodging)
        const dayMinutes = minutesToDay(place, day, places, lodging)

        if (dayMinutes < nearestMinutes || (dayMinutes === nearestMinutes && day.day < best.day)) {
          return day
        }

        return best
      })
      const kind = required.find((mealKind) => !nearest.stops.some((stop) => stop.kind === mealKind))

      if (!kind) {
        return
      }

      const minutes = minutesToDay(place, nearest, places, lodging)

      if (
        minutes < bestMinutes ||
        (minutes === bestMinutes && (bestDay === null || nearest.day < bestDay.day))
      ) {
        bestIndex = index
        bestDay = nearest
        bestKind = kind
        bestMinutes = minutes
      }
    })

    if (bestIndex < 0 || !bestDay || !bestKind) {
      break
    }

    const [place] = leftoverFoods.splice(bestIndex, 1)
    usedPlaceIds.add(place.id)
    insertMealStop(bestDay.stops, mealStop(bestKind, place, dayStart, dayEnd))
  }

  return cleaned.map((day) => ({ ...day, stops: withStopTravel(day.stops, places, lodging) }))
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

  const days = value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return null
    }

    const day = item as Record<string, unknown>
    const date = addCalendarDays(startDate, index)

    if (day.day !== index + 1 || day.date !== date || !isDate(day.date) || !Array.isArray(day.stops)) {
      return null
    }

    const stops = day.stops.map((stop) => toStop(stop, places)).filter((stop): stop is ItineraryStop => Boolean(stop))

    if (stops[0] && stops[0].travelMinutes !== null) {
      stops[0] = { ...stops[0], travelMinutes: null }
    }

    return { day: index + 1, date, stops }
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
  arrival,
  departure,
  places,
}: OptimizeInput): Promise<Itinerary> {
  const listedPlaces = promptPlaces(places, lodging, arrival, departure)
  const dayCount = nights + 1
  const calendar = tripCalendar(startDate, dayCount)
  const request = {
    country,
    region,
    nights,
    days: dayCount,
    startDate,
    dayStart,
    dayEnd,
    calendar,
    weekdayIndex: '0=일요일, 1=월요일, 2=화요일, 3=수요일, 4=목요일, 5=금요일, 6=토요일',
    meals,
    lodging: {
      placeId: lodging.lodgingPlaceId,
      name: lodging.lodgingName,
      latitude: lodging.lodgingLatitude,
      longitude: lodging.lodgingLongitude,
    },
    arrival: {
      transport: arrival.transport,
      placeId: arrival.placeId,
      name: arrival.name,
      time: arrival.time,
    },
    departure: {
      transport: departure.transport,
      placeId: departure.placeId,
      name: departure.name,
      time: departure.time,
    },
    places: listedPlaces,
    travelMinutes: travelPairs(listedPlaces),
  }
  const systemPrompt =
    '여행 일정을 JSON으로만 만든다. 주어진 장소 id만 쓴다. 주머니의 관광지와 맛집 id는 일정 전체에서 한 번만 쓴다. 같은 장소를 여러 끼니나 여러 날에 반복하지 않는다. 장소가 모자라면 끼니나 visit을 생략하고 칸을 비운다. 빈 칸이 있어도 앞날부터 억지로 채우지 말고, travelMinutes와 좌표를 보고 가까운 관광지와 맛집끼리 같은 날에 묶는다. 맛집이 둘째 날 관광지와 더 가까우면 첫째 날 끼니를 비우고 둘째 날에 넣는다. 다른 날 동선과 더 가까운 장소를 빈 칸 메우기용으로 먼 날에 넣지 않는다. 거리가 비슷할 때만 1일차부터 채운다. 1일차는 arrival 다음에 도착 시각 이후 활동 시간이 남아 있고 넣을 장소가 그날 동선과 가까우면 관광지와 맛집을 넣고, 그다음 숙소로 하루를 마친다. 중간 날은 숙소로 시작해 숙소로 끝낸다. 마지막 날은 숙소에서 시작해 departure로 끝낸다. 숙소는 지정된 lodging placeId를 쓰고 visit나 끼니로 쓰지 않으며 여러 날에 반복한다. calendar의 weekdayIndex가 그 장소 closedWeekdays에 있으면 lodging이 아닌 방문으로 넣지 말고, 다른 요일로 옮기거나 일정에서 뺀다. closedEveryDay가 true면 그 장소는 방문하지 않는다. 영업시간과 브레이크 타임을 피한다. 하루 일정은 dayStart와 dayEnd 안에 둔다. 1일차 첫 장소는 arrival이고 숙소로 시작하지 않는다. 마지막 날 마지막 장소는 departure이고 숙소로 끝내지 않는다. includeBreakfast가 true면 가능한 날만 kind=breakfast를 넣고, 쓸 맛집이 없으면 넣지 않는다. includeLunch, includeDinner도 같다. 아침·점심·저녁은 category가 food인 맛집만 쓰고, 카페는 sight이므로 끼니가 아니라 visit로만 넣는다. travelMinutes는 같은 날 바로 앞 장소에서 이동하는 분이고, 하루의 첫 장소는 null이다. 장소 사이 이동은 travelMinutes 목록을 따른다. day는 1부터 시작하고 date는 calendar와 같아야 한다.'

  async function complete(messages: Array<{ role: 'system' | 'user'; content: string }>) {
    const response = await axios.post(
      '/openai/v1/chat/completions',
      {
        model,
        temperature: 0.2,
        messages,
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

    return days
  }

  try {
    const baseMessages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(request) },
    ]
    const shapedDays = (days: ItineraryDay[]) =>
      ensureDailyMeals(
        ensureLodgingStops(ensureTripAnchors(days, listedPlaces, lodging, arrival, departure), listedPlaces, lodging, dayStart, dayEnd),
        listedPlaces,
        lodging,
        meals,
        dayStart,
        dayEnd,
      )
    const firstDays = shapedDays(await complete(baseMessages))
    const firstViolations = closedDayViolations(firstDays, listedPlaces)

    if (firstViolations.length === 0) {
      return { planId, days: firstDays }
    }

    const retryDays = shapedDays(
      await complete([
        ...baseMessages,
        {
          role: 'user',
          content: `잘못된 일정이다. 휴무일에 넣은 장소를 다른 요일로 옮기거나 빼서 다시 만들어라. 관광지와 맛집은 일정 전체에서 한 번만 쓰고, 모자라면 끼니나 방문을 생략하라. 빈 칸을 앞날부터 억지로 채우지 말고 가까운 관광지와 맛집끼리 같은 날에 묶어라. 다른 날 방문지와 더 가까운 맛집은 그쪽 날에 넣어라. 1일차는 arrival로 시작하고 마지막 날은 departure로 끝내라.\n${firstViolations.join('\n')}`,
        },
      ]),
    )
    const retryViolations = closedDayViolations(retryDays, listedPlaces)

    if (retryViolations.length > 0) {
      throw new Error('휴무일인 장소가 일정에 남아 있어요. 다시 시도해 주세요.')
    }

    return { planId, days: retryDays }
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
