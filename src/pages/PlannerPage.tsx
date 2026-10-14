import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import plannerArrow from '../assets/planner-arrow.svg'
import plannerBag from '../assets/planner-bag.svg'
import plannerBookmark from '../assets/planner-bookmark.svg'
import plannerCalendar from '../assets/planner-calendar.svg'
import plannerCalendarDays from '../assets/planner-calendar-days.svg'
import plannerChevronDown from '../assets/planner-chevron-down.svg'
import plannerChevron from '../assets/planner-chevron.svg'
import plannerGlobe from '../assets/planner-globe.svg'
import plannerMinus from '../assets/planner-minus.svg'
import plannerPlus from '../assets/planner-plus.svg'
import plannerSearch from '../assets/planner-search.svg'
import plannerSparkles from '../assets/planner-sparkles.svg'
import { getPlan, savePlan } from '../api/plans'
import { destinations } from '../data/destinations'
import type { Plan } from '../types/plan'

const steps = [
  { number: 1, label: '나라 선택' },
  { number: 2, label: '여행 주머니에 담기' },
  { number: 3, label: '계획 최적화' },
]

function PlannerPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [openMenu, setOpenMenu] = useState<'country' | 'region' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const regions = destinations.find((item) => item.country === country)?.regions ?? []
  const currentStep = planId ? 2 : 1
  const nights = plan?.nights
  const days = nights === null || nights === undefined ? null : nights + 1

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

    if (planId) {
      return
    }

    if (!country || !region) {
      setError('나라와 지역을 선택해 주세요.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const nextPlan = await savePlan({ country, region, nights: null, startDate: null })
      navigate(`/planner/${nextPlan.id}`, { replace: true })
    } catch {
      setError('여행 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  return (
    <section className="planner-page">
      <div className="planner-heading">
        <div>
          <h1>가고 싶은 곳만 담아주세요.</h1>
          <p>복잡한 동선은 의쉬행이 정리해 드려요.</p>
        </div>
        <ol className="planner-steps">
          {steps.map((step, index) => (
            <li key={step.number} className={step.number === currentStep ? 'is-current' : undefined}>
              <span>{step.number}</span>
              {step.label}
              {index < steps.length - 1 && <img src={plannerChevron} alt="" />}
            </li>
          ))}
        </ol>
      </div>
      <div className="planner-workspace">
        <div className="planner-explore">
          <form className="planner-search" onSubmit={handleSubmit}>
            <div className="planner-search-label">
              <p>어디로 떠나시나요?</p>
              <p>나라를 고르고, 원하는 장소를 검색해 주머니에 담아 보세요</p>
            </div>
            <div className="planner-search-tools">
              <button
                type="button"
                className="planner-country"
                aria-expanded={openMenu === 'country'}
                disabled={Boolean(planId)}
                onClick={() => setOpenMenu((current) => (current === 'country' ? null : 'country'))}
              >
                <img src={plannerGlobe} alt="" />
                <span>{plan?.country ?? (country || '나라')}</span>
                <img src={plannerChevronDown} alt="" />
              </button>
              <button
                type="button"
                className="planner-query"
                aria-expanded={openMenu === 'region'}
                disabled={Boolean(planId) || !country}
                onClick={() => setOpenMenu((current) => (current === 'region' ? null : 'region'))}
              >
                <img src={plannerSearch} alt="" />
                <span>{plan?.region ?? (region || '지역을 선택해 주세요')}</span>
              </button>
            </div>
            {openMenu === 'country' && (
              <div className="planner-options" role="listbox" aria-label="나라">
                {destinations.map((item) => (
                  <button
                    key={item.country}
                    type="button"
                    aria-selected={item.country === country}
                    onClick={() => {
                      setCountry(item.country)
                      setRegion('')
                      setOpenMenu('region')
                    }}
                  >
                    {item.country}
                  </button>
                ))}
              </div>
            )}
            {openMenu === 'region' && (
              <div className="planner-options" role="listbox" aria-label="지역">
                {regions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-selected={item === region}
                    onClick={() => {
                      setRegion(item)
                      setOpenMenu(null)
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
            {!planId && (
              <button type="submit" className="planner-start" disabled={isSaving || !country || !region}>
                이 지역으로 시작
              </button>
            )}
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
          </form>
          <div className="planner-map">지도</div>
        </div>
        <aside className="planner-pocket">
          <div className="planner-pocket-heading">
            <div>
              <img src={plannerBag} alt="" />
              <h2>여행 주머니</h2>
              <span>0</span>
            </div>
            <button type="button" disabled>
              전체 비우기
            </button>
          </div>
          <p>가고 싶은 곳을 주머니에 담으면, 가장 편한 순서로!</p>
          <p className="planner-pocket-empty">아직 담은 장소가 없습니다.</p>
          <div className="planner-duration">
            <div className="planner-duration-title">
              <img src={plannerCalendarDays} alt="" />
              <h3>얼마나 떠나시나요?</h3>
            </div>
            <div className="planner-counters">
              <div>
                <button type="button" disabled>
                  <img src={plannerMinus} alt="" />
                </button>
                <p>
                  <strong>{nights ?? '–'}</strong>
                  <span>박</span>
                </p>
                <button type="button" disabled>
                  <img src={plannerPlus} alt="" />
                </button>
              </div>
              <div>
                <button type="button" disabled>
                  <img src={plannerMinus} alt="" />
                </button>
                <p>
                  <strong>{days ?? '–'}</strong>
                  <span>일</span>
                </p>
                <button type="button" disabled>
                  <img src={plannerPlus} alt="" />
                </button>
              </div>
            </div>
            <div className="planner-date">
              <span>출발일</span>
              <strong>{plan?.startDate ?? '날짜 미정'}</strong>
              <img src={plannerCalendar} alt="" />
            </div>
            <p>출발일에 맞춰 휴무일도 함께 확인해요.</p>
          </div>
          <button type="button" className="planner-optimize" disabled>
            <img src={plannerSparkles} alt="" />
            최적의 여행 계획 만들기
            <img src={plannerArrow} alt="" />
          </button>
          <p className="planner-optimize-note">
            인공지능이 영업시간·휴무일·브레이크 타임과 실제 거리를 고려해 동선을 정리해요.
          </p>
          <button type="button" className="planner-save" disabled>
            <img src={plannerBookmark} alt="" />
            장소만 저장하기
          </button>
          <p className="planner-save-note">
            장소만 담은 상태를 저장해두고, 나중에 기간과 출발일을 정한 뒤 AI 최적화를 진행할 수 있어요.
          </p>
        </aside>
      </div>
    </section>
  )
}

export default PlannerPage
