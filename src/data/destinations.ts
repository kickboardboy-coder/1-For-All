export const destinations = [
  {
    country: '일본',
    regions: [
      { name: '도쿄', latitude: 35.6762, longitude: 139.6503, landmark: '도쿄 타워' },
      { name: '오사카', latitude: 34.6937, longitude: 135.5023, landmark: '오사카성' },
      { name: '교토', latitude: 35.0116, longitude: 135.7681, landmark: '기요미즈데라' },
      { name: '후쿠오카', latitude: 33.5902, longitude: 130.4017, landmark: '후쿠오카 타워' },
      { name: '삿포로', latitude: 43.0618, longitude: 141.3545, landmark: '삿포로 TV 타워' },
    ],
  },
  {
    country: '한국',
    regions: [
      { name: '서울', latitude: 37.5665, longitude: 126.978, landmark: '경복궁' },
      { name: '부산', latitude: 35.1796, longitude: 129.0756, landmark: '광안대교' },
      { name: '제주', latitude: 33.4996, longitude: 126.5312, landmark: '성산일출봉' },
    ],
  },
  {
    country: '프랑스',
    regions: [{ name: '파리', latitude: 48.8566, longitude: 2.3522, landmark: '에펠탑' }],
  },
  {
    country: '이탈리아',
    regions: [
      { name: '로마', latitude: 41.9028, longitude: 12.4964, landmark: '콜로세움' },
      { name: '피렌체', latitude: 43.7696, longitude: 11.2558, landmark: '산타 마리아 델 피오레 대성당' },
      { name: '베네치아', latitude: 45.4408, longitude: 12.3155, landmark: '산마르코 대성당' },
    ],
  },
  {
    country: '미국',
    regions: [
      { name: '뉴욕', latitude: 40.7128, longitude: -74.006, landmark: '자유의 여신상' },
      { name: '로스앤젤레스', latitude: 34.0522, longitude: -118.2437, landmark: '할리우드 사인' },
    ],
  },
  {
    country: '태국',
    regions: [
      { name: '방콕', latitude: 13.7563, longitude: 100.5018, landmark: '왓 아룬' },
      { name: '치앙마이', latitude: 18.7883, longitude: 98.9853, landmark: '왓 프라탓 도이수텝' },
    ],
  },
] as const;

export type DestinationCountry = (typeof destinations)[number]['country'];

export function findRegion(country: string | null | undefined, region: string | null | undefined) {
  if (!country || !region) {
    return null;
  }

  const destination = destinations.find((item) => item.country === country);
  return destination?.regions.find((item) => item.name === region) ?? null;
}
