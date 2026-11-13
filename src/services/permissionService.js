import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { callWorkerApi } from './adminApi.js'
import { logActivity } from './auditService.js'

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'publish', 'manage']

export const PERMISSION_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'posts', label: 'Posts' },
  { id: 'pages', label: 'Pages' },
  { id: 'categories', label: 'Categories' },
  { id: 'media', label: 'Media Library' },
  { id: 'comments', label: 'Comments' },
  { id: 'ncert', label: 'NCERT Content' },
  { id: 'pyq', label: 'PYQ' },
  { id: 'notes', label: 'Notes' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'navigation', label: 'Navigation Menu' },
  { id: 'users', label: 'Users' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'seo', label: 'SEO' },
  { id: 'ads', label: 'Advertisements' },
  { id: 'settings', label: 'Website Settings' },
  { id: 'permissions', label: 'Admin Permissions' },
  { id: 'logs', label: 'Backup & Activity Logs' },
]

function fullAccess() {
  return { view: true, create: true, edit: true, delete: true, publish: true, manage: true }
}

function noAccess() {
  return { view: false, create: false, edit: false, delete: false, publish: false, manage: false }
}

export const DEFAULT_PERMISSION_MATRIX = {
  super_admin: Object.fromEntries(PERMISSION_MODULES.map((m) => [m.id, fullAccess()])),
  admin: {
    dashboard: { view: true, create: false, edit: false, delete: false, publish: false, manage: false },
    posts: fullAccess(),
    pages: fullAccess(),
    categories: fullAccess(),
    media: fullAccess(),
    comments: fullAccess(),
    ncert: fullAccess(),
    pyq: fullAccess(),
    notes: fullAccess(),
    quizzes: fullAccess(),
    navigation: fullAccess(),
    users: { view: true, create: false, edit: true, delete: true, publish: false, manage: true },
    notifications: fullAccess(),
    analytics: { view: true, create: false, edit: false, delete: false, publish: false, manage: true },
    seo: fullAccess(),
    ads: fullAccess(),
    settings: fullAccess(),
    permissions: noAccess(),
    logs: { view: true, create: true, edit: false, delete: false, publish: false, manage: false },
  },
  editor: {
    dashboard: { view: true, create: false, edit: false, delete: false, publish: false, manage: false },
    posts: fullAccess(),
    pages: fullAccess(),
    categories: fullAccess(),
    media: { view: true, create: true, edit: true, delete: false, publish: false, manage: false },
    comments: fullAccess(),
    ncert: fullAccess(),
    pyq: fullAccess(),
    notes: fullAccess(),
    quizzes: fullAccess(),
    navigation: noAccess(),
    users: noAccess(),
    notifications: noAccess(),
    analytics: noAccess(),
    seo: noAccess(),
    ads: noAccess(),
    settings: noAccess(),
    permissions: noAccess(),
    logs: noAccess(),
  },
  author: {
    dashboard: { view: true, create: false, edit: false, delete: false, publish: false, manage: false },
    posts: { view: true, create: true, edit: true, delete: false, publish: false, manage: false },
    pages: { view: true, create: true, edit: true, delete: false, publish: false, manage: false },
    categories: { view: true, create: false, edit: false, delete: false, publish: false, manage: false },
    media: { view: true, create: true, edit: false, delete: false, publish: false, manage: false },
    comments: noAccess(),
    ncert: { view: true, create: true, edit: true, delete: false, publish: false, manage: false },
    pyq: { view: true, create: true, edit: true, delete: false, publish: false, manage: false },
    notes: { view: true, create: true, edit: true, delete: false, publish: false, manage: false },
    quizzes: noAccess(),
    navigation: noAccess(),
    users: noAccess(),
    notifications: noAccess(),
    analytics: noAccess(),
    seo: noAccess(),
    ads: noAccess(),
    settings: noAccess(),
    permissions: noAccess(),
    logs: noAccess(),
  },
}

export function canAccessModule(role, moduleId, matrix = DEFAULT_PERMISSION_MATRIX) {
  if (role === 'super_admin') return true
  if (moduleId === 'permissions') return false
  const roleMap = matrix?.[role] || DEFAULT_PERMISSION_MATRIX[role]
  if (!roleMap) return false
  return Boolean(roleMap[moduleId]?.view)
}

export async function getPermissionMatrix() {
  if (!db) return DEFAULT_PERMISSION_MATRIX
  try {
    const snap = await getDoc(doc(db, 'website_settings', 'permissions_matrix'))
    if (!snap.exists()) return DEFAULT_PERMISSION_MATRIX
    const stored = snap.data()?.matrix || {}
    return {
      super_admin: DEFAULT_PERMISSION_MATRIX.super_admin,
      admin: { ...DEFAULT_PERMISSION_MATRIX.admin, ...(stored.admin || {}) },
      editor: { ...DEFAULT_PERMISSION_MATRIX.editor, ...(stored.editor || {}) },
      author: { ...DEFAULT_PERMISSION_MATRIX.author, ...(stored.author || {}) },
    }
  } catch {
    return DEFAULT_PERMISSION_MATRIX
  }
}

export async function savePermissionMatrix(matrix, user) {
  if (!db) throw new Error('Firestore is not configured.')
  const sanitized = {
    admin: matrix.admin || DEFAULT_PERMISSION_MATRIX.admin,
    editor: matrix.editor || DEFAULT_PERMISSION_MATRIX.editor,
    author: matrix.author || DEFAULT_PERMISSION_MATRIX.author,
  }
  await setDoc(
    doc(db, 'website_settings', 'permissions_matrix'),
    {
      matrix: sanitized,
      updatedBy: user?.email || 'Super Admin',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  await logActivity({
    user,
    role: 'super_admin',
    action: 'PERMISSION_MATRIX_UPDATED',
    module: 'permissions',
    recordId: 'permissions_matrix',
    description: 'Updated role-based permission matrix',
  })
}

export async function listAllUsersForPermissions() {
  if (!db) return []
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function assignAdminRole({ uid, email, displayName, role, accountStatus }) {
  return callWorkerApi('/api/admin/permissions/assign', {
    method: 'POST',
    body: { uid, email, displayName, role, accountStatus },
  })
}
