import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { getItinerary } from '../api/itinerary'
import { getPlan } from '../api/plans'
import { getPlaces } from '../api/places'
import MapsProvider from '../components/MapsProvider'
import ResultMap, { dayColorNames, dayColors, dayRoutesFrom } from '../components/ResultMap'
import { findRegion } from '../data/destinations'
import resultArrowLeft from '../assets/result-arrow-left.svg'
import resultBookmark from '../assets/result-bookmark.svg'
import resultCalendarDays from '../assets/result-calendar-days.svg'
import resultMap from '../assets/result-map.svg'
import resultPencil from '../assets/result-pencil.svg'
import plannerChevron from '../assets/planner-chevron.svg'
import type { Itinerary } from '../types/itinerary'
import type { Plan } from '../types/plan'
import type { Place } from '../types/place'

const weekdayLabel = ['일', '월', '화', '수', '목', '금', '토']

function formatDateRange(startDate: string | null, nights: number | null) {
  if (!startDate || nights === null) {
    return '날짜 미정'
  }

  const start = new Date(`${startDate}T00:00:00`)

  if (Number.isNaN(start.getTime())) {
    return startDate
  }

  const end = new Date(start)
  end.setDate(start.getDate() + nights)
  const startWeek = weekdayLabel[start.getDay()]
  const endWeek = weekdayLabel[end.getDay()]

  return `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, '0')}.${String(start.getDate()).padStart(2, '0')} (${startWeek}) – ${end.getMonth() + 1}.${end.getDate()} (${endWeek})`
}

function formatDayDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getMonth() + 1}.${date.getDate()} (${weekdayLabel[date.getDay()]})`
}

function ResultPage() {
  const { planId } = useParams()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!planId) {
      setIsLoading(false)
      return
    }

    let ignore = false
    setIsLoading(true)

    Promise.all([getPlan(planId), getItinerary(planId), getPlaces(planId)])
      .then(([nextPlan, nextItinerary, nextPlaces]) => {
        if (ignore) {
          return
        }

        if (!nextPlan) {
          setError('여행 계획을 찾지 못했습니다.')
          return
        }

        setPlan(nextPlan)
        setItinerary(nextItinerary)
        setPlaces(nextPlaces)
      })
      .catch(() => {
        if (!ignore) {
          setError('여행 결과를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [planId])

  if (!planId) {
    return <Navigate to="/plans" replace />
  }

  if (isLoading) {
    return (
      <section className="result-page">
        <p className="result-status">여행 결과를 불러오는 중입니다.</p>
      </section>
    )
  }

  if (error || !plan) {
    return (
      <section className="result-page">
        <p className="result-status" role="alert">
          {error || '여행 계획을 찾지 못했습니다.'}
        </p>
      </section>
    )
  }

  if (plan.status !== 'optimized') {
    return <Navigate to={`/planner/${plan.id}`} replace />
  }

  const nights = plan.nights ?? 0
  const days = plan.nights === null ? itinerary?.days.length ?? 1 : nights + 1
  const placeCount = places.length
  const scheduleDays = itinerary?.days ?? []
  const mapRegion = findRegion(plan.country, plan.region)
  const lodging =
    plan.lodgingPlaceId && plan.lodgingName && plan.lodgingLatitude !== null && plan.lodgingLongitude !== null
      ? {
          placeId: plan.lodgingPlaceId,
          name: plan.lodgingName,
          latitude: plan.lodgingLatitude,
          longitude: plan.lodgingLongitude,
        }
      : null
  const routes = dayRoutesFrom(itinerary, places, lodging)

  return (
    <section className="result-page">
      <div className="result-heading">
        <div className="result-flow">
          <Link to={`/planner/${plan.id}`} className="result-back">
            <img src={resultArrowLeft} alt="" />
            여행 주머니로 돌아가기
          </Link>
          <ol className="planner-steps">
            <li>
              <span>✓</span>
              나라 선택
              <img src={plannerChevron} alt="" />
            </li>
            <li>
              <span>✓</span>
              여행 주머니에 담기
              <img src={plannerChevron} alt="" />
            </li>
            <li className="is-current">
              <span>3</span>
              계획 최적화
            </li>
          </ol>
        </div>
        <div className="result-title-row">
          <div>
            <div className="result-title">
              <h1>
                {plan.region}, {nights}박 {days}일의 여행이 완성됐어요!
              </h1>
              <span>동선 정리 완료</span>
            </div>
            <p>
              {[plan.country, plan.region].filter(Boolean).join(' · ')}
              {' | '}
              {formatDateRange(plan.startDate, plan.nights)}
              {' | '}
              담은 장소 {placeCount}곳
            </p>
            <p>
              가고 싶은 {placeCount}곳을 {days}일에 나눴어요. 지도 위 동선을 따라 나만의 여행을 확인해 보세요.
            </p>
          </div>
          <div className="result-actions">
            <div>
              <button type="button" className="result-edit" disabled>
                <img src={resultPencil} alt="" />
                일정 수정
              </button>
              <button type="button" className="result-save" disabled>
                <img src={resultBookmark} alt="" />
                계획 저장
              </button>
            </div>
            <p>아직 저장하지 않은 계획이에요</p>
          </div>
        </div>
      </div>
      <div className="result-workspace">
        <section className="result-map-panel">
          <div className="result-panel-heading">
            <h2>
              <img src={resultMap} alt="" />
              {days}일의 동선을 한눈에
            </h2>
            <span>전체 일정 표시 중</span>
          </div>
          <MapsProvider>
            <ResultMap
              latitude={mapRegion?.latitude ?? 20}
              longitude={mapRegion?.longitude ?? 0}
              zoom={mapRegion ? 12 : 2}
              routes={routes}
            />
          </MapsProvider>
          <div className="result-legend">
            {Array.from({ length: days }, (_, index) => (
              <p key={index}>
                <span style={{ background: dayColors[index % dayColors.length] }} />
                {index + 1}일차 · {dayColorNames[index % dayColorNames.length]}
              </p>
            ))}
          </div>
        </section>
        <aside className="result-schedule">
          <div className="result-panel-heading">
            <h2>
              <img src={resultCalendarDays} alt="" />
              나의 {nights}박 {days}일 일정
            </h2>
            <span>예시 일정</span>
          </div>
          <p className="result-schedule-note">방문 시간은 현지 기준 · 모든 이동 시간은 예상값이에요</p>
          {scheduleDays.length === 0 ? (
            <p className="result-status">저장된 일정이 없습니다.</p>
          ) : (
            scheduleDays.map((day) => {
              const visits = day.stops.filter((stop) => stop.kind !== 'lodging')
              return (
                <section key={day.day} className="result-day">
                  <div className="result-day-heading">
                    <span>{day.day}일차</span>
                    <strong>{formatDayDate(day.date)}</strong>
                    <small>{visits.length}곳 방문</small>
                  </div>
                  <ol>
                    {visits.map((stop, index) => (
                      <li key={`${stop.placeId}-${stop.startTime}`}>
                        <span>{index + 1}</span>
                        <div>
                          <p>
                            {stop.startTime} – {stop.endTime}
                          </p>
                          <strong>{stop.name}</strong>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )
            })
          )}
        </aside>
      </div>
      <p className="result-disclaimer">
        방문 시간과 이동 시간은 API로 검증되지 않은 예상값입니다. 실제 영업시간·휴무일·브레이크타임과 교통편은 방문 전 확인해 주세요.
      </p>
    </section>
  )
}

export default ResultPage
