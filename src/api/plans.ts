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

export async function updatePlanMeals(planId: string, meals: PlanMeals) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const updatedAt = new Date().toISOString()
  await updateDoc(doc(db, 'plans', planId), { ...meals, updatedAt })
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
