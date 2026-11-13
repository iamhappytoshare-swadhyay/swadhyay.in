import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { logActivity } from './auditService.js'

export const DEFAULT_WEBSITE_SETTINGS = {
  siteName: 'Swadhyay',
  siteUrl: 'https://swadhyay.in',
  tagline: 'NCERT, PYQ, Notes & Quizzes',
  description: 'A clean bilingual educational platform for Geography, History, NCERT & Quizzes.',
  contactEmail: 'contact@swadhyay.in',
  defaultLanguage: 'hi',
  defaultTheme: 'light',
  dateFormat: 'DD MMM YYYY',
  timezone: 'Asia/Kolkata',
  siteLogo: '',
  adminLogo: '',
  faviconUrl: '',
  primaryColor: '#b71c1c',
  secondaryColor: '#1b4f8a',
  defaultFont: 'system',
  headerStyle: 'sticky',
  footerText: '© Swadhyay.in — Learn with clarity.',
  socialLinks: [
    { id: 'telegram', label: 'Telegram', url: '' },
    { id: 'whatsapp', label: 'WhatsApp', url: '' },
    { id: 'youtube', label: 'YouTube', url: '' },
  ],
  maintenanceEnabled: false,
  maintenanceTitle: 'Swadhyay is undergoing scheduled maintenance',
  maintenanceMessage:
    'We are upgrading our study materials and quiz engine. We will be back online shortly.',
  allowAdminDuringMaintenance: true,
  postsPerPage: 12,
  showLatestQuizzesOnHome: true,
  adsEnabled: false,
}

export async function getWebsiteSettings() {
  if (!db) return { ...DEFAULT_WEBSITE_SETTINGS }
  try {
    const snap = await getDoc(doc(db, 'website_settings', 'general'))
    if (!snap.exists()) return { ...DEFAULT_WEBSITE_SETTINGS }
    const data = snap.data() || {}
    return {
      ...DEFAULT_WEBSITE_SETTINGS,
      ...data,
      socialLinks: Array.isArray(data.socialLinks)
        ? data.socialLinks
        : DEFAULT_WEBSITE_SETTINGS.socialLinks,
    }
  } catch {
    return { ...DEFAULT_WEBSITE_SETTINGS }
  }
}

export async function saveWebsiteSettings(settings, user) {
  if (!db) throw new Error('Firestore is not configured.')
  const payload = {
    ...DEFAULT_WEBSITE_SETTINGS,
    ...settings,
    updatedBy: user?.email || 'Admin',
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'website_settings', 'general'), payload, { merge: true })
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'WEBSITE_SETTINGS_UPDATED',
    module: 'settings',
    recordId: 'general',
    description: `Saved website settings (maintenance=${Boolean(payload.maintenanceEnabled)})`,
  })
  return payload
}
