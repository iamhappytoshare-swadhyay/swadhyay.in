export const NAV_ITEMS = [
  { id: 'home', path: '/home' },
  { id: 'quiz', path: '/quiz' },
  { id: 'ncert', path: '/ncert' },
  { id: 'pyq', path: '/pyq' },
  { id: 'history', path: '/history' },
  { id: 'geography', path: '/geography' },
  { id: 'kvs', path: '/kvs-nvs' },
  { id: 'emrs', path: '/emrs' },
  { id: 'upessc', path: '/upessc' },
]

export const STUDENT_ITEMS = [
  { id: 'profile', path: '/profile', icon: 'user', tone: 'red' },
  { id: 'leaderboard', path: '/leaderboard', icon: 'trophy', tone: 'amber' },
  { id: 'progress', path: '/progress', icon: 'chart', tone: 'teal' },
  { id: 'bookmarks', path: '/bookmarks', icon: 'bookmark', tone: 'violet' },
  { id: 'downloads', path: '/downloads', icon: 'download', tone: 'blue' },
  { id: 'help', path: '/help', icon: 'help', tone: 'navy' },
]

export const CATEGORY_ITEMS = [
  { id: 'history', icon: 'landmark', tone: 'amber' },
  { id: 'geography', icon: 'globe', tone: 'teal' },
  { id: 'gk', icon: 'bulb', tone: 'violet' },
  { id: 'affairs', icon: 'news', tone: 'blue' },
]

const PATH_TO_VIEW = {
  '/': 'home',
  '/home': 'home',
}

for (const item of [...NAV_ITEMS, ...STUDENT_ITEMS]) {
  PATH_TO_VIEW[item.path] = item.id
}

function extractHashPath() {
  const raw = (window.location.hash || '').replace(/^#/, '')
  let path
  try {
    path = decodeURIComponent(raw.split('?')[0] || '/home')
  } catch {
    path = '/home'
  }
  if (!path.startsWith('/')) path = `/${path}`
  return path
}

export function readHash() {
  const path = extractHashPath()
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin'
  if (path.startsWith('/post/')) return 'post'
  if (path.startsWith('/page/')) return 'page'
  if (path.startsWith('/category/')) return 'category'
  return PATH_TO_VIEW[path] || 'notfound'
}

export function readDynamicSlug() {
  const path = extractHashPath()
  for (const prefix of ['/post/', '/page/', '/category/']) {
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length).split('/')[0] || ''
    }
  }
  return ''
}

export function readAdminSection() {
  const path = extractHashPath()
  if (path === '/admin' || path === '/admin/') return 'dashboard'
  if (path.startsWith('/admin/')) {
    return path.slice('/admin/'.length).split('/')[0] || 'dashboard'
  }
  return 'dashboard'
}

export function pathForAdmin(sectionId) {
  if (!sectionId || sectionId === 'dashboard') return '/admin'
  return `/admin/${sectionId}`
}

export function isStudentView(view) {
  return STUDENT_ITEMS.some((item) => item.id === view)
}

export function pathForCategory(id) {
  if (id === 'history') return '/history'
  if (id === 'geography') return '/geography'
  return '/home'
}
