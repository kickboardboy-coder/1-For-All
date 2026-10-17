const dayLabels = ['일', '월', '화', '수', '목', '금', '토']
const textLimit = 80

export type PlaceSchedule = {
  openingHours: string | null
  closedDays: string | null
  breakTime: string | null
}

type OpeningPoint = {
  day?: number
  hour?: number
  minute?: number
}

export type OpeningPeriod = {
  open?: OpeningPoint
  close?: OpeningPoint
}

function withinLimit(value: string) {
  return new TextEncoder().encode(value).length <= textLimit
}

function formatClock(hour = 0, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function limited(value: string | null) {
  if (!value || !withinLimit(value)) {
    return null
  }

  return value
}

export function summarizeOpeningHours(periods: OpeningPeriod[] | undefined): PlaceSchedule {
  if (!periods || periods.length === 0) {
    return { openingHours: null, closedDays: null, breakTime: null }
  }

  const byDay: Array<Array<{ open: string; close: string | null }>> = Array.from({ length: 7 }, () => [])

  periods.forEach((period) => {
    const day = period.open?.day

    if (day === undefined || day < 0 || day > 6) {
      return
    }

    byDay[day].push({
      open: formatClock(period.open?.hour, period.open?.minute),
      close: period.close ? formatClock(period.close.hour, period.close.minute) : null,
    })
  })

  const closed = dayLabels.filter((_, day) => byDay[day].length === 0)

  if (closed.length === 7) {
    return { openingHours: null, closedDays: '매일', breakTime: null }
  }

  const ranges: string[] = []
  const breaks: string[] = []

  byDay.forEach((day) => {
    if (day.length === 0) {
      return
    }

    const ordered = [...day].sort((left, right) => left.open.localeCompare(right.open))
    const lastClose = ordered[ordered.length - 1].close
    ranges.push(lastClose ? `${ordered[0].open}–${lastClose}` : '24시간')

    ordered.forEach((slot, index) => {
      const next = ordered[index + 1]

      if (slot.close && next && slot.close !== next.open) {
        breaks.push(`${slot.close}–${next.open}`)
      }
    })
  })

  const uniqueRanges = [...new Set(ranges)]
  const uniqueBreaks = [...new Set(breaks)]
  const openingHours = uniqueRanges.length === 1 ? uniqueRanges[0] : `${uniqueRanges[0]} 외`
  const breakTime = uniqueBreaks.length === 0 ? null : uniqueBreaks.length === 1 ? uniqueBreaks[0] : `${uniqueBreaks[0]} 외`

  return {
    openingHours: limited(openingHours),
    closedDays: limited(closed.join('·')),
    breakTime: limited(breakTime),
  }
}

export function formatPlaceSchedule(schedule: PlaceSchedule) {
  const parts = [
    schedule.openingHours ? `영업 ${schedule.openingHours}` : '',
    schedule.closedDays ? `휴무 ${schedule.closedDays}` : '',
    schedule.breakTime ? `브레이크 ${schedule.breakTime}` : '',
  ].filter(Boolean)

  return parts.join(' · ') || '영업시간 정보 없음'
}
