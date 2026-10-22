import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import plannerArrow from '../assets/planner-arrow.svg'
import plannerBag from '../assets/planner-bag.svg'
import plannerBookmark from '../assets/planner-bookmark.svg'
import plannerCalendar from '../assets/planner-calendar.svg'
import plannerCalendarDays from '../assets/planner-calendar-days.svg'
import plannerChevronDown from '../assets/planner-chevron-down.svg'
import plannerClose from '../assets/planner-close.svg'
import plannerChevron from '../assets/planner-chevron.svg'
import plannerGlobe from '../assets/planner-globe.svg'
import plannerMinus from '../assets/planner-minus.svg'
import plannerPin from '../assets/planner-pin.svg'
import plannerPlus from '../assets/planner-plus.svg'
import plannerSearch from '../assets/planner-search.svg'
import plannerSparkles from '../assets/planner-sparkles.svg'
import { getItinerary, requestItinerary, saveItinerary } from '../api/itinerary'
import { getPlan, savePlan, touchPlan, transitFromPlan, updatePlanDayHours, updatePlanDestination, updatePlanLodging, updatePlanMeals, updatePlanSchedule, updatePlanTransit, transitModeLabel, transitModes, type PlanLodging, type PlanMeals, type PlanTransit, type TransitMode } from '../api/plans'
import { addPlace, clearPlaces, deletePlace, getPlaces } from '../api/places'
import EmptyState from '../components/EmptyState'
import OptimizeWait from '../components/OptimizeWait'
import SkeletonLoader from '../components/SkeletonLoader'
import MapsProvider, { useMapsStatus, WhenMapsReady } from '../components/MapsProvider'
import PlaceSearchRunner, { type PlaceSearchResult, type PlaceSearchType } from '../components/PlaceSearchRunner'
import PlannerMap from '../components/PlannerMap'
import { destinations, findRegion } from '../data/destinations'
import { formatPlaceSchedule } from '../utils/placeSchedule'
import type { Itinerary } from '../types/itinerary'
import type { Plan } from '../types/plan'
import { placeCategoryLabel, type Place } from '../types/place'
import { useToast } from '../contexts/ToastContext'
import { placeRole } from '../utils/placeCategory'
import { countTripMeals, countTripSights } from '../utils/tripMeals'

const searchDebounceMs = 400
const defaultDayStart = '09:00'
const defaultDayEnd = '22:00'
const defaultMeals: PlanMeals = {
  includeBreakfast: true,
  includeLunch: true,
  includeDinner: true,
}
const mealChoices = [
  { key: 'includeBreakfast', label: '아침' },
  { key: 'includeLunch', label: '점심' },
  { key: 'includeDinner', label: '저녁' },
] as const satisfies ReadonlyArray<{ key: keyof PlanMeals; label: string }>
const emptyTransitForm = { transport: null, placeId: '', time: '' } as const

type TransitForm = {
  transport: TransitMode | null
  placeId: string
  time: string
}

function transitPlacePrompt(mode: TransitMode | null, gate: 'arrival' | 'departure') {
  if (!mode) {
    return '먼저 이동 수단을 선택해 주세요'
  }

  if (mode === 'flight') {
    return gate === 'arrival' ? '도착 공항을 선택해 주세요' : '출발 공항을 선택해 주세요'
  }

  if (mode === 'train') {
    return gate === 'arrival' ? '도착 기차역을 선택해 주세요' : '출발 기차역을 선택해 주세요'
  }

  return gate === 'arrival' ? '일정 시작 장소를 선택해 주세요' : '복귀 출발 장소를 선택해 주세요'
}

function hubTypeOf(mode: TransitMode | null): PlaceSearchType | null {
  if (mode === 'flight') {
    return 'airport'
  }

  if (mode === 'train') {
    return 'train_station'
  }

  return null
}

function completeTransit(form: TransitForm, pocket: Place[], saved: PlanTransit | null): PlanTransit | null {
  if (!form.transport || !form.placeId || !form.time) {
    return null
  }

  const place = pocket.find((item) => item.id === form.placeId)

  if (place) {
    return {
      transport: form.transport,
      placeId: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      time: form.time,
    }
  }

  if (saved && saved.placeId === form.placeId) {
    return { ...saved, transport: form.transport, time: form.time }
  }

  return null
}

function asMapPlace(place: Place): PlaceSearchResult {
  return {
    id: place.id,
    name: place.name,
    address: null,
    latitude: place.latitude,
    longitude: place.longitude,
    category: placeRole(place),
    openingHours: place.openingHours,
    closedDays: place.closedDays,
    breakTime: place.breakTime,
    iconUrl: null,
    iconBackgroundColor: null,
    photoUrl: place.photoUrl,
  }
}

function formFromTransit(transit: PlanTransit | null): TransitForm {
  if (!transit) {
    return { ...emptyTransitForm }
  }

  return { transport: transit.transport, placeId: transit.placeId, time: transit.time }
}
const dayTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})

function formatKoreanTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)

  if (!match) {
    return value
  }

  const hour = Number(match[1])
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${String(hour12).padStart(2, '0')}:${match[2]}`
}

function timeChoices(value: string) {
  return dayTimeOptions.includes(value) ? dayTimeOptions : [...dayTimeOptions, value].sort()
}

function openDatePicker(input: HTMLInputElement) {
  const picker = input as HTMLInputElement & { showPicker?: () => void }

  try {
    picker.showPicker?.()
  } catch {
    input.focus()
  }
}

const steps = [
  { number: 1, label: '나라 선택' },
  { number: 2, label: '여행 주머니에 담기' },
  { number: 3, label: '계획 최적화' },
]

function PlannerPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [openMenu, setOpenMenu] = useState<'country' | 'region' | 'dayStart' | 'dayEnd' | 'arrivalTime' | 'departureTime' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [places, setPlaces] = useState<Place[]>([])
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(Boolean(planId))
  const [placeName, setPlaceName] = useState('')
  const [isUpdatingPlaces, setIsUpdatingPlaces] = useState(false)
  const [isSavingPlaces, setIsSavingPlaces] = useState(false)
  const [nights, setNights] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [lodging, setLodging] = useState<PlanLodging | null>(null)
  const [arrivalForm, setArrivalForm] = useState<TransitForm>({ ...emptyTransitForm })
  const [departureForm, setDepartureForm] = useState<TransitForm>({ ...emptyTransitForm })
  const [savedArrival, setSavedArrival] = useState<PlanTransit | null>(null)
  const [savedDeparture, setSavedDeparture] = useState<PlanTransit | null>(null)
  const [dayStart, setDayStart] = useState(defaultDayStart)
  const [dayEnd, setDayEnd] = useState(defaultDayEnd)
  const [meals, setMeals] = useState<PlanMeals>(defaultMeals)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeError, setOptimizeError] = useState('')
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2>(planId ? 2 : 1)
  const [searchRequest, setSearchRequest] = useState<{ id: number; query: string } | null>(null)
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([])
  const [hubRequest, setHubRequest] = useState<{ id: number; query: string; includedType: PlaceSearchType } | null>(null)
  const [hubLists, setHubLists] = useState<Partial<Record<PlaceSearchType, PlaceSearchResult[]>>>({})
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [pinnedPlace, setPinnedPlace] = useState<PlaceSearchResult | null>(null)
  const [mapFocus, setMapFocus] = useState<'results' | 'place'>('results')
  const [isSearching, setIsSearching] = useState(false)
  const [emptySearchQuery, setEmptySearchQuery] = useState<string | null>(null)
  const [isConfirmingClear, setIsConfirmingClear] = useState(false)
  const [isConfirmingOptimize, setIsConfirmingOptimize] = useState(false)
  const searchTimer = useRef<number | null>(null)
  const mapsStatus = useRef<'ready' | 'missing' | 'failed'>('missing')
  const destinationMenu = useRef<HTMLDivElement>(null)
  const dayHoursMenu = useRef<HTMLDivElement>(null)
  const transitMenu = useRef<HTMLDivElement>(null)
  const clearDialogCancelRef = useRef<HTMLButtonElement>(null)
  const optimizeDialogCancelRef = useRef<HTMLButtonElement>(null)
  const dayHoursTouched = useRef(false)
  const mealsTouched = useRef(false)
  const activeCountry = country || plan?.country || ''
  const activeRegion = currentStep === 1 ? region : region || plan?.region || ''
  const regions = destinations.find((item) => item.country === activeCountry)?.regions ?? []
  const mapRegion = findRegion(activeCountry, activeRegion)
  const editingDestination = Boolean(planId) && currentStep === 1
  const days = nights === null ? null : nights + 1
  const stayPlaces = places.filter((place) => place.category === 'stay')
  const sightCount = places.filter((place) => placeRole(place) === 'sight').length
  const foodCount = places.filter((place) => placeRole(place) === 'food').length
  const arrival = completeTransit(arrivalForm, places, savedArrival)
  const departure = completeTransit(departureForm, places, savedDeparture)
  const arrivalHubType = hubTypeOf(arrivalForm.transport)
  const departureHubType = hubTypeOf(departureForm.transport)
  const arrivalHubs = arrivalHubType ? hubLists[arrivalHubType] : null
  const departureHubs = departureHubType ? hubLists[departureHubType] : null
  const dayHoursInvalid = Boolean(dayStart && dayEnd && dayStart >= dayEnd)
  const sameDayTransitInvalid = Boolean(days === 1 && arrival && departure && arrival.time >= departure.time)
  const missingRequirements = [
    !planId ? '저장된 계획' : null,
    nights === null ? '여행 기간' : null,
    !startDate ? '출발일' : null,
    !lodging ? '숙소' : null,
    !arrival ? '첫날 도착' : null,
    !departure ? '마지막날 복귀' : null,
    sameDayTransitInvalid ? '도착·복귀 시각' : null,
    !(dayStart && dayEnd && dayStart < dayEnd) ? '활동 시간' : null,
    places.length === 0 ? '담은 장소' : null,
  ].filter((item): item is string => Boolean(item))
  const canOptimize = missingRequirements.length === 0
  const tripWindow =
    nights !== null && arrival && departure && dayStart && dayEnd && dayStart < dayEnd
      ? {
          nights,
          dayStart,
          dayEnd,
          arrivalTime: arrival.time,
          departureTime: departure.time,
        }
      : null
  const mealCount = tripWindow ? countTripMeals({ ...tripWindow, meals }) : 0
  const sightNeed = tripWindow ? countTripSights(tripWindow) : 0
  const needsMealWarning = mealCount > 0 && foodCount < mealCount
  const needsSightWarning = sightNeed > 0 && sightCount < sightNeed
  const needsOptimizeWarning = needsMealWarning || needsSightWarning
  const sightShort = Math.max(0, sightNeed - sightCount)
  const mealShort = Math.max(0, mealCount - foodCount)
  const optimizeShortageTitle = [
    needsSightWarning ? `관광지는 최소 ${sightShort}개` : null,
    needsMealWarning ? `맛집은 최소 ${mealShort}개` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(', ')
    .concat('가 부족합니다')

  useEffect(() => {
    if (error) {
      showToast(error, 'error')
    }
  }, [error, showToast])

  useEffect(() => {
    if (optimizeError) {
      showToast(optimizeError, 'error')
    }
  }, [optimizeError, showToast])

  useEffect(() => {
    if (!planId) {
      setIsLoadingPlaces(false)
      return
    }

    let ignore = false
    setIsLoadingPlaces(true)

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
        setCountry(nextPlan.country ?? '')
        setRegion(nextPlan.region)
        setNights(nextPlan.nights)
        setStartDate(nextPlan.startDate)
        setLodging(
          nextPlan.lodgingPlaceId && nextPlan.lodgingName && nextPlan.lodgingLatitude !== null && nextPlan.lodgingLongitude !== null
            ? {
                lodgingPlaceId: nextPlan.lodgingPlaceId,
                lodgingName: nextPlan.lodgingName,
                lodgingLatitude: nextPlan.lodgingLatitude,
                lodgingLongitude: nextPlan.lodgingLongitude,
              }
            : null,
        )
        const nextArrival = transitFromPlan(nextPlan, 'arrival')
        const nextDeparture = transitFromPlan(nextPlan, 'departure')
        setSavedArrival(nextArrival)
        setSavedDeparture(nextDeparture)
        setArrivalForm(formFromTransit(nextArrival))
        setDepartureForm(formFromTransit(nextDeparture))
        if (!mealsTouched.current) {
          const nextMeals = {
            includeBreakfast: nextPlan.includeBreakfast ?? defaultMeals.includeBreakfast,
            includeLunch: nextPlan.includeLunch ?? defaultMeals.includeLunch,
            includeDinner: nextPlan.includeDinner ?? defaultMeals.includeDinner,
          }
          setMeals(nextMeals)

          if (nextPlan.includeBreakfast === null && nextPlan.includeLunch === null && nextPlan.includeDinner === null) {
            void updatePlanMeals(nextPlan.id, nextMeals)
              .then((updatedAt) => {
                if (!ignore && !mealsTouched.current) {
                  setPlan((current) => (current ? { ...current, ...nextMeals, updatedAt } : current))
                }
              })
              .catch(() => {
                if (!ignore && !mealsTouched.current) {
                  setError('식사 옵션을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
                }
              })
          }
        }

        if (!dayHoursTouched.current) {
          const nextStart = nextPlan.dayStart ?? defaultDayStart
          const nextEnd = nextPlan.dayEnd ?? defaultDayEnd
          setDayStart(nextStart)
          setDayEnd(nextEnd)

          if (!nextPlan.dayStart && !nextPlan.dayEnd && nextStart < nextEnd) {
            setIsSavingSchedule(true)
            void updatePlanDayHours(nextPlan.id, nextStart, nextEnd)
              .then((updatedAt) => {
                if (!ignore && !dayHoursTouched.current) {
                  setPlan((current) => (current ? { ...current, dayStart: nextStart, dayEnd: nextEnd, updatedAt } : current))
                }
              })
              .catch(() => {
                if (!ignore && !dayHoursTouched.current) {
                  setError('활동 시간을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
                }
              })
              .finally(() => {
                if (!ignore) {
                  setIsSavingSchedule(false)
                }
              })
          }
        }

        return Promise.all([getPlaces(planId), getItinerary(planId)])
      })
      .then((loaded) => {
        if (ignore || !loaded) {
          return
        }

        const [nextPlaces, nextItinerary] = loaded
        setIsLoadingPlaces(false)
        if (nextPlaces) {
          setPlaces(nextPlaces)
        }
        setItinerary((current) => current ?? nextItinerary)
      })
      .catch(() => {
        if (!ignore) {
          setIsLoadingPlaces(false)
          setError('여행 계획을 불러오지 못했습니다.')
        }
      })

    return () => {
      ignore = true
    }
  }, [navigate, planId])

  useEffect(() => {
    setCurrentStep(planId ? 2 : 1)
  }, [planId])

  useEffect(() => {
    if (!openMenu) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (destinationMenu.current?.contains(target) || dayHoursMenu.current?.contains(target) || transitMenu.current?.contains(target)) {
        return
      }
      setOpenMenu(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

  useEffect(() => {
    if (!isConfirmingClear) {
      return
    }

    clearDialogCancelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsConfirmingClear(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isConfirmingClear])

  useEffect(() => {
    if (!isConfirmingOptimize) {
      return
    }

    optimizeDialogCancelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isOptimizing) {
        setIsConfirmingOptimize(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isConfirmingOptimize, isOptimizing])

  useEffect(() => {
    if (openMenu !== 'dayStart' && openMenu !== 'dayEnd' && openMenu !== 'arrivalTime' && openMenu !== 'departureTime') {
      return
    }

    const menuRoot = openMenu === 'dayStart' || openMenu === 'dayEnd' ? dayHoursMenu.current : transitMenu.current
    menuRoot?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [openMenu])

  useEffect(() => {
    setHubLists({})
    setHubRequest(null)
  }, [activeCountry, activeRegion])

  useEffect(() => {
    if (!activeRegion) {
      return
    }

    const needed = [arrivalHubType, departureHubType].filter((type): type is PlaceSearchType => Boolean(type))
    const missing = needed.find((type) => hubLists[type] === undefined)

    if (!missing) {
      return
    }

    setHubRequest({
      id: Date.now(),
      query: missing === 'airport' ? '공항' : '기차역',
      includedType: missing,
    })
  }, [activeRegion, arrivalHubType, departureHubType, hubLists])

  const canSearch = Boolean(planId || region)

  function startSearch(query: string) {
    if (!query) {
      setSearchResults([])
      setSelectedPlaceId(null)
      setEmptySearchQuery(null)
      setIsSearching(false)
      return
    }

    if (mapsStatus.current === 'missing' || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setIsSearching(false)
      setError('구글 지도 API 키를 설정해 주세요.')
      return
    }

    if (mapsStatus.current === 'failed') {
      setIsSearching(false)
      setError('지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }

    setError('')
    setEmptySearchQuery(null)
    setIsSearching(true)
    setSearchRequest({ id: Date.now(), query })
  }

  useEffect(() => {
    if (!canSearch) {
      return
    }

    const query = placeName.trim()

    if (!query) {
      setSearchResults([])
      setSelectedPlaceId(null)
      setIsSearching(false)
      return
    }

    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null
      startSearch(query)
    }, searchDebounceMs)

    return () => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
    }
  }, [placeName, canSearch])

  function handleSearch() {
    const query = placeName.trim()

    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current)
      searchTimer.current = null
    }

    if (!query) {
      setError('검색할 장소를 입력해 주세요.')
      return
    }

    startSearch(query)
    destinationMenu.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await handleSearch()
  }

  function handleChooseCountryStep() {
    if (!planId || currentStep === 1) {
      return
    }

    setCountry(plan?.country ?? country)
    setRegion(plan?.region ?? region)
    setOpenMenu('country')
    setCurrentStep(1)
  }

  async function handleChooseRegion(nextRegion: string) {
    const nextCountry = country || plan?.country || ''
    setRegion(nextRegion)
    setOpenMenu(null)

    if (!planId || !plan || !nextCountry) {
      return
    }

    if (plan.country === nextCountry && plan.region === nextRegion) {
      setCurrentStep(2)
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const updatedAt = await updatePlanDestination(planId, nextCountry, nextRegion)
      if (places.length > 0) {
        await clearPlaces(planId)
        setPlaces([])
      }
      setPlan({ ...plan, country: nextCountry, region: nextRegion, updatedAt })
      setPlaceName('')
      setSearchResults([])
      setSelectedPlaceId(null)
      setCurrentStep(2)
    } catch {
      setError('나라와 지역을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreatePlan() {
    if (!country || !region) {
      setError('나라와 지역을 선택해 주세요.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const nextPlan = await savePlan({
        country,
        region,
        nights,
        startDate,
        lodging,
        dayStart: dayStart && dayEnd && dayStart < dayEnd ? dayStart : null,
        dayEnd: dayStart && dayEnd && dayStart < dayEnd ? dayEnd : null,
        meals,
      })
      navigate(`/planner/${nextPlan.id}`, { replace: true })
    } catch {
      setError('여행 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  async function addResultToPocket(result: PlaceSearchResult) {
    const existing = places.find((place) => place.name === result.name)

    if (existing) {
      return existing
    }

    setIsUpdatingPlaces(true)
    setError('')

    let nextPlanId = planId

    try {
      if (!nextPlanId) {
        if (!country || !region) {
          setError('나라와 지역을 선택해 주세요.')
          return null
        }

        const nextPlan = await savePlan({
        country,
        region,
        nights,
        startDate,
        lodging,
        dayStart: dayStart && dayEnd && dayStart < dayEnd ? dayStart : null,
        dayEnd: dayStart && dayEnd && dayStart < dayEnd ? dayEnd : null,
        meals,
      })
        nextPlanId = nextPlan.id
      }

      const place = await addPlace(nextPlanId, {
        name: result.name,
        category: placeRole(result),
        latitude: result.latitude,
        longitude: result.longitude,
        openingHours: result.openingHours,
        closedDays: result.closedDays,
        breakTime: result.breakTime,
        photoUrl: result.photoUrl,
      })

      showToast('주머니에 담았어요.')

      if (planId) {
        setPlaces((current) => [...current, place].sort((left, right) => left.name.localeCompare(right.name, 'ko')))
        return place
      }

      navigate(`/planner/${nextPlanId}`, { replace: true })
      return place
    } catch (error) {
      console.error(error)
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
      setError(
        code === 'permission-denied'
          ? '장소를 담지 못했습니다. 저장 권한을 확인해 주세요.'
          : '장소를 담지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
      if (!planId && nextPlanId) {
        navigate(`/planner/${nextPlanId}`, { replace: true })
      }
      return null
    } finally {
      setIsUpdatingPlaces(false)
    }
  }

  async function handleAddToPocket(result: PlaceSearchResult) {
    await addResultToPocket(result)
  }

  async function handleDeletePlace(placeId: string) {
    if (!planId) {
      return
    }

    setIsUpdatingPlaces(true)
    setError('')

    try {
      await deletePlace(planId, placeId)
      const nextPlaces = places.filter((place) => place.id !== placeId)
      setPlaces(nextPlaces)
      showToast('주머니에서 빼 두었어요.')

      if (pinnedPlace?.id === placeId) {
        setPinnedPlace(null)
        setSelectedPlaceId((current) => (current === placeId ? null : current))
      }

      if (lodging?.lodgingPlaceId === placeId) {
        const updatedAt = await updatePlanLodging(planId, null)
        setLodging(null)
        setPlan((current) =>
          current
            ? {
                ...current,
                lodgingPlaceId: null,
                lodgingName: null,
                lodgingLatitude: null,
                lodgingLongitude: null,
                updatedAt,
              }
            : current,
        )
      }
    } catch {
      setError('장소를 빼지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUpdatingPlaces(false)
    }
  }

  async function handleClearPlaces() {
    if (!planId || places.length === 0) {
      return
    }

    setIsConfirmingClear(false)
    setIsUpdatingPlaces(true)
    setError('')

    try {
      await clearPlaces(planId)
      setPlaces([])
      setPinnedPlace(null)
      showToast('주머니를 비웠어요.')

      if (lodging) {
        const updatedAt = await updatePlanLodging(planId, null)
        setLodging(null)
        setPlan((current) =>
          current
            ? {
                ...current,
                lodgingPlaceId: null,
                lodgingName: null,
                lodgingLatitude: null,
                lodgingLongitude: null,
                updatedAt,
              }
            : current,
        )
      }
    } catch {
      setError('장소를 비우지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUpdatingPlaces(false)
    }
  }

  function handleOptimize() {
    if (!canOptimize || isOptimizing) {
      return
    }

    if (needsOptimizeWarning) {
      setIsConfirmingOptimize(true)
      return
    }

    void runOptimize()
  }

  async function runOptimize() {
    if (!canOptimize || !planId || nights === null || !startDate || !lodging || !arrival || !departure || !(dayStart && dayEnd && dayStart < dayEnd)) {
      return
    }

    setIsConfirmingOptimize(false)
    setIsOptimizing(true)
    setOptimizeError('')
    setItinerary(null)

    try {
      const nextItinerary = await requestItinerary({
        planId,
        country: activeCountry || null,
        region: activeRegion,
        nights,
        startDate,
        dayStart,
        dayEnd,
        meals,
        lodging,
        arrival,
        departure,
        places,
      })
      const updatedAt = await saveItinerary(nextItinerary)
      setItinerary(nextItinerary)
      setPlan((current) => (current ? { ...current, status: 'optimized', updatedAt } : current))
      showToast('여행 일정을 만들었어요.')
      navigate(`/result/${planId}`, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const known =
        message.startsWith('최적화') || message.startsWith('OpenAI') || message.startsWith('로그인') || message.startsWith('플랜 상태')
      setOptimizeError(known ? message : '일정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsOptimizing(false)
    }
  }

  async function handleSavePlaces() {
    if (!planId || !plan) {
      return
    }

    setIsSavingPlaces(true)
    setError('')

    try {
      await touchPlan(planId)
      showToast('담은 장소를 저장했어요.')
      navigate('/plans')
    } catch {
      setError('장소를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSavingPlaces(false)
    }
  }

  async function persistSchedule(nextNights: number | null, nextStartDate: string | null) {
    setNights(nextNights)
    setStartDate(nextStartDate)

    if (!planId) {
      return
    }

    setIsSavingSchedule(true)
    setError('')

    try {
      const updatedAt = await updatePlanSchedule(planId, nextNights, nextStartDate)
      setPlan((current) => (current ? { ...current, nights: nextNights, startDate: nextStartDate, updatedAt } : current))
    } catch {
      setError('여행 기간을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  function changeNights(delta: number) {
    if (nights === null) {
      if (delta < 0) {
        return
      }

      void persistSchedule(0, startDate)
      return
    }

    const nextNights = nights + delta

    if (nextNights > 60) {
      return
    }

    void persistSchedule(nextNights < 0 ? null : nextNights, startDate)
  }

  function changeStartDate(value: string) {
    const nextStartDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
    void persistSchedule(nights, nextStartDate)
  }

  async function persistLodging(nextLodging: PlanLodging | null) {
    setLodging(nextLodging)

    if (!planId) {
      return
    }

    setIsSavingSchedule(true)
    setError('')

    try {
      const updatedAt = await updatePlanLodging(planId, nextLodging)
      setPlan((current) =>
        current
          ? {
              ...current,
              lodgingPlaceId: nextLodging?.lodgingPlaceId ?? null,
              lodgingName: nextLodging?.lodgingName ?? null,
              lodgingLatitude: nextLodging?.lodgingLatitude ?? null,
              lodgingLongitude: nextLodging?.lodgingLongitude ?? null,
              updatedAt,
            }
          : current,
      )
    } catch {
      setError('숙소 위치를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  function changeLodging(placeId: string) {
    if (!placeId) {
      void persistLodging(null)
      return
    }

    const place = stayPlaces.find((item) => item.id === placeId)

    if (!place) {
      return
    }

    void persistLodging({
      lodgingPlaceId: place.id,
      lodgingName: place.name,
      lodgingLatitude: place.latitude,
      lodgingLongitude: place.longitude,
    })
  }

  async function persistTransit(gate: 'arrival' | 'departure', form: TransitForm, pocket = places) {
    const next = completeTransit(form, pocket, gate === 'arrival' ? savedArrival : savedDeparture)

    if (!next || !planId) {
      return
    }

    setIsSavingSchedule(true)
    setError('')

    try {
      const updatedAt = await updatePlanTransit(planId, gate, next)

      if (gate === 'arrival') {
        setSavedArrival(next)
        setPlan((current) =>
          current
            ? {
                ...current,
                arrivalTransport: next.transport,
                arrivalPlaceId: next.placeId,
                arrivalPlaceName: next.name,
                arrivalLatitude: next.latitude,
                arrivalLongitude: next.longitude,
                arrivalTime: next.time,
                updatedAt,
              }
            : current,
        )
        return
      }

      setSavedDeparture(next)
      setPlan((current) =>
        current
          ? {
              ...current,
              departureTransport: next.transport,
              departurePlaceId: next.placeId,
              departurePlaceName: next.name,
              departureLatitude: next.latitude,
              departureLongitude: next.longitude,
              departureTime: next.time,
              updatedAt,
            }
          : current,
      )
    } catch {
      setError(gate === 'arrival' ? '첫날 도착 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' : '복귀 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  function changeArrival(patch: Partial<TransitForm>) {
    const nextForm = { ...arrivalForm, ...patch }
    setArrivalForm(nextForm)
    void persistTransit('arrival', nextForm)
  }

  function changeDeparture(patch: Partial<TransitForm>) {
    const nextForm = { ...departureForm, ...patch }
    setDepartureForm(nextForm)
    void persistTransit('departure', nextForm)
  }

  function hubSelectValue(form: TransitForm, hubs: PlaceSearchResult[], saved: PlanTransit | null) {
    const selected = places.find((place) => place.id === form.placeId)
    const name = selected?.name ?? (saved?.placeId === form.placeId ? saved.name : null)

    if (!name) {
      return ''
    }

    return hubs.find((hub) => hub.name === name)?.id ?? ''
  }

  async function chooseTransitHub(gate: 'arrival' | 'departure', result: PlaceSearchResult) {
    const place = await addResultToPocket(result)

    if (!place) {
      return
    }

    const pocket = places.some((item) => item.id === place.id) ? places : [...places, place]
    const nextForm = { ...(gate === 'arrival' ? arrivalForm : departureForm), placeId: place.id }

    if (gate === 'arrival') {
      setArrivalForm(nextForm)
      void persistTransit('arrival', nextForm, pocket)
      return
    }

    setDepartureForm(nextForm)
    void persistTransit('departure', nextForm, pocket)
  }

  async function persistDayHours(nextStart: string | null, nextEnd: string | null) {
    const complete = Boolean(nextStart && nextEnd && nextStart < nextEnd)
    const cleared = !nextStart && !nextEnd

    if (!complete && !cleared) {
      return
    }

    if (!planId) {
      return
    }

    setIsSavingSchedule(true)
    setError('')

    try {
      const updatedAt = await updatePlanDayHours(planId, complete ? nextStart : null, complete ? nextEnd : null)
      setPlan((current) =>
        current
          ? { ...current, dayStart: complete ? nextStart : null, dayEnd: complete ? nextEnd : null, updatedAt }
          : current,
      )
    } catch {
      setError('활동 시간을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  function changeDayHours(nextStart: string, nextEnd: string) {
    dayHoursTouched.current = true
    setDayStart(nextStart)
    setDayEnd(nextEnd)
    void persistDayHours(nextStart, nextEnd)
  }

  async function persistMeals(nextMeals: PlanMeals) {
    if (!planId) {
      return
    }

    setIsSavingSchedule(true)
    setError('')

    try {
      const updatedAt = await updatePlanMeals(planId, nextMeals)
      setPlan((current) => (current ? { ...current, ...nextMeals, updatedAt } : current))
    } catch {
      setError('식사 옵션을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  function changeMeal(key: keyof PlanMeals) {
    const nextMeals = { ...meals, [key]: !meals[key] }
    mealsTouched.current = true
    setMeals(nextMeals)
    void persistMeals(nextMeals)
  }

  function formatStartDate(value: string) {
    const [year, month, day] = value.split('-').map(Number)

    if (!year || !month || !day) {
      return value
    }

    return `${year}년 ${month}월 ${day}일`
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
            <li
              key={step.number}
              className={step.number === currentStep ? 'is-current' : undefined}
              aria-current={step.number === currentStep ? 'step' : undefined}
            >
              {step.number < 3 ? (
                <button
                  type="button"
                  disabled={step.number === 1 ? !planId || currentStep === 1 : !planId || currentStep === 2}
                  onClick={() => {
                    if (step.number === 1) {
                      handleChooseCountryStep()
                      return
                    }

                    setCountry(plan?.country ?? '')
                    setRegion(plan?.region ?? '')
                    setCurrentStep(2)
                  }}
                >
                  <span>{step.number}</span>
                  {step.label}
                </button>
              ) : (
                <>
                  <span>{step.number}</span>
                  {step.label}
                </>
              )}
              {index < steps.length - 1 && <img src={plannerChevron} alt="" />}
            </li>
          ))}
        </ol>
      </div>
      <div className="planner-workspace">
        <MapsProvider>
        <MapsStatusBridge statusRef={mapsStatus} />
        <div className="planner-explore">
          <form className="planner-search" onSubmit={handleSubmit}>
            <div className="planner-search-label">
              <p>어디로 떠나시나요?</p>
              <p>나라를 고르고, 원하는 장소를 검색해 주머니에 담아 보세요</p>
            </div>
            <div className="planner-search-tools" ref={destinationMenu}>
              <div className={openMenu === 'country' ? 'planner-dropdown is-open' : 'planner-dropdown'}>
                <button
                  type="button"
                  className="planner-country"
                  aria-label="나라 선택"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'country'}
                  disabled={currentStep !== 1}
                  onClick={() => setOpenMenu((current) => (current === 'country' ? null : 'country'))}
                >
                  <img src={plannerGlobe} alt="" />
                  <span>{activeCountry || '나라'}</span>
                  <img src={plannerChevronDown} alt="" />
                </button>
                {openMenu === 'country' && (
                  <ul className="planner-dropdown-menu" role="listbox" aria-label="나라">
                    {destinations.map((item) => (
                      <li key={item.country}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={item.country === activeCountry}
                          onClick={() => {
                            setCountry(item.country)
                            setRegion('')
                            setOpenMenu('region')
                          }}
                        >
                          {item.country}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={openMenu === 'region' ? 'planner-dropdown is-open' : 'planner-dropdown'}>
                <button
                  type="button"
                  className="planner-region"
                  aria-label="지역 선택"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'region'}
                  disabled={currentStep !== 1 || !activeCountry}
                  onClick={() => setOpenMenu((current) => (current === 'region' ? null : 'region'))}
                >
                  <img src={plannerPin} alt="" />
                  <span>{activeRegion || '지역'}</span>
                  <img src={plannerChevronDown} alt="" />
                </button>
                {openMenu === 'region' && (
                  <ul className="planner-dropdown-menu" role="listbox" aria-label="지역">
                    {regions.map((item) => (
                      <li key={item.name}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={item.name === activeRegion}
                          onClick={() => handleChooseRegion(item.name)}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="planner-query">
                <img src={plannerSearch} alt="" />
                <input
                  value={placeName}
                  placeholder="장소를 입력해 주세요"
                  aria-label="장소 이름"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'planner-search-error' : undefined}
                  disabled={!canSearch || editingDestination}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
              </label>
              <button type="submit" className="planner-search-submit" disabled={editingDestination || !canSearch || isSearching || !placeName.trim()}>
                {isSearching ? '검색 중' : '검색'}
              </button>
            </div>
            {!planId && (
              <button type="button" className="planner-start" disabled={isSaving || !country || !region} onClick={handleCreatePlan}>
                이 지역으로 시작
              </button>
            )}
            {error && (
              <p id="planner-search-error" className="login-error" role="alert">
                {error}
              </p>
            )}
          </form>
          {canSearch && (
            <WhenMapsReady>
            <PlaceSearchRunner
              request={searchRequest}
              latitude={mapRegion?.latitude ?? null}
              longitude={mapRegion?.longitude ?? null}
              regionName={mapRegion?.name ?? plan?.region ?? null}
              onSuccess={(query, results) => {
                if (query !== placeName.trim()) {
                  return
                }

                setSearchResults(results)
                setSelectedPlaceId(results[0]?.id ?? null)
                setEmptySearchQuery(results.length === 0 ? query : null)
                setMapFocus('results')
                setIsSearching(false)
              }}
              onError={(query) => {
                if (query !== placeName.trim()) {
                  return
                }

                setSearchResults([])
                setSelectedPlaceId(null)
                setEmptySearchQuery(null)
                setIsSearching(false)
                setError('장소를 검색하지 못했습니다. 지도 키에 Places API (New)가 허용돼 있는지 확인해 주세요.')
              }}
            />
            <PlaceSearchRunner
              request={hubRequest}
              latitude={mapRegion?.latitude ?? null}
              longitude={mapRegion?.longitude ?? null}
              regionName={mapRegion?.name ?? (activeRegion || null)}
              onSuccess={(query, results) => {
                if (!hubRequest || query !== hubRequest.query) {
                  return
                }

                setHubLists((current) => ({ ...current, [hubRequest.includedType]: results }))
              }}
              onError={(query) => {
                if (!hubRequest || query !== hubRequest.query) {
                  return
                }

                setHubLists((current) => ({ ...current, [hubRequest.includedType]: [] }))
                setError('공항·기차역을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.')
              }}
            />
            </WhenMapsReady>
          )}
          <PlannerMap
            latitude={mapRegion?.latitude ?? 20}
            longitude={mapRegion?.longitude ?? 0}
            zoom={mapRegion ? 12 : 2}
            places={searchResults}
            pinnedPlace={pinnedPlace}
            selectedPlaceId={selectedPlaceId}
            focus={mapFocus}
            onSelectPlace={(placeId) => {
              setSelectedPlaceId(placeId)
              if (placeId && pinnedPlace && placeId !== pinnedPlace.id) {
                setPinnedPlace(null)
              }
              if (placeId) {
                setMapFocus('place')
              }
            }}
            savedPlaceNames={places.map((place) => place.name)}
            isAddingPlace={isUpdatingPlaces}
            onAddPlace={handleAddToPocket}
          />
          <div className="planner-search-results-slot">
            {!isSearching && !error && emptySearchQuery === placeName.trim() && (
              <EmptyState
                icon={plannerSearch}
                title="검색 결과가 없습니다"
                description="다른 이름이나 지역으로 다시 찾아 보세요."
              />
            )}
            {searchResults.length > 0 && (
              <ul className="planner-search-results">
                {searchResults.map((result, index) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className={result.id === selectedPlaceId ? 'is-selected' : undefined}
                      onClick={() => {
                        setSelectedPlaceId(result.id)
                        setMapFocus('place')
                      }}
                    >
                      <span>{index + 1}</span>
                      <span>
                        <strong>{result.name}</strong>
                        {result.address && <small>{result.address}</small>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </MapsProvider>
        <aside className="planner-pocket">
          <div className="planner-pocket-heading">
            <div>
              <img src={plannerBag} alt="" />
              <h2>여행 주머니</h2>
              <span className="planner-pocket-count">{places.length}</span>
              <span className="planner-pocket-mix">
                관광지 {sightCount} · 맛집 {foodCount}
              </span>
            </div>
            <button
              type="button"
              disabled={!planId || places.length === 0 || isUpdatingPlaces}
              onClick={() => setIsConfirmingClear(true)}
            >
              전체 비우기
            </button>
          </div>
          <p>가고 싶은 곳을 주머니에 담으면, 가장 편한 순서로!</p>
          {isLoadingPlaces ? (
            <SkeletonLoader variant="pocket" label="장소를 불러오는 중입니다." />
          ) : places.length === 0 ? (
            <div className="planner-pocket-empty" role="status">
              <strong>아직 담은 장소가 없습니다.</strong>
              <p>검색한 장소를 주머니에 담아 보세요.</p>
            </div>
          ) : (
            <ul className="planner-places">
              {places.map((place, index) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className={place.id === pinnedPlace?.id ? 'planner-place-item is-selected' : 'planner-place-item'}
                    aria-label={`${place.name} 지도에서 보기`}
                    aria-pressed={place.id === pinnedPlace?.id}
                    onClick={() => {
                      setPinnedPlace(asMapPlace(place))
                      setSelectedPlaceId(place.id)
                      setMapFocus('place')
                    }}
                  >
                    <div className="planner-place-thumb" aria-hidden="true">
                      {place.photoUrl && <img src={place.photoUrl} alt="" />}
                      <span>{index + 1}</span>
                    </div>
                    <div className="planner-place-copy">
                      <strong>{place.name}</strong>
                      <p>
                        {placeCategoryLabel[placeRole(place)]}
                        {activeRegion ? ` · ${activeRegion}` : ''}
                      </p>
                      <p className="planner-place-hours">{formatPlaceSchedule(place)}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingPlaces}
                    aria-label={`${place.name} 빼기`}
                    onClick={() => handleDeletePlace(place.id)}
                  >
                    <img src={plannerClose} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="planner-duration">
            <div className="planner-duration-title">
              <img src={plannerCalendarDays} alt="" />
              <h3>얼마나 떠나시나요?</h3>
            </div>
            <div className="planner-counters">
              <div>
                <button type="button" aria-label="기간 줄이기" disabled={nights === null || isSavingSchedule} onClick={() => changeNights(-1)}>
                  <img src={plannerMinus} alt="" />
                </button>
                <p>
                  {nights === null || days === null ? (
                    <strong>–</strong>
                  ) : (
                    <>
                      <strong>{nights}</strong>
                      <span>박</span>
                      <strong>{days}</strong>
                      <span>일</span>
                    </>
                  )}
                </p>
                <button type="button" aria-label="기간 늘리기" disabled={nights === 60 || isSavingSchedule} onClick={() => changeNights(1)}>
                  <img src={plannerPlus} alt="" />
                </button>
              </div>
            </div>
            <label className="planner-date">
              <span>출발일</span>
              <strong>{startDate ? formatStartDate(startDate) : '날짜 미정'}</strong>
              <img src={plannerCalendar} alt="" />
              <input
                type="date"
                aria-label="출발일"
                value={startDate ?? ''}
                disabled={isSavingSchedule}
                onClick={(event) => openDatePicker(event.currentTarget)}
                onChange={(event) => changeStartDate(event.target.value)}
              />
            </label>
            <label className="planner-lodging">
              <img src={plannerPin} alt="" />
              <select
                aria-label="숙소 위치"
                value={lodging?.lodgingPlaceId ?? ''}
                disabled={isSavingSchedule || stayPlaces.length === 0}
                onChange={(event) => changeLodging(event.target.value)}
              >
                <option value="">{stayPlaces.length === 0 ? '숙소를 먼저 담아 주세요' : '숙소를 선택해 주세요'}</option>
                {lodging && !stayPlaces.some((place) => place.id === lodging.lodgingPlaceId) && (
                  <option value={lodging.lodgingPlaceId}>{lodging.lodgingName}</option>
                )}
                {stayPlaces.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
              <img src={plannerChevronDown} alt="" />
            </label>
            <div className="planner-transit" ref={transitMenu}>
              <div className="planner-transit-block">
                <span>첫날 도착</span>
                <div className="planner-meals">
                  {transitModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={arrivalForm.transport === mode}
                      disabled={isSavingSchedule}
                      onClick={() => changeArrival({ transport: mode, placeId: mode === arrivalForm.transport ? arrivalForm.placeId : '' })}
                    >
                      {transitModeLabel[mode]}
                    </button>
                  ))}
                </div>
                <label className="planner-lodging">
                  <img src={plannerPin} alt="" />
                  <select
                    aria-label="도착 장소"
                    value={arrivalHubs ? hubSelectValue(arrivalForm, arrivalHubs, savedArrival) : arrivalForm.placeId}
                    disabled={
                      isSavingSchedule ||
                      isUpdatingPlaces ||
                      !arrivalForm.transport ||
                      (arrivalHubType ? arrivalHubs === undefined : places.length === 0)
                    }
                    onChange={(event) => {
                      if (arrivalHubs) {
                        const result = arrivalHubs.find((hub) => hub.id === event.target.value)
                        if (result) {
                          void chooseTransitHub('arrival', result)
                        }
                        return
                      }

                      changeArrival({ placeId: event.target.value })
                    }}
                  >
                    <option value="">
                      {arrivalHubType && arrivalHubs === undefined
                        ? arrivalHubType === 'airport'
                          ? '공항을 찾는 중'
                          : '기차역을 찾는 중'
                        : arrivalHubType && arrivalHubs?.length === 0
                          ? arrivalHubType === 'airport'
                            ? '이 지역에서 공항을 찾지 못했습니다'
                            : '이 지역에서 기차역을 찾지 못했습니다'
                          : !arrivalHubType && places.length === 0
                            ? '장소를 먼저 담아 주세요'
                            : transitPlacePrompt(arrivalForm.transport, 'arrival')}
                    </option>
                    {arrivalHubs
                      ? arrivalHubs.map((hub) => (
                          <option key={hub.id} value={hub.id}>
                            {hub.name}
                          </option>
                        ))
                      : [
                          savedArrival && !places.some((place) => place.id === savedArrival.placeId) ? (
                            <option key={savedArrival.placeId} value={savedArrival.placeId}>
                              {savedArrival.name}
                            </option>
                          ) : null,
                          ...places.map((place) => (
                            <option key={place.id} value={place.id}>
                              {place.name}
                            </option>
                          )),
                        ]}
                  </select>
                  <img src={plannerChevronDown} alt="" />
                </label>
                <div className={openMenu === 'arrivalTime' ? 'planner-time is-open' : 'planner-time'}>
                  <button
                    type="button"
                    aria-label="도착 시각"
                    aria-haspopup="listbox"
                    aria-expanded={openMenu === 'arrivalTime'}
                    aria-invalid={sameDayTransitInvalid}
                    aria-describedby={sameDayTransitInvalid ? 'planner-transit-time-error' : undefined}
                    disabled={isSavingSchedule || !arrivalForm.transport}
                    onClick={() => setOpenMenu((current) => (current === 'arrivalTime' ? null : 'arrivalTime'))}
                  >
                    {arrivalForm.time ? formatKoreanTime(arrivalForm.time) : '도착 시각'}
                  </button>
                  {openMenu === 'arrivalTime' && (
                    <ul className="planner-time-menu" role="listbox" aria-label="도착 시각">
                      {timeChoices(arrivalForm.time || '10:00').map((time) => (
                        <li key={time}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={time === arrivalForm.time}
                            onClick={() => {
                              changeArrival({ time })
                              setOpenMenu(null)
                            }}
                          >
                            {formatKoreanTime(time)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="planner-transit-block">
                <span>마지막날 복귀</span>
                <div className="planner-meals">
                  {transitModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={departureForm.transport === mode}
                      disabled={isSavingSchedule}
                      onClick={() => changeDeparture({ transport: mode, placeId: mode === departureForm.transport ? departureForm.placeId : '' })}
                    >
                      {transitModeLabel[mode]}
                    </button>
                  ))}
                </div>
                <label className="planner-lodging">
                  <img src={plannerPin} alt="" />
                  <select
                    aria-label="복귀 장소"
                    value={departureHubs ? hubSelectValue(departureForm, departureHubs, savedDeparture) : departureForm.placeId}
                    disabled={
                      isSavingSchedule ||
                      isUpdatingPlaces ||
                      !departureForm.transport ||
                      (departureHubType ? departureHubs === undefined : places.length === 0)
                    }
                    onChange={(event) => {
                      if (departureHubs) {
                        const result = departureHubs.find((hub) => hub.id === event.target.value)
                        if (result) {
                          void chooseTransitHub('departure', result)
                        }
                        return
                      }

                      changeDeparture({ placeId: event.target.value })
                    }}
                  >
                    <option value="">
                      {departureHubType && departureHubs === undefined
                        ? departureHubType === 'airport'
                          ? '공항을 찾는 중'
                          : '기차역을 찾는 중'
                        : departureHubType && departureHubs?.length === 0
                          ? departureHubType === 'airport'
                            ? '이 지역에서 공항을 찾지 못했습니다'
                            : '이 지역에서 기차역을 찾지 못했습니다'
                          : !departureHubType && places.length === 0
                            ? '장소를 먼저 담아 주세요'
                            : transitPlacePrompt(departureForm.transport, 'departure')}
                    </option>
                    {departureHubs
                      ? departureHubs.map((hub) => (
                          <option key={hub.id} value={hub.id}>
                            {hub.name}
                          </option>
                        ))
                      : [
                          savedDeparture && !places.some((place) => place.id === savedDeparture.placeId) ? (
                            <option key={savedDeparture.placeId} value={savedDeparture.placeId}>
                              {savedDeparture.name}
                            </option>
                          ) : null,
                          ...places.map((place) => (
                            <option key={place.id} value={place.id}>
                              {place.name}
                            </option>
                          )),
                        ]}
                  </select>
                  <img src={plannerChevronDown} alt="" />
                </label>
                <div className={openMenu === 'departureTime' ? 'planner-time is-open' : 'planner-time'}>
                  <button
                    type="button"
                    aria-label="복귀 시각"
                    aria-haspopup="listbox"
                    aria-expanded={openMenu === 'departureTime'}
                    aria-invalid={sameDayTransitInvalid}
                    aria-describedby={sameDayTransitInvalid ? 'planner-transit-time-error' : undefined}
                    disabled={isSavingSchedule || !departureForm.transport}
                    onClick={() => setOpenMenu((current) => (current === 'departureTime' ? null : 'departureTime'))}
                  >
                    {departureForm.time ? formatKoreanTime(departureForm.time) : '출발 시각'}
                  </button>
                  {openMenu === 'departureTime' && (
                    <ul className="planner-time-menu" role="listbox" aria-label="복귀 시각">
                      {timeChoices(departureForm.time || '18:00').map((time) => (
                        <li key={time}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={time === departureForm.time}
                            onClick={() => {
                              changeDeparture({ time })
                              setOpenMenu(null)
                            }}
                          >
                            {formatKoreanTime(time)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {sameDayTransitInvalid && (
                <p id="planner-transit-time-error" className="planner-day-hours-note" role="alert">
                  당일치기는 도착 시각이 복귀 시각보다 빨라야 해요.
                </p>
              )}
            </div>
            <div className="planner-day-hours" ref={dayHoursMenu}>
              <span>활동 시간</span>
              <div className={openMenu === 'dayStart' ? 'planner-time is-open' : 'planner-time'}>
                <button
                  type="button"
                  aria-label="활동 시작"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'dayStart'}
                  aria-invalid={dayHoursInvalid}
                  aria-describedby={dayHoursInvalid ? 'planner-day-hours-error' : undefined}
                  disabled={isSavingSchedule}
                  onClick={() => setOpenMenu((current) => (current === 'dayStart' ? null : 'dayStart'))}
                >
                  {formatKoreanTime(dayStart)}
                </button>
                {openMenu === 'dayStart' && (
                  <ul className="planner-time-menu" role="listbox" aria-label="활동 시작">
                    {timeChoices(dayStart).map((time) => (
                      <li key={time}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={time === dayStart}
                          onClick={() => {
                            changeDayHours(time, dayEnd)
                            setOpenMenu(null)
                          }}
                        >
                          {formatKoreanTime(time)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span>~</span>
              <div className={openMenu === 'dayEnd' ? 'planner-time is-open' : 'planner-time'}>
                <button
                  type="button"
                  aria-label="활동 종료"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'dayEnd'}
                  aria-invalid={dayHoursInvalid}
                  aria-describedby={dayHoursInvalid ? 'planner-day-hours-error' : undefined}
                  disabled={isSavingSchedule}
                  onClick={() => setOpenMenu((current) => (current === 'dayEnd' ? null : 'dayEnd'))}
                >
                  {formatKoreanTime(dayEnd)}
                </button>
                {openMenu === 'dayEnd' && (
                  <ul className="planner-time-menu" role="listbox" aria-label="활동 종료">
                    {timeChoices(dayEnd).map((time) => (
                      <li key={time}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={time === dayEnd}
                          onClick={() => {
                            changeDayHours(dayStart, time)
                            setOpenMenu(null)
                          }}
                        >
                          {formatKoreanTime(time)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {dayHoursInvalid && (
              <p id="planner-day-hours-error" className="planner-day-hours-note" role="alert">
                종료 시각은 시작 시각보다 늦어야 해요.
              </p>
            )}
            <div className="planner-meals">
              <span>식사</span>
              {mealChoices.map((choice) => (
                <button
                  key={choice.key}
                  type="button"
                  aria-pressed={meals[choice.key]}
                  disabled={isSavingSchedule}
                  onClick={() => changeMeal(choice.key)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <p>출발일에 맞춰 휴무일도 함께 확인해요.</p>
          </div>
          <button type="button" className="planner-optimize" disabled={!canOptimize || isOptimizing} onClick={handleOptimize}>
            <img src={plannerSparkles} alt="" />
            {isOptimizing ? '일정을 만드는 중' : '최적의 여행 계획 만들기'}
            <img src={plannerArrow} alt="" />
          </button>
          <p className="planner-optimize-note">
            {itinerary
              ? `${itinerary.days.length}일 일정을 저장했어요.`
              : isOptimizing
                ? '주머니 장소, 숙소, 기간, 휴무, 이동 시간을 반영해 일정을 요청하고 있어요.'
                : canOptimize
                  ? '인공지능이 영업시간·휴무일·브레이크 타임과 실제 거리를 고려해 동선을 정리해요.'
                  : `필수 값이 없으면 최적화를 시작할 수 없어요. (${missingRequirements.join(' · ')})`}
          </p>
          {optimizeError && (
            <div className="planner-optimize-retry">
              <p role="alert">{optimizeError}</p>
              <button type="button" disabled={!canOptimize || isOptimizing} onClick={handleOptimize}>
                다시 시도
              </button>
            </div>
          )}
          <button
            type="button"
            className="planner-save"
            disabled={!plan || isUpdatingPlaces || isSavingPlaces}
            onClick={handleSavePlaces}
          >
            <img src={plannerBookmark} alt="" />
            {isSavingPlaces ? '저장하는 중' : '장소만 저장하기'}
          </button>
          <p className="planner-save-note">
            장소만 담은 상태를 저장해두고, 나중에 기간과 출발일을 정한 뒤 AI 최적화를 진행할 수 있어요.
          </p>
        </aside>
      </div>
      {isOptimizing && <OptimizeWait />}
      {isConfirmingClear && (
        <div className="confirm-overlay">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-places-title">
            <p id="clear-places-title">정말 비우시겠습니까?</p>
            <div>
              <button type="button" ref={clearDialogCancelRef} onClick={() => setIsConfirmingClear(false)}>
                아니요
              </button>
              <button type="button" className="is-confirm" onClick={() => void handleClearPlaces()}>
                네
              </button>
            </div>
          </div>
        </div>
      )}
      {isConfirmingOptimize && nights !== null && (
        <div className="confirm-overlay">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="optimize-meals-title" aria-describedby="optimize-meals-copy">
            <p id="optimize-meals-title">{optimizeShortageTitle}</p>
            <p id="optimize-meals-copy" className="confirm-dialog-copy">
              최적화하면 비어 있는 일정이 생길 수 있습니다. 그래도 계속하시겠습니까?
            </p>
            <div>
              <button
                type="button"
                ref={optimizeDialogCancelRef}
                disabled={isOptimizing}
                onClick={() => setIsConfirmingOptimize(false)}
              >
                아니요
              </button>
              <button type="button" className="is-confirm" disabled={isOptimizing} onClick={() => void runOptimize()}>
                {isOptimizing ? '만드는 중' : '네'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function MapsStatusBridge({ statusRef }: { statusRef: { current: 'ready' | 'missing' | 'failed' } }) {
  const status = useMapsStatus()
  statusRef.current = status
  return null
}

export default PlannerPage
