export function formatKoreanTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/)

  if (!match) {
    return value
  }

  const hour = Number(match[1])
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${String(hour12).padStart(2, '0')}:${match[2]}`
}
