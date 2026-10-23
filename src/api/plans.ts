import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase'
import { planStatuses, type Plan, type PlanStatus } from '../types/plan'
import { commitBatched } from './batch'
import { requireUser } from './session'

export type PlanLodging = {
  lodgingPlaceId: string
  lodgingName: string
  lodgingLatitude: number
  lodgingLongitude: number
}

export type PlanMeals = {
  includeBreakfast: boolean
  includeLunch: boolean
  includeDinner: boolean
}

export const transitModes = ['flight', 'train', 'car'] as const

export type TransitMode = (typeof transitModes)[number]

export type PlanTransit = {
  transport: TransitMode
  placeId: string
  name: string
  latitude: number
  longitude: number
  time: string
}

export const transitModeLabel: Record<TransitMode, string> = {
  flight: '비행기',
  train: '기차',
  car: '자가용',
}

export function isTransitMode(value: unknown): value is TransitMode {
  return transitModes.some((mode) => mode === value)
}

const emptyTransitFields = {
  arrivalTransport: null,
  arrivalPlaceId: null,
  arrivalPlaceName: null,
  arrivalLatitude: null,
  arrivalLongitude: null,
  arrivalTime: null,
  departureTransport: null,
  departurePlaceId: null,
  departurePlaceName: null,
  departureLatitude: null,
  departureLongitude: null,
  departureTime: null,
}

function transitFields(gate: 'arrival' | 'departure', transit: PlanTransit | null) {
  if (gate === 'arrival') {
    return {
      arrivalTransport: transit?.transport ?? null,
      arrivalPlaceId: transit?.placeId ?? null,
      arrivalPlaceName: transit?.name ?? null,
      arrivalLatitude: transit?.latitude ?? null,
      arrivalLongitude: transit?.longitude ?? null,
      arrivalTime: transit?.time ?? null,
    }
  }

  return {
    departureTransport: transit?.transport ?? null,
    departurePlaceId: transit?.placeId ?? null,
    departurePlaceName: transit?.name ?? null,
    departureLatitude: transit?.latitude ?? null,
    departureLongitude: transit?.longitude ?? null,
    departureTime: transit?.time ?? null,
  }
}

export function transitFromPlan(plan: Plan, gate: 'arrival' | 'departure'): PlanTransit | null {
  if (gate === 'arrival') {
    if (
      !isTransitMode(plan.arrivalTransport) ||
      !plan.arrivalPlaceId ||
      !plan.arrivalPlaceName ||
      plan.arrivalLatitude === null ||
      plan.arrivalLongitude === null ||
      !plan.arrivalTime
    ) {
      return null
    }

    return {
      transport: plan.arrivalTransport,
      placeId: plan.arrivalPlaceId,
      name: plan.arrivalPlaceName,
      latitude: plan.arrivalLatitude,
      longitude: plan.arrivalLongitude,
      time: plan.arrivalTime,
    }
  }

  if (
    !isTransitMode(plan.departureTransport) ||
    !plan.departurePlaceId ||
    !plan.departurePlaceName ||
    plan.departureLatitude === null ||
    plan.departureLongitude === null ||
    !plan.departureTime
  ) {
    return null
  }

  return {
    transport: plan.departureTransport,
    placeId: plan.departurePlaceId,
    name: plan.departurePlaceName,
    latitude: plan.departureLatitude,
    longitude: plan.departureLongitude,
    time: plan.departureTime,
  }
}

type NewPlan = {
  country: string
  region: string
  nights: number | null
  startDate: string | null
  lodging: PlanLodging | null
  dayStart: string | null
  dayEnd: string | null
  meals: PlanMeals
}

export async function savePlan({ country, region, nights, startDate, lodging, dayStart, dayEnd, meals }: NewPlan): Promise<Plan> {
  const user = requireUser()

  const plan = {
    userId: user.uid,
    country,
    region,
    nights,
    startDate,
    lodgingPlaceId: lodging?.lodgingPlaceId ?? null,
    lodgingName: lodging?.lodgingName ?? null,
    lodgingLatitude: lodging?.lodgingLatitude ?? null,
    lodgingLongitude: lodging?.lodgingLongitude ?? null,
    dayStart,
    dayEnd,
    includeBreakfast: meals.includeBreakfast,
    includeLunch: meals.includeLunch,
    includeDinner: meals.includeDinner,
    ...emptyTransitFields,
    savedAt: null,
    status: 'pending' as const,
    updatedAt: new Date().toISOString(),
  }
  const docRef = await addDoc(collection(db, 'plans'), plan)

  return { id: docRef.id, ...plan }
}

async function updatePlanFields(planId: string, fields: Record<string, unknown>) {
  requireUser()

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { ...fields, updatedAt })
  return updatedAt
}

export async function updatePlanDestination(planId: string, country: string, region: string) {
  return updatePlanFields(planId, { country, region })
}

export async function updatePlanSchedule(planId: string, nights: number | null, startDate: string | null) {
  return updatePlanFields(planId, { nights, startDate })
}

