import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { deletePlan, getPlans } from '../api/plans'
import { getPlaceCount } from '../api/places'
import EmptyState from '../components/EmptyState'
import MapsProvider from '../components/MapsProvider'
import PlanCard from '../components/PlanCard'
import SkeletonLoader from '../components/SkeletonLoader'
import planArrow from '../assets/plan-arrow.svg'
import planCloud from '../assets/plan-cloud.svg'
import planPlus from '../assets/plan-plus.svg'
import planRoute from '../assets/plan-route.svg'
import { useToast } from '../contexts/ToastContext'
import type { Plan } from '../types/plan'

function PlansPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({})
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)
  const [listError, setListError] = useState('')
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null)
  const [isDeletingPlan, setIsDeletingPlan] = useState(false)
  const deleteDialogCancelRef = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (listError) {
      showToast(listError, 'error')
    }
  }, [listError, showToast])

  useEffect(() => {
    if (!planToDelete) {
      return
    }

    deleteDialogCancelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeletingPlan) {
        setPlanToDelete(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDeletingPlan, planToDelete])

  async function handleDeletePlan() {
    if (!planToDelete || isDeletingPlan) {
      return
    }

    setIsDeletingPlan(true)

    try {
      await deletePlan(planToDelete.id)
      setPlans((current) => current.filter((plan) => plan.id !== planToDelete.id))
      setPlaceCounts((current) => {
        const next = { ...current }
        delete next[planToDelete.id]
        return next
      })
      showToast('여행 계획을 삭제했어요.')
      setPlanToDelete(null)
    } catch {
      showToast('여행 계획을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error')
    } finally {
      setIsDeletingPlan(false)
    }
  }

  return (
    <section className="plans-page">
      <div className="plans-intro">
        <h1>어떤 여행을 떠나볼까요?</h1>
        <p>새로운 여행을 시작하거나, 저장한 계획을 이어가세요.</p>
      </div>
      <button type="button" className="plans-new" onClick={() => navigate('/planner/new')}>
        <span className="plans-new-head">
          <span className="plans-new-mark">
            <img src={planPlus} alt="" />
          </span>
          <span className="plans-new-copy">
            <strong>새 여행 계획 만들기</strong>
            <span>가고 싶은 곳만 담으면, 동선은 의쉬행이 정리해요.</span>
          </span>
        </span>
        <span className="plans-new-visual">
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
          <img className="plans-new-arrow" src={planArrow} alt="" />
        </span>
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
        {!isLoadingPlans && !listError && plans.length === 0 && (
          <EmptyState
            icon={planCloud}
            title="저장된 여행 계획이 없습니다"
            description="가고 싶은 곳만 담으면, 동선은 의쉬행이 정리해요."
            actionLabel="새 여행 계획 만들기"
            onAction={() => navigate('/planner/new')}
          />
        )}
        <MapsProvider>
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isRecent={index === 0}
              placeCount={placeCounts[plan.id] ?? 0}
              isDeleting={isDeletingPlan && planToDelete?.id === plan.id}
              onDelete={setPlanToDelete}
            />
          ))}
        </MapsProvider>
      </div>
      <p className="plans-note">
        <img src={planCloud} alt="" />
        저장한 계획은 언제든 이어서 만들 수 있어요.
      </p>
      {planToDelete && (
        <div className="confirm-overlay">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-plan-title">
            <p id="delete-plan-title">{planToDelete.region} 계획을 삭제할까요?</p>
            <div>
              <button
                type="button"
                ref={deleteDialogCancelRef}
                disabled={isDeletingPlan}
                onClick={() => setPlanToDelete(null)}
              >
                아니요
              </button>
              <button type="button" className="is-confirm" disabled={isDeletingPlan} onClick={() => void handleDeletePlan()}>
                {isDeletingPlan ? '삭제하는 중' : '네'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlansPage
