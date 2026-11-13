import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { translations } from '../i18n/translations.js'
import { NAV_ITEMS } from '../routes.js'
import { logActivity } from './auditService.js'
import { slugify } from '../utils/slugify.js'

const UNSAFE_PROTOCOL_RE = /^(javascript|data|vbscript|file):/i

function ensureDb() {
  if (!db) {
    throw new Error('Firestore is not configured. Check your .env Firebase settings.')
  }
  return db
}

export const MENU_LOCATIONS = [
  { id: 'header', label: 'Header Menu' },
  { id: 'footer', label: 'Footer Menu' },
  { id: 'custom', label: 'Custom Menus' },
]

export const DEFAULT_MENU_ITEMS = NAV_ITEMS.map((item, index) => ({
  id: item.id,
  routeId: item.id,
  labelEn: translations.en.nav[item.id] || item.id,
  labelHi: translations.hi.nav[item.id] || translations.en.nav[item.id] || item.id,
  url: item.href || item.path,
  icon: '',
  parentId: '',
  location: 'header',
  openInNewTab: Boolean(item.href),
  enabled: true,
  order: index + 1,
  isDefault: true,
}))

export function isExternalUrl(value) {
  const str = String(value || '').trim()
  if (!/^https?:\/\//i.test(str)) {
    return false
  }
  try {
    const parsed = new URL(str)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (
      host === 'swadhyay.in' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      (typeof window !== 'undefined' &&
        window.location?.hostname &&
        host === window.location.hostname.toLowerCase().replace(/^www\./, ''))
    ) {
      return false
    }
  } catch {
    return false
  }
  return true
}

