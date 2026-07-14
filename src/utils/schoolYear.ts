/** Academic year label from semester start date (Aug–Dec → YYYY-(YYYY+1), else prior pair). */
export function schoolYearFromStartDate(startDate: string): string {
  const [y, m] = startDate.split('-').map(Number)
  if (!y || !m) return ''
  if (m >= 8) return `${y}-${y + 1}`
  return `${y - 1}-${y}`
}
