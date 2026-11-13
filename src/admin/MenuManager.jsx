import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderTree,
  GripVertical,
  Layers,
  Menu as MenuIcon,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  DEFAULT_MENU_ITEMS,
  MENU_LOCATIONS,
  buildMenuTree,
  deleteMenuItem,
  deleteMenuItemWithChildren,
  isExternalUrl,
  listMenuItems,
  reorderMenuItems,
  resetMenusToDefault,
  saveMenuItem,
  seedDefaultMenuItems,
  toInternalPath,
  toggleMenuItemEnabled,
  wouldCreateCycle,
} from '../services/menuService.js'
import {
  deletePage,
  listPages,
  savePage,
  togglePagePublish,
} from '../services/cmsService.js'
import { renderMathInHtml } from '../utils/renderMathHtml.js'
import { formatDateTime, slugify } from '../utils/slugify.js'
import RichTextEditor from './components/RichTextEditor.jsx'

const ICON_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'home', label: 'Home' },
  { value: 'book', label: 'Book / NCERT' },
  { value: 'file', label: 'Document / PYQ' },
  { value: 'landmark', label: 'History / Landmark' },
  { value: 'globe', label: 'Geography / Globe' },
  { value: 'trophy', label: 'Trophy / Quiz' },
  { value: 'help', label: 'Help / Info' },
  { value: 'mail', label: 'Contact / Mail' },
]

const ROUTE_PRESETS = [
  { label: 'Home', url: '/home' },
  { label: 'Quiz', url: '/quiz' },
  { label: 'NCERT', url: '/ncert' },
  { label: 'PYQ', url: '/pyq' },
  { label: 'History', url: '/history' },
  { label: 'Geography', url: '/geography' },
  { label: 'KVS-NVS', url: '/post/kvs-nvs' },
  { label: 'EMRS', url: '/post/emrs' },
  { label: 'UPESSC', url: '/upessc' },
  { label: 'About Us Page', url: '/page/about-us' },
  { label: 'Contact Us Page', url: '/page/contact-us' },
]

const EMPTY_FORM = {
  labelEn: '',
  labelHi: '',
  url: '/home',
  icon: '',
  parentId: '',
  location: 'header',
  routeId: '',
  openInNewTab: false,
  enabled: true,
  order: 1,
}

const EMPTY_PAGE_FORM = {
  id: null,
  title: '',
  slug: '',
  content: '',
  seoTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  allowComments: 'allow',
  order: 0,
  showInFooter: true,
  status: 'published',
}

const TGT_HISTORY_SAMPLE = {
  title: 'History / सामाजिक विज्ञान (इतिहास)',
  slug: 'history',
  metaDescription:
    'सामाजिक विज्ञान (इतिहास) - प्रशिक्षित स्नातक शिक्षक (TGT) पाठ्यक्रम, प्राचीन, मध्यकालीन एवं आधुनिक भारत का इतिहास।',
  content: `<h2>सामाजिक विज्ञान (इतिहास) - प्रशिक्षित स्नातक शिक्षक (TGT)</h2>
<p><strong>स्वाध्याय (Swadhyay)</strong> पर TGT / PGT / KVS / NVS / DSSSB परीक्षाओं की तैयारी हेतु इतिहास विषय का संपूर्ण पाठ्यक्रम एवं अध्ययन सामग्री:</p>
<h3>1. प्राचीन भारतीय इतिहास</h3>
<ul>
  <li>पाषाण काल एवं सिंधु घाटी सभ्यता (हड़प्पा, मोहनजोदड़ो)</li>
  <li>वैदिक संस्कृति, बौद्ध धर्म एवं जैन धर्म</li>
  <li>मौर्य साम्राज्य, गुप्त काल एवं हर्षवर्धन</li>
</ul>
<h3>2. मध्यकालीन भारतीय इतिहास</h3>
<ul>
  <li>दिल्ली सल्तनत (गुलाम, खिलजी, तुगलक, सैयद, लोदी वंश)</li>
  <li>मुगल साम्राज्य, प्रशासन, कला एवं स्थापत्य</li>
  <li>भक्ति एवं सूफी आंदोलन</li>
</ul>
<hr data-jump-break="true" class="cms-jump-break" />
<h3>3. आधुनिक भारतीय इतिहास</h3>
<ul>
  <li>1857 का स्वतंत्रता संग्राम एवं सामाजिक-धार्मिक सुधार आंदोलन</li>
  <li>भारतीय राष्ट्रीय कांग्रेस एवं गांधीवादी युग (1915–1947)</li>
  <li>संवैधानिक विकास एवं स्वतंत्रता प्राप्ति</li>
</ul>
<blockquote>नोट: प्रत्येक अध्याय के साथ NCERT आधारित प्रश्नोत्तरी (Quiz) एवं PYQ अभ्यास सेट उपलब्ध हैं।</blockquote>`,
}

