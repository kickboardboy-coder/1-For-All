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

type NewPlan = {
  country: string
  region: string
  nights: number | null
  startDate: string | null
}

export async function savePlan({ country, region, nights, startDate }: NewPlan): Promise<Plan> {
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
