export const placeCategories = ['sight', 'food', 'stay'] as const

export type PlaceCategory = (typeof placeCategories)[number]

export const placeCategoryLabel: Record<PlaceCategory, string> = {
  sight: '관광지',
  food: '맛집',
  stay: '숙소',
}

export type Place = {
  id: string
  planId: string
  name: string
  latitude: number
  longitude: number
  category: PlaceCategory
  openingHours: string | null
  closedDays: string | null
  breakTime: string | null
  photoUrl: string | null
}