export async function updatePlanLodging(planId: string, lodging: PlanLodging | null) {
  return updatePlanFields(planId, {
    lodgingPlaceId: lodging?.lodgingPlaceId ?? null,
    lodgingName: lodging?.lodgingName ?? null,
    lodgingLatitude: lodging?.lodgingLatitude ?? null,
    lodgingLongitude: lodging?.lodgingLongitude ?? null,
  })
}

export async function updatePlanDayHours(planId: string, dayStart: string | null, dayEnd: string | null) {
  return updatePlanFields(planId, { dayStart, dayEnd })
}

export async function updatePlanTransit(planId: string, gate: 'arrival' | 'departure', transit: PlanTransit | null) {
  return updatePlanFields(planId, transitFields(gate, transit))
}

export async function updatePlanMeals(planId: string, meals: PlanMeals) {
  return updatePlanFields(planId, { ...meals })
}

export async function markPlanSaved(planId: string) {
  requireUser()

  const savedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { savedAt, updatedAt: savedAt })
  return savedAt
}

export async function touchPlan(planId: string) {
  await updatePlanFields(planId, {})
}

function isPlanStatus(value: unknown): value is PlanStatus {
  return planStatuses.some((status) => status === value)
}

function toPlan(id: string, data: DocumentData): Plan | null {
  if (
    typeof data.userId !== 'string' ||
    typeof data.region !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    !isPlanStatus(data.status)
  ) {
    return null
  }

  return {
    id,
    userId: data.userId,
    country: typeof data.country === 'string' ? data.country : null,
    region: data.region,
    nights: typeof data.nights === 'number' ? data.nights : null,
    startDate: typeof data.startDate === 'string' ? data.startDate : null,
    lodgingPlaceId: typeof data.lodgingPlaceId === 'string' ? data.lodgingPlaceId : null,
    lodgingName: typeof data.lodgingName === 'string' ? data.lodgingName : null,
    lodgingLatitude: typeof data.lodgingLatitude === 'number' ? data.lodgingLatitude : null,
    lodgingLongitude: typeof data.lodgingLongitude === 'number' ? data.lodgingLongitude : null,
    dayStart: typeof data.dayStart === 'string' ? data.dayStart : null,
    dayEnd: typeof data.dayEnd === 'string' ? data.dayEnd : null,
    includeBreakfast: typeof data.includeBreakfast === 'boolean' ? data.includeBreakfast : null,
    includeLunch: typeof data.includeLunch === 'boolean' ? data.includeLunch : null,
    includeDinner: typeof data.includeDinner === 'boolean' ? data.includeDinner : null,
    arrivalTransport: typeof data.arrivalTransport === 'string' ? data.arrivalTransport : null,
    arrivalPlaceId: typeof data.arrivalPlaceId === 'string' ? data.arrivalPlaceId : null,
    arrivalPlaceName: typeof data.arrivalPlaceName === 'string' ? data.arrivalPlaceName : null,
    arrivalLatitude: typeof data.arrivalLatitude === 'number' ? data.arrivalLatitude : null,
    arrivalLongitude: typeof data.arrivalLongitude === 'number' ? data.arrivalLongitude : null,
    arrivalTime: typeof data.arrivalTime === 'string' ? data.arrivalTime : null,
    departureTransport: typeof data.departureTransport === 'string' ? data.departureTransport : null,
    departurePlaceId: typeof data.departurePlaceId === 'string' ? data.departurePlaceId : null,
    departurePlaceName: typeof data.departurePlaceName === 'string' ? data.departurePlaceName : null,
    departureLatitude: typeof data.departureLatitude === 'number' ? data.departureLatitude : null,
    departureLongitude: typeof data.departureLongitude === 'number' ? data.departureLongitude : null,
    departureTime: typeof data.departureTime === 'string' ? data.departureTime : null,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : null,
    status: data.status,
    updatedAt: data.updatedAt,
  }
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const user = requireUser()

  const snapshot = await getDoc(doc(db, 'plans', planId))

  if (!snapshot.exists()) {
    return null
  }

  const plan = toPlan(snapshot.id, snapshot.data())

  if (!plan || plan.userId !== user.uid) {
    return null
  }

  return plan
}

export async function getPlans(): Promise<Plan[]> {
  const user = requireUser()

  const snapshot = await getDocs(
    query(collection(db, 'plans'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc')),
  )

  return snapshot.docs.flatMap((item) => {
    const plan = toPlan(item.id, item.data())
    return plan ? [plan] : []
  })
}

export async function deletePlan(planId: string) {
  const user = requireUser()

  const planRef = doc(db, 'plans', planId)
  const snapshot = await getDoc(planRef)

  if (!snapshot.exists() || snapshot.data().userId !== user.uid) {
    throw new Error('여행 계획을 삭제하지 못했습니다.')
  }

  const [places, itinerary] = await Promise.all([
    getDocs(collection(db, 'plans', planId, 'places')),
    getDocs(collection(db, 'plans', planId, 'itinerary')),
  ])
  const refs = [...places.docs.map((item) => item.ref), ...itinerary.docs.map((item) => item.ref), planRef]
  await commitBatched(refs.map((ref) => (batch) => batch.delete(ref)))

  try {
    localStorage.removeItem(`euihang-day-colors:${planId}`)
  } catch {
    return
  }
}
