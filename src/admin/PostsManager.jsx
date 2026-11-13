import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Code2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FilePlus2,
  History,
  ImagePlus,
  Monitor,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  bulkDeletePosts,
  bulkUpdatePostsStatus,
  deletePostPermanently,
  discardPostDraftBuffer,
  duplicatePost,
  listCategories,
  listPostRevisions,
  listPosts,
  listTags,
  movePostToTrash,
  restorePostFromTrash,
  savePost,
} from '../services/cmsService.js'
import { formatDateTime, slugify } from '../utils/slugify.js'
import { postNeedsUniversalFrame, validatePostCode } from '../utils/postValidator.js'
import UniversalPostRenderer from '../components/UniversalPostRenderer.jsx'
import RichTextEditor from './components/RichTextEditor.jsx'
import MediaLibrary from './MediaLibrary.jsx'

const BUILTIN_CATEGORIES = [
  { slug: 'history', name: 'History' },
  { slug: 'geography', name: 'Geography' },
  { slug: 'gk', name: 'GK' },
  { slug: 'affairs', name: 'Current Affairs' },
  { slug: 'ncert', name: 'NCERT' },
  { slug: 'pyq', name: 'PYQ' },
]

function buildEmptyForm(user) {
  return {
    title: '',
    slug: '',
    content: '',
    customCss: '',
    editorMode: 'visual',
    interactiveTool: false,
    shortDescription: '',
    featuredImage: '',
    categories: [],
    tags: [],
    author: user?.displayName || user?.email || 'Admin',
    showAuthor: false,
    showDate: true,
    seoTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    socialImage: '',
    commentsEnabled: true,
    featured: false,
    scheduledFor: '',
  }
}

function formFromPost(post, source) {
  const src = source || post
  const inferredMode =
    src.editorMode ||
    (postNeedsUniversalFrame(src.content || '', src.customCss || '') ? 'html_css' : 'visual')
  return {
    title: src.title || '',
    slug: src.slug || '',
    content: src.content || '',
    customCss: src.customCss || '',
    editorMode: inferredMode,
    interactiveTool: Boolean(src.interactiveTool),
    shortDescription: src.shortDescription || '',
    featuredImage: src.featuredImage || '',
    categories: Array.isArray(src.categories) ? src.categories : src.category ? [src.category] : [],
    tags: Array.isArray(src.tags) ? src.tags : [],
    author: src.author || post.author || 'Admin',
    showAuthor: Boolean(src.showAuthor),
    showDate: src.showDate !== false,
    seoTitle: src.seoTitle || '',
    metaDescription: src.metaDescription || '',
    canonicalUrl: src.canonicalUrl || '',
    socialImage: src.socialImage || '',
    commentsEnabled: src.commentsEnabled !== false,
    featured: Boolean(src.featured),
    scheduledFor: src.scheduledFor || '',
  }
}

