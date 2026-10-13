import { Link } from 'react-router'
import { planStatusLabel, type Plan } from '../types/plan'

type PlanCardProps = {
  plan: Plan
  isRecent: boolean
}

function formatTripLength(plan: Plan) {
  if (plan.nights === null) {
    return '날짜 미정'
  }

  const length = `${plan.nights}박 ${plan.nights + 1}일`

  if (!plan.startDate) {
    return length
  }

  return `${length} · ${plan.startDate}`
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000)

  if (dayDiff <= 0) {
    return '오늘'
  }

  if (dayDiff === 1) {
    return '어제'
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

function PlanCard({ plan, isRecent }: PlanCardProps) {
  return (
    <article className="plan-card">
      <div className="plan-card-main">
        <div className="plan-card-title">
          <h2>{plan.region}</h2>
          {isRecent && <span className="plan-badge plan-badge-recent">최근 계획</span>}
          <span className={`plan-badge plan-badge-${plan.status}`}>{planStatusLabel[plan.status]}</span>
        </div>
        <p>{formatTripLength(plan)}</p>
      </div>
      <div className="plan-card-side">
        <p>{formatUpdatedAt(plan.updatedAt)}</p>
        <Link to={`/planner/${plan.id}`}>열기</Link>
      </div>
    </article>
  )
}

export default PlanCard
