export const SUPER_ADMIN_EMAIL = 'iamhappytoshare@gmail.com'

export const WORKER_API_URL =
  import.meta.env.VITE_WORKER_API_URL || 'https://swadhyay-api.iamhappytoshare.workers.dev'

export const R2_MEDIA_URL =
  import.meta.env.VITE_R2_PUBLIC_URL || 'https://notes.swadhyay.in'

export const ADMIN_ROLES = ['super_admin', 'admin', 'editor', 'author']

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  editor: 'Editor',
  author: 'Author',
  student: 'Student',
}

export function hasAdminAccess(role) {
  return ADMIN_ROLES.includes(role)
}

export function isSuperAdminRole(role) {
  return role === 'super_admin'
}
