import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getPlan } from '../api/plans'
import type { Plan } from '../types/plan'

function PlannerPage() {
  const { planId } = useParams()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!planId) {
      return
    }

    let ignore = false

    getPlan(planId)
      .then((nextPlan) => {
        if (ignore) {
          return
        }

        if (!nextPlan) {
          setError('여행 계획을 찾지 못했습니다.')
          return
        }

        setPlan(nextPlan)
      })
      .catch(() => {
        if (!ignore) {
          setError('여행 계획을 불러오지 못했습니다.')
        }
      })

    return () => {
      ignore = true
    }
  }, [planId])

  return (
    <section className="plan-create">
      <h1>{plan ? `${plan.region} 장소 담기` : '장소 담기'}</h1>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default PlannerPage
