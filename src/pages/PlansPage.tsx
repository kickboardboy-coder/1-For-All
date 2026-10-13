import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { getPlans, savePlan } from '../api/plans'
import PlanCard from '../components/PlanCard'
import type { Plan } from '../types/plan'

function PlansPage() {
  const navigate = useNavigate()
  const [region, setRegion] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)
  const [listError, setListError] = useState('')

  useEffect(() => {
    let ignore = false

    getPlans()
      .then((nextPlans) => {
        if (!ignore) {
          setPlans(nextPlans)
        }
      })
      .catch(() => {
        if (!ignore) {
          setListError('여행 계획을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingPlans(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

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
      const plan = await savePlan({ region: nextRegion, nights: null, startDate: null })
      navigate(`/planner/${plan.id}`)
    } catch {
      setError('여행 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  return (
    <section className="plan-create">
      <h1>어떤 여행을 떠나볼까요?</h1>
      <p>지역을 정하면 새 여행 계획이 저장되고, 장소를 담는 화면으로 이동합니다.</p>
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
      <div className="plan-list">
        <div className="plan-list-heading">
          <h2>내 여행 플랜</h2>
          <span>{plans.length}</span>
        </div>
        {isLoadingPlans && <p>여행 계획을 불러오는 중입니다.</p>}
        {listError && (
          <p className="login-error" role="alert">
            {listError}
          </p>
        )}
        {!isLoadingPlans && !listError && plans.length === 0 && <p>저장된 여행 계획이 없습니다.</p>}
        <div className="plan-list-items">
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} isRecent={index === 0} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PlansPage
