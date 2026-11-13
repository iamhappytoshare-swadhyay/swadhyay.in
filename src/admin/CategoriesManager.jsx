import { useEffect, useState } from 'react'
import { Edit3, FolderPlus, Plus, RefreshCw, Tag, Trash2 } from 'lucide-react'
import {
  deleteCategory,
  deleteTag,
  listCategories,
  listTags,
  saveCategory,
  saveTag,
} from '../services/cmsService.js'
import { slugify } from '../utils/slugify.js'

const ICON_OPTIONS = [
  { value: 'book', label: 'Book' },
  { value: 'landmark', label: 'History / Landmark' },
  { value: 'globe', label: 'Geography / Globe' },
  { value: 'bulb', label: 'GK / Lightbulb' },
  { value: 'news', label: 'Current Affairs' },
  { value: 'file', label: 'Papers / Notes' },
  { value: 'trophy', label: 'Exams / Trophy' },
]

const TONE_OPTIONS = ['red', 'amber', 'teal', 'violet', 'blue', 'navy']

const EMPTY_CATEGORY = {
  name: '',
  slug: '',
  description: '',
  icon: 'book',
  tone: 'navy',
  parentId: '',
  order: 0,
  showOnPublic: true,
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_CATEGORY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  async function loadAll() {
    setLoading(true)
    try {
      const [catList, tagList] = await Promise.all([listCategories(), listTags()])
      setCategories(catList)
      setTags(tagList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listCategories(), listTags()])
      .then(([catList, tagList]) => {
        if (!active) return
        setCategories(catList)
        setTags(tagList)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function startEdit(cat) {
    setEditingId(cat.id)
    setSlugTouched(true)
    setForm({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      icon: cat.icon || 'book',
      tone: cat.tone || 'navy',
      parentId: cat.parentId || '',
      order: cat.order ?? 0,
      showOnPublic: cat.showOnPublic !== false,
    })
  }

  function resetForm() {
    setEditingId(null)
    setSlugTouched(false)
    setForm(EMPTY_CATEGORY)
  }

  async function handleSaveCategory(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setStatusMessage('')
    try {
      await saveCategory({ id: editingId, data: form })
      resetForm()
      await loadAll()
      setStatusMessage(editingId ? 'Category updated.' : 'Category created.')
    } catch (error) {
      setStatusMessage(error?.message || 'Failed to save category.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCategory(cat) {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return
    await deleteCategory(cat.id)
    if (editingId === cat.id) resetForm()
    await loadAll()
  }

  async function handleAddTag(event) {
    event.preventDefault()
    if (!newTagName.trim()) return
    await saveTag(newTagName.trim())
    setNewTagName('')
    const tagList = await listTags()
    setTags(tagList)
  }

  async function handleDeleteTag(tag) {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return
    await deleteTag(tag.id)
    const tagList = await listTags()
    setTags(tagList)
  }

  const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  return (
    <>
      <section className="admin-page-head">
        <div>
          <h1>Categories &amp; Tags Manager</h1>
          <p>
            Organize subjects, classes, and exam tracks. Categories marked public appear
            automatically in the sidebar and Post Editor.
          </p>
        </div>
        <button type="button" className="admin-pill-link" onClick={loadAll} disabled={loading}>
          <RefreshCw size={15} />
          <span>{loading ? 'Loading…' : 'Refresh'}</span>
        </button>
      </section>

      {statusMessage ? (
        <div className="admin-alert" role="status">
          {statusMessage}
        </div>
      ) : null}

      <div className="admin-grid-2">
        <section className="admin-card">
          <h2>{editingId ? 'Edit Category' : 'Add Category'}</h2>
          <form className="cms-form" onSubmit={handleSaveCategory}>
            <div className="cms-field">
              <label htmlFor="cat-name">Category Name</label>
              <input
                id="cat-name"
                type="text"
                required
                placeholder="e.g. Geography, NCERT Class 12, EMRS"
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value
                  setForm((prev) => ({
                    ...prev,
                    name,
                    slug: slugTouched ? prev.slug : slugify(name, 'category'),
                  }))
                }}
              />
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label htmlFor="cat-slug">URL Slug</label>
                <input
                  id="cat-slug"
                  type="text"
                  placeholder="auto-generated-slug"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true)
                    setForm((prev) => ({ ...prev, slug: event.target.value }))
                  }}
                />
              </div>
              <div className="cms-field">
                <label htmlFor="cat-order">Display Order</label>
                <input
                  id="cat-order"
                  type="number"
                  value={form.order}
                  onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
                />
              </div>
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label htmlFor="cat-parent">Parent Category</label>
                <select
                  id="cat-parent"
                  value={form.parentId}
                  onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.target.value }))}
                >
                  <option value="">None (Top-level)</option>
                  {categories
                    .filter((c) => c.id !== editingId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="cms-field">
                <label htmlFor="cat-icon">Icon / Image URL</label>
                <select
                  id="cat-icon"
                  value={ICON_OPTIONS.some((opt) => opt.value === form.icon) ? form.icon : 'custom'}
                  onChange={(event) => {
                    if (event.target.value !== 'custom') {
                      setForm((prev) => ({ ...prev, icon: event.target.value }))
                    }
                  }}
                >
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="custom">Custom Icon URL</option>
                </select>
              </div>
            </div>

            <div className="cms-field-row">
              <div className="cms-field">
                <label htmlFor="cat-tone">Color Tone</label>
                <select
                  id="cat-tone"
                  value={form.tone}
                  onChange={(event) => setForm((prev) => ({ ...prev, tone: event.target.value }))}
                >
                  {TONE_OPTIONS.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cms-field">
                <label htmlFor="cat-icon-custom">Custom Icon Key or URL</label>
                <input
                  id="cat-icon-custom"
                  type="text"
                  value={form.icon}
                  onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                  placeholder="book or https://..."
                />
              </div>
            </div>

            <div className="cms-field">
              <label htmlFor="cat-desc">Description</label>
              <textarea
                id="cat-desc"
                rows={2}
                placeholder="Short SEO description for this subject or exam category"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <label className="cms-checkbox">
              <input
                type="checkbox"
                checked={form.showOnPublic}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, showOnPublic: event.target.checked }))
                }
              />
              <span>Show in public website categories sidebar</span>
            </label>

            <div className="cms-form-actions">
              <button type="submit" className="admin-pill-link is-primary" disabled={saving}>
                <FolderPlus size={15} />
                <span>{saving ? 'Saving…' : editingId ? 'Update Category' : 'Create Category'}</span>
              </button>
              {editingId ? (
                <button type="button" className="admin-pill-link" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="admin-card">
          <h2>Tags / Labels ({tags.length})</h2>
          <form className="cms-inline-add" onSubmit={handleAddTag}>
            <input
              type="text"
              placeholder="Add tag (e.g. PGT Geography, Class 12)"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <button type="submit" className="admin-pill-link is-primary">
              <Plus size={15} />
              <span>Add Tag</span>
            </button>
          </form>

          {tags.length === 0 ? (
            <p className="cms-muted">
              No tags yet. Tags added here or inside posts appear automatically.
            </p>
          ) : (
            <div className="cms-tag-cloud">
              {tags.map((tag) => (
                <span key={tag.id} className="cms-tag-pill">
                  <Tag size={12} />
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag)}
                    aria-label={`Delete ${tag.name}`}
                    title={`Delete ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="admin-card">
        <h2>All Categories ({categories.length})</h2>
        {categories.length === 0 ? (
          <p className="cms-muted">
            No custom categories in Firestore yet. Create one above to sync with the editor and
            public site.
          </p>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Parent</th>
                  <th>Order</th>
                  <th>Public</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <strong>{cat.name}</strong>
                      {cat.description ? <div className="cms-subtext">{cat.description}</div> : null}
                    </td>
                    <td>
                      <code>/category/{cat.slug}</code>
                    </td>
                    <td>{cat.parentId ? categoryNameById[cat.parentId] || cat.parentId : '—'}</td>
                    <td>{cat.order ?? 0}</td>
                    <td>
                      <span className={cat.showOnPublic !== false ? 'cms-badge is-published' : 'cms-badge'}>
                        {cat.showOnPublic !== false ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div className="cms-row-actions">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => startEdit(cat)}
                          title="Edit category"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete category"
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
