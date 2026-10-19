import { Link } from 'react-router'
import { planStatusLabel, type Plan } from '../types/plan'

type PlanCardProps = {
  plan: Plan
  isRecent: boolean
  placeCount: number
}

function formatPeriod(plan: Plan) {
  const prefix = plan.country ? `${plan.country} · ` : ''

  if (plan.nights === null) {
    return `${prefix}날짜 미정`
  }

  const length = `${plan.nights}박 ${plan.nights + 1}일`

  if (!plan.startDate) {
    return `${prefix}${length}`
  }

  const start = new Date(`${plan.startDate}T00:00:00`)

  if (Number.isNaN(start.getTime())) {
    return `${prefix}${length}`
  }

  const end = new Date(start)
  end.setDate(start.getDate() + plan.nights)
  const startLabel = `${start.getMonth() + 1}월 ${start.getDate()}일`
  const endLabel = `${end.getMonth() + 1}월 ${end.getDate()}일`

  return `${prefix}${startLabel} – ${endLabel} · ${length}`
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
    return '오늘 수정'
  }

  if (dayDiff === 1) {
    return '어제 수정'
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일 수정`
}

function PlanCard({ plan, isRecent, placeCount }: PlanCardProps) {
  return (
    <Link to={plan.status === 'optimized' ? `/result/${plan.id}` : `/planner/${plan.id}`} className={isRecent ? 'plan-card plan-card-recent' : 'plan-card'}>
      <div className="plan-card-thumb" aria-hidden="true" />
      <div className="plan-card-main">
        <div className="plan-card-title">
          <h2>{plan.region}</h2>
          {isRecent && <span className="plan-badge plan-badge-recent">최근 계획</span>}
          <span className={`plan-badge plan-badge-${plan.status}`}>{planStatusLabel[plan.status]}</span>
        </div>
        <p>{formatPeriod(plan)}</p>
        <p className="plan-card-places">담은 장소 {placeCount}곳</p>
      </div>
      <div className="plan-card-side">
        <p>{formatUpdatedAt(plan.updatedAt)}</p>
      </div>
    </Link>
  )
}

export default PlanCard
