import type { PlanMeals } from '../api/plans'

type MealKind = 'breakfast' | 'lunch' | 'dinner'
type TripWindow = {
  nights: number
  dayStart: string
  dayEnd: string
  arrivalTime: string
  departureTime: string
}

const noonMinutes = 12 * 60

const mealChoices = [
  { key: 'includeBreakfast', kind: 'breakfast' },
  { key: 'includeLunch', kind: 'lunch' },
  { key: 'includeDinner', kind: 'dinner' },
] as const satisfies ReadonlyArray<{ key: keyof PlanMeals; kind: MealKind }>

function minutesFromClock(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function preferredMealMinutes(kind: MealKind, dayStart: string, dayEnd: string) {
  const start = minutesFromClock(dayStart)
  const end = minutesFromClock(dayEnd)

  if (kind === 'breakfast') {
    return start + 30
  }

  if (kind === 'lunch') {
    return Math.floor((start + end) / 2)
  }

  return Math.max(start, end - 60)
}

function dayWindows({ nights, dayStart, dayEnd, arrivalTime, departureTime }: TripWindow) {
  const dayCount = nights + 1
  const windows: Array<{ start: number; end: number }> = []

  for (let day = 0; day < dayCount; day += 1) {
    let start = minutesFromClock(dayStart)
    let end = minutesFromClock(dayEnd)

    if (day === 0) {
      start = Math.max(start, minutesFromClock(arrivalTime))
    }

    if (day === dayCount - 1) {
      end = Math.min(end, minutesFromClock(departureTime))
    }

    if (start < end) {
      windows.push({ start, end })
    }
  }

  return windows
}

export function countTripMeals({
  nights,
  dayStart,
  dayEnd,
  meals,
  arrivalTime,
  departureTime,
}: TripWindow & { meals: PlanMeals }) {
  const selected = mealChoices.filter((choice) => meals[choice.key]).map((choice) => choice.kind)
  let count = 0

  dayWindows({ nights, dayStart, dayEnd, arrivalTime, departureTime }).forEach(({ start, end }) => {
    selected.forEach((kind) => {
      const preferred = preferredMealMinutes(kind, dayStart, dayEnd)

      if (preferred >= start && preferred <= end) {
        count += 1
      }
    })
  })

  return count
}

export function countTripSights(window: TripWindow) {
  return dayWindows(window).reduce((count, { start, end }) => {
    const morning = start < noonMinutes ? 1 : 0
    const afternoon = end > noonMinutes ? 1 : 0
    return count + morning + afternoon
  }, 0)
}
