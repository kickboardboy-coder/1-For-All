import { addDoc, collection } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { Plan } from '../types/plan'

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
