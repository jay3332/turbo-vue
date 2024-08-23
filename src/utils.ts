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

const qualifiedClassNameRegex = /^([A-Z]{3}[0-9]{4}[A-Z0-9-]*) (.+) - ([A-Z]{3}[0-9]{4}[A-Z0-9-]*)$/

export function normalizeQualifiedClassName(name: string) {
  if (!isMCPS()) return name

  // qualified format: [course code] [course name] - [course id]
  const match = qualifiedClassNameRegex.exec(name)
  if (!match) return name

  const [,, course] = match
  return course
}