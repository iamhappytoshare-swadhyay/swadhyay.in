import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { logActivity } from './auditService.js'

export const DEFAULT_GLOBAL_SEO = {
  siteTitle: 'Swadhyay — NCERT, PYQ, Notes & Quizzes',
  metaDescription:
    'Swadhyay.in offers structured NCERT notes, previous year question papers (PYQ), and interactive quizzes in Hindi & English.',
  metaKeywords: 'Swadhyay, NCERT, PYQ, Geography Quiz, History Notes, UPSC, KVS, EMRS',
  canonicalUrl: 'https://swadhyay.in',
  ogImage: '',
  defaultRobots: 'index, follow',
  twitterHandle: '',
  gscVerificationCode: '',
  ga4MeasurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
}

export const DEFAULT_ROBOTS_TXT = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /#/admin',
  '',
  'Sitemap: https://swadhyay.in/sitemap.xml',
].join('\n')

export function validateRobotsTxt(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
  const blocksAll = lines.some((l) => l === 'disallow: /')
  const allowsRoot = lines.some((l) => l === 'allow: /')
  if (blocksAll && !allowsRoot) {
    return 'Safety Warning: "Disallow: /" without "Allow: /" will block search engines from indexing the entire website.'
  }
  if (lines.some((l) => l === 'disallow: /assets' || l === 'disallow: /assets/')) {
    return 'Safety Warning: Blocking /assets prevents Google from rendering CSS and JavaScript.'
  }
  return ''
}

export async function getGlobalSeoSettings() {
  if (!db) return { ...DEFAULT_GLOBAL_SEO }
  try {
    const snap = await getDoc(doc(db, 'seo_settings', 'global'))
    if (!snap.exists()) return { ...DEFAULT_GLOBAL_SEO }
    return { ...DEFAULT_GLOBAL_SEO, ...snap.data() }
  } catch {
    return { ...DEFAULT_GLOBAL_SEO }
  }
}

export async function saveGlobalSeoSettings(settings, user) {
  if (!db) throw new Error('Firestore is not configured.')
  const payload = {
    ...DEFAULT_GLOBAL_SEO,
    ...settings,
    updatedBy: user?.email || 'Admin',
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'seo_settings', 'global'), payload, { merge: true })
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'SEO_GLOBAL_UPDATED',
    module: 'seo',
    recordId: 'global',
    description: 'Updated global SEO settings & integrations',
  })
  return payload
}

export async function getRobotsTxtSettings() {
  if (!db) return DEFAULT_ROBOTS_TXT
  try {
    const snap = await getDoc(doc(db, 'seo_settings', 'robots'))
    if (!snap.exists()) return DEFAULT_ROBOTS_TXT
    return snap.data()?.content || DEFAULT_ROBOTS_TXT
  } catch {
    return DEFAULT_ROBOTS_TXT
  }
}

export async function saveRobotsTxtSettings(content, user) {
  if (!db) throw new Error('Firestore is not configured.')
  await setDoc(
    doc(db, 'seo_settings', 'robots'),
    {
      content: String(content || ''),
      updatedBy: user?.email || 'Admin',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'ROBOTS_TXT_UPDATED',
    module: 'seo',
    recordId: 'robots',
    description: 'Published updated robots.txt',
  })
}

export async function savePostSeo(postId, seoData, user) {
  if (!db) throw new Error('Firestore is not configured.')
  await updateDoc(doc(db, 'posts', postId), {
    seoTitle: String(seoData.seoTitle || '').trim(),
    metaDescription: String(seoData.metaDescription || '').trim(),
    focusKeyword: String(seoData.focusKeyword || '').trim(),
    canonicalUrl: String(seoData.canonicalUrl || '').trim(),
    ogTitle: String(seoData.ogTitle || '').trim(),
    ogDescription: String(seoData.ogDescription || '').trim(),
    socialImage: String(seoData.socialImage || '').trim(),
    robotsIndex: seoData.robotsIndex !== false,
    robotsFollow: seoData.robotsFollow !== false,
    updatedAt: serverTimestamp(),
  })
  await logActivity({
    user,
    role: user?.role || 'admin',
    action: 'POST_SEO_UPDATED',
    module: 'seo',
    recordId: postId,
    description: `Updated SEO metadata for post ${postId}`,
  })
}
