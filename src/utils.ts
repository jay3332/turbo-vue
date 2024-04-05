/**
 * Capitalizes a string.
 * @param s The string to capitalize.
 * @returns The capitalized string.
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
