import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import plannerPin from '../assets/planner-pin.svg'
import plannerPlus from '../assets/planner-plus.svg'
import plannerSearch from '../assets/planner-search.svg'
import plannerSparkles from '../assets/planner-sparkles.svg'
import { getPlan, savePlan, touchPlan, updatePlanDestination } from '../api/plans'
import { addPlace, clearPlaces, deletePlace, getPlaces } from '../api/places'
import MapsProvider, { useMapsStatus, WhenMapsReady } from '../components/MapsProvider'
import PlaceSearchRunner, { type PlaceSearchResult } from '../components/PlaceSearchRunner'
import PlannerMap from '../components/PlannerMap'
import { destinations, findRegion } from '../data/destinations'
import type { Plan } from '../types/plan'
import { placeCategories, placeCategoryLabel, type Place, type PlaceCategory } from '../types/place'

const searchDebounceMs = 400

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
  const [places, setPlaces] = useState<Place[]>([])
  const [placeName, setPlaceName] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('sight')
  const [isUpdatingPlaces, setIsUpdatingPlaces] = useState(false)
  const [isSavingPlaces, setIsSavingPlaces] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2>(planId ? 2 : 1)
  const [searchRequest, setSearchRequest] = useState<{ id: number; query: string } | null>(null)
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [mapFocus, setMapFocus] = useState<'results' | 'place'>('results')
  const [isSearching, setIsSearching] = useState(false)
  const [emptySearchQuery, setEmptySearchQuery] = useState<string | null>(null)
  const searchTimer = useRef<number | null>(null)
  const mapsStatus = useRef<'ready' | 'missing' | 'failed'>('missing')
  const destinationMenu = useRef<HTMLDivElement>(null)
  const activeCountry = country || plan?.country || ''
  const activeRegion = currentStep === 1 ? region : region || plan?.region || ''
  const regions = destinations.find((item) => item.country === activeCountry)?.regions ?? []
  const mapRegion = findRegion(activeCountry, activeRegion)
  const editingDestination = Boolean(planId) && currentStep === 1
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
        setCountry(nextPlan.country ?? '')
        setRegion(nextPlan.region)
        return getPlaces(planId)
      })
      .then((nextPlaces) => {
        if (!ignore && nextPlaces) {
          setPlaces(nextPlaces)
        }
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

  useEffect(() => {
    setCurrentStep(planId ? 2 : 1)
  }, [planId])

  useEffect(() => {
    if (!openMenu) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!destinationMenu.current?.contains(event.target as Node)) {
        setOpenMenu(null)
      }
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
      const nextPlan = await savePlan({ country, region, nights: null, startDate: null })
      navigate(`/planner/${nextPlan.id}`, { replace: true })
    } catch {
      setError('여행 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  async function handleAddToPocket(result: PlaceSearchResult) {
    if (places.some((place) => place.name === result.name)) {
      return
    }

    setIsUpdatingPlaces(true)
    setError('')

    let nextPlanId = planId

    try {
      if (!nextPlanId) {
        if (!country || !region) {
          setError('나라와 지역을 선택해 주세요.')
          return
        }

        const nextPlan = await savePlan({ country, region, nights: null, startDate: null })
        nextPlanId = nextPlan.id
      }

      const place = await addPlace(nextPlanId, {
        name: result.name,
        category,
        latitude: result.latitude,
        longitude: result.longitude,
      })

      if (planId) {
        setPlaces((current) => [...current, place].sort((left, right) => left.name.localeCompare(right.name, 'ko')))
        return
      }

      navigate(`/planner/${nextPlanId}`, { replace: true })
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
    } finally {
      setIsUpdatingPlaces(false)
    }
  }

  async function handleDeletePlace(placeId: string) {
    if (!planId) {
      return
    }

    setIsUpdatingPlaces(true)
    setError('')

    try {
      await deletePlace(planId, placeId)
      setPlaces((current) => current.filter((place) => place.id !== placeId))
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

    setIsUpdatingPlaces(true)
    setError('')

    try {
      await clearPlaces(planId)
      setPlaces([])
    } catch {
      setError('장소를 비우지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsUpdatingPlaces(false)
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
      navigate('/plans')
    } catch {
      setError('장소를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsSavingPlaces(false)
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
                  disabled={!canSearch || editingDestination}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
              </label>
            </div>
            {canSearch && (
              <div className="planner-options" role="listbox" aria-label="장소 분류">
                {placeCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-selected={item === category}
                    onClick={() => setCategory(item)}
                  >
                    {placeCategoryLabel[item]}
                  </button>
                ))}
              </div>
            )}
            {!planId && (
              <button type="button" className="planner-start" disabled={isSaving || !country || !region} onClick={handleCreatePlan}>
                이 지역으로 시작
              </button>
            )}
            <button type="submit" className="planner-start" disabled={editingDestination || !canSearch || isSearching || !placeName.trim()}>
              {isSearching ? '검색 중' : '검색'}
            </button>
            {!isSearching && !error && emptySearchQuery === placeName.trim() && (
              <p className="planner-search-empty" role="status">
                검색 결과가 없습니다. 다른 이름으로 다시 찾아 보세요.
              </p>
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
            {error && (
              <p className="login-error" role="alert">
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
            </WhenMapsReady>
          )}
          <PlannerMap
            latitude={mapRegion?.latitude ?? 20}
            longitude={mapRegion?.longitude ?? 0}
            zoom={mapRegion ? 12 : 2}
            places={searchResults}
            selectedPlaceId={selectedPlaceId}
            focus={mapFocus}
            onSelectPlace={(placeId) => {
              setSelectedPlaceId(placeId)
              setMapFocus('place')
            }}
            savedPlaceNames={places.map((place) => place.name)}
            isAddingPlace={isUpdatingPlaces}
            onAddPlace={handleAddToPocket}
          />
        </div>
        </MapsProvider>
        <aside className="planner-pocket">
          <div className="planner-pocket-heading">
            <div>
              <img src={plannerBag} alt="" />
              <h2>여행 주머니</h2>
              <span>{places.length}</span>
            </div>
            <button type="button" disabled={!planId || places.length === 0 || isUpdatingPlaces} onClick={handleClearPlaces}>
              전체 비우기
            </button>
          </div>
          <p>가고 싶은 곳을 주머니에 담으면, 가장 편한 순서로!</p>
          {places.length === 0 ? (
            <p className="planner-pocket-empty">아직 담은 장소가 없습니다.</p>
          ) : (
            <ul className="planner-places">
              {places.map((place) => (
                <li key={place.id}>
                  <div>
                    <strong>{place.name}</strong>
                    <span>{placeCategoryLabel[place.category]}</span>
                  </div>
                  <button
                    type="button"
                    disabled={isUpdatingPlaces}
                    aria-label={`${place.name} 빼기`}
                    onClick={() => handleDeletePlace(place.id)}
                  >
                    빼기
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
    </section>
  )
}

function MapsStatusBridge({ statusRef }: { statusRef: { current: 'ready' | 'missing' | 'failed' } }) {
  const status = useMapsStatus()
  statusRef.current = status
  return null
}

export default PlannerPage
