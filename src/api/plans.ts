import { addDoc, collection, getDocs, orderBy, query, where, type DocumentData } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { planStatuses, type Plan, type PlanStatus } from '../types/plan'

type NewPlan = {
  region: string
  nights: number | null
  startDate: string | null
}

export async function savePlan({ region, nights, startDate }: NewPlan): Promise<Plan> {
  const user = auth.currentUser

  if (!user) {
    throw new Error('로그인된 사용자가 없습니다.')
  }

  const plan = {
    userId: user.uid,
    region,
    nights,
    startDate,
    status: 'pending' as const,
    updatedAt: new Date().toISOString(),
  }
  const docRef = await addDoc(collection(db, 'plans'), plan)

  return { id: docRef.id, ...plan }
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
    region: data.region,
    nights: typeof data.nights === 'number' ? data.nights : null,
    startDate: typeof data.startDate === 'string' ? data.startDate : null,
    status: data.status,
    updatedAt: data.updatedAt,
  }
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
