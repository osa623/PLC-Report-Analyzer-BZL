/**
 * Check whether a year entry has ANY non-null value.
 * Returns `true` if at least one field is not null/undefined,
 * meaning the year has real data worth displaying.
 */
export function hasYearData(yearData: Record<string, any> | null | undefined): boolean {
  if (!yearData) return false;
  return Object.values(yearData).some((v) => v != null);
}

/**
 * Given a `by_year` object (keyed by year string), return a sorted
 * array of numeric years that contain at least one non-null value.
 */
export function filterValidYears(byYear: Record<string, any>): number[] {
  return Object.keys(byYear)
    .map(Number)
    .filter(Number.isFinite)
    .filter((y) => hasYearData(byYear[y]))
    .sort((a, b) => a - b);
}
