export const destinations = [
  { country: '일본', regions: ['도쿄', '오사카', '교토', '후쿠오카', '삿포로'] },
  { country: '한국', regions: ['서울', '부산', '제주'] },
  { country: '프랑스', regions: ['파리'] },
  { country: '이탈리아', regions: ['로마', '피렌체', '베네치아'] },
  { country: '미국', regions: ['뉴욕', '로스앤젤레스'] },
  { country: '태국', regions: ['방콕', '치앙마이'] },
] as const

export type DestinationCountry = (typeof destinations)[number]['country']
