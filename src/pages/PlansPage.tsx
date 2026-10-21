import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getPlans } from '../api/plans'
import { getPlaceCount } from '../api/places'
import PlanCard from '../components/PlanCard'
import SkeletonLoader from '../components/SkeletonLoader'
import planArrow from '../assets/plan-arrow.svg'
import planCloud from '../assets/plan-cloud.svg'
import planPlus from '../assets/plan-plus.svg'
import planRoute from '../assets/plan-route.svg'
import type { Plan } from '../types/plan'

function PlansPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({})
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)
  const [listError, setListError] = useState('')

  useEffect(() => {
    let ignore = false

    getPlans()
      .then(async (nextPlans) => {
        if (ignore) {
          return
        }

        setPlans(nextPlans)

        try {
          const counts = await Promise.all(
            nextPlans.map(async (plan) => [plan.id, await getPlaceCount(plan.id)] as const),
          )

          if (!ignore) {
            setPlaceCounts(Object.fromEntries(counts))
          }
        } catch {
          if (!ignore) {
            setPlaceCounts({})
          }
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

  return (
    <section className="plans-page">
      <div className="plans-intro">
        <h1>어떤 여행을 떠나볼까요?</h1>
        <p>새로운 여행을 시작하거나, 저장한 계획을 이어가세요.</p>
      </div>
      <button type="button" className="plans-new" onClick={() => navigate('/planner/new')}>
        <span className="plans-new-mark">
          <img src={planPlus} alt="" />
        </span>
        <span className="plans-new-copy">
          <strong>새 여행 계획 만들기</strong>
          <span>가고 싶은 곳만 담으면, 동선은 의쉬행이 정리해요.</span>
        </span>
        <span className="plans-route" aria-hidden="true">
          <span className="plans-block plans-block-a" />
          <span className="plans-block plans-block-b" />
          <span className="plans-block plans-block-c" />
          <span className="plans-block plans-block-d" />
          <span className="plans-block plans-block-e" />
          <span className="plans-block plans-block-f" />
          <span className="plans-park" />
          <img src={planRoute} alt="" />
        </span>
        <img src={planArrow} alt="" />
      </button>
      <div className="plans-list-heading">
        <div className="plans-list-title">
          <h2>내 여행 플랜</h2>
          <span>{plans.length}</span>
        </div>
        <p>최근 수정순</p>
      </div>
      <div className="plans-list-items">
        {isLoadingPlans && <SkeletonLoader variant="plans" label="여행 계획을 불러오는 중입니다." />}
        {listError && (
          <p className="login-error" role="alert">
            {listError}
          </p>
        )}
        {!isLoadingPlans && !listError && plans.length === 0 && <p>저장된 여행 계획이 없습니다.</p>}
        {plans.map((plan, index) => (
          <PlanCard key={plan.id} plan={plan} isRecent={index === 0} placeCount={placeCounts[plan.id] ?? 0} />
        ))}
      </div>
      <p className="plans-note">
        <img src={planCloud} alt="" />
        저장한 계획은 언제든 이어서 만들 수 있어요.
      </p>
    </section>
  )
}

export default PlansPage
