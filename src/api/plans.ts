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
import { auth, db } from '../firebase'
import { planStatuses, type Plan, type PlanStatus } from '../types/plan'

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
  if (!transit) {
    if (gate === 'arrival') {
      return {
        arrivalTransport: null,
        arrivalPlaceId: null,
        arrivalPlaceName: null,
        arrivalLatitude: null,
        arrivalLongitude: null,
        arrivalTime: null,
      }
    }

    return {
      departureTransport: null,
      departurePlaceId: null,
      departurePlaceName: null,
      departureLatitude: null,
      departureLongitude: null,
      departureTime: null,
    }
  }

  if (gate === 'arrival') {
    return {
      arrivalTransport: transit.transport,
      arrivalPlaceId: transit.placeId,
      arrivalPlaceName: transit.name,
      arrivalLatitude: transit.latitude,
      arrivalLongitude: transit.longitude,
      arrivalTime: transit.time,
    }
  }

  return {
    departureTransport: transit.transport,
    departurePlaceId: transit.placeId,
    departurePlaceName: transit.name,
    departureLatitude: transit.latitude,
    departureLongitude: transit.longitude,
    departureTime: transit.time,
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
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

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
    status: 'pending' as const,
    updatedAt: new Date().toISOString(),
  }
  const docRef = await addDoc(collection(db, 'plans'), plan)

  return { id: docRef.id, ...plan }
}

export async function updatePlanDestination(planId: string, country: string, region: string) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { country, region, updatedAt })
  return updatedAt
}

export async function updatePlanSchedule(planId: string, nights: number | null, startDate: string | null) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { nights, startDate, updatedAt })
  return updatedAt
}

export async function updatePlanLodging(planId: string, lodging: PlanLodging | null) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), {
    lodgingPlaceId: lodging?.lodgingPlaceId ?? null,
    lodgingName: lodging?.lodgingName ?? null,
    lodgingLatitude: lodging?.lodgingLatitude ?? null,
    lodgingLongitude: lodging?.lodgingLongitude ?? null,
    updatedAt,
  })
  return updatedAt
}

export async function updatePlanDayHours(planId: string, dayStart: string | null, dayEnd: string | null) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { dayStart, dayEnd, updatedAt })
  return updatedAt
}

export async function updatePlanTransit(planId: string, gate: 'arrival' | 'departure', transit: PlanTransit | null) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { ...transitFields(gate, transit), updatedAt })
  return updatedAt
}

export async function updatePlanMeals(planId: string, meals: PlanMeals) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { ...meals, updatedAt })
  return updatedAt
}

export async function markPlanOptimized(planId: string) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { status: 'optimized', updatedAt })
  return updatedAt
}

export async function touchPlan(planId: string) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  await updateDoc(doc(db, 'plans', planId), { updatedAt: new Date().toISOString() })
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
    status: data.status,
    updatedAt: data.updatedAt,
  }
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

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
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const snapshot = await getDocs(
    query(collection(db, 'plans'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc')),
  )

  return snapshot.docs.flatMap((item) => {
    const plan = toPlan(item.id, item.data())
    return plan ? [plan] : []
  })
}
