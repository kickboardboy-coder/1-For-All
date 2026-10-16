export const destinations = [
  {
    country: '일본',
    regions: [
      { name: '도쿄', latitude: 35.6762, longitude: 139.6503 },
      { name: '오사카', latitude: 34.6937, longitude: 135.5023 },
      { name: '교토', latitude: 35.0116, longitude: 135.7681 },
      { name: '후쿠오카', latitude: 33.5902, longitude: 130.4017 },
      { name: '삿포로', latitude: 43.0618, longitude: 141.3545 },
    ],
  },
  {
    country: '한국',
    regions: [
      { name: '서울', latitude: 37.5665, longitude: 126.978 },
      { name: '부산', latitude: 35.1796, longitude: 129.0756 },
      { name: '제주', latitude: 33.4996, longitude: 126.5312 },
    ],
  },
  {
    country: '프랑스',
    regions: [{ name: '파리', latitude: 48.8566, longitude: 2.3522 }],
  },
  {
    country: '이탈리아',
    regions: [
      { name: '로마', latitude: 41.9028, longitude: 12.4964 },
      { name: '피렌체', latitude: 43.7696, longitude: 11.2558 },
      { name: '베네치아', latitude: 45.4408, longitude: 12.3155 },
    ],
  },
  {
    country: '미국',
    regions: [
      { name: '뉴욕', latitude: 40.7128, longitude: -74.006 },
      { name: '로스앤젤레스', latitude: 34.0522, longitude: -118.2437 },
    ],
  },
  {
    country: '태국',
    regions: [
      { name: '방콕', latitude: 13.7563, longitude: 100.5018 },
      { name: '치앙마이', latitude: 18.7883, longitude: 98.9853 },
    ],
  },
] as const

export type DestinationCountry = (typeof destinations)[number]['country']

export function findRegion(country: string | null | undefined, region: string | null | undefined) {
  if (!country || !region) {
    return null
  }

  const destination = destinations.find((item) => item.country === country)
  return destination?.regions.find((item) => item.name === region) ?? null
}