export default function PostsManager() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(true)

  // List filters & bulk state
  const [statusTab, setStatusTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  // Editor state
  const [editingPost, setEditingPost] = useState(null) // null = list, {} = new, post = existing
  const [form, setForm] = useState(() => buildEmptyForm(user))
  const [slugTouched, setSlugTouched] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [autosaveState, setAutosaveState] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [revisionsOpen, setRevisionsOpen] = useState(false)
  const [revisions, setRevisions] = useState([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  const [mediaPickerTarget, setMediaPickerTarget] = useState(null)
  const [previewUserMode, setPreviewUserMode] = useState(null) // null | 'desktop' | 'mobile'

  const codeIssues = useMemo(
    () => validatePostCode(form.content, form.customCss),
    [form.content, form.customCss],
  )

  const dirtyRef = useRef(false)
  const formRef = useRef(form)
  const editingPostRef = useRef(editingPost)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    editingPostRef.current = editingPost
  }, [editingPost])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [postList, catList, tagList] = await Promise.all([
        listPosts(),
        listCategories(),
        listTags(),
      ])
      setPosts(postList)
      setCategories(catList)
      setAllTags(tagList)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([listPosts(), listCategories(), listTags()])
      .then(([postList, catList, tagList]) => {
        if (!active) return
        setPosts(postList)
        setCategories(catList)
        setAllTags(tagList)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const mergedCategories = useMemo(() => {
    const map = new Map()
    for (const c of BUILTIN_CATEGORIES) map.set(c.slug, c)
    for (const c of categories) {
      if (c.slug) map.set(c.slug, { slug: c.slug, name: c.name || c.slug })
    }
    return [...map.values()]
  }, [categories])

  function updateForm(updater) {
    dirtyRef.current = true
    setForm(updater)
  }

  function openNewPost() {
    dirtyRef.current = false
    setEditingPost({})
    setSlugTouched(false)
    setForm(buildEmptyForm(user))
    setTagInput('')
    setAutosaveState('')
    setStatusMessage('')
    setRevisionsOpen(false)
  }

  function openEditPost(post) {
    dirtyRef.current = false
    setEditingPost(post)
    setSlugTouched(true)
    const loadFromDraft = Boolean(post.hasUnpublishedChanges && post.draftSnapshot)
    setForm(formFromPost(post, loadFromDraft ? post.draftSnapshot : post))
    setTagInput('')
    setAutosaveState(
      loadFromDraft ? 'Loaded unpublished draft edits (live post unchanged).' : '',
    )
    setStatusMessage('')
    setRevisionsOpen(false)
  }

  // Periodic Autosave (every 15 seconds when edited)
  useEffect(() => {
    if (editingPost === null) return undefined
    const timer = window.setInterval(async () => {
      if (!dirtyRef.current) return
      const currentForm = formRef.current
      const currentPost = editingPostRef.current
      if (!currentForm.title.trim() && !currentForm.content.trim()) return

      setAutosaveState('Autosaving…')
      try {
        const res = await savePost({
          id: currentPost?.id || null,
          existingPost: currentPost?.id ? currentPost : null,
          data: currentForm,
          user,
          mode: 'autosave',
        })
        dirtyRef.current = false
        setEditingPost((prev) => ({
          ...(prev || {}),
          id: res.id,
          slug: res.slug,
          status: prev?.status || 'draft',
          hasUnpublishedChanges: res.savedToDraftBuffer ? true : prev?.hasUnpublishedChanges,
        }))
        setAutosaveState(
          res.savedToDraftBuffer
            ? `Draft edits autosaved (${new Date().toLocaleTimeString()}) — live version untouched`
            : `Autosaved at ${new Date().toLocaleTimeString()}`,
        )
      } catch {
        setAutosaveState('Autosave failed')
      }
    }, 15000)

    return () => window.clearInterval(timer)
  }, [editingPost, user])

  async function handleSave(mode) {
    if (!form.title.trim()) {
      setStatusMessage('Please enter a post title before saving.')
      return
    }
    if (mode === 'schedule' && !form.scheduledFor) {
      setStatusMessage('Choose a schedule date & time first.')
      return
    }

    setSaving(true)
    setStatusMessage('')
    setAutosaveState('')
    try {
      const res = await savePost({
        id: editingPost?.id || null,
        existingPost: editingPost?.id ? editingPost : null,
        data: form,
        user,
        mode,
      })
      dirtyRef.current = false
      const nextStatus =
        mode === 'publish'
          ? 'published'
          : mode === 'schedule'
            ? 'scheduled'
            : editingPost?.status === 'published'
              ? 'published'
              : 'draft'
      setEditingPost((prev) => ({
        ...(prev || {}),
        id: res.id,
        slug: res.slug,
        status: nextStatus,
        hasUnpublishedChanges: res.savedToDraftBuffer,
      }))
      await loadData()
      setStatusMessage(
        res.savedToDraftBuffer
          ? 'Saved to unpublished draft buffer. Live published post remains unchanged.'
          : mode === 'publish'
            ? 'Post published live!'
            : mode === 'schedule'
              ? 'Post scheduled.'
              : 'Draft saved.',
      )
    } catch (error) {
      setStatusMessage(error?.message || 'Failed to save post.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDiscardDraftBuffer() {
    if (!editingPost?.id) return
    if (!window.confirm('Discard unpublished draft edits and revert editor to the live published version?')) {
      return
    }
    await discardPostDraftBuffer(editingPost.id)
    const freshPosts = await listPosts()
    setPosts(freshPosts)
    const updated = freshPosts.find((p) => p.id === editingPost.id)
    if (updated) openEditPost(updated)
  }

  async function openRevisions() {
    if (!editingPost?.id) return
    setRevisionsOpen(true)
    setLoadingRevisions(true)
    try {
      const list = await listPostRevisions(editingPost.id)
      setRevisions(list)
    } finally {
      setLoadingRevisions(false)
    }
  }

  function restoreRevision(rev) {
    updateForm((prev) => ({
      ...prev,
      title: rev.title || prev.title,
      content: rev.content ?? prev.content,
      shortDescription: rev.shortDescription ?? prev.shortDescription,
    }))
    setRevisionsOpen(false)
    setStatusMessage('Revision loaded into editor. Save or Publish to apply.')
  }

  function toggleCategory(slug) {
    updateForm((prev) => {
      const exists = prev.categories.includes(slug)
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((c) => c !== slug)
          : [...prev.categories, slug],
      }
    })
  }

  function addTagFromInput(raw) {
    const clean = String(raw || '').trim()
    if (!clean) return
    updateForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(clean) ? prev.tags : [...prev.tags, clean],
    }))
    setTagInput('')
  }

  function removeTag(tagName) {
    updateForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagName),
    }))
  }

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return posts.filter((post) => {
      const st = post.status || 'draft'
      if (statusTab === 'all' && st === 'trashed') return false
      if (statusTab !== 'all' && st !== statusTab) return false
      if (categoryFilter) {
        const postCats = Array.isArray(post.categories) ? post.categories : [post.category]
        if (!postCats.includes(categoryFilter)) return false
      }
      if (q) {
        const hay = `${post.title || ''} ${post.slug || ''} ${(post.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [posts, statusTab, categoryFilter, searchQuery])

  const tabCounts = useMemo(() => {
    const c = { all: 0, published: 0, draft: 0, scheduled: 0, trashed: 0 }
    for (const p of posts) {
      const st = p.status || 'draft'
      if (st !== 'trashed') c.all += 1
      if (c[st] !== undefined) c[st] += 1
    }
    return c
  }, [posts])

  async function handleBulkAction(action) {
    if (!selectedIds.length) return
    if (action === 'delete') {
      if (!window.confirm(`Permanently delete ${selectedIds.length} selected posts?`)) return
      await bulkDeletePosts(selectedIds)
    } else {
      await bulkUpdatePostsStatus(selectedIds, action)
    }
    setSelectedIds([])
    await loadData()
  }

  if (editingPost !== null) {
    return (
      <>
        <section className="admin-page-head">
          <div className="cms-head-left">
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => {
                setEditingPost(null)
                loadData()
              }}
            >
              <ArrowLeft size={15} />
              <span>All Posts</span>
            </button>
            <div>
              <h1>{editingPost.id ? 'Edit Post' : 'New Post'}</h1>
              <p>
                Permalink: <code>#/post/{form.slug || slugify(form.title, 'post')}</code>
                {autosaveState ? ` · ${autosaveState}` : ''}
              </p>
            </div>
          </div>

          <div className="admin-quick-actions">
            <button
              type="button"
              className="admin-pill-link"
              onClick={() => setPreviewUserMode('desktop')}
            >
              <Eye size={15} />
              <span>Preview As User</span>
            </button>
            {editingPost.id ? (
              <button type="button" className="admin-pill-link" onClick={openRevisions}>
                <History size={15} />
                <span>Revisions</span>
              </button>
            ) : null}
            <button
              type="button"
              className="admin-pill-link"
              disabled={saving}
              onClick={() => handleSave('draft')}
            >
              <Save size={15} />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              className="admin-pill-link is-primary"
              disabled={saving}
              onClick={() => handleSave('publish')}
            >
              <CheckCircle2 size={15} />
              <span>{editingPost.status === 'published' ? 'Update Published' : 'Publish'}</span>
            </button>
          </div>
        </section>

        {editingPost.hasUnpublishedChanges ? (
          <div className="admin-alert cms-alert-row" role="status">
            <span>
              You are editing unpublished draft changes. The live published post has not been
              overwritten yet.
            </span>
            <button type="button" className="admin-pill-link" onClick={handleDiscardDraftBuffer}>
              Discard Draft Edits
            </button>
          </div>
        ) : null}

        {statusMessage ? (
          <div className="admin-alert" role="status">
            {statusMessage}
          </div>
        ) : null}

        {revisionsOpen ? (
          <section className="admin-card">
            <div className="cms-card-head">
              <h2>Revision History</h2>
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => setRevisionsOpen(false)}
              >
                Close
              </button>
            </div>
            {loadingRevisions ? (
              <p className="cms-muted">Loading revisions…</p>
            ) : revisions.length === 0 ? (
              <p className="cms-muted">No saved revisions yet.</p>
            ) : (
              <ul className="admin-info-list">
                {revisions.map((rev) => (
                  <li key={rev.id} className="admin-info-row">
                    <div>
                      <strong>{rev.title || 'Untitled'}</strong>
                      <div className="cms-subtext">
                        {rev.note || rev.status} · {rev.savedBy} · {formatDateTime(rev.savedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-pill-link"
                      onClick={() => restoreRevision(rev)}
                    >
                      <RotateCcw size={14} />
                      <span>Restore Version</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <div className="cms-editor-layout">
          <div className="cms-editor-main">
            <div className="admin-card">
              <div className="cms-field">
                <label htmlFor="post-title">Post Title</label>
                <input
                  id="post-title"
                  type="text"
                  className="cms-title-input"
                  placeholder="Enter article title…"
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value
                    updateForm((prev) => ({
                      ...prev,
                      title,
                      slug: slugTouched ? prev.slug : slugify(title, 'post'),
                    }))
                  }}
                />
              </div>

              <div className="cms-editor-mode-bar">
                <div className="rte-mode-tabs" role="tablist" aria-label="Post Editor Mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={form.editorMode !== 'html_css'}
                    className={
                      form.editorMode !== 'html_css'
                        ? 'rte-mode-btn is-active'
                        : 'rte-mode-btn'
                    }
                    onClick={() => {
                      if (
                        form.editorMode === 'html_css' &&
                        postNeedsUniversalFrame(form.content, form.customCss)
                      ) {
                        const ok = window.confirm(
                          'This post contains custom <style>, <script>, or interactive form tags. Switching to Visual Rich Text mode may strip those tags. Continue?',
                        )
                        if (!ok) return
                      }
                      updateForm((prev) => ({ ...prev, editorMode: 'visual' }))
                    }}
                  >
                    Rich Text (Visual)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={form.editorMode === 'html_css'}
                    className={
                      form.editorMode === 'html_css'
                        ? 'rte-mode-btn is-active'
                        : 'rte-mode-btn'
                    }
                    onClick={() => updateForm((prev) => ({ ...prev, editorMode: 'html_css' }))}
                  >
                    <Code2 size={14} />
                    <span>Code Studio (HTML + CSS + Live Preview)</span>
                  </button>
                </div>
                <label
                  className="cms-checkbox"
                  title="When ON, forces isolated iframe rendering even for simple HTML"
                  style={{ margin: 0 }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form.interactiveTool)}
                    onChange={(event) =>
                      updateForm((prev) => ({
                        ...prev,
                        interactiveTool: event.target.checked,
                      }))
                    }
                  />
                  <span>Interactive Tool</span>
                </label>
                <button
                  type="button"
                  className="admin-pill-link"
                  onClick={() => setPreviewUserMode('desktop')}
                >
                  <Eye size={14} />
                  <span>Preview As User</span>
                </button>
              </div>

              {codeIssues.length > 0 ? (
                <div className="cms-validation-panel" role="status">
                  <div className="cms-validation-head">
                    <AlertTriangle size={15} />
                    <strong>
                      Pre-Publish Validation ({codeIssues.length}{' '}
                      {codeIssues.length === 1 ? 'warning' : 'warnings'})
                    </strong>
                  </div>
                  <ul className="cms-validation-list">
                    {codeIssues.map((issue, idx) => (
                      <li key={idx} className={`is-${issue.level}`}>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {form.editorMode === 'html_css' ? (
                <div className="cms-code-studio">
                  <div className="cms-code-panes">
                    <div className="cms-code-box">
                      <div className="cms-code-box-head">
                        <label htmlFor="post-html-code">Post HTML</label>
                        <span>Structure, content, forms &amp; &lt;script&gt;</span>
                      </div>
                      <textarea
                        id="post-html-code"
                        className="cms-code-textarea"
                        spellCheck={false}
                        placeholder="<h2>Interactive Post</h2>&#10;<p>Write HTML, tables, forms, or &lt;script&gt;...</p>"
                        value={form.content}
                        onChange={(event) =>
                          updateForm((prev) => ({ ...prev, content: event.target.value }))
                        }
                      />
                    </div>

                    <div className="cms-code-box">
                      <div className="cms-code-box-head">
                        <label htmlFor="post-custom-css">Post Custom CSS</label>
                        <span>Scoped to this post only</span>
                      </div>
                      <textarea
                        id="post-custom-css"
                        className="cms-code-textarea is-css"
                        spellCheck={false}
                        placeholder=".my-card { padding: 16px; border-radius: 12px; background: #fff7ed; }"
                        value={form.customCss}
                        onChange={(event) =>
                          updateForm((prev) => ({ ...prev, customCss: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="cms-live-preview-pane">
                    <div className="cms-code-box-head">
                      <strong>Real-Time Live Preview</strong>
                      <span>Exact Universal Post Renderer output</span>
                    </div>
                    <div className="cms-live-preview-surface">
                      <UniversalPostRenderer
                        html={form.content}
                        customCss={form.customCss}
                        interactiveTool={Boolean(form.interactiveTool)}
                        title={form.title || 'Live Preview'}
                        minHeight={280}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => updateForm((prev) => ({ ...prev, content: html }))}
                />
              )}
            </div>
          </div>

          <aside className="cms-editor-side">
            <div className="admin-card cms-side-card">
              <h2>Publishing &amp; Schedule</h2>
              <div className="cms-field">
                <label htmlFor="post-slug">Custom Permalink Slug</label>
                <input
                  id="post-slug"
                  type="text"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true)
                    updateForm((prev) => ({ ...prev, slug: event.target.value }))
                  }}
                />
              </div>
              <div className="cms-field">
                <label htmlFor="post-schedule">Schedule Date &amp; Time</label>
                <input
                  id="post-schedule"
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, scheduledFor: event.target.value }))
                  }
                />
              </div>
              <button
                type="button"
                className="admin-pill-link"
                disabled={saving}
                onClick={() => handleSave('schedule')}
              >
                <CalendarClock size={15} />
                <span>Schedule Post</span>
              </button>
              <label className="cms-checkbox">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, featured: event.target.checked }))
                  }
                />
                <span>Mark as Featured Post</span>
              </label>
              <label className="cms-checkbox">
                <input
                  type="checkbox"
                  checked={form.commentsEnabled}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, commentsEnabled: event.target.checked }))
                  }
                />
                <span>Allow Reader Comments</span>
              </label>
            </div>

            <div className="admin-card cms-side-card">
              <h2>Categories &amp; Labels</h2>
              <div className="cms-checklist">
                {mergedCategories.map((cat) => (
                  <label key={cat.slug} className="cms-checkbox">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(cat.slug)}
                      onChange={() => toggleCategory(cat.slug)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>

              <div className="cms-field">
                <label htmlFor="post-tags">Tags / Labels</label>
                <div className="cms-inline-add">
                  <input
                    id="post-tags"
                    type="text"
                    placeholder="Add tag & press Enter"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault()
                        addTagFromInput(tagInput.replace(/,$/, ''))
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="admin-pill-link"
                    onClick={() => addTagFromInput(tagInput)}
                  >
                    Add
                  </button>
                </div>
                {form.tags.length > 0 ? (
                  <div className="cms-tag-cloud">
                    {form.tags.map((tagName) => (
                      <span key={tagName} className="cms-tag-pill">
                        <span>{tagName}</span>
                        <button type="button" onClick={() => removeTag(tagName)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {allTags.length > 0 ? (
                  <div className="rte-math-samples">
                    {allTags.slice(0, 8).map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="cms-chip-btn"
                        onClick={() => addTagFromInput(tag.name)}
                      >
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="admin-card cms-side-card">
              <h2>Featured Image &amp; Summary</h2>
              <div className="cms-field">
                <label htmlFor="post-thumb">Featured Image URL</label>
                <div className="cms-inline-add">
                  <input
                    id="post-thumb"
                    type="url"
                    placeholder="https://notes.swadhyay.in/..."
                    value={form.featuredImage}
                    onChange={(event) =>
                      updateForm((prev) => ({ ...prev, featuredImage: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-pill-link"
                    onClick={() => setMediaPickerTarget('featuredImage')}
                    title="Choose from R2 Media Library"
                  >
                    <ImagePlus size={14} />
                    <span>Library</span>
                  </button>
                </div>
              </div>
              {form.featuredImage ? (
                <img src={form.featuredImage} alt="" className="cms-thumb-preview" />
              ) : null}
              <div className="cms-field">
                <label htmlFor="post-excerpt">Short Description</label>
                <textarea
                  id="post-excerpt"
                  rows={3}
                  placeholder="Brief summary shown on cards and search results"
                  value={form.shortDescription}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, shortDescription: event.target.value }))
                  }
                />
              </div>
              <div className="cms-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.showDate !== false}
                    onChange={(event) =>
                      updateForm((prev) => ({ ...prev, showDate: event.target.checked }))
                    }
                  />
                  <span>पोस्ट करने का दिनांक पब्लिश करें (Show Publish Date)</span>
                </label>
              </div>
              <div className="cms-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.showAuthor)}
                    onChange={(event) =>
                      updateForm((prev) => ({ ...prev, showAuthor: event.target.checked }))
                    }
                  />
                  <span>लेखक (Author) का नाम पब्लिश करें</span>
                </label>
              </div>
            </div>

            <div className="admin-card cms-side-card">
              <h2>SEO &amp; Social</h2>
              <div className="cms-field">
                <label htmlFor="post-seo-title">SEO Title</label>
                <input
                  id="post-seo-title"
                  type="text"
                  value={form.seoTitle}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, seoTitle: event.target.value }))
                  }
                />
              </div>
              <div className="cms-field">
                <label htmlFor="post-meta-desc">
                  Meta Description ({form.metaDescription.length}/160)
                </label>
                <textarea
                  id="post-meta-desc"
                  rows={3}
                  value={form.metaDescription}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, metaDescription: event.target.value }))
                  }
                />
              </div>
              <div className="cms-field">
                <label htmlFor="post-canonical">Canonical URL</label>
                <input
                  id="post-canonical"
                  type="url"
                  value={form.canonicalUrl}
                  onChange={(event) =>
                    updateForm((prev) => ({ ...prev, canonicalUrl: event.target.value }))
                  }
                />
              </div>
              <div className="cms-field">
                <label htmlFor="post-og-image">Social Sharing Image URL</label>
                <div className="cms-inline-add">
                  <input
                    id="post-og-image"
                    type="url"
                    placeholder="https://notes.swadhyay.in/..."
                    value={form.socialImage}
                    onChange={(event) =>
                      updateForm((prev) => ({ ...prev, socialImage: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="admin-pill-link"
                    onClick={() => setMediaPickerTarget('socialImage')}
                    title="Choose from R2 Media Library"
                  >
                    <ImagePlus size={14} />
                    <span>Library</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {mediaPickerTarget ? (
          <div className="media-modal-backdrop" role="dialog" aria-modal="true">
            <div className="media-modal-card is-wide">
              <div className="admin-panel-head">
                <h2>
                  {mediaPickerTarget === 'socialImage'
                    ? 'Select Social Sharing Image'
                    : 'Select Featured Image'}
                </h2>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setMediaPickerTarget(null)}
                  aria-label="Close media picker"
                >
                  <X size={16} />
                </button>
              </div>
              <MediaLibrary
                compact
                onSelectMedia={(item) => {
                  const targetField = mediaPickerTarget
                  updateForm((prev) => ({ ...prev, [targetField]: item.url }))
                  setMediaPickerTarget(null)
                }}
              />
            </div>
          </div>
        ) : null}

        {previewUserMode ? (
          <div className="media-modal-backdrop" role="dialog" aria-modal="true">
            <div
              className={
                previewUserMode === 'mobile'
                  ? 'media-modal-card blogger-preview-modal is-mobile'
                  : 'media-modal-card is-wide blogger-preview-modal'
              }
            >
              <div className="blogger-preview-header">
                <div>
                  <strong>Preview As User — End-User Post View</strong>
                  <span className="blogger-help-text">
                    https://swadhyay.in/#/post/{form.slug || slugify(form.title, 'post')}
                  </span>
                </div>
                <div className="admin-quick-actions">
                  <button
                    type="button"
                    className={
                      previewUserMode === 'desktop'
                        ? 'admin-pill-link is-primary'
                        : 'admin-pill-link'
                    }
                    onClick={() => setPreviewUserMode('desktop')}
                  >
                    <Monitor size={14} />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    className={
                      previewUserMode === 'mobile'
                        ? 'admin-pill-link is-primary'
                        : 'admin-pill-link'
                    }
                    onClick={() => setPreviewUserMode('mobile')}
                  >
                    <Smartphone size={14} />
                    <span>Mobile</span>
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => setPreviewUserMode(null)}
                    aria-label="Close Preview As User"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="blogger-preview-body">
                <article className="panel article-panel" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
                  <header className="article-head">
                    <h1>{form.title || 'Untitled Post'}</h1>
                    <p className="article-meta">
                      {form.showAuthor && form.author ? <span>{form.author}</span> : null}
                      {form.showDate !== false ? <span>Preview Mode</span> : null}
                    </p>
                  </header>
                  {form.featuredImage ? (
                    <img src={form.featuredImage} alt="" className="article-cover" />
                  ) : null}
                  <UniversalPostRenderer
                    html={form.content || '<p>No content written yet.</p>'}
                    customCss={form.customCss || ''}
                    interactiveTool={Boolean(form.interactiveTool)}
                    title={form.title || 'Preview As User'}
                    minHeight={300}
                  />
                </article>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>Posts Manager</h1>
          <p>
            Write, schedule, revise, and publish study articles with Blogger-style rich editing and
            KaTeX equations.
          </p>
        </div>
        <div className="admin-quick-actions">
          <button type="button" className="admin-pill-link" onClick={loadData} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button type="button" className="admin-pill-link is-primary" onClick={openNewPost}>
            <FilePlus2 size={15} />
            <span>New Post</span>
          </button>
        </div>
      </section>

      <section className="admin-card">
        <div className="cms-toolbar-bar">
          <div className="cms-status-tabs" role="tablist">
            {[
              ['all', `All (${tabCounts.all})`],
              ['published', `Published (${tabCounts.published})`],
              ['draft', `Drafts (${tabCounts.draft})`],
              ['scheduled', `Scheduled (${tabCounts.scheduled})`],
              ['trashed', `Trash (${tabCounts.trashed})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={statusTab === key}
                className={statusTab === key ? 'cms-tab-btn is-active' : 'cms-tab-btn'}
                onClick={() => {
                  setStatusTab(key)
                  setSelectedIds([])
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="cms-filter-group">
            <label className="admin-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search posts…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <select
              className="rte-select"
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All Categories</option>
              {mergedCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="cms-bulk-bar">
            <span>{selectedIds.length} selected</span>
            <div className="admin-quick-actions">
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => handleBulkAction('published')}
              >
                Publish
              </button>
              <button
                type="button"
                className="admin-pill-link"
                onClick={() => handleBulkAction('draft')}
              >
                Move to Draft
              </button>
              {statusTab !== 'trashed' ? (
                <button
                  type="button"
                  className="admin-pill-link"
                  onClick={() => handleBulkAction('trashed')}
                >
                  Move to Trash
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-pill-link"
                  onClick={() => handleBulkAction('delete')}
                >
                  Delete Permanently
                </button>
              )}
            </div>
          </div>
        ) : null}

        {filteredPosts.length === 0 ? (
          <p className="cms-muted">
            {loading
              ? 'Loading posts from Firestore…'
              : 'No posts match the current filter. Click "New Post" to publish your first article.'}
          </p>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={
                        filteredPosts.length > 0 && selectedIds.length === filteredPosts.length
                      }
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked ? filteredPosts.map((p) => p.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Title</th>
                  <th>Categories</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => {
                  const checked = selectedIds.includes(post.id)
                  const cats = Array.isArray(post.categories) ? post.categories : []
                  return (
                    <tr key={post.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Select ${post.title}`}
                          onChange={(event) =>
                            setSelectedIds((prev) =>
                              event.target.checked
                                ? [...prev, post.id]
                                : prev.filter((id) => id !== post.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <strong>{post.title}</strong>
                        <div className="cms-subtext">
                          #/post/{post.slug}
                          {post.hasUnpublishedChanges ? ' · Unsaved draft edits' : ''}
                        </div>
                      </td>
                      <td>{cats.length ? cats.join(', ') : '—'}</td>
                      <td>
                        <span
                          className={
                            post.status === 'published'
                              ? 'cms-badge is-published'
                              : post.status === 'trashed'
                                ? 'cms-badge is-trashed'
                                : 'cms-badge'
                          }
                        >
                          {post.status || 'draft'}
                        </span>
                      </td>
                      <td>{formatDateTime(post.updatedAt || post.createdAt)}</td>
                      <td>
                        <div className="cms-row-actions">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => openEditPost(post)}
                            title="Edit post"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={async () => {
                              await duplicatePost(post, user)
                              await loadData()
                            }}
                            title="Duplicate post"
                          >
                            <Copy size={15} />
                          </button>
                          {post.status === 'published' ? (
                            <a
                              href={`#/post/${post.slug}`}
                              className="admin-icon-btn"
                              title="View live post"
                            >
                              <ExternalLink size={15} />
                            </a>
                          ) : null}
                          {post.status === 'trashed' ? (
                            <>
                              <button
                                type="button"
                                className="admin-icon-btn"
                                onClick={async () => {
                                  await restorePostFromTrash(post)
                                  await loadData()
                                }}
                                title="Restore post"
                              >
                                <RotateCcw size={15} />
                              </button>
                              <button
                                type="button"
                                className="admin-icon-btn"
                                onClick={async () => {
                                  if (window.confirm(`Permanently delete "${post.title}"?`)) {
                                    await deletePostPermanently(post.id)
                                    await loadData()
                                  }
                                }}
                                title="Delete permanently"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-icon-btn"
                              onClick={async () => {
                                await movePostToTrash(post)
                                await loadData()
                              }}
                              title="Move to trash"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
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
    </>
  )
}
