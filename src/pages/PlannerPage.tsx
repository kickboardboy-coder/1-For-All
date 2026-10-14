import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getPlan, savePlan } from '../api/plans'
import type { Plan } from '../types/plan'

function PlannerPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [region, setRegion] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextRegion = region.trim()

    if (!nextRegion) {
      setError('여행 지역을 입력해 주세요.')
      return
    }

    if (nextRegion.length > 80) {
      setError('여행 지역은 80자 이하로 입력해 주세요.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const nextPlan = await savePlan({ region: nextRegion, nights: null, startDate: null })
      navigate(`/planner/${nextPlan.id}`, { replace: true })
    } catch {
      setError('여행 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  if (!planId) {
    return (
      <section className="plan-create">
        <h1>새 여행 계획</h1>
        <p>여행 지역을 정하면 계획이 저장됩니다.</p>
        <form className="plan-create-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>여행 지역</span>
            <input
              value={region}
              placeholder="예: 교토"
              maxLength={80}
              onChange={(event) => setRegion(event.target.value)}
            />
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="login-submit" disabled={isSaving}>
            새 여행 계획 만들기
          </button>
        </form>
      </section>
    )
  }

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