export function toInternalPath(value) {
  let raw = String(value || '').trim()
  if (!raw || isExternalUrl(raw)) return raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      raw = (parsed.hash ? parsed.hash.replace(/^#/, '') : parsed.pathname) || '/home'
    } catch {
      raw = raw.replace(/^https?:\/\/[^/]+/i, '')
    }
  }
  const cleaned = raw.replace(/^#/, '')
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`
}

export function sanitizeMenuUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (UNSAFE_PROTOCOL_RE.test(raw)) {
    throw new Error('Unsafe URL protocol is not allowed (use https://, http://, or /path).')
  }
  if (isExternalUrl(raw) || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
    return raw
  }
  return toInternalPath(raw)
}

export function normalizeMenuPath(value) {
  try {
    return sanitizeMenuUrl(value) || '/home'
  } catch {
    return '/home'
  }
}

function sortMenuRecords(items) {
  return [...items].sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
}

function normalizeMenuDoc(d) {
  const raw = d.data() || {}
  const loc = ['header', 'footer', 'custom'].includes(raw.location) ? raw.location : 'header'
  return {
    id: d.id,
    routeId: raw.routeId || d.id,
    labelEn: raw.labelEn || raw.label || 'Untitled',
    labelHi: raw.labelHi || raw.labelEn || raw.label || 'Untitled',
    url: raw.url || raw.href || raw.path || '/home',
    icon: raw.icon || '',
    parentId: raw.parentId || '',
    location: loc,
    openInNewTab:
      raw.openInNewTab !== undefined
        ? Boolean(raw.openInNewTab)
        : isExternalUrl(raw.url || raw.href),
    enabled: raw.enabled !== false,
    order: Number(raw.order ?? 999),
  }
}

export function wouldCreateCycle(itemId, candidateParentId, allItems) {
  if (!itemId || !candidateParentId) return false
  if (itemId === candidateParentId) return true
  const parentMap = new Map(allItems.map((i) => [i.id, i.parentId || '']))
  let cursor = candidateParentId
  const visited = new Set([itemId])
  while (cursor) {
    if (visited.has(cursor)) return true
    visited.add(cursor)
    cursor = parentMap.get(cursor) || ''
  }
  return false
}

export function buildMenuTree(items, locationFilter = null) {
  const scoped = locationFilter
    ? items.filter((item) => (item.location || 'header') === locationFilter)
    : items
  const sorted = sortMenuRecords(scoped)
  const map = new Map()
  sorted.forEach((item) => {
    map.set(item.id, { ...item, children: [] })
  })

  const roots = []
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId) && node.parentId !== node.id) {
      map.get(node.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortTree = (nodes) => {
    nodes.sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
    nodes.forEach((n) => {
      if (n.children.length) sortTree(n.children)
    })
  }
  sortTree(roots)
  return roots
}

export async function listMenuItems() {
  if (!db) return []
  const snap = await getDocs(collection(db, 'menus'))
  return sortMenuRecords(snap.docs.map(normalizeMenuDoc))
}

export function subscribeMenuItems(onChange) {
  if (!db) {
    onChange([])
    return () => {}
  }

  return onSnapshot(
    collection(db, 'menus'),
    (snap) => {
      onChange(sortMenuRecords(snap.docs.map(normalizeMenuDoc)))
    },
    () => {
      onChange([])
    },
  )
}

export async function seedDefaultMenuItems(user) {
  const firestore = ensureDb()
  const actor = user?.displayName || user?.email || 'Admin'
  const batch = writeBatch(firestore)

  for (const item of DEFAULT_MENU_ITEMS) {
    batch.set(
      doc(firestore, 'menus', item.id),
      {
        routeId: item.routeId,
        labelEn: item.labelEn,
        labelHi: item.labelHi,
        url: item.url,
        icon: '',
        parentId: '',
        location: item.location,
        openInNewTab: item.openInNewTab,
        enabled: item.enabled,
        order: item.order,
        updatedBy: actor,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  await batch.commit()
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'MENU_SEEDED_DEFAULTS',
    module: 'navigation',
    recordId: 'menus',
    description: 'Imported default navigation menu items',
  })
}

export async function resetMenusToDefault(existingItems, user) {
  const firestore = ensureDb()
  const batch = writeBatch(firestore)
  existingItems.forEach((item) => {
    batch.delete(doc(firestore, 'menus', item.id))
  })
  await batch.commit()
  await seedDefaultMenuItems(user)
}

export async function saveMenuItem({ id, data, user, allItems = [] }) {
  const firestore = ensureDb()
  const actor = user?.displayName || user?.email || 'Admin'
  const labelEn = String(data.labelEn || '').trim()
  if (!labelEn) {
    throw new Error('Menu label cannot be empty.')
  }
  const labelHi = String(data.labelHi || '').trim() || labelEn
  const url = sanitizeMenuUrl(data.url)
  if (!url) {
    throw new Error('Destination URL cannot be empty.')
  }

  const parentId = String(data.parentId || '').trim()
  if (id && wouldCreateCycle(id, parentId, allItems)) {
    throw new Error('Invalid parent menu: circular hierarchy is not allowed.')
  }

  const location = ['header', 'footer', 'custom'].includes(data.location)
    ? data.location
    : 'header'

  const payload = {
    routeId: String(data.routeId || slugify(labelEn, 'menu')).trim(),
    labelEn,
    labelHi,
    url,
    icon: String(data.icon || '').trim(),
    parentId,
    location,
    openInNewTab:
      data.openInNewTab !== undefined ? Boolean(data.openInNewTab) : isExternalUrl(url),
    enabled: data.enabled !== false,
    order: Math.max(1, Number(data.order || 1)),
    updatedBy: actor,
    updatedAt: serverTimestamp(),
  }

  if (id) {
    await updateDoc(doc(firestore, 'menus', id), payload)
    await logActivity({
      user,
      role: user?.role || 'admin',
      action: 'MENU_ITEM_UPDATED',
      module: 'navigation',
      recordId: id,
      description: `Updated menu item "${labelEn}" (${location})`,
    })
    return { id }
  }

  const ref = await addDoc(collection(firestore, 'menus'), {
    ...payload,
    createdBy: actor,
    createdAt: serverTimestamp(),
  })
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'MENU_ITEM_CREATED',
    module: 'navigation',
    recordId: ref.id,
    description: `Created menu item "${labelEn}" (${location})`,
  })
  return { id: ref.id }
}

export async function reorderMenuItems(orderedItems, user) {
  const firestore = ensureDb()
  const actor = user?.displayName || user?.email || 'Admin'
  const batch = writeBatch(firestore)

  orderedItems.forEach((item, index) => {
    batch.update(doc(firestore, 'menus', item.id), {
      order: item.order ?? index + 1,
      parentId: item.parentId || '',
      location: item.location || 'header',
      updatedBy: actor,
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'MENU_REORDERED',
    module: 'navigation',
    recordId: 'menus',
    description: `Saved menu order & hierarchy (${orderedItems.length} items)`,
  })
}

export async function toggleMenuItemEnabled(id, enabled, user) {
  const firestore = ensureDb()
  const actor = user?.displayName || user?.email || 'Admin'
  await updateDoc(doc(firestore, 'menus', id), {
    enabled: Boolean(enabled),
    updatedBy: actor,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMenuItem(id, user) {
  const firestore = ensureDb()
  await deleteDoc(doc(firestore, 'menus', id))
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'MENU_ITEM_DELETED',
    module: 'navigation',
    recordId: id,
    description: `Deleted menu item ${id}`,
  })
}

export async function deleteMenuItemWithChildren({
  id,
  childAction = 'promote', // 'promote' | 'move' | 'cascade'
  targetParentId = '',
  allItems = [],
  user,
}) {
  const firestore = ensureDb()
  const batch = writeBatch(firestore)
  const children = allItems.filter((item) => item.parentId === id)

  if (childAction === 'cascade') {
    const toDelete = new Set([id])
    let added = true
    while (added) {
      added = false
      allItems.forEach((item) => {
        if (item.parentId && toDelete.has(item.parentId) && !toDelete.has(item.id)) {
          toDelete.add(item.id)
          added = true
        }
      })
    }
    toDelete.forEach((delId) => {
      batch.delete(doc(firestore, 'menus', delId))
    })
  } else {
    const newParent = childAction === 'move' ? targetParentId : ''
    children.forEach((child) => {
      batch.update(doc(firestore, 'menus', child.id), {
        parentId: newParent,
        updatedAt: serverTimestamp(),
      })
    })
    batch.delete(doc(firestore, 'menus', id))
  }

  await batch.commit()
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'MENU_ITEM_DELETED',
    module: 'navigation',
    recordId: id,
    description: `Deleted parent menu ${id} (children action: ${childAction})`,
  })
}
