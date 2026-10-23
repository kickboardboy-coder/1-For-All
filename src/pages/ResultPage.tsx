import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { driveSpeedKmh, getItinerary, saveItinerary, travelMinutes, walkSpeedKmh } from '../api/itinerary'
import { getPlan, isTransitMode, markPlanSaved, transitModeLabel } from '../api/plans'
import { getPlaces } from '../api/places'
import SkeletonLoader from '../components/SkeletonLoader'
import MapsProvider from '../components/MapsProvider'
import ResultMap, { dayColorNameOf, dayColorOf, dayColors, dayRoutesFrom } from '../components/ResultMap'
import { findRegion } from '../data/destinations'
import resultArrowLeft from '../assets/result-arrow-left.svg'
import resultBookmark from '../assets/result-bookmark.svg'
import resultCalendarDays from '../assets/result-calendar-days.svg'
import resultCoffee from '../assets/result-coffee.svg'
import resultMap from '../assets/result-map.svg'
import resultPencil from '../assets/result-pencil.svg'
import plannerChevron from '../assets/planner-chevron.svg'
import { itineraryStopBadge, mealStopKinds, type Itinerary, type ItineraryStop, type ItineraryStopKind } from '../types/itinerary'
import type { Plan } from '../types/plan'
import type { Place, PlaceCategory } from '../types/place'
import { useToast } from '../contexts/ToastContext'
import { formatKoreanTime } from '../utils/clock'
import { formatPlaceSchedule, weekdayLabels } from '../utils/placeSchedule'
import { placeRole } from '../utils/placeCategory'

function slotGroup(kind: ItineraryStopKind) {
  if (kind === 'visit') {
    return 'visit' as const
  }

  if ((mealStopKinds as readonly ItineraryStopKind[]).includes(kind)) {
    return 'meal' as const
  }

  return 'fixed' as const
}

function identityFitsGroup(identity: { name: string; category: PlaceCategory }, group: 'meal' | 'visit') {
  const role = placeRole(identity)
  return group === 'meal' ? role === 'food' : role === 'sight'
}

function canReorderStops(stops: ItineraryStop[], fromIndex: number, toIndex: number) {
  const from = stops[fromIndex]
  const to = stops[toIndex]
  const group = from ? slotGroup(from.kind) : 'fixed'

  return Boolean(from && to && group !== 'fixed' && slotGroup(to.kind) === group)
}

function cloneItinerary(itinerary: Itinerary): Itinerary {
  return {
    planId: itinerary.planId,
    days: itinerary.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({ ...stop })),
    })),
  }
}

function stopCoords(
  stop: ItineraryStop,
  placeById: Map<string, Place>,
  extraById: Map<string, { latitude: number; longitude: number }>,
) {
  const place = placeById.get(stop.placeId)

  if (place) {
    return { latitude: place.latitude, longitude: place.longitude }
  }

  const extra = extraById.get(stop.placeId)
  return extra ? { latitude: extra.latitude, longitude: extra.longitude } : null
}

function withTravelTimes(
  stops: ItineraryStop[],
  placeById: Map<string, Place>,
  extraById: Map<string, { latitude: number; longitude: number }>,
) {
  return stops.map((stop, index) => {
    if (index === 0) {
      return { ...stop, travelMinutes: null }
    }

    const from = stopCoords(stops[index - 1], placeById, extraById)
    const to = stopCoords(stop, placeById, extraById)

    if (!from || !to) {
      return stop
    }

    return { ...stop, travelMinutes: travelMinutes(from, to) }
  })
}

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
  const startWeek = weekdayLabels[start.getDay()]
  const endWeek = weekdayLabels[end.getDay()]

  return `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, '0')}.${String(start.getDate()).padStart(2, '0')} (${startWeek}) – ${end.getMonth() + 1}.${end.getDate()} (${endWeek})`
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours > 0 && rest > 0) {
    return `${hours}시간 ${rest}분`
  }

  if (hours > 0) {
    return `${hours}시간`
  }

  return `${Math.max(1, rest)}분`
}

function formatTravelModes(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number } | null,
) {
  if (!from || !to) {
    return null
  }

  return `도보 ${formatDuration(travelMinutes(from, to, walkSpeedKmh))} · 자동차 ${formatDuration(travelMinutes(from, to, driveSpeedKmh))}`
}

function transitCaption(kind: 'arrival' | 'departure', plan: Plan, stopTime: string) {
  const transport = kind === 'arrival' ? plan.arrivalTransport : plan.departureTransport
  const time = (kind === 'arrival' ? plan.arrivalTime : plan.departureTime) || stopTime
  const clock = formatKoreanTime(time)
  const mode = isTransitMode(transport) ? transitModeLabel[transport] : null

  if (kind === 'arrival') {
    return mode ? `${mode} 도착 · ${clock}` : `${clock} 도착`
  }

  return mode ? `${mode} 출발 · ${clock}` : `${clock} 출발`
}

function formatDayDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getMonth() + 1}.${date.getDate()} (${weekdayLabels[date.getDay()]})`
}

function ResultPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleDays, setVisibleDays] = useState<number[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Itinerary | null>(null)
  const [isSavingEdits, setIsSavingEdits] = useState(false)
  const [editError, setEditError] = useState('')
  const [dayColorIndexes, setDayColorIndexes] = useState<Record<number, number>>({})
  const [colorPickerDay, setColorPickerDay] = useState<number | null>(null)
  const [stopDrag, setStopDrag] = useState<{ day: number; from: number; over: number; pointerId: number } | null>(null)
  const stopDragRef = useRef(stopDrag)
  const mapPanelRef = useRef<HTMLElement>(null)
  stopDragRef.current = stopDrag

  useEffect(() => {
    if (editError) {
      showToast(editError, 'error')
    }
  }, [editError, showToast])

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

  useEffect(() => {
    if (!planId) {
      return
    }

    try {
      const raw = localStorage.getItem(`euihang-day-colors:${planId}`)
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      const indexes = Object.fromEntries(
        Object.entries(parsed).flatMap(([day, index]) => {
          const dayNumber = Number(day)
          const colorIndex = typeof index === 'number' ? index : Number(index)

          if (!Number.isInteger(dayNumber) || dayNumber < 1 || !Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= dayColors.length) {
            return []
          }

          return [[dayNumber, colorIndex] as const]
        }),
      )
      setDayColorIndexes(indexes)
    } catch {
      setDayColorIndexes({})
    }
  }, [planId])

  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places])

  useEffect(() => {
    if (isLoading || !plan || plan.status !== 'optimized') {
      return
    }

    if (!window.matchMedia('(max-width: 768px)').matches) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      mapPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isLoading, plan?.status, planId])

  if (!planId) {
    return <Navigate to="/plans" replace />
  }

  if (isLoading) {
    return (
      <section className="result-page">
        <SkeletonLoader variant="result" label="여행 결과를 불러오는 중입니다." />
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
  const schedule = isEditing ? draft : itinerary
  const scheduleDays = schedule?.days ?? []
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
  const arrivalHub =
    plan.arrivalPlaceId && plan.arrivalPlaceName && plan.arrivalLatitude !== null && plan.arrivalLongitude !== null
      ? {
          placeId: plan.arrivalPlaceId,
          name: plan.arrivalPlaceName,
          latitude: plan.arrivalLatitude,
          longitude: plan.arrivalLongitude,
        }
      : null
  const departureHub =
    plan.departurePlaceId && plan.departurePlaceName && plan.departureLatitude !== null && plan.departureLongitude !== null
      ? {
          placeId: plan.departurePlaceId,
          name: plan.departurePlaceName,
          latitude: plan.departureLatitude,
          longitude: plan.departureLongitude,
        }
      : null
  const mapHubs = [lodging, arrivalHub, departureHub].filter((item) => item !== null)
  const extraById = new Map(mapHubs.map((item) => [item.placeId, item]))
  const routes = dayRoutesFrom(schedule, places, mapHubs)
    .map((route) => ({ ...route, color: dayColorOf(route.day, dayColorIndexes) }))
    .filter((route) => visibleDays.includes(route.day))
  const legendDays = scheduleDays.length > 0 ? scheduleDays.map((day) => day.day) : Array.from({ length: days }, (_, index) => index + 1)
  const mapRangeLabel =
    visibleDays.length === 0
      ? '표시 중인 일차 없음'
      : visibleDays.length === legendDays.length
        ? '전체 일정 표시 중'
        : visibleDays.length === 1
          ? `${visibleDays[0]}일차 표시 중`
          : `${visibleDays.length}일 일정 표시 중`

  function chooseDayColor(day: number, colorIndex: number) {
    setDayColorIndexes((current) => {
      const next = { ...current, [day]: colorIndex }

      if (planId) {
        localStorage.setItem(`euihang-day-colors:${planId}`, JSON.stringify(next))
      }

      return next
    })
    setColorPickerDay(null)
  }

  function toggleDay(day: number) {
    setVisibleDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((left, right) => left - right),
    )
  }

  function beginEdit() {
    if (!itinerary) {
      return
    }

    setDraft(cloneItinerary(itinerary))
    setEditError('')
    setIsEditing(true)
  }

  function cancelEdit() {
    setDraft(null)
    setEditError('')
    setIsEditing(false)
  }

  function updateDayStops(dayNumber: number, updater: (stops: ItineraryStop[]) => ItineraryStop[]) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        days: current.days.map((day) => {
          if (day.day !== dayNumber) {
            return day
          }

          return { ...day, stops: withTravelTimes(updater(day.stops), placeById, extraById) }
        }),
      }
    })
  }

  function reorderStops(dayNumber: number, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return
    }

    updateDayStops(dayNumber, (stops) => {
      if (toIndex < 0 || toIndex >= stops.length || !canReorderStops(stops, fromIndex, toIndex)) {
        return stops
      }

      const group = slotGroup(stops[fromIndex].kind)
      const indexes = stops.flatMap((stop, index) => (slotGroup(stop.kind) === group ? [index] : []))
      const fromPos = indexes.indexOf(fromIndex)
      const toPos = indexes.indexOf(toIndex)

      if (group === 'fixed' || fromPos < 0 || toPos < 0) {
        return stops
      }

      const identities = indexes.map((index) => ({
        placeId: stops[index].placeId,
        name: stops[index].name,
        category: stops[index].category,
      }))
      const [moved] = identities.splice(fromPos, 1)

      if (!identityFitsGroup(moved, group) || identities.some((identity) => !identityFitsGroup(identity, group))) {
        return stops
      }

      identities.splice(toPos, 0, moved)

      return stops.map((stop, index) => {
        const slot = indexes.indexOf(index)
        return slot < 0 ? stop : { ...stop, ...identities[slot] }
      })
    })
  }

  function startStopDrag(event: PointerEvent<HTMLButtonElement>, dayNumber: number, index: number) {
    if (!isEditing || isSavingEdits) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setStopDrag({ day: dayNumber, from: index, over: index, pointerId: event.pointerId })
  }

  function moveStopDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = stopDragRef.current

    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }

    const node = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-stop-index]')

    if (!(node instanceof HTMLElement)) {
      return
    }

    const dayNumber = Number(node.dataset.day)
    const over = Number(node.dataset.stopIndex)
    const stops = draft?.days.find((day) => day.day === drag.day)?.stops

    if (
      !stops ||
      dayNumber !== drag.day ||
      Number.isNaN(over) ||
      over === drag.over ||
      !canReorderStops(stops, drag.from, over)
    ) {
      return
    }

    setStopDrag({ ...drag, over })
  }

  function endStopDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = stopDragRef.current

    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }

    reorderStops(drag.day, drag.from, drag.over)
    setStopDrag(null)
  }

  async function finishEdit() {
    if (!draft) {
      return
    }

    setIsSavingEdits(true)
    setEditError('')

    try {
      await saveItinerary(draft)
      setItinerary(draft)
      setDraft(null)
      setIsEditing(false)
      showToast('일정을 수정해 저장했어요.')
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : '일정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingEdits(false)
    }
  }

  async function handleSavePlan() {
    if (!planId || (!itinerary && !draft)) {
      return
    }

    setIsSavingEdits(true)
    setEditError('')

    try {
      if (isEditing && draft) {
        await saveItinerary(draft)
        setItinerary(draft)
        setDraft(null)
        setIsEditing(false)
      }

      const savedAt = await markPlanSaved(planId)
      setPlan((current) => (current ? { ...current, savedAt, updatedAt: savedAt } : current))
      showToast('여행 계획을 저장했어요.')
      navigate('/plans', { replace: true })
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : '계획을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSavingEdits(false)
    }
  }

  return (
    <section className="result-page">
      <div className="result-heading">
        <div className="result-flow">
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
            <li className="is-current" aria-current="step">
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
              <Link to={`/planner/${plan.id}`} className="result-edit">
                <img src={resultArrowLeft} alt="" />
                여행 주머니로 돌아가기
              </Link>
              {isEditing ? (
                <>
                  <button type="button" className="result-edit" disabled={isSavingEdits} onClick={cancelEdit}>
                    수정 취소
                  </button>
                  <button
                    type="button"
                    className="result-edit is-active"
                    disabled={isSavingEdits || !draft}
                    onClick={() => void finishEdit()}
                  >
                    <img src={resultPencil} alt="" />
                    {isSavingEdits ? '저장 중' : '수정 완료'}
                  </button>
                </>
              ) : (
                <button type="button" className="result-edit" disabled={!itinerary} onClick={beginEdit}>
                  <img src={resultPencil} alt="" />
                  일정 수정
                </button>
              )}
              <button
                type="button"
                className="result-save"
                disabled={isSavingEdits || (!itinerary && !draft)}
                onClick={() => void handleSavePlan()}
              >
                <img src={resultBookmark} alt="" />
                {isSavingEdits ? '저장 중' : plan.savedAt ? '다시 저장' : '계획 저장'}
              </button>
            </div>
            {editError ? (
              <p role="alert">{editError}</p>
            ) : (
              <p>{plan.savedAt ? '내 여행 목록에 저장한 계획이에요' : '아직 저장하지 않은 계획이에요'}</p>
            )}
          </div>
        </div>
      </div>
      <div className="result-workspace">
        <section className="result-map-panel" ref={mapPanelRef}>
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
              <div key={day} className="result-legend-item">
                <label>
                  <input type="checkbox" checked={visibleDays.includes(day)} onChange={() => toggleDay(day)} />
                  {day}일차 · {dayColorNameOf(day, dayColorIndexes)}
                </label>
                <button
                  type="button"
                  className={colorPickerDay === day ? 'result-legend-yarn is-open' : 'result-legend-yarn'}
                  aria-label={`${day}일차 색상 고르기`}
                  aria-expanded={colorPickerDay === day}
                  onClick={() => setColorPickerDay((current) => (current === day ? null : day))}
                >
                  <span style={{ background: dayColorOf(day, dayColorIndexes) }} />
                </button>
                {colorPickerDay === day && (
                  <div className="result-color-palette" role="listbox" aria-label={`${day}일차 색상`}>
                    {dayColors.map((color, index) => (
                      <button
                        key={color}
                        type="button"
                        role="option"
                        aria-label={dayColorNameOf(day, { [day]: index })}
                        aria-selected={dayColorOf(day, dayColorIndexes) === color}
                        className={dayColorOf(day, dayColorIndexes) === color ? 'is-selected' : undefined}
                        style={{ background: color }}
                        onClick={() => chooseDayColor(day, index)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <aside className="result-schedule">
          <div className="result-panel-heading">
            <h2>
              <img src={resultCalendarDays} alt="" />
              나의 {nights}박 {days}일 일정
            </h2>
            <span>{isEditing ? '일정 수정 중' : '예시 일정'}</span>
          </div>
          <p className="result-schedule-note">
            {isEditing
              ? '아침·점심·저녁은 맛집끼리, 관광지는 관광지끼리만 끌어 바꿔 보세요.'
              : '선택한 끼니는 매일 넣고, 이동 시간은 예상값이에요'}
          </p>
          {scheduleDays.length === 0 ? (
            <p className="result-status">저장된 일정이 없습니다.</p>
          ) : (
            scheduleDays.map((day) => {
              const visits = day.stops.filter(
                (stop) => stop.kind !== 'lodging' && stop.kind !== 'arrival' && stop.kind !== 'departure',
              )
              const color = dayColorOf(day.day, dayColorIndexes)
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
                      const place = placeById.get(stop.placeId)
                      const previous = day.stops[index - 1]
                      const travel = previous
                        ? formatTravelModes(stopCoords(previous, placeById, extraById), stopCoords(stop, placeById, extraById))
                        : null
                      const isNamedStop = stop.kind !== 'visit'
                      const label = itineraryStopBadge(stop.kind, stop.kind === 'visit' ? ++visitNumber : visitNumber)

                      return (
                        <li
                          key={`${stop.kind}-${stop.placeId}-${stop.startTime}`}
                          data-day={day.day}
                          data-stop-index={index}
                        >
                          {travel && (
                            <p className={index === 0 ? 'result-travel result-travel-start' : 'result-travel'}>
                              {previous ? `${previous.name}에서 이동 · ${travel}` : travel}
                            </p>
                          )}
                          <div
                            className={[
                              isNamedStop ? 'result-visit result-visit-stay' : 'result-visit',
                              isEditing ? 'is-editable' : '',
                              stopDrag?.day === day.day && stopDrag.from === index ? 'is-dragging' : '',
                              stopDrag?.day === day.day && stopDrag.over === index && stopDrag.from !== index ? 'is-drop-target' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <span style={{ background: color }}>{label}</span>
                            <div>
                              <strong>{stop.name}</strong>
                              <small>
                                {stop.kind === 'arrival'
                                  ? transitCaption('arrival', plan, stop.startTime)
                                  : stop.kind === 'departure'
                                    ? transitCaption('departure', plan, stop.startTime)
                                    : place
                                      ? formatPlaceSchedule(place)
                                      : stop.kind === 'lodging'
                                        ? '숙소에서 하루를 시작하거나 마무리해요.'
                                        : '영업시간 정보 없음'}
                              </small>
                            </div>
                            {isEditing && (
                              <button
                                type="button"
                                className="result-visit-handle"
                                aria-label={`${stop.name} 끌어 순서 바꾸기`}
                                disabled={isSavingEdits}
                                onPointerDown={(event) => startStopDrag(event, day.day, index)}
                                onPointerMove={moveStopDrag}
                                onPointerUp={endStopDrag}
                                onPointerCancel={endStopDrag}
                              >
                                <span />
                                <span />
                                <span />
                              </button>
                            )}
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
        도보·자동차 이동 시간은 두 장소 사이 직선 거리로 계산한 예상값입니다. 실제 영업시간·휴무일·브레이크타임과 교통편은 방문 전 확인해 주세요.
      </p>
    </section>
  )
}

export default ResultPage