function getRouteSlug(item) {
  let rawUrl = String(item?.url || '').trim()
  if (isExternalUrl(rawUrl)) return null

  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsed = new URL(rawUrl)
      rawUrl = (parsed.hash ? parsed.hash.replace(/^#/, '') : parsed.pathname) || ''
    } catch {
      rawUrl = rawUrl.replace(/^https?:\/\/[^/]+/i, '')
    }
  }

  let clean = rawUrl.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (/^page\//i.test(clean)) {
    clean = clean.replace(/^page\//i, '')
  } else if (/^post\//i.test(clean)) {
    clean = clean.replace(/^post\//i, '')
  }
  if (!clean) clean = 'home'
  return slugify(clean, 'page')
}

function getWordCount(html) {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.split(/\s+/).length : 0
}

export default function MenuManager() {
  const { user, role } = useAuth()
  const [firestoreItems, setFirestoreItems] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [activeLocation, setActiveLocation] = useState('header')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [expandedIds, setExpandedIds] = useState({})
  const [banner, setBanner] = useState(null)

  // Primary view tabs: 'tree' | 'content-dashboard' | 'editor'
  const [viewMode, setViewMode] = useState('tree')
  const [contentFilterLocation, setContentFilterLocation] = useState('all')
  const [contentSearchTerm, setContentSearchTerm] = useState('')

  // Editor states
  const [contentEditorItem, setContentEditorItem] = useState(null)
  const [pageForm, setPageForm] = useState(EMPTY_PAGE_FORM)
  const [docAlignMode, setDocAlignMode] = useState('centered') // 'centered' | 'full'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchDescOpen, setSearchDescOpen] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(true)
  const [previewModal, setPreviewModal] = useState(null) // null | 'desktop' | 'mobile'

  // Drag & Drop state
  const [draggedId, setDraggedId] = useState('')
  const [dropTarget, setDropTarget] = useState(null) // { id, mode: 'before' | 'nest' | 'root' }
  const [hasOrderChanges, setHasOrderChanges] = useState(false)

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLang, setPreviewLang] = useState('en')
  const [deleteDialog, setDeleteDialog] = useState(null) // { item, children }
  const [deleteChildAction, setDeleteChildAction] = useState('promote')
  const [deleteTargetParentId, setDeleteTargetParentId] = useState('')

  const usingDefaults = firestoreItems.length === 0
  const allItems = usingDefaults ? DEFAULT_MENU_ITEMS : firestoreItems

  const reload = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const [list, pagesList] = await Promise.all([
        listMenuItems(),
        listPages().catch(() => []),
      ])
      setFirestoreItems(list)
      setPages(pagesList)
      setHasOrderChanges(false)
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Unable to load menus.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      void reload()
    }, 0)
    return () => clearTimeout(id)
  }, [reload])

  // Map pages by normalized slug
  const pagesBySlug = useMemo(() => {
    const map = new Map()
    for (const p of pages) {
      if (p.slug) {
        map.set(String(p.slug).trim().toLowerCase(), p)
      }
    }
    return map
  }, [pages])

  // All internal navigation items (excluding external links)
  const internalNavItems = useMemo(() => {
    return allItems.filter((i) => !isExternalUrl(i.url))
  }, [allItems])

  // Filtered internal items for the Navigation Data Management Dashboard
  const filteredNavItems = useMemo(() => {
    return internalNavItems.filter((item) => {
      if (contentFilterLocation !== 'all' && (item.location || 'header') !== contentFilterLocation) {
        return false
      }
      if (contentSearchTerm.trim()) {
        const q = contentSearchTerm.trim().toLowerCase()
        const matchEn = (item.labelEn || '').toLowerCase().includes(q)
        const matchHi = (item.labelHi || '').toLowerCase().includes(q)
        const matchUrl = (item.url || '').toLowerCase().includes(q)
        if (!matchEn && !matchHi && !matchUrl) return false
      }
      return true
    })
  }, [internalNavItems, contentFilterLocation, contentSearchTerm])

  // Content dashboard metrics
  const contentStats = useMemo(() => {
    let fedCount = 0
    let publishedCount = 0
    for (const item of internalNavItems) {
      const slug = getRouteSlug(item)
      if (slug) {
        const p = pagesBySlug.get(slug.toLowerCase())
        if (p && p.content && p.content.trim()) {
          fedCount++
          if (p.status === 'published') publishedCount++
        }
      }
    }
    return {
      total: internalNavItems.length,
      fed: fedCount,
      pending: internalNavItems.length - fedCount,
      published: publishedCount,
    }
  }, [internalNavItems, pagesBySlug])

  // Dashboard stats across all menus
  const stats = useMemo(() => {
    const active = allItems.filter((i) => i.enabled !== false).length
    const disabled = allItems.length - active
    const nested = allItems.filter((i) => Boolean(i.parentId)).length
    return {
      total: allItems.length,
      active,
      disabled,
      nested,
    }
  }, [allItems])

  const locationItems = useMemo(
    () => allItems.filter((i) => (i.location || 'header') === activeLocation),
    [allItems, activeLocation],
  )

  const menuTree = useMemo(
    () => buildMenuTree(allItems, activeLocation),
    [allItems, activeLocation],
  )

  const headerPreviewTree = useMemo(
    () => buildMenuTree(allItems.filter((i) => i.enabled !== false), 'header'),
    [allItems],
  )

  const footerPreviewTree = useMemo(
    () => buildMenuTree(allItems.filter((i) => i.enabled !== false), 'footer'),
    [allItems],
  )

  const validParentOptions = useMemo(() => {
    return locationItems.filter((candidate) => {
      if (editing?.id && candidate.id === editing.id) return false
      if (editing?.id && wouldCreateCycle(editing.id, candidate.id, locationItems)) return false
      return true
    })
  }, [locationItems, editing])

  async function ensureSeededIfNeeded() {
    if (usingDefaults) {
      await seedDefaultMenuItems({ ...user, role })
      const fresh = await listMenuItems()
      setFirestoreItems(fresh)
      return fresh
    }
    return firestoreItems
  }

  function startAdd(parentId = '') {
    setEditing(null)
    setForm({
      ...EMPTY_FORM,
      location: activeLocation,
      parentId,
      order: locationItems.length + 1,
    })
  }

  function startEdit(item) {
    setEditing(item)
    const isExt = isExternalUrl(item.url)
    const normalizedUrl = isExt ? item.url : toInternalPath(item.url || '/home')
    setForm({
      labelEn: item.labelEn || '',
      labelHi: item.labelHi || '',
      url: normalizedUrl,
      icon: item.icon || '',
      parentId: item.parentId || '',
      location: item.location || activeLocation,
      routeId: item.routeId || '',
      openInNewTab: isExt ? Boolean(item.openInNewTab) : false,
      enabled: item.enabled !== false,
      order: Number(item.order || 1),
    })
  }

  async function handleConvertUrlToInternal(item) {
    const internalUrl = toInternalPath(item.url)
    setSaving(true)
    setBanner(null)
    try {
      const baseList = await ensureSeededIfNeeded()
      await saveMenuItem({
        id: item.id,
        data: {
          ...item,
          url: internalUrl,
          openInNewTab: false,
        },
        user: { ...user, role },
        allItems: baseList,
      })
      await reload()
      setBanner({
        type: 'success',
        text: `"${item.labelEn}" को आंतरिक रूट (${internalUrl}) में सफलतापूर्वक बदल दिया गया!`,
      })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'रूट बदलने में विफल।' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveItem(event) {
    event.preventDefault()
    setSaving(true)
    setBanner(null)
    try {
      const baseList = await ensureSeededIfNeeded()
      await saveMenuItem({
        id: editing?.id,
        data: form,
        user: { ...user, role },
        allItems: baseList,
      })
      await reload()
      startAdd('')
      setBanner({
        type: 'success',
        text: editing ? 'Menu item updated.' : 'Menu item added.',
      })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Unable to save menu item.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEnabled(item) {
    setSaving(true)
    setBanner(null)
    try {
      await ensureSeededIfNeeded()
      await toggleMenuItemEnabled(item.id, item.enabled === false, { ...user, role })
      await reload()
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Failed to toggle visibility.' })
    } finally {
      setSaving(false)
    }
  }

  function requestDelete(item) {
    const children = allItems.filter((i) => i.parentId === item.id)
    if (children.length > 0) {
      setDeleteChildAction('promote')
      setDeleteTargetParentId('')
      setDeleteDialog({ item, children })
      return
    }
    void performSimpleDelete(item)
  }

  async function performSimpleDelete(item) {
    if (!window.confirm(`Delete menu item "${item.labelEn}"?`)) return
    setSaving(true)
    setBanner(null)
    try {
      await ensureSeededIfNeeded()
      await deleteMenuItem(item.id, { ...user, role })
      await reload()
      setBanner({ type: 'success', text: `Deleted "${item.labelEn}".` })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Failed to delete item.' })
    } finally {
      setSaving(false)
    }
  }

  async function confirmParentDelete() {
    if (!deleteDialog) return
    const { item } = deleteDialog
    setSaving(true)
    setBanner(null)
    try {
      await ensureSeededIfNeeded()
      if (deleteChildAction === 'cascade') {
        await deleteMenuItemWithChildren(item.id, { ...user, role })
      } else {
        const nextParent = deleteChildAction === 'promote' ? item.parentId || '' : deleteTargetParentId
        await deleteMenuItem(item.id, { ...user, role }, nextParent)
      }
      setDeleteDialog(null)
      await reload()
      setBanner({ type: 'success', text: `Deleted "${item.labelEn}".` })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Failed to delete.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleResetToDefault() {
    if (
      !window.confirm(
        'Reset menus to default built-in structure? Any custom menu items will be replaced with defaults.',
      )
    ) {
      return
    }
    setSaving(true)
    setBanner(null)
    try {
      await resetMenusToDefault({ ...user, role })
      await reload()
      setBanner({ type: 'success', text: 'Menus reset to default structure.' })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Reset failed.' })
    } finally {
      setSaving(false)
    }
  }

  /* ================= DRAG & DROP LOGIC ================= */
  function findNodeInTree(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children?.length) {
        const found = findNodeInTree(n.children, id)
        if (found) return found
      }
    }
    return null
  }

  function handleDropOnNode(targetId, mode) {
    if (!draggedId || draggedId === targetId) return
    if (wouldCreateCycle(draggedId, targetId, locationItems)) {
      setBanner({ type: 'error', text: 'Cannot move an item inside its own descendant.' })
      return
    }

    const draggedNode = findNodeInTree(menuTree, draggedId)
    const targetNode = findNodeInTree(menuTree, targetId)
    if (!draggedNode || !targetNode) return

    let nextParentId = ''
    if (mode === 'nest') {
      nextParentId = targetId
    } else {
      nextParentId = targetNode.parentId || ''
    }

    const updated = locationItems.map((item) => {
      if (item.id === draggedId) {
        return { ...item, parentId: nextParentId }
      }
      return item
    })

    const siblingItems = updated.filter((i) => (i.parentId || '') === (nextParentId || ''))
    const filteredSiblings = siblingItems.filter((i) => i.id !== draggedId)

    let targetIndex = filteredSiblings.findIndex((i) => i.id === targetId)
    if (mode === 'nest') {
      targetIndex = filteredSiblings.length
    } else if (targetIndex === -1) {
      targetIndex = filteredSiblings.length
    }

    const reorderedSiblings = [
      ...filteredSiblings.slice(0, targetIndex),
      { ...draggedNode, parentId: nextParentId },
      ...filteredSiblings.slice(targetIndex),
    ]

    const nextLocationItems = updated.map((item) => {
      const idx = reorderedSiblings.findIndex((s) => s.id === item.id)
      if (idx !== -1) {
        return { ...item, parentId: nextParentId, order: idx + 1 }
      }
      return item
    })

    const mergedAll = allItems.map((item) => {
      const locMatch = nextLocationItems.find((n) => n.id === item.id)
      return locMatch || item
    })

    setFirestoreItems(mergedAll)
    setHasOrderChanges(true)
    setDropTarget(null)
    setDraggedId('')
  }

  function handleDropOnRoot() {
    if (!draggedId) return
    const draggedNode = findNodeInTree(menuTree, draggedId)
    if (!draggedNode) return

    const updated = locationItems.map((item) => {
      if (item.id === draggedId) {
        return { ...item, parentId: '', order: locationItems.length + 1 }
      }
      return item
    })

    const mergedAll = allItems.map((item) => {
      const locMatch = updated.find((n) => n.id === item.id)
      return locMatch || item
    })

    setFirestoreItems(mergedAll)
    setHasOrderChanges(true)
    setDropTarget(null)
    setDraggedId('')
  }

  async function handleSaveTreeOrder() {
    setSaving(true)
    setBanner(null)
    try {
      await ensureSeededIfNeeded()
      await reorderMenuItems(
        locationItems.map((item, idx) => ({
          id: item.id,
          parentId: item.parentId || '',
          order: idx + 1,
        })),
        { ...user, role },
      )
      await reload()
      setBanner({ type: 'success', text: 'Menu order and nesting saved.' })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save menu order.' })
    } finally {
      setSaving(false)
    }
  }

  /* ================= CONTENT / PAGE EDITOR WORKFLOWS ================= */
  function openContentEditor(item) {
    const targetSlug = getRouteSlug(item)
    if (!targetSlug) {
      setBanner({
        type: 'error',
        text: `"${item.labelEn}" एक बाह्य URL (${item.url}) है। केवल आंतरिक नेविगेशन रूट्स के लिए पेज सामग्री बनाई जा सकती है।`,
      })
      return
    }
    const existing = pagesBySlug.get(targetSlug.toLowerCase())
    setContentEditorItem(item)
    if (existing) {
      setPageForm({
        id: existing.id,
        title: existing.title || item.labelEn || item.labelHi || targetSlug,
        slug: existing.slug || targetSlug,
        content: existing.content || '',
        seoTitle: existing.seoTitle || '',
        metaDescription: existing.metaDescription || '',
        canonicalUrl: existing.canonicalUrl || '',
        allowComments: existing.allowComments || 'allow',
        order: existing.order ?? Number(item.order || 0),
        showInFooter: existing.showInFooter !== false,
        status: existing.status || 'published',
      })
    } else {
      setPageForm({
        id: null,
        title: item.labelEn || item.labelHi || targetSlug,
        slug: targetSlug,
        content: '',
        seoTitle: '',
        metaDescription: '',
        canonicalUrl: '',
        allowComments: 'allow',
        order: Number(item.order || 0),
        showInFooter: true,
        status: 'published',
      })
    }
    setViewMode('editor')
    setBanner(null)
  }

  async function handleSaveContent(targetStatus) {
    if (!pageForm.title.trim()) {
      setBanner({ type: 'error', text: 'कृपया पेज का शीर्षक दर्ज करें।' })
      return
    }
    setContentSaving(true)
    setBanner(null)
    try {
      const existing = pageForm.id ? pages.find((p) => p.id === pageForm.id) : null
      const res = await savePage({
        id: pageForm.id,
        existingPage: existing,
        data: pageForm,
        user: { ...user, role },
        status: targetStatus,
      })
      const freshPages = await listPages()
      setPages(freshPages)
      setPageForm((prev) => ({
        ...prev,
        id: res.id,
        slug: res.slug,
        status: targetStatus,
      }))
      setBanner({
        type: 'success',
        text: `नेविगेशन पेज "${pageForm.title}" (#/${res.slug}) सफलतापूर्वक ${
          targetStatus === 'published' ? 'प्रकाशित' : 'ड्राफ्ट के रूप में सुरक्षित'
        } कर दिया गया!`,
      })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'पेज सामग्री सुरक्षित करने में विफल।' })
    } finally {
      setContentSaving(false)
    }
  }

  async function handleDeleteContent(pageId, pageTitle) {
    if (
      !window.confirm(
        `क्या आप पेज "${pageTitle || pageForm.title}" की सामग्री को डेटाबेस से पूरी तरह हटाना चाहते हैं?`,
      )
    ) {
      return
    }
    setContentSaving(true)
    setBanner(null)
    try {
      await deletePage(pageId)
      const freshPages = await listPages()
      setPages(freshPages)
      if (pageForm.id === pageId) {
        setPageForm((prev) => ({
          ...prev,
          id: null,
          content: '',
        }))
      }
      setBanner({
        type: 'success',
        text: `पेज "${pageTitle || pageForm.title}" की सामग्री डेटाबेस से हटा दी गई।`,
      })
      if (viewMode === 'editor') {
        setViewMode('content-dashboard')
      }
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'सामग्री हटाने में विफल।' })
    } finally {
      setContentSaving(false)
    }
  }

  async function handleTogglePageStatus(page) {
    setContentSaving(true)
    try {
      await togglePagePublish(page)
      const freshPages = await listPages()
      setPages(freshPages)
      setBanner({
        type: 'success',
        text: `पेज "${page.title}" की स्थिति बदलकर ${page.status === 'published' ? 'ड्राफ्ट' : 'प्रकाशित'} कर दी गई।`,
      })
    } catch (err) {
      setBanner({ type: 'error', text: err?.message || 'स्थिति बदलने में विफल।' })
    } finally {
      setContentSaving(false)
    }
  }

  const livePreviewHtml = useMemo(
    () => (previewModal ? renderMathInHtml(pageForm.content || '') : ''),
    [previewModal, pageForm.content],
  )

  const resolvedSlug = pageForm.slug || slugify(pageForm.title, 'page')

  /* ================= RENDER TREE NODES ================= */
  function renderTreeNodes(nodes, depth = 0) {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0
      const isExpanded = expandedIds[node.id] !== false
      const isNest = dropTarget?.id === node.id && dropTarget?.mode === 'nest'
      const isBefore = dropTarget?.id === node.id && dropTarget?.mode === 'before'

      const isExternal = isExternalUrl(node.url)
      const internalPath = toInternalPath(node.url)
      const hasFullSwadhyayUrl = /^https?:\/\/(www\.)?swadhyay\.in/i.test(node.url)

      const routeSlug = getRouteSlug(node)
      const linkedPage = routeSlug ? pagesBySlug.get(routeSlug.toLowerCase()) : null
      const hasContent = Boolean(linkedPage?.content && linkedPage.content.trim())

      return (
        <div key={node.id} className="mnu-tree-branch">
          <div
            className={`mnu-tree-row ${isBefore ? 'is-drop-before' : ''} ${
              isNest ? 'is-drop-nest' : ''
            } ${editing?.id === node.id ? 'is-editing' : ''} ${
              node.enabled === false ? 'is-disabled' : ''
            }`}
            style={{ marginLeft: depth * 24 }}
            draggable
            onDragStart={() => setDraggedId(node.id)}
            onDragEnd={() => {
              setDraggedId('')
              setDropTarget(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              const rect = e.currentTarget.getBoundingClientRect()
              const relY = e.clientY - rect.top
              const mode = relY > rect.height * 0.45 ? 'nest' : 'before'
              setDropTarget({ id: node.id, mode })
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDropOnNode(node.id, dropTarget?.mode || 'before')
            }}
          >
            <span className="mnu-drag-handle" title="Drag to reorder or drop onto item to nest">
              <GripVertical size={15} />
            </span>

            {hasChildren ? (
              <button
                type="button"
                className="mnu-expand-btn"
                onClick={() =>
                  setExpandedIds((p) => ({ ...p, [node.id]: !isExpanded }))
                }
                aria-label={isExpanded ? 'Collapse submenu' : 'Expand submenu'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : depth > 0 ? (
              <CornerDownRight size={13} className="mnu-child-icon" />
            ) : (
              <span style={{ width: 18 }} />
            )}

            <div className="mnu-row-copy">
              <div className="mnu-row-title">
                <strong>{node.labelEn}</strong>
                {node.labelHi && node.labelHi !== node.labelEn ? (
                  <span className="cms-subtext">({node.labelHi})</span>
                ) : null}
                {hasChildren ? (
                  <span className="cms-badge">{node.children.length} sub</span>
                ) : null}
                {node.openInNewTab && isExternal ? <ExternalLink size={12} /> : null}
                {!isExternal ? (
                  <span
                    className="cms-badge"
                    style={{
                      fontSize: '0.68rem',
                      padding: '1px 6px',
                      background: 'rgba(2, 132, 199, 0.1)',
                      color: '#0284c7',
                      borderColor: 'rgba(2, 132, 199, 0.3)',
                    }}
                  >
                    आंतरिक रूट
                  </span>
                ) : null}
                {hasContent ? (
                  <span
                    className={
                      linkedPage.status === 'published' ? 'cms-badge is-published' : 'cms-badge is-draft'
                    }
                    title="डेटाबेस में सामग्री मौजूद है"
                  >
                    {linkedPage.status === 'published' ? '🟢 सामग्री मौजूद' : '🟡 ड्राफ्ट'}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span className="cms-subtext">
                  {isExternal ? node.url : `#${internalPath}`}
                </span>
                {hasFullSwadhyayUrl ? (
                  <button
                    type="button"
                    className="admin-pill-link"
                    style={{ fontSize: '0.70rem', padding: '1px 6px', height: 'auto', lineHeight: '1.4' }}
                    onClick={() => handleConvertUrlToInternal(node)}
                    title="URL से swadhyay.in हटाकर शुद्ध आंतरिक रूट (#{internalPath}) में बदलें"
                  >
                    रूट शुद्ध करें (#{internalPath})
                  </button>
                ) : null}
              </div>
            </div>

            <div className="cms-row-actions">
              {/* Quick Feed / Edit Content Button */}
              {routeSlug ? (
                <button
                  type="button"
                  className={`cmt-action-btn ${hasContent ? 'is-has-content' : ''}`}
                  title={hasContent ? 'सामग्री संपादित करें (Edit Content)' : 'सामग्री फीड करें (Feed Data)'}
                  onClick={() => openContentEditor(node)}
                  style={{ gap: 4, padding: '4px 8px', fontSize: '0.78rem' }}
                >
                  <FileText size={13} />
                  <span>{hasContent ? '📝 सामग्री' : '➕ फीड करें'}</span>
                </button>
              ) : null}

              {hasContent && linkedPage?.status === 'published' ? (
                <a
                  href={node.url.startsWith('#') ? node.url : `#${node.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="cmt-action-btn"
                  title="लाइव रूट देखें (View Live)"
                >
                  <ExternalLink size={13} />
                </a>
              ) : null}

              <button
                type="button"
                className="cmt-action-btn"
                title={node.enabled === false ? 'Enable item' : 'Disable item'}
                onClick={() => handleToggleEnabled(node)}
              >
                {node.enabled === false ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                className="cmt-action-btn"
                title="Add Submenu Item"
                onClick={() => startAdd(node.id)}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                className="cmt-action-btn"
                title="Edit item"
                onClick={() => startEdit(node)}
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                className="cmt-action-btn is-delete"
                title="Delete item"
                onClick={() => requestDelete(node)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {hasChildren && isExpanded ? (
            <div className="mnu-tree-children">{renderTreeNodes(node.children, depth + 1)}</div>
          ) : null}
        </div>
      )
    })
  }

  /* ================= VIEW: DEDICATED BLOGGER-STYLE RICH TEXT EDITOR ================= */
  if (viewMode === 'editor') {
    return (
      <div className="blogger-editor-shell">
        {/* Blogger-Style Top Bar */}
        <header className="blogger-topbar">
          <div className="blogger-topbar-left">
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => setViewMode('content-dashboard')}
            >
              <ArrowLeft size={15} />
              <span>नेविगेशन डेटा डैशबोर्ड</span>
            </button>
            <div className="blogger-topbar-meta">
              <span
                className={
                  pageForm.status === 'published' ? 'cms-badge is-published' : 'cms-badge'
                }
              >
                {pageForm.status === 'published' ? '🟢 Published' : '🟡 Draft'}
              </span>
              <code className="blogger-permalink-chip">
                {contentEditorItem?.url ? `#${contentEditorItem.url.replace(/^#\/?/, '/')}` : `#/page/${resolvedSlug}`}
              </code>
              {contentEditorItem ? (
                <span className="cms-subtext" style={{ fontWeight: 600 }}>
                  मेन्यू: {contentEditorItem.labelEn}
                  {contentEditorItem.labelHi ? ` (${contentEditorItem.labelHi})` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div className="blogger-topbar-actions">
            {/* Document Alignment Mode */}
            <div className="blogger-align-group" role="group" aria-label="Workspace width">
              <button
                type="button"
                className={docAlignMode === 'centered' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
                onClick={() => setDocAlignMode('centered')}
                title="Centered Document View"
                aria-label="Centered Document View"
              >
                <AlignCenter size={15} />
              </button>
              <button
                type="button"
                className={docAlignMode === 'full' ? 'rte-tool-btn is-active' : 'rte-tool-btn'}
                onClick={() => setDocAlignMode('full')}
                title="Full Width View"
                aria-label="Full Width View"
              >
                <AlignJustify size={15} />
              </button>
            </div>

            {/* Load Sample Content */}
            {!pageForm.content.trim() ? (
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => {
                  setPageForm((prev) => ({
                    ...prev,
                    title: prev.title || TGT_HISTORY_SAMPLE.title,
                    slug: prev.slug || TGT_HISTORY_SAMPLE.slug,
                    metaDescription: prev.metaDescription || TGT_HISTORY_SAMPLE.metaDescription,
                    content: TGT_HISTORY_SAMPLE.content,
                  }))
                }}
              >
                <Sparkles size={15} />
                <span>TGT History Sample लोड करें</span>
              </button>
            ) : null}

            {/* Preview Button */}
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => setPreviewModal('desktop')}
            >
              <Eye size={15} />
              <span>प्रीव्यू (Preview)</span>
            </button>

            {/* Save Draft Button */}
            <button
              type="button"
              className="admin-pill-link"
              disabled={contentSaving}
              onClick={() => handleSaveContent('draft')}
            >
              <Save size={15} />
              <span>{contentSaving ? 'Saving…' : 'ड्राफ्ट सहेजें'}</span>
            </button>

            {/* Publish Orange Button */}
            <button
              type="button"
              className="cms-btn-publish-orange"
              disabled={contentSaving}
              onClick={() => handleSaveContent('published')}
            >
              <Send size={15} />
              <span>
                {contentSaving
                  ? 'सहेज रहे हैं…'
                  : pageForm.status === 'published'
                    ? 'अपडेट करें (Update)'
                    : 'प्रकाशित करें (Publish)'}
              </span>
            </button>

            {/* Delete Content Button */}
            {pageForm.id ? (
              <button
                type="button"
                className="admin-icon-btn is-delete"
                title="डेटाबेस से सामग्री हटाएं"
                disabled={contentSaving}
                onClick={() => handleDeleteContent(pageForm.id, pageForm.title)}
              >
                <Trash2 size={16} />
              </button>
            ) : null}

            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={sidebarCollapsed ? 'Expand Page settings' : 'Collapse Page settings'}
              aria-label="Toggle Page settings sidebar"
            >
              {sidebarCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
            </button>
          </div>
        </header>

        {banner ? (
          <div
            className={banner.type === 'error' ? 'admin-alert' : 'admin-alert cmt-alert-success'}
            role="status"
          >
            <span>{banner.text}</span>
            <button
              type="button"
              className="cmt-alert-close"
              onClick={() => setBanner(null)}
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        <div
          className={
            sidebarCollapsed
              ? 'blogger-workspace is-sidebar-collapsed'
              : 'blogger-workspace'
          }
        >
          {/* Main Workspace (Editor Pane) */}
          <main
            className={
              docAlignMode === 'centered'
                ? 'blogger-main-pane is-centered'
                : 'blogger-main-pane'
            }
          >
            <div className="blogger-title-box">
              <label htmlFor="page-title" className="blogger-title-label">
                पेज का शीर्षक (Title)
              </label>
              <input
                id="page-title"
                type="text"
                className="blogger-title-input"
                placeholder="उदा. सामाजिक विज्ञान (इतिहास) - TGT पाठ्यक्रम एवं अध्ययन सामग्री..."
                value={pageForm.title}
                onChange={(event) => {
                  const title = event.target.value
                  setPageForm((prev) => ({
                    ...prev,
                    title,
                  }))
                }}
              />
            </div>

            {/* The Full Word-like Rich Text Editor */}
            <RichTextEditor
              value={pageForm.content}
              onChange={(html) => setPageForm((prev) => ({ ...prev, content: html }))}
              placeholder="यहाँ विस्तृत अध्याय, हेडिंग्स, सूचियां, सारणी, छवियां एवं गणितीय सूत्र लिखें…"
            />
          </main>

          {/* Right Collapsible Sidebar: Page settings */}
          {!sidebarCollapsed ? (
            <aside className="blogger-settings-sidebar" aria-label="Page settings">
              <div className="blogger-settings-head">
                <div className="blogger-settings-title">
                  <SlidersHorizontal size={16} />
                  <h2>Page Settings</h2>
                </div>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse Page settings"
                  aria-label="Collapse Page settings"
                >
                  <PanelRightClose size={16} />
                </button>
              </div>

              {/* Sub-section 1: Search description & SEO */}
              <section className="blogger-accordion">
                <button
                  type="button"
                  className="blogger-accordion-trigger"
                  onClick={() => setSearchDescOpen((prev) => !prev)}
                  aria-expanded={searchDescOpen}
                >
                  <span>Search Description &amp; SEO</span>
                  {searchDescOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {searchDescOpen ? (
                  <div className="blogger-accordion-body">
                    <div className="cms-field">
                      <div className="blogger-field-head">
                        <label htmlFor="page-meta-desc">Meta / Search Description</label>
                        <span className="blogger-char-count">
                          {(pageForm.metaDescription || '').length}/160
                        </span>
                      </div>
                      <textarea
                        id="page-meta-desc"
                        rows={4}
                        maxLength={320}
                        placeholder="Google और स्वाध्याय पर प्रदर्शित होने वाला संक्षिप्त विवरण लिखें..."
                        value={pageForm.metaDescription}
                        onChange={(event) =>
                          setPageForm((prev) => ({
                            ...prev,
                            metaDescription: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="cms-field">
                      <label htmlFor="page-seo-title">SEO Title</label>
                      <input
                        id="page-seo-title"
                        type="text"
                        placeholder="वैकल्पिक SEO ब्राउज़र शीर्षक"
                        value={pageForm.seoTitle}
                        onChange={(event) =>
                          setPageForm((prev) => ({ ...prev, seoTitle: event.target.value }))
                        }
                      />
                    </div>

                    <div className="cms-field">
                      <label htmlFor="page-canonical">Canonical URL</label>
                      <input
                        id="page-canonical"
                        type="url"
                        placeholder={`https://swadhyay.in/#/page/${resolvedSlug}`}
                        value={pageForm.canonicalUrl}
                        onChange={(event) =>
                          setPageForm((prev) => ({
                            ...prev,
                            canonicalUrl: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              {/* Sub-section 2: Route & Options */}
              <section className="blogger-accordion">
                <button
                  type="button"
                  className="blogger-accordion-trigger"
                  onClick={() => setOptionsOpen((prev) => !prev)}
                  aria-expanded={optionsOpen}
                >
                  <span>रूट एवं विकल्प (Route &amp; Options)</span>
                  {optionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {optionsOpen ? (
                  <div className="blogger-accordion-body">
                    <div className="cms-field">
                      <label htmlFor="page-slug">आंतरिक रूट स्लग (Route Slug)</label>
                      <input
                        id="page-slug"
                        type="text"
                        value={pageForm.slug}
                        onChange={(event) => {
                          setPageForm((prev) => ({ ...prev, slug: slugify(event.target.value, 'page') }))
                        }}
                      />
                      <span className="blogger-help-text">
                        पब्लिक URL: #{contentEditorItem?.url || `/${resolvedSlug}`}
                      </span>
                    </div>

                    <div className="cms-field">
                      <label htmlFor="page-comments-opt">टिप्पणियाँ (Comments)</label>
                      <select
                        id="page-comments-opt"
                        value={pageForm.allowComments}
                        onChange={(event) =>
                          setPageForm((prev) => ({
                            ...prev,
                            allowComments: event.target.value,
                          }))
                        }
                      >
                        <option value="allow">अनुमति दें (Allow)</option>
                        <option value="disallow_show">नई टिप्पणियाँ बंद रखें, पुरानी दिखाएं</option>
                        <option value="disallow_hide">पूर्णतः बंद रखें (Disable)</option>
                      </select>
                    </div>

                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: '0.84rem' }}>
                      <div><strong>कुल शब्द:</strong> {getWordCount(pageForm.content)}</div>
                      <div style={{ marginTop: 4 }}><strong>डेटाबेस स्थिति:</strong> {pageForm.id ? 'सुरक्षित (Saved in Firestore)' : 'नई सामग्री (Unsaved)'}</div>
                    </div>
                  </div>
                ) : null}
              </section>
            </aside>
          ) : null}
        </div>

        {/* Real-time Preview Modal */}
        {previewModal ? (
          <div className="media-modal-backdrop" role="dialog" aria-modal="true">
            <div
              className={
                previewModal === 'mobile'
                  ? 'media-modal-card blogger-preview-modal is-mobile'
                  : 'media-modal-card is-wide blogger-preview-modal'
              }
            >
              <div className="blogger-preview-header">
                <div>
                  <strong>Live Navigation Page Preview</strong>
                  <span className="blogger-help-text">
                    #{contentEditorItem?.url || `/${resolvedSlug}`}
                  </span>
                </div>
                <div className="admin-quick-actions">
                  <button
                    type="button"
                    className={
                      previewModal === 'desktop'
                        ? 'admin-pill-link is-primary'
                        : 'admin-pill-link'
                    }
                    onClick={() => setPreviewModal('desktop')}
                  >
                    <Monitor size={14} />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    className={
                      previewModal === 'mobile'
                        ? 'admin-pill-link is-primary'
                        : 'admin-pill-link'
                    }
                    onClick={() => setPreviewModal('mobile')}
                  >
                    <Smartphone size={14} />
                    <span>Mobile</span>
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => setPreviewModal(null)}
                    aria-label="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="blogger-preview-body">
                <article className="article-prose">
                  <h1>{pageForm.title || 'Untitled Page'}</h1>
                  {pageForm.metaDescription ? (
                    <p className="lede">{pageForm.metaDescription}</p>
                  ) : null}
                  <div
                    dangerouslySetInnerHTML={{
                      __html:
                        livePreviewHtml ||
                        '<p>No content written yet. Start typing in the editor to see live preview.</p>',
                    }}
                  />
                </article>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  /* ================= VIEW: MAIN INTERFACE (TABS: TREE VS CONTENT DASHBOARD) ================= */
  return (
    <div className="menu-manager">
      <section className="admin-page-head">
        <div>
          <h1>Navigation Menu &amp; Internal Route Manager</h1>
          <p>
            Manage website navigation menus, drag-and-drop hierarchy, and feed/edit rich HTML
            content for all internal routes (Home, Quiz, NCERT, PYQ, History, Geography, UPESSC,
            custom pages).
          </p>
        </div>

        <div className="cms-head-left">
          <button type="button" className="admin-btn-secondary" onClick={reload}>
            <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {banner ? (
        <div
          className={banner.type === 'error' ? 'admin-alert' : 'admin-alert cmt-alert-success'}
          role="status"
        >
          <span>{banner.text}</span>
          <button
            type="button"
            className="cmt-alert-close"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Main Mode Navigation Tabs */}
      <nav className="mnu-main-tabs" aria-label="Menu Manager Tabs">
        <button
          type="button"
          className={`mnu-main-tab-btn ${viewMode === 'tree' ? 'is-active' : ''}`}
          onClick={() => setViewMode('tree')}
        >
          <FolderTree size={16} />
          <span>📋 मेन्यू संरचना एवं क्रम (Menu Tree &amp; Hierarchy)</span>
        </button>
        <button
          type="button"
          className={`mnu-main-tab-btn ${viewMode === 'content-dashboard' ? 'is-active' : ''}`}
          onClick={() => setViewMode('content-dashboard')}
        >
          <FileText size={16} />
          <span>📊 नेविगेशन डेटा प्रबंधन डैशबोर्ड (Navigation Pages &amp; Data Dashboard)</span>
          <span className="cms-badge" style={{ marginLeft: 4 }}>
            {contentStats.fed}/{contentStats.total}
          </span>
        </button>
      </nav>

      {/* TAB 1: MENU TREE & REORDER */}
      {viewMode === 'tree' ? (
        <>
          {/* Stats Bar */}
          <section className="cmt-stats-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-total">
                <MenuIcon size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{stats.total}</strong>
                <span className="cmt-stat-label">Total Items</span>
              </div>
            </div>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-active">
                <Eye size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{stats.active}</strong>
                <span className="cmt-stat-label">Active / Visible</span>
              </div>
            </div>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-pending">
                <Layers size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{stats.nested}</strong>
                <span className="cmt-stat-label">Submenu Items</span>
              </div>
            </div>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-resolved">
                <FileText size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{contentStats.fed}</strong>
                <span className="cmt-stat-label">Pages With Fed Data</span>
              </div>
            </div>
          </section>

          {/* Location Switcher & Actions */}
          <div className="cms-filter-group" style={{ marginBottom: 16 }}>
            {MENU_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className={activeLocation === loc.id ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                onClick={() => {
                  setActiveLocation(loc.id)
                  setForm((p) => ({ ...p, location: loc.id, parentId: '' }))
                }}
              >
                {loc.label}
              </button>
            ))}
          </div>

          <div className="mnu-layout">
            {/* Left Column: Interactive Tree */}
            <section className="admin-card">
              <div className="cms-card-head">
                <div>
                  <h2>
                    {MENU_LOCATIONS.find((l) => l.id === activeLocation)?.label || 'Menu'} Hierarchy
                  </h2>
                  <p className="cms-subtext">
                    Drag items to reorder. Drop onto an item to nest as a dropdown child. Click
                    <strong> 📝 सामग्री</strong> to feed rich page data!
                  </p>
                </div>
                <div className="cms-form-actions">
                  <button
                    type="button"
                    className="admin-pill-link"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye size={14} />
                    <span>Preview Menu</span>
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={handleResetToDefault}
                    title="Restore default Swadhyay menu structure"
                  >
                    <RotateCcw size={14} />
                    <span>Reset Defaults</span>
                  </button>
                </div>
              </div>

              {/* Root dropzone to un-nest items */}
              {draggedId ? (
                <div
                  className={`mnu-root-dropzone ${dropTarget?.mode === 'root' ? 'is-active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTarget({ id: 'root', mode: 'root' })
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropOnRoot()
                  }}
                >
                  <span>Drop here to move item to Top Level (Root)</span>
                </div>
              ) : null}

              {menuTree.length === 0 ? (
                <div className="cmt-empty-state">
                  <MenuIcon size={26} />
                  <h3>No items in {activeLocation} menu</h3>
                  <p>Use the form on the right to add your first item.</p>
                </div>
              ) : (
                <div className="mnu-tree-list">{renderTreeNodes(menuTree)}</div>
              )}

              {/* Bottom Save Order Action */}
              <div className="mnu-bottom-actions">
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={handleSaveTreeOrder}
                  disabled={saving || !hasOrderChanges}
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving…' : 'Save Order Changes'}</span>
                </button>
                {hasOrderChanges ? (
                  <span className="cms-subtext" style={{ color: 'var(--amber, #f59e0b)' }}>
                    Unsaved drag &amp; drop order changes. Click Save Order Changes to apply.
                  </span>
                ) : null}
              </div>
            </section>

            {/* Right Column: Add / Edit Menu Link Form */}
            <aside className="admin-card">
              <div className="cms-card-head">
                <h2>{editing ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                {editing ? (
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => startAdd('')}
                    title="Cancel edit"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleSaveItem} className="mnu-form">
                <div className="cms-field">
                  <label htmlFor="mnu-label-en">English Label *</label>
                  <input
                    id="mnu-label-en"
                    type="text"
                    required
                    placeholder="e.g. History, NCERT, About Us"
                    value={form.labelEn}
                    onChange={(e) => setForm((p) => ({ ...p, labelEn: e.target.value }))}
                  />
                </div>

                <div className="cms-field">
                  <label htmlFor="mnu-label-hi">Hindi Label (वैकल्पिक)</label>
                  <input
                    id="mnu-label-hi"
                    type="text"
                    placeholder="उदा. इतिहास, एनसीईआरटी, हमारे बारे में"
                    value={form.labelHi}
                    onChange={(e) => setForm((p) => ({ ...p, labelHi: e.target.value }))}
                  />
                </div>

                <div className="cms-field">
                  <label htmlFor="mnu-url">URL / Route *</label>
                  <input
                    id="mnu-url"
                    type="text"
                    required
                    placeholder="/history, /page/about-us, or https://..."
                    value={form.url}
                    onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>

                {/* Route Presets */}
                <div className="cms-field">
                  <label>Quick Route Presets</label>
                  <div className="mnu-presets-row">
                    {ROUTE_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        className="cms-tab-btn"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            url: preset.url,
                            labelEn: p.labelEn || preset.label,
                          }))
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cms-field">
                  <label htmlFor="mnu-parent">Parent Item (Nest under)</label>
                  <select
                    id="mnu-parent"
                    value={form.parentId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                  >
                    <option value="">(None - Top Level Item)</option>
                    {validParentOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.labelEn} {candidate.labelHi ? `(${candidate.labelHi})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cms-field">
                  <label htmlFor="mnu-icon">Icon</label>
                  <select
                    id="mnu-icon"
                    value={form.icon || ''}
                    onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="cms-checkbox">
                  <input
                    type="checkbox"
                    checked={form.openInNewTab}
                    onChange={(e) => setForm((p) => ({ ...p, openInNewTab: e.target.checked }))}
                  />
                  <span>Open in new tab</span>
                </label>

                <label className="cms-checkbox">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  <span>Enabled (Visible to public)</span>
                </label>

                <div className="cms-form-actions" style={{ marginTop: 8 }}>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    <Plus size={15} />
                    <span>{saving ? 'Saving…' : editing ? 'Update Item' : 'Add Item'}</span>
                  </button>
                  {editing ? (
                    <button
                      type="button"
                      className="admin-btn-secondary"
                      onClick={() => startAdd('')}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </aside>
          </div>
        </>
      ) : (
        /* TAB 2: NAVIGATION DATA MANAGEMENT DASHBOARD */
        <section className="admin-card">
          <div className="cms-card-head" style={{ marginBottom: 14 }}>
            <div>
              <h2>Navigation Pages &amp; Internal Route Data Management</h2>
              <p className="cms-subtext">
                All pages, menus, and internal routes in Swadhyay. Click{' '}
                <strong>📝 सामग्री जोड़ें / संपादित करें</strong> to write or edit full Word/Blogger-style
                articles and study materials with headings, images, and math equations!
              </p>
            </div>
            <div className="cms-form-actions">
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => {
                  const sampleItem = { labelEn: 'History', labelHi: 'इतिहास', url: '/history' }
                  openContentEditor(sampleItem)
                }}
              >
                <Sparkles size={15} />
                <span>New Page from TGT History Sample</span>
              </button>
            </div>
          </div>

          {/* Metric cards */}
          <section
            className="cmt-stats-grid"
            style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 18 }}
          >
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-total">
                <MenuIcon size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{contentStats.total}</strong>
                <span className="cmt-stat-label">Total Internal Routes</span>
              </div>
            </div>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-resolved">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{contentStats.fed}</strong>
                <span className="cmt-stat-label">Pages With Fed Content</span>
              </div>
            </div>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-active">
                <Eye size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{contentStats.published}</strong>
                <span className="cmt-stat-label">Published Live Pages</span>
              </div>
            </div>
            <div className="cmt-stat-card">
              <span className="cmt-stat-icon is-pending">
                <FileText size={18} />
              </span>
              <div>
                <strong className="cmt-stat-num">{contentStats.pending}</strong>
                <span className="cmt-stat-label">Pending / Empty Content</span>
              </div>
            </div>
          </section>

          {/* Filter Bar */}
          <div className="mnu-content-filters">
            <div className="cms-filter-group" role="tablist">
              <button
                type="button"
                className={contentFilterLocation === 'all' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                onClick={() => setContentFilterLocation('all')}
              >
                All Locations ({internalNavItems.length})
              </button>
              {MENU_LOCATIONS.map((loc) => {
                const count = internalNavItems.filter((i) => (i.location || 'header') === loc.id).length
                return (
                  <button
                    key={loc.id}
                    type="button"
                    className={contentFilterLocation === loc.id ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                    onClick={() => setContentFilterLocation(loc.id)}
                  >
                    {loc.label} ({count})
                  </button>
                )
              })}
            </div>

            <div className="mnu-search-box">
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                type="search"
                placeholder="Search menu name, route, or slug..."
                value={contentSearchTerm}
                onChange={(e) => setContentSearchTerm(e.target.value)}
              />
              {contentSearchTerm ? (
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setContentSearchTerm('')}
                  aria-label="Clear search"
                  style={{ width: 20, height: 20 }}
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
          </div>

          {/* Navigation Data Management Table */}
          {filteredNavItems.length === 0 ? (
            <div className="cmt-empty-state">
              <FileText size={26} />
              <h3>No navigation routes matched your filter</h3>
              <p>Try clearing search or changing the location filter.</p>
            </div>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Navigation Menu Item</th>
                    <th>Internal Route / Slug</th>
                    <th>Menu Location</th>
                    <th>Database Content Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNavItems.map((item) => {
                    const routeSlug = getRouteSlug(item)
                    const linkedPage = routeSlug ? pagesBySlug.get(routeSlug.toLowerCase()) : null
                    const hasContent = Boolean(linkedPage?.content && linkedPage.content.trim())
                    const wordCount = hasContent ? getWordCount(linkedPage.content) : 0

                    return (
                      <tr key={item.id}>
                        <td>
                          <div>
                            <strong>{item.labelEn}</strong>
                            {item.labelHi && item.labelHi !== item.labelEn ? (
                              <span className="cms-subtext" style={{ marginLeft: 6 }}>
                                ({item.labelHi})
                              </span>
                            ) : null}
                            {item.parentId ? (
                              <span className="cms-badge" style={{ marginLeft: 6 }}>
                                Submenu
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <code>{item.url}</code>
                          {routeSlug ? (
                            <span className="cms-subtext" style={{ display: 'block', marginTop: 2 }}>
                              Slug: <code>{routeSlug}</code>
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span className="cms-badge">
                            {MENU_LOCATIONS.find((l) => l.id === (item.location || 'header'))?.label || item.location}
                          </span>
                        </td>
                        <td>
                          {hasContent ? (
                            <div>
                              <span
                                className={
                                  linkedPage.status === 'published'
                                    ? 'cms-badge is-published'
                                    : 'cms-badge is-draft'
                                }
                              >
                                {linkedPage.status === 'published' ? '🟢 Published' : '🟡 Draft'}
                              </span>
                              <div className="cms-subtext" style={{ marginTop: 3 }}>
                                {wordCount} शब्द · {formatDateTime(linkedPage.updatedAt || linkedPage.createdAt)}
                              </div>
                            </div>
                          ) : (
                            <span className="cms-badge">⚪ सामग्री रिक्त (No Content Yet)</span>
                          )}
                        </td>
                        <td>
                          <div className="cms-row-actions">
                            {/* Primary Feed / Edit Content Button */}
                            <button
                              type="button"
                              className={`admin-pill-link ${hasContent ? 'is-primary' : ''}`}
                              onClick={() => openContentEditor(item)}
                              title={hasContent ? 'सामग्री संपादित करें' : 'नई सामग्री जोड़ें / फीड करें'}
                            >
                              <Edit3 size={14} />
                              <span>{hasContent ? 'संपादित करें (Edit)' : 'फीड करें (Feed)'}</span>
                            </button>

                            {/* View Live Route */}
                            {hasContent && linkedPage?.status === 'published' ? (
                              <a
                                href={item.url.startsWith('#') ? item.url : `#${item.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="admin-icon-btn"
                                title="लाइव रूट देखें"
                              >
                                <ExternalLink size={15} />
                              </a>
                            ) : null}

                            {/* Toggle Publish / Draft */}
                            {linkedPage ? (
                              <button
                                type="button"
                                className="admin-icon-btn"
                                onClick={() => handleTogglePageStatus(linkedPage)}
                                title={
                                  linkedPage.status === 'published'
                                    ? 'ड्राफ्ट में बदलें (Unpublish)'
                                    : 'प्रकाशित करें (Publish)'
                                }
                                disabled={contentSaving}
                              >
                                {linkedPage.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            ) : null}

                            {/* Delete Page Content Button */}
                            {linkedPage ? (
                              <button
                                type="button"
                                className="admin-icon-btn is-delete"
                                onClick={() => handleDeleteContent(linkedPage.id, linkedPage.title || item.labelEn)}
                                title="डेटाबेस से इस पेज की सामग्री हटाएं"
                                disabled={contentSaving}
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Delete Child Dialog for Menus */}
      {deleteDialog ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card">
            <div className="cms-card-head">
              <h2>Delete Menu Item: {deleteDialog.item.labelEn}</h2>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setDeleteDialog(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="cms-subtext">
              This item has <strong>{deleteDialog.children.length} submenu child item(s)</strong>.
              What would you like to do with them?
            </p>
            <div className="cms-field" style={{ marginTop: 12 }}>
              <label className="cms-checkbox">
                <input
                  type="radio"
                  name="childAction"
                  checked={deleteChildAction === 'promote'}
                  onChange={() => setDeleteChildAction('promote')}
                />
                <span>Promote children to parent level ({deleteDialog.item.parentId ? 'Parent' : 'Root'})</span>
              </label>
              <label className="cms-checkbox">
                <input
                  type="radio"
                  name="childAction"
                  checked={deleteChildAction === 'cascade'}
                  onChange={() => setDeleteChildAction('cascade')}
                />
                <span>Delete parent and all child items permanently</span>
              </label>
              <div className="cms-form-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={confirmParentDelete}
                  disabled={saving}
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setDeleteDialog(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Live Public Website Menu Preview Modal */}
      {previewOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-card" style={{ width: 'min(820px, 100%)' }}>
            <div className="cms-card-head">
              <div>
                <h2>Live Public Website Menu Preview</h2>
                <p className="cms-subtext">Shows enabled Header &amp; Footer items with submenus.</p>
              </div>
              <div className="cms-form-actions">
                <button
                  type="button"
                  className={previewLang === 'en' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                  onClick={() => setPreviewLang('en')}
                >
                  English
                </button>
                <button
                  type="button"
                  className={previewLang === 'hi' ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                  onClick={() => setPreviewLang('hi')}
                >
                  हिन्दी
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mnu-preview-bar">
              {headerPreviewTree.map((item) => (
                <div key={item.id} className="mnu-preview-item">
                  <span>
                    {previewLang === 'hi' ? item.labelHi || item.labelEn : item.labelEn}
                    {item.children.length > 0 ? ' ▾' : ''}
                  </span>
                  {item.children.length > 0 ? (
                    <div className="mnu-preview-dropdown">
                      {item.children.map((sub) => (
                        <div key={sub.id}>
                          {previewLang === 'hi' ? sub.labelHi || sub.labelEn : sub.labelEn}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {footerPreviewTree.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <h3>Footer Menu Preview</h3>
                <div className="mnu-preview-bar">
                  {footerPreviewTree.map((item) => (
                    <div key={item.id} className="mnu-preview-item">
                      <span>
                        {previewLang === 'hi' ? item.labelHi || item.labelEn : item.labelEn}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
