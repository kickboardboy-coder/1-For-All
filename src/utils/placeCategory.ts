import type { PlaceCategory } from '../types/place';

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
]);

const cafeTypes = new Set(['cafe', 'coffee_shop', 'cat_cafe', 'dog_cafe', 'coffee_stand', 'tea_house']);

const groceryTypes = new Set([
  'grocery_store',
  'asian_grocery_store',
  'supermarket',
  'discount_supermarket',
  'hypermarket',
  'convenience_store',
  'food_store',
  'health_food_store',
  'grocery_or_supermarket',
  'market',
  'farmers_market',
  'butcher_shop',
]);

const foodTypes = new Set([
  'restaurant',
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
]);

function isCafeType(type: string) {
  return cafeTypes.has(type) || type.endsWith('_cafe') || type.endsWith('_coffee_shop');
}

function isGroceryType(type: string) {
  return groceryTypes.has(type) || type.endsWith('_grocery_store') || type.endsWith('_supermarket');
}

function categoryOf(type: string): PlaceCategory | null {
  if (stayTypes.has(type) || type.endsWith('_hotel') || type.endsWith('_lodging')) {
    return 'stay';
  }

  if (isCafeType(type) || isGroceryType(type)) {
    return 'sight';
  }

  if (foodTypes.has(type) || type.endsWith('_restaurant') || type.endsWith('_bar')) {
    return 'food';
  }

  return null;
}

export function isCafeName(name: string) {
  return /카페|cafe|커피|coffee|티룸|tea\s*house|스타벅스|starbucks|투썸|twosome|이디야|ediya|할리스|hollys|파스쿠찌|pascucci|엔제리너스|커피빈|coffee\s*bean|카페베네|탐앤탐스|폴바셋|paul\s*bassett|블루보틀|blue\s*bottle|테라로사|빽다방|컴포즈|메가\s*mgc|메가커피|매머드|더벤티|바나프레소|드롭탑|커피베이|공차|gong\s*cha/i.test(
    name,
  );
}

export function googlePlaceTypes(primaryType?: string | null, types?: string[] | null) {
  const cleanedTypes = [
    ...new Set((types ?? []).filter((type) => typeof type === 'string' && type.length > 0 && type.length <= 80)),
  ];
  const cleanedPrimary =
    typeof primaryType === 'string' && primaryType.length > 0 && primaryType.length <= 80 ? primaryType : null;

  if (cleanedPrimary && !cleanedTypes.includes(cleanedPrimary)) {
    return { primaryType: cleanedPrimary, types: [cleanedPrimary, ...cleanedTypes] };
  }

  return { primaryType: cleanedPrimary, types: cleanedTypes };
}

export function placeRole(place: {
  name: string;
  category: PlaceCategory;
  primaryType?: string | null;
  types?: string[] | null;
}): PlaceCategory {
  const fromTypes =
    place.primaryType || (place.types && place.types.length > 0)
      ? categoryFromPlaceTypes(place.primaryType, place.types)
      : place.category;

  if (fromTypes !== 'stay' && isCafeName(place.name)) {
    return 'sight';
  }

  return fromTypes;
}

function categoryFromPlaceTypes(primaryType?: string | null, types?: string[] | null): PlaceCategory {
  const all = [primaryType, ...(types ?? [])].filter((type): type is string => Boolean(type));

  for (const type of all) {
    if (categoryOf(type) === 'stay') {
      return 'stay';
    }
  }

  for (const type of all) {
    if (isCafeType(type) || isGroceryType(type)) {
      return 'sight';
    }
  }

  for (const type of all) {
    const fromType = categoryOf(type);
    if (fromType) {
      return fromType;
    }
  }

  return 'sight';
}
