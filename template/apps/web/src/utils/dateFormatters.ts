/**
 * Format a date for display on entity cards (e.g., "Jan 15")
 * Uses en-US locale for consistent formatting
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/**
 * Format a date with year (e.g., "Jan 15, 2024")
 * Uses en-US locale for consistent formatting
 */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}
