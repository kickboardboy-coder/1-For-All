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
import resultBus from '../assets/result-bus.svg'
import resultCoffee from '../assets/result-coffee.svg'
import resultMap from '../assets/result-map.svg'
import resultPencil from '../assets/result-pencil.svg'
import resultTrain from '../assets/result-train.svg'
import plannerChevron from '../assets/planner-chevron.svg'
import type { Itinerary, ItineraryStop } from '../types/itinerary'
import type { Plan } from '../types/plan'
import type { Place } from '../types/place'
import { placeCategoryLabel } from '../types/place'
import { formatPlaceSchedule } from '../utils/placeSchedule'

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

function formatTravel(minutes: number | null) {
  if (minutes === null) {
    return null
  }

  if (minutes <= 0) {
    return '바로 이동'
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours > 0 && rest > 0) {
    return `약 ${hours}시간 ${rest}분`
  }

  if (hours > 0) {
    return `약 ${hours}시간`
  }

  return `약 ${rest}분`
}

function stopKindLabel(stop: ItineraryStop) {
  if (stop.kind === 'breakfast') {
    return '아침'
  }

  if (stop.kind === 'lunch') {
    return '점심'
  }

  if (stop.kind === 'dinner') {
    return '저녁'
  }

  return placeCategoryLabel[stop.category]
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
  const [visibleDays, setVisibleDays] = useState<number[]>([])

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
        setVisibleDays(nextItinerary ? nextItinerary.days.map((day) => day.day) : [])
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
  const routes = dayRoutesFrom(itinerary, places, lodging).filter((route) => visibleDays.includes(route.day))
  const legendDays = scheduleDays.length > 0 ? scheduleDays.map((day) => day.day) : Array.from({ length: days }, (_, index) => index + 1)
  const mapRangeLabel =
    visibleDays.length === 0
      ? '표시 중인 일차 없음'
      : visibleDays.length === legendDays.length
        ? '전체 일정 표시 중'
        : visibleDays.length === 1
          ? `${visibleDays[0]}일차 표시 중`
          : `${visibleDays.length}일 일정 표시 중`

  function toggleDay(day: number) {
    setVisibleDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((left, right) => left - right),
    )
  }

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
            <span>{mapRangeLabel}</span>
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
            {legendDays.map((day) => (
              <label key={day}>
                <input type="checkbox" checked={visibleDays.includes(day)} onChange={() => toggleDay(day)} />
                <span style={{ background: dayColors[(day - 1) % dayColors.length] }} />
                {day}일차 · {dayColorNames[(day - 1) % dayColorNames.length]}
              </label>
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
              const color = dayColors[(day.day - 1) % dayColors.length]
              let visitNumber = 0

              return (
                <section key={day.day} className="result-day">
                  <div className="result-day-heading">
                    <span style={{ background: color, color: '#fff' }}>{day.day}일차</span>
                    <strong>{formatDayDate(day.date)}</strong>
                    <small>{visits.length}곳 방문</small>
                  </div>
                  <ol>
                    {day.stops.map((stop, index) => {
                      const place = places.find((item) => item.id === stop.placeId)
                      const previous = day.stops[index - 1]
                      const travel = formatTravel(stop.travelMinutes)
                      const isLodging = stop.kind === 'lodging'
                      const label = isLodging ? '숙소' : String(++visitNumber)

                      return (
                        <li key={`${stop.placeId}-${stop.startTime}-${index}`}>
                          {travel && (
                            <p className={index === 0 ? 'result-travel result-travel-start' : 'result-travel'}>
                              <img src={index === 0 || previous?.kind === 'lodging' ? resultTrain : resultBus} alt="" />
                              {previous ? `${previous.name}에서 이동 · ${travel}` : `이동 · ${travel}`}
                            </p>
                          )}
                          <div className={isLodging ? 'result-visit result-visit-stay' : 'result-visit'}>
                            <span style={{ background: color }}>{label}</span>
                            <div>
                              <p>
                                {stop.startTime} – {stop.endTime}
                                <small>{isLodging ? '숙소' : stopKindLabel(stop)}</small>
                              </p>
                              <strong>{stop.name}</strong>
                              <small>{place ? formatPlaceSchedule(place) : isLodging ? '숙소에서 하루를 시작하거나 마무리해요.' : '영업시간 정보 없음'}</small>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )
            })
          )}
          <p className="result-free-note">
            <img src={resultCoffee} alt="" />
            방문이 끝난 뒤에는 자유롭게 쉬어 가세요. 숙소나 도착 시간은 일정 수정에서 맞춰 주세요.
          </p>
        </aside>
      </div>
      <p className="result-disclaimer">
        방문 시간과 이동 시간은 API로 검증되지 않은 예상값입니다. 실제 영업시간·휴무일·브레이크타임과 교통편은 방문 전 확인해 주세요.
      </p>
    </section>
  )
}

export default ResultPage
