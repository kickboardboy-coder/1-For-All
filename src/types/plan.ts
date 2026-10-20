export const planStatuses = ['pending', 'optimized'] as const

export type PlanStatus = (typeof planStatuses)[number]

export const planStatusLabel: Record<PlanStatus, string> = {
  pending: 'AI 최적화 전',
  optimized: 'AI 최적화 완료',
}

export type Plan = {
  id: string
  userId: string
  country: string | null
  region: string
  nights: number | null
  startDate: string | null
  lodgingPlaceId: string | null
  lodgingName: string | null
  lodgingLatitude: number | null
  lodgingLongitude: number | null
  dayStart: string | null
  dayEnd: string | null
  includeBreakfast: boolean | null
  includeLunch: boolean | null
  includeDinner: boolean | null
  arrivalTransport: string | null
  arrivalPlaceId: string | null
  arrivalPlaceName: string | null
  arrivalLatitude: number | null
  arrivalLongitude: number | null
  arrivalTime: string | null
  departureTransport: string | null
  departurePlaceId: string | null
  departurePlaceName: string | null
  departureLatitude: number | null
  departureLongitude: number | null
  departureTime: string | null
  status: PlanStatus
  updatedAt: string
}
