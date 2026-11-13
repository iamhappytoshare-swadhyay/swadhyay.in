import { useEffect, useMemo, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  Link as LinkIcon,
  Menu as MenuIcon,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deletePage,
  listPages,
  savePage,
  togglePagePublish,
} from '../services/cmsService.js'
import {
  DEFAULT_MENU_ITEMS,
  MENU_LOCATIONS,
  buildMenuTree,
  isExternalUrl,
  listMenuItems,
  saveMenuItem,
  seedDefaultMenuItems,
} from '../services/menuService.js'
import { renderMathInHtml } from '../utils/renderMathHtml.js'
import { formatDateTime, slugify } from '../utils/slugify.js'
import RichTextEditor from './components/RichTextEditor.jsx'

const EMPTY_PAGE = {
  title: '',
  slug: '',
  content: '',
  seoTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  allowComments: 'allow',
  order: 0,
  showInFooter: true,
}

const TGT_HISTORY_SAMPLE = {
  title: 'History',
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

function deriveSlugFromMenuItem(item) {
  const rawUrl = String(item?.url || '').trim()
  if (/^#?\/page\//i.test(rawUrl)) {
    return slugify(rawUrl.replace(/^#?\/page\//i, '').replace(/\/+$/, ''), 'page')
  }
  if (rawUrl && !isExternalUrl(rawUrl)) {
    return slugify(rawUrl.replace(/^#?\//, ''), 'page')
  }
  return slugify(item?.labelEn || item?.routeId || 'page', 'page')
}

function getDataEntryLinksForUrl(url) {
  const clean = String(url || '').replace(/^#/, '').toLowerCase()
  if (clean === '/pyq') {
    return [
      { label: 'PYQ Entries', href: '#/admin/pyq' },
      { label: 'Quizzes', href: '#/admin/quizzes' },
    ]
  }
  if (clean === '/ncert') {
    return [
      { label: 'NCERT Entries', href: '#/admin/ncert' },
      { label: 'Notes', href: '#/admin/notes' },
    ]
  }
  if (clean === '/history' || clean === '/geography' || clean === '/upessc') {
    return [
      { label: 'Posts', href: '#/admin/posts' },
      { label: 'Notes', href: '#/admin/notes' },
    ]
  }
  return []
}

function flattenMenuTree(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth })
    if (node.children?.length) {
      flattenMenuTree(node.children, depth + 1, out)
    }
  }
  return out
}

export default function PagesManager() {
  const { user } = useAuth()
  const [pages, setPages] = useState([])
  const [firestoreMenuItems, setFirestoreMenuItems] = useState([])
  const [navLocationFilter, setNavLocationFilter] = useState('header')
  const [loading, setLoading] = useState(true)
  const [editingPage, setEditingPage] = useState(null) // null = list, {} = new, doc = edit
  const [form, setForm] = useState(EMPTY_PAGE)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // Blogger-style UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchDescOpen, setSearchDescOpen] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(true)
  const [docAlignMode, setDocAlignMode] = useState('centered') // 'centered' | 'full'
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false)
  const [previewModal, setPreviewModal] = useState(null) // null | 'desktop' | 'mobile'
  const [addingToNav, setAddingToNav] = useState(false)
  const [editingLinkItemId, setEditingLinkItemId] = useState('')
  const [editingLinkUrl, setEditingLinkUrl] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  async function handleSaveMenuLink(item) {
    const nextUrl = editingLinkUrl.trim()
    if (!nextUrl) {
      setStatusMessage('Please enter a valid URL or path (e.g. https://... or /page/kvs-nvs).')
      return
    }
    setSavingLink(true)
    setStatusMessage('')
    try {
      if (firestoreMenuItems.length === 0) {
        await seedDefaultMenuItems(user)
      }
      await saveMenuItem({
        id: item.id,
        data: {
          ...item,
          url: nextUrl,
          openInNewTab: isExternalUrl(nextUrl),
        },
        user,
        allItems: allMenuItems,
      })
      await loadPages()
      setEditingLinkItemId('')
      setEditingLinkUrl('')
      setStatusMessage(`Updated link for "${item.labelEn}" to ${nextUrl}`)
    } catch (err) {
      setStatusMessage(err?.message || 'Failed to update menu link.')
    } finally {
      setSavingLink(false)
    }
  }

  async function loadPages() {
    setLoading(true)
    try {
      const [list, menuList] = await Promise.all([
        listPages(),
        listMenuItems().catch(() => []),
      ])
      setPages(list)
      setFirestoreMenuItems(menuList)
      return list
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listPages(), listMenuItems().catch(() => [])])
      .then(([list, menuList]) => {
        if (!active) return
        setPages(list)
        setFirestoreMenuItems(menuList)
        // Support deep-linking from MenuManager: #/admin/pages?slug=history&title=History
        const hash = window.location.hash || ''
        const qIndex = hash.indexOf('?')
        if (qIndex !== -1) {
          const params = new URLSearchParams(hash.slice(qIndex + 1))
          const targetSlug = params.get('slug')
          const targetTitle = params.get('title') || ''
          if (targetSlug) {
            const matched = list.find(
              (p) => p.slug === targetSlug || p.id === targetSlug,
            )
            if (matched) {
              openEditPage(matched)
            } else {
              setEditingPage({})
              setSlugTouched(true)
              setForm({
                ...EMPTY_PAGE,
                title: targetTitle || targetSlug,
                slug: targetSlug,
              })
            }
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function openNewPage(withSample = false) {
    setEditingPage({})
    setSlugTouched(withSample)
    setForm(
      withSample
        ? {
            ...EMPTY_PAGE,
            ...TGT_HISTORY_SAMPLE,
          }
        : EMPTY_PAGE,
    )
    setStatusMessage('')
  }

  function openEditPage(page) {
    setEditingPage(page)
    setSlugTouched(true)
    setForm({
      title: page.title || '',
      slug: page.slug || '',
      content: page.content || '',
      seoTitle: page.seoTitle || '',
      metaDescription: page.metaDescription || '',
      canonicalUrl: page.canonicalUrl || '',
      allowComments: page.allowComments || 'allow',
      order: page.order ?? 0,
      showInFooter: page.showInFooter !== false,
    })
    setStatusMessage('')
  }

  async function handleSave(targetStatus) {
    if (!form.title.trim()) {
      setStatusMessage('Please enter a page title.')
      return
    }
    setSaving(true)
    setStatusMessage('')
    try {
      const res = await savePage({
        id: editingPage?.id || null,
        existingPage: editingPage?.id ? editingPage : null,
        data: form,
        user,
        status: targetStatus,
      })
      await loadPages()
      setEditingPage((prev) => ({
        ...(prev || {}),
        id: res.id,
        status: targetStatus,
        slug: res.slug,
      }))
      setForm((prev) => ({ ...prev, slug: res.slug }))
      setStatusMessage(
        targetStatus === 'published'
          ? 'Page published to swadhyay.in!'
          : 'Draft saved.',
      )
    } catch (error) {
      setStatusMessage(error?.message || 'Failed to save page.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddToHeaderNav() {
    const cleanTitle = form.title.trim()
    const cleanSlug = slugify(form.slug || cleanTitle, 'page')
    if (!cleanTitle) {
      setStatusMessage('Enter a page title before adding to Navigation Menu.')
      return
    }
    setAddingToNav(true)
    try {
      await saveMenuItem({
        data: {
          labelEn: cleanTitle,
          labelHi: cleanTitle,
          url: `/page/${cleanSlug}`,
          location: 'header',
          enabled: true,
          openInNewTab: false,
          order: 99,
        },
        user,
      })
      setStatusMessage(`Added "${cleanTitle}" (/page/${cleanSlug}) to Header Navigation Menu.`)
    } catch (err) {
      setStatusMessage(err?.message || 'Could not add to Navigation Menu.')
    } finally {
      setAddingToNav(false)
    }
  }

  async function handleToggleStatus(page) {
    await togglePagePublish(page)
    await loadPages()
  }

  async function handleDelete(page) {
    if (!window.confirm(`Delete page "${page.title}" permanently?`)) return
    await deletePage(page.id)
    await loadPages()
  }

  const allMenuItems = useMemo(
    () => (firestoreMenuItems.length === 0 ? DEFAULT_MENU_ITEMS : firestoreMenuItems),
    [firestoreMenuItems],
  )

  const navTreeRows = useMemo(() => {
    const tree = buildMenuTree(allMenuItems, navLocationFilter)
    return flattenMenuTree(tree)
  }, [allMenuItems, navLocationFilter])

  const pagesBySlug = useMemo(() => {
    const map = new Map()
    for (const p of pages) {
      if (p.slug) map.set(String(p.slug).toLowerCase(), p)
    }
    return map
  }, [pages])

  function openMenuItemPage(item) {
    const targetSlug = deriveSlugFromMenuItem(item)
    const existing = pagesBySlug.get(targetSlug.toLowerCase())
    if (existing) {
      openEditPage(existing)
      return
    }
    setEditingPage({})
    setSlugTouched(true)
    setForm({
      ...EMPTY_PAGE,
      title: item.labelEn || item.labelHi || targetSlug,
      slug: targetSlug,
      order: Number(item.order ?? 0),
    })
    setStatusMessage('')
  }

  const livePreviewHtml = useMemo(
    () => (previewModal ? renderMathInHtml(form.content || '') : ''),
    [previewModal, form.content],
  )

  const resolvedSlug = form.slug || slugify(form.title, 'page')

  if (editingPage !== null) {
    return (
      <div className="blogger-editor-shell">
        {/* Blogger-Style Top Bar */}
        <header className="blogger-topbar">
          <div className="blogger-topbar-left">
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => setEditingPage(null)}
            >
              <ArrowLeft size={15} />
              <span>All Pages</span>
            </button>
            <div className="blogger-topbar-meta">
              <span
                className={
                  editingPage?.status === 'published'
                    ? 'cms-badge is-published'
                    : 'cms-badge'
                }
              >
                {editingPage?.status === 'published' ? 'Published' : 'Draft'}
              </span>
              <code className="blogger-permalink-chip">#/page/{resolvedSlug}</code>
            </div>
          </div>

          <div className="blogger-topbar-actions">
            {/* Document Alignment / Width Option */}
            <div className="blogger-align-group" role="group" aria-label="Workspace width">
              <button
                type="button"
                className={
                  docAlignMode === 'centered'
                    ? 'rte-tool-btn is-active'
                    : 'rte-tool-btn'
                }
                onClick={() => setDocAlignMode('centered')}
                title="Centered Document View"
                aria-label="Centered Document View"
              >
                <AlignCenter size={15} />
              </button>
              <button
                type="button"
                className={
                  docAlignMode === 'full' ? 'rte-tool-btn is-active' : 'rte-tool-btn'
                }
                onClick={() => setDocAlignMode('full')}
                title="Full Width View"
                aria-label="Full Width View"
              >
                <AlignJustify size={15} />
              </button>
            </div>

            {!form.content.trim() ? (
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => {
                  setSlugTouched(true)
                  setForm((prev) => ({
                    ...prev,
                    title: prev.title || TGT_HISTORY_SAMPLE.title,
                    slug: prev.slug || TGT_HISTORY_SAMPLE.slug,
                    metaDescription:
                      prev.metaDescription || TGT_HISTORY_SAMPLE.metaDescription,
                    content: TGT_HISTORY_SAMPLE.content,
                  }))
                }}
              >
                <Sparkles size={15} />
                <span>Load TGT History Sample</span>
              </button>
            ) : null}

            {/* Preview Button with Dropdown */}
            <div className="blogger-dropdown-wrap">
              <div className="blogger-split-btn">
                <button
                  type="button"
                  className="admin-pill-link"
                  onClick={() => {
                    setPreviewMenuOpen(false)
                    setPreviewModal('desktop')
                  }}
                >
                  <Eye size={15} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  className="admin-pill-link blogger-split-caret"
                  onClick={() => setPreviewMenuOpen((prev) => !prev)}
                  aria-label="Preview options"
                  aria-expanded={previewMenuOpen}
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {previewMenuOpen ? (
                <div className="blogger-dropdown-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPreviewMenuOpen(false)
                      setPreviewModal('desktop')
                    }}
                  >
                    <Monitor size={14} />
                    <span>Desktop Live Preview</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPreviewMenuOpen(false)
                      setPreviewModal('mobile')
                    }}
                  >
                    <Smartphone size={14} />
                    <span>Mobile Live Preview</span>
                  </button>
                  {editingPage?.status === 'published' ? (
                    <a
                      href={`#/page/${resolvedSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      role="menuitem"
                      onClick={() => setPreviewMenuOpen(false)}
                    >
                      <ExternalLink size={14} />
                      <span>Open Live Page</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="admin-pill-link"
              disabled={saving}
              onClick={() => handleSave('draft')}
            >
              <Save size={15} />
              <span>Save</span>
            </button>

            {/* Orange Publish Button on the far right */}
            <button
              type="button"
              className="cms-btn-publish-orange"
              disabled={saving}
              onClick={() => handleSave('published')}
            >
              <Send size={15} />
              <span>
                {saving
                  ? 'Saving…'
                  : editingPage.status === 'published'
                    ? 'Update'
                    : 'Publish'}
              </span>
            </button>

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

        {statusMessage ? (
          <div className="admin-alert" role="status">
            {statusMessage}
          </div>
        ) : null}

        <div
          className={
            sidebarCollapsed
              ? 'blogger-workspace is-sidebar-collapsed'
              : 'blogger-workspace'
          }
        >
          {/* Main Workspace (Left / Center) */}
          <main
            className={
              docAlignMode === 'centered'
                ? 'blogger-main-pane is-centered'
                : 'blogger-main-pane'
            }
          >
            <div className="blogger-title-box">
              <label htmlFor="page-title" className="blogger-title-label">
                Title
              </label>
              <input
                id="page-title"
                type="text"
                className="blogger-title-input"
                placeholder="History"
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value
                  setForm((prev) => ({
                    ...prev,
                    title,
                    slug: slugTouched ? prev.slug : slugify(title, 'page'),
                  }))
                }}
              />
            </div>

            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
              placeholder="सामाजिक विज्ञान (इतिहास) - प्रशिक्षित स्नातक शिक्षक (TGT) या अन्य पेज सामग्री यहाँ लिखें…"
            />
          </main>

          {/* Right Collapsible Sidebar: Page settings */}
          {!sidebarCollapsed ? (
            <aside className="blogger-settings-sidebar" aria-label="Page settings">
              <div className="blogger-settings-head">
                <div className="blogger-settings-title">
                  <SlidersHorizontal size={16} />
                  <h2>Page settings</h2>
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

              {/* Sub-section 1: Search description */}
              <section className="blogger-accordion">
                <button
                  type="button"
                  className="blogger-accordion-trigger"
                  onClick={() => setSearchDescOpen((prev) => !prev)}
                  aria-expanded={searchDescOpen}
                >
                  <span>Search description</span>
                  {searchDescOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {searchDescOpen ? (
                  <div className="blogger-accordion-body">
                    <div className="cms-field">
                      <div className="blogger-field-head">
                        <label htmlFor="page-meta-desc">Meta Description</label>
                        <span className="blogger-char-count">
                          {(form.metaDescription || '').length}/160
                        </span>
                      </div>
                      <textarea
                        id="page-meta-desc"
                        rows={4}
                        maxLength={320}
                        placeholder="Enter search description for Google & Swadhyay search..."
                        value={form.metaDescription}
                        onChange={(event) =>
                          setForm((prev) => ({
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
                        placeholder="Optional custom browser/SEO title"
                        value={form.seoTitle}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, seoTitle: event.target.value }))
                        }
                      />
                    </div>

                    <div className="cms-field">
                      <label htmlFor="page-canonical">Canonical URL</label>
                      <input
                        id="page-canonical"
                        type="url"
                        placeholder={`https://swadhyay.in/#/page/${resolvedSlug}`}
                        value={form.canonicalUrl}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            canonicalUrl: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              {/* Sub-section 2: Options */}
              <section className="blogger-accordion">
                <button
                  type="button"
                  className="blogger-accordion-trigger"
                  onClick={() => setOptionsOpen((prev) => !prev)}
                  aria-expanded={optionsOpen}
                >
                  <span>Options</span>
                  {optionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {optionsOpen ? (
                  <div className="blogger-accordion-body">
                    <div className="cms-field">
                      <label htmlFor="page-comments-opt">Reader comments</label>
                      <select
                        id="page-comments-opt"
                        value={form.allowComments}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            allowComments: event.target.value,
                          }))
                        }
                      >
                        <option value="allow">Allow</option>
                        <option value="disallow_show">
                          Do not allow, show existing
                        </option>
                        <option value="disallow_hide">
                          Do not allow, hide existing
                        </option>
                      </select>
                    </div>

                    <div className="cms-field">
                      <label htmlFor="page-slug">Custom URL Slug (Permalink)</label>
                      <input
                        id="page-slug"
                        type="text"
                        value={form.slug}
                        onChange={(event) => {
                          setSlugTouched(true)
                          setForm((prev) => ({ ...prev, slug: event.target.value }))
                        }}
                      />
                      <span className="blogger-help-text">
                        https://swadhyay.in/#/page/{resolvedSlug}
                      </span>
                    </div>

                    <div className="cms-field">
                      <label htmlFor="page-order">Display Order</label>
                      <input
                        id="page-order"
                        type="number"
                        value={form.order}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, order: event.target.value }))
                        }
                      />
                    </div>

                    <label className="cms-checkbox">
                      <input
                        type="checkbox"
                        checked={form.showInFooter}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            showInFooter: event.target.checked,
                          }))
                        }
                      />
                      <span>Show link in public website footer</span>
                    </label>

                    <button
                      type="button"
                      className="admin-pill-link blogger-nav-sync-btn"
                      disabled={addingToNav}
                      onClick={handleAddToHeaderNav}
                    >
                      <MenuIcon size={14} />
                      <span>
                        {addingToNav
                          ? 'Adding…'
                          : 'Add to Header Navigation Menu'}
                      </span>
                    </button>
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
                  <strong>Live Page Preview</strong>
                  <span className="blogger-help-text">
                    https://swadhyay.in/#/page/{resolvedSlug}
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
                  <h1>{form.title || 'Untitled Page'}</h1>
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

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>Navigation Pages Manager</h1>
          <p>
            Create and edit public navigation &amp; static pages (History, Geography,
            Syllabus, About Us, Contact Us) with the Blogger-style WYSIWYG editor.
          </p>
        </div>
        <div className="admin-quick-actions">
          <button type="button" className="admin-pill-link" onClick={loadPages} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-pill-link"
            onClick={() => openNewPage(true)}
          >
            <Sparkles size={15} />
            <span>New Page (TGT History Sample)</span>
          </button>
          <button
            type="button"
            className="cms-btn-publish-orange"
            onClick={() => openNewPage(false)}
          >
            <FilePlus2 size={15} />
            <span>New Page</span>
          </button>
        </div>
      </section>

      {statusMessage ? (
        <div className="admin-alert" role="status" style={{ marginBottom: 14 }}>
          {statusMessage}
        </div>
      ) : null}

      <section className="admin-card" style={{ marginBottom: 18 }}>
        <div className="cms-card-head" style={{ marginBottom: 12 }}>
          <div>
            <h2>Navigation Menu Pages</h2>
            <p className="cms-muted" style={{ margin: '4px 0 0' }}>
              Same pages &amp; items configured in <strong>Navigation Menu</strong>. Click Edit to
              manage page content in the Blogger-style editor.
            </p>
          </div>
          <div className="admin-quick-actions">
            {MENU_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className={
                  navLocationFilter === loc.id
                    ? 'admin-pill-link is-primary'
                    : 'admin-pill-link'
                }
                onClick={() => setNavLocationFilter(loc.id)}
              >
                {loc.label}
              </button>
            ))}
          </div>
        </div>

        {navTreeRows.length === 0 ? (
          <p className="cms-muted">
            No menu items in {MENU_LOCATIONS.find((l) => l.id === navLocationFilter)?.label}.
          </p>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Menu Item</th>
                  <th>Menu URL</th>
                  <th>Menu Status</th>
                  <th>CMS Page Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {navTreeRows.map((item) => {
                  const derivedSlug = deriveSlugFromMenuItem(item)
                  const linkedPage = pagesBySlug.get(derivedSlug.toLowerCase())
                  const dataLinks = getDataEntryLinksForUrl(item.url)
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ paddingLeft: item.depth * 20 }}>
                          {item.depth > 0 ? '↳ ' : ''}
                          <strong>{item.labelEn}</strong>
                          {item.labelHi && item.labelHi !== item.labelEn ? (
                            <span className="cms-subtext" style={{ marginLeft: 6 }}>
                              ({item.labelHi})
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {editingLinkItemId === item.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              value={editingLinkUrl}
                              onChange={(e) => setEditingLinkUrl(e.target.value)}
                              placeholder="https://... or /page/..."
                              style={{ minWidth: 230, padding: '5px 8px' }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="admin-pill-link is-primary"
                              disabled={savingLink}
                              onClick={() => handleSaveMenuLink(item)}
                            >
                              {savingLink ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="admin-pill-link"
                              disabled={savingLink}
                              onClick={() => {
                                setEditingLinkItemId('')
                                setEditingLinkUrl('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <code>{item.url}</code>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            item.enabled !== false ? 'cms-badge is-published' : 'cms-badge'
                          }
                        >
                          {item.enabled !== false ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        {linkedPage ? (
                          <span
                            className={
                              linkedPage.status === 'published'
                                ? 'cms-badge is-published'
                                : 'cms-badge'
                            }
                          >
                            {linkedPage.status === 'published' ? 'Published' : 'Draft'} (#/page/
                            {linkedPage.slug})
                          </span>
                        ) : (
                          <span className="cms-subtext">Not created yet</span>
                        )}
                      </td>
                      <td>
                        <div className="cms-row-actions">
                          <button
                            type="button"
                            className="admin-pill-link"
                            onClick={() => {
                              setEditingLinkItemId(item.id)
                              setEditingLinkUrl(item.url || '')
                            }}
                            title="Change / paste a different URL for this menu link"
                          >
                            <LinkIcon size={14} />
                            <span>Edit Link</span>
                          </button>
                          <button
                            type="button"
                            className="admin-pill-link"
                            onClick={() => openMenuItemPage(item)}
                            title={
                              linkedPage
                                ? 'Edit CMS page content'
                                : 'Create CMS page content for this menu item'
                            }
                          >
                            <Edit3 size={14} />
                            <span>{linkedPage ? 'Edit Page' : 'Create Page'}</span>
                          </button>
                          {dataLinks.map((dl) => (
                            <a
                              key={dl.href}
                              href={dl.href}
                              className="admin-pill-link"
                              title={`Manage ${dl.label} for ${item.labelEn}`}
                            >
                              {dl.label}
                            </a>
                          ))}
                          {linkedPage?.status === 'published' ? (
                            <a
                              href={`#/page/${linkedPage.slug}`}
                              className="admin-icon-btn"
                              title="View live CMS page"
                            >
                              <ExternalLink size={15} />
                            </a>
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

      <section className="admin-card">
        <div className="cms-card-head" style={{ marginBottom: 12 }}>
          <h2>All Static &amp; Custom CMS Pages</h2>
        </div>
        {pages.length === 0 ? (
          <p className="cms-muted">
            {loading
              ? 'Loading pages…'
              : 'No pages found in Firestore yet. Click "New Page" or "New Page (TGT History Sample)" to create one.'}
          </p>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Comments</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td>
                      <strong>{page.title}</strong>
                    </td>
                    <td>
                      <code>#/page/{page.slug}</code>
                    </td>
                    <td>
                      <span
                        className={
                          page.status === 'published' ? 'cms-badge is-published' : 'cms-badge'
                        }
                      >
                        {page.status || 'draft'}
                      </span>
                    </td>
                    <td>{page.allowComments === 'allow' ? 'Allowed' : 'Disabled'}</td>
                    <td>{formatDateTime(page.updatedAt || page.createdAt)}</td>
                    <td>
                      <div className="cms-row-actions">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => openEditPage(page)}
                          title="Edit page"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleToggleStatus(page)}
                          title={page.status === 'published' ? 'Unpublish (move to draft)' : 'Publish page'}
                        >
                          {page.status === 'published' ? <EyeOff size={15} /> : <CheckCircle2 size={15} />}
                        </button>
                        {page.status === 'published' ? (
                          <a
                            href={`#/page/${page.slug}`}
                            className="admin-icon-btn"
                            title="View live page"
                          >
                            <ExternalLink size={15} />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleDelete(page)}
                          title="Delete page"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
