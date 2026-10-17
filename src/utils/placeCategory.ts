import type { PlaceCategory } from '../types/place'

const stayTypes = new Set([
  'lodging',
  'hotel',
  'motel',
  'hostel',
  'guest_house',
  'campground',
  'rv_park',
  'resort_hotel',
  'bed_and_breakfast',
  'extended_stay_hotel',
  'cottage',
  'farmstay',
  'private_guest_room',
])

const foodTypes = new Set([
  'restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'bar',
  'pub',
  'meal_takeaway',
  'meal_delivery',
  'food',
  'food_court',
  'ice_cream_shop',
  'cafeteria',
  'steak_house',
])

function categoryOf(type: string): PlaceCategory | null {
  if (stayTypes.has(type) || type.endsWith('_hotel') || type.endsWith('_lodging')) {
    return 'stay'
  }

  if (foodTypes.has(type) || type.endsWith('_restaurant') || type.endsWith('_cafe') || type.endsWith('_bar')) {
    return 'food'
  }

  return null
}

export function categoryFromPlaceTypes(primaryType?: string | null, types?: string[] | null): PlaceCategory {
  if (primaryType) {
    const fromPrimary = categoryOf(primaryType)
    if (fromPrimary) {
      return fromPrimary
    }
  }

  for (const type of types ?? []) {
    const fromType = categoryOf(type)
    if (fromType) {
      return fromType
    }
  }

  return 'sight'
}
