/**
 * Capitalizes a string.
 * @param s The string to capitalize.
 * @returns The capitalized string.
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function someIterator<T>(iter: IterableIterator<T>, predicate: (item: T) => boolean): boolean {
  for (const el of iter) if (predicate(el)) return true
  return false
}

export function isMCPS() {
  const host = localStorage.getItem('preferredHost')
  return !host || JSON.parse(host).host === 'https://md-mcps-psv.edupoint.com'
}