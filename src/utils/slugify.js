export function slugify(value, fallbackPrefix = 'item') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"`~!@#$%^&*()+=[\]{};:|\\,.<>/?]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (cleaned) return cleaned
  return `${fallbackPrefix}-${Date.now().toString(36)}`
}

export function toMillis(value) {
  if (!value) return 0
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function formatDate(value) {
  const ms = toMillis(value)
  if (!ms) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms))
}

export function formatDateTime(value) {
  const ms = toMillis(value)
  if (!ms) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}
